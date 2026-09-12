use super::{DiscoveredDevice, DeviceType, Transport, TransportError, TransportKind};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, warn};

/// USB transport implementation
///
/// Detects USB-tethered devices by scanning for network adapters created
/// when a phone enables USB Tethering (RNDIS on Android, CDC-NCM on iOS).
///
/// On Windows, USB tethering creates a new network interface (e.g., "RNDIS"
/// or "Apple Mobile Device Ethernet"). This transport detects those interfaces,
/// measures their link speed, and binds streaming sockets over the direct
/// USB point-to-point network.
///
/// Current implementation: Simulated for development.
/// Production will use `Get-NetAdapter` / Windows network APIs.
pub struct UsbTransport {
    connected_device: Arc<Mutex<Option<DiscoveredDevice>>>,
    /// USB MTU — much larger than Bluetooth
    mtu: usize,
}

impl UsbTransport {
    pub fn new() -> Self {
        Self {
            connected_device: Arc::new(Mutex::new(None)),
            mtu: 65536, // 64 KB jumbo frames for USB
        }
    }

    /// Scan for USB-tethered devices by inspecting network adapters.
    ///
    /// Production implementation:
    /// 1. Run `Get-NetAdapter` or use Windows API `GetAdaptersInfo`
    /// 2. Filter for adapters matching known USB tethering descriptors:
    ///    - "RNDIS" (Android USB tethering)
    ///    - "Apple Mobile Device Ethernet" (iOS)
    ///    - "CDC NCM" / "CDC ECM" (generic USB networking)
    ///    - "Remote NDIS" compatible adapters
    /// 3. Check adapter status (Up / Connected)
    /// 4. Read link speed (480 Mbps for USB 2.0, 5000 Mbps for USB 3.0+)
    /// 5. Get the IP address of the adapter gateway (the phone's USB IP)
    async fn scan_usb_devices(&self) -> Vec<DiscoveredDevice> {
        // TODO: Integrate with Windows network adapter enumeration
        //
        // For now, return simulated USB devices for frontend development

        info!("USB scan: simulating USB device detection for development");

        vec![
            DiscoveredDevice {
                id: "USB:RNDIS:192.168.42.129".to_string(),
                name: "Android Phone (USB Tethered)".to_string(),
                device_type: DeviceType::Phone,
                transport: TransportKind::Usb,
                rssi_dbm: None,
                usb_speed_mbps: Some(480),
                connected: false,
            },
            DiscoveredDevice {
                id: "USB:APPLE:172.20.10.1".to_string(),
                name: "iPhone (USB Ethernet)".to_string(),
                device_type: DeviceType::Phone,
                transport: TransportKind::Usb,
                rssi_dbm: None,
                usb_speed_mbps: Some(480),
                connected: false,
            },
        ]
    }
}

#[async_trait::async_trait]
impl Transport for UsbTransport {
    async fn scan(&self) -> Vec<DiscoveredDevice> {
        self.scan_usb_devices().await
    }

    async fn connect(&self, device_id: &str) -> Result<(), TransportError> {
        info!("USB: connecting to {}", device_id);

        // TODO: Production steps:
        // 1. Parse the IP address from device_id
        // 2. Establish a TCP socket to the device IP on CAST port
        // 3. Perform CAST-Wire handshake
        // 4. Store connected socket handle

        let mut connected = self.connected_device.lock().await;
        *connected = Some(DiscoveredDevice {
            id: device_id.to_string(),
            name: format!("USB Device {}", &device_id[..12.min(device_id.len())]),
            device_type: DeviceType::Phone,
            transport: TransportKind::Usb,
            rssi_dbm: None,
            usb_speed_mbps: Some(480),
            connected: true,
        });

        info!("USB: connected to {} (simulated)", device_id);
        Ok(())
    }

    async fn disconnect(&self) -> Result<(), TransportError> {
        let mut connected = self.connected_device.lock().await;
        if connected.is_none() {
            return Err(TransportError::NotConnected);
        }
        info!("USB: disconnecting");
        *connected = None;
        Ok(())
    }

    async fn send(&self, data: &[u8]) -> Result<(), TransportError> {
        let connected = self.connected_device.lock().await;
        if connected.is_none() {
            return Err(TransportError::NotConnected);
        }

        // TODO: Send over TCP socket
        // USB has massive MTU so no chunking needed for most payloads
        if data.len() > self.mtu {
            warn!(
                "USB: payload {} bytes exceeds MTU {} — unusual",
                data.len(),
                self.mtu
            );
        }

        Ok(())
    }

    async fn receive(&self) -> Result<Vec<u8>, TransportError> {
        let connected = self.connected_device.lock().await;
        if connected.is_none() {
            return Err(TransportError::NotConnected);
        }

        // TODO: Read from TCP socket
        Ok(Vec::new())
    }

    fn is_connected(&self) -> bool {
        self.connected_device
            .try_lock()
            .map(|guard| guard.is_some())
            .unwrap_or(false)
    }

    fn kind(&self) -> TransportKind {
        TransportKind::Usb
    }

    fn mtu(&self) -> usize {
        self.mtu
    }
}
