import { useState, useEffect, useCallback, useRef } from 'react'
import type { BridgeMessage, ClientMessage, DiscoveredDevice, TelemetryStats, SessionState, VideoFrame, AudioChunk } from '../types'
import { detectLocalDevice } from '../utils/device'

function getWsUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    const isHttps = window.location.protocol === 'https:'
    const protocol = isHttps ? 'wss:' : 'ws:'
    // When using HTTPS, use the Vite dev server proxy /ws to prevent SSL/mixed-content blocks
    if (isHttps) {
      return `${protocol}//${window.location.host}/ws`
    }
    const host = window.location.hostname || '127.0.0.1'
    return `ws://${host}:8765`
  }
  return 'ws://127.0.0.1:8765'
}

const WS_URL = getWsUrl()

interface CastBridgeState {
  connected: boolean
  sessionState: SessionState
  sessionMessage: string
  devices: DiscoveredDevice[]
  telemetry: TelemetryStats | null
  lastFrame: VideoFrame | null
  lastAudioChunk: AudioChunk | null
  pin: string | null
  pinVerified: boolean | null
  error: string | null
}

export function useCastBridge() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [state, setState] = useState<CastBridgeState>({
    connected: false,
    sessionState: 'idle',
    sessionMessage: 'Not connected to CAST daemon.',
    devices: [],
    telemetry: null,
    lastFrame: null,
    lastAudioChunk: null,
    pin: typeof window !== 'undefined' ? detectLocalDevice().pin : null,
    pinVerified: null,
    error: null,
  })

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        const local = detectLocalDevice()
        setState(prev => ({
          ...prev,
          connected: true,
          error: null,
          pin: local.pin,
          sessionMessage: 'Connected to CAST daemon.',
        }))

        // Only register remote/mobile peers with the bridge (PC host should not register itself as a peer)
        if (local.is_mobile) {
          const regMsg: ClientMessage = {
            type: 'register_peer',
            id: local.id,
            name: local.name,
            device_type: local.device_type,
            transport: 'usb',
            ip: typeof window !== 'undefined' ? window.location.hostname : undefined,
          }
          ws.send(JSON.stringify(regMsg))
        }

        // Trigger real device scan immediately
        ws.send(JSON.stringify({ type: 'scan', transport: 'all' }))
      }

      ws.onclose = () => {
        setState(prev => ({
          ...prev,
          connected: false,
          sessionState: 'idle',
          sessionMessage: 'Disconnected from CAST daemon.',
        }))
        // Auto-reconnect after 3 seconds
        reconnectTimer.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        setState(prev => ({
          ...prev,
          connected: false,
          error: 'Failed to connect to CAST daemon. Is it running?',
        }))
      }

      ws.onmessage = (event) => {
        try {
          const msg: BridgeMessage = JSON.parse(event.data)
          handleMessage(msg)
        } catch {
          // Ignore parse errors
        }
      }
    } catch {
      setState(prev => ({ ...prev, error: 'WebSocket connection failed.' }))
    }
  }, [])

  const handleMessage = useCallback((msg: BridgeMessage) => {
    switch (msg.type) {
      case 'session_state':
        setState(prev => ({
          ...prev,
          sessionState: msg.state,
          sessionMessage: msg.message || '',
        }))
        break

      case 'device_discovered':
        setState(prev => {
          const existing = prev.devices.findIndex(d => d.id === msg.id)
          const devices = [...prev.devices]
          const device: DiscoveredDevice = {
            id: msg.id,
            name: msg.name,
            device_type: msg.device_type as DiscoveredDevice['device_type'],
            transport: msg.transport as DiscoveredDevice['transport'],
            rssi_dbm: msg.rssi_dbm,
            usb_speed_mbps: msg.usb_speed_mbps,
          }
          if (existing >= 0) {
            devices[existing] = device
          } else {
            devices.push(device)
          }
          return { ...prev, devices }
        })
        break

      case 'device_lost':
        setState(prev => ({
          ...prev,
          devices: prev.devices.filter(d => d.id !== msg.id),
        }))
        break

      case 'telemetry':
        setState(prev => ({
          ...prev,
          telemetry: {
            throughput_kbps: msg.throughput_kbps,
            latency_ms: msg.latency_ms,
            fps: msg.fps,
            frame_drops: msg.frame_drops,
            jitter_ms: msg.jitter_ms,
            transport: msg.transport,
          },
        }))
        break

      case 'video_frame':
        setState(prev => ({
          ...prev,
          lastFrame: {
            frame_id: msg.frame_id,
            width: msg.width,
            height: msg.height,
            is_keyframe: msg.is_keyframe,
            timestamp_us: msg.timestamp_us,
            data_base64: msg.data_base64,
          },
        }))
        break

      case 'audio_chunk':
        setState(prev => ({
          ...prev,
          lastAudioChunk: {
            timestamp_us: msg.timestamp_us,
            sample_rate: msg.sample_rate,
            channels: msg.channels,
            samples_base64: msg.samples_base64,
          },
        }))
        break

      case 'pin_request':
        setState(prev => ({ ...prev, pin: msg.pin, pinVerified: null }))
        break

      case 'pin_result':
        setState(prev => ({ ...prev, pinVerified: msg.success }))
        break

      case 'error':
        setState(prev => ({ ...prev, error: msg.message }))
        break
    }
  }, [])

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  // Connect on mount
  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return {
    ...state,
    send,
    reconnect: connect,
  }
}
