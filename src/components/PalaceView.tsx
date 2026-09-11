import { useQuery } from '@tanstack/react-query'

import { getToneDetail } from '../lib/tones'
import { getOfflinePalace } from '../offline/progress'
import type { PalaceData } from '../server/curriculum'
import { ToneAudioButton } from './ToneAudioButton'
import { Button } from './ui/Button'
import { Page, PageHeader, Status } from './ui/Layout'

type MappingItem = { key: string; name: string }

export function PalaceView() {
  const palaceQuery = useQuery({ queryKey: ['palace'], queryFn: () => getOfflinePalace() })
  const palace = palaceQuery.data

  return (
    <Page>
      <PageHeader title="Palace" meta="Your pronunciation code" />

      {palaceQuery.isPending ? (
        <Status title="Loading…" />
      ) : palaceQuery.isError ? (
        <Status title="Could not load the palace" action={<Button variant="secondary" type="button" onClick={() => palaceQuery.refetch()}>Retry</Button>} />
      ) : palace ? <PalaceContent palace={palace} /> : null}
    </Page>
  )
}

function PalaceContent({ palace }: { palace: PalaceData }) {
  return (
    <div className="grid gap-9">
      <ToneFloor rooms={palace.rooms} />
      <Residents
        title="Actors"
        kind="actor"
        items={palace.actors}
        emptyLabel="No actors yet"
        emptyHint="Your first initial assigns one."
      />
      <Residents
        title="Sets"
        kind="set"
        items={palace.sets}
        emptyLabel="No sets yet"
        emptyHint="Your first final assigns one."
      />
      <Props items={palace.props} />
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="m-0 mb-3.5 text-sm font-semibold tracking-tight text-ink">{children}</h2>
}

function ToneFloor({ rooms }: { rooms: PalaceData['rooms'] }) {
  return (
    <section>
      <SectionTitle>Tone rooms</SectionTitle>
      <div className="tone-rooms">
        {rooms.map((room) => {
          const tone = getToneDetail(room.tone)
          return (
            <div
              className="tone-room"
              key={room.tone}
            >
              <strong className="text-[21px] leading-none font-semibold text-[#337465]">{tone.syllable}</strong>
              <span className="text-[11px] leading-none text-faint" aria-label={`Tone: ${tone.label}`}>{tone.contour}</span>
              <span className="mt-1.5 line-clamp-2 min-h-[1.9rem] text-center text-[10.5px] leading-tight text-muted">{room.name}</span>
              <ToneAudioButton pinyin={tone.syllable} label={null} />
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Residents({ emptyHint, emptyLabel, items, title, kind }: {
  kind: 'actor' | 'set'
  emptyHint: string
  emptyLabel: string
  items: MappingItem[]
  title: string
}) {
  return (
    <section className={`palace-section palace-${kind}`}>
      <SectionTitle>{title}</SectionTitle>
      {items.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <dl
              className="palace-mapping"
              key={item.key}
            >
              <dt className="text-sm font-medium text-[#337465]">{item.key}</dt>
              <dd className="m-0 min-w-0 text-sm">{item.name}</dd>
            </dl>
          ))}
        </div>
      ) : (
        <div className="palace-empty">
          <p className="m-0 text-sm text-muted">{emptyLabel}</p>
          <p className="m-0 text-xs text-muted">{emptyHint}</p>
        </div>
      )}
    </section>
  )
}

function Props({ items }: { items: PalaceData['props'] }) {
  return (
    <section>
      <SectionTitle>Props</SectionTitle>
      {items.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((item) => (
            <div
              className="palace-prop"
              key={item.key}
            >
              <b className="font-hanzi text-2xl leading-none" lang="zh-CN">{item.key}</b>
              <span className="min-w-0 text-xs [overflow-wrap:anywhere]">{item.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="palace-empty">
          <p className="m-0 text-sm text-muted">No props yet</p>
          <p className="m-0 text-xs text-muted">They appear after your first scene.</p>
        </div>
      )}
    </section>
  )
}
