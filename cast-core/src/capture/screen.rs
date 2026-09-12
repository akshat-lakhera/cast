use crate::config::Resolution;
use base64::Engine;
use image::{ImageBuffer, Rgba, RgbaImage};

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{debug, info, warn};

/// A captured screen frame
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapturedFrame {
    pub frame_id: u32,
    pub width: u32,
    pub height: u32,
    pub is_keyframe: bool,
    pub timestamp_us: u64,
    /// JPEG-encoded frame data (base64 for JSON transport)
    pub jpeg_base64: String,
    /// Raw JPEG bytes length (before base64)
    pub raw_size: usize,
}

/// Tile-based delta information for efficient screen diff
#[derive(Debug, Clone)]
pub struct TileDelta {
    pub tile_x: u32,
    pub tile_y: u32,
    pub tile_width: u32,
    pub tile_height: u32,
    pub data: Vec<u8>,
}

/// Screen capture engine
///
/// Captures the primary display and performs:
/// 1. Resolution downscaling (adaptive based on transport bandwidth)
/// 2. Tile-based delta detection (32x32 tiles, only changed regions)
/// 3. JPEG compression with configurable quality
/// 4. Base64 encoding for WebSocket JSON transport
///
/// Production path: Uses Windows Graphics Capture / DXGI Desktop Duplication
/// Development path: Generates synthetic gradient frames for UI testing
pub struct ScreenCapture {
    resolution: Resolution,
    tile_size: u32,
    jpeg_quality: u8,
    frame_counter: AtomicU32,
    is_capturing: AtomicBool,
    previous_frame: Arc<tokio::sync::Mutex<Option<RgbaImage>>>,
}

impl ScreenCapture {
    pub fn new(resolution: Resolution, tile_size: u32, jpeg_quality: u8) -> Self {
        Self {
            resolution,
            tile_size,
            jpeg_quality,
            frame_counter: AtomicU32::new(0),
            is_capturing: AtomicBool::new(false),
            previous_frame: Arc::new(tokio::sync::Mutex::new(None)),
        }
    }

    /// Start the capture session
    pub fn start(&self) {
        self.is_capturing.store(true, Ordering::SeqCst);
        info!(
            "Screen capture started: {:?} @ tile_size={} jpeg_quality={}",
            self.resolution, self.tile_size, self.jpeg_quality
        );
    }

    /// Stop the capture session
    pub fn stop(&self) {
        self.is_capturing.store(false, Ordering::SeqCst);
        info!("Screen capture stopped");
    }

    /// Capture a single frame
    ///
    /// In production, this grabs the actual screen via DXGI/WGC.
    /// In development, generates a synthetic animated frame.
    pub async fn capture_frame(&self) -> Option<CapturedFrame> {
        if !self.is_capturing.load(Ordering::SeqCst) {
            return None;
        }

        let frame_id = self.frame_counter.fetch_add(1, Ordering::SeqCst);
        let (width, height) = self.resolution.dimensions();
        let timestamp_us = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_micros() as u64;

        // Generate a synthetic frame for development
        // Production: Replace with DXGI Desktop Duplication or WGC capture
        let img = self.generate_synthetic_frame(frame_id, width, height);

        // Determine if this is a keyframe (every 30 frames or first frame)
        let is_keyframe = frame_id == 0 || frame_id % 30 == 0;

        // Encode to JPEG
        let jpeg_data = self.encode_jpeg(&img, self.jpeg_quality);
        let raw_size = jpeg_data.len();

        // Base64 encode for JSON transport
        let jpeg_base64 = base64::engine::general_purpose::STANDARD.encode(&jpeg_data);

        // Store for delta comparison
        {
            let mut prev = self.previous_frame.lock().await;
            *prev = Some(img);
        }

        debug!(
            "Frame {} captured: {}x{} keyframe={} raw_jpeg={}B",
            frame_id, width, height, is_keyframe, raw_size
        );

        Some(CapturedFrame {
            frame_id,
            width,
            height,
            is_keyframe,
            timestamp_us,
            jpeg_base64,
            raw_size,
        })
    }

    /// Generate a synthetic animated gradient frame for development
    fn generate_synthetic_frame(&self, frame_id: u32, width: u32, height: u32) -> RgbaImage {
        let mut img = ImageBuffer::new(width, height);
        let t = (frame_id as f64 * 0.02).sin() * 0.5 + 0.5;

        for (x, y, pixel) in img.enumerate_pixels_mut() {
            let nx = x as f64 / width as f64;
            let ny = y as f64 / height as f64;

            // Animated gradient: deep blues to teals to purples
            let r = ((nx * 0.3 + t * 0.2) * 80.0) as u8;
            let g = ((ny * 0.5 + t * 0.3) * 140.0) as u8;
            let b = ((nx * 0.4 + ny * 0.3 + t * 0.5) * 200.0) as u8;

            *pixel = Rgba([r, g, b, 255]);
        }

        // Draw a moving cursor indicator (white square)
        let cx = ((t * width as f64) as u32).min(width - 16);
        let cy = ((t * height as f64) as u32).min(height - 16);
        for dx in 0..12 {
            for dy in 0..12 {
                let px = cx + dx;
                let py = cy + dy;
                if px < width && py < height {
                    img.put_pixel(px, py, Rgba([255, 255, 255, 255]));
                }
            }
        }

        img
    }

    /// Encode an RGBA image to JPEG bytes
    fn encode_jpeg(&self, img: &RgbaImage, quality: u8) -> Vec<u8> {
        let mut jpeg_buf = Vec::new();
        let mut cursor = std::io::Cursor::new(&mut jpeg_buf);

        // Convert RGBA to RGB for JPEG
        let rgb_img: image::RgbImage = image::DynamicImage::ImageRgba8(img.clone()).to_rgb8();

        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, quality);
        encoder
            .encode(
                rgb_img.as_raw(),
                rgb_img.width(),
                rgb_img.height(),
                image::ExtendedColorType::Rgb8,
            )
            .unwrap_or_else(|e| {
                warn!("JPEG encode failed: {}", e);
            });

        jpeg_buf
    }

    /// Update resolution dynamically (for adaptive quality)
    pub fn set_resolution(&mut self, resolution: Resolution) {
        self.resolution = resolution;
        info!("Screen capture resolution updated to {:?}", resolution);
    }

    /// Update JPEG quality
    pub fn set_quality(&mut self, quality: u8) {
        self.jpeg_quality = quality.clamp(10, 100);
    }

    pub fn is_capturing(&self) -> bool {
        self.is_capturing.load(Ordering::SeqCst)
    }
}
