// Practice files (pinyin audio and stroke data) live outside the service worker's precache, so
// the app installs in seconds. The page downloads them itself, and the worker serves them from
// these caches. The build writes the list, with a revision per file, to OFFLINE_FILES_URL.
export const OFFLINE_FILES_URL = '/offline-files.json'
export const OFFLINE_CACHES = { audio: 'fluenc-audio', strokes: 'fluenc-strokes' } as const

export type OfflineFile = { url: string; revision: string }
export type OfflineFiles = Record<keyof typeof OFFLINE_CACHES, OfflineFile[]>
