use super::{DiscoveredDevice, DeviceType, Transport, TransportError, TransportKind};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::info;

/// USB transport implementation
pub struct UsbTransport {
    connected_device: Arc<Mutex<Option<DiscoveredDevice>>>,
    mtu: usize,
}

impl UsbTransport {
    pub fn new() -> Self {
        Self {
            connected_device: Arc::new(Mutex::new(None)),
            mtu: 65536,
        }
    }

    /// Scan for real USB-tethered adapters by inspecting Windows network adapters.
    async fn scan_usb_devices(&self) -> Vec<DiscoveredDevice> {
        info!("Scanning for real USB tethering / network adapters on Windows host...");

        let mut devices = Vec::new();

        #[cfg(target_os = "windows")]
        {
            let output = std::process::Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-Command",
                    "Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object Name, InterfaceDescription, LinkSpeed | ConvertTo-Json",
                ])
                .output();

            if let Ok(output) = output {
                if output.status.success() {
                    let text = String::from_utf8_lossy(&output.stdout);
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                        let list = if val.is_array() {
                            val.as_array().cloned().unwrap_or_default()
                        } else if val.is_object() {
                            vec![val]
                        } else {
                            vec![]
                        };

                        for item in list {
                            if let (Some(name), Some(desc), Some(speed)) = (
                                item.get("Name").and_then(|n| n.as_str()),
                                item.get("InterfaceDescription").and_then(|d| d.as_str()),
                                item.get("LinkSpeed").and_then(|s| s.as_str()),
                            ) {
                                let desc_lower = desc.to_lowercase();
                                let is_usb = desc_lower.contains("ndis")
                                    || desc_lower.contains("apple mobile")
                                    || desc_lower.contains("usb")
                                    || desc_lower.contains("ethernet");

                                if is_usb {
                                    let speed_num = speed
                                        .split_whitespace()
                                        .next()
                                        .and_then(|n| n.parse::<u32>().ok())
                                        .unwrap_or(480);

                                    let device_name = if desc_lower.contains("apple") {
                                        "Apple iPhone / iPad (USB Tethered)"
                                    } else if desc_lower.contains("ndis") {
                                        "Android Mobile (USB Tethered)"
                                    } else {
                                        desc
                                    };

                                    devices.push(DiscoveredDevice {
                                        id: format!("USB:{}", name),
                                        name: device_name.to_string(),
                                        device_type: if desc_lower.contains("apple") || desc_lower.contains("ndis") {
                                            DeviceType::Phone
                                        } else {
                                            DeviceType::Desktop
                                        },
                                        transport: TransportKind::Usb,
                                        rssi_dbm: None,
                                        usb_speed_mbps: Some(speed_num),
                                        connected: true,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        info!("USB scan discovered {} real active interface(s)", devices.len());
        devices
    }
}

#[async_trait::async_trait]
impl Transport for UsbTransport {
    async fn scan(&self) -> Vec<DiscoveredDevice> {
        self.scan_usb_devices().await
    }

    async fn connect(&self, device_id: &str) -> Result<(), TransportError> {
        info!("USB: connecting to {}", device_id);
        let mut device_lock = self.connected_device.lock().await;
        *device_lock = Some(DiscoveredDevice {
            id: device_id.to_string(),
            name: device_id.to_string(),
            device_type: DeviceType::Phone,
            transport: TransportKind::Usb,
            rssi_dbm: None,
            usb_speed_mbps: Some(480),
            connected: true,
        });
        Ok(())
    }

    async fn disconnect(&self) -> Result<(), TransportError> {
        info!("USB: disconnecting");
        let mut device_lock = self.connected_device.lock().await;
        *device_lock = None;
        Ok(())
    }

    async fn send(&self, _data: &[u8]) -> Result<(), TransportError> {
        Ok(())
    }

    async fn receive(&self) -> Result<Vec<u8>, TransportError> {
        Ok(Vec::new())
    }

    fn is_connected(&self) -> bool {
        true
    }

    fn kind(&self) -> TransportKind {
        TransportKind::Usb
    }

    fn mtu(&self) -> usize {
        self.mtu
    }
}
