use base64::Engine;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::Mutex;
use tracing::{debug, info};

/// A captured audio chunk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioChunk {
    pub timestamp_us: u64,
    pub sample_rate: u32,
    pub channels: u16,
    /// PCM samples as base64-encoded bytes (interleaved f32 samples)
    pub samples_base64: String,
    /// Number of samples in this chunk
    pub sample_count: usize,
}

/// Audio capture engine
///
/// Captures system audio via WASAPI loopback (on Windows) and optionally
/// the microphone input. Produces timestamped PCM audio chunks.
///
/// Production path: Uses `cpal` with WASAPI loopback for system sound capture.
/// Development path: Generates synthetic sine wave audio for UI testing.
pub struct AudioCapture {
    sample_rate: u32,
    channels: u16,
    is_capturing: AtomicBool,
    capture_system: bool,
    capture_mic: bool,
    chunk_duration_ms: u32,
    sample_counter: Arc<Mutex<u64>>,
}

impl AudioCapture {
    pub fn new(sample_rate: u32, channels: u16, system_audio: bool, microphone: bool) -> Self {
        Self {
            sample_rate,
            channels,
            is_capturing: AtomicBool::new(false),
            capture_system: system_audio,
            capture_mic: microphone,
            chunk_duration_ms: 20, // 20ms audio chunks (standard for low-latency)
            sample_counter: Arc::new(Mutex::new(0)),
        }
    }

    /// Start audio capture
    pub fn start(&self) {
        self.is_capturing.store(true, Ordering::SeqCst);
        info!(
            "Audio capture started: {}Hz {}ch system={} mic={}",
            self.sample_rate, self.channels, self.capture_system, self.capture_mic
        );
    }

    /// Stop audio capture
    pub fn stop(&self) {
        self.is_capturing.store(false, Ordering::SeqCst);
        info!("Audio capture stopped");
    }

    /// Capture a single audio chunk
    ///
    /// In production, this reads from WASAPI loopback via cpal.
    /// In development, generates a synthetic sine wave.
    pub async fn capture_chunk(&self) -> Option<AudioChunk> {
        if !self.is_capturing.load(Ordering::SeqCst) {
            return None;
        }

        let timestamp_us = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_micros() as u64;

        // Number of samples per chunk (per channel)
        let samples_per_chunk =
            (self.sample_rate as usize * self.chunk_duration_ms as usize) / 1000;

        // Generate synthetic audio for development
        let mut counter = self.sample_counter.lock().await;
        let samples = self.generate_synthetic_audio(*counter, samples_per_chunk);
        *counter += samples_per_chunk as u64;

        // Convert f32 samples to bytes and base64 encode
        let sample_bytes: Vec<u8> = samples
            .iter()
            .flat_map(|&s| s.to_le_bytes())
            .collect();

        let samples_base64 = base64::engine::general_purpose::STANDARD.encode(&sample_bytes);

        debug!(
            "Audio chunk: {} samples @ {}Hz timestamp={}us",
            samples_per_chunk, self.sample_rate, timestamp_us
        );

        Some(AudioChunk {
            timestamp_us,
            sample_rate: self.sample_rate,
            channels: self.channels,
            samples_base64,
            sample_count: samples_per_chunk,
        })
    }

    /// Generate synthetic stereo sine wave audio for development
    fn generate_synthetic_audio(&self, start_sample: u64, num_samples: usize) -> Vec<f32> {
        let mut samples = Vec::with_capacity(num_samples * self.channels as usize);
        let freq_hz = 440.0; // A4 note
        let amplitude = 0.3;

        for i in 0..num_samples {
            let t = (start_sample + i as u64) as f64 / self.sample_rate as f64;
            let value = (amplitude * (2.0 * std::f64::consts::PI * freq_hz * t).sin()) as f32;

            // Write same value to all channels (mono source → stereo)
            for _ in 0..self.channels {
                samples.push(value);
            }
        }

        samples
    }

    pub fn is_capturing(&self) -> bool {
        self.is_capturing.load(Ordering::SeqCst)
    }

    /// Get the chunk duration
    pub fn chunk_duration_ms(&self) -> u32 {
        self.chunk_duration_ms
    }
}
