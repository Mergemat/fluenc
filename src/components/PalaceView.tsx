import { useQuery } from '@tanstack/react-query'

import { getToneDetail } from '../lib/tones'
import { getPalace, type PalaceData } from '../server/curriculum'
import { ToneAudioButton } from './ToneAudioButton'
import { Button } from './ui/Button'
import { Page, PageHeader, Status } from './ui/Layout'

type MappingItem = { key: string; name: string }

export function PalaceView() {
  const palaceQuery = useQuery({ queryKey: ['palace'], queryFn: () => getPalace() })
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
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 grid select-none place-items-center font-hanzi text-[75vw] leading-none font-semibold text-glaze/5"
        lang="zh-CN"
      >
        宫
      </span>

      <div className="relative grid gap-9">
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
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="m-0 mb-3.5 text-[11px] font-semibold uppercase tracking-[.16em] text-faint">{children}</h2>
}

/* The tone floor: five chambers under one roof. The only part of the palace
   that exists from day one, so it carries the screen. */
function ToneFloor({ rooms }: { rooms: PalaceData['rooms'] }) {
  return (
    <section>
      <SectionTitle>Tone → room</SectionTitle>
      <div
        className="grid grid-cols-5 gap-1.5 rounded-[2rem] p-2"
        style={{
          background: 'linear-gradient(165deg, #ffffff 0%, #f4f8f5 65%, #e9f1ec 100%)',
          boxShadow: '0 16px 36px rgb(43 58 66 / 0.14), 0 2px 6px rgb(43 58 66 / 0.05), inset 0 1px 0 #fff',
        }}
      >
        {rooms.map((room) => {
          const tone = getToneDetail(room.tone)
          return (
            <div
              className="flex min-w-0 flex-col items-center gap-0.5 rounded-2xl px-1 py-3"
              style={{ background: 'linear-gradient(180deg, #f7faf8 0%, #e9f1ec 100%)' }}
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
              className="grid grid-cols-[56px_1fr] items-baseline rounded-2xl bg-white/60 px-4 py-3 shadow-[0_2px_10px_rgb(43_58_66/0.06)]"
              key={item.key}
            >
              <dt className="text-sm font-medium text-glaze">{item.key}</dt>
              <dd className="m-0 min-w-0 truncate text-sm">{item.name}</dd>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid justify-items-center gap-2 rounded-[1.6rem] bg-white/35 px-4 py-8 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-canvas text-xl font-light text-faint">+</span>
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
              className="flex items-center gap-3 rounded-2xl bg-white/60 px-3.5 py-2.5 shadow-[0_2px_10px_rgb(43_58_66/0.06)]"
              key={item.key}
            >
              <b className="font-hanzi text-2xl leading-none font-semibold text-glaze" lang="zh-CN">{item.key}</b>
              <span className="min-w-0 truncate text-xs">{item.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid justify-items-center gap-2 rounded-[1.6rem] bg-white/35 px-4 py-8 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-canvas text-xl font-light text-faint">+</span>
          <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-faint">No props yet</p>
          <p className="m-0 text-xs text-muted">They appear after your first scene.</p>
        </div>
      )}
    </section>
  )
}
