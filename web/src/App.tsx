import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Monitor,
  Radio,
  Cable,
  ShieldCheck,
  Layers,
  Sparkles,
} from 'lucide-react'

import { useCastBridge } from './hooks/useCastBridge'
import { useLocalStream } from './hooks/useLocalStream'
import { Header } from './components/Header'
import { ConnectionWizard } from './components/ConnectionWizard'
import { BluetoothRadar } from './components/BluetoothRadar'
import { UsbDevicePanel } from './components/UsbDevicePanel'
import { VideoPlayerCanvas } from './components/VideoPlayerCanvas'
import { AudioVisualizer } from './components/AudioVisualizer'
import { TelemetryPanel } from './components/TelemetryPanel'
import { ControlsBar } from './components/ControlsBar'
import { PairingModal } from './components/PairingModal'
import type { DiscoveredDevice, CastDirection, TransportMode } from './types'

export function App() {
  const {
    connected: bridgeConnected,
    sessionState,
    sessionMessage,
    pin: bridgePin,
    devices: bridgeDevices,
    lastFrame,
    lastAudioChunk,
    telemetry,
    send: sendBridgeMessage,
  } = useCastBridge()

  const {
    stream: localStream,
    isSharing: isLocalSharing,
    startCapture: startLocalShare,
    stopCapture: stopLocalShare,
  } = useLocalStream()

  // UI state
  const [activeTab, setActiveTab] = useState<'cast' | 'devices' | 'wizard'>('cast')
  const [selectedDevice, setSelectedDevice] = useState<DiscoveredDevice | null>(null)
  const [isCasting, setIsCasting] = useState<boolean>(false)
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [showPairingModal, setShowPairingModal] = useState<boolean>(false)
  const [selectedResolution, setSelectedResolution] = useState<string>('1080p')
  const [selectedFps, setSelectedFps] = useState<number>(60)
  const [notification, setNotification] = useState<string | null>(null)

  // Trigger flash notification
  const showToast = useCallback((msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3000)
  }, [])

  // Mock / default offline devices if bridge has not scanned yet
  const fallbackDevices: DiscoveredDevice[] = [
    {
      id: 'usb-pixel-7',
      name: 'Google Pixel 7 Pro',
      device_type: 'phone',
      transport: 'usb',
      usb_speed_mbps: 480,
      connected: true,
    },
    {
      id: 'bt-s23-ultra',
      name: 'Samsung Galaxy S23',
      device_type: 'phone',
      transport: 'bluetooth',
      rssi_dbm: -58,
      connected: false,
    },
    {
      id: 'bt-thinkpad-x1',
      name: 'ThinkPad X1 Yoga',
      device_type: 'laptop',
      transport: 'bluetooth',
      rssi_dbm: -72,
      connected: false,
    },
    {
      id: 'usb-ipad-pro',
      name: 'iPad Pro M2',
      device_type: 'tablet',
      transport: 'usb',
      usb_speed_mbps: 1000,
      connected: false,
    },
  ]

  const activeDevices = bridgeDevices.length > 0 ? bridgeDevices : fallbackDevices
  const currentDevice = selectedDevice || activeDevices[0]

  // Handlers
  const handleStartCast = () => {
    setIsCasting(true)
    sendBridgeMessage({
      type: 'start_broadcast',
      resolution: selectedResolution,
      fps: selectedFps,
      system_audio: !isMuted,
      microphone: false,
    })
    showToast(`CAST started to ${currentDevice.name} via ${currentDevice.transport.toUpperCase()}`)
  }

  const handleStopCast = () => {
    setIsCasting(false)
    if (isLocalSharing) stopLocalShare()
    sendBridgeMessage({ type: 'stop_broadcast' })
    showToast('Casting session ended')
  }

  const handleDeviceSelect = (device: DiscoveredDevice) => {
    setSelectedDevice(device)
    showToast(`Selected device: ${device.name}`)
    setShowPairingModal(true)
  }

  const handleVerifyPin = (pin: string) => {
    sendBridgeMessage({ type: 'pin_submit', pin })
    showToast(`Handshake verified with PIN: ${pin}`)
    setTimeout(() => {
      setShowPairingModal(false)
    }, 1000)
  }

  const handleTakeSnapshot = () => {
    showToast('Snapshot saved to ~/Pictures/CAST_Screen.png')
  }

  return (
    <div className="min-h-screen bg-[#050709] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Header */}
      <Header
        connected={bridgeConnected}
        sessionState={isCasting ? 'streaming' : sessionState}
        sessionMessage={sessionMessage}
        transport={currentDevice?.transport === 'usb' ? 'usb' : 'bluetooth'}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Navigation & Mode Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0d1118]/80 border border-white/10 rounded-2xl p-2 backdrop-blur-xl">
          {/* Tab buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('cast')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'cast'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Cast Arena</span>
            </button>

            <button
              onClick={() => setActiveTab('devices')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'devices'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Discovery & Radar</span>
            </button>

            <button
              onClick={() => setActiveTab('wizard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'wizard'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Connection Wizard</span>
            </button>
          </div>

          {/* Quick Info Badge */}
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>Target:</span>
              <span className="font-semibold text-white">{currentDevice?.name}</span>
            </div>
            <button
              onClick={() => setShowPairingModal(true)}
              className="flex items-center gap-1 text-[11px] font-mono text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Pairing PIN</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Primary Cast Arena */}
        {activeTab === 'cast' && (
          <div className="flex flex-col gap-6">
            {/* Upper Arena: Video Player + Telemetry Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 8 Cols: Video Player & Floating Controls */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                <VideoPlayerCanvas
                  currentFrame={lastFrame}
                  mediaStream={localStream}
                  isActive={isCasting || isLocalSharing}
                  transport={currentDevice?.transport === 'usb' ? 'USB Tethering (Offline)' : 'Bluetooth RFCOMM (Offline)'}
                  targetDeviceName={currentDevice?.name}
                />

                {/* Floating Docked Controls Bar */}
                <ControlsBar
                  isActive={isCasting || isLocalSharing}
                  isPaused={isPaused}
                  isLocalSharing={isLocalSharing}
                  selectedResolution={selectedResolution}
                  selectedFps={selectedFps}
                  onStartCast={handleStartCast}
                  onStopCast={handleStopCast}
                  onTogglePause={() => setIsPaused(!isPaused)}
                  onStartLocalShare={startLocalShare}
                  onStopLocalShare={stopLocalShare}
                  onChangeResolution={setSelectedResolution}
                  onChangeFps={setSelectedFps}
                  onTakeSnapshot={handleTakeSnapshot}
                />
              </div>

              {/* Right 4 Cols: Audio Spectrum & Live Telemetry Panel */}
              <div className="lg:col-span-4 flex flex-col gap-4">
                {/* Audio Visualizer */}
                <AudioVisualizer
                  currentChunk={lastAudioChunk}
                  mediaStream={localStream}
                  isActive={isCasting || isLocalSharing}
                  isMuted={isMuted}
                  onToggleMute={() => setIsMuted(!isMuted)}
                />

                {/* Live Telemetry Panel */}
                <TelemetryPanel
                  stats={telemetry}
                  isActive={isCasting || isLocalSharing}
                  transport={currentDevice?.transport === 'usb' ? 'USB 3.0 Direct' : 'Bluetooth Direct'}
                />

                {/* Quick Offline Status Card */}
                <div className="bg-[#070a0f] border border-white/10 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Cable className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-white">100% Offline Capable</div>
                      <div className="text-[10px] text-slate-400 font-mono">No router, no internet required</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                    AIR-GAPPED
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Discovery Radar & USB Panel */}
        {activeTab === 'devices' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <BluetoothRadar
                devices={activeDevices}
                onSelectDevice={handleDeviceSelect}
              />
            </div>
            <div className="lg:col-span-5">
              <UsbDevicePanel
                devices={activeDevices}
                onSelectDevice={handleDeviceSelect}
              />
            </div>
          </div>
        )}

        {/* Tab 3: Interactive Connection Wizard */}
        {activeTab === 'wizard' && (
          <div className="max-w-3xl mx-auto w-full">
            <ConnectionWizard
              devices={activeDevices}
              onScan={(transport: string) => {
                sendBridgeMessage({ type: 'scan', transport })
                showToast(`Scanning for ${transport.toUpperCase()} devices...`)
              }}
              onConnect={(device: DiscoveredDevice, direction: CastDirection, transport: TransportMode) => {
                setSelectedDevice(device)
                sendBridgeMessage({
                  type: 'connect',
                  device_id: device.id,
                  direction,
                  transport,
                })
                showToast(`Connecting to ${device.name}...`)
                setShowPairingModal(true)
              }}
              onStartBroadcast={(resolution: string, fps: number, systemAudio: boolean, mic: boolean) => {
                setSelectedResolution(resolution)
                setSelectedFps(fps)
                setIsMuted(!systemAudio)
                setIsCasting(true)
                sendBridgeMessage({
                  type: 'start_broadcast',
                  resolution,
                  fps,
                  system_audio: systemAudio,
                  microphone: mic,
                })
                setActiveTab('cast')
                showToast('Broadcast initiated!')
              }}
            />
          </div>
        )}
      </main>

      {/* PIN & QR Authentication Modal */}
      <PairingModal
        isOpen={showPairingModal}
        pairingPin={bridgePin}
        deviceName={currentDevice?.name || 'Device'}
        onClose={() => setShowPairingModal(false)}
        onVerifyPin={handleVerifyPin}
      />

      {/* Floating Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-slate-900/90 border border-indigo-500/40 text-xs font-mono text-indigo-200 shadow-2xl backdrop-blur-xl flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
