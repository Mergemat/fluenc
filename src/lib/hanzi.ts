export type HanziIndex = Record<string, readonly [radical: string, decomposition: string]>

export type HanziComposition = {
  radical: string
  decomposition: string | null
  structure: 'atomic' | 'compound'
  glyphVariation: boolean
  components: string[]
  note: string | null
}

export type ReviewedComposition = {
  character: string
  components: string[]
  structure: 'atomic' | 'compound'
  decomposition: string | null
  approximate: boolean
  note: string
  sources: string[]
  confidence: 'verified' | 'editorial' | 'unresolved'
}

const componentPattern = /^[\p{Script=Han}\u2e80-\u2eff\u31c0-\u31ee]$/u
const binaryOperators = new Set(Array.from('⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽'))

export function isHanziCharacter(value: string) {
  const characters = Array.from(value)
  return characters.length === 1 && componentPattern.test(characters[0])
}

export function findHanziComposition(
  index: HanziIndex,
  character: string,
  reviewed?: ReviewedComposition,
): HanziComposition | null {
  const entry = index[character]
  if (!entry) return null

  const [radical, decomposition] = entry
  if (reviewed) {
    if (
      reviewed.character !== character || reviewed.confidence === 'unresolved' ||
      !reviewed.sources.length || !reviewed.components.length ||
      reviewed.components.some(part => !isHanziCharacter(part))
    ) return null
    if (reviewed.structure === 'atomic' && (reviewed.components.length !== 1 || reviewed.components[0] !== character)) return null
    if (reviewed.structure === 'compound' && reviewed.components.includes(character)) return null
    if (reviewed.decomposition) {
      const parsed = findHanziComposition({ [character]: [radical, reviewed.decomposition] }, character)
      if (
        !parsed || parsed.components.join('') !== reviewed.components.join('') ||
        parsed.structure !== reviewed.structure || (parsed.glyphVariation && !reviewed.approximate)
      ) return null
    }
    return {
      radical,
      decomposition: reviewed.decomposition,
      components: reviewed.components,
      structure: reviewed.structure,
      glyphVariation: reviewed.approximate,
      note: reviewed.note || null,
    }
  }
  const glyphVariation = decomposition.startsWith('〾')
  const tokens = Array.from(glyphVariation ? decomposition.slice(1) : decomposition)
  const components: string[] = []
  let cursor = 0

  const readNode = (): boolean => {
    const token = tokens[cursor++]
    if (!token) return false
    const arity = token === '⿲' || token === '⿳' ? 3 : binaryOperators.has(token) ? 2 : 0
    if (arity) {
      for (let child = 0; child < arity; child++) {
        if (!readNode()) return false
      }
      return true
    }
    if (!componentPattern.test(token)) return false
    components.push(token)
    return true
  }

  // Reject the whole description if any operand is unknown, unsupported, or missing.
  if (!readNode() || cursor !== tokens.length) return null
  const structure = tokens.length === 1 && tokens[0] === character ? 'atomic' : 'compound'
  if (structure === 'compound' && components.includes(character)) return null

  return { radical, decomposition, structure, glyphVariation, components, note: null }
}

export function groupHanziComponents(components: readonly string[]) {
  const counts = new Map<string, number>()
  for (const hanzi of components) counts.set(hanzi, (counts.get(hanzi) ?? 0) + 1)
  return [...counts].map(([hanzi, count]) => ({ hanzi, count }))
}
