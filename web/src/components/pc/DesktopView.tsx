import { motion } from 'framer-motion'
import {
  Monitor,
  Smartphone,
  Cable,
  Bluetooth,
  Play,
  Square,
  Pause,
  Volume2,
  VolumeX,
  Trash2,
  ArrowRight,
  Activity,
} from 'lucide-react'
import { Header } from '../Header'
import { VideoPlayerCanvas } from '../VideoPlayerCanvas'
import { BluetoothRadar } from '../BluetoothRadar'
import { UsbDevicePanel } from '../UsbDevicePanel'
import { AudioVisualizer } from '../AudioVisualizer'
import { TelemetryPanel } from '../TelemetryPanel'
import { MasterPairingBar } from '../MasterPairingBar'
import type {
  DiscoveredDevice,
  CastDirection,
  TransportMode,
  VideoFrame,
  AudioChunk,
  TelemetryStats,
  SessionState,
} from '../../types'
import type { ModalMode } from '../PairingModal'

interface DesktopViewProps {
  bridgeConnected: boolean
  sessionState: SessionState
  sessionMessage: string
  bridgePin: string | null
  localDevicePin: string
  localDeviceId: string
  activeDevices: DiscoveredDevice[]
  currentDevice: DiscoveredDevice | null
  selectedDevice: DiscoveredDevice | null
  onSelectDevice: (device: DiscoveredDevice) => void
  transport: TransportMode
  setTransport: (transport: TransportMode) => void
  direction: CastDirection
  setDirection: (direction: CastDirection) => void
  selectedResolution: string
  setSelectedResolution: (res: string) => void
  selectedFps: number
  setSelectedFps: (fps: number) => void
  isMuted: boolean
  setIsMuted: (muted: boolean) => void
  isPaused: boolean
  setIsPaused: (paused: boolean) => void
  hardwareTab: 'both' | 'usb' | 'bluetooth'
  setHardwareTab: (tab: 'both' | 'usb' | 'bluetooth') => void
  onStartCast: () => void
  onStopCast: () => void
  onOpenPairing: (mode: ModalMode) => void
  onCleanCache: () => void
  isCleaning: boolean
  onSwitchToMobile: () => void
  onToast: (msg: string) => void
  isStreamActive: boolean
  lastFrame: VideoFrame | null
  lastAudioChunk: AudioChunk | null
  localStream: MediaStream | null
  telemetry: TelemetryStats | null
}

