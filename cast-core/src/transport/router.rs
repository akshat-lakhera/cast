use super::bluetooth::BluetoothTransport;
use super::usb::UsbTransport;
use super::{DiscoveredDevice, Transport, TransportKind};
use std::sync::Arc;
use tracing::info;

/// The transport router manages both Bluetooth and USB transports,
/// automatically prioritizing USB (for speed) when available,
/// falling back to Bluetooth (for wireless convenience).
pub struct TransportRouter {
    bluetooth: Arc<BluetoothTransport>,
    usb: Arc<UsbTransport>,
    active_transport: Option<TransportKind>,
}

impl TransportRouter {
    pub fn new() -> Self {
        Self {
            bluetooth: Arc::new(BluetoothTransport::new()),
            usb: Arc::new(UsbTransport::new()),
            active_transport: None,
        }
    }

    /// Scan all transports and return a unified device list
    pub async fn scan_all(&self) -> Vec<DiscoveredDevice> {
        let mut devices = Vec::new();

        let bt_devices = self.bluetooth.scan().await;
        info!("Bluetooth scan found {} devices", bt_devices.len());
        devices.extend(bt_devices);

        let usb_devices = self.usb.scan().await;
        info!("USB scan found {} devices", usb_devices.len());
        devices.extend(usb_devices);

        devices
    }

    /// Scan only Bluetooth devices
    pub async fn scan_bluetooth(&self) -> Vec<DiscoveredDevice> {
        self.bluetooth.scan().await
    }

    /// Scan only USB devices
    pub async fn scan_usb(&self) -> Vec<DiscoveredDevice> {
        self.usb.scan().await
    }

    /// Get the active transport implementation
    pub fn active(&self) -> Option<Arc<dyn Transport>> {
        match self.active_transport {
            Some(TransportKind::Bluetooth) => Some(self.bluetooth.clone()),
            Some(TransportKind::Usb) => Some(self.usb.clone()),
            None => None,
        }
    }

    /// Connect to a device, automatically selecting the right transport
    pub async fn connect(
        &mut self,
        device_id: &str,
        transport: TransportKind,
    ) -> Result<(), super::TransportError> {
        // Disconnect existing if any
        if self.active_transport.is_some() {
            let _ = self.disconnect().await;
        }

        match transport {
            TransportKind::Bluetooth => {
                self.bluetooth.connect(device_id).await?;
                self.active_transport = Some(TransportKind::Bluetooth);
                info!("Router: active transport set to Bluetooth");
            }
            TransportKind::Usb => {
                self.usb.connect(device_id).await?;
                self.active_transport = Some(TransportKind::Usb);
                info!("Router: active transport set to USB");
            }
        }

        Ok(())
    }

    /// Disconnect the active transport
    pub async fn disconnect(&mut self) -> Result<(), super::TransportError> {
        match self.active_transport {
            Some(TransportKind::Bluetooth) => {
                self.bluetooth.disconnect().await?;
            }
            Some(TransportKind::Usb) => {
                self.usb.disconnect().await?;
            }
            None => return Err(super::TransportError::NotConnected),
        }
        self.active_transport = None;
        Ok(())
    }

    /// Get the MTU of the active transport
    pub fn active_mtu(&self) -> usize {
        match self.active_transport {
            Some(TransportKind::Bluetooth) => self.bluetooth.mtu(),
            Some(TransportKind::Usb) => self.usb.mtu(),
            None => 1024, // Conservative default
        }
    }

    /// Get the active transport kind
    pub fn active_kind(&self) -> Option<TransportKind> {
        self.active_transport
    }

    /// Check if any transport is connected
    pub fn is_connected(&self) -> bool {
        self.active_transport.is_some()
    }
}
