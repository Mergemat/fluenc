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
import { Eyebrow } from './ui/Eyebrow'
import { StudioCard } from './ui/StudioCard'

type CharacterItem = Extract<BuildItem, { type: 'character' }>
type MovieProp = CharacterItem['movie']['components'][number]

const categoryNames = {
  male: 'мужской актёр',
  female: 'женский актёр',
  fictional: 'вымышленный герой',
  wildcard: 'wildcard-персонаж',
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
    <StudioCard>
      <header className="px-7 pt-6 pb-5 max-[720px]:px-4">
        <Eyebrow>{item.movie.isPrimitive ? 'Базовый компонент' : 'Новый иероглиф'} · #{item.rank}</Eyebrow>
        <div className="mt-3 flex items-center gap-5">
          <MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} />
          <span className="font-hanzi text-[88px] font-semibold leading-[.84] tracking-[-.08em] max-[720px]:text-[68px]" lang="zh-CN">{item.hanzi}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <strong className="text-lg text-jade">{item.pinyin}</strong>
              <NeutralToneBadge text={item.hanzi} pinyin={item.pinyin} />
            </div>
            <span className="mt-1 block text-[26px] font-semibold leading-[1.1] tracking-[-.025em] text-ink" lang="en">{meaning.primary}</span>
            <NeutralToneExample text={item.hanzi} pinyin={item.pinyin} />
          </div>
        </div>
      </header>

      <section className="border-t border-line px-7 py-5 max-[720px]:px-4">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="m-0 text-xs font-bold">Координаты</h2>
          <small className="text-[9px] text-muted">новую связь выбираете один раз</small>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line max-[720px]:grid-cols-1 max-[720px]:divide-x-0 max-[720px]:divide-y">
          <CoordinateField
            code={`Initial · ${item.movie.actorKey}`}
            help={categoryNames[item.movie.actorCategory]}
            invalid={showValidation && !actorName.trim()}
            marker="A"
            onChange={actorLocked ? undefined : setActorName}
            placeholder="Выберите актёра"
            value={actorName}
          />
          <CoordinateField
            code={`Final · ${item.movie.finalKey}`}
            help="знакомое место"
            invalid={showValidation && !setName.trim()}
            marker="S"
            onChange={setLocked ? undefined : setSetName}
            placeholder="Выберите место"
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

      <section className="border-t border-line px-7 py-5 max-[720px]:px-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="m-0 text-xs font-bold">Реквизит</h2>
          <span className="font-hanzi text-sm font-semibold text-jade">{item.movie.components.map((component) => component.hanzi).join(' + ')}</span>
        </div>
        <div className={`grid gap-x-8 gap-y-3 ${props.length > 1 ? 'grid-cols-2 max-[720px]:grid-cols-1' : 'grid-cols-1'}`}>
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
        <section className="mx-7 my-4 border-l-2 border-jade pl-4 max-[720px]:mx-4">
          <Eyebrow>Один короткий кадр</Eyebrow>
          <p className="mt-1 mb-0 text-[13px] leading-[1.65] text-muted">
            <strong className="text-ink">{actorName || 'Актёр'}</strong> в месте <strong className="text-ink">{roomName} · {setName || 'сет'}</strong> использует <strong className="text-ink">{props.map((prop) => prop.propName || prop.hanzi).join(' и ')}</strong>, чтобы показать «<strong className="text-ink">{meaning.primary}</strong>».
          </p>
        </section>
      ) : null}

      <WritingPad character={item.hanzi} />

      <footer className="flex justify-end border-t border-line px-7 py-5 max-[720px]:px-4">
        <Button type="button" disabled={finishMutation.isPending} onClick={() => { if (mappingsReady) finishMutation.mutate(); else setShowValidation(true) }}>
          <Check size={17} />
          {finishMutation.isPending ? 'Сохраняю…' : 'Иероглиф изучен'}
        </Button>
      </footer>
      {showValidation && !mappingsReady ? <BuildError>Заполните только новые пустые связи.</BuildError> : null}
      {finishMutation.isError ? <BuildError>Не удалось сохранить иероглиф. Попробуйте ещё раз.</BuildError> : null}
    </StudioCard>
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
    <div className={`grid min-w-0 grid-cols-[28px_1fr] items-center gap-2.5 px-4 py-1 first:pl-0 last:pr-0 max-[720px]:px-0 max-[720px]:py-3 ${invalid ? 'text-fluenc-red' : ''}`}>
      <span className={`text-center text-base font-extrabold ${tone ? 'text-fluenc-red' : 'text-jade'}`}>{marker}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <small className="overflow-hidden text-[8px] font-bold tracking-[.06em] text-ellipsis whitespace-nowrap text-muted uppercase">{code}</small>
        {onChange ? (
          <input
            className="min-w-0 border-0 border-b border-line bg-transparent py-0.5 text-xs font-semibold text-ink outline-0 focus:border-jade"
            aria-invalid={invalid}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
          />
        ) : <strong className="overflow-hidden text-xs text-ellipsis whitespace-nowrap">{value}</strong>}
        <small className="overflow-hidden text-[8px] text-ellipsis whitespace-nowrap text-muted">{help}</small>
      </span>
    </div>
  )
}

function PropField({ invalid, locked, onChange, prop }: { invalid: boolean; locked: boolean; onChange: (value: string) => void; prop: MovieProp }) {
  return (
    <div className={`grid min-w-0 grid-cols-[42px_1fr] items-center gap-3 border-b border-line pb-3 ${invalid ? 'text-fluenc-red' : ''}`}>
      <span className="font-hanzi text-[30px] font-semibold leading-none text-ink" lang="zh-CN">{prop.hanzi}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        {locked ? <strong className="overflow-hidden text-xs text-ellipsis whitespace-nowrap">{prop.propName}</strong> : (
          <input
            className="min-w-0 border-0 border-b border-line bg-transparent py-0.5 text-xs font-semibold text-ink outline-0 focus:border-jade"
            aria-invalid={invalid}
            value={prop.propName}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Один постоянный образ"
          />
        )}
        {prop.character ? <small className="overflow-hidden text-[8px] text-ellipsis whitespace-nowrap text-muted">{prop.character.pinyin} · {splitMeaning(prop.character.meaning).primary}</small> : <small className="text-[8px] text-muted">компонент</small>}
      </span>
    </div>
  )
}

function BuildError({ children }: { children: ReactNode }) {
  return <p className="m-0 bg-[#fae8e4] px-6 py-2.5 text-xs text-[#9f3528] max-[720px]:px-4" role="alert">{children}</p>
}
