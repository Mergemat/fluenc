import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { splitMeaning } from '../lib/meaning'
import { getToneDetail } from '../lib/tones'
import { enrollItem, saveMovie, type BuildItem } from '../server/curriculum'
import { MandarinAudioButton } from './MandarinAudioButton'
import { NeutralToneBadge } from './NeutralToneHint'
import { WritingPad } from './WritingPad'
import { Button } from './ui/Button'
import { ErrorNote } from './ui/Layout'

type CharacterItem = Extract<BuildItem, { type: 'character' }>

export function CharacterStudio({ item }: { item: CharacterItem }) {
  const queryClient = useQueryClient()
  const meaning = splitMeaning(item.meaning)
  const tone = getToneDetail(item.movie.tone)
  const [actorName, setActorName] = useState(item.movie.actorName)
  const [setName, setSetName] = useState(item.movie.setName)
  const [roomName, setRoomName] = useState(item.movie.roomName)
  const [props, setProps] = useState(item.movie.components)
  const [showValidation, setShowValidation] = useState(false)
  const [writeOpen, setWriteOpen] = useState(false)
  const [mobilePane, setMobilePane] = useState<'character' | 'movie'>('character')
  const mappingsReady = Boolean(actorName.trim() && setName.trim() && roomName.trim() && props.every((prop) => prop.propName.trim()))

  const finishMutation = useMutation({
    mutationFn: async () => {
      await saveMovie({ data: { characterId: item.id, actorKey: item.movie.actorKey, actorName, finalKey: item.movie.finalKey, setName, tone: item.movie.tone, roomName, props: props.map((prop) => ({ component: prop.hanzi, propName: prop.propName })) } })
      return enrollItem({ data: { itemType: 'character', itemId: item.id } })
    },
    onSuccess: async () => {
      setShowValidation(false)
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  return (
    <article className="grid h-[calc(100dvh-143px)] grid-rows-[44px_minmax(0,1fr)] gap-3 overflow-hidden md:h-[calc(100dvh-48px)] md:grid-cols-[minmax(0,1fr)_340px] md:grid-rows-1 md:gap-5 lg:grid-cols-[minmax(0,1fr)_370px] lg:gap-8">
      <div className="grid grid-cols-2 rounded-xl border border-line bg-paper p-1 md:hidden" aria-label="Character workshop section">
        <button className={`rounded-lg py-2 text-xs font-black ${mobilePane === 'character' ? 'bg-ink text-paper' : 'text-muted'}`} type="button" onClick={() => setMobilePane('character')}>Character</button>
        <button className={`rounded-lg py-2 text-xs font-black ${mobilePane === 'movie' ? 'bg-ink text-paper' : 'text-muted'}`} type="button" onClick={() => setMobilePane('movie')}>Build movie</button>
      </div>

      <section className={`study-card min-h-0 overflow-hidden ${mobilePane === 'character' ? 'flex flex-col' : 'hidden'} md:flex md:flex-col`}>
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-3"><span className="study-label">Character {item.rank}</span><span className="rounded-md bg-canvas px-2 py-1 text-[10px] font-bold text-muted">NEW</span></div>
          <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs font-bold text-muted hover:border-ink hover:text-ink" type="button" onClick={() => setWriteOpen(true)}><Pencil size={14} /> Write</button>
        </header>

        <div className="grid min-h-0 flex-1 place-items-center px-6 py-4 md:py-8">
          <div className="grid justify-items-center text-center">
            <div className="relative">
              <span className="font-hanzi text-[clamp(7rem,17vh,12rem)] font-semibold leading-none text-glaze md:text-[clamp(9rem,22vh,13rem)]" lang="zh-CN">{item.hanzi}</span>
              <MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} className="absolute -right-6 top-0 border-line bg-paper" />
            </div>
            <div className="mt-5 flex items-center gap-2"><strong className="text-3xl font-black tracking-[-0.04em]">{item.pinyin}</strong><NeutralToneBadge text={item.hanzi} pinyin={item.pinyin} /></div>
            <p className="m-0 mt-1 text-base font-bold text-muted">{meaning.primary}</p>
          </div>
        </div>

        <footer className="grid gap-3 border-t border-line bg-canvas/55 px-4 py-3 sm:px-5">
          <section>
            <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-faint">Props</p>
            <div className="mt-1.5 flex gap-2">
              {props.map((prop) => <Cue key={prop.hanzi} glyph={prop.hanzi} value={prop.propName} fallback="Unnamed" />)}
            </div>
          </section>
          <section className="grid grid-cols-3 overflow-hidden rounded-lg border border-line bg-paper">
            <Cue grouped glyph={item.movie.actorKey} value={actorName} fallback="Actor" />
            <Cue grouped glyph={item.movie.finalKey} value={setName} fallback="Set" />
            <Cue grouped glyph={tone.mark} value={roomName} fallback={tone.label} />
          </section>
        </footer>
      </section>

      <aside className={`study-card min-h-0 overflow-hidden ${mobilePane === 'movie' ? 'flex flex-col' : 'hidden'} md:flex md:flex-col`}>
        <header className="border-b border-line px-5 py-4"><p className="study-label m-0">Build the movie</p><p className="mb-0 mt-1 text-sm leading-relaxed text-muted">Place the sound and props in one scene.</p></header>
        <div className="grid min-h-0 flex-1 content-center gap-4 p-4 md:gap-5 md:p-5">
          <FieldGroup number="01" title="Sound location">
            <MappingField hideLabel glyph={item.movie.actorKey} label="Actor" locked={Boolean(item.movie.actorName.trim())} value={actorName} onChange={setActorName} invalid={showValidation && !actorName.trim()} />
            <MappingField hideLabel glyph={item.movie.finalKey} label="Set" locked={Boolean(item.movie.setName.trim())} value={setName} onChange={setSetName} invalid={showValidation && !setName.trim()} />
            <MappingField hideLabel glyph={tone.mark} label="Room" value={roomName} onChange={setRoomName} invalid={showValidation && !roomName.trim()} />
          </FieldGroup>
          <FieldGroup number="02" title="Scene props">
            {props.map((prop, index) => <MappingField glyph={prop.hanzi} invalid={showValidation && !prop.propName.trim()} key={prop.hanzi} label="Prop" locked={Boolean(item.movie.components[index]?.propName.trim())} value={prop.propName} onChange={(value) => setProps((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, propName: value } : entry))} />)}
          </FieldGroup>
        </div>
        <footer className="shrink-0 border-t border-line p-4 md:p-5">
          <Button type="button" disabled={finishMutation.isPending} onClick={() => mappingsReady ? finishMutation.mutate() : setShowValidation(true)}><Check size={16} /> {finishMutation.isPending ? 'Saving…' : 'Add to review'}</Button>
          {showValidation && !mappingsReady ? <div className="mt-3"><ErrorNote>Complete each empty mapping.</ErrorNote></div> : null}
          {finishMutation.isError ? <div className="mt-3"><ErrorNote>Could not save this character. Try again.</ErrorNote></div> : null}
        </footer>
      </aside>
      {writeOpen ? <WritingModal character={item.hanzi} onClose={() => setWriteOpen(false)} /> : null}
    </article>
  )
}

function Cue({ fallback, glyph, grouped = false, value }: { fallback: string; glyph: string; grouped?: boolean; value: string }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 px-2.5 py-2 ${grouped ? 'border-r border-line last:border-r-0' : 'rounded-lg border border-line bg-paper'}`}>
      <strong className="shrink-0 font-hanzi text-xl leading-none text-glaze" lang="zh-CN">{glyph}</strong>
      <span className="min-w-0">
        <span className={`block truncate text-[10px] font-bold ${value.trim() ? 'text-ink' : 'text-faint'}`}>{value.trim() || fallback}</span>
      </span>
    </div>
  )
}

function FieldGroup({ children, number, title }: { children: ReactNode; number: string; title: string }) {
  return <section><div className="mb-3 flex items-center gap-2"><span className="font-mono text-[10px] font-bold text-glaze">{number}</span><h2 className="m-0 text-sm font-black">{title}</h2></div><div className="grid gap-2">{children}</div></section>
}

function MappingField({ glyph, hideLabel = false, invalid = false, label, locked = false, onChange, value }: { glyph: string; hideLabel?: boolean; invalid?: boolean; label: string; locked?: boolean; onChange?: (value: string) => void; value: string }) {
  return (
    <label className={`grid grid-cols-[44px_1fr] items-center overflow-hidden rounded-xl border bg-canvas/45 ${invalid ? 'border-danger' : 'border-line'} focus-within:border-ink`}>
      <span className="grid h-12 place-items-center border-r border-line font-hanzi text-xl font-bold text-glaze" lang="zh-CN">{glyph}</span>
      <span className="relative h-12">{hideLabel ? null : <span className="pointer-events-none absolute left-3 top-1.5 text-[9px] font-bold uppercase tracking-wider text-faint">{label}</span>}{locked ? <strong className={`flex h-full px-3 text-sm ${hideLabel ? 'items-center' : 'items-end pb-1.5'}`}>{value}</strong> : <input aria-label={`${label} for ${glyph}`} className={`h-full w-full bg-transparent px-3 text-sm font-bold ${hideLabel ? '' : 'pb-1 pt-4'}`} placeholder="Name it" value={value} onChange={(event) => onChange?.(event.target.value)} />}</span>
    </label>
  )
}

function WritingModal({ character, onClose }: { character: string; onClose: () => void }) {
  return <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/55 p-5 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="w-full max-w-sm rounded-2xl border border-line bg-paper p-5" role="dialog" aria-modal="true" aria-label={`Write ${character}`}><div className="mb-4 flex items-center justify-between"><div><span className="study-label block">Writing drill</span><strong className="font-hanzi text-2xl text-glaze" lang="zh-CN">{character}</strong></div><Button variant="icon" type="button" onClick={onClose} aria-label="Close"><X size={17} /></Button></div><WritingPad character={character} /></section></div>
}
