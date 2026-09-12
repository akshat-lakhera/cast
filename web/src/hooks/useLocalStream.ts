import { useState, useCallback } from 'react'

interface LocalStreamState {
  stream: MediaStream | null
  isSharing: boolean
  error: string | null
}

export function useLocalStream() {
  const [state, setState] = useState<LocalStreamState>({
    stream: null,
    isSharing: false,
    error: null,
  })

  const startCapture = useCallback(async (audio = true) => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio,
      })

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        setState({ stream: null, isSharing: false, error: null })
      })

      setState({ stream, isSharing: true, error: null })
      return stream
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Screen capture failed',
      }))
      return null
    }
  }, [])

  const stopCapture = useCallback(() => {
    if (state.stream) {
      state.stream.getTracks().forEach(track => track.stop())
    }
    setState({ stream: null, isSharing: false, error: null })
  }, [state.stream])

  return { ...state, startCapture, stopCapture }
}
