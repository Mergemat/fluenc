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
    <Page width="wide">
      <PageHeader
        title="Palace"
        meta="Your permanent pronunciation code and scene props"
      />

      {palaceQuery.isPending ? (
        <Status title="Loading the palace…" />
      ) : palaceQuery.isError ? (
        <Status title="Could not load the palace" action={<Button variant="secondary" type="button" onClick={() => palaceQuery.refetch()}>Retry</Button>} />
      ) : palace ? <PalaceContent palace={palace} /> : null}
    </Page>
  )
}

function PalaceContent({ palace }: { palace: PalaceData }) {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-line bg-paper px-5 py-4 text-lg font-semibold tracking-tight">
        <span className="text-muted">initial</span> → actor
        <span className="mx-2 font-normal text-faint">+</span>
        <span className="text-muted">final</span> → set
        <span className="mx-2 font-normal text-faint">+</span>
        <span className="text-muted">tone</span> → room
      </section>

      <ToneRooms rooms={palace.rooms} />

      <div className="grid gap-8 md:grid-cols-2">
        <MappingList eyebrow="Initial → person" title="Actors" items={palace.actors} empty="An actor appears with your first new initial." />
        <MappingList eyebrow="Final → building" title="Sets" items={palace.sets} empty="A set appears with your first new final." />
      </div>

      <PropList items={palace.props} />
    </div>
  )
}

function ToneRooms({ rooms }: { rooms: PalaceData['rooms'] }) {
  return (
    <section>
      <h2 className="m-0 mb-3 text-xs font-bold uppercase tracking-wide">Rooms · tone → zone</h2>
      <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-5">
        {rooms.map((room) => {
          const tone = getToneDetail(room.tone)
          return (
            <article className="flex items-center gap-3 bg-paper px-4 py-3.5 sm:flex-col sm:items-start sm:gap-1" key={room.tone}>
              <strong className="text-2xl leading-none font-semibold text-accent">{tone.syllable}</strong>
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">{room.name}</span>
              <ToneAudioButton pinyin={tone.syllable} label={null} />
            </article>
          )
        })}
      </div>
    </section>
  )
}

function MappingList({ empty, eyebrow, items, title }: { empty: string; eyebrow: string; items: MappingItem[]; title: string }) {
  return (
    <section>
      <p className="m-0 mb-1 text-[9px] font-bold tracking-[.1em] text-faint uppercase">{eyebrow}</p>
      <h2 className="m-0 mb-3 text-xs font-bold uppercase tracking-wide">{title}</h2>
      {items.length ? (
        <dl className="m-0 border-t border-line">
          {items.map((item) => (
            <div className="grid grid-cols-[70px_1fr] items-baseline border-b border-line py-2.5" key={item.key}>
              <dt className="text-xs font-bold text-accent">{item.key}</dt>
              <dd className="m-0 overflow-hidden text-xs font-semibold text-ellipsis whitespace-nowrap">{item.name}</dd>
            </div>
          ))}
        </dl>
      ) : <p className="text-xs text-muted">{empty}</p>}
    </section>
  )
}

function PropList({ items }: { items: PalaceData['props'] }) {
  return (
    <section>
      <p className="m-0 mb-1 text-[9px] font-bold tracking-[.1em] text-faint uppercase">Component → object</p>
      <h2 className="m-0 mb-3 text-xs font-bold uppercase tracking-wide">Props</h2>
      {items.length ? (
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div className="flex items-center gap-2.5 bg-paper px-4 py-3" key={item.key}>
              <b className="font-hanzi text-xl leading-none font-semibold" lang="zh-CN">{item.key}</b>
              <span className="overflow-hidden text-xs font-semibold text-ellipsis whitespace-nowrap">{item.name}</span>
            </div>
          ))}
        </div>
      ) : <p className="text-xs text-muted">Props appear after your first scene.</p>}
    </section>
  )
}
