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
    <div>
      <ToneRooms rooms={palace.rooms} />

      <div className="mt-10 grid gap-10 md:grid-cols-2">
        <MappingList items={palace.actors} title="Initial → actor" empty="An actor appears with your first new initial." />
        <MappingList items={palace.sets} title="Final → set" empty="A set appears with your first new final." />
      </div>

      <PropList items={palace.props} />
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="m-0 mb-4 text-[11px] font-semibold uppercase tracking-[.16em] text-faint">{children}</h2>
}

function ToneRooms({ rooms }: { rooms: PalaceData['rooms'] }) {
  return (
    <section>
      <SectionTitle>Tone → room</SectionTitle>
      <div className="grid grid-cols-5 gap-3">
        {rooms.map((room) => {
          const tone = getToneDetail(room.tone)
          return (
            <div className="flex min-w-0 flex-col gap-1" key={room.tone}>
              <strong className="text-xl leading-none font-semibold">{tone.syllable}</strong>
              <span className="overflow-hidden text-xs text-muted text-ellipsis whitespace-nowrap">{room.name}</span>
              <ToneAudioButton pinyin={tone.syllable} label={null} />
            </div>
          )
        })}
      </div>
    </section>
  )
}

function MappingList({ empty, items, title }: { empty: string; items: MappingItem[]; title: string }) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      {items.length ? (
        <dl className="m-0 border-t border-line">
          {items.map((item) => (
            <div className="grid grid-cols-[64px_1fr] items-baseline border-b border-line py-2.5" key={item.key}>
              <dt className="text-xs font-medium">{item.key}</dt>
              <dd className="m-0 overflow-hidden text-xs text-ellipsis whitespace-nowrap">{item.name}</dd>
            </div>
          ))}
        </dl>
      ) : <p className="m-0 text-xs text-muted">{empty}</p>}
    </section>
  )
}

function PropList({ items }: { items: PalaceData['props'] }) {
  return (
    <section className="mt-10">
      <SectionTitle>Component → prop</SectionTitle>
      {items.length ? (
        <div className="grid grid-cols-2 gap-x-6 border-t border-line sm:grid-cols-3">
          {items.map((item) => (
            <div className="flex items-center gap-2.5 border-b border-line py-2.5" key={item.key}>
              <b className="font-hanzi text-xl leading-none font-semibold" lang="zh-CN">{item.key}</b>
              <span className="overflow-hidden text-xs text-ellipsis whitespace-nowrap">{item.name}</span>
            </div>
          ))}
        </div>
      ) : <p className="m-0 text-xs text-muted">Props appear after your first scene.</p>}
    </section>
  )
}
