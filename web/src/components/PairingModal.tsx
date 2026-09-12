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
  ExternalLink,
} from 'lucide-react'
import jsQR from 'jsqr'
import QRCode from 'qrcode'
import { detectLocalDevice } from '../utils/device'

export interface PairingModalProps {
  isOpen: boolean
  initialMode?: 'enter_pin' | 'scan_qr' | 'show_pin' | 'show_qr'
  pairingPin: string | null
  deviceName: string
  onClose: () => void
  onVerifyPin: (pin: string) => void
}

export type ModalMode = 'enter_pin' | 'scan_qr' | 'show_pin' | 'show_qr'

export function PairingModal({
  isOpen,
  initialMode = 'scan_qr',
  pairingPin,
  deviceName,
  onClose,
  onVerifyPin,
}: PairingModalProps) {
  const [mode, setMode] = useState<ModalMode>(initialMode)
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [copied, setCopied] = useState<boolean>(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState<boolean>(false)
  const [verifiedSuccess, setVerifiedSuccess] = useState<boolean>(false)
  const [realQrDataUrl, setRealQrDataUrl] = useState<string>('')

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const scanStreamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)

  const myDisplayPin = pairingPin || detectLocalDevice().pin

  // Update mode if initialMode prop changes
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode)
    }
  }, [initialMode])

  // Generate real mathematical QR code containing the pairing URL with PIN
  useEffect(() => {
    const host = typeof window !== 'undefined' ? window.location.hostname : '10.169.219.4'
    const port = typeof window !== 'undefined' ? (window.location.port || '5174') : '5174'
    const pairingUrl = `http://${host}:${port}/?pin=${myDisplayPin}`

    QRCode.toDataURL(pairingUrl, {
      width: 320,
      margin: 1,
      color: {
        dark: '#050709',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setRealQrDataUrl(url))
      .catch((err) => console.error('Failed to generate real QR code:', err))
  }, [myDisplayPin])

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

  // Camera QR Scanner Lifecycle (supports rear mobile camera)
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

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanError('Camera QR scanning requires HTTPS on mobile. Tap the "Enter PIN" tab above to pair instantly.')
      setIsScanning(false)
      return
    }

    setIsScanning(true)

    try {
      // Prioritize environment / back camera for easy scanning on phone
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      scanStreamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute('playsinline', 'true')
        await videoRef.current.play()
      }

      // Continuous loop scanning frames via jsQR
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
              // Successfully found QR code!
              // Check for pin in URL or raw digits
              let foundPin: string | null = null
              try {
                const url = new URL(code.data)
                foundPin = url.searchParams.get('pin')
              } catch {
                // Not a valid URL, search for 6 digits in string
              }

              if (!foundPin) {
                const pinMatch = code.data.match(/\b\d{6}\b/)
                if (pinMatch) foundPin = pinMatch[0]
              }

              if (foundPin && foundPin.length === 6) {
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
          : 'Could not access camera. Please allow camera permissions or enter the 6-digit PIN manually.'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
          />

          {/* Modal Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-md bg-[#0d1118] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden z-10 max-h-[92vh] flex flex-col justify-between"
          >
            {/* Ambient Top Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer z-20"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Device Authentication</h3>
                <p className="text-xs text-slate-400">Target: {deviceName || 'Peer Device'}</p>
              </div>
            </div>

            {/* 4 Mode Selectors with Clear Intent */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-900/90 border border-white/10 rounded-2xl p-1 mb-4">
              <button
                onClick={() => setMode('scan_qr')}
                className={`py-2 px-1 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'scan_qr'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                <span>Scan QR</span>
              </button>

              <button
                onClick={() => setMode('enter_pin')}
                className={`py-2 px-1 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'enter_pin'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Enter PIN</span>
              </button>

              <button
                onClick={() => setMode('show_qr')}
                className={`py-2 px-1 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'show_qr'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                <span>Show QR</span>
              </button>

              <button
                onClick={() => setMode('show_pin')}
                className={`py-2 px-1 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'show_pin'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                <span>Show PIN</span>
              </button>
            </div>

            {/* Mode 1: SCAN QR CODE WITH LIVE CAMERA */}
            {mode === 'scan_qr' && (
              <div className="flex flex-col items-center gap-3 py-1">
                <p className="text-xs text-slate-300 text-center">
                  Point camera at the QR code on your other device:
                </p>

                {/* Camera Viewport */}
                <div className="relative w-full h-64 bg-black rounded-2xl border border-indigo-500/30 overflow-hidden flex items-center justify-center shadow-2xl">
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Viewfinder Target Reticle */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="relative w-44 h-44 border-2 border-cyan-400/80 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                      {/* Scanning animated laser bar */}
                      <motion.div
                        animate={{ y: [-70, 70, -70] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute w-full h-0.5 bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,1)]"
                      />
                      <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    </div>
                  </div>

                  {isScanning && (
                    <div className="absolute bottom-2 px-3 py-1 rounded-full bg-black/80 backdrop-blur-md text-[10px] font-mono text-cyan-300 border border-cyan-500/30">
                      Camera Active • Scanning QR Matrix...
                    </div>
                  )}

                  {scanError && (
                    <div className="absolute inset-0 bg-black/90 p-4 flex flex-col items-center justify-center text-center gap-2">
                      <AlertCircle className="w-8 h-8 text-rose-400" />
                      <p className="text-xs text-rose-300">{scanError}</p>
                      <button
                        onClick={startScanner}
                        className="mt-2 px-4 py-2 rounded-xl bg-slate-800 text-white text-xs flex items-center gap-1.5 hover:bg-slate-700 transition-all cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry Camera</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="text-[11px] font-mono text-slate-400 text-center">
                  Instant auto-connect upon QR detection
                </div>
              </div>
            )}

            {/* Mode 2: ENTER PIN MANUALLY */}
            {mode === 'enter_pin' && (
              <div className="flex flex-col items-center gap-4 py-2">
                <p className="text-xs text-slate-300 text-center leading-relaxed">
                  Enter the 6-digit PIN shown on the other device:
                </p>

                {/* 6 Interactive Input Boxes */}
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 my-2 w-full">
                  {pinDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        inputRefs.current[idx] = el
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      onPaste={handlePaste}
                      className="w-11 h-14 sm:w-12 sm:h-16 rounded-2xl bg-black/70 border-2 border-indigo-500/40 text-center font-mono text-2xl font-bold text-white focus:outline-none focus:border-cyan-400 focus:bg-indigo-950/30 transition-all shadow-inner"
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
                  className={`w-full mt-2 py-3.5 rounded-2xl font-semibold text-xs font-mono tracking-wider transition-all cursor-pointer ${
                    pinDigits.join('').length === 6
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/40 active:scale-98'
                      : 'bg-slate-800/60 text-slate-500 border border-white/5 cursor-not-allowed'
                  }`}
                >
                  VERIFY & CONNECT
                </button>
              </div>
            )}

            {/* Mode 3: SHOW MY REAL MATHEMATICAL QR CODE */}
            {mode === 'show_qr' && (
              <div className="flex flex-col items-center gap-3 py-1">
                <p className="text-xs text-slate-300 text-center">
                  Scan this QR code using the "Scan QR" camera on your other device:
                </p>

                {/* Real Mathematically Generated QR Code */}
                <div className="p-3 bg-white rounded-3xl flex items-center justify-center shadow-2xl">
                  {realQrDataUrl ? (
                    <img
                      src={realQrDataUrl}
                      alt="Pairing QR Code"
                      className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-slate-800 text-xs font-mono">
                      Generating QR Code...
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
                  <span>Passcode:</span>
                  <span className="font-bold text-white tracking-widest text-sm">{myDisplayPin}</span>
                </div>
              </div>
            )}

            {/* Mode 4: SHOW MY PIN */}
            {mode === 'show_pin' && (
              <div className="flex flex-col items-center gap-4 py-2">
                <p className="text-xs text-slate-300 text-center leading-relaxed">
                  Enter this PIN on your other device to authenticate the connection:
                </p>

                {/* 6 Big Digits Display */}
                <div className="flex items-center justify-center gap-2 my-2">
                  {myDisplayPin.split('').map((char, idx) => (
                    <div
                      key={idx}
                      className="w-11 h-14 sm:w-12 sm:h-16 rounded-2xl bg-indigo-950/40 border-2 border-indigo-500/50 flex items-center justify-center font-mono text-2xl font-bold text-indigo-200 shadow-lg"
                    >
                      {char}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleCopyPin}
                  className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-white/5 active:scale-98"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'PIN Copied to Clipboard!' : 'Copy 6-Digit PIN'}</span>
                </button>
              </div>
            )}

            {/* Bottom Security Footer */}
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span className="flex items-center gap-1">
                <ExternalLink className="w-3 h-3 text-slate-500" />
                <span>Offline Transport</span>
              </span>
              <span className="text-emerald-400">Direct Link</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
