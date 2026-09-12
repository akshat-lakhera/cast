use crc32fast::Hasher;
use serde::{Deserialize, Serialize};

// ─── Magic bytes: "CAST" ───────────────────────────────────────────
pub const MAGIC: [u8; 4] = [0x43, 0x41, 0x53, 0x54];
pub const PROTOCOL_VERSION: u8 = 1;

// ─── Packet type identifiers ──────────────────────────────────────
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum PacketType {
    // Handshake & auth
    HandshakeSyn = 0x01,
    HandshakeAck = 0x02,
    RoleSelect = 0x03,
    PinVerify = 0x04,
    PinResult = 0x05,

    // Video
    VideoKeyframe = 0x10,
    VideoDelta = 0x11,

    // Audio
    AudioChunk = 0x20,

    // Telemetry
    TelemetryPing = 0x30,
    TelemetryPong = 0x31,
    TelemetryStats = 0x32,

    // Phase 2 control (reserved, not implemented yet)
    ControlMouse = 0x40,
    ControlKeyboard = 0x41,
    ControlTouch = 0x42,

    // Session management
    Disconnect = 0xFE,
    Error = 0xFF,
}

impl PacketType {
    pub fn from_u8(val: u8) -> Option<Self> {
        match val {
            0x01 => Some(Self::HandshakeSyn),
            0x02 => Some(Self::HandshakeAck),
            0x03 => Some(Self::RoleSelect),
            0x04 => Some(Self::PinVerify),
            0x05 => Some(Self::PinResult),
            0x10 => Some(Self::VideoKeyframe),
            0x11 => Some(Self::VideoDelta),
            0x20 => Some(Self::AudioChunk),
            0x30 => Some(Self::TelemetryPing),
            0x31 => Some(Self::TelemetryPong),
            0x32 => Some(Self::TelemetryStats),
            0x40 => Some(Self::ControlMouse),
            0x41 => Some(Self::ControlKeyboard),
            0x42 => Some(Self::ControlTouch),
            0xFE => Some(Self::Disconnect),
            0xFF => Some(Self::Error),
            _ => None,
        }
    }
}

/// Transport flag in the wire header
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum TransportFlag {
    Bluetooth = 0x01,
    Usb = 0x02,
}

// ─── Wire header (fixed 16 bytes) ──────────────────────────────────
//
// Layout:
//   [0..4]   magic       "CAST"
//   [4]      version     protocol version
//   [5]      transport   TransportFlag
//   [6]      packet_type PacketType
//   [7]      reserved    0x00
//   [8..12]  sequence    u32 LE — monotonic packet counter
//   [12..16] payload_len u32 LE — payload byte length (excludes header + CRC)
//
// After the header: payload bytes, then 4-byte CRC32 of (header + payload).

pub const HEADER_SIZE: usize = 16;
pub const CRC_SIZE: usize = 4;

#[derive(Debug, Clone)]
pub struct PacketHeader {
    pub version: u8,
    pub transport: TransportFlag,
    pub packet_type: PacketType,
    pub sequence: u32,
    pub payload_len: u32,
}

impl PacketHeader {
    /// Serialize the header into 16 bytes
    pub fn to_bytes(&self) -> [u8; HEADER_SIZE] {
        let mut buf = [0u8; HEADER_SIZE];
        buf[0..4].copy_from_slice(&MAGIC);
        buf[4] = self.version;
        buf[5] = self.transport as u8;
        buf[6] = self.packet_type as u8;
        buf[7] = 0x00; // reserved
        buf[8..12].copy_from_slice(&self.sequence.to_le_bytes());
        buf[12..16].copy_from_slice(&self.payload_len.to_le_bytes());
        buf
    }

    /// Deserialize a header from 16 bytes
    pub fn from_bytes(buf: &[u8; HEADER_SIZE]) -> Option<Self> {
        if buf[0..4] != MAGIC {
            return None;
        }
        let version = buf[4];
        let transport = match buf[5] {
            0x01 => TransportFlag::Bluetooth,
            0x02 => TransportFlag::Usb,
            _ => return None,
        };
        let packet_type = PacketType::from_u8(buf[6])?;
        let sequence = u32::from_le_bytes([buf[8], buf[9], buf[10], buf[11]]);
        let payload_len = u32::from_le_bytes([buf[12], buf[13], buf[14], buf[15]]);
        Some(Self {
            version,
            transport,
            packet_type,
            sequence,
            payload_len,
        })
    }
}

/// A complete CAST-Wire packet (header + payload + CRC)
#[derive(Debug, Clone)]
pub struct Packet {
    pub header: PacketHeader,
    pub payload: Vec<u8>,
}

