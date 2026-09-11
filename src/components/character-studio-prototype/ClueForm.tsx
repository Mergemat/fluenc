import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useRef, useState } from 'react'

import type { Cue } from './data'

export function ClueForm({ cues, onChange, onBack, onNext }: {
  cues: Cue[]
  onChange: (cue: Cue, value: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const inputs = useRef(new Map<string, HTMLInputElement>())
  const [showValidation, setShowValidation] = useState(false)
  const missing = cues.find((cue) => !cue.name.trim())

  return <form className="cs-clue-form" aria-label="Fill your clues" onSubmit={(event) => {
    event.preventDefault()
    if (missing) {
      setShowValidation(true)
      inputs.current.get(missing.id)?.focus()
      return
    }
    onNext()
  }}>
    <div className="cs-fill-heading"><h2>Fill your clues</h2><span>2 / 2</span></div>
    <div className="cs-fields">
      {cues.map((cue, index) => <label key={cue.id} className={`cs-fill-field cs-field-${cue.kind}`}>
        <span className={`cs-field-code ${cue.kind === 'prop' ? 'font-hanzi' : ''}`} lang={cue.kind === 'prop' ? 'zh-CN' : undefined}>{cue.code}{cue.count && cue.count > 1 ? <sup className="cs-prop-count">×{cue.count}</sup> : null}</span>
        <span className="cs-field-entry"><span>{cue.position ? `${cue.position} prop` : cue.role}</span><input
          ref={(element) => { if (element) inputs.current.set(cue.id, element); else inputs.current.delete(cue.id) }}
          aria-label={`${cue.role} for ${cue.code}`}
          aria-invalid={showValidation && !cue.name.trim()}
          aria-describedby={showValidation && !cue.name.trim() ? 'cs-fill-feedback' : undefined}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint={index === cues.length - 1 ? 'done' : 'next'}
          placeholder={`Your ${cue.kind}`}
          value={cue.name}
          onChange={(event) => onChange(cue, event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing || index === cues.length - 1) return
            event.preventDefault()
            inputs.current.get(cues[index + 1].id)?.focus()
          }}
        /></span>
      </label>)}
    </div>
    <footer className="cs-fill-actions">
      <p id="cs-fill-feedback" aria-live="polite">{showValidation && missing ? `Name your ${missing.kind} to continue.` : 'Keep the associations that come to mind.'}</p>
      <div><button className="cs-back" type="button" onClick={onBack}><ArrowLeft size={16} />All clues</button><button className="cs-next" type="submit">Next character <ArrowRight size={18} /></button></div>
    </footer>
  </form>
}
