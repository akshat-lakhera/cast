pub mod bluetooth;
pub mod usb;
pub mod router;

use serde::{Deserialize, Serialize};
use std::fmt;

/// Information about a discovered device
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredDevice {
    /// Unique identifier (MAC address for BT, USB path for USB)
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// Device class (phone, laptop, tablet, desktop, unknown)
    pub device_type: DeviceType,
    /// Transport this device was found on
    pub transport: TransportKind,
    /// Bluetooth RSSI in dBm (None for USB)
    pub rssi_dbm: Option<i16>,
    /// USB link speed in Mbps (None for Bluetooth)
    pub usb_speed_mbps: Option<u32>,
    /// Whether this device is currently connected
    pub connected: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DeviceType {
    Phone,
    Laptop,
    Tablet,
    Desktop,
    Unknown,
}

impl fmt::Display for DeviceType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DeviceType::Phone => write!(f, "phone"),
            DeviceType::Laptop => write!(f, "laptop"),
            DeviceType::Tablet => write!(f, "tablet"),
            DeviceType::Desktop => write!(f, "desktop"),
            DeviceType::Unknown => write!(f, "unknown"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TransportKind {
    Bluetooth,
    Usb,
}

impl fmt::Display for TransportKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TransportKind::Bluetooth => write!(f, "bluetooth"),
            TransportKind::Usb => write!(f, "usb"),
        }
    }
}

/// Trait for transport implementations
#[async_trait::async_trait]
pub trait Transport: Send + Sync {
    /// Scan for nearby devices
    async fn scan(&self) -> Vec<DiscoveredDevice>;

    /// Connect to a device by ID
    async fn connect(&self, device_id: &str) -> Result<(), TransportError>;

    /// Disconnect from the current device
    async fn disconnect(&self) -> Result<(), TransportError>;

    /// Send raw bytes to the connected device
    async fn send(&self, data: &[u8]) -> Result<(), TransportError>;

    /// Receive raw bytes from the connected device
    async fn receive(&self) -> Result<Vec<u8>, TransportError>;

    /// Check if currently connected
    fn is_connected(&self) -> bool;

    /// Get the transport kind
    fn kind(&self) -> TransportKind;

    /// Get the maximum transmission unit (chunk size)
    fn mtu(&self) -> usize;
}

#[derive(Debug, thiserror::Error)]
pub enum TransportError {
    #[error("Device not found: {0}")]
    DeviceNotFound(String),
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),
    #[error("Not connected")]
    NotConnected,
    #[error("Send failed: {0}")]
    SendFailed(String),
    #[error("Receive failed: {0}")]
    ReceiveFailed(String),
    #[error("Transport not available: {0}")]
    NotAvailable(String),
}
