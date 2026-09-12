import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Play,
  Square,
  Pause,
  Camera,
  Settings,
  Share2,
  Tv,
  PowerOff,
  SlidersHorizontal,
  ChevronUp,
} from 'lucide-react'

interface ControlsBarProps {
  isActive: boolean
  isPaused: boolean
  isLocalSharing: boolean
  selectedResolution: string
  selectedFps: number
  onStartCast: () => void
  onStopCast: () => void
  onTogglePause: () => void
  onStartLocalShare: () => void
  onStopLocalShare: () => void
  onChangeResolution: (res: string) => void
  onChangeFps: (fps: number) => void
  onTakeSnapshot: () => void
  onOpenSettings?: () => void
}

export function ControlsBar({
  isActive,
  isPaused,
  isLocalSharing,
  selectedResolution,
  selectedFps,
  onStartCast,
  onStopCast,
  onTogglePause,
  onStartLocalShare,
  onStopLocalShare,
  onChangeResolution,
  onChangeFps,
  onTakeSnapshot,
  onOpenSettings,
}: ControlsBarProps) {
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false)

  return (
    <div className="relative flex flex-col items-center">
      {/* Settings Drawer (Fold-up) */}
      {showSettingsDrawer && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="mb-3 p-4 bg-[#0d1118]/95 border border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl flex flex-wrap items-center gap-6 z-30"
        >
          {/* Resolution Options */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Resolution</label>
            <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
              {['1080p', '720p', '4K'].map((res) => (
                <button
                  key={res}
                  onClick={() => onChangeResolution(res)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                    selectedResolution === res
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>

          {/* Framerate Options */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Target Framerate</label>
            <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
              {[30, 60].map((fps) => (
                <button
                  key={fps}
                  onClick={() => onChangeFps(fps)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                    selectedFps === fps
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {fps} FPS
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Floating Glass Control Bar */}
      <div className="flex items-center gap-2 p-2 bg-[#0d1118]/90 border border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl">
        {/* Primary Start / Stop Cast Button */}
        {!isActive ? (
          <button
            onClick={onStartCast}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-medium text-xs shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>START CASTING</span>
          </button>
        ) : (
          <button
            onClick={onStopCast}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow-lg shadow-rose-600/30 transition-all active:scale-95"
          >
            <Square className="w-4 h-4 fill-white" />
            <span>STOP CAST</span>
          </button>
        )}

        {/* Pause / Resume Button */}
        {isActive && (
          <button
            onClick={onTogglePause}
            className={`p-2.5 rounded-xl border transition-all ${
              isPaused
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-400'
                : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
            }`}
            title={isPaused ? 'Resume Stream' : 'Pause Stream'}
          >
            <Pause className="w-4 h-4" />
          </button>
        )}

        {/* Browser Native Screen Share Fallback */}
        <button
          onClick={isLocalSharing ? onStopLocalShare : onStartLocalShare}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all text-xs ${
            isLocalSharing
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-400'
              : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
          }`}
          title="Share this browser screen via getDisplayMedia"
        >
          <Share2 className="w-4 h-4" />
          <span className="hidden sm:inline font-mono">
            {isLocalSharing ? 'Sharing Screen' : 'Share Screen'}
          </span>
        </button>

        {/* Snapshot Capture Button */}
        <button
          onClick={onTakeSnapshot}
          className="p-2.5 rounded-xl bg-slate-900 border border-white/10 text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
          title="Take Screenshot"
        >
          <Camera className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-6 bg-white/10 mx-1" />

        {/* Quick Settings Toggle */}
        <button
          onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
          className={`p-2.5 rounded-xl border transition-all ${
            showSettingsDrawer
              ? 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300'
              : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
          }`}
          title="Stream Quality Settings"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
