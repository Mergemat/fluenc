// Serve the production build locally the way Vercel does: files on disk first, then the app server.
// Nitro's own static handler only knows files that existed when it was bundled, which misses the
// prerendered offline shell, the service worker and the offline file list written after it.
import { extname, resolve, sep } from "node:path";
import { brotliCompressSync } from "node:zlib";

const publicDirectory = resolve(".output/public");
const port = Number(process.env.PORT ?? 3000);
const appPort = port + 1;

if (!(await Bun.file(".output/server/index.mjs").exists())) {
  console.error("No build found. Run `bun run build` first.");
  process.exit(1);
}

const app = Bun.spawn(["bun", ".output/server/index.mjs"], {
  env: { ...process.env, PORT: String(appPort), HOST: "127.0.0.1" },
  stdout: "inherit",
  stderr: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    app.kill();
    process.exit(0);
  });
}

// Accept requests only once the app server answers, so the first page never fails.
async function waitForApp(attemptsLeft: number): Promise<void> {
  try {
    await fetch(`http://127.0.0.1:${appPort}/manifest.webmanifest`);
  } catch (error) {
    if (attemptsLeft <= 0) {
      throw new Error("The app server did not start", { cause: error });
    }
    await Bun.sleep(100);
    return waitForApp(attemptsLeft - 1);
  }
}
await waitForApp(100);

async function staticFile(pathname: string) {
  const path = resolve(publicDirectory, `.${decodeURIComponent(pathname)}`);
  if (!path.startsWith(publicDirectory + sep)) {
    return null;
  }
  const file = Bun.file(path);
  return (await file.exists()) ? file : null;
}

// Vercel's CDN sends text files compressed; sizes and load times here should match.
const COMPRESSIBLE = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".svg",
  ".txt",
  ".webmanifest",
]);
const NAMED_BY_CONTENT = /^\/(assets|offline|strokes|audio)\//;
const compressed = new Map<string, Buffer<ArrayBuffer>>();

async function brotli(path: string, file: Blob) {
  let body = compressed.get(path);
  if (!body) {
    body = brotliCompressSync(await file.arrayBuffer()) as Buffer<ArrayBuffer>;
    compressed.set(path, body);
  }
  return body;
}

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const file =
      request.method === "GET" || request.method === "HEAD"
        ? await staticFile(url.pathname)
        : null;
    if (file) {
      // Files named by their content are kept for good, as Vercel's routes say (vite.config.ts).
      const cache = NAMED_BY_CONTENT.test(url.pathname)
        ? "public, max-age=31536000, immutable"
        : "public, max-age=0, must-revalidate";
      const { type } = file;
      if (
        COMPRESSIBLE.has(extname(url.pathname)) &&
        request.headers.get("accept-encoding")?.includes("br")
      ) {
        return new Response(await brotli(url.pathname, file), {
          headers: {
            "Cache-Control": cache,
            "Content-Encoding": "br",
            "Content-Type": type,
          },
        });
      }
      return new Response(file, { headers: { "Cache-Control": cache } });
    }
    return fetch(`http://127.0.0.1:${appPort}${url.pathname}${url.search}`, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "manual",
    });
  },
});
console.info(`Preview: http://localhost:${port}`);
