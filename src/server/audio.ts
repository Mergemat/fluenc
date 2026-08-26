import { createServerFn } from '@tanstack/react-start'

import { pronunciationInput } from './audio.contract'

export const getPronunciationAudio = createServerFn({ method: 'POST' })
  .validator(pronunciationInput)
  .handler(async ({ data }) => {
    const { getPronunciationAudioHandler } = await import('./audio.handlers.server')
    return getPronunciationAudioHandler(data)
  })
