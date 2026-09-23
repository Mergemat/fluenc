import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'

import { getItemMeaning } from '../lib/meaning'
import { getToneDetail } from '../lib/tones'
import { libraryQueryOptions, palaceQueryOptions } from '../offline/queries'
import type { PalaceData } from '../server/curriculum'
import { ToneAudioButton } from './ToneAudioButton'
import { Button } from './ui/Button'
import { Page, PageHeader, Status } from './ui/Layout'

const palaceRoute = getRouteApi('/_app/palace')

export function PalaceView() {
  const palaceQuery = useQuery(palaceQueryOptions)
  const libraryQuery = useQuery(libraryQueryOptions)
  const filters = palaceRoute.useSearch()
  const { kind = 'characters', limit = 48 } = filters
  const navigate = palaceRoute.useNavigate()
  const updateFilters = (next: Partial<typeof filters>) => void navigate({ search: previous => ({ ...previous, ...next }), replace: true, resetScroll: false })
  const library = libraryQuery.data
  const collection = library?.[kind].filter(item => item.status !== 'new') ?? []

  return <Page>
    <PageHeader title="Palace" meta="Your progress & memory clues" />
    {library ? <>
      <section className="palace-progress" aria-label="Learning progress">
        {(['characters', 'words'] as const).map(section => {
          const learned = library[section].filter(item => item.status === 'review').length
          const learning = library[section].filter(item => item.status === 'learning').length
          return <div key={section} className="palace-progress-count">
            <span>{section === 'characters' ? 'Characters' : 'Words'}</span>
            <p><strong>{learned}</strong> learned</p>
            <span>{learning} learning</span>
            <progress aria-label={`${section} learned`} max={library[section].length || 1} value={learned} />
            <small>{learned + learning} started · {library[section].length} in course</small>
          </div>
        })}
      </section>
      <p className="palace-progress-note">Learned = ready for spaced review. Learning includes new lessons and items you are relearning.</p>
      <section className="palace-collection">
        <header><h2>Your collection</h2><span>Tap to revisit your clues</span></header>
        <div className="library-tabs" aria-label="Your collection">
          {(['characters', 'words'] as const).map(section => <button className="library-tab" type="button" aria-pressed={kind === section} key={section} onClick={() => updateFilters({ kind: section, limit: 48 })}>{section === 'characters' ? 'Characters' : 'Words'} <span>{library[section].filter(item => item.status !== 'new').length}</span></button>)}
        </div>
        {collection.length ? <>
          <div className={`palace-tiles palace-tiles-${kind}`}>
            {collection.slice(0, limit).map(item => <Link key={item.id} to="/library/$kind/$id" params={{ kind, id: item.id }} search={{ from: 'palace' }} aria-label={`View ${item.hanzi}: ${getItemMeaning(item).primary}`}>
              <span className="font-hanzi" lang="zh-CN">{item.hanzi}</span><small>{item.pinyin}</small><span className={`status-tag status-${item.status}`}>{item.status === 'review' ? 'Learned' : 'Learning'}</span>
            </Link>)}
          </div>
          {collection.length > limit ? <Button type="button" variant="secondary" onClick={() => updateFilters({ limit: limit + 48 })}>Show more</Button> : null}
        </> : <p className="palace-empty">Your {kind} will appear here after you finish a lesson.</p>}
      </section>
    </> : <Status title={libraryQuery.isError ? 'Could not load your progress' : 'Loading progress…'} action={libraryQuery.isError ? <Button type="button" variant="secondary" onClick={() => libraryQuery.refetch()}>Retry</Button> : undefined} />}
    {palaceQuery.data ? <MemoryClues palace={palaceQuery.data} /> : <Status title={palaceQuery.isError ? 'Could not load your memory clues' : 'Loading memory clues…'} action={palaceQuery.isError ? <Button variant="secondary" type="button" onClick={() => palaceQuery.refetch()}>Retry</Button> : undefined} />}
  </Page>
}

function MemoryClues({ palace }: { palace: PalaceData }) {
  return <section className="palace-memories">
    <h2>Your memory clues</h2>
    <p>The people, places, and objects you chose in your lessons.</p>
    {([
      { title: 'Actors', hint: 'Initial sounds', items: palace.actors },
      { title: 'Places', hint: 'Final sounds', items: palace.sets },
      { title: 'Props', hint: 'Character components', items: palace.props },
    ]).map(group => <details key={group.title} className="palace-clue-group">
      <summary><strong>{group.title}</strong><span>{group.hint}</span><small>{group.items.length}</small></summary>
      {group.items.length ? <dl className="palace-mappings">{group.items.map(item => <div key={item.key}><dt className={group.title === 'Props' ? 'font-hanzi-props' : ''}>{item.key}</dt><dd>{item.name}</dd></div>)}</dl> : <p>No {group.title.toLowerCase()} saved yet.</p>}
    </details>)}
    <details className="palace-clue-group">
      <summary><strong>Tone rooms</strong><span>Where the scene happens</span><small>{palace.rooms.length}</small></summary>
      <div className="palace-tone-list">{palace.rooms.map(room => {
        const tone = getToneDetail(room.tone)
        return <div key={room.tone}><strong>{tone.syllable}</strong><span>{room.name}</span><ToneAudioButton pinyin={tone.syllable} label={null} /></div>
      })}</div>
    </details>
  </section>
}
