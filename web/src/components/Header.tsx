import { motion } from 'framer-motion'
import { Wifi, WifiOff, Bluetooth, Usb, Radio } from 'lucide-react'

interface HeaderProps {
  connected: boolean
  sessionState: string
  sessionMessage: string
  transport?: string
}

export function Header({ connected, sessionState, sessionMessage, transport }: HeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="flex items-center justify-between px-6 py-4 border-b border-obsidian-600/50"
    >
      {/* Logo & Title */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Radio className="w-7 h-7 text-cast-cyan" />
          {connected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-cast-emerald rounded-full"
            />
          )}
        </div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">CAST</h1>
          <p className="text-[11px] text-obsidian-300 font-mono tracking-wider uppercase">
            Offline Screen Streamer
          </p>
        </div>
      </div>

      {/* Connection Status */}
      <div className="flex items-center gap-4">
        {/* Transport Badge */}
        {transport && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`mono-badge flex items-center gap-1.5 ${
              transport === 'usb'
                ? 'bg-cast-amber/10 text-cast-amber border border-cast-amber/20'
                : 'bg-cast-cyan/10 text-cast-cyan border border-cast-cyan/20'
            }`}
          >
            {transport === 'usb' ? <Usb className="w-3 h-3" /> : <Bluetooth className="w-3 h-3" />}
            {transport.toUpperCase()}
          </motion.div>
        )}

        {/* Session State */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            sessionState === 'streaming' ? 'bg-cast-emerald animate-pulse-glow' :
            sessionState === 'scanning' ? 'bg-cast-cyan animate-pulse-glow' :
            sessionState === 'pairing' ? 'bg-cast-amber animate-pulse-glow' :
            connected ? 'bg-cast-emerald' : 'bg-obsidian-400'
          }`} />
          <span className="text-xs text-obsidian-200 font-medium">
            {sessionMessage || (connected ? 'Connected' : 'Offline')}
          </span>
        </div>

        {/* Connection Icon */}
        {connected ? (
          <Wifi className="w-4 h-4 text-cast-emerald" />
        ) : (
          <WifiOff className="w-4 h-4 text-obsidian-400" />
        )}
      </div>
    </motion.header>
  )
}
