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
        title="Initial → actor"
        items={palace.actors}
        emptyLabel="No actors yet"
        emptyHint="Your first initial assigns one."
      />
      <Residents
        title="Final → set"
        items={palace.sets}
        emptyLabel="No sets yet"
        emptyHint="Your first final assigns one."
      />
      <Props items={palace.props} />
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="m-0 mb-3.5 text-sm font-black tracking-tight text-ink">{children}</h2>
}

/* The tone floor: five chambers under one roof. The only part of the palace
   that exists from day one, so it carries the screen. */
function ToneFloor({ rooms }: { rooms: PalaceData['rooms'] }) {
  return (
    <section>
      <SectionTitle>Tone → room</SectionTitle>
      <div className="study-card grid grid-cols-5 gap-px overflow-hidden bg-line p-0">
        {rooms.map((room) => {
          const tone = getToneDetail(room.tone)
          return (
            <div
              className="flex min-w-0 flex-col items-center gap-0.5 bg-paper px-1 py-4"
              key={room.tone}
            >
              <strong className="text-[21px] leading-none font-semibold text-glaze">{tone.syllable}</strong>
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

/* A wing of the palace: assigned mappings as plaques, or a designed empty
   room waiting to be filled — never a bare sentence in the void. */
function Residents({ emptyHint, emptyLabel, items, title }: {
  emptyHint: string
  emptyLabel: string
  items: MappingItem[]
  title: string
}) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      {items.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <div
              className="study-card grid grid-cols-[56px_1fr] items-baseline px-4 py-3"
              key={item.key}
            >
              <dt className="text-sm font-medium text-glaze">{item.key}</dt>
              <dd className="m-0 min-w-0 truncate text-sm">{item.name}</dd>
            </div>
          ))}
        </div>
      ) : (
        <div className="study-card grid justify-items-center gap-2 px-4 py-8 text-center">
          <span className="grid size-10 place-items-center rounded-lg border border-line bg-canvas text-xl font-light text-faint">+</span>
          <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-faint">{emptyLabel}</p>
          <p className="m-0 text-xs text-muted">{emptyHint}</p>
        </div>
      )}
    </section>
  )
}

function Props({ items }: { items: PalaceData['props'] }) {
  return (
    <section>
      <SectionTitle>Component → prop</SectionTitle>
      {items.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((item) => (
            <div
              className="study-card flex items-center gap-3 px-3.5 py-2.5"
              key={item.key}
            >
              <b className="font-hanzi text-2xl leading-none font-semibold text-glaze" lang="zh-CN">{item.key}</b>
              <span className="min-w-0 truncate text-xs">{item.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="study-card grid justify-items-center gap-2 px-4 py-8 text-center">
          <span className="grid size-10 place-items-center rounded-lg border border-line bg-canvas text-xl font-light text-faint">+</span>
          <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-faint">No props yet</p>
          <p className="m-0 text-xs text-muted">They appear after your first scene.</p>
        </div>
      )}
    </section>
  )
}
