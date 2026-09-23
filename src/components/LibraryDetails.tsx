import { useQuery } from '@tanstack/react-query'

import { characterForWord } from '../lib/character-words'
import { dashboardQueryOptions, palaceQueryOptions } from '../offline/queries'
import { getHanziCompositions } from '../server/hanzi'
import { characterCues } from './character-studio/cues'
import { Button } from './ui/Button'
import { Status } from './ui/Layout'

export function LibraryDetails({ id, hanzi, kind }: { id: string; hanzi: string; kind: 'characters' | 'words' }) {
  const dashboard = useQuery(dashboardQueryOptions)
  const palace = useQuery(palaceQueryOptions)
  const characters = [...new Set(Array.from(hanzi))]
  const compositions = useQuery({
    queryKey: ['hanzi-compositions', characters.join('')],
    queryFn: () => getHanziCompositions({ data: { characters } }),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const characterId = kind === 'characters' ? id : characterForWord(id)
  const data = dashboard.data
  const item = data && [...data.buildQueue, ...data.reviewQueue, ...data.scheduledQueue, ...data.lockedWords]
    .find(item => item.type === (characterId ? 'character' : 'word') && item.id === (characterId || id))

  return <section className="library-details" aria-label={`Details for ${hanzi}`}>
    <section>
      <h2>Character parts</h2>
      {compositions.data ? characters.map(character => {
        const composition = compositions.data[character]
        return <div key={character}>
          <p className="font-hanzi-props library-parts" lang="zh-CN">{character}{composition?.structure === 'compound' && composition.components.length ? ` = ${composition.components.join(' + ')}` : ''}</p>
          {composition?.structure === 'atomic' ? <p>Single component.</p> : null}
          {composition?.note ? <p>{composition.note}</p> : null}
          {!composition ? <p>No composition available.</p> : null}
        </div>
      }) : <Status title={compositions.isError ? 'Could not load character parts' : 'Loading character parts…'} action={compositions.isError ? <Button type="button" variant="secondary" onClick={() => compositions.refetch()}>Retry</Button> : undefined} />}
    </section>
    <section>
      <h2>Your memory clues</h2>
      {dashboard.isPending || palace.isPending ? <p>Loading your notes…</p>
        : dashboard.isError || palace.isError ? <Status title="Could not load your notes" action={<Button type="button" variant="secondary" onClick={() => { void dashboard.refetch(); void palace.refetch() }}>Retry</Button>} />
        : item?.type === 'character' ? <dl className="library-clues">{characterCues(item).map(cue => {
          const saved = cue.kind === 'actor' ? palace.data?.actors.find(entry => entry.key === cue.code)?.name
            : cue.kind === 'set' ? palace.data?.sets.find(entry => entry.key === cue.code)?.name
            : cue.kind === 'room' ? palace.data?.rooms.find(entry => entry.tone === Number(cue.code))?.name
            : palace.data?.props.find(entry => entry.key === cue.code)?.name
          return <div key={cue.id}><dt>{cue.role} · <span className={cue.kind === 'prop' ? 'font-hanzi-props' : ''}>{cue.code}</span>{cue.count && cue.count > 1 ? ` × ${cue.count}` : ''}</dt><dd>{saved || cue.name || 'Not recorded'}</dd></div>
        })}</dl>
        : <p className="library-note">{item?.type === 'word' && item.livingLink ? item.livingLink : 'No memory link recorded.'}</p>}
    </section>
  </section>
}
