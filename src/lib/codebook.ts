export const codebookKinds = ['actor', 'set', 'tone'] as const
export const codebookDirections = ['encode', 'decode'] as const

export type CodebookKind = (typeof codebookKinds)[number]
export type CodebookDirection = (typeof codebookDirections)[number]

export function codebookItemId(key: string, direction: CodebookDirection) {
  return `${direction}:${key}`
}

export function parseCodebookItemId(itemId: string) {
  const separator = itemId.indexOf(':')
  if (separator < 0) return null

  const direction = itemId.slice(0, separator)
  const key = itemId.slice(separator + 1)
  if (!codebookDirections.includes(direction as CodebookDirection) || !key) return null

  return { direction: direction as CodebookDirection, key }
}

export function codebookCoordinateIds(kind: CodebookKind, key: string) {
  return codebookDirections.map((direction) => ({
    itemType: kind,
    itemId: codebookItemId(key, direction),
  }))
}
