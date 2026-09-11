import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

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

export function PullToRefresh({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [distance, setDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!window.matchMedia('(display-mode: standalone)').matches) return

    let start: { x: number; y: number } | undefined
    let pull = 0
    let reloading = false
    let reloadFrame = 0
    const reset = () => {
      start = undefined
      pull = 0
      setDistance(0)
      setDragging(false)
    }
    const onStart = (event: TouchEvent) => {
      reset()
      if (reloading || event.touches.length !== 1 || queryClient.isMutating() || !canStart(event.target)) return
      const touch = event.touches[0]!
      start = { x: touch.clientX, y: touch.clientY }
      setDragging(true)
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
      setDragging(false)
      setDistance(threshold)
      // Let the settled spinner paint before navigation starts.
      reloadFrame = requestAnimationFrame(() => {
        reloadFrame = requestAnimationFrame(() => window.location.reload())
      })
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd, { passive: true })
    document.addEventListener('touchcancel', reset, { passive: true })
    return () => {
      cancelAnimationFrame(reloadFrame)
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', reset)
    }
  }, [queryClient])

  const progress = Math.min(1, distance / threshold)
  return (
    <div
      className="pull-refresh-shell"
      data-dragging={dragging}
      style={{ '--refresh-distance': `${distance}px` } as CSSProperties}
    >
      <div className="pull-to-refresh" role="status">
        <span className="sr-only">{refreshing ? 'Refreshing…' : distance >= threshold ? 'Release to refresh' : ''}</span>
        <svg
          className="pull-refresh-spinner"
          data-spinning={refreshing}
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={{ opacity: Math.min(1, distance / 24) }}
        >
          {Array.from({ length: 12 }, (_, index) => (
            <rect
              key={index}
              x="11" y="1" width="2" height="6" rx="1"
              transform={`rotate(${index * 30} 12 12)`}
              opacity={refreshing ? (index + 1) / 12 : Math.max(0, Math.min(1, progress * 12 - index))}
            />
          ))}
        </svg>
      </div>
      {children}
    </div>
  )
}
