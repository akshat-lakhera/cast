import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Square,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronDown,
} from 'lucide-react'
import type { VideoFrame } from '../../types'

interface MobileStreamPlayerProps {
  currentFrame: VideoFrame | null
  mediaStream: MediaStream | null
  isActive: boolean
  targetDeviceName?: string
  transport?: string
  isMuted: boolean
  onToggleMute: () => void
  onStop: () => void
}

export function MobileStreamPlayer({
  currentFrame,
  mediaStream,
  isActive,
  targetDeviceName = 'PC Host',
  transport = 'USB Tethering',
  isMuted,
  onToggleMute,
  onStop,
}: MobileStreamPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [fps, setFps] = useState<number>(0)
  const [latency, setLatency] = useState<number>(0)
  const [resolution, setResolution] = useState<{ width: number; height: number }>({ width: 1920, height: 1080 })
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('cover') // default to cover for true full screen on mobile
  const [showControls, setShowControls] = useState<boolean>(true)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [isPortrait, setIsPortrait] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false
  )

  const frameCountRef = useRef<number>(0)
  const lastFpsUpdateRef = useRef<number>(performance.now())
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Orientation change detection
  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth)
    }
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)
    return () => {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
    }
  }, [])

  // Auto-hide controls after 3.5 seconds
  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setShowControls(true)
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false)
    }, 3500)
  }, [])

  useEffect(() => {
    resetHideTimer()
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [resetHideTimer])

  // Handle MediaStream source (if local phone is casting)
  useEffect(() => {
    if (mediaStream && videoRef.current) {
      videoRef.current.srcObject = mediaStream
      videoRef.current.play().catch(console.error)
    }
  }, [mediaStream])

  // Render loop for MediaStream
  useEffect(() => {
    if (!mediaStream) return
    let animId: number
    const renderLoop = () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video && canvas && video.readyState >= 2) {
        const ctx = canvas.getContext('2d', { alpha: false })
        if (ctx) {
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth || 1920
            canvas.height = video.videoHeight || 1080
            setResolution({ width: canvas.width, height: canvas.height })
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          frameCountRef.current += 1
        }
      }
      animId = requestAnimationFrame(renderLoop)
    }
    animId = requestAnimationFrame(renderLoop)
    return () => cancelAnimationFrame(animId)
  }, [mediaStream])

  // Render loop for binary/base64 video frames from Rust bridge
  useEffect(() => {
    if (!currentFrame || mediaStream) return

    const now = performance.now()
    if (currentFrame.timestamp_us) {
      const frameLatency = Math.max(1, Math.round(now - (Number(currentFrame.timestamp_us / 1000) % 100000)))
      setLatency(frameLatency)
    }

    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) return

      if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        setResolution({ width: img.naturalWidth, height: img.naturalHeight })
      }

      ctx.drawImage(img, 0, 0)
      frameCountRef.current += 1
    }

    if (currentFrame.data_base64) {
      if (currentFrame.data_base64.startsWith('data:')) {
        img.src = currentFrame.data_base64
      } else {
        img.src = `data:image/jpeg;base64,${currentFrame.data_base64}`
      }
    }
  }, [currentFrame, mediaStream])

  // Live FPS counter
  useEffect(() => {
    const interval = setInterval(() => {
      const now = performance.now()
      const elapsed = (now - lastFpsUpdateRef.current) / 1000
      if (elapsed > 0) {
        setFps(Math.round(frameCountRef.current / elapsed))
        frameCountRef.current = 0
        lastFpsUpdateRef.current = now
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Fullscreen API toggle
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen()
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen()
        }
        setIsFullscreen(true)
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen()
        }
        setIsFullscreen(false)
      }
    } catch (e) {
      console.warn('Fullscreen request failed:', e)
    }
  }, [])

  // Tap handler to toggle HUD
  const handleScreenTap = () => {
    if (showControls) {
      setShowControls(false)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    } else {
      resetHideTimer()
    }
  }

  // Double tap to toggle fit mode (contain vs cover)
  const lastTapRef = useRef<number>(0)
  const handleTouchEnd = () => {
    const now = performance.now()
    if (now - lastTapRef.current < 300) {
      // Double tap detected: toggle fitMode
      setFitMode(prev => (prev === 'cover' ? 'contain' : 'cover'))
      resetHideTimer()
    } else {
      handleScreenTap()
    }
    lastTapRef.current = now
  }

  return (
    <div
      ref={containerRef}
      onTouchEnd={handleTouchEnd}
      onClick={handleScreenTap}
      className="fixed inset-0 w-screen h-[100dvh] bg-black z-50 flex items-center justify-center select-none overflow-hidden touch-none"
    >
      {/* Hidden video element for local stream */}
      <video ref={videoRef} className="hidden" playsInline muted autoPlay />

      {/* Edge-to-Edge Canvas: Expands to 100% of physical viewport */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          className={`${
            fitMode === 'cover'
              ? 'w-full h-full object-cover'
              : 'max-w-full max-h-full object-contain'
          } ${isActive ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        />

        {/* Standby / Loading indicator */}
        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white">
            <div className="w-16 h-16 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mb-4" />
            <div className="text-base font-semibold">Connecting to Stream...</div>
            <div className="text-xs text-slate-400 mt-1">{transport} • Ultra-low latency</div>
          </div>
        )}
      </div>

      {/* Floating Top Status Bar (Auto-hiding) */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-3 inset-x-3 z-50 flex items-center justify-between pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {/* Live Stats Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/75 backdrop-blur-xl border border-white/15 text-xs font-mono shadow-2xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white font-semibold">{fps} FPS</span>
              <span className="text-slate-500">•</span>
              <span className="text-cyan-300">{resolution.width}×{resolution.height}</span>
              <span className="text-slate-500">•</span>
              <span className="text-indigo-300">~{latency > 0 ? latency : 12}ms</span>
            </div>

            {/* Target device pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/75 backdrop-blur-xl border border-white/15 text-xs font-mono text-slate-300 shadow-2xl">
              <span className="text-cyan-400">●</span>
              <span className="font-semibold text-white">{targetDeviceName}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Orientation Suggestion (Shown once if in portrait and viewing widescreen 16:9) */}
      {isPortrait && resolution.width > resolution.height && showControls && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-500/40 text-[11px] font-mono text-indigo-200 backdrop-blur-md shadow-xl flex items-center gap-2 pointer-events-none animate-pulse">
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Rotate phone horizontally for full theater display</span>
        </div>
      )}

      {/* Floating Bottom Master Controls Bar (Auto-hiding) */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-5 inset-x-4 z-50 flex items-center justify-between p-2 rounded-2xl bg-black/85 backdrop-blur-2xl border border-white/15 shadow-[0_10px_40px_rgba(0,0,0,0.8)] pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {/* Left: Fit Mode Toggle (Cover / Contain) */}
            <button
              onClick={() => {
                setFitMode(fitMode === 'cover' ? 'contain' : 'cover')
                resetHideTimer()
              }}
              className="px-3 py-2 rounded-xl bg-slate-800/90 text-white font-mono text-xs flex items-center gap-1.5 active:scale-95 transition-all border border-white/10"
              title="Toggle Cover vs Contain"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>{fitMode === 'cover' ? 'FILL SCREEN' : 'FIT RATIO'}</span>
            </button>

            {/* Middle: Audio & Fullscreen */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onToggleMute()
                  resetHideTimer()
                }}
                className={`p-2.5 rounded-xl border active:scale-95 transition-all ${
                  !isMuted
                    ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-800/90 border-white/10 text-slate-400'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {!isMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <button
                onClick={() => {
                  toggleFullscreen()
                  resetHideTimer()
                }}
                className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white border border-white/10 active:scale-95 transition-all"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4 text-cyan-400" />}
              </button>
            </div>

            {/* Right: Disconnect / Exit Cast */}
            <button
              onClick={onStop}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/40 active:scale-95 transition-all"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>EXIT</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
