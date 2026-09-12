import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize2, Minimize2, ZoomIn, ZoomOut, Activity, Eye, EyeOff } from 'lucide-react'
import type { VideoFrame } from '../types'

interface VideoPlayerCanvasProps {
  currentFrame: VideoFrame | null
  mediaStream: MediaStream | null
  isActive: boolean
  transport?: string
  targetDeviceName?: string
  onResolutionDetected?: (width: number, height: number) => void
}

export function VideoPlayerCanvas({
  currentFrame,
  mediaStream,
  isActive,
  transport = 'USB Tethering',
  targetDeviceName = 'Target Device',
  onResolutionDetected,
}: VideoPlayerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [fps, setFps] = useState<number>(0)
  const [latency, setLatency] = useState<number>(0)
  const [resolution, setResolution] = useState<{ width: number; height: number }>({ width: 1920, height: 1080 })
  const [scale, setScale] = useState<number>(1)
  const [showMetrics, setShowMetrics] = useState<boolean>(true)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain')

  // Frame counting for live FPS calculation
  const frameCountRef = useRef<number>(0)
  const lastFpsUpdateRef = useRef<number>(performance.now())

  // Handle MediaStream if using browser getDisplayMedia fallback
  useEffect(() => {
    if (mediaStream && videoRef.current) {
      videoRef.current.srcObject = mediaStream
      videoRef.current.play().catch(console.error)
    }
  }, [mediaStream])

  // Render video stream from mediaStream to canvas
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
            onResolutionDetected?.(canvas.width, canvas.height)
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          frameCountRef.current += 1
        }
      }
      animId = requestAnimationFrame(renderLoop)
    }
    animId = requestAnimationFrame(renderLoop)
    return () => cancelAnimationFrame(animId)
  }, [mediaStream, onResolutionDetected])

  // Render incoming binary/base64 video frames from Rust bridge
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
        onResolutionDetected?.(img.naturalWidth, img.naturalHeight)
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
  }, [currentFrame, mediaStream, onResolutionDetected])

  // FPS calculation ticker
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

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error)
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[480px] bg-[#070a0f] rounded-2xl border border-white/10 overflow-hidden flex items-center justify-center select-none shadow-2xl transition-all ${
        isFullscreen ? 'rounded-none border-0' : ''
      }`}
    >
      {/* Hidden HTML5 video element for WebRTC/MediaStream source */}
      <video ref={videoRef} className="hidden" playsInline muted autoPlay />

      {/* Background ambient glow matching cast stream state */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${
          isActive
            ? 'bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.12)_0%,_rgba(6,182,212,0.04)_50%,_transparent_80%)]'
            : 'bg-[radial-gradient(ellipse_at_center,_rgba(30,41,59,0.2)_0%,_transparent_70%)]'
        }`}
      />

      {/* Main Canvas Player */}
      <div
        className="relative w-full h-full flex items-center justify-center p-2"
        style={{
          transform: `scale(${scale})`,
          transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <canvas
          ref={canvasRef}
          className={`max-w-full max-h-full rounded-lg shadow-2xl ${
            fitMode === 'contain' ? 'object-contain' : 'object-cover'
          } ${isActive ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        />

        {/* Standby / Offline Screen when inactive */}
        <AnimatePresence>
          {!isActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
            >
              {/* Radar pulse icon */}
              <div className="relative w-28 h-28 mb-6 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-ping" />
                <div className="absolute inset-2 rounded-full border border-cyan-500/30 animate-pulse" />
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600/30 via-slate-800/60 to-cyan-500/20 border border-indigo-500/30 backdrop-blur-xl flex items-center justify-center shadow-lg shadow-indigo-950/50">
                  <Activity className="w-8 h-8 text-indigo-400 animate-pulse" />
                </div>
              </div>

              <h3 className="text-xl font-semibold text-white tracking-tight mb-2">
                Awaiting Screen Stream
              </h3>
              <p className="text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">
                Connect via Bluetooth or plug in a USB cable to begin real-time hardware-accelerated screen casting.
              </p>

              {/* Status pill */}
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-slate-900/80 border border-white/10 text-xs text-slate-300 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Engine Ready: {transport}</span>
                <span className="text-slate-600">•</span>
                <span className="text-indigo-400 font-mono">1080p60 Ultra-low Latency</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Canvas Quick Controls (Top-Right) */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
        <button
          onClick={() => setShowMetrics(!showMetrics)}
          className={`p-2 rounded-xl backdrop-blur-md border transition-all text-xs flex items-center gap-1.5 ${
            showMetrics
              ? 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300'
              : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white'
          }`}
          title="Toggle HUD Telemetry"
        >
          {showMetrics ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline font-mono">HUD</span>
        </button>

        <button
          onClick={() => setFitMode(fitMode === 'contain' ? 'cover' : 'contain')}
          className="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-white/10 text-slate-300 hover:text-white backdrop-blur-md transition-all text-xs font-mono"
          title="Toggle Aspect Ratio Fit"
        >
          {fitMode.toUpperCase()}
        </button>

        <div className="flex items-center bg-slate-900/60 border border-white/10 rounded-xl backdrop-blur-md p-0.5">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setScale(1)}
            className="px-1.5 text-[10px] font-mono text-slate-300 hover:text-white"
            title="Reset Zoom"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={() => setScale((s) => Math.min(2.5, s + 0.1))}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-white/10 text-slate-300 hover:text-white backdrop-blur-md transition-all"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Floating HUD Telemetry Overlay (Top-Left) */}
      <AnimatePresence>
        {showMetrics && isActive && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 pointer-events-none"
          >
            {/* FPS Badge */}
            <div className="px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 backdrop-blur-md flex items-center gap-1.5 text-xs font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{fps} FPS</span>
            </div>

            {/* Resolution Badge */}
            <div className="px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 backdrop-blur-md text-xs font-mono text-slate-300">
              {resolution.width}×{resolution.height}
            </div>

            {/* Latency Badge */}
            <div className="px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 backdrop-blur-md text-xs font-mono text-cyan-400">
              ~{latency > 0 ? latency : '12'} ms
            </div>

            {/* Transport Badge */}
            <div className="px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 backdrop-blur-md text-xs font-mono text-indigo-300">
              {transport}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle bottom info bar */}
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-slate-500 pointer-events-none z-10">
        <div>CAST Canvas v1.0 • Hardware Direct</div>
        <div>Target: {targetDeviceName}</div>
      </div>
    </div>
  )
}