impl Packet {
    /// Create a new packet
    pub fn new(
        transport: TransportFlag,
        packet_type: PacketType,
        sequence: u32,
        payload: Vec<u8>,
    ) -> Self {
        let header = PacketHeader {
            version: PROTOCOL_VERSION,
            transport,
            packet_type,
            sequence,
            payload_len: payload.len() as u32,
        };
        Self { header, payload }
    }

    /// Serialize the full packet (header + payload + CRC32)
    pub fn serialize(&self) -> Vec<u8> {
        let header_bytes = self.header.to_bytes();
        let total_len = HEADER_SIZE + self.payload.len() + CRC_SIZE;
        let mut buf = Vec::with_capacity(total_len);
        buf.extend_from_slice(&header_bytes);
        buf.extend_from_slice(&self.payload);

        // CRC32 over header + payload
        let mut hasher = Hasher::new();
        hasher.update(&header_bytes);
        hasher.update(&self.payload);
        let crc = hasher.finalize();
        buf.extend_from_slice(&crc.to_le_bytes());

        buf
    }

    /// Deserialize a full packet from raw bytes
    pub fn deserialize(data: &[u8]) -> Option<Self> {
        if data.len() < HEADER_SIZE + CRC_SIZE {
            return None;
        }

        let header_bytes: &[u8; HEADER_SIZE] = data[..HEADER_SIZE].try_into().ok()?;
        let header = PacketHeader::from_bytes(header_bytes)?;
        let payload_end = HEADER_SIZE + header.payload_len as usize;

        if data.len() < payload_end + CRC_SIZE {
            return None;
        }

        let payload = data[HEADER_SIZE..payload_end].to_vec();
        let crc_bytes = &data[payload_end..payload_end + CRC_SIZE];
        let received_crc = u32::from_le_bytes([crc_bytes[0], crc_bytes[1], crc_bytes[2], crc_bytes[3]]);

        // Verify CRC
        let mut hasher = Hasher::new();
        hasher.update(&data[..payload_end]);
        let computed_crc = hasher.finalize();

        if received_crc != computed_crc {
            return None;
        }

        Some(Self { header, payload })
    }
}

// ─── Chunking engine ───────────────────────────────────────────────
//
// Large payloads (video keyframes) must be split into transport-friendly
// chunks to fit within Bluetooth MTU or USB packet sizes.

/// A single chunk of a larger payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkMeta {
    pub frame_id: u32,
    pub chunk_index: u16,
    pub total_chunks: u16,
    pub data_offset: u32,
    pub data_length: u32,
}

/// Split a payload into chunks of max_chunk_size
pub fn chunk_payload(frame_id: u32, payload: &[u8], max_chunk_size: usize) -> Vec<(ChunkMeta, Vec<u8>)> {
    let total_chunks = ((payload.len() + max_chunk_size - 1) / max_chunk_size) as u16;
    let mut chunks = Vec::with_capacity(total_chunks as usize);

    for (i, chunk_data) in payload.chunks(max_chunk_size).enumerate() {
        let meta = ChunkMeta {
            frame_id,
            chunk_index: i as u16,
            total_chunks,
            data_offset: (i * max_chunk_size) as u32,
            data_length: chunk_data.len() as u32,
        };
        chunks.push((meta, chunk_data.to_vec()));
    }

    chunks
}

/// Reassemble chunks into the original payload
pub fn reassemble_chunks(chunks: &mut [(ChunkMeta, Vec<u8>)]) -> Option<Vec<u8>> {
    if chunks.is_empty() {
        return None;
    }
    let total = chunks[0].0.total_chunks;
    if chunks.len() != total as usize {
        return None; // incomplete
    }
    chunks.sort_by_key(|(meta, _)| meta.chunk_index);

    let total_len: usize = chunks.iter().map(|(_, data)| data.len()).sum();
    let mut result = Vec::with_capacity(total_len);
    for (_, data) in chunks.iter() {
        result.extend_from_slice(data);
    }
    Some(result)
}

// ─── JSON message types for WebSocket bridge ───────────────────────

