import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Monitor,
  Smartphone,
  QrCode,
  KeyRound,
  Cable,
  Bluetooth,
  Play,
  Copy,
  Check,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Radio,
  Tv,
  ExternalLink,
} from 'lucide-react'
import { MobileStreamPlayer } from './MobileStreamPlayer'
import type { DiscoveredDevice, CastDirection, TransportMode, VideoFrame } from '../../types'
import type { ModalMode } from '../PairingModal'

interface MobileViewProps {
  bridgeConnected: boolean
  sessionState: string
  sessionMessage: string
  bridgePin: string | null
  localDevicePin: string
  localDeviceName: string
  localDeviceId: string
  activeDevices: DiscoveredDevice[]
  currentDevice: DiscoveredDevice | null
  transport: TransportMode
  setTransport: (transport: TransportMode) => void
  direction: CastDirection
  setDirection: (direction: CastDirection) => void
  onStartCast: () => void
  onStopCast: () => void
  onOpenPairing: (mode: ModalMode) => void
  onSwitchToPc: () => void
  onToast: (msg: string) => void
  isStreamActive: boolean
  lastFrame: VideoFrame | null
  localStream: MediaStream | null
  isMuted: boolean
  onToggleMute: () => void
}

export function MobileView({
  bridgeConnected,
  sessionState,
  sessionMessage,
  bridgePin,
  localDevicePin,
  localDeviceName,
  localDeviceId,
  activeDevices,
  currentDevice,
  transport,
  setTransport,
  direction,
  setDirection,
  onStartCast,
  onStopCast,
  onOpenPairing,
  onSwitchToPc,
  onToast,
  isStreamActive,
  lastFrame,
  localStream,
  isMuted,
  onToggleMute,
}: MobileViewProps) {
  const [copiedPin, setCopiedPin] = useState(false)
  const myPin = bridgePin || localDevicePin

  const handleCopyPin = () => {
    navigator.clipboard.writeText(myPin)
    setCopiedPin(true)
    onToast(`Copied PIN: ${myPin}`)
    setTimeout(() => setCopiedPin(false), 2000)
  }

  // ─── If Stream is Active: 100% Full-Screen Edge-to-Edge Canvas ───
  if (isStreamActive) {
    return (
      <MobileStreamPlayer
        currentFrame={lastFrame}
        mediaStream={localStream}
        isActive={isStreamActive}
        targetDeviceName={currentDevice?.name || 'PC Host'}
        transport={currentDevice?.transport === 'usb' ? 'USB Tethering (Offline 60FPS)' : 'Bluetooth RFCOMM'}
        isMuted={isMuted}
        onToggleMute={onToggleMute}
        onStop={onStopCast}
      />
    )
  }

  // ─── If Idle: Clean Mobile-First Control Deck ───────────────────
  return (
    <div className="min-h-[100dvh] w-full bg-[#050709] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30">
      {/* Mobile Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#070a0f]/90 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between">
        {/* Brand & Connection State */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Radio className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white tracking-tight">CAST</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-400">
                MOBILE
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
              <span className={`w-1.5 h-1.5 rounded-full ${bridgeConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
              <span>{bridgeConnected ? 'Daemon Online' : 'Connecting...'}</span>
            </div>
          </div>
        </div>

        {/* View Switcher to PC UI */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSwitchToPc}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 border border-white/10 active:scale-95"
          >
            <Monitor className="w-3.5 h-3.5 text-cyan-400" />
            <span>PC View</span>
          </button>
        </div>
      </header>

      {/* Main Mobile Content Area */}
      <main className="flex-1 px-4 py-5 flex flex-col gap-5 max-w-md mx-auto w-full">
        {/* Local Device Identity Badge */}
        <div className="bg-[#0d1118] border border-white/10 rounded-2xl p-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">{localDeviceName}</div>
              <div className="text-[10px] text-slate-400 font-mono">ID: {localDeviceId}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-500 font-mono uppercase">Your PIN</div>
            <div className="text-xs font-bold font-mono text-cyan-400 tracking-wider">{myPin}</div>
          </div>
        </div>

        {/* ─── CARD 1: WATCH PC SCREEN (PC -> Mobile) ───────────────── */}
        <div className="relative rounded-3xl bg-gradient-to-b from-[#0f172a] to-[#0b0f17] border border-cyan-500/30 p-5 shadow-2xl overflow-hidden flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-cyan-500/20 text-cyan-400">
                <Monitor className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-white">Receive PC Screen</h2>
                <p className="text-[11px] text-slate-400">Watch your computer desktop on this phone</p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40">
              60 FPS
            </span>
          </div>

          {/* Transport Picker */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <button
              onClick={() => setTransport('usb')}
              className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                transport === 'usb'
                  ? 'bg-amber-500/20 border-amber-500 text-white font-semibold shadow-lg shadow-amber-500/10'
                  : 'bg-black/40 border-white/5 text-slate-400'
              }`}
            >
              <Cable className="w-3.5 h-3.5 text-amber-400" />
              <span>USB Cable</span>
            </button>

            <button
              onClick={() => setTransport('bluetooth')}
              className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                transport === 'bluetooth'
                  ? 'bg-cyan-500/20 border-cyan-500 text-white font-semibold shadow-lg shadow-cyan-500/10'
                  : 'bg-black/40 border-white/5 text-slate-400'
              }`}
            >
              <Bluetooth className="w-3.5 h-3.5 text-cyan-400" />
              <span>Bluetooth</span>
            </button>
          </div>

          {/* Big Tap to Watch Button */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setDirection('pc_to_mobile')
              onStartCast()
            }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-indigo-700 text-white font-bold text-sm shadow-[0_0_25px_rgba(34,211,238,0.35)] flex items-center justify-center gap-2 cursor-pointer border border-cyan-300/30"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>START WATCHING PC NOW</span>
          </motion.button>

          {/* Quick Connect Pairing Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => onOpenPairing('scan_qr')}
              className="py-2.5 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <QrCode className="w-3.5 h-3.5 text-cyan-400" />
              <span>Scan PC QR</span>
            </button>

            <button
              onClick={() => onOpenPairing('enter_pin')}
              className="py-2.5 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
              <span>Enter PC PIN</span>
            </button>
          </div>
        </div>

        {/* ─── CARD 2: CAST THIS PHONE (Mobile -> PC) ────────────────── */}
        <div className="rounded-3xl bg-[#0d1118] border border-white/10 p-4.5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-400">
                <Smartphone className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-white">Broadcast Phone Screen</h3>
                <p className="text-[10px] text-slate-400">Stream entire phone display to PC</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setDirection('mobile_to_pc')
              onStartCast()
            }}
            className="w-full py-2.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Cast This Screen to PC</span>
          </button>
        </div>

        {/* ─── CARD 3: MY PHONE PAIRING CODES ───────────────────────── */}
        <div className="rounded-3xl bg-[#0d1118] border border-white/10 p-4.5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 font-mono">My Pairing Credentials</span>
            <span className="text-[10px] text-slate-500 font-mono">Unique per device</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/5">
            <div>
              <div className="text-[10px] text-slate-500 font-mono uppercase">Mobile PIN</div>
              <div className="text-xl font-bold font-mono text-cyan-300 tracking-widest">{myPin}</div>
            </div>
            <button
              onClick={handleCopyPin}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95 transition-all"
              title="Copy PIN"
            >
              {copiedPin ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <button
            onClick={() => onOpenPairing('show_qr')}
            className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-white/10 text-slate-200 text-xs font-medium flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <QrCode className="w-3.5 h-3.5 text-cyan-400" />
            <span>Show My Phone QR Code</span>
          </button>
        </div>

        {/* ─── CARD 4: OFFLINE DIRECT SETUP GUIDE ───────────────────── */}
        <div className="rounded-3xl bg-[#090d14] border border-white/5 p-4 flex flex-col gap-2.5 text-xs text-slate-400 font-mono">
          <div className="text-white font-semibold text-[11px] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>100% Offline Connection Guide</span>
          </div>
          <div className="flex items-start gap-2 text-[11px] leading-relaxed">
            <span className="text-amber-400 font-bold">1. USB:</span>
            <span>Plug USB into PC and enable <strong>USB Tethering</strong> in phone settings.</span>
          </div>
          <div className="flex items-start gap-2 text-[11px] leading-relaxed">
            <span className="text-cyan-400 font-bold">2. Bluetooth:</span>
            <span>Pair phone with PC in Bluetooth settings for wireless casting.</span>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText('http://10.169.219.4:5174')
              onToast('Copied offline URL to clipboard!')
            }}
            className="mt-1 py-1.5 px-3 rounded-lg bg-slate-800 text-cyan-300 text-[10px] text-center border border-white/5 hover:bg-slate-700 transition-all active:scale-98 cursor-pointer"
          >
            Copy Offline URL (http://10.169.219.4:5174)
          </button>
        </div>
      </main>
    </div>
  )
}
