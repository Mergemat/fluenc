import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, X } from 'lucide-react'
import { useState } from 'react'

import { splitMeaning } from '../lib/meaning'
import { getToneDetail } from '../lib/tones'
import { enrollItem, saveMovie, type BuildItem } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { NeutralToneBadge } from './NeutralToneHint'
import { WritingPad } from './WritingPad'
import { Button } from './ui/Button'
import { ErrorNote } from './ui/Layout'

type CharacterItem = Extract<BuildItem, { type: 'character' }>
type MovieProp = CharacterItem['movie']['components'][number]

export function CharacterStudio({ item }: { item: CharacterItem }) {
  const queryClient = useQueryClient()
  const meaning = splitMeaning(item.meaning)
  const tone = getToneDetail(item.movie.tone)
  const actorLocked = Boolean(item.movie.actorName.trim())
  const setLocked = Boolean(item.movie.setName.trim())
  const [actorName, setActorName] = useState(item.movie.actorName)
  const [setName, setSetName] = useState(item.movie.setName)
  const [roomName, setRoomName] = useState(item.movie.roomName)
  const [props, setProps] = useState(item.movie.components)
  const [showValidation, setShowValidation] = useState(false)
  const [writeOpen, setWriteOpen] = useState(false)
  const mappingsReady = Boolean(
    actorName.trim() &&
    setName.trim() &&
    roomName.trim() &&
    props.every((prop) => prop.propName.trim()),
  )

  const finishMutation = useMutation({
    mutationFn: async () => {
      await saveMovie({
        data: {
          characterId: item.id,
          actorKey: item.movie.actorKey,
          actorName,
          finalKey: item.movie.finalKey,
          setName,
          tone: item.movie.tone,
          roomName,
          props: props.map((prop) => ({ component: prop.hanzi, propName: prop.propName })),
        },
      })
      return enrollItem({ data: { itemType: 'character', itemId: item.id } })
    },
    onSuccess: async () => {
      setShowValidation(false)
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  return (
    <article className="flex h-[calc(100dvh-264px)] min-h-[420px] flex-col overflow-hidden md:h-[calc(100dvh-185px)]">
      <div className="grid min-h-0 flex-1 place-content-center justify-items-center gap-2.5 py-1">
        <div
          className="relative grid place-items-center rounded-[2rem] px-9 py-3"
          style={{
            background: 'linear-gradient(165deg, #ffffff 0%, #f4f8f5 65%, #e9f1ec 100%)',
            boxShadow: '0 16px 36px rgb(43 58 66 / 0.16), 0 2px 6px rgb(43 58 66 / 0.06), inset 0 1px 0 #fff',
          }}
        >
          <span className="font-hanzi text-[min(19vw,80px)] leading-none font-semibold text-glaze" lang="zh-CN">
            {item.hanzi}
          </span>
          <MandarinAudioButton
            text={item.hanzi}
            pinyin={item.pinyin}
            className="absolute -top-2 -right-2 rounded-full bg-paper shadow-[0_4px_14px_rgb(43_58_66/0.18)]"
          />
        </div>
        <div className="relative">
          <strong className="block text-center text-[30px] leading-none font-medium tracking-[0.025em] text-ink">{item.pinyin}</strong>
          <NeutralToneBadge text={item.hanzi} pinyin={item.pinyin} className="absolute top-1/2 left-full ml-3 -translate-y-1/2" />
        </div>
        <strong className="text-lg leading-tight font-medium tracking-[0.02em] text-ink">{meaning.primary}</strong>
      </div>

      <div className="flex shrink-0 items-start justify-center gap-5 pb-4">
        {props.map((prop, index) => (
          <ParameterPlaque
            key={prop.hanzi}
            glyph={prop.hanzi}
            invalid={showValidation && !prop.propName.trim()}
            label={`Prop for ${prop.hanzi}`}
            locked={Boolean(item.movie.components[index]?.propName.trim())}
            value={prop.propName}
            onChange={(value) => setProps((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, propName: value } : entry))}
          />
        ))}
      </div>

      <div className="flex shrink-0 items-start justify-center gap-4">
        <ParameterPlaque
          glyph={item.movie.actorKey}
          label={`Actor for ${item.movie.actorKey}`}
          locked={actorLocked}
          value={actorName}
          onChange={setActorName}
        />
        <ParameterPlaque
          glyph={item.movie.finalKey}
          label={`Set for ${item.movie.finalKey}`}
          locked={setLocked}
          value={setName}
          onChange={setSetName}
        />
        <ParameterPlaque
          glyph={tone.mark}
          label={`Room for tone ${item.movie.tone}`}
          tone
          value={roomName}
          onChange={setRoomName}
        />
      </div>

      <div className="grid shrink-0 gap-2.5 pt-4">
        <p className="m-0 text-center text-[13px] leading-relaxed">
          <span className={actorName.trim() ? 'font-medium text-ink' : 'text-faint'}>{actorName || '·····'}</span>
          <span className="px-1 text-faint">in</span>
          <span className={roomName.trim() ? 'font-medium text-ink' : 'text-faint'}>{roomName || '·····'}</span>
          <span className="px-1 text-faint">·</span>
          <span className={setName.trim() ? 'font-medium text-ink' : 'text-faint'}>{setName || '·····'}</span>
          <span className="px-1 text-faint">uses</span>
          <span className={props.every((prop) => prop.propName.trim()) ? 'font-medium text-ink' : 'text-faint'}>
            {props.map((prop) => prop.propName.trim() || '···').join(' + ')}
          </span>
          <span className="px-1 text-faint">to show</span>
          <span className="font-medium text-ink">{meaning.primary}</span>
        </p>
        <div className="flex items-center justify-center gap-2.5">
          <Button
            type="button"
            className="max-w-56"
            disabled={finishMutation.isPending}
            onClick={() => { if (mappingsReady) finishMutation.mutate(); else setShowValidation(true) }}
          >
            <Check size={16} /> {finishMutation.isPending ? 'Saving…' : 'Learned'}
          </Button>
          <button
            type="button"
            aria-label="Write it"
            className="grid size-13 shrink-0 place-items-center rounded-full bg-paper/70 text-muted shadow-[0_2px_8px_rgb(43_58_66/0.08)]"
            onClick={() => setWriteOpen(true)}
          >
            <Pencil size={17} />
          </button>
        </div>
        {showValidation && !mappingsReady ? <ErrorNote>Fill in the empty plaques.</ErrorNote> : null}
        {finishMutation.isError ? <ErrorNote>Could not save this character. Try again.</ErrorNote> : null}
      </div>

      {writeOpen ? <WritingModal character={item.hanzi} onClose={() => setWriteOpen(false)} /> : null}
    </article>
  )
}

/* One character parameter: glyph identifies it, the plaque takes the name.
   Empty — translucent plaque, ghost glyph. Named — the plaque fires: gloss
   white, underglaze glyph, seal-dot. Locked mappings show as filled plaques. */
function ParameterPlaque({ glyph, invalid = false, label, locked = false, onChange, tone = false, value }: {
  glyph: string
  invalid?: boolean
  label: string
  locked?: boolean
  onChange?: (value: string) => void
  tone?: boolean
  value: string
}) {
  const filled = locked || Boolean(value.trim())
  const [focused, setFocused] = useState(false)
  const ring = focused
    ? '0 0 0 2px rgb(47 109 158 / 0.35), 0 8px 20px rgb(47 109 158 / 0.14)'
    : invalid && !filled
      ? '0 0 0 2px rgb(176 64 44 / 0.45), 0 2px 8px rgb(43 58 66 / 0.07)'
      : filled
        ? '0 8px 20px rgb(47 109 158 / 0.14), inset 0 1px 0 #fff'
        : '0 2px 8px rgb(43 58 66 / 0.07), inset 0 1px 0 rgb(255 255 255 / 0.8)'

  return (
    <div
      className="grid w-[6.6rem] justify-items-center gap-0.5 rounded-2xl px-2 pt-2.5 pb-1.5 transition-all duration-200"
      style={{
        background: filled ? 'linear-gradient(180deg, #ffffff 0%, #eef5f1 100%)' : 'rgb(255 255 255 / 0.55)',
        boxShadow: ring,
      }}
    >
      <span
        className={`relative font-hanzi text-[2.3rem] leading-none font-semibold transition-colors duration-200 ${invalid && !filled ? 'text-danger' : ''}`}
        lang="zh-CN"
        style={{ color: filled || tone ? 'var(--color-glaze)' : 'rgb(43 58 66 / 0.32)' }}
      >
        {glyph}
        {filled ? (
          <span className="absolute -top-1 -right-2 size-2 rounded-full bg-glaze" aria-hidden />
        ) : null}
      </span>
      {locked ? (
        <strong className="grid h-6 w-full place-items-center text-[13px] font-medium text-ink">{value}</strong>
      ) : (
        <input
          className="h-6 w-full bg-transparent text-center text-[13px] font-medium text-ink outline-none placeholder:text-ink/30"
          aria-label={label}
          aria-invalid={invalid}
          placeholder="name it"
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      )}
    </div>
  )
}

function WritingModal({ character, onClose }: { character: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-ink/30 p-6 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <section
        className="w-full max-w-sm rounded-[2rem] bg-paper p-5"
        style={{ boxShadow: '0 24px 60px rgb(43 58 66 / 0.3), inset 0 1px 0 #fff' }}
        role="dialog"
        aria-modal="true"
        aria-label={`Write ${character}`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-hanzi text-2xl font-semibold text-glaze" lang="zh-CN">{character}</span>
          <Button variant="icon" type="button" onClick={onClose} aria-label="Close"><X size={17} /></Button>
        </div>
        <WritingPad character={character} />
      </section>
    </div>
  )
}
