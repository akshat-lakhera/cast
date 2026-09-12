import { useState, useCallback, useRef, useEffect } from 'react'
import type { ClientMessage } from '../types'

export interface DiagnosticError {
  title: string
  message: string
  cause: string
  fix: string
}

interface LocalStreamState {
  stream: MediaStream | null
  isSharing: boolean
  error: string | null
  diagnostic: DiagnosticError | null
  fps: number
}

export function useLocalStream() {
  const [state, setState] = useState<LocalStreamState>({
    stream: null,
    isSharing: false,
    error: null,
    diagnostic: null,
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

    setState({ stream: null, isSharing: false, error: null, diagnostic: null, fps: 30 })
  }, [])

  const startCapture = useCallback(async (
    audio = true,
    targetFps = 30,
    onFrameUpload?: (msg: ClientMessage) => void,
    surfacePreference?: 'monitor' | 'window' | 'browser' | 'any'
  ) => {
    stopCapture()

    if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getDisplayMedia !== 'function') {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
      const err = isHttps
        ? 'Screen/Window capture is not supported in this browser. Please use Chrome, Edge, or Firefox.'
        : 'Mobile screen casting requires HTTPS. Open https://' + (typeof window !== 'undefined' ? window.location.host : '') + ' in your browser.'
      const diag: DiagnosticError = {
        title: 'Display Capture Unsupported',
        message: err,
        cause: isHttps ? 'Browser mediaDevices.getDisplayMedia API missing.' : 'Insecure HTTP context forbids screen capture.',
        fix: isHttps ? 'Open CAST in a modern browser (Chrome, Edge).' : 'Access CAST via HTTPS or http://localhost.',
      }
      setState(prev => ({ ...prev, error: err, diagnostic: diag }))
      return null
    }

    try {
      // Standard Chrome/Edge display media controls:
      // selfBrowserSurface: 'exclude' prevents user from accidentally sharing the CAST app itself
      // preferCurrentTab: false instructs browser to present Window and Screen tabs
      // surfaceSwitching: 'include' allows switching between tabs while live
      const displayMediaOptions: any = {
        video: {
          frameRate: { ideal: targetFps, max: targetFps },
        },
        audio: audio ? {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } : false,
        preferCurrentTab: false,
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'include',
        systemAudio: audio ? 'include' : 'exclude',
      }

      if (surfacePreference && surfacePreference !== 'any') {
        displayMediaOptions.video.displaySurface = surfacePreference
      }

      const stream = await (navigator.mediaDevices as any).getDisplayMedia(displayMediaOptions)

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

      setState({ stream, isSharing: true, error: null, diagnostic: null, fps: targetFps })

      // If frame uploader is provided (streaming to bridge for peer/phone to view)
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
          const dataUrl = canvas.toDataURL('image/jpeg', 0.68)
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
    } catch (err: any) {
      console.error('getDisplayMedia error:', err)
      let title = 'Screen Capture Interrupted'
      let message = err instanceof Error ? err.message : 'Screen capture failed or was cancelled.'
      let cause = 'An issue occurred during capture selection.'
      let fix = 'Click "Share Window, Tab or Screen" to select a window or tab again.'

      if (err.name === 'NotAllowedError' || (typeof err.message === 'string' && err.message.toLowerCase().includes('denied'))) {
        title = 'Selection Cancelled / Dismissed'
        message = 'You cancelled or closed the Window / Tab / Screen picker without choosing one.'
        cause = 'The browser dialog was closed or cancelled before picking a window, tab, or screen.'
        fix = 'Click "Share Window, Tab or Screen", click on the window or tab you want to share, and click "Share".'
      } else if (err.name === 'NotFoundError') {
        title = 'No Capture Source'
        message = 'No display or window capture source was found.'
        cause = 'Operating system or display permissions blocked access.'
        fix = 'Verify Windows screen recording permissions in Windows Settings > Privacy.'
      } else if (err.name === 'NotSupportedError') {
        title = 'Insecure Context'
        message = 'Screen capture requires HTTPS or localhost.'
        cause = 'Browsers forbid capturing screens/windows over plain HTTP on remote IP addresses.'
        fix = 'Open CAST via http://localhost:5174 or configure an HTTPS certificate.'
      }

      const diag: DiagnosticError = { title, message, cause, fix }
      setState(prev => ({
        ...prev,
        error: `${title}: ${message}`,
        diagnostic: diag,
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

  const clearDiagnostic = useCallback(() => {
    setState(prev => ({ ...prev, error: null, diagnostic: null }))
  }, [])

  return {
    ...state,
    startCapture,
    stopCapture,
    clearDiagnostic,
  }
}

