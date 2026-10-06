import { injectManifest } from 'workbox-build'
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
const workerBuild = await Bun.build({
  entrypoints: ['scripts/service-worker.ts'],
  target: 'browser',
  format: 'iife',
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
})
if (!workerBuild.success) throw new AggregateError(workerBuild.logs, 'Service worker build failed')
const workerSource = resolve(outputDirectory, 'service-worker.js')
await Bun.write(workerSource, workerBuild.outputs[0])

const result = await injectManifest({
  swSrc: workerSource,
  swDest: resolve(publicDirectory, 'sw.js'),
  globDirectory: publicDirectory,
  globPatterns: [
    'offline.html',
    'audio/pinyin/**/*.mp3',
    'assets/**/*.{css,js}',
    'fonts/**/*.woff2',
    'brand/**/*.png',
    'apple-touch-icon.png',
    'manifest.webmanifest',
  ],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
})
await rm(workerSource)

if (!(await Bun.file(resolve(publicDirectory, 'offline.html')).exists())) {
  throw new Error('Offline startup shell was not generated')
}

if (!result.count) throw new Error('Service worker has no assets to precache')
console.info(`Service worker: ${result.count} files, ${result.size} bytes precached`)
