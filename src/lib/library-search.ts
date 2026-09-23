import Fuse from 'fuse.js'
import { convert } from 'pinyin-pro'

import { getItemMeaning } from './meaning'
import { characterForWord } from './character-words'
import type { DashboardData, LibraryData, PalaceData } from '../server/curriculum'

export type LibraryKind = 'characters' | 'words'
export type LibraryEntry = (LibraryData[LibraryKind][number]) & { kind: LibraryKind; approximate?: boolean }

function normalizePinyin(value: string) {
  return convert(value.toLowerCase().normalize('NFC'), { format: 'toneNone' })
    .replace(/u:|ü|v/g, 'v')
    .replace(/[1-5\s'’\-]/g, '')
}

export function createLibrarySearch(library: LibraryData, dashboard?: DashboardData, palace?: PalaceData) {
  const studyItems = new Map(dashboard
    ? [...dashboard.buildQueue, ...dashboard.reviewQueue, ...dashboard.scheduledQueue, ...dashboard.lockedWords].map(item => [`${item.type}:${item.id}`, item])
    : [])
  const entries = (['characters', 'words'] as const).flatMap(kind => library[kind].map(item => {
    const meaning = getItemMeaning(item)
    const characterId = kind === 'characters' ? item.id : characterForWord(item.id)
    const study = studyItems.get(characterId ? `character:${characterId}` : `word:${item.id}`)
    const movie = study?.type === 'character' ? study.movie : undefined
    const notes = movie ? [
      palace?.actors.find(actor => actor.key === movie.actorKey)?.name || movie.actorName,
      palace?.sets.find(set => set.key === movie.finalKey)?.name || movie.setName,
      palace?.rooms.find(room => room.tone === movie.tone)?.name || movie.roomName,
      ...movie.components.map(part => palace?.props.find(prop => prop.key === part.hanzi)?.name || part.propName),
    ].filter(Boolean) : study?.type === 'word' ? [study.livingLink] : []
    return {
      item: { ...item, kind } as LibraryEntry,
      hanzi: item.hanzi,
      pinyin: normalizePinyin(item.pinyin),
      meanings: [meaning.primary, ...meaning.alternatives],
      notes,
    }
  }))
  const options = { includeScore: true, ignoreLocation: true, threshold: 0.35, minMatchCharLength: 2 }
  const textIndex = new Fuse(entries, { ...options, keys: [{ name: 'hanzi', weight: 3 }, { name: 'meanings', weight: 2 }, 'notes'] })
  const pinyinIndex = new Fuse(entries, { ...options, keys: ['pinyin'] })

  return (query: string): LibraryEntry[] => {
    const text = query.trim().toLowerCase()
    if (!text) return entries.map(entry => entry.item)
    const reading = normalizePinyin(text)
    const matchesText = (value: string) => text.split(/\s+/).every(term => value.toLowerCase().split(/[^\p{L}\p{N}]+/u).some(word => word.startsWith(term)))
    const matches = new Map<string, { item: LibraryEntry; score: number }>()
    const add = (entry: typeof entries[number], score: number) => {
      const key = `${entry.item.kind}:${entry.item.id}`
      const previous = matches.get(key)
      if (!previous || score < previous.score) matches.set(key, { item: entry.item, score })
    }
    // Exact and prefix matches always precede typo-tolerant matches.
    for (const entry of entries) {
      if (entry.hanzi === text || entry.pinyin === reading || entry.meanings.some(meaning => meaning.toLowerCase() === text)) add(entry, 0)
      else if (entry.hanzi.startsWith(text) || (reading && entry.pinyin.startsWith(reading))) add(entry, 1)
      else if (entry.hanzi.includes(text) || entry.meanings.some(matchesText) || entry.notes.some(matchesText)) add(entry, 2)
    }
    if (text.length >= 3) {
      for (const result of textIndex.search(text)) add(result.item, 3 + (result.score ?? 1))
      if (/^[a-zv]+$/.test(reading)) for (const result of pinyinIndex.search(reading)) add(result.item, 3 + (result.score ?? 1))
    }
    return [...matches.values()].sort((a, b) => a.score - b.score || a.item.rank - b.item.rank).map(result => ({ ...result.item, approximate: result.score >= 3 }))
  }
}
