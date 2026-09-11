import { useQueryClient } from '@tanstack/react-query'
import { ArrowDown, RotateCw } from 'lucide-react'
import { useEffect, useState } from 'react'

const threshold = 64

// Leave nested scrollers, editing, and handwriting gestures to their own controls.
function canStart(target: EventTarget | null) {
  if (!(target instanceof Element) || window.scrollY > 0) return false
  if (target.closest('input, textarea, select, button, a, [contenteditable]:not([contenteditable="false"]), [role="dialog"], dialog, .writing-pad')) return false
  for (let element: Element | null = target; element && element !== document.body; element = element.parentElement) {
    if (element.scrollTop > 0) return false
    const style = getComputedStyle(element)
    if (style.touchAction === 'none' || style.overscrollBehaviorY === 'contain' || style.overscrollBehaviorY === 'none') return false
  }
  return !window.visualViewport || window.visualViewport.scale === 1
}

export function PullToRefresh() {
  const queryClient = useQueryClient()
  const [distance, setDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!window.matchMedia('(display-mode: standalone)').matches) return

    let start: { x: number; y: number } | undefined
    let pull = 0
    let reloading = false
    const reset = () => {
      start = undefined
      pull = 0
      setDistance(0)
    }
    const onStart = (event: TouchEvent) => {
      reset()
      if (reloading || event.touches.length !== 1 || queryClient.isMutating() || !canStart(event.target)) return
      const touch = event.touches[0]!
      start = { x: touch.clientX, y: touch.clientY }
    }
    const onMove = (event: TouchEvent) => {
      if (!start) return
      if (event.touches.length !== 1 || !event.cancelable) return reset()
      const touch = event.touches[0]!
      const dy = touch.clientY - start.y
      const dx = Math.abs(touch.clientX - start.x)
      if (dy < 0 || dx > Math.max(10, dy) || window.scrollY > 0) return reset()
      // Claim the first downward move before Safari starts rubber-band scrolling.
      if (dy > 0) event.preventDefault()
      pull = Math.min(88, dy * 0.45)
      setDistance(pull)
    }
    const onEnd = () => {
      if (pull < threshold || queryClient.isMutating()) return reset()
      start = undefined
      reloading = true
      setRefreshing(true)
      setDistance(threshold)
      window.location.reload()
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd, { passive: true })
    document.addEventListener('touchcancel', reset, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', reset)
    }
  }, [queryClient])

  const ready = distance >= threshold
  return (
    <div
      className="pull-to-refresh"
      role="status"
      style={{ opacity: distance > 0 ? 1 : 0, transform: `translate(-50%, ${distance - 48}px)` }}
    >
      {refreshing ? <RotateCw size={16} className="animate-spin" aria-hidden="true" /> : <ArrowDown size={16} style={{ transform: `rotate(${ready ? 180 : 0}deg)` }} aria-hidden="true" />}
      <span>{refreshing ? 'Refreshing…' : ready ? 'Release to refresh' : distance > 0 ? 'Pull to refresh' : ''}</span>
    </div>
  )
}
