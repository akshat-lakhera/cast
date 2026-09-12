import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, QrCode, KeyRound, X, CheckCircle2, Copy, Check } from 'lucide-react'

interface PairingModalProps {
  isOpen: boolean
  pairingPin: string | null
  deviceName: string
  onClose: () => void
  onVerifyPin: (pin: string) => void
}

export function PairingModal({
  isOpen,
  pairingPin = '492815',
  deviceName,
  onClose,
  onVerifyPin,
}: PairingModalProps) {
  const [enteredPin, setEnteredPin] = useState<string>('')
  const [copied, setCopied] = useState<boolean>(false)
  const [tab, setTab] = useState<'pin' | 'qr'>('pin')

  const displayPin = pairingPin || '582910'

  const handleCopyPin = () => {
    navigator.clipboard.writeText(displayPin).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleDigitInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setEnteredPin(val)
    if (val.length === 6) {
      onVerifyPin(val)
    }
  }

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
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Device Authentication</h3>
                <p className="text-xs text-slate-400">Pairing with {deviceName || 'Target Device'}</p>
              </div>
            </div>

            {/* Tab switcher: PIN vs QR */}
            <div className="flex bg-slate-900/80 border border-white/5 rounded-xl p-1 mb-6">
              <button
                onClick={() => setTab('pin')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                  tab === 'pin'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>6-Digit PIN</span>
              </button>
              <button
                onClick={() => setTab('qr')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                  tab === 'qr'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Offline QR Code</span>
              </button>
            </div>

            {/* Tab Content */}
            {tab === 'pin' ? (
              <div className="flex flex-col items-center gap-5">
                <p className="text-xs text-slate-400 text-center leading-relaxed">
                  Enter this security PIN on your receiving device to establish an encrypted point-to-point tunnel.
                </p>

                {/* 6 Digit Display Boxes */}
                <div className="flex items-center gap-2 my-2">
                  {displayPin.split('').map((digit, i) => (
                    <div
                      key={i}
                      className="w-12 h-14 rounded-xl bg-slate-900/90 border border-indigo-500/30 flex items-center justify-center text-2xl font-mono font-bold text-white shadow-inner"
                    >
                      {digit}
                    </div>
                  ))}
                </div>

                {/* Copy PIN button */}
                <button
                  onClick={handleCopyPin}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-white/10 hover:border-indigo-500/40 text-xs text-slate-300 hover:text-white transition-all"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'PIN Copied!' : 'Copy PIN to Clipboard'}</span>
                </button>

                {/* Receiver PIN input field */}
                <div className="w-full pt-4 border-t border-white/5 flex flex-col gap-2">
                  <label className="text-[11px] font-mono text-slate-400">
                    OR ENTER PIN FROM OTHER DEVICE:
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={enteredPin}
                    onChange={handleDigitInput}
                    className="w-full py-2.5 px-4 rounded-xl bg-black/40 border border-white/10 text-center font-mono text-lg tracking-widest text-indigo-300 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  {enteredPin.length === 6 && (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verifying handshake...</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-2">
                <p className="text-xs text-slate-400 text-center">
                  Scan this QR code with your mobile camera or the CAST mobile app for instant zero-config pairing.
                </p>

                {/* SVG Offline QR Representation */}
                <div className="p-4 rounded-2xl bg-white flex items-center justify-center shadow-xl">
                  <svg className="w-48 h-48" viewBox="0 0 100 100" fill="none">
                    {/* Corner Markers */}
                    <rect x="10" y="10" width="25" height="25" fill="#050709" rx="3" />
                    <rect x="15" y="15" width="15" height="15" fill="#ffffff" rx="1" />
                    <rect x="18" y="18" width="9" height="9" fill="#050709" rx="1" />

                    <rect x="65" y="10" width="25" height="25" fill="#050709" rx="3" />
                    <rect x="70" y="15" width="15" height="15" fill="#ffffff" rx="1" />
                    <rect x="73" y="18" width="9" height="9" fill="#050709" rx="1" />

                    <rect x="10" y="65" width="25" height="25" fill="#050709" rx="3" />
                    <rect x="15" y="70" width="15" height="15" fill="#ffffff" rx="1" />
                    <rect x="18" y="73" width="9" height="9" fill="#050709" rx="1" />

                    {/* Data patterns */}
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

                <div className="font-mono text-[11px] text-slate-400">
                  SSID: CAST-DIRECT • PIN: {displayPin}
                </div>
              </div>
            )}

            {/* Bottom Security Assurance */}
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>ChaCha20-Poly1305</span>
              <span className="text-emerald-400">P2P Air-Gapped</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
