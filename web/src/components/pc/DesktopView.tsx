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
  Layers,
  AppWindow,
  Globe,
  Cpu,
  Zap,
  AlertTriangle,
  X,
  Info,
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

export interface ErrorDiagnostic {
  title: string
  message: string
  cause?: string
  fix?: string
}

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
  onStartCast: (mode?: 'picker' | 'hardware') => void
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
  errorDiagnostic?: ErrorDiagnostic | null
  onDismissError?: () => void
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
  errorDiagnostic,
  onDismissError,
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

        {/* ─── INTERACTIVE ERROR & DIAGNOSTIC PANEL (Explains Root Cause & Fix) ─── */}
        {errorDiagnostic && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-5 rounded-3xl bg-rose-950/80 border-2 border-rose-500/60 shadow-2xl shadow-rose-950/70 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                    <span>{errorDiagnostic.title}</span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-200 text-[10px] font-mono">
                      Error Diagnostic
                    </span>
                  </h4>
                  <p className="text-xs text-rose-200 mt-0.5 leading-relaxed">
                    {errorDiagnostic.message}
                  </p>
                </div>
              </div>

              {onDismissError && (
                <button
                  onClick={onDismissError}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-rose-300 hover:text-white transition-all cursor-pointer"
                  title="Dismiss Error"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Technical Root Cause & Solution Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-rose-500/30 text-xs font-mono">
              {errorDiagnostic.cause && (
                <div className="p-3.5 rounded-2xl bg-black/50 border border-rose-500/20 flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-rose-400" />
                    Root Cause (Why this happened):
                  </span>
                  <span className="text-rose-100 text-[11px] leading-relaxed">
                    {errorDiagnostic.cause}
                  </span>
                </div>
              )}

              {errorDiagnostic.fix && (
                <div className="p-3.5 rounded-2xl bg-black/50 border border-emerald-500/30 flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    Recommended Fix:
                  </span>
                  <span className="text-emerald-100 text-[11px] leading-relaxed">
                    {errorDiagnostic.fix}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}

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

              {/* SECTION 3: BROADCAST SOURCE & DUAL LAUNCHER */}
              <div className="flex flex-col gap-4 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                    3. Broadcast Source & Screen Selection
                  </span>
                  <span className="text-[11px] text-cyan-400 font-mono">Window, Tab, or Display</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* OPTION A: BROWSER PICKER (ENTIRE SCREEN, APPLICATION WINDOW, OR BROWSER TAB) */}
                  <div className="relative p-5 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-[#0d1322] to-[#0a0d16] border border-indigo-500/40 hover:border-indigo-400/70 transition-all flex flex-col justify-between gap-4 shadow-xl">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-indigo-300">
                          <Layers className="w-5 h-5" />
                          <span className="text-sm font-bold text-white">Share Window, Tab or Screen</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-mono border border-indigo-500/30">
                          Recommended
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Opens the native browser picker: select an <strong>Entire Screen / Monitor</strong>, any <strong>Application Window</strong> (VS Code, Games, Discord, Player), or individual <strong>Browser Tab</strong> with audio.
                      </p>
                      {/* Surface Badges */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/50 border border-white/10 text-[10px] text-slate-300 font-mono">
                          <Monitor className="w-3 h-3 text-cyan-400" /> Entire Screen
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/50 border border-white/10 text-[10px] text-slate-300 font-mono">
                          <AppWindow className="w-3 h-3 text-indigo-400" /> Specific Window
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/50 border border-white/10 text-[10px] text-slate-300 font-mono">
                          <Globe className="w-3 h-3 text-emerald-400" /> Browser Tab
                        </span>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onStartCast('picker')}
                      className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 text-white font-bold text-xs sm:text-sm shadow-[0_0_25px_rgba(99,102,241,0.4)] hover:shadow-[0_0_35px_rgba(99,102,241,0.6)] flex items-center justify-center gap-2.5 transition-all cursor-pointer border border-indigo-300/30"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>CHOOSE WINDOW / TAB / SCREEN & CAST</span>
                    </motion.button>
                  </div>

                  {/* OPTION B: DIRECT HARDWARE GDI FULL SCREEN MIRROR */}
                  <div className="relative p-5 rounded-3xl bg-gradient-to-br from-[#0d1118] to-[#080b11] border border-white/10 hover:border-cyan-500/40 transition-all flex flex-col justify-between gap-4 shadow-xl">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-cyan-300">
                          <Cpu className="w-5 h-5" />
                          <span className="text-sm font-bold text-white">Direct Full Desktop (Hardware GDI)</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 text-[10px] font-mono border border-cyan-500/30">
                          Zero Overhead
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Instant hardware capture of your primary display monitor via native Win32 GDI kernel driver. Direct pixel blitting at zero latency without browser permission dialogs.
                      </p>
                      {/* Hardware Badges */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/50 border border-white/10 text-[10px] text-slate-400 font-mono">
                          <Zap className="w-3 h-3 text-amber-400" /> Win32 GDI Driver
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/50 border border-white/10 text-[10px] text-slate-400 font-mono">
                          <Monitor className="w-3 h-3 text-cyan-400" /> Primary Monitor
                        </span>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onStartCast('hardware')}
                      className="w-full py-4 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs sm:text-sm border border-white/15 flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-95"
                    >
                      <Monitor className="w-4 h-4 text-cyan-400" />
                      <span>MIRROR FULL DESKTOP (HARDWARE)</span>
                    </motion.button>
                  </div>
                </div>

                {/* Stream Settings */}
                <div className="flex flex-wrap items-center justify-center gap-3 text-xs pt-2">
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
