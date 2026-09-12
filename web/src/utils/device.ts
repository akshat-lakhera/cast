import type { DeviceType } from '../types'

export interface LocalDeviceInfo {
  id: string
  name: string
  device_type: DeviceType
  is_mobile: boolean
}

export function detectLocalDevice(): LocalDeviceInfo {
  // Generate or retrieve persistent peer ID
  let id = ''
  try {
    id = sessionStorage.getItem('cast_peer_id') || ''
    if (!id) {
      id = `peer-${Math.random().toString(36).substring(2, 9)}`
      sessionStorage.setItem('cast_peer_id', id)
    }
  } catch {
    id = `peer-${Math.random().toString(36).substring(2, 9)}`
  }

  const ua = navigator.userAgent || ''
  const isTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window
  const width = window.innerWidth || screen.width

  let name = 'Web Client'
  let device_type: DeviceType = 'desktop'
  let is_mobile = false

  // Detect Mobile / Tablet / PC
  if (/iPad|Macintosh/i.test(ua) && isTouch && width >= 768) {
    name = 'Apple iPad'
    device_type = 'tablet'
    is_mobile = true
  } else if (/iPhone/i.test(ua)) {
    name = 'Apple iPhone'
    device_type = 'phone'
    is_mobile = true
  } else if (/Android/i.test(ua)) {
    is_mobile = true
    device_type = width >= 768 ? 'tablet' : 'phone'

    if (/SM-|Samsung/i.test(ua)) {
      name = 'Samsung Galaxy'
    } else if (/Pixel/i.test(ua)) {
      name = 'Google Pixel'
    } else if (/OnePlus/i.test(ua)) {
      name = 'OnePlus Mobile'
    } else if (/Xiaomi|Redmi|POCO/i.test(ua)) {
      name = 'Xiaomi Mobile'
    } else {
      name = 'Android Phone'
    }
  } else if (/Windows/i.test(ua)) {
    name = 'Windows PC (Host)'
    device_type = 'desktop'
    is_mobile = false
  } else if (/Mac/i.test(ua)) {
    name = 'Apple Mac'
    device_type = 'laptop'
    is_mobile = false
  } else if (/Linux/i.test(ua)) {
    name = 'Linux PC'
    device_type = 'desktop'
    is_mobile = false
  }

  return { id, name, device_type, is_mobile }
}
