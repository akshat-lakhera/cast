import { motion } from 'framer-motion'
import { Usb, Smartphone, Monitor, Zap, Cable } from 'lucide-react'
import type { DiscoveredDevice } from '../types'

interface UsbDevicePanelProps {
  devices: DiscoveredDevice[]
  onSelectDevice: (device: DiscoveredDevice) => void
}

export function UsbDevicePanel({ devices, onSelectDevice }: UsbDevicePanelProps) {
  // Only display real physical USB hardware detected by the daemon, ignoring web peers
  const usbDevices = devices.filter(
    d => d.transport === 'usb' && (d.id.startsWith('USB:') || !d.id.startsWith('peer-'))
  )

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="glass-card p-5"
    >
      <div className="flex items-center gap-2 mb-1">
        <Cable className="w-4 h-4 text-cast-amber" />
        <h3 className="text-sm font-semibold text-white">USB Devices</h3>
      </div>
      <p className="text-xs text-obsidian-400 mb-4">{usbDevices.length} device(s) connected</p>

      {usbDevices.length === 0 ? (
        <div className="text-center py-8">
          <Usb className="w-10 h-10 text-obsidian-500 mx-auto mb-3" />
          <p className="text-obsidian-400 text-sm">No USB devices detected</p>
          <p className="text-obsidian-500 text-xs mt-1">Connect a phone via USB and enable USB Tethering</p>
        </div>
      ) : (
        <div className="space-y-2">
          {usbDevices.map((device, i) => (
            <motion.button
              key={device.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, ease: [0.23, 1, 0.32, 1] }}
              onClick={() => onSelectDevice(device)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-obsidian-700/50 hover:bg-obsidian-600/50 border border-obsidian-600/50 hover:border-cast-amber/20 transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                {device.device_type === 'phone' ? (
                  <Smartphone className="w-5 h-5 text-cast-amber" />
                ) : (
                  <Monitor className="w-5 h-5 text-cast-amber" />
                )}
                <div className="text-left">
                  <p className="text-white text-sm font-medium">{device.name}</p>
                  <p className="text-obsidian-400 text-xs">{device.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-cast-amber" />
                <span className="mono-badge bg-cast-amber/10 text-cast-amber border border-cast-amber/20">
                  {device.usb_speed_mbps} Mbps
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  )
}
