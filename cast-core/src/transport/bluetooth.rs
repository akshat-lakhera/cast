use super::{DiscoveredDevice, DeviceType, Transport, TransportError, TransportKind};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, warn};

/// Bluetooth transport implementation
///
/// On Windows, this interfaces with the Bluetooth stack to:
/// 1. Discover nearby Bluetooth devices (phones, laptops, tablets)
/// 2. Report RSSI signal strength
/// 3. Establish RFCOMM / PAN connections for data transfer
///
/// Current implementation: Simulated discovery for development.
/// Production will use Windows Bluetooth Sockets (AF_BTH / BTHPROTO_RFCOMM).
pub struct BluetoothTransport {
    connected_device: Arc<Mutex<Option<DiscoveredDevice>>>,
    /// Bluetooth MTU — RFCOMM typical maximum
    mtu: usize,
}

impl BluetoothTransport {
    pub fn new() -> Self {
        Self {
            connected_device: Arc::new(Mutex::new(None)),
            mtu: 1024, // Conservative RFCOMM MTU
        }
    }

    /// Scan the Windows Bluetooth radio for nearby devices.
    ///
    /// In production, this will call into the Windows Bluetooth APIs:
    /// - `BluetoothFindFirstDevice` / `BluetoothFindNextDevice` for Classic BT
    /// - or `btleplug` for BLE scanning
    ///
    /// For Phase 1 development, we simulate device discovery so the frontend
    /// can be built and tested end-to-end without requiring actual paired devices.
    async fn scan_real_devices(&self) -> Vec<DiscoveredDevice> {
        // TODO: Integrate with Windows Bluetooth stack
        //
        // Production implementation outline:
        // 1. Open local Bluetooth radio handle
        // 2. Call BluetoothFindFirstDevice with search params
        // 3. Iterate BluetoothFindNextDevice
        // 4. For each device, read:
        //    - szName (device name)
        //    - Address (MAC)
        //    - ulClassofDevice (device class → DeviceType)
        //    - fAuthenticated, fRemembered
        // 5. Query RSSI via HCI if possible
        //
        // For now, return simulated devices for UI development

        info!("Bluetooth scan: simulating device discovery for development");

        vec![
            DiscoveredDevice {
                id: "BT:AA:BB:CC:DD:EE:01".to_string(),
                name: "Samsung Galaxy S24".to_string(),
                device_type: DeviceType::Phone,
                transport: TransportKind::Bluetooth,
                rssi_dbm: Some(-52),
                usb_speed_mbps: None,
                connected: false,
            },
            DiscoveredDevice {
                id: "BT:AA:BB:CC:DD:EE:02".to_string(),
                name: "iPhone 15 Pro".to_string(),
                device_type: DeviceType::Phone,
                transport: TransportKind::Bluetooth,
                rssi_dbm: Some(-68),
                usb_speed_mbps: None,
                connected: false,
            },
            DiscoveredDevice {
                id: "BT:AA:BB:CC:DD:EE:03".to_string(),
                name: "ThinkPad X1 Carbon".to_string(),
                device_type: DeviceType::Laptop,
                transport: TransportKind::Bluetooth,
                rssi_dbm: Some(-45),
                usb_speed_mbps: None,
                connected: false,
            },
        ]
    }
}

#[async_trait::async_trait]
impl Transport for BluetoothTransport {
    async fn scan(&self) -> Vec<DiscoveredDevice> {
        self.scan_real_devices().await
    }

    async fn connect(&self, device_id: &str) -> Result<(), TransportError> {
        info!("Bluetooth: connecting to {}", device_id);

        // TODO: Establish RFCOMM socket connection
        // 1. Resolve device address from device_id
        // 2. Create socket(AF_BTH, SOCK_STREAM, BTHPROTO_RFCOMM)
        // 3. connect() to target address on RFCOMM channel 1
        // 4. Store connected socket handle

        let mut connected = self.connected_device.lock().await;
        *connected = Some(DiscoveredDevice {
            id: device_id.to_string(),
            name: format!("BT Device {}", &device_id[..8.min(device_id.len())]),
            device_type: DeviceType::Unknown,
            transport: TransportKind::Bluetooth,
            rssi_dbm: Some(-50),
            usb_speed_mbps: None,
            connected: true,
        });

        info!("Bluetooth: connected to {} (simulated)", device_id);
        Ok(())
    }

    async fn disconnect(&self) -> Result<(), TransportError> {
        let mut connected = self.connected_device.lock().await;
        if connected.is_none() {
            return Err(TransportError::NotConnected);
        }
        info!("Bluetooth: disconnecting");
        *connected = None;
        Ok(())
    }

    async fn send(&self, data: &[u8]) -> Result<(), TransportError> {
        let connected = self.connected_device.lock().await;
        if connected.is_none() {
            return Err(TransportError::NotConnected);
        }

        // TODO: Send over RFCOMM socket
        // In production: socket.send(data)
        if data.len() > self.mtu {
            warn!(
                "Bluetooth: payload {} bytes exceeds MTU {} — should be chunked",
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

        // TODO: Read from RFCOMM socket
        // In production: socket.recv(buf)
        Ok(Vec::new())
    }

    fn is_connected(&self) -> bool {
        // Non-async check — uses try_lock for non-blocking
        self.connected_device
            .try_lock()
            .map(|guard| guard.is_some())
            .unwrap_or(false)
    }

    fn kind(&self) -> TransportKind {
        TransportKind::Bluetooth
    }

    fn mtu(&self) -> usize {
        self.mtu
    }
}