export function DesktopView({
  bridgeConnected,
  sessionState,
  sessionMessage,
  bridgePin,
  localDevicePin,
  localDeviceId,
  activeDevices,
  currentDevice,
  onSelectDevice,
  transport,
  setTransport,
  direction,
  setDirection,
  selectedResolution,
  setSelectedResolution,
  selectedFps,
  setSelectedFps,
  isMuted,
  setIsMuted,
  isPaused,
  setIsPaused,
  hardwareTab,
  setHardwareTab,
  onStartCast,
  onStopCast,
  onOpenPairing,
  onCleanCache,
  isCleaning,
  onSwitchToMobile,
  onToast,
  isStreamActive,
  lastFrame,
  lastAudioChunk,
  localStream,
  telemetry,
}: DesktopViewProps) {
  return (
    <div className="min-h-screen bg-[#050709] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Header */}
      <Header
        connected={bridgeConnected}
        sessionState={isStreamActive ? 'streaming' : sessionState}
        sessionMessage={sessionMessage}
        transport={currentDevice?.transport === 'usb' ? 'usb' : 'bluetooth'}
        onSwitchToMobile={onSwitchToMobile}
      />

      {/* Main Desktop Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-6">
        {/* ─── PROMINENT DEVICE CONNECTION STATUS BANNER (ShareMe Style) ─── */}
        <div
          className={`p-4 rounded-3xl border transition-all flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl ${
            currentDevice
              ? 'bg-emerald-950/60 border-emerald-500/40 shadow-emerald-950/40'
              : 'bg-[#0d1118] border-cyan-500/30'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <span className="relative flex h-3.5 w-3.5 shrink-0">
              {currentDevice ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500" />
                </>
              ) : (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500" />
                </>
              )}
            </span>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>{currentDevice ? 'DEVICE LINK ACTIVE:' : 'READY FOR OFFLINE PAIRING:'}</span>
                <span className={currentDevice ? 'text-emerald-300 font-mono text-sm' : 'text-cyan-300 font-mono'}>
                  {currentDevice ? currentDevice.name : 'Waiting for Phone / Peer...'}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                {currentDevice
                  ? `Transport: ${transport.toUpperCase()} Direct • Real Windows Desktop Stream • Zero-Lag 60 FPS`
                  : 'Plug in USB Cable (turn on USB Tethering) or pair Bluetooth (100% Offline)'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-cyan-300">
              PC PIN: <strong className="text-white tracking-wider">{bridgePin || localDevicePin}</strong>
            </span>
            <button
              onClick={() => onOpenPairing('show_qr')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-white/10 active:scale-95 transition-all cursor-pointer"
            >
              Show QR Code
            </button>
          </div>
        </div>

        {/* ─── STATE A: ACTIVE LIVE STREAM THEATER ARENA ─────────────── */}
        {isStreamActive ? (
          <div className="flex flex-col gap-5">
            {/* Primary Arena: Canvas + Telemetry & Audio Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left 8 Cols: Video Player Canvas */}
              <div className="lg:col-span-8 flex flex-col gap-3">
                <div className="w-full relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black">
                  <VideoPlayerCanvas
                    currentFrame={lastFrame}
                    mediaStream={localStream}
                    isActive={isStreamActive}
                    transport={currentDevice?.transport === 'usb' ? 'USB Tethering (Offline 60 FPS)' : 'Bluetooth RFCOMM (Offline)'}
                    targetDeviceName={currentDevice?.name || 'Remote Peer'}
                  />
                </div>

                {/* Master Dock Controls */}
                <div className="bg-[#0d1118]/90 border border-white/10 rounded-2xl p-3 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 shadow-xl">
                  {/* Left: Device & Quality Indicator */}
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-white font-semibold">{currentDevice?.name || 'Connected Peer'}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-cyan-400">{selectedResolution}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-indigo-300">{selectedFps} FPS</span>
                    {telemetry && (
                      <span className="hidden sm:inline text-slate-400">
                        ({telemetry.latency_ms}ms latency)
                      </span>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsPaused(!isPaused)}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-all cursor-pointer"
                      title={isPaused ? 'Resume' : 'Pause'}
                    >
                      {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-all cursor-pointer"
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={onStopCast}
                      className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all cursor-pointer active:scale-95"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>STOP CAST</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right 4 Cols: Audio Visualizer & Telemetry Panel */}
              <div className="lg:col-span-4 flex flex-col gap-4">
                <AudioVisualizer
                  currentChunk={lastAudioChunk}
                  mediaStream={localStream}
                  isActive={isStreamActive}
                  isMuted={isMuted}
                  onToggleMute={() => setIsMuted(!isMuted)}
                />

                <TelemetryPanel
                  stats={telemetry}
                  isActive={isStreamActive}
                  transport={currentDevice?.transport === 'usb' ? 'USB 3.0 Direct' : 'Bluetooth Direct'}
                />
              </div>
            </div>
          </div>
        ) : (
          /* ─── STATE B: MASTER CONTROL HOME PAGE (IDLE) ───────────────── */
          <div className="flex flex-col gap-6">
            {/* MASTER COMMAND DECK */}
            <div className="relative w-full bg-gradient-to-b from-[#0e131d] to-[#0a0d14] border border-white/10 rounded-3xl p-5 sm:p-7 shadow-2xl overflow-hidden flex flex-col gap-6">
              {/* Top ambient lighting */}
              <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

              {/* SECTION 1: CASTING DIRECTION */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                    1. Casting Direction
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">Choose source and destination</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* PC to Mobile */}
                  <button
                    onClick={() => setDirection('pc_to_mobile')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                      direction === 'pc_to_mobile'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                        : 'bg-black/30 border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <Monitor className="w-4 h-4 text-cyan-400" />
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <Smartphone className="w-4 h-4 text-indigo-400" />
                      <span>PC to Mobile</span>
                    </div>
                    <span className="text-[11px] text-slate-400">Desktop screen → Phone/Tablet</span>
                  </button>

                  {/* Mobile to PC */}
                  <button
                    onClick={() => setDirection('mobile_to_pc')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                      direction === 'mobile_to_pc'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                        : 'bg-black/30 border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <Smartphone className="w-4 h-4 text-indigo-400" />
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <Monitor className="w-4 h-4 text-cyan-400" />
                      <span>Mobile to PC</span>
                    </div>
                    <span className="text-[11px] text-slate-400">Phone screen → Desktop</span>
                  </button>

                  {/* PC to PC */}
                  <button
                    onClick={() => setDirection('pc_to_pc')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                      direction === 'pc_to_pc'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                        : 'bg-black/30 border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <Monitor className="w-4 h-4 text-cyan-400" />
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <Monitor className="w-4 h-4 text-emerald-400" />
                      <span>PC to PC</span>
                    </div>
                    <span className="text-[11px] text-slate-400">Primary PC → Secondary PC</span>
                  </button>
                </div>
              </div>

              {/* SECTION 2: PHYSICAL OFFLINE TRANSPORT SELECTOR */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                    2. Physical Offline Transport
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">100% Offline • Air-Gapped</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {/* USB */}
                  <button
                    onClick={() => {
                      setTransport('usb')
                      setHardwareTab('usb')
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      transport === 'usb'
                        ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                        : 'bg-black/30 border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Cable className="w-5 h-5 text-amber-400" />
                      <div>
                        <div className="text-xs font-semibold text-white">USB Cable (Direct)</div>
                        <div className="text-[10px] text-slate-400 font-mono">Zero Latency • 60 FPS • 1080p/4K</div>
                      </div>
                    </div>
                    {transport === 'usb' && <div className="w-2 h-2 rounded-full bg-amber-400" />}
                  </button>

                  {/* Bluetooth */}
                  <button
                    onClick={() => {
                      setTransport('bluetooth')
                      setHardwareTab('bluetooth')
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      transport === 'bluetooth'
                        ? 'bg-cyan-500/15 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                        : 'bg-black/30 border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Bluetooth className="w-5 h-5 text-cyan-400" />
                      <div>
                        <div className="text-xs font-semibold text-white">Bluetooth (Wireless)</div>
                        <div className="text-[10px] text-slate-400 font-mono">Offline Wireless • RFCOMM PAN</div>
                      </div>
                    </div>
                    {transport === 'bluetooth' && <div className="w-2 h-2 rounded-full bg-cyan-400" />}
                  </button>
                </div>
              </div>

              {/* SECTION 3: MASTER ACTION BUTTON & STREAM QUALITY */}
              <div className="flex flex-col items-center gap-4 pt-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onStartCast}
                  className="w-full sm:w-auto px-12 py-5 rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 text-white font-bold text-base shadow-[0_0_35px_rgba(99,102,241,0.45)] hover:shadow-[0_0_50px_rgba(99,102,241,0.65)] flex items-center justify-center gap-3 transition-all cursor-pointer border border-indigo-300/30"
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-white animate-ping" />
                  <span>START BROADCAST NOW</span>
                </motion.button>

                {/* Stream Settings */}
                <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
                  {/* Resolution */}
                  <div className="flex items-center gap-1 bg-black/40 border border-white/10 p-1 rounded-xl">
                    {['720p', '1080p', '4K'].map((res) => (
                      <button
                        key={res}
                        onClick={() => setSelectedResolution(res)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                          selectedResolution === res
                            ? 'bg-indigo-600 text-white font-semibold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>

                  {/* FPS */}
                  <div className="flex items-center gap-1 bg-black/40 border border-white/10 p-1 rounded-xl">
                    {[30, 60].map((fps) => (
                      <button
                        key={fps}
                        onClick={() => setSelectedFps(fps)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                          selectedFps === fps
                            ? 'bg-indigo-600 text-white font-semibold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {fps} FPS
                      </button>
                    ))}
                  </div>

                  {/* Audio */}
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                      !isMuted
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800 border-white/10 text-slate-400'
                    }`}
                  >
                    {!isMuted ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    <span>{!isMuted ? 'System Audio ON' : 'Muted'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* SECTION 4: HARDWARE CONNECTION ARENA (BLUETOOTH RADAR & USB PANEL) */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                    Active Hardware Discovery (Bluetooth & USB)
                  </span>
                </div>

                {/* Sub-view toggle */}
                <div className="flex items-center gap-1 bg-black/40 border border-white/10 p-1 rounded-xl text-[11px] font-mono">
                  <button
                    onClick={() => setHardwareTab('both')}
                    className={`px-2.5 py-0.5 rounded-lg transition-all ${hardwareTab === 'both' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                  >
                    Both
                  </button>
                  <button
                    onClick={() => setHardwareTab('bluetooth')}
                    className={`px-2.5 py-0.5 rounded-lg transition-all ${hardwareTab === 'bluetooth' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
                  >
                    Bluetooth Radar
                  </button>
                  <button
                    onClick={() => setHardwareTab('usb')}
                    className={`px-2.5 py-0.5 rounded-lg transition-all ${hardwareTab === 'usb' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}
                  >
                    USB Panel
                  </button>
                </div>
              </div>

              {/* Hardware Display Arena */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Bluetooth Radar */}
                {(hardwareTab === 'both' || hardwareTab === 'bluetooth') && (
                  <div className={hardwareTab === 'both' ? 'lg:col-span-7' : 'lg:col-span-12'}>
                    <BluetoothRadar
                      devices={activeDevices}
                      onSelectDevice={onSelectDevice}
                    />
                  </div>
                )}

                {/* USB Device Panel */}
                {(hardwareTab === 'both' || hardwareTab === 'usb') && (
                  <div className={hardwareTab === 'both' ? 'lg:col-span-5' : 'lg:col-span-12'}>
                    <UsbDevicePanel
                      devices={activeDevices}
                      onSelectDevice={onSelectDevice}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 5: MASTER PAIRING CENTER (Unique PIN & Real QR per device) */}
            <MasterPairingBar
              myPin={bridgePin || localDevicePin}
              onOpenModal={onOpenPairing}
              onToast={onToast}
            />

            {/* Storage Pruning Strip */}
            <div className="bg-[#0d1118]/80 border border-white/10 rounded-2xl p-3.5 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 text-slate-400">
                <span>Target: <strong className="text-white">{currentDevice?.name || 'Searching...'}</strong></span>
                <span>•</span>
                <span>Transport: <strong className="text-amber-400">{transport.toUpperCase()}</strong></span>
                <span>•</span>
                <span>Device ID: <strong className="text-indigo-300">{localDeviceId}</strong></span>
              </div>
              <button
                onClick={onCleanCache}
                disabled={isCleaning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/5 transition-all cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                <span>{isCleaning ? 'Cleaning...' : 'Clean Cache'}</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
