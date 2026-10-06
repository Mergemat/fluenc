import Fuse from 'fuse.js'
import { convert } from 'pinyin-pro'

import { getItemMeaning } from './meaning'
import type { LibraryData, PalaceData } from '../server/curriculum'

export type LibraryKind = 'characters' | 'words'
export type LibraryCharacter = LibraryData['characters'][number] & { kind: 'characters'; approximate?: boolean }
export type LibraryWord = LibraryData['words'][number] & { kind: 'words'; approximate?: boolean }
export type LibraryEntry = LibraryCharacter | LibraryWord

function normalizePinyin(value: string) {
  return convert(value.toLowerCase().normalize('NFC'), { format: 'toneNone' })
    .replace(/u:|ü|v/g, 'v')
    .replace(/[1-5\s'’\-]/g, '')
}

/** The learner's clue names for an entry, from its movie codes and saved palace names. */
export function entryClueNames(item: LibraryEntry, palace?: PalaceData): string[] {
  if (item.kind === 'words') return item.livingLink ? [item.livingLink] : []
  if (!palace) return []
  return [
    palace.actors.find(actor => actor.key === item.movie.actorKey)?.name,
    palace.sets.find(set => set.key === item.movie.finalKey)?.name,
    palace.rooms.find(room => room.tone === item.movie.tone)?.name,
    ...item.components.map(part => palace.props.find(prop => prop.key === part.hanzi)?.name),
  ].filter((name): name is string => Boolean(name))
}

export function createLibrarySearch(library: LibraryData, palace?: PalaceData) {
  const entries = (['characters', 'words'] as const).flatMap(kind => library[kind].map(raw => {
    const item = { ...raw, kind } as LibraryEntry
    const meaning = getItemMeaning(item)
    return {
      item,
      hanzi: item.hanzi,
      pinyin: normalizePinyin(item.pinyin),
      meanings: [meaning.primary, ...meaning.alternatives],
      notes: entryClueNames(item, palace),
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
