// ─── Device & Transport Types ────────────────────────────────────────

export type CastDirection = 'pc_to_mobile' | 'mobile_to_pc' | 'pc_to_pc' | 'mobile_to_mobile'
export type TransportMode = 'bluetooth' | 'usb'
export type SessionState = 'idle' | 'scanning' | 'pairing' | 'streaming' | 'disconnected'
export type DeviceType = 'phone' | 'laptop' | 'tablet' | 'desktop' | 'unknown'

export interface DiscoveredDevice {
  id: string
  name: string
  device_type: DeviceType
  transport: TransportMode
  rssi_dbm?: number
  usb_speed_mbps?: number
  connected?: boolean
}

export interface TelemetryStats {
  throughput_kbps: number
  latency_ms: number
  fps: number
  frame_drops: number
  jitter_ms: number
  transport: string
}

export interface VideoFrame {
  frame_id: number
  width: number
  height: number
  is_keyframe: boolean
  timestamp_us: number
  data_base64: string
}

export interface AudioChunk {
  timestamp_us: number
  sample_rate: number
  channels: number
  samples_base64: string
}

// ─── Bridge Message Types (from cast-core) ───────────────────────────

export type BridgeMessage =
  | { type: 'video_frame' } & VideoFrame
  | { type: 'audio_chunk' } & AudioChunk
  | { type: 'device_discovered' } & DiscoveredDevice
  | { type: 'device_lost'; id: string }
  | { type: 'telemetry' } & TelemetryStats
  | { type: 'session_state'; state: SessionState; message?: string }
  | { type: 'pin_request'; pin: string }
  | { type: 'pin_result'; success: boolean }
  | { type: 'error'; message: string }

// ─── Client Message Types (to cast-core) ─────────────────────────────

export type ClientMessage =
  | { type: 'register_peer'; id: string; name: string; device_type: string; transport: string; ip?: string }
  | { type: 'scan'; transport: string }
  | { type: 'stop_scan' }
  | { type: 'connect'; device_id: string; direction: string; transport: string }
  | { type: 'start_broadcast'; resolution: string; fps: number; system_audio: boolean; microphone: boolean }
  | { type: 'stop_broadcast' }
  | { type: 'pin_submit'; pin: string }
  | { type: 'clean_cache'; aggressive?: boolean }
  | { type: 'update_config'; resolution?: string; fps?: number; jpeg_quality?: number }
  | { type: 'upload_frame'; frame_id: number; width: number; height: number; is_keyframe: boolean; timestamp_us: number; data_base64: string }
  | { type: 'upload_audio'; timestamp_us: number; sample_rate: number; channels: number; samples_base64: string }
  | { type: 'disconnect' }

// ─── Wizard Step ─────────────────────────────────────────────────────

export interface WizardState {
  step: number
  direction: CastDirection | null
  transport: TransportMode | null
  selectedDevice: DiscoveredDevice | null
  resolution: string
  fps: number
  systemAudio: boolean
  microphone: boolean
}
