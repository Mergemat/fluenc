import { generateSW } from 'workbox-build'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const outputDirectory = process.env.VERCEL ? '.vercel/output' : '.output'
await rm(outputDirectory, { recursive: true, force: true })

const viteBuild = Bun.spawn(['bunx', 'vite', 'build'], {
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
})
const exitCode = await viteBuild.exited
if (exitCode !== 0) process.exit(exitCode)

const manifest = await Bun.file(`${outputDirectory}/nitro.json`).json() as { publicDir: string }
const publicDirectory = resolve(outputDirectory, manifest.publicDir)
const result = await generateSW({
  swDest: resolve(publicDirectory, 'sw.js'),
  globDirectory: publicDirectory,
  globPatterns: [
    'assets/**/*.{css,js}',
    'fonts/**/*.woff2',
    'audio/**/*.mp3',
    'hanzi/**/*.json',
    'icon.svg',
    'manifest.webmanifest',
  ],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https?:\/\/[^/]+\/(?:\?.*)?$/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'fluenc-pages',
        networkTimeoutSeconds: 4,
        expiration: { maxEntries: 4, maxAgeSeconds: 30 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /\.mp3(?:\?.*)?$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'fluenc-audio',
        expiration: { maxEntries: 700, maxAgeSeconds: 365 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
})

if (!result.count) throw new Error('Service worker has no assets to precache')
console.info(`Service worker: ${result.count} files, ${result.size} bytes precached`)
