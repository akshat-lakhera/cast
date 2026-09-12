import { motion, AnimatePresence } from 'framer-motion'
import { Monitor, Smartphone, ArrowRight, Bluetooth, Usb, Wifi, Settings2, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { CastDirection, TransportMode, DiscoveredDevice, WizardState } from '../types'

interface ConnectionWizardProps {
  devices: DiscoveredDevice[]
  onScan: (transport: string) => void
  onConnect: (device: DiscoveredDevice, direction: CastDirection, transport: TransportMode) => void
  onStartBroadcast: (resolution: string, fps: number, systemAudio: boolean, mic: boolean) => void
}

const directions: { value: CastDirection; label: string; from: string; to: string; icon1: typeof Monitor; icon2: typeof Smartphone }[] = [
  { value: 'pc_to_mobile', label: 'PC to Mobile', from: 'PC', to: 'Mobile', icon1: Monitor, icon2: Smartphone },
  { value: 'mobile_to_pc', label: 'Mobile to PC', from: 'Mobile', to: 'PC', icon1: Smartphone, icon2: Monitor },
  { value: 'pc_to_pc', label: 'PC to PC', from: 'PC', to: 'PC', icon1: Monitor, icon2: Monitor },
  { value: 'mobile_to_mobile', label: 'Mobile to Mobile', from: 'Mobile', to: 'Mobile', icon1: Smartphone, icon2: Smartphone },
]

export function ConnectionWizard({ devices, onScan, onConnect, onStartBroadcast }: ConnectionWizardProps) {
  const [wizard, setWizard] = useState<WizardState>({
    step: 1,
    direction: null,
    transport: null,
    selectedDevice: null,
    resolution: '1080p',
    fps: 30,
    systemAudio: true,
    microphone: false,
  })

  const stepVariants = {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  }

  return (
    <div className="glass-card-elevated p-6 max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="flex items-center gap-2">
            <motion.div
              animate={{
                backgroundColor: wizard.step >= step ? 'rgb(34, 211, 238)' : 'rgb(36, 48, 68)',
                scale: wizard.step === step ? 1.1 : 1,
              }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ color: wizard.step >= step ? '#070a0f' : '#6b82aa' }}
            >
              {step}
            </motion.div>
            {step < 4 && (
              <div className={`w-8 h-0.5 ${wizard.step > step ? 'bg-cast-cyan' : 'bg-obsidian-600'} transition-colors duration-300`} />
            )}
          </div>
        ))}
        <span className="ml-3 text-sm text-obsidian-200 font-medium">
          {wizard.step === 1 ? 'Direction' : wizard.step === 2 ? 'Transport' : wizard.step === 3 ? 'Device' : 'Settings'}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Direction Selection */}
        {wizard.step === 1 && (
          <motion.div key="step1" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}>
            <h2 className="text-white font-semibold text-base mb-1">Choose Casting Direction</h2>
            <p className="text-obsidian-300 text-sm mb-5">What device is casting, and where is it being received?</p>
            <div className="grid grid-cols-2 gap-3">
              {directions.map((dir) => {
                const Icon1 = dir.icon1
                const Icon2 = dir.icon2
                return (
                  <motion.button
                    key={dir.value}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setWizard(prev => ({ ...prev, direction: dir.value, step: 2 }))}
                    className={`glass-card p-4 text-left hover:border-cast-cyan/30 transition-colors duration-200 cursor-pointer`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon1 className="w-5 h-5 text-cast-cyan" />
                      <ArrowRight className="w-3 h-3 text-obsidian-400" />
                      <Icon2 className="w-5 h-5 text-cast-purple" />
                    </div>
                    <p className="text-white text-sm font-medium">{dir.label}</p>
                    <p className="text-obsidian-400 text-xs mt-0.5">{dir.from} screen → {dir.to}</p>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Step 2: Transport Selection */}
        {wizard.step === 2 && (
          <motion.div key="step2" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}>
            <h2 className="text-white font-semibold text-base mb-1">Select Transport</h2>
            <p className="text-obsidian-300 text-sm mb-5">How do you want to connect? Both are 100% offline.</p>
            <div className="grid grid-cols-2 gap-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                onClick={() => {
                  setWizard(prev => ({ ...prev, transport: 'bluetooth', step: 3 }))
                  onScan('bluetooth')
                }}
                className="glass-card p-5 text-left hover:border-cast-cyan/30 transition-colors duration-200 cursor-pointer"
              >
                <Bluetooth className="w-8 h-8 text-cast-cyan mb-3" />
                <p className="text-white font-semibold">Bluetooth</p>
                <p className="text-obsidian-400 text-xs mt-1">Wireless • No internet needed</p>
                <p className="text-obsidian-500 text-xs mt-0.5">480p–720p • ~25 FPS</p>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                onClick={() => {
                  setWizard(prev => ({ ...prev, transport: 'usb', step: 3 }))
                  onScan('usb')
                }}
                className="glass-card p-5 text-left hover:border-cast-amber/30 transition-colors duration-200 cursor-pointer"
              >
                <Usb className="w-8 h-8 text-cast-amber mb-3" />
                <p className="text-white font-semibold">USB Cable</p>
                <p className="text-obsidian-400 text-xs mt-1">High-Speed • Zero latency</p>
                <p className="text-obsidian-500 text-xs mt-0.5">1080p–4K • 60 FPS</p>
              </motion.button>
            </div>
            <button
              onClick={() => setWizard(prev => ({ ...prev, step: 1 }))}
              className="mt-4 text-xs text-obsidian-400 hover:text-obsidian-200 transition-colors"
            >
              ← Back
            </button>
          </motion.div>
        )}

        {/* Step 3: Device Picker */}
        {wizard.step === 3 && (
          <motion.div key="step3" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}>
            <h2 className="text-white font-semibold text-base mb-1">Select Target Device</h2>
            <p className="text-obsidian-300 text-sm mb-5">Choose which device to cast to or receive from.</p>

            {devices.length === 0 ? (
              <div className="text-center py-10">
                <Wifi className="w-10 h-10 text-obsidian-400 mx-auto mb-3 animate-pulse" />
                <p className="text-obsidian-300 text-sm">Scanning for {wizard.transport} devices...</p>
                <p className="text-obsidian-500 text-xs mt-1">Make sure your device has {wizard.transport === 'usb' ? 'USB Tethering' : 'Bluetooth'} enabled</p>
              </div>
            ) : (
              <div className="space-y-2">
                {devices.filter(d => d.transport === wizard.transport).map((device, i) => (
                  <motion.button
                    key={device.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, ease: [0.23, 1, 0.32, 1] }}
                    onClick={() => {
                      setWizard(prev => ({ ...prev, selectedDevice: device, step: 4 }))
                      if (wizard.direction) {
                        onConnect(device, wizard.direction, wizard.transport!)
                      }
                    }}
                    className="w-full glass-card p-4 flex items-center justify-between hover:border-cast-cyan/30 transition-colors duration-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      {device.device_type === 'phone' ? (
                        <Smartphone className="w-5 h-5 text-cast-cyan" />
                      ) : (
                        <Monitor className="w-5 h-5 text-cast-purple" />
                      )}
                      <div className="text-left">
                        <p className="text-white text-sm font-medium">{device.name}</p>
                        <p className="text-obsidian-400 text-xs">
                          {device.rssi_dbm !== undefined ? `Signal: ${device.rssi_dbm} dBm` : ''}
                          {device.usb_speed_mbps ? `${device.usb_speed_mbps} Mbps` : ''}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-obsidian-400" />
                  </motion.button>
                ))}
              </div>
            )}
            <button
              onClick={() => setWizard(prev => ({ ...prev, step: 2 }))}
              className="mt-4 text-xs text-obsidian-400 hover:text-obsidian-200 transition-colors"
            >
              ← Back
            </button>
          </motion.div>
        )}

        {/* Step 4: Stream Settings */}
        {wizard.step === 4 && (
          <motion.div key="step4" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}>
            <h2 className="text-white font-semibold text-base mb-1">Stream Settings</h2>
            <p className="text-obsidian-300 text-sm mb-5">
              Casting to <span className="text-cast-cyan font-medium">{wizard.selectedDevice?.name}</span> via{' '}
              <span className={wizard.transport === 'usb' ? 'text-cast-amber' : 'text-cast-cyan'}>{wizard.transport?.toUpperCase()}</span>
            </p>

            <div className="space-y-4">
              {/* Resolution */}
              <div>
                <label className="text-xs text-obsidian-300 font-medium mb-1.5 block">Resolution</label>
                <div className="flex gap-2">
                  {['480p', '720p', '1080p', '4K'].map(res => (
                    <button
                      key={res}
                      onClick={() => setWizard(prev => ({ ...prev, resolution: res }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                        wizard.resolution === res
                          ? 'bg-cast-cyan/20 text-cast-cyan border border-cast-cyan/30'
                          : 'bg-obsidian-700 text-obsidian-300 border border-obsidian-600 hover:border-obsidian-400'
                      }`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>

              {/* FPS */}
              <div>
                <label className="text-xs text-obsidian-300 font-medium mb-1.5 block">Target FPS</label>
                <div className="flex gap-2">
                  {[15, 30, 60].map(fps => (
                    <button
                      key={fps}
                      onClick={() => setWizard(prev => ({ ...prev, fps }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                        wizard.fps === fps
                          ? 'bg-cast-cyan/20 text-cast-cyan border border-cast-cyan/30'
                          : 'bg-obsidian-700 text-obsidian-300 border border-obsidian-600 hover:border-obsidian-400'
                      }`}
                    >
                      {fps} FPS
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio */}
              <div>
                <label className="text-xs text-obsidian-300 font-medium mb-1.5 block">Audio Sources</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wizard.systemAudio}
                      onChange={(e) => setWizard(prev => ({ ...prev, systemAudio: e.target.checked }))}
                      className="accent-cast-cyan"
                    />
                    <span className="text-sm text-obsidian-200">System Audio</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wizard.microphone}
                      onChange={(e) => setWizard(prev => ({ ...prev, microphone: e.target.checked }))}
                      className="accent-cast-cyan"
                    />
                    <span className="text-sm text-obsidian-200">Microphone</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Start Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onStartBroadcast(wizard.resolution, wizard.fps, wizard.systemAudio, wizard.microphone)}
              className="w-full mt-6 py-3 rounded-xl bg-gradient-to-r from-cast-cyan to-cast-emerald text-obsidian-900 font-bold text-sm tracking-wide glow-cyan transition-all duration-200 cursor-pointer"
            >
              Start Casting
            </motion.button>

            <button
              onClick={() => setWizard(prev => ({ ...prev, step: 3 }))}
              className="mt-3 text-xs text-obsidian-400 hover:text-obsidian-200 transition-colors block mx-auto"
            >
              ← Back
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
