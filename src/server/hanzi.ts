import { createServerFn } from '@tanstack/react-start'

import { hanziLookupInput } from './hanzi.contract'

export const getHanziCompositions = createServerFn({ method: 'GET' })
  .validator(hanziLookupInput)
  .handler(async ({ data }) => {
    const { getHanziCompositionsHandler } = await import('./hanzi.handlers.server')
    return getHanziCompositionsHandler(data)
  })

export type HanziCompositions = Awaited<ReturnType<typeof getHanziCompositions>>
