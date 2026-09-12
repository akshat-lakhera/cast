import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import type { DiscoveredDevice } from '../types'
import { Smartphone, Monitor, Tablet } from 'lucide-react'

interface BluetoothRadarProps {
  devices: DiscoveredDevice[]
  onSelectDevice: (device: DiscoveredDevice) => void
}

export function BluetoothRadar({ devices, onSelectDevice }: BluetoothRadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  const btDevices = devices.filter(d => d.transport === 'bluetooth')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = 280
    canvas.width = size * 2
    canvas.height = size * 2
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.scale(2, 2)

    const cx = size / 2
    const cy = size / 2
    const maxRadius = size / 2 - 20
    let angle = 0

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, size, size)

      // Background rings
      for (let i = 1; i <= 3; i++) {
        const r = (maxRadius / 3) * i
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(34, 211, 238, ${0.06 + i * 0.02})`
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Crosshairs
      ctx.beginPath()
      ctx.moveTo(cx, cy - maxRadius)
      ctx.lineTo(cx, cy + maxRadius)
      ctx.moveTo(cx - maxRadius, cy)
      ctx.lineTo(cx + maxRadius, cy)
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.05)'
      ctx.lineWidth = 0.5
      ctx.stroke()

      // Sweep line
      const sweepX = cx + Math.cos(angle) * maxRadius
      const sweepY = cy + Math.sin(angle) * maxRadius

      const gradient = ctx.createLinearGradient(cx, cy, sweepX, sweepY)
      gradient.addColorStop(0, 'rgba(34, 211, 238, 0)')
      gradient.addColorStop(0.6, 'rgba(34, 211, 238, 0.1)')
      gradient.addColorStop(1, 'rgba(34, 211, 238, 0.4)')

      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(sweepX, sweepY)
      ctx.strokeStyle = gradient
      ctx.lineWidth = 2
      ctx.stroke()

      // Sweep glow arc
      ctx.beginPath()
      ctx.arc(cx, cy, maxRadius, angle - 0.5, angle)
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.15)'
      ctx.lineWidth = 3
      ctx.stroke()

      // Center dot
      ctx.beginPath()
      ctx.arc(cx, cy, 3, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(34, 211, 238, 0.8)'
      ctx.fill()

      // Device dots
      btDevices.forEach((device, i) => {
        const rssi = device.rssi_dbm ?? -60
        const normalizedDist = Math.min(Math.max((-rssi - 30) / 70, 0.15), 0.95)
        const deviceAngle = (i / Math.max(btDevices.length, 1)) * Math.PI * 2 - Math.PI / 2
        const dx = cx + Math.cos(deviceAngle) * (maxRadius * normalizedDist)
        const dy = cy + Math.sin(deviceAngle) * (maxRadius * normalizedDist)

        // Pulse ring
        const pulseScale = 1 + Math.sin(Date.now() / 800 + i) * 0.3
        ctx.beginPath()
        ctx.arc(dx, dy, 8 * pulseScale, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(34, 211, 238, 0.08)'
        ctx.fill()

        // Device dot
        ctx.beginPath()
        ctx.arc(dx, dy, 4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(34, 211, 238, 0.9)'
        ctx.fill()

        // Label
        ctx.font = '9px Inter, sans-serif'
        ctx.fillStyle = 'rgba(154, 173, 204, 0.8)'
        ctx.textAlign = 'center'
        const name = device.name.length > 14 ? device.name.slice(0, 14) + '…' : device.name
        ctx.fillText(name, dx, dy + 16)
        ctx.fillText(`${rssi} dBm`, dx, dy + 26)
      })

      angle += 0.015
      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [btDevices])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="glass-card p-5"
    >
      <h3 className="text-sm font-semibold text-white mb-1">Bluetooth Radar</h3>
      <p className="text-xs text-obsidian-400 mb-4">{btDevices.length} device(s) in range</p>

      <div className="flex justify-center">
        <canvas ref={canvasRef} className="rounded-full" />
      </div>

      {/* Device list below radar */}
      {btDevices.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {btDevices.map(device => (
            <button
              key={device.id}
              onClick={() => onSelectDevice(device)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-obsidian-700/50 hover:bg-obsidian-600/50 transition-colors text-left cursor-pointer"
            >
              {device.device_type === 'phone' ? (
                <Smartphone className="w-4 h-4 text-cast-cyan shrink-0" />
              ) : device.device_type === 'tablet' ? (
                <Tablet className="w-4 h-4 text-cast-cyan shrink-0" />
              ) : (
                <Monitor className="w-4 h-4 text-cast-purple shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-white text-xs font-medium truncate">{device.name}</p>
                <p className="text-obsidian-400 text-[10px]">{device.rssi_dbm} dBm</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  )
}
