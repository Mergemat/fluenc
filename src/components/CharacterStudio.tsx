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
  const roomName = item.movie.roomName
  const [actorName, setActorName] = useState(item.movie.actorName)
  const [setName, setSetName] = useState(item.movie.setName)
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
    <article>
      <header className="grid justify-items-center text-center">
        <p className="m-0 mb-4 text-[11px] font-semibold tracking-[.16em] text-faint">#{item.rank}</p>
        <span className="font-hanzi text-8xl leading-none font-semibold tracking-tight" lang="zh-CN">{item.hanzi}</span>
        <div className="mt-5 flex items-center justify-center gap-2">
          <strong className="text-lg font-medium">{item.pinyin}</strong>
          <NeutralToneBadge text={item.hanzi} pinyin={item.pinyin} />
          <MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} />
        </div>
        <span className="mt-1 block text-base font-medium tracking-tight">{meaning.primary}</span>
      </header>

      <section className="mt-10 border-t border-line pt-6">
        <p className="m-0 mb-6 text-3xl font-semibold tracking-tight" aria-label={`Initial ${item.movie.actorKey}, final ${item.movie.finalKey}, tone ${item.movie.tone}`}>
          {item.movie.actorKey}
          <span className="mx-2.5 font-normal text-faint">+</span>
          {item.movie.finalKey}
          <span className="mx-2.5 font-normal text-faint">+</span>
          {tone.mark}
        </p>
        <div className="grid gap-5">
          <GlyphField
            glyph={item.movie.actorKey}
            invalid={showValidation && !actorName.trim()}
            locked={actorLocked}
            placeholder="actor"
            value={actorName}
            onChange={setActorName}
          />
          <GlyphField
            glyph={item.movie.finalKey}
            invalid={showValidation && !setName.trim()}
            locked={setLocked}
            placeholder="set"
            value={setName}
            onChange={setSetName}
          />
          <GlyphField glyph={tone.mark} value={roomName} />
        </div>
      </section>

      <section className="mt-10 border-t border-line pt-6">
        <p className="m-0 mb-6 font-hanzi text-3xl leading-none font-semibold tracking-tight" lang="zh-CN">
          {props.map((prop) => prop.hanzi).join(' + ')}
        </p>
        <div className="grid gap-5">
          {props.map((prop, index) => (
            <GlyphField
              key={prop.hanzi}
              glyph={prop.hanzi}
              hanzi
              invalid={showValidation && !prop.propName.trim()}
              locked={Boolean(item.movie.components[index]?.propName.trim())}
              placeholder="prop"
              value={prop.propName}
              onChange={(value) => setProps((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, propName: value } : entry))}
            />
          ))}
        </div>
      </section>

      {!item.movie.isPrimitive ? (
        <p className="mt-10 border-t border-line pt-6 text-sm leading-relaxed text-muted">
          {actorName || 'The actor'} in {roomName} · {setName || 'the set'} uses{' '}
          {props.map((prop) => prop.propName || prop.hanzi).join(' and ')} to show {meaning.primary}.
        </p>
      ) : null}

      <footer className="mt-10 border-t border-line pt-6">
        <Button
          type="button"
          disabled={finishMutation.isPending}
          onClick={() => { if (mappingsReady) finishMutation.mutate(); else setShowValidation(true) }}
        >
          <Check size={16} /> {finishMutation.isPending ? 'Saving…' : 'Learned'}
        </Button>
        <div className="mt-3 grid justify-items-center">
          <Button variant="ghost" type="button" onClick={() => setWriteOpen(true)}>
            <Pencil size={14} /> Write it
          </Button>
        </div>
      </footer>
      {showValidation && !mappingsReady ? <ErrorNote>Fill in the empty slots.</ErrorNote> : null}
      {finishMutation.isError ? <ErrorNote>Could not save this character. Try again.</ErrorNote> : null}

      {writeOpen ? <WritingModal character={item.hanzi} onClose={() => setWriteOpen(false)} /> : null}
    </article>
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
        className="w-full max-w-sm rounded-3xl bg-paper p-5"
        role="dialog"
        aria-modal="true"
        aria-label={`Write ${character}`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-hanzi text-2xl font-semibold" lang="zh-CN">{character}</span>
          <Button variant="icon" type="button" onClick={onClose} aria-label="Close"><X size={17} /></Button>
        </div>
        <WritingPad character={character} />
      </section>
    </div>
  )
}

function GlyphField({ glyph, hanzi = false, invalid = false, locked = false, onChange, placeholder, value }: {
  glyph: string
  hanzi?: boolean
  invalid?: boolean
  locked?: boolean
  onChange?: (value: string) => void
  placeholder?: string
  value: string
}) {
  return (
    <div className={`grid grid-cols-[44px_1fr] items-center gap-3 ${invalid ? 'text-danger' : ''}`}>
      <span
        className={`text-center text-2xl leading-none font-semibold ${hanzi ? 'font-hanzi' : ''}`}
        lang={hanzi ? 'zh-CN' : undefined}
        title={invalid ? 'Fill in this slot' : undefined}
      >
        {glyph}
      </span>
      {onChange && !locked ? (
        <input
          className="min-w-0 border-0 border-b border-line bg-transparent py-1.5 text-[15px] font-medium focus:border-ink"
          aria-label={placeholder}
          aria-invalid={invalid}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <strong className={`overflow-hidden border-b border-transparent py-1.5 text-[15px] font-medium text-ellipsis whitespace-nowrap ${onChange ? '' : 'text-muted'}`}>{value}</strong>
      )}
    </div>
  )
}
