import { useState, useCallback, useRef, useEffect } from 'react'
import type { ClientMessage } from '../types'

interface LocalStreamState {
  stream: MediaStream | null
  isSharing: boolean
  error: string | null
  fps: number
}

export function useLocalStream() {
  const [state, setState] = useState<LocalStreamState>({
    stream: null,
    isSharing: false,
    error: null,
    fps: 30,
  })

  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const frameIdRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)

  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (videoElementRef.current) {
      videoElementRef.current.pause()
      videoElementRef.current.srcObject = null
      videoElementRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    setState({ stream: null, isSharing: false, error: null, fps: 30 })
  }, [])

  const startCapture = useCallback(async (
    audio = true,
    targetFps = 30,
    onFrameUpload?: (msg: ClientMessage) => void
  ) => {
    stopCapture()

    if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getDisplayMedia !== 'function') {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
      const err = isHttps
        ? 'Screen capture is not supported in this mobile browser. Use this device as a display to watch the PC stream.'
        : 'Mobile screen casting requires HTTPS. Open https://' + (typeof window !== 'undefined' ? window.location.host : '') + ' in your browser.'
      setState(prev => ({ ...prev, error: err }))
      return null
    }

    try {
      // In mobile and desktop: request entire monitor / screen
      // 'monitor' displaySurface preference instructs browser to pick the entire screen
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          frameRate: { ideal: targetFps, max: targetFps },
        } as MediaTrackConstraints,
        audio,
      })

      streamRef.current = stream

      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          stopCapture()
        })
      }

      // Create hidden video element to read frames from stream
      const video = document.createElement('video')
      video.playsInline = true
      video.muted = true
      video.srcObject = stream
      videoElementRef.current = video

      const canvas = document.createElement('canvas')
      canvasElementRef.current = canvas

      await video.play()

      setState({ stream, isSharing: true, error: null, fps: targetFps })

      // If frame uploader is provided (e.g. streaming to bridge for PC to view)
      if (onFrameUpload) {
        frameIdRef.current = 0
        const frameIntervalMs = Math.round(1000 / targetFps)

        intervalRef.current = setInterval(() => {
          if (!video || video.readyState < 2 || !canvas) return

          const w = video.videoWidth || 1280
          const h = video.videoHeight || 720

          // Keep scale optimal for network throughput (max width 1280 for fast encoding)
          const scale = Math.min(1, 1280 / w)
          canvas.width = Math.round(w * scale)
          canvas.height = Math.round(h * scale)

          const ctx = canvas.getContext('2d')
          if (!ctx) return

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65)
          const base64 = dataUrl.substring(dataUrl.indexOf(',') + 1)

          frameIdRef.current += 1
          const isKeyframe = frameIdRef.current % 30 === 1

          onFrameUpload({
            type: 'upload_frame',
            frame_id: frameIdRef.current,
            width: canvas.width,
            height: canvas.height,
            is_keyframe: isKeyframe,
            timestamp_us: Math.round(performance.now() * 1000),
            data_base64: base64,
          })
        }, frameIntervalMs)
      }

      return stream
    } catch (err) {
      console.error('getDisplayMedia error:', err)
      const message = err instanceof Error ? err.message : 'Screen capture failed or was cancelled.'
      setState(prev => ({
        ...prev,
        error: message,
      }))
      return null
    }
  }, [stopCapture])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCapture()
    }
  }, [stopCapture])

  return {
    ...state,
    startCapture,
    stopCapture,
  }
}
