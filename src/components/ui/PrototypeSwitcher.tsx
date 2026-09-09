// Throwaway UI control. URL state belongs to the router, not a second history implementation.
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect } from 'react'

import { variants } from '../character-studio-prototype/data'

export function PrototypeSwitcher({ onShowState }: { onShowState: () => void }) {
  const { variant = 'a' } = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })
  const index = variants.findIndex((entry) => entry.id === variant)
  const cycle = (direction: number) => {
    void navigate({ search: (previous) => ({ ...previous, variant: variants[(index + direction + variants.length) % variants.length].id }), replace: true, resetScroll: false })
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"]')) return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        cycle(event.key === 'ArrowLeft' ? -1 : 1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [variant, navigate])

  if (!import.meta.env.DEV) return null
  return <nav className="prototype-switcher" aria-label="Prototype variants">
    <button className="prototype-switcher-tag" type="button" onClick={onShowState} aria-label="Inspect prototype state">Prototype</button>
    <button type="button" onClick={() => cycle(-1)} aria-label="Previous variant"><ChevronLeft size={17} /></button>
    <span aria-live="polite">{variant.toUpperCase()} <span className="prototype-switcher-name">{variants[index].name}</span></span>
    <button type="button" onClick={() => cycle(1)} aria-label="Next variant"><ChevronRight size={17} /></button>
  </nav>
}
