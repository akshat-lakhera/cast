import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  Radio,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertCircle,
  Camera,
  RefreshCw,
  Activity,
  Layers,
} from 'lucide-react'
import jsQR from 'jsqr'
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
  // ShareMe Paradigm: SEND or RECEIVE mode
  const [shareMode, setShareMode] = useState<'receive' | 'send'>('receive')
  const [copiedPin, setCopiedPin] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  const myPin = bridgePin || localDevicePin
  const isPeerConnected = currentDevice !== null || sessionState === 'streaming' || sessionState === 'pairing'

  const handleCopyPin = () => {
    navigator.clipboard.writeText(myPin)
    setCopiedPin(true)
    onToast(`Copied PIN: ${myPin}`)
    setTimeout(() => setCopiedPin(false), 2000)
  }

  // Handle snapping photo of sender QR code via native camera
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    onToast('Analyzing QR photo...')
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const offCanvas = document.createElement('canvas')
        offCanvas.width = img.naturalWidth
        offCanvas.height = img.naturalHeight
        const ctx = offCanvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return
        ctx.drawImage(img, 0, 0)
        const imgData = ctx.getImageData(0, 0, offCanvas.width, offCanvas.height)
        const code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'dontInvert',
        })

        if (code && code.data) {
          let foundPin: string | null = null
          try {
            const url = new URL(code.data)
            foundPin = url.searchParams.get('pin')
          } catch {}

          if (!foundPin) {
            const pinMatch = code.data.match(/\b\d{6}\b/)
            if (pinMatch) foundPin = pinMatch[0]
          }

          if (foundPin && foundPin.length === 6) {
            onToast(`QR Detected! Pairing PIN: ${foundPin}`)
            setDirection('pc_to_mobile')
            onOpenPairing('enter_pin')
            return
          }
        }
        onToast('Could not find QR code in photo. Please try snapping closer or type PIN.')
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleManualPinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pinInput.length === 6) {
      onOpenPairing('enter_pin')
    } else {
      onToast('Please enter a 6-digit PIN')
    }
  }

  // ─── If Stream is Active: 100% Full-Screen Edge-to-Edge Canvas ───
  if (isStreamActive) {
    return (
      <MobileStreamPlayer
        currentFrame={lastFrame}
        mediaStream={localStream}
        isActive={isStreamActive}
        targetDeviceName={currentDevice?.name || 'PC Desktop'}
        transport={currentDevice?.transport === 'usb' ? 'USB Tethering (Offline 60FPS)' : 'Bluetooth RFCOMM'}
        isMuted={isMuted}
        onToggleMute={onToggleMute}
        onStop={onStopCast}
      />
    )
  }

  // ─── If Idle: ShareMe Send / Receive Home Deck ───────────────────
  return (
    <div className="min-h-[100dvh] w-full bg-[#050709] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 pb-6">
      {/* Hidden file input for native camera snapshot QR scanning */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoCapture}
      />

      {/* Top Mobile Bar */}
      <header className="sticky top-0 z-40 bg-[#070a0f]/95 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Radio className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-white tracking-tight">CAST</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-400 font-bold">
                P2P
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
              <span className={`w-1.5 h-1.5 rounded-full ${bridgeConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
              <span>{bridgeConnected ? 'Daemon Online' : 'Connecting...'}</span>
            </div>
          </div>
        </div>

        {/* View Switcher to PC UI */}
        <button
          onClick={onSwitchToPc}
          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 border border-white/10 active:scale-95"
        >
          <Monitor className="w-3.5 h-3.5 text-cyan-400" />
          <span>PC View</span>
        </button>
      </header>

      {/* Main ShareMe Interface */}
      <main className="flex-1 px-4 py-4 flex flex-col gap-4 max-w-md mx-auto w-full">
        {/* ─── PROMINENT CONNECTION STATUS BANNER (Unmistakable Feedback) ─── */}
        <div
          className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between shadow-xl ${
            isPeerConnected
              ? 'bg-emerald-950/70 border-emerald-500/50 shadow-emerald-950/40'
              : 'bg-[#0d1118] border-cyan-500/30'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5 shrink-0">
              {isPeerConnected ? (
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
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>{isPeerConnected ? 'DEVICE LINKED:' : 'READY TO CONNECT'}</span>
                <span className={isPeerConnected ? 'text-emerald-300' : 'text-cyan-300'}>
                  {currentDevice?.name || 'Searching Nearby...'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {isPeerConnected
                  ? `Active ${transport.toUpperCase()} Direct Link • 0ms Latency 60 FPS`
                  : 'Plug USB Cable or Pair Bluetooth (100% Offline)'}
              </div>
            </div>
          </div>

          <span
            className={`text-[10px] font-mono px-2 py-1 rounded-lg border uppercase font-semibold ${
              isPeerConnected
                ? 'bg-emerald-900/80 border-emerald-400/40 text-emerald-200'
                : 'bg-cyan-950 border-cyan-500/30 text-cyan-300'
            }`}
          >
            {transport}
          </span>
        </div>

        {/* ─── SHAREME MASTER 2-OPTION SELECTOR: SEND OR RECEIVE ─── */}
        <div className="grid grid-cols-2 gap-2.5 p-1 bg-slate-900/90 border border-white/10 rounded-2xl shadow-inner">
          {/* RECEIVE BUTTON */}
          <button
            onClick={() => {
              setShareMode('receive')
              setDirection('pc_to_mobile')
            }}
            className={`py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
              shareMode === 'receive'
                ? 'bg-gradient-to-b from-indigo-600 to-indigo-700 text-white font-bold shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-5 h-5 text-cyan-300" />
            <span className="text-xs font-black tracking-wide uppercase">RECEIVE</span>
            <span className="text-[10px] opacity-75">Watch PC Screen</span>
          </button>

          {/* SEND BUTTON */}
          <button
            onClick={() => {
              setShareMode('send')
              setDirection('mobile_to_pc')
            }}
            className={`py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
              shareMode === 'send'
                ? 'bg-gradient-to-b from-cyan-600 to-cyan-700 text-white font-bold shadow-lg shadow-cyan-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-5 h-5 text-amber-300" />
            <span className="text-xs font-black tracking-wide uppercase">SEND</span>
            <span className="text-[10px] opacity-75">Cast This Phone</span>
          </button>
        </div>

        {/* ─── VIEW A: RECEIVE SCREEN (Watch PC Desktop on Phone) ─── */}
        {shareMode === 'receive' && (
          <div className="flex flex-col gap-4">
            {/* Primary Action Card */}
            <div className="relative rounded-3xl bg-gradient-to-b from-[#0e1626] to-[#0a0f19] border border-cyan-500/30 p-5 shadow-2xl overflow-hidden flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white">Receive PC Desktop</h3>
                  <p className="text-[11px] text-slate-400">Stream real computer monitor in full screen</p>
                </div>
                <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Monitor className="w-5 h-5" />
                </div>
              </div>

              {/* Transport Switch */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <button
                  onClick={() => setTransport('usb')}
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
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
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                    transport === 'bluetooth'
                      ? 'bg-cyan-500/20 border-cyan-500 text-white font-semibold shadow-lg shadow-cyan-500/10'
                      : 'bg-black/40 border-white/5 text-slate-400'
                  }`}
                >
                  <Bluetooth className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Bluetooth</span>
                </button>
              </div>

              {/* Master Receive Button */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setDirection('pc_to_mobile')
                  onStartCast()
                }}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 text-white font-black text-sm shadow-[0_0_30px_rgba(99,102,241,0.4)] flex items-center justify-center gap-2 cursor-pointer border border-indigo-300/30"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>START WATCHING PC NOW</span>
              </motion.button>

              {/* Fast Pairing Methods: 1. Snap QR Photo | 2. Enter PIN */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {/* 1. Snap QR Photo using native camera */}
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="py-3 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Camera className="w-4 h-4 text-cyan-400" />
                  <span>📸 Snap PC QR</span>
                </button>

                {/* 2. Enter PIN */}
                <button
                  onClick={() => onOpenPairing('enter_pin')}
                  className="py-3 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <KeyRound className="w-4 h-4 text-indigo-400" />
                  <span>🔢 Enter PIN</span>
                </button>
              </div>
            </div>

            {/* Quick Discovered Devices Card */}
            {activeDevices.length > 0 && (
              <div className="rounded-3xl bg-[#0d1118] border border-white/10 p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Nearby Discovered Devices ({activeDevices.length})</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Tap to Link</span>
                </div>
                <div className="flex flex-col gap-2">
                  {activeDevices.map((dev) => (
                    <button
                      key={dev.id}
                      onClick={() => {
                        setDirection('pc_to_mobile')
                        onOpenPairing('enter_pin')
                      }}
                      className="p-3 rounded-2xl bg-black/40 border border-white/5 hover:border-cyan-500/40 flex items-center justify-between transition-all active:scale-98 text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <Monitor className="w-4 h-4 text-cyan-400" />
                        <div>
                          <div className="text-xs font-semibold text-white">{dev.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {dev.transport.toUpperCase()} • Direct Link Ready
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-bold">
                        CONNECT
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── VIEW B: SEND SCREEN (Cast Phone to PC) ─── */}
        {shareMode === 'send' && (
          <div className="flex flex-col gap-4">
            {/* Primary Action Card */}
            <div className="rounded-3xl bg-gradient-to-b from-[#131d2b] to-[#0c131c] border border-cyan-500/30 p-5 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white">Cast Phone Screen</h3>
                  <p className="text-[11px] text-slate-400">Broadcast your phone display to PC</p>
                </div>
                <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Smartphone className="w-5 h-5" />
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setDirection('mobile_to_pc')
                  onStartCast()
                }}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-black text-sm shadow-[0_0_30px_rgba(34,211,238,0.4)] flex items-center justify-center gap-2 cursor-pointer border border-cyan-300/30"
              >
                <Smartphone className="w-4 h-4" />
                <span>BROADCAST MY SCREEN TO PC</span>
              </motion.button>
            </div>

            {/* My Pairing Credentials Card (for PC to scan) */}
            <div className="rounded-3xl bg-[#0d1118] border border-white/10 p-4.5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 font-mono">My Phone Credentials</span>
                <span className="text-[10px] text-slate-500 font-mono">Unique to this phone</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/5">
                <div>
                  <div className="text-[10px] text-slate-500 font-mono uppercase">Phone PIN</div>
                  <div className="text-xl font-bold font-mono text-cyan-300 tracking-widest">{myPin}</div>
                </div>
                <button
                  onClick={handleCopyPin}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95 transition-all cursor-pointer"
                  title="Copy PIN"
                >
                  {copiedPin ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <button
                onClick={() => onOpenPairing('show_qr')}
                className="w-full py-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-white/10 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-cyan-400" />
                <span>Show Phone QR Code (For PC to Scan)</span>
              </button>
            </div>
          </div>
        )}

        {/* ─── OFFLINE CONNECTION GUIDE ─── */}
        <div className="rounded-3xl bg-[#080c13] border border-white/5 p-4 flex flex-col gap-2 text-xs text-slate-400 font-mono">
          <div className="text-white font-semibold text-[11px] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>100% Offline Direct Tethering Guide</span>
          </div>
          <div className="flex items-start gap-2 text-[11px] leading-relaxed">
            <span className="text-amber-400 font-bold">1. USB Cable:</span>
            <span>Plug USB into PC and turn on <strong>USB Tethering</strong> in phone settings.</span>
          </div>
          <div className="flex items-start gap-2 text-[11px] leading-relaxed">
            <span className="text-cyan-400 font-bold">2. Bluetooth:</span>
            <span>Pair phone with PC in Bluetooth settings for wireless casting.</span>
          </div>
        </div>
      </main>
    </div>
  )
}
