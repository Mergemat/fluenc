import 'dotenv/config'

import { BlobNotFoundError, head, put } from '@vercel/blob'
import { createHash } from 'node:crypto'

import type { PronunciationInput } from './audio.contract'

const MODEL_ID = 'eleven_multilingual_v2'
const OUTPUT_FORMAT = 'mp3_44100_128'
const PRONUNCIATION_VERSION = 6
const CACHE_MAX_AGE_SECONDS = 31_536_000

function getCacheKey(data: PronunciationInput, voiceId: string) {
  return createHash('sha256')
    .update(JSON.stringify({ ...data, voiceId, model: MODEL_ID, output: OUTPUT_FORMAT, pronunciation: PRONUNCIATION_VERSION }))
    .digest('hex')
}

async function getCachedAudioUrl(pathname: string) {
  try {
    return (await head(pathname)).url
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null
    throw error
  }
}

export async function getPronunciationAudioHandler(data: PronunciationInput) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const voiceId = process.env.ELEVENLABS_VOICE_ID
  if (!apiKey || !voiceId) throw new Error('ElevenLabs is not configured on the server')

  const cacheKey = getCacheKey(data, voiceId)
  const cachePathname = `elevenlabs/v${PRONUNCIATION_VERSION}/${cacheKey}.mp3`
  const cachedAudioUrl = await getCachedAudioUrl(cachePathname)
  if (cachedAudioUrl) return { audioUrl: cachedAudioUrl, cached: true }

  const spokenText = /[。！？!?]$/.test(data.text) ? data.text : `${data.text}。`
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${OUTPUT_FORMAT}&enable_logging=false`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: spokenText,
        model_id: MODEL_ID,
        language_code: 'zh',
        seed: 42,
        voice_settings: {
          stability: 0.72,
          similarity_boost: 0.78,
          style: 0,
          use_speaker_boost: true,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  )

  if (!response.ok) {
    throw new Error(`ElevenLabs returned no audio (${response.status})`)
  }

  const audio = Buffer.from(await response.arrayBuffer())
  try {
    const blob = await put(cachePathname, audio, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: false,
      cacheControlMaxAge: CACHE_MAX_AGE_SECONDS,
      contentType: 'audio/mpeg',
    })
    return { audioUrl: blob.url, cached: false }
  } catch (error) {
    const racedAudioUrl = await getCachedAudioUrl(cachePathname)
    if (racedAudioUrl) return { audioUrl: racedAudioUrl, cached: true }
    throw error
  }
}
