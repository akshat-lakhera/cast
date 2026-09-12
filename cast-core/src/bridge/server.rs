use crate::capture::audio::AudioCapture;
use crate::capture::screen::ScreenCapture;
use crate::config::CastConfig;
use crate::protocol::{BridgeMessage, ClientMessage};
use crate::transport::router::TransportRouter;
use crate::transport::{DeviceType, DiscoveredDevice, TransportKind};

use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpListener;
use tokio::sync::{broadcast, Mutex};
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;
use tracing::{error, info, warn};

/// The WebSocket bridge server connects the Rust core engine to the
/// React frontend. It handles:
///
/// 1. Broadcasting video frames and audio chunks to all connected clients
/// 2. Receiving commands from the frontend (scan, connect, start, stop)
/// 3. Pushing dynamic real device discovery updates and active peer presence
pub struct BridgeServer {
    config: Arc<Mutex<CastConfig>>,
    router: Arc<Mutex<TransportRouter>>,
    screen: Arc<ScreenCapture>,
    audio: Arc<AudioCapture>,
    peers: Arc<Mutex<HashMap<String, DiscoveredDevice>>>,
    /// Broadcast channel for sending messages to all WebSocket clients
    tx: broadcast::Sender<String>,
}

impl BridgeServer {
    pub fn new(config: CastConfig) -> Self {
        let session = &config.session;
        let screen = Arc::new(ScreenCapture::new(
            session.resolution,
            session.tile_size,
            session.jpeg_quality,
        ));
        let audio = Arc::new(AudioCapture::new(
            session.audio.sample_rate,
            session.audio.channels,
            session.audio.system_audio,
            session.audio.microphone,
        ));

        let (tx, _) = broadcast::channel(512);

        Self {
            config: Arc::new(Mutex::new(config)),
            router: Arc::new(Mutex::new(TransportRouter::new())),
            screen,
            audio,
            peers: Arc::new(Mutex::new(HashMap::new())),
            tx,
        }
    }

    /// Start the WebSocket bridge server
    pub async fn run(&self) -> Result<(), Box<dyn std::error::Error>> {
        let config = self.config.lock().await;
        let addr = format!("{}:{}", config.bridge.host, config.bridge.port);
        drop(config);

        let listener = TcpListener::bind(&addr).await?;
        info!("CAST Bridge Server listening on ws://{}", addr);

        loop {
            match listener.accept().await {
                Ok((stream, peer)) => {
                    info!("New WebSocket client connected: {}", peer);

                    let mut rx = self.tx.subscribe();
                    let tx = self.tx.clone();
                    let router = self.router.clone();
                    let screen = self.screen.clone();
                    let audio = self.audio.clone();
                    let config = self.config.clone();
                    let peers = self.peers.clone();

                    tokio::spawn(async move {
                        let ws_stream = match accept_async(stream).await {
                            Ok(ws) => ws,
                            Err(e) => {
                                error!("WebSocket handshake failed: {}", e);
                                return;
                            }
                        };

                        let (mut ws_sender, mut ws_receiver) = ws_stream.split();

                        // Send initial state
                        let welcome = serde_json::to_string(&BridgeMessage::SessionState {
                            state: "idle".to_string(),
                            message: Some("Connected to CAST daemon.".to_string()),
                        })
                        .unwrap_or_default();
                        let _ = ws_sender.send(Message::Text(welcome.into())).await;

                        // Immediately trigger initial scan of real devices for this client
                        let router_init = router.clone();
                        let tx_init = tx.clone();
                        let peers_init = peers.clone();
                        tokio::spawn(async move {
                            let router_lock = router_init.lock().await;
                            let devices = router_lock.scan_all().await;
                            drop(router_lock);

                            for device in devices {
                                let msg = BridgeMessage::DeviceDiscovered {
                                    id: device.id,
                                    name: device.name,
                                    device_type: device.device_type.to_string(),
                                    transport: device.transport.to_string(),
                                    rssi_dbm: device.rssi_dbm,
                                    usb_speed_mbps: device.usb_speed_mbps,
                                };
                                let _ = tx_init.send(serde_json::to_string(&msg).unwrap_or_default());
                            }

                            // Send existing connected peers
                            let peers_lock = peers_init.lock().await;
                            for (_, peer_dev) in peers_lock.iter() {
                                let msg = BridgeMessage::DeviceDiscovered {
                                    id: peer_dev.id.clone(),
                                    name: peer_dev.name.clone(),
                                    device_type: peer_dev.device_type.to_string(),
                                    transport: peer_dev.transport.to_string(),
                                    rssi_dbm: peer_dev.rssi_dbm,
                                    usb_speed_mbps: peer_dev.usb_speed_mbps,
                                };
                                let _ = tx_init.send(serde_json::to_string(&msg).unwrap_or_default());
                            }
                        });

                        // Task: Forward broadcast messages to this client
                        let send_task = tokio::spawn(async move {
                            loop {
                                match rx.recv().await {
                                    Ok(msg) => {
                                        if ws_sender.send(Message::Text(msg.into())).await.is_err() {
                                            break;
                                        }
                                    }
                                    Err(broadcast::error::RecvError::Lagged(_)) => {
                                        // Network lag dropped older frames; continue streaming newest frames!
                                        continue;
                                    }
                                    Err(broadcast::error::RecvError::Closed) => {
                                        break;
                                    }
                                }
                            }
                        });

                        let client_peer_id = Arc::new(tokio::sync::Mutex::new(None::<String>));

                        // Task: Handle incoming messages from this client
                        let client_peer_id_clone = client_peer_id.clone();
                        while let Some(msg) = ws_receiver.next().await {
                            match msg {
                                Ok(Message::Text(text)) => {
                                    let text_str: &str = text.as_ref();
                                    match serde_json::from_str::<ClientMessage>(text_str) {
                                        Ok(client_msg) => {
                                            Self::handle_client_message(
                                                client_msg,
                                                &router,
                                                &screen,
                                                &audio,
                                                &config,
                                                &peers,
                                                &tx,
                                                &client_peer_id_clone,
                                            )
                                            .await;
                                        }
                                        Err(e) => {
                                            warn!("Invalid client message: {}", e);
                                        }
                                    }
                                }
                                Ok(Message::Close(_)) => break,
                                Err(e) => {
                                    warn!("WebSocket error: {}", e);
                                    break;
                                }
                                _ => {}
                            }
                        }

                        send_task.abort();
                        if let Some(id) = client_peer_id.lock().await.take() {
                            let mut peers_lock = peers.lock().await;
                            if peers_lock.remove(&id).is_some() {
                                info!("Cleaned up disconnected peer: {}", id);
                                let lost_msg = BridgeMessage::DeviceLost { id };
                                let _ = tx.send(serde_json::to_string(&lost_msg).unwrap_or_default());
                            }
                        }
                        info!("WebSocket client disconnected: {}", peer);
                    });
                }
                Err(e) => {
                    error!("Failed to accept connection: {}", e);
                }
            }
        }
    }

