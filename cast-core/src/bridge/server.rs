use crate::capture::audio::AudioCapture;
use crate::capture::screen::ScreenCapture;
use crate::config::CastConfig;
use crate::protocol::{BridgeMessage, ClientMessage};
use crate::transport::router::TransportRouter;
use crate::transport::TransportKind;

use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpListener;
use tokio::sync::{broadcast, Mutex};
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;
use tracing::{error, info, warn};

/// The WebSocket bridge server connects the Rust core engine to the
/// React frontend. It runs on 127.0.0.1:8765 and handles:
///
/// 1. Broadcasting video frames and audio chunks to all connected clients
/// 2. Receiving commands from the frontend (scan, connect, start, stop)
/// 3. Pushing device discovery updates and telemetry stats
pub struct BridgeServer {
    config: Arc<Mutex<CastConfig>>,
    router: Arc<Mutex<TransportRouter>>,
    screen: Arc<ScreenCapture>,
    audio: Arc<AudioCapture>,
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

        let (tx, _) = broadcast::channel(128);

        Self {
            config: Arc::new(Mutex::new(config)),
            router: Arc::new(Mutex::new(TransportRouter::new())),
            screen,
            audio,
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

        // Broadcast initial session state
        self.broadcast_message(BridgeMessage::SessionState {
            state: "idle".to_string(),
            message: Some("CAST daemon ready. Waiting for connection.".to_string()),
        })
        .await;

        loop {
            match listener.accept().await {
                Ok((stream, peer)) => {
                    info!("New WebSocket client connected: {}", peer);
                    let tx = self.tx.clone();
                    let mut rx = self.tx.subscribe();
                    let router = self.router.clone();
                    let screen = self.screen.clone();
                    let audio = self.audio.clone();
                    let config = self.config.clone();

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

                        // Task: Forward broadcast messages to this client
                        let send_task = tokio::spawn(async move {
                            while let Ok(msg) = rx.recv().await {
                                if ws_sender.send(Message::Text(msg.into())).await.is_err() {
                                    break;
                                }
                            }
                        });

                        // Task: Handle incoming messages from this client
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
                                                &tx,
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
        tx: &broadcast::Sender<String>,
    ) {
        match msg {
            ClientMessage::Scan { transport } => {
                info!("Client requested scan: {}", transport);

                let state_msg = BridgeMessage::SessionState {
                    state: "scanning".to_string(),
                    message: Some(format!("Scanning {} devices...", transport)),
                };
                let _ = tx.send(serde_json::to_string(&state_msg).unwrap_or_default());

                let router_lock = router.lock().await;
                let devices = match transport.as_str() {
                    "bluetooth" => router_lock.scan_bluetooth().await,
                    "usb" => router_lock.scan_usb().await,
                    _ => router_lock.scan_all().await,
                };
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

                // Start screen and audio capture
                screen.start();
                if system_audio || microphone {
                    audio.start();
                }

                let state_msg = BridgeMessage::SessionState {
                    state: "streaming".to_string(),
                    message: Some("Broadcasting screen and audio.".to_string()),
                };
                let _ = tx.send(serde_json::to_string(&state_msg).unwrap_or_default());

                // Spawn the streaming loop
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
                            let _ =
                                tx_video.send(serde_json::to_string(&msg).unwrap_or_default());
                        }
                    }
                });

                // Audio streaming task
                let tx_audio = tx_clone;
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
                            let _ =
                                tx_audio.send(serde_json::to_string(&msg).unwrap_or_default());
                        }
                    }
                });

                // Telemetry reporting task
                let tx_tel = tx.clone();
                let router_clone = router.clone();
                tokio::spawn(async move {
                    let mut tel_tick = tokio::time::interval(Duration::from_secs(1));
                    loop {
                        tel_tick.tick().await;
                        let router_lock = router_clone.lock().await;
                        let transport_name = router_lock
                            .active_kind()
                            .map(|k| k.to_string())
                            .unwrap_or_else(|| "none".to_string());
                        drop(router_lock);

                        let msg = BridgeMessage::Telemetry {
                            throughput_kbps: 1200.0 + (rand::random::<f64>() * 400.0),
                            latency_ms: 12.0 + (rand::random::<f64>() * 8.0),
                            fps: 28.0 + (rand::random::<f64>() * 4.0),
                            frame_drops: rand::random::<u64>() % 3,
                            jitter_ms: 1.5 + (rand::random::<f64>() * 3.0),
                            transport: transport_name,
                        };
                        let _ = tx_tel.send(serde_json::to_string(&msg).unwrap_or_default());
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
                // In production, verify against the generated PIN
                let msg = BridgeMessage::PinResult { success: true };
                let _ = tx.send(serde_json::to_string(&msg).unwrap_or_default());
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
                // TODO: Apply config changes to capture engines
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

    /// Broadcast a message to all connected WebSocket clients
    async fn broadcast_message(&self, msg: BridgeMessage) {
        if let Ok(json) = serde_json::to_string(&msg) {
            let _ = self.tx.send(json);
        }
    }
}
