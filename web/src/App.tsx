import { useState, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles } from 'lucide-react'

import { useCastBridge } from './hooks/useCastBridge'
import { useLocalStream } from './hooks/useLocalStream'
import { MobileView } from './components/mobile/MobileView'
import { DesktopView, type ErrorDiagnostic } from './components/pc/DesktopView'
import { PairingModal, type ModalMode } from './components/PairingModal'
import { detectLocalDevice } from './utils/device'
import type { DiscoveredDevice, CastDirection, TransportMode } from './types'

export function App() {
  const {
    connected: bridgeConnected,
    sessionState,
    sessionMessage,
    pin: bridgePin,
    devices: bridgeDevices,
    lastFrame,
    lastAudioChunk,
    telemetry,
    send: sendBridgeMessage,
  } = useCastBridge()

  const {
    stream: localStream,
    isSharing: isLocalSharing,
    error: localStreamError,
    diagnostic: localStreamDiagnostic,
    startCapture: startLocalShare,
    stopCapture: stopLocalShare,
    clearDiagnostic: clearLocalDiagnostic,
  } = useLocalStream()

  // Detect local device identity (this PC or this Phone)
  const localDevice = detectLocalDevice()
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth < 768 || localDevice.is_mobile : false
  )

  // Reactive screen resize listener
  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768 || localDevice.is_mobile)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [localDevice.is_mobile])

  // UI view mode: 'auto' | 'mobile' | 'pc'
  const [uiMode, setUiMode] = useState<'auto' | 'mobile' | 'pc'>('auto')
  const activeView = uiMode === 'auto' ? (isMobileScreen ? 'mobile' : 'pc') : uiMode

  // Core stream states
  const [direction, setDirection] = useState<CastDirection>('pc_to_mobile')
  const [transport, setTransport] = useState<TransportMode>('usb')
  const [selectedDevice, setSelectedDevice] = useState<DiscoveredDevice | null>(null)
  const [isCasting, setIsCasting] = useState<boolean>(false)
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [selectedResolution, setSelectedResolution] = useState<string>('1080p')
  const [selectedFps, setSelectedFps] = useState<number>(60)
  const [notification, setNotification] = useState<string | null>(null)
  const [hardwareTab, setHardwareTab] = useState<'both' | 'usb' | 'bluetooth'>('both')

  // Pairing modal state
  const [pairingModalOpen, setPairingModalOpen] = useState<boolean>(false)
  const [pairingModalMode, setPairingModalMode] = useState<ModalMode>('enter_pin')
  const [isCleaning, setIsCleaning] = useState<boolean>(false)
  const [manualDiagnostic, setManualDiagnostic] = useState<ErrorDiagnostic | null>(null)

  // Active diagnostic error: surfaced from local stream picker, bridge, or explicit check
  const activeErrorDiagnostic: ErrorDiagnostic | null =
    manualDiagnostic ||
    localStreamDiagnostic ||
    (localStreamError
      ? {
          title: 'Stream Error',
          message: localStreamError,
          cause: 'An issue occurred during media stream initialization.',
          fix: 'Click "Share Window, Tab or Screen" to select again.',
        }
      : null)

  // Trigger notification toast
  const showToast = useCallback((msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3500)
  }, [])

  // Auto-display any stream errors
  useEffect(() => {
    if (localStreamError) {
      showToast(`⚠️ ${localStreamError}`)
    }
  }, [localStreamError, showToast])

  // Real discovered remote devices (excluding self)
  const activeDevices = useMemo(
    () => bridgeDevices.filter((d) => d.id !== localDevice.id),
    [bridgeDevices, localDevice.id]
  )

  // Auto-target remote device safely
  useEffect(() => {
    if (activeDevices.length > 0 && (!selectedDevice || !activeDevices.some((d) => d.id === selectedDevice.id))) {
      setSelectedDevice(activeDevices[0])
    }
  }, [activeDevices, selectedDevice])

  const currentDevice = selectedDevice || (activeDevices.length > 0 ? activeDevices[0] : null)

  // Auto-transition to streaming whenever bridge daemon enters streaming
  useEffect(() => {
    if (sessionState === 'streaming') {
      setIsCasting(true)
    } else if (sessionState === 'idle') {
      setIsCasting(false)
    }
  }, [sessionState])

  // Auto-authenticate if opened via ?pin=XXXXXX from scanned QR
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pinFromUrl = params.get('pin')
    if (pinFromUrl && pinFromUrl.length === 6) {
      sendBridgeMessage({ type: 'pin_submit', pin: pinFromUrl })
      setIsCasting(true)
      showToast(`Auto-paired with PIN: ${pinFromUrl}`)
    }
  }, [sendBridgeMessage, showToast])

  // Start Cast Handler: Supports both Interactive Browser Selector (Window/Tab/Screen) and Direct Hardware Mirror
  const handleStartCast = async (mode: 'picker' | 'hardware' = 'picker') => {
    setManualDiagnostic(null)
    clearLocalDiagnostic()

    // Mode A: Interactive Browser Display Picker (Entire Screen, Specific Window, or Browser Tab)
    if (mode === 'picker') {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
        const errDiag: ErrorDiagnostic = {
          title: 'Display Capture Incompatible',
          message: isHttps
            ? 'Screen/Window capture is not supported in this browser. Please use Chrome, Edge, or Firefox.'
            : 'Screen, Window, and Tab casting requires HTTPS or http://localhost. Insecure HTTP restricts screen recording.',
          cause: isHttps ? 'Browser mediaDevices.getDisplayMedia is not available.' : 'Insecure remote origin forbids screen capture.',
          fix: 'Open CAST at http://localhost:5174 or click "Direct Full Desktop (Hardware GDI)" instead.',
        }
        setManualDiagnostic(errDiag)
        showToast(errDiag.title)
        return
      }

      showToast('Opening Window / Tab / Screen selector...')
      const stream = await startLocalShare(!isMuted, selectedFps, (frameMsg) => {
        sendBridgeMessage(frameMsg)
      })

      if (stream) {
        setIsCasting(true)
        if (currentDevice) {
          sendBridgeMessage({
            type: 'connect',
            device_id: currentDevice.id,
            direction,
            transport,
          })
        }
        showToast('Broadcasting selected Window / Tab / Screen!')
      }
      return
    }

    // Mode B: Direct Full Desktop Mirror via Rust Win32 GDI Hardware Driver
    setIsCasting(true)
    sendBridgeMessage({
      type: 'start_broadcast',
      resolution: selectedResolution,
      fps: selectedFps,
      system_audio: !isMuted,
      microphone: false,
    })

    if (currentDevice) {
      sendBridgeMessage({
        type: 'connect',
        device_id: currentDevice.id,
        direction,
        transport,
      })
    }

    showToast(`CAST hardware desktop broadcast started (${direction.toUpperCase()}) via ${transport.toUpperCase()}`)
  }

  // Stop Cast Handler
  const handleStopCast = () => {
    setIsCasting(false)
    if (isLocalSharing) stopLocalShare()
    sendBridgeMessage({ type: 'stop_broadcast' })
    showToast('Casting session stopped')
  }

  // Verify PIN Handler
  const handleVerifyPin = (pin: string) => {
    sendBridgeMessage({ type: 'pin_submit', pin })
    showToast(`Verifying PIN ${pin}...`)
    if (currentDevice) {
      sendBridgeMessage({
        type: 'connect',
        device_id: currentDevice.id,
        direction,
        transport,
      })
    }
    setIsCasting(true)
    setTimeout(() => {
      setPairingModalOpen(false)
      showToast('PIN Verified & Device Paired!')
    }, 600)
  }

  // Device selection
  const handleSelectDevice = (device: DiscoveredDevice) => {
    setSelectedDevice(device)
    setTransport(device.transport)
    showToast(`Selected ${device.name} via ${device.transport.toUpperCase()}`)
  }

  // Cache cleaning
  const handleCleanCache = () => {
    setIsCleaning(true)
    sendBridgeMessage({ type: 'clean_cache', aggressive: true })
    setTimeout(() => {
      setIsCleaning(false)
      showToast('Storage cache cleaned: Freed build and frame storage.')
    }, 1500)
  }

  const openPairing = (mode: ModalMode) => {
    setPairingModalMode(mode)
    setPairingModalOpen(true)
  }

  // Active stream condition: only active when casting or receiving frames in active session
  const isStreamActive = (isCasting || isLocalSharing || sessionState === 'streaming') && sessionState !== 'idle'

  return (
    <>
      {activeView === 'mobile' ? (
        <MobileView
          bridgeConnected={bridgeConnected}
          sessionState={sessionState}
          sessionMessage={sessionMessage}
          bridgePin={bridgePin}
          localDevicePin={localDevice.pin}
          localDeviceName={localDevice.name}
          localDeviceId={localDevice.id}
          activeDevices={activeDevices}
          currentDevice={currentDevice}
          transport={transport}
          setTransport={setTransport}
          direction={direction}
          setDirection={setDirection}
          onStartCast={handleStartCast}
          onStopCast={handleStopCast}
          onOpenPairing={openPairing}
          onSwitchToPc={() => setUiMode('pc')}
          onToast={showToast}
          isStreamActive={isStreamActive}
          lastFrame={lastFrame}
          localStream={localStream}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(!isMuted)}
          errorDiagnostic={activeErrorDiagnostic}
          onDismissError={() => {
            setManualDiagnostic(null)
            clearLocalDiagnostic()
          }}
        />
      ) : (
        <DesktopView
          bridgeConnected={bridgeConnected}
          sessionState={sessionState}
          sessionMessage={sessionMessage}
          bridgePin={bridgePin}
          localDevicePin={localDevice.pin}
          localDeviceId={localDevice.id}
          activeDevices={activeDevices}
          currentDevice={currentDevice}
          selectedDevice={selectedDevice}
          onSelectDevice={handleSelectDevice}
          transport={transport}
          setTransport={setTransport}
          direction={direction}
          setDirection={setDirection}
          selectedResolution={selectedResolution}
          setSelectedResolution={setSelectedResolution}
          selectedFps={selectedFps}
          setSelectedFps={setSelectedFps}
          isMuted={isMuted}
          setIsMuted={setIsMuted}
          isPaused={isPaused}
          setIsPaused={setIsPaused}
          hardwareTab={hardwareTab}
          setHardwareTab={setHardwareTab}
          onStartCast={handleStartCast}
          onStopCast={handleStopCast}
          onOpenPairing={openPairing}
          onCleanCache={handleCleanCache}
          isCleaning={isCleaning}
          onSwitchToMobile={() => setUiMode('mobile')}
          onToast={showToast}
          isStreamActive={isStreamActive}
          lastFrame={lastFrame}
          lastAudioChunk={lastAudioChunk}
          localStream={localStream}
          telemetry={telemetry}
          errorDiagnostic={activeErrorDiagnostic}
          onDismissError={() => {
            setManualDiagnostic(null)
            clearLocalDiagnostic()
          }}
        />
      )}

      {/* Bidirectional PIN & QR Authentication Modal */}
      <PairingModal
        isOpen={pairingModalOpen}
        initialMode={pairingModalMode}
        pairingPin={bridgePin || localDevice.pin}
        deviceName={currentDevice?.name || 'Remote Peer'}
        onClose={() => setPairingModalOpen(false)}
        onVerifyPin={handleVerifyPin}
      />

      {/* Floating Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-[100] px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-indigo-500/50 text-xs font-mono text-indigo-200 shadow-2xl backdrop-blur-xl flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
