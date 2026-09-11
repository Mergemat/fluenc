// Throwaway grilling control: native pointer capture handles this one draggable panel.
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, GripVertical, SlidersHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { variants, type Sample } from '../character-studio-prototype/data'

type Screen = 'scene' | 'fill'

export function PrototypeSwitcher({ onShowState, screen, onScreenChange, sample, onSampleChange, example }: {
  onShowState: () => void
  screen: Screen
  onScreenChange: (screen: Screen) => void
  sample: Sample
  onSampleChange: (sample: Sample) => void
  example: boolean
}) {
  const { variant = 'a' } = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })
  const [expanded, setExpanded] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const panel = useRef<HTMLElement>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const index = variants.findIndex(entry => entry.id === variant)
  const cycle = (direction: number) => {
    void navigate({ search: previous => ({ ...previous, variant: variants[(index + direction + variants.length) % variants.length].id }), replace: true, resetScroll: false })
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], [data-drag-handle]')) return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        cycle(event.key === 'ArrowLeft' ? -1 : 1)
      }
    }
    const onResize = () => setPosition(null)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('resize', onResize) }
  }, [variant, navigate])

  if (!import.meta.env.DEV) return null
  return <nav ref={panel} className="prototype-switcher" aria-label="Prototype variants" style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}>
    {expanded ? <div className={`prototype-options ${position && position.y < 170 ? 'prototype-options-below' : ''}`}>
      <strong>Round 1 · Overall layout</strong>
      <div aria-label="Prototype screen">{(['scene', 'fill'] as const).map(value => <button key={value} type="button" aria-pressed={screen === value} onClick={() => onScreenChange(value)}>{value === 'scene' ? 'All clues' : 'Fill'}</button>)}</div>
      {example ? <div aria-label="Example state">{([{ id: 'sequence', label: 'Example' }, { id: 'missing', label: 'Missing' }, { id: 'dense', label: '6 parts' }] as const).map(value => <button key={value.id} type="button" aria-pressed={sample === value.id} onClick={() => onSampleChange(value.id)}>{value.label}</button>)}</div> : <small>Use Example to try mock states.</small>}
      <div><button type="button" onClick={onShowState}>Inspect state</button><button type="button" onClick={() => setPosition(null)}>Reset position</button></div>
    </div> : null}
    <button type="button" data-drag-handle aria-label="Move prototype picker" className="prototype-grip"
      onPointerDown={event => {
        const rect = panel.current!.getBoundingClientRect()
        drag.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event => {
        if (!drag.current) return
        const rect = panel.current!.getBoundingClientRect()
        setPosition({ x: Math.max(8, Math.min(window.innerWidth - rect.width - 8, event.clientX - drag.current.x)), y: Math.max(8, Math.min(window.innerHeight - rect.height - 8, event.clientY - drag.current.y)) })
      }}
      onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
        event.preventDefault()
        const rect = panel.current!.getBoundingClientRect()
        setPosition({ x: Math.max(8, Math.min(window.innerWidth - rect.width - 8, rect.left + (event.key === 'ArrowRight' ? 20 : event.key === 'ArrowLeft' ? -20 : 0))), y: Math.max(8, Math.min(window.innerHeight - rect.height - 8, rect.top + (event.key === 'ArrowDown' ? 20 : event.key === 'ArrowUp' ? -20 : 0))) })
      }}><GripVertical size={16} /></button>
    <button type="button" onClick={() => cycle(-1)} aria-label="Previous variant"><ChevronLeft size={18} /></button>
    <span aria-live="polite"><b>{variant.toUpperCase()}</b> {variants[index].name}</span>
    <button type="button" onClick={() => cycle(1)} aria-label="Next variant"><ChevronRight size={18} /></button>
    <button type="button" aria-expanded={expanded} aria-label="Prototype controls" onClick={() => setExpanded(!expanded)}><SlidersHorizontal size={16} /></button>
  </nav>
}
