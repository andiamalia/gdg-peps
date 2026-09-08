import { useEffect, useRef } from 'react'

type DeviceMotionPermission = {
  requestPermission?: () => Promise<'granted' | 'denied' | 'prompt'>
}

type Props = {
  enabled: boolean
  onShake: () => void
  threshold?: number
  debounceMs?: number
}

export function useShake({ enabled, onShake, threshold = 18, debounceMs = 2000 }: Props) {
  const lastShakeAt = useRef(0)
  const onShakeRef = useRef(onShake)

  useEffect(() => {
    onShakeRef.current = onShake
  }, [onShake])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return

    function handleMotion(event: DeviceMotionEvent) {
      const acc = event.accelerationIncludingGravity
      if (!acc) return
      const magnitude = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2)
      const now = Date.now()
      if (magnitude > threshold && now - lastShakeAt.current > debounceMs) {
        lastShakeAt.current = now
        onShakeRef.current()
      }
    }

    window.addEventListener('devicemotion', handleMotion)
    return () => window.removeEventListener('devicemotion', handleMotion)
  }, [enabled, threshold, debounceMs])
}

export async function requestShakePermission(): Promise<boolean> {
  const Motion = DeviceMotionEvent as unknown as DeviceMotionPermission
  if (typeof Motion.requestPermission === 'function') {
    const result = await Motion.requestPermission()
    return result === 'granted'
  }
  return true
}