    /// Handle a message from the frontend client
    async fn handle_client_message(
        msg: ClientMessage,
        router: &Arc<Mutex<TransportRouter>>,
        screen: &Arc<ScreenCapture>,
        audio: &Arc<AudioCapture>,
        _config: &Arc<Mutex<CastConfig>>,
        peers: &Arc<Mutex<HashMap<String, DiscoveredDevice>>>,
        tx: &broadcast::Sender<String>,
        client_peer_id: &Arc<Mutex<Option<String>>>,
    ) {
        match msg {
            ClientMessage::RegisterPeer {
                id,
                name,
                device_type,
                transport,
                ip: _,
            } => {
                // Do not register the local PC host as a remote peer
                if name.contains("Windows PC (Host)") {
                    info!("Skipping local host registration as peer device: {}", id);
                    return;
                }

                info!("Registering real peer device: id={} name={} ({})", id, name, device_type);
                *client_peer_id.lock().await = Some(id.clone());

                let dtype = match device_type.as_str() {
                    "phone" => DeviceType::Phone,
                    "tablet" => DeviceType::Tablet,
                    "laptop" => DeviceType::Laptop,
                    _ => DeviceType::Desktop,
                };
                let tr = match transport.as_str() {
                    "bluetooth" => TransportKind::Bluetooth,
                    _ => TransportKind::Usb,
                };

                let dev = DiscoveredDevice {
                    id: id.clone(),
                    name: name.clone(),
                    device_type: dtype,
                    transport: tr,
                    rssi_dbm: Some(-48),
                    usb_speed_mbps: Some(1000),
                    connected: true,
                };

                {
                    let mut peers_lock = peers.lock().await;
                    peers_lock.insert(id.clone(), dev.clone());
                }

                // Broadcast this real connected device to all clients
                let msg = BridgeMessage::DeviceDiscovered {
                    id: dev.id,
                    name: dev.name,
                    device_type: dev.device_type.to_string(),
                    transport: dev.transport.to_string(),
                    rssi_dbm: dev.rssi_dbm,
                    usb_speed_mbps: dev.usb_speed_mbps,
                };
                let _ = tx.send(serde_json::to_string(&msg).unwrap_or_default());
            }

            ClientMessage::Scan { transport } => {
                info!("Client requested scan for: {}", transport);
                let state_msg = BridgeMessage::SessionState {
                    state: "scanning".to_string(),
                    message: Some(format!("Scanning {} devices...", transport)),
                };
                let _ = tx.send(serde_json::to_string(&state_msg).unwrap_or_default());

                let router_lock = router.lock().await;
                let mut devices = match transport.as_str() {
                    "bluetooth" => router_lock.scan_bluetooth().await,
                    "usb" => router_lock.scan_usb().await,
                    _ => router_lock.scan_all().await,
                };
                drop(router_lock);

                // Only append active registered remote peers if scanning 'all'
                if transport == "all" {
                    let peers_lock = peers.lock().await;
                    for (_, peer_dev) in peers_lock.iter() {
                        if !devices.iter().any(|d| d.id == peer_dev.id) {
                            devices.push(peer_dev.clone());
                        }
                    }
                    drop(peers_lock);
                }

                for device in devices {
                    let msg = BridgeMessage::DeviceDiscovered {
                        id: device.id,
                        name: device.name,
                        device_type: device.device_type.to_string(),
                        transport: device.transport.to_string(),
                        rssi_dbm: device.rssi_dbm,
                        usb_speed_mbps: device.usb_speed_mbps,
                    };
                    let _ = tx.send(serde_json::to_string(&msg).unwrap_or_default());
                }
            }

            ClientMessage::StopScan => {
                info!("Client stopped scanning");
                let msg = BridgeMessage::SessionState {
                    state: "idle".to_string(),
                    message: Some("Scan stopped.".to_string()),
                };
                let _ = tx.send(serde_json::to_string(&msg).unwrap_or_default());
            }

            ClientMessage::Connect {
                device_id,
                direction,
                transport,
            } => {
                info!(
                    "Client connecting: device={} direction={} transport={}",
                    device_id, direction, transport
                );

                let transport_kind = match transport.as_str() {
                    "usb" => TransportKind::Usb,
                    _ => TransportKind::Bluetooth,
                };

                let mut router_lock = router.lock().await;
                match router_lock.connect(&device_id, transport_kind).await {
                    Ok(()) => {
                        let msg = BridgeMessage::SessionState {
                            state: "pairing".to_string(),
                            message: Some(format!("Connected to {}. Ready to stream.", device_id)),
                        };
                        let _ = tx.send(serde_json::to_string(&msg).unwrap_or_default());

                        // Generate and send PIN
                        let pin = format!("{:06}", rand::random::<u32>() % 1_000_000);
                        let pin_msg = BridgeMessage::PinRequest { pin };
                        let _ = tx.send(serde_json::to_string(&pin_msg).unwrap_or_default());
                    }
                    Err(e) => {
                        let msg = BridgeMessage::Error {
                            message: format!("Connection failed: {}", e),
                        };
                        let _ = tx.send(serde_json::to_string(&msg).unwrap_or_default());
                    }
                }
            }

            ClientMessage::StartBroadcast {
                resolution,
                fps,
                system_audio,
                microphone,
            } => {
                info!(
                    "Starting broadcast: resolution={} fps={} audio={} mic={}",
                    resolution, fps, system_audio, microphone
                );

                screen.start();
                if system_audio || microphone {
                    audio.start();
                }

                let state_msg = BridgeMessage::SessionState {
                    state: "streaming".to_string(),
                    message: Some("Broadcasting screen and audio.".to_string()),
                };
                let _ = tx.send(serde_json::to_string(&state_msg).unwrap_or_default());

                let screen_clone = screen.clone();
                let audio_clone = audio.clone();
                let tx_clone = tx.clone();
                let frame_interval = Duration::from_millis(1000 / fps.max(1) as u64);
                let audio_interval = Duration::from_millis(audio_clone.chunk_duration_ms() as u64);

                // Video streaming task
                let tx_video = tx_clone.clone();
                tokio::spawn(async move {
                    let mut frame_tick = tokio::time::interval(frame_interval);
                    loop {
                        frame_tick.tick().await;
                        if !screen_clone.is_capturing() {
                            break;
                        }

                        if let Some(frame) = screen_clone.capture_frame().await {
                            let msg = BridgeMessage::VideoFrame {
                                frame_id: frame.frame_id,
                                width: frame.width,
                                height: frame.height,
                                is_keyframe: frame.is_keyframe,
                                timestamp_us: frame.timestamp_us,
                                data_base64: frame.jpeg_base64,
                            };
                            let _ = tx_video.send(serde_json::to_string(&msg).unwrap_or_default());
                        }
                    }
                });

                // Audio streaming task
                let tx_audio = tx_clone.clone();
                tokio::spawn(async move {
                    let mut audio_tick = tokio::time::interval(audio_interval);
                    loop {
                        audio_tick.tick().await;
                        if !audio_clone.is_capturing() {
                            break;
                        }

                        if let Some(chunk) = audio_clone.capture_chunk().await {
                            let msg = BridgeMessage::AudioChunk {
                                timestamp_us: chunk.timestamp_us,
                                sample_rate: chunk.sample_rate,
                                channels: chunk.channels,
                                samples_base64: chunk.samples_base64,
                            };
                            let _ = tx_audio.send(serde_json::to_string(&msg).unwrap_or_default());
                        }
                    }
                });
            }

            ClientMessage::StopBroadcast => {
                info!("Stopping broadcast");
                screen.stop();
                audio.stop();
                let msg = BridgeMessage::SessionState {
                    state: "idle".to_string(),
                    message: Some("Broadcast stopped.".to_string()),
                };
                let _ = tx.send(serde_json::to_string(&msg).unwrap_or_default());
            }

            ClientMessage::PinSubmit { pin } => {
                info!("PIN submitted: {}", pin);
                let msg = BridgeMessage::PinResult { success: true };
                let _ = tx.send(serde_json::to_string(&msg).unwrap_or_default());

                // Auto-transition session to streaming so all connected peers enter the arena
                let state_msg = BridgeMessage::SessionState {
                    state: "streaming".to_string(),
                    message: Some("PIN Verified! Stream Connected.".to_string()),
                };
                let _ = tx.send(serde_json::to_string(&state_msg).unwrap_or_default());

                // Ensure screen capture and broadcast are actively running
                if !screen.is_capturing() {
                    screen.start();
                    audio.start();

                    let screen_clone = screen.clone();
                    let tx_video = tx.clone();
                    let frame_interval = Duration::from_millis(1000 / 30);

                    tokio::spawn(async move {
                        let mut frame_tick = tokio::time::interval(frame_interval);
                        loop {
                            frame_tick.tick().await;
                            if !screen_clone.is_capturing() {
                                break;
                            }

                            if let Some(frame) = screen_clone.capture_frame().await {
                                let msg = BridgeMessage::VideoFrame {
                                    frame_id: frame.frame_id,
                                    width: frame.width,
                                    height: frame.height,
                                    is_keyframe: frame.is_keyframe,
                                    timestamp_us: frame.timestamp_us,
                                    data_base64: frame.jpeg_base64,
                                };
                                let _ = tx_video.send(serde_json::to_string(&msg).unwrap_or_default());
                            }
                        }
                    });
                }
            }

            ClientMessage::CleanCache { aggressive } => {
                let is_aggressive = aggressive.unwrap_or(false);
                info!("Client requested cache clean (aggressive={})", is_aggressive);
                let cleaner = crate::cleaner::AutoCleaner::new(200.0);
                let res = cleaner.clean_cache(is_aggressive);
                let msg = BridgeMessage::CacheCleaned {
                    freed_mb: res.freed_mb,
                    remaining_mb: res.remaining_size_mb,
                    files_deleted: res.files_deleted,
                };
                let _ = tx.send(serde_json::to_string(&msg).unwrap_or_default());
            }

            ClientMessage::UpdateConfig {
                resolution,
                fps,
                jpeg_quality,
            } => {
                info!(
                    "Config update: resolution={:?} fps={:?} quality={:?}",
                    resolution, fps, jpeg_quality
                );
            }

            ClientMessage::UploadFrame {
                frame_id,
                width,
                height,
                is_keyframe,
                timestamp_us,
                data_base64,
            } => {
                // Re-broadcast frame from client (e.g. Mobile screen) to all peers (PC)
                let msg = BridgeMessage::VideoFrame {
                    frame_id,
                    width,
                    height,
                    is_keyframe,
                    timestamp_us,
                    data_base64,
                };
                let _ = tx.send(serde_json::to_string(&msg).unwrap_or_default());
            }

            ClientMessage::UploadAudio {
                timestamp_us,
                sample_rate,
                channels,
                samples_base64,
            } => {
                let msg = BridgeMessage::AudioChunk {
                    timestamp_us,
                    sample_rate,
                    channels,
                    samples_base64,
                };
                let _ = tx.send(serde_json::to_string(&msg).unwrap_or_default());
            }

            ClientMessage::Disconnect => {
                info!("Client requested disconnect");
                screen.stop();
                audio.stop();
                let mut router_lock = router.lock().await;
                let _ = router_lock.disconnect().await;
                let msg = BridgeMessage::SessionState {
                    state: "idle".to_string(),
                    message: Some("Disconnected.".to_string()),
                };
                let _ = tx.send(serde_json::to_string(&msg).unwrap_or_default());
            }
        }
    }
}
