import { useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, KeyRound, QrCode, Copy, Check, ShieldCheck, ArrowRightLeft } from 'lucide-react'
import type { ModalMode } from './PairingModal'

interface MasterPairingBarProps {
  myPin: string
  onOpenModal: (mode: ModalMode) => void
  onToast: (msg: string) => void
}

export function MasterPairingBar({ myPin, onOpenModal, onToast }: MasterPairingBarProps) {
  const [copied, setCopied] = useState<boolean>(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(myPin).then(() => {
      setCopied(true)
      onToast(`PIN ${myPin} copied to clipboard!`)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="w-full bg-[#0d1118]/90 border border-white/10 rounded-3xl p-4 sm:p-5 backdrop-blur-xl shadow-2xl">
      {/* Title & Description */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">Bidirectional Pairing Center</h3>
            <p className="text-[11px] text-slate-400">Scan QR or enter PIN in either direction (PC ↔ Mobile)</p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 px-2.5 py-1 rounded-full">
          <ArrowRightLeft className="w-3 h-3" />
          <span>Both Ways Supported</span>
        </div>
      </div>

      {/* Two Clear Columns: 1. Connect to Other Device | 2. This Device Passcode */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {/* Section 1: Connect TO Another Device */}
        <div className="bg-black/40 border border-white/5 rounded-2xl p-3.5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">1. Connect to Other Device:</span>
            <span className="text-[10px] text-slate-500 font-mono">Incoming or Outgoing</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Scan QR Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onOpenModal('scan_qr')}
              className="py-3 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer transition-all border border-indigo-400/30"
            >
              <Camera className="w-4 h-4 text-cyan-300" />
              <span className="font-semibold">Scan QR Code</span>
            </motion.button>

            {/* Enter PIN Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onOpenModal('enter_pin')}
              className="py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center justify-center gap-2 border border-white/10 cursor-pointer transition-all"
            >
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span className="font-semibold">Enter 6-Digit PIN</span>
            </motion.button>
          </div>
        </div>

        {/* Section 2: This Device's Identity */}
        <div className="bg-black/40 border border-white/5 rounded-2xl p-3.5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">2. This Device Passcode:</span>
            <span className="text-[10px] text-slate-500 font-mono">For other device to scan</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Show QR Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onOpenModal('show_qr')}
              className="py-3 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-medium text-xs flex items-center justify-center gap-2 border border-white/10 cursor-pointer transition-all"
            >
              <QrCode className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold">Show My QR</span>
            </motion.button>

            {/* My PIN with Instant Copy */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCopy}
              className="py-3 px-3 rounded-xl bg-indigo-950/40 hover:bg-indigo-900/40 text-indigo-200 font-mono font-bold text-xs flex items-center justify-center gap-2 border border-indigo-500/40 cursor-pointer transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-400" />}
              <span>PIN: {myPin}</span>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}
