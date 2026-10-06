// Route search validators. Hand-written so zod stays out of the app's entry chunk.

/** A value from a fixed set; anything else reads as a missing param. */
export function oneOf<const T extends string>(value: unknown, options: readonly T[]): T | undefined {
  return options.find(option => option === value)
}

export function optionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}
