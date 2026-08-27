import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { splitMeaning } from '../lib/meaning'
import { getToneDetail } from '../lib/tones'
import { enrollItem, saveMovie, type BuildItem } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { NeutralToneBadge, NeutralToneExample } from './NeutralToneHint'
import { WritingPad } from './WritingPad'
import { Button } from './ui/Button'
import { Card, ErrorNote } from './ui/Layout'

type CharacterItem = Extract<BuildItem, { type: 'character' }>
type MovieProp = CharacterItem['movie']['components'][number]

const categoryNames = {
  male: 'male actor',
  female: 'female actor',
  fictional: 'fictional character',
  wildcard: 'wildcard character',
}

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
    <Card>
      <header className="p-5 pb-4">
        <p className="m-0 mb-3 text-[10px] font-bold tracking-[.12em] text-faint uppercase">
          {item.movie.isPrimitive ? 'Basic component' : 'New character'} · #{item.rank}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-hanzi text-7xl leading-none font-semibold tracking-tight sm:text-8xl" lang="zh-CN">{item.hanzi}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <strong className="text-base text-accent">{item.pinyin}</strong>
              <NeutralToneBadge text={item.hanzi} pinyin={item.pinyin} />
              <MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} />
            </div>
            <span className="mt-0.5 block text-xl font-semibold tracking-tight">{meaning.primary}</span>
            <NeutralToneExample text={item.hanzi} pinyin={item.pinyin} />
          </div>
        </div>
      </header>

      <section className="border-t border-line p-5">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="m-0 text-xs font-bold uppercase tracking-wide">Coordinates</h2>
          <small className="text-[10px] text-muted">choose each new link once</small>
        </div>
        <div className="grid gap-4">
          <CoordinateField
            code={`Initial · ${item.movie.actorKey}`}
            help={categoryNames[item.movie.actorCategory]}
            invalid={showValidation && !actorName.trim()}
            marker="A"
            onChange={actorLocked ? undefined : setActorName}
            placeholder="Pick an actor"
            value={actorName}
          />
          <CoordinateField
            code={`Final · ${item.movie.finalKey}`}
            help="a familiar place"
            invalid={showValidation && !setName.trim()}
            marker="S"
            onChange={setLocked ? undefined : setSetName}
            placeholder="Pick a set"
            value={setName}
          />
          <CoordinateField
            code={`${tone.syllable} · ${tone.label}`}
            help={tone.motion}
            marker={tone.mark}
            value={roomName}
            tone
          />
        </div>
      </section>

      <section className="border-t border-line p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="m-0 text-xs font-bold uppercase tracking-wide">Props</h2>
          <span className="font-hanzi text-sm font-semibold text-accent">{item.movie.components.map((component) => component.hanzi).join(' + ')}</span>
        </div>
        <div className="grid gap-4">
          {props.map((prop, index) => (
            <PropField
              key={prop.hanzi}
              invalid={showValidation && !prop.propName.trim()}
              locked={Boolean(item.movie.components[index]?.propName.trim())}
              prop={prop}
              onChange={(value) => setProps((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, propName: value } : entry))}
            />
          ))}
        </div>
      </section>

      {!item.movie.isPrimitive ? (
        <section className="border-t border-line p-5">
          <h2 className="m-0 mb-2 text-xs font-bold uppercase tracking-wide">One short scene</h2>
          <p className="m-0 text-sm leading-relaxed text-muted">
            <strong className="text-ink">{actorName || 'The actor'}</strong> in <strong className="text-ink">{roomName} · {setName || 'the set'}</strong> uses{' '}
            <strong className="text-ink">{props.map((prop) => prop.propName || prop.hanzi).join(' and ')}</strong> to show “<strong className="text-ink">{meaning.primary}</strong>”.
          </p>
        </section>
      ) : null}

      <WritingPad character={item.hanzi} />

      <footer className="border-t border-line p-5">
        <Button
          className="w-full sm:w-auto"
          type="button"
          disabled={finishMutation.isPending}
          onClick={() => { if (mappingsReady) finishMutation.mutate(); else setShowValidation(true) }}
        >
          <Check size={16} />
          {finishMutation.isPending ? 'Saving…' : 'Mark as learned'}
        </Button>
      </footer>
      {showValidation && !mappingsReady ? <ErrorNote>Fill in only the new, empty links.</ErrorNote> : null}
      {finishMutation.isError ? <ErrorNote>Could not save this character. Try again.</ErrorNote> : null}
    </Card>
  )
}

function CoordinateField({ code, help, invalid = false, marker, onChange, placeholder, tone = false, value }: {
  code: string
  help: string
  invalid?: boolean
  marker: ReactNode
  onChange?: (value: string) => void
  placeholder?: string
  tone?: boolean
  value: string
}) {
  return (
    <div className={`grid grid-cols-[32px_1fr] items-center gap-3 ${invalid ? 'text-danger' : ''}`}>
      <span className={`text-center text-lg font-bold ${tone ? 'text-danger' : 'text-accent'}`}>{marker}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <small className="overflow-hidden text-[9px] font-bold tracking-[.06em] text-faint uppercase text-ellipsis whitespace-nowrap">{code}</small>
        {onChange ? (
          <input
            className="min-w-0 border-0 border-b border-line bg-transparent py-1 text-sm font-semibold focus:border-accent"
            aria-invalid={invalid}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
          />
        ) : <strong className="overflow-hidden text-sm text-ellipsis whitespace-nowrap">{value}</strong>}
        <small className="overflow-hidden text-[10px] text-muted text-ellipsis whitespace-nowrap">{help}</small>
      </span>
    </div>
  )
}

function PropField({ invalid, locked, onChange, prop }: { invalid: boolean; locked: boolean; onChange: (value: string) => void; prop: MovieProp }) {
  return (
    <div className={`grid grid-cols-[44px_1fr] items-center gap-3 ${invalid ? 'text-danger' : ''}`}>
      <span className="font-hanzi text-3xl leading-none font-semibold" lang="zh-CN">{prop.hanzi}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        {locked ? <strong className="overflow-hidden text-sm text-ellipsis whitespace-nowrap">{prop.propName}</strong> : (
          <input
            className="min-w-0 border-0 border-b border-line bg-transparent py-1 text-sm font-semibold focus:border-accent"
            aria-invalid={invalid}
            value={prop.propName}
            onChange={(event) => onChange(event.target.value)}
            placeholder="One permanent image"
          />
        )}
        {prop.character
          ? <small className="overflow-hidden text-[10px] text-muted text-ellipsis whitespace-nowrap">{prop.character.pinyin} · {splitMeaning(prop.character.meaning).primary}</small>
          : <small className="text-[10px] text-muted">component</small>}
      </span>
    </div>
  )
}
