# CAST — High-Performance Offline Screen & Audio Streaming

> **Zero Wi-Fi. Zero Routers. Zero Cloud. 100% Air-Gapped Peer-to-Peer Casting.**

CAST is an ultra-low latency screen and audio streaming system built in **Rust** and **React + TypeScript**. It allows you to cast screens and audio bi-directionally between **PC and Mobile**, **Mobile and PC**, or **PC and PC** over direct **USB (Tethering / RNDIS)** and **Bluetooth 5.x (RFCOMM / L2CAP)** without needing a local Wi-Fi router or an active internet connection.

---

## 🚀 Key Highlights & Capabilities

- **100% Offline by Design**: Works in rural areas, planes, basements, or secure air-gapped environments. No local Wi-Fi router or internet connectivity is ever required.
- **Bi-Directional Casting Direction**:
  - 🖥️ **PC to Mobile**: Monitor or present your PC workspace directly on a phone or tablet.
  - 📱 **Mobile to PC**: Cast your mobile gaming or app screen to your desktop or laptop.
  - 🖥️ **PC to PC**: Low-latency secondary display between two computers.
  - 📱 **Mobile to Mobile**: Direct peer-to-peer screen projection between handhelds.
- **Hardware-Direct Transports**:
  - **USB Direct (480 Mbps – 10 Gbps)**: Sub-15ms latency, full 1080p60 or 4K30 stream via USB tethering / RNDIS / NCM virtual ethernet adapter.
  - **Bluetooth RFCOMM / L2CAP (1–3 Mbps)**: Fully wireless without Wi-Fi, adaptive 480p/720p with tile-delta compression.
- **Tile-Delta Screen Compression**: Divides screens into 64×64 macroblocks, computing CRC32 checksums to transmit **only changed regions**, dramatically reducing bandwidth over constrained channels.
- **WASAPI Audio Loopback**: Low-latency 48 kHz stereo audio capture straight from the Windows audio endpoint with 20ms chunks.
- **CAST-Wire Binary Framing Protocol**: Zero-allocation 16-byte header with CRC32 integrity verification and MTU fragmentation/reassembly.
- **Modern Twilight Obsidian HUD**:
  - 360° animated Bluetooth radar with RSSI proximity plotting.
  - USB device detector with link-speed telemetry.
  - Interactive 4-step connection & role selector wizard.
  - Real-time telemetry dashboard (FPS, throughput, sub-frame RTT, packet loss).
  - Stereo audio spectrum visualizer.
  - 6-digit PIN and offline QR code authentication.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                   CAST Web Dashboard                   │
│         (React 19 + TypeScript + Framer Motion)        │
└───────────────────────────▲────────────────────────────┘
                            │ WebSocket JSON/Binary (127.0.0.1:8765)
┌───────────────────────────▼────────────────────────────┐
│                    CAST Core Daemon                    │
│                      (Rust Engine)                     │
├───────────────────────────┬────────────────────────────┤
│      Capture Engines      │    Transport & Protocol    │
│  • D3D11 Desktop Grabber  │  • CAST-Wire Framing (CRC) │
│  • Tile-Delta Compressor  │  • USB RNDIS Socket / TCP  │
│  • WASAPI Audio Loopback  │  • Bluetooth RFCOMM / BLE  │
│  • JPEG / LZ4 Pipeline    │  • Dynamic Transport Router│
└───────────────────────────┴────────────────────────────┘
                            │ Offline Link (USB / BT)
