use serde::{Deserialize, Serialize};

/// The direction of the cast session
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CastDirection {
    PcToMobile,
    MobileToPc,
    PcToPc,
    MobileToMobile,
}

/// The physical transport method
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TransportMode {
    Bluetooth,
    Usb,
}

/// Stream resolution presets
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Resolution {
    /// 3840 x 2160
    UHD4K,
    /// 1920 x 1080
    FullHD,
    /// 1280 x 720
    HD,
    /// 854 x 480
    SD,
    /// 640 x 360
    Low,
}

impl Resolution {
    pub fn dimensions(&self) -> (u32, u32) {
        match self {
            Resolution::UHD4K => (3840, 2160),
            Resolution::FullHD => (1920, 1080),
            Resolution::HD => (1280, 720),
            Resolution::SD => (854, 480),
            Resolution::Low => (640, 360),
        }
    }

    /// Default resolution for the given transport
    pub fn default_for_transport(mode: TransportMode) -> Self {
        match mode {
            TransportMode::Usb => Resolution::FullHD,
            TransportMode::Bluetooth => Resolution::SD,
        }
    }
}

/// Audio source options
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct AudioConfig {
    pub system_audio: bool,
    pub microphone: bool,
    pub sample_rate: u32,
    pub channels: u16,
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self {
            system_audio: true,
            microphone: false,
            sample_rate: 48000,
            channels: 2,
        }
    }
}

/// Session configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    pub direction: CastDirection,
    pub transport: TransportMode,
    pub resolution: Resolution,
    pub target_fps: u32,
    pub audio: AudioConfig,
    pub tile_size: u32,
    pub jpeg_quality: u8,
    pub pin: Option<String>,
}

impl Default for SessionConfig {
    fn default() -> Self {
        Self {
            direction: CastDirection::PcToMobile,
            transport: TransportMode::Usb,
            resolution: Resolution::FullHD,
            target_fps: 30,
            audio: AudioConfig::default(),
            tile_size: 32,
            jpeg_quality: 75,
            pin: None,
        }
    }
}

/// WebSocket bridge configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeConfig {
    pub host: String,
    pub port: u16,
}

impl Default for BridgeConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 8765,
        }
    }
}

/// Top-level daemon configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CastConfig {
    pub session: SessionConfig,
    pub bridge: BridgeConfig,
}

impl Default for CastConfig {
    fn default() -> Self {
        Self {
            session: SessionConfig::default(),
            bridge: BridgeConfig::default(),
        }
    }
}
