import { useQuery } from '@tanstack/react-query'

import { getToneDetail } from '../lib/tones'
import { getPalace, type PalaceData } from '../server/curriculum'
import { ToneAudioButton } from './ToneAudioButton'
import { Button } from './ui/Button'
import { CollectionFrame, CollectionHeader, ViewStatus } from './ui/CollectionFrame'

type MappingItem = { key: string; name: string }

export function PalaceView() {
  const palaceQuery = useQuery({ queryKey: ['palace'], queryFn: () => getPalace() })
  const palace = palaceQuery.data

  return (
    <CollectionFrame>
      <CollectionHeader
        eyebrow="Hanzi Movie Method"
        title="Дворец"
        description="Постоянный код произношения и реквизит для сцен. Связь выбирается один раз и используется снова."
      />

      {palaceQuery.isPending ? (
        <ViewStatus><p>Загружаю дворец…</p></ViewStatus>
      ) : palaceQuery.isError ? (
        <ViewStatus><p>Не удалось загрузить дворец</p><Button variant="secondary" type="button" onClick={() => palaceQuery.refetch()}>Повторить</Button></ViewStatus>
      ) : palace ? <PalaceContent palace={palace} /> : null}
    </CollectionFrame>
  )
}

function PalaceContent({ palace }: { palace: PalaceData }) {
  return (
    <div className="space-y-10">
      <section>
        <p className="mb-3 text-[9px] font-bold tracking-[.1em] text-jade uppercase">Адрес сцены</p>
        <div className="flex items-baseline gap-3 border-y border-line py-5 text-[clamp(20px,4vw,36px)] font-semibold tracking-[-.04em] max-[620px]:flex-wrap">
          <span>initial → актёр</span><i className="font-normal text-line">+</i><span>final → место</span><i className="font-normal text-line">+</i><span>тон → комната</span>
        </div>
      </section>

      <ToneRooms rooms={palace.rooms} />

      <div className="grid grid-cols-2 gap-10 max-[720px]:grid-cols-1">
        <MappingList eyebrow="Initial → человек" items={palace.actors} title="Актёры" empty="Актёр появится при первом новом initial." />
        <MappingList eyebrow="Final → здание" items={palace.sets} title="Места" empty="Место появится при первом новом final." />
      </div>

      <PropList items={palace.props} />
    </div>
  )
}

function ToneRooms({ rooms }: { rooms: PalaceData['rooms'] }) {
  return (
    <section>
      <header className="mb-4">
        <p className="mb-1 text-[9px] font-bold tracking-[.1em] text-fluenc-red uppercase">Тон → зона места</p>
        <h2 className="m-0 text-xl tracking-[-.035em]">Комнаты</h2>
      </header>
      <div className="grid grid-cols-5 border-y border-line max-[800px]:grid-cols-1 max-[800px]:divide-y max-[800px]:divide-line">
        {rooms.map((room) => {
          const tone = getToneDetail(room.tone)
          return (
            <article className="grid min-w-0 justify-items-center gap-1 border-l border-line px-2 py-5 first:border-0 max-[800px]:grid-cols-[80px_1fr_38px] max-[800px]:items-center max-[800px]:justify-items-start max-[800px]:border-l-0 max-[800px]:py-3" key={room.tone}>
              <strong className="text-[32px] leading-none tracking-[-.05em] text-jade">{tone.syllable}</strong>
              <span className="overflow-hidden text-center text-[10px] font-semibold text-ellipsis whitespace-nowrap max-[800px]:text-left">{room.name}</span>
              <ToneAudioButton className="mt-2 size-8 max-[800px]:mt-0" label={null} pinyin={tone.syllable} />
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
      <p className="mb-1 text-[9px] font-bold tracking-[.1em] text-jade uppercase">{eyebrow}</p>
      <h2 className="mt-0 mb-4 text-xl tracking-[-.035em]">{title}</h2>
      {items.length ? (
        <dl className="m-0 border-t border-line">
          {items.map((item) => (
            <div className="grid grid-cols-[70px_1fr] items-baseline border-b border-line py-2.5" key={item.key}>
              <dt className="text-xs font-bold text-jade">{item.key}</dt>
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
      <p className="mb-1 text-[9px] font-bold tracking-[.1em] text-fluenc-blue uppercase">Компонент → предмет</p>
      <h2 className="mt-0 mb-4 text-xl tracking-[-.035em]">Реквизит</h2>
      {items.length ? (
        <div className="grid grid-cols-4 border-t border-line max-[800px]:grid-cols-2 max-[460px]:grid-cols-1">
          {items.map((item) => (
            <div className="grid min-w-0 grid-cols-[44px_1fr] items-center gap-2 border-r border-b border-line py-2.5 pr-3 even:max-[800px]:border-r-0 max-[460px]:border-r-0" key={item.key}>
              <b className="font-hanzi text-[24px] font-semibold leading-none" lang="zh-CN">{item.key}</b>
              <span className="overflow-hidden text-xs font-semibold text-ellipsis whitespace-nowrap">{item.name}</span>
            </div>
          ))}
        </div>
      ) : <p className="text-xs text-muted">Реквизит появится после первой сцены.</p>}
    </section>
  )
}
