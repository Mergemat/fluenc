export type HanziIndex = Record<string, readonly [radical: string, decomposition: string]>

export type HanziComposition = {
  radical: string
  decomposition: string
  components: string[]
}

const componentPattern = /[\p{Script=Han}\u2e80-\u2eff\u31c0-\u31ef]/u

export function isHanziCharacter(value: string) {
  const characters = Array.from(value)
  return characters.length === 1 && componentPattern.test(characters[0])
}

export function findHanziComposition(
  index: HanziIndex,
  character: string,
): HanziComposition | null {
  const entry = index[character]
  if (!entry) return null

  const [radical, decomposition] = entry
  const seen = new Set<string>()
  const components: string[] = []

  for (const component of decomposition) {
    if (
      component !== character &&
      componentPattern.test(component) &&
      !seen.has(component)
    ) {
      seen.add(component)
      components.push(component)
    }
  }

  return { radical, decomposition, components }
}
