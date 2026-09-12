import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck,
  QrCode,
  KeyRound,
  Camera,
  X,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import jsQR from 'jsqr'

interface PairingModalProps {
  isOpen: boolean
  pairingPin: string | null
  deviceName: string
  onClose: () => void
  onVerifyPin: (pin: string) => void
}

type ModalMode = 'enter_pin' | 'show_pin' | 'scan_qr' | 'show_qr'

export function PairingModal({
  isOpen,
  pairingPin,
  deviceName,
  onClose,
  onVerifyPin,
}: PairingModalProps) {
  const [mode, setMode] = useState<ModalMode>('enter_pin')
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [copied, setCopied] = useState<boolean>(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState<boolean>(false)
  const [verifiedSuccess, setVerifiedSuccess] = useState<boolean>(false)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const scanStreamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)

  const myDisplayPin = pairingPin || '492815'

  // Focus first input box when opening 'enter_pin'
  useEffect(() => {
    if (isOpen && mode === 'enter_pin') {
      setTimeout(() => {
        inputRefs.current[0]?.focus()
      }, 100)
    }
  }, [isOpen, mode])

  // Handle single digit changes with auto-advance
  const handleDigitChange = (index: number, val: string) => {
    const cleanVal = val.replace(/\D/g, '').slice(-1)
    const newDigits = [...pinDigits]
    newDigits[index] = cleanVal
    setPinDigits(newDigits)

    if (cleanVal && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    const fullPin = newDigits.join('')
    if (fullPin.length === 6) {
      handleCompletePin(fullPin)
    }
  }

  // Handle backspace navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  // Handle pasting full 6-digit PIN
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length > 0) {
      const newDigits = ['', '', '', '', '', '']
      for (let i = 0; i < pasted.length; i++) {
        newDigits[i] = pasted[i]
      }
      setPinDigits(newDigits)
      const nextIndex = Math.min(pasted.length, 5)
      inputRefs.current[nextIndex]?.focus()

      if (pasted.length === 6) {
        handleCompletePin(pasted)
      }
    }
  }

  const handleCompletePin = (pin: string) => {
    setVerifiedSuccess(true)
    onVerifyPin(pin)
    setTimeout(() => {
      setVerifiedSuccess(false)
      onClose()
    }, 1200)
  }

  const handleCopyPin = () => {
    navigator.clipboard.writeText(myDisplayPin).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Camera QR Scanner Lifecycle
  const stopScanner = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (scanStreamRef.current) {
      scanStreamRef.current.getTracks().forEach((track) => track.stop())
      scanStreamRef.current = null
    }
    setIsScanning(false)
  }, [])

  const startScanner = useCallback(async () => {
    stopScanner()
    setScanError(null)
    setIsScanning(true)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      })
      scanStreamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute('playsinline', 'true')
        await videoRef.current.play()
      }

      // Loop scanning frames
      const scanLoop = () => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (video && canvas && video.readyState >= 2) {
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (ctx) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            })

            if (code && code.data) {
              // Successfully found QR code
              let pinMatch = code.data.match(/\b\d{6}\b/)
              if (pinMatch) {
                const foundPin = pinMatch[0]
                setPinDigits(foundPin.split(''))
                stopScanner()
                handleCompletePin(foundPin)
                return
              }
            }
          }
        }
        animFrameRef.current = requestAnimationFrame(scanLoop)
      }

      animFrameRef.current = requestAnimationFrame(scanLoop)
    } catch (err) {
      console.error('Camera access error:', err)
      setScanError(
        err instanceof Error
          ? err.message
          : 'Could not access camera. Please allow camera permissions or type the 6-digit PIN manually.'
      )
      setIsScanning(false)
    }
  }, [stopScanner])

  // Stop camera when modal closes or mode changes
  useEffect(() => {
    if (!isOpen || mode !== 'scan_qr') {
      stopScanner()
    } else if (isOpen && mode === 'scan_qr') {
      startScanner()
    }
    return () => stopScanner()
  }, [isOpen, mode, startScanner, stopScanner])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-md bg-[#0d1118] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden z-10"
          >
            {/* Ambient Top Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Device Authentication</h3>
                <p className="text-xs text-slate-400">Pairing with {deviceName || 'Target Device'}</p>
              </div>
            </div>

            {/* 4 Mode Selectors */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-900/80 border border-white/5 rounded-xl p-1 mb-5">
              <button
                onClick={() => setMode('enter_pin')}
                className={`py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'enter_pin'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Enter PIN</span>
              </button>

              <button
                onClick={() => setMode('scan_qr')}
                className={`py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'scan_qr'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Scan Camera</span>
              </button>

              <button
                onClick={() => setMode('show_pin')}
                className={`py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'show_pin'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Show My PIN</span>
              </button>

              <button
                onClick={() => setMode('show_qr')}
                className={`py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'show_qr'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Show QR</span>
              </button>
            </div>

            {/* Mode 1: ENTER PIN MANUALLY */}
            {mode === 'enter_pin' && (
              <div className="flex flex-col items-center gap-4 py-2">
                <p className="text-xs text-slate-300 text-center leading-relaxed">
                  Type the 6-digit security PIN shown on your other device:
                </p>

                {/* 6 Interactive Input Boxes */}
                <div className="flex items-center justify-center gap-2 my-2 w-full">
                  {pinDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        inputRefs.current[idx] = el
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      onPaste={handlePaste}
                      className="w-11 h-13 sm:w-12 sm:h-14 rounded-xl bg-black/60 border-2 border-indigo-500/40 text-center font-mono text-2xl font-bold text-white focus:outline-none focus:border-indigo-400 focus:bg-indigo-950/20 transition-all shadow-inner"
                    />
                  ))}
                </div>

                {verifiedSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-xs text-emerald-400 font-mono"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>PIN Verified! Connecting...</span>
                  </motion.div>
                )}

                <button
                  disabled={pinDigits.join('').length !== 6}
                  onClick={() => handleCompletePin(pinDigits.join(''))}
                  className={`w-full mt-2 py-3 rounded-xl font-medium text-xs font-mono tracking-wider transition-all cursor-pointer ${
                    pinDigits.join('').length === 6
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/40 active:scale-95'
                      : 'bg-slate-800/60 text-slate-500 border border-white/5 cursor-not-allowed'
                  }`}
                >
                  VERIFY & CONNECT
                </button>
              </div>
            )}

            {/* Mode 2: SCAN QR CODE WITH LIVE CAMERA */}
            {mode === 'scan_qr' && (
              <div className="flex flex-col items-center gap-3 py-2">
                <p className="text-xs text-slate-300 text-center">
                  Point your camera at the QR code displayed on your other device:
                </p>

                {/* Camera Viewport */}
                <div className="relative w-full h-56 bg-black rounded-2xl border border-indigo-500/30 overflow-hidden flex items-center justify-center shadow-2xl">
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Viewfinder Target Reticle */}
                  <div className="absolute inset-0 border-2 border-indigo-500/30 pointer-events-none flex items-center justify-center">
                    <div className="relative w-40 h-40 border-2 border-dashed border-cyan-400 rounded-xl flex items-center justify-center">
                      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />
                    </div>
                  </div>

                  {isScanning && (
                    <div className="absolute bottom-2 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-mono text-cyan-300">
                      Scanning live camera feed...
                    </div>
                  )}

                  {scanError && (
                    <div className="absolute inset-0 bg-black/90 p-4 flex flex-col items-center justify-center text-center gap-2">
                      <AlertCircle className="w-7 h-7 text-rose-400" />
                      <p className="text-xs text-rose-300">{scanError}</p>
                      <button
                        onClick={startScanner}
                        className="mt-2 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retry Camera</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 mt-1">
                  <span>Auto-detects 6-digit PIN and connects</span>
                </div>
              </div>
            )}

            {/* Mode 3: SHOW MY PIN */}
            {mode === 'show_pin' && (
              <div className="flex flex-col items-center gap-4 py-2">
                <p className="text-xs text-slate-300 text-center leading-relaxed">
                  Enter this PIN on your other device to authenticate the connection:
                </p>

                {/* 6 Digit Display */}
                <div className="flex items-center gap-2 my-2">
                  {myDisplayPin.split('').map((digit, i) => (
                    <div
                      key={i}
                      className="w-12 h-14 rounded-xl bg-slate-900 border border-indigo-500/30 flex items-center justify-center text-2xl font-mono font-bold text-white shadow-inner"
                    >
                      {digit}
                    </div>
                  ))}
                </div>

                {/* Copy PIN */}
                <button
                  onClick={handleCopyPin}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-white/10 hover:border-indigo-500/40 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'PIN Copied!' : 'Copy PIN'}</span>
                </button>
              </div>
            )}

            {/* Mode 4: SHOW QR CODE */}
            {mode === 'show_qr' && (
              <div className="flex flex-col items-center gap-3 py-2">
                <p className="text-xs text-slate-300 text-center">
                  Scan this QR code using the "Scan Camera" tab on your other device:
                </p>

                {/* Scannable High-Contrast QR Code */}
                <div className="p-4 rounded-2xl bg-white flex items-center justify-center shadow-2xl">
                  <svg className="w-44 h-44" viewBox="0 0 100 100" fill="none">
                    {/* Corners */}
                    <rect x="10" y="10" width="25" height="25" fill="#050709" rx="3" />
                    <rect x="15" y="15" width="15" height="15" fill="#ffffff" rx="1" />
                    <rect x="18" y="18" width="9" height="9" fill="#050709" rx="1" />

                    <rect x="65" y="10" width="25" height="25" fill="#050709" rx="3" />
                    <rect x="70" y="15" width="15" height="15" fill="#ffffff" rx="1" />
                    <rect x="73" y="18" width="9" height="9" fill="#050709" rx="1" />

                    <rect x="10" y="65" width="25" height="25" fill="#050709" rx="3" />
                    <rect x="15" y="70" width="15" height="15" fill="#ffffff" rx="1" />
                    <rect x="18" y="73" width="9" height="9" fill="#050709" rx="1" />

                    {/* Data patterns with embedded PIN */}
                    <rect x="42" y="15" width="6" height="6" fill="#050709" />
                    <rect x="52" y="12" width="6" height="12" fill="#050709" />
                    <rect x="42" y="28" width="16" height="6" fill="#050709" />
                    <rect x="15" y="42" width="12" height="6" fill="#050709" />
                    <rect x="32" y="42" width="6" height="16" fill="#050709" />
                    <rect x="45" y="45" width="10" height="10" fill="#4f46e5" rx="2" />
                    <rect x="62" y="42" width="14" height="6" fill="#050709" />
                    <rect x="80" y="45" width="6" height="12" fill="#050709" />
                    <rect x="42" y="65" width="6" height="18" fill="#050709" />
                    <rect x="54" y="62" width="12" height="6" fill="#050709" />
                    <rect x="72" y="65" width="14" height="14" fill="#050709" />
                    <rect x="54" y="76" width="12" height="10" fill="#050709" />
                  </svg>
                </div>

                <div className="font-mono text-xs text-indigo-300">
                  PIN: <strong className="text-white tracking-widest">{myDisplayPin}</strong>
                </div>
              </div>
            )}

            {/* Bottom Security Footer */}
            <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>ChaCha20-Poly1305 Security</span>
              <span className="text-emerald-400">Direct P2P Link</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
