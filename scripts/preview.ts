// Serve the production build locally the way Vercel does: files on disk first, then the app server.
// Nitro's own static handler only knows files that existed when it was bundled, which misses the
// prerendered offline shell, the service worker and the offline file list written after it.
import { resolve, sep } from 'node:path'

const publicDirectory = resolve('.output/public')
const port = Number(process.env.PORT ?? 3000)
const appPort = port + 1

if (!(await Bun.file('.output/server/index.mjs').exists())) {
  console.error('No build found. Run `bun run build` first.')
  process.exit(1)
}

const app = Bun.spawn(['bun', '.output/server/index.mjs'], {
  env: { ...process.env, PORT: String(appPort), HOST: '127.0.0.1' },
  stdout: 'inherit',
  stderr: 'inherit',
})
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { app.kill(); process.exit(0) })

async function staticFile(pathname: string) {
  const path = resolve(publicDirectory, `.${decodeURIComponent(pathname)}`)
  if (!path.startsWith(publicDirectory + sep)) return null
  const file = Bun.file(path)
  return await file.exists() ? file : null
}

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url)
    const file = request.method === 'GET' || request.method === 'HEAD' ? await staticFile(url.pathname) : null
    if (file) {
      const cache = url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate'
      return new Response(file, { headers: { 'Cache-Control': cache } })
    }
    return fetch(`http://127.0.0.1:${appPort}${url.pathname}${url.search}`, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual',
    })
  },
})
console.info(`Preview: http://localhost:${port}`)