/// Messages sent from cast-core to the web frontend over WebSocket
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum BridgeMessage {
    /// A video frame (base64 JPEG)
    #[serde(rename = "video_frame")]
    VideoFrame {
        frame_id: u32,
        width: u32,
        height: u32,
        is_keyframe: bool,
        timestamp_us: u64,
        data_base64: String,
    },

    /// An audio sample buffer
    #[serde(rename = "audio_chunk")]
    AudioChunk {
        timestamp_us: u64,
        sample_rate: u32,
        channels: u16,
        samples_base64: String,
    },

    /// A discovered device (Bluetooth or USB)
    #[serde(rename = "device_discovered")]
    DeviceDiscovered {
        id: String,
        name: String,
        device_type: String,
        transport: String,
        rssi_dbm: Option<i16>,
        usb_speed_mbps: Option<u32>,
    },

    /// Device disconnected
    #[serde(rename = "device_lost")]
    DeviceLost { id: String },

    /// Telemetry stats
    #[serde(rename = "telemetry")]
    Telemetry {
        throughput_kbps: f64,
        latency_ms: f64,
        fps: f64,
        frame_drops: u64,
        jitter_ms: f64,
        transport: String,
    },

    /// Session state change
    #[serde(rename = "session_state")]
    SessionState {
        state: String, // "idle", "scanning", "pairing", "streaming", "disconnected"
        message: Option<String>,
    },

    /// PIN pairing request
    #[serde(rename = "pin_request")]
    PinRequest { pin: String },

    /// PIN verification result
    #[serde(rename = "pin_result")]
    PinResult { success: bool },

    /// Cache clean report
    #[serde(rename = "cache_cleaned")]
    CacheCleaned {
        freed_mb: f64,
        remaining_mb: f64,
        files_deleted: usize,
    },

    /// Error
    #[serde(rename = "error")]
    Error { message: String },
}

/// Messages sent from the web frontend to cast-core over WebSocket
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ClientMessage {
    /// Start scanning for devices
    #[serde(rename = "scan")]
    Scan { transport: String },

    /// Stop scanning
    #[serde(rename = "stop_scan")]
    StopScan,

    /// Connect to a device
    #[serde(rename = "connect")]
    Connect {
        device_id: String,
        direction: String,
        transport: String,
    },

    /// Start broadcasting screen + audio
    #[serde(rename = "start_broadcast")]
    StartBroadcast {
        resolution: String,
        fps: u32,
        system_audio: bool,
        microphone: bool,
    },

    /// Stop broadcasting
    #[serde(rename = "stop_broadcast")]
    StopBroadcast,

    /// Submit PIN
    #[serde(rename = "pin_submit")]
    PinSubmit { pin: String },

    /// Clean build and frame cache
    #[serde(rename = "clean_cache")]
    CleanCache { aggressive: Option<bool> },

    /// Update settings
    #[serde(rename = "update_config")]
    UpdateConfig {
        resolution: Option<String>,
        fps: Option<u32>,
        jpeg_quality: Option<u8>,
    },

    /// Disconnect from the current session
    #[serde(rename = "disconnect")]
    Disconnect,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_header_roundtrip() {
        let header = PacketHeader {
            version: PROTOCOL_VERSION,
            transport: TransportFlag::Usb,
            packet_type: PacketType::VideoKeyframe,
            sequence: 42,
            payload_len: 1024,
        };
        let bytes = header.to_bytes();
        let decoded = PacketHeader::from_bytes(&bytes).expect("should decode");
        assert_eq!(decoded.version, PROTOCOL_VERSION);
        assert_eq!(decoded.transport, TransportFlag::Usb);
        assert_eq!(decoded.packet_type, PacketType::VideoKeyframe);
        assert_eq!(decoded.sequence, 42);
        assert_eq!(decoded.payload_len, 1024);
    }

    #[test]
    fn test_packet_roundtrip() {
        let payload = b"hello cast wire protocol".to_vec();
        let pkt = Packet::new(TransportFlag::Bluetooth, PacketType::AudioChunk, 7, payload.clone());
        let serialized = pkt.serialize();
        let deserialized = Packet::deserialize(&serialized).expect("should deserialize");
        assert_eq!(deserialized.payload, payload);
        assert_eq!(deserialized.header.sequence, 7);
    }

    #[test]
    fn test_crc_tamper_detection() {
        let pkt = Packet::new(TransportFlag::Usb, PacketType::HandshakeSyn, 1, vec![1, 2, 3]);
        let mut data = pkt.serialize();
        // Tamper with payload
        data[HEADER_SIZE] = 0xFF;
        assert!(Packet::deserialize(&data).is_none());
    }

    #[test]
    fn test_chunking_roundtrip() {
        let payload: Vec<u8> = (0..5000).map(|i| (i % 256) as u8).collect();
        let chunks = chunk_payload(1, &payload, 1024);
        assert_eq!(chunks.len(), 5);
        let mut chunks_owned: Vec<(ChunkMeta, Vec<u8>)> = chunks;
        let reassembled = reassemble_chunks(&mut chunks_owned).expect("should reassemble");
        assert_eq!(reassembled, payload);
    }
}
