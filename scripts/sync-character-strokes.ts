import { mkdir } from 'node:fs/promises'

import curriculum from '../src/data/curriculum.generated.json'
import overrideJson from '../src/data/character-strokes.overrides.json'
import source from '../src/data/character-strokes.source.json'
import { directCharacters } from '../src/lib/character-props'

type DictionaryEntry = { character: string; decomposition: string; matches: (number[] | null)[] }
type Decomposition = string | Decomposition[]
const overrides = overrideJson as Record<string, string[]>

async function readSource(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return response
}

function strokeOwners(entry: DictionaryEntry): (string | undefined)[] {
  const tokens = Array.from(entry.decomposition.replace(/^〾/, ''))
  let position = 0
  function parse(): Decomposition {
    const token = tokens[position++] ?? ''
    const arity = ['⿲', '⿳'].includes(token) ? 3 : ['⿰', '⿱', '⿴', '⿵', '⿶', '⿷', '⿸', '⿹', '⿺', '⿻'].includes(token) ? 2 : 0
    return arity ? Array.from({ length: arity }, parse) : token
  }
  const tree = parse()
  return entry.matches.map(path => {
    if (!path) return undefined
    let node: Decomposition | undefined = tree
    for (const index of path) node = Array.isArray(node) ? node[index] : undefined
    return typeof node === 'string' ? node : undefined
  })
}

const entries = (await (await readSource(source.dictionary)).text()).trim().split('\n').map(line => JSON.parse(line) as DictionaryEntry)
const dictionary = new Map(entries.map(entry => [entry.character, entry]))
await mkdir('public/hanzi', { recursive: true })
let position = 0
await Promise.all(Array.from({ length: 8 }, async () => {
  while (position < curriculum.characters.length) {
    const character = curriculum.characters[position++]!
    const entry = dictionary.get(character.hanzi)
    if (!entry) throw new Error(`Missing dictionary entry: ${character.hanzi}`)
    const owners = overrides[character.hanzi] ?? strokeOwners(entry)
    const components = directCharacters.has(character.hanzi) ? [character.hanzi] : character.components
    const data = await (await readSource(`${source.graphics}/${encodeURIComponent(character.hanzi)}.json`)).json() as { strokes: string[]; medians: number[][][] }
    if (owners.length !== data.strokes.length || owners.some(owner => !owner || !components.includes(owner)) || components.some(component => !owners.includes(component))) {
      throw new Error(`Incomplete stroke ownership: ${character.hanzi}. Review the source and add an explicit override.`)
    }
    await Bun.write(`public/hanzi/${character.hanzi}.json`, JSON.stringify({ _notice: "Fluenc, 2026-09-11: added component owners; stroke paths and medians unchanged. Graphics copyright Arphic Technology Co., Ltd.; Arphic Public License, /licenses/ARPHICPL.TXT.", strokes: data.strokes, medians: data.medians, owners }) + '\n')
  }
}))
console.info(`Synced stroke paths and prop ownership for ${curriculum.characters.length} characters.`)
