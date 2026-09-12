# CAST — Offline Setup Guide

> **How to stream screens and audio completely offline with Zero Internet & Zero Local Wi-Fi Router.**

This guide covers how to set up and verify offline casting between PC and Mobile devices using **USB** and **Bluetooth**.

---

## 🔌 Method 1: USB Direct Tethering (Recommended for 1080p60 & 4K)

USB is the fastest, lowest-latency transport for CAST. It creates a direct virtual Ethernet adapter (RNDIS / NCM) over a standard USB cable.

### 📱 Android to PC / PC to Android
1. **Connect your phone to your PC** using a standard USB-C or USB-A cable.
2. On your Android phone, go to:
   - **Settings** → **Network & Internet** (or **Connections**) → **Hotspot & Tethering**.
3. Toggle on **USB Tethering**.
   > *Note: You do NOT need cellular mobile data or internet enabled. The phone creates an offline point-to-point network (typically `192.168.42.x` or `192.168.43.x`).*
4. On your PC, open PowerShell and check that the network adapter is active:
   ```powershell
   Get-NetAdapter | Where-Object { $_.InterfaceDescription -match "Remote NDIS|Apple Mobile" }
   ```
5. In the CAST Web UI, switch to **Discovery & Radar** or use the **Connection Wizard**:
   - The device will appear instantly in the **USB Devices** panel with link speed (typically 480 Mbps for USB 2.0 or 5000+ Mbps for USB 3.0).
6. Click **Connect** and start streaming!

---

### 🍏 iOS (iPhone / iPad) to PC
1. Connect your iPhone / iPad via Lightning or USB-C cable to your PC.
2. In **Settings** → **Personal Hotspot**, toggle on **Allow Others to Join**.
3. When prompted on the device, choose **USB Only** and tap **Trust This Computer**.
4. The virtual adapter `Apple Mobile Device Ethernet` will configure an IP (typically `172.20.10.x`).
5. Open CAST and begin casting immediately.

---

## 📡 Method 2: Bluetooth RFCOMM (Wireless & Completely Offline)

Bluetooth operates on standard 2.4 GHz ISM bands point-to-point with zero requirement for Wi-Fi infrastructure.

### Pairing Steps
1. Make sure Bluetooth is turned on both on your PC and mobile device.
2. Pair the two devices once in Windows Settings:
   - **Settings** → **Bluetooth & devices** → **Add device** → **Bluetooth**.
   - Confirm the 6-digit passkey on both screens.
3. In CAST:
   - Open **Discovery & Radar**. The 360° radar sweep will automatically detect paired and nearby Bluetooth devices with RSSI proximity plotting.
   - Select your device.
   - CAST establishes an RFCOMM serial stream or L2CAP channel directly over the Bluetooth controller.
4. Optimal settings for Bluetooth:
   - **Resolution**: 480p or 720p.
   - **FPS**: 30 FPS.
   - **Compression**: Tile-delta + adaptive LZ4 (built into CAST).

---

## 🔒 Security & Air-Gapped Environments

- **Direct Memory Isolation**: CAST does not store or forward captured video outside your local machine.
- **Air-Gap Compatible**: You can disable Wi-Fi and unplug all ethernet cables from your PC. CAST functions identically offline.
- **PIN Handshake**: Every session generates a cryptographically random 6-digit PIN preventing unauthorized device connections on shared USB hubs or open Bluetooth ranges.

---

## 🛠️ Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **USB device not detected** | USB Tethering turned off on phone | Re-toggle "USB Tethering" in phone settings after plugging in cable |
| **Windows firewall prompt** | First time socket binding | Click "Allow access" for private networks |
| **Bluetooth stuttering** | RF interference or distance > 10m | Keep devices within 2–3 meters; use 480p30 resolution preset |
| **Black screen on capture** | GPU protected content (DRM) | Close DRM-protected browser tabs (Netflix, etc.) which block D3D11 duplication |