┌───────────────────────────▼────────────────────────────┐
│              Target Device (Mobile or PC)              │
│       • Direct Hardware Stream Decoder & Player        │
└────────────────────────────────────────────────────────┘
```

---

## 📦 Project Structure

```
cast/
├── Cargo.toml                    # Rust workspace definition
├── cast-core/                    # High-performance Rust backend
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs               # CLI entrypoint & daemon command
│       ├── config.rs             # Configuration & session presets
│       ├── protocol.rs           # CAST-Wire binary protocol & packet framing
│       ├── capture/
│       │   ├── mod.rs
│       │   ├── screen.rs         # Screen grabber with tile-delta compression
│       │   └── audio.rs          # WASAPI loopback stereo audio capture
│       ├── transport/
│       │   ├── mod.rs            # Transport trait & error handling
│       │   ├── bluetooth.rs      # Bluetooth scanner & RFCOMM server
│       │   ├── usb.rs            # USB tethering detector & socket
│       │   └── router.rs         # Dynamic transport selector
│       └── bridge/
│           ├── mod.rs
│           └── server.rs         # WebSocket bridge server (port 8765)
│
├── web/                          # Twilight Obsidian Web UI
│   ├── package.json
│   ├── vite.config.ts            # Vite + Tailwind v4 configuration
│   ├── index.html
│   └── src/
│       ├── main.tsx              # React entrypoint
│       ├── App.tsx               # Main application hub
│       ├── index.css             # Twilight obsidian design system tokens
│       ├── types/index.ts        # Protocol and device type definitions
│       ├── hooks/
│       │   ├── useCastBridge.ts  # WebSocket bridge communication
│       │   └── useLocalStream.ts # Browser getDisplayMedia capture fallback
│       └── components/
│           ├── Header.tsx        # System status bar & transport badges
│           ├── ConnectionWizard.tsx # 4-step direction & transport wizard
│           ├── BluetoothRadar.tsx   # 360° radar canvas with RSSI dots
│           ├── UsbDevicePanel.tsx   # Plugged-in USB device list & speed
│           ├── VideoPlayerCanvas.tsx# Low-latency canvas renderer + HUD
│           ├── AudioVisualizer.tsx  # Stereo audio spectrum visualizer
│           ├── TelemetryPanel.tsx   # Real-time metrics & latency sparkline
│           ├── ControlsBar.tsx      # Start/Stop/Quality floating controls
│           └── PairingModal.tsx     # 6-Digit PIN & offline QR verification
│
└── docs/
    └── OFFLINE_SETUP_GUIDE.md    # Detailed guide for USB & Bluetooth setup
```

---

## ⚡ Quick Start

### 1. Prerequisites

- **Rust toolchain** (1.80+): `rustup default stable`
- **Node.js** (v18+ or v20+): `npm -v`
- **Windows 10 / 11** (for Desktop Duplication & WASAPI audio)

### 2. Run the Rust Daemon

```powershell
cd E:\cast
cargo run -p cast-core -- daemon
```
*The daemon will start scanning for offline Bluetooth and USB interfaces and listen on `ws://127.0.0.1:8765`.*

### 3. Launch the Web Interface

```powershell
cd E:\cast\web
npm run dev
```
Open **`http://localhost:5174`** in your browser.

---

## 📱 Offline Connection Modes

| Mode | Bandwidth | Typical Latency | Supported Resolutions | Requirements |
| :--- | :--- | :--- | :--- | :--- |
| **USB Tethering** | 480 Mbps – 10 Gbps | **8 – 15 ms** | 1080p60 / 4K30 | Standard USB-C cable, USB Tethering enabled |
| **Bluetooth 5.x** | 1.0 – 2.5 Mbps | **35 – 65 ms** | 480p30 / 720p30 | Bluetooth turned on, devices paired |

For step-by-step instructions on enabling USB tethering and pairing without a router, see [docs/OFFLINE_SETUP_GUIDE.md](file:///E:/cast/docs/OFFLINE_SETUP_GUIDE.md).

---

## 🗺️ Roadmap

- [x] **Phase 1: Casting Engine**
  - [x] Hardware-accelerated screen capture & tile-delta diffing
  - [x] Low-latency WASAPI loopback audio capture
  - [x] CAST-Wire binary protocol with CRC32 verification
  - [x] Direct USB tethering & Bluetooth RFCOMM transports
  - [x] Twilight Obsidian HUD with radar, telemetry, and 4-step wizard
- [ ] **Phase 2: Remote Control (Coming Next)**
  - [ ] Virtual HID mouse injection (absolute & relative coordinates)
  - [ ] Virtual keyboard keystroke forwarder
  - [ ] Multi-touch gesture translation (pinch, zoom, scroll)
  - [ ] Bidirectional clipboard synchronization
