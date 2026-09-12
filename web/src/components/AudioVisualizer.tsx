import { useRef, useEffect, useState } from 'react'
import { Volume2, VolumeX, Radio, Activity } from 'lucide-react'
import type { AudioChunk } from '../types'

interface AudioVisualizerProps {
  currentChunk: AudioChunk | null
  mediaStream: MediaStream | null
  isActive: boolean
  isMuted?: boolean
  onToggleMute?: () => void
}

export function AudioVisualizer({
  currentChunk,
  mediaStream,
  isActive,
  isMuted = false,
  onToggleMute,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [volume, setVolume] = useState<number>(85)
  const [dbLevel, setDbLevel] = useState<number>(-18)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  // Initialize Web Audio analyser if mediaStream has audio
  useEffect(() => {
    if (!mediaStream || !isActive) return

    try {
      const audioTracks = mediaStream.getAudioTracks()
      if (audioTracks.length > 0) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new AudioCtx()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 64
        analyser.smoothingTimeConstant = 0.8

        const source = ctx.createMediaStreamSource(mediaStream)
        source.connect(analyser)

        audioContextRef.current = ctx
        analyserRef.current = analyser
        sourceRef.current = source

        return () => {
          source.disconnect()
          ctx.close().catch(console.error)
        }
      }
    } catch (e) {
      console.warn('AudioContext setup error:', e)
    }
  }, [mediaStream, isActive])

  // Canvas visualizer loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const dataArray = new Uint8Array(32)

    const draw = () => {
      animId = requestAnimationFrame(draw)

      const width = canvas.width
      const height = canvas.height
      ctx.clearRect(0, 0, width, height)

      if (!isActive || isMuted) {
        // Flat baseline
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.3)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(0, height / 2)
        ctx.lineTo(width, height / 2)
        ctx.stroke()
        setDbLevel(-60)
        return
      }

      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray)
      } else {
        // Synthetic audio waves based on chunk activity or simulated pulse
        const time = performance.now() * 0.005
        for (let i = 0; i < dataArray.length; i++) {
          const val = Math.sin(time + i * 0.3) * 60 + Math.cos(time * 0.8 + i * 0.5) * 40 + 70
          dataArray[i] = Math.min(255, Math.max(10, val * (volume / 100)))
        }
      }

      const barCount = 24
      const barWidth = (width - (barCount - 1) * 3) / barCount
      let sum = 0

      for (let i = 0; i < barCount; i++) {
        const val = dataArray[i] || 10
        sum += val
        const percent = val / 255
        const barHeight = Math.max(4, percent * height * 0.85)
        const x = i * (barWidth + 3)
        const y = (height - barHeight) / 2

        // Gradient from cyan to indigo
        const grad = ctx.createLinearGradient(0, y + barHeight, 0, y)
        grad.addColorStop(0, '#06b6d4')
        grad.addColorStop(0.7, '#6366f1')
        grad.addColorStop(1, '#a855f7')

        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 2, 2])
        ctx.fill()
      }

      // Calculate approximate dBFS
      const avg = sum / barCount
      const calcDb = Math.round(20 * Math.log10(Math.max(avg / 255, 0.001)))
      setDbLevel(calcDb)
    }

    draw()
    return () => cancelAnimationFrame(animId)
  }, [isActive, isMuted, volume, currentChunk])

  return (
    <div className="bg-[#070a0f] border border-white/10 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-medium text-white tracking-tight">Audio Passthrough</div>
            <div className="text-[10px] font-mono text-slate-400">
              WASAPI Loopback • 48kHz Stereo • 20ms
            </div>
          </div>
        </div>

        {/* Mute toggle button */}
        <button
          onClick={onToggleMute}
          className={`p-1.5 rounded-lg border transition-all ${
            isMuted
              ? 'bg-rose-950/40 border-rose-500/40 text-rose-400'
              : 'bg-slate-900/60 border-white/10 text-slate-300 hover:text-white'
          }`}
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Waveform Canvas */}
      <div className="relative h-12 w-full bg-black/40 rounded-lg border border-white/5 overflow-hidden flex items-center px-2">
        <canvas ref={canvasRef} width={280} height={48} className="w-full h-full" />
      </div>

      {/* Volume & Telemetry controls */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-[11px] font-mono text-slate-400">VOL</span>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <span className="text-[11px] font-mono text-slate-300 w-8 text-right">{volume}%</span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <span className="text-slate-500">PEAK:</span>
          <span className={dbLevel > -6 ? 'text-amber-400' : 'text-emerald-400'}>
            {isMuted ? '-∞' : `${dbLevel} dB`}
          </span>
        </div>
      </div>
    </div>
  )
}
