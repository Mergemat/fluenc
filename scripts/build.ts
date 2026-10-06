import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { injectManifest } from "workbox-build";

import {
  OFFLINE_FILES_URL,
  type OfflineFile,
  type OfflineFiles,
} from "../src/offline/files";

const outputDirectory = process.env.VERCEL ? ".vercel/output" : ".output";
await rm(outputDirectory, { recursive: true, force: true });

const viteBuild = Bun.spawn(["bunx", "vite", "build"], {
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});
const exitCode = await viteBuild.exited;
if (exitCode !== 0) {
  process.exit(exitCode);
}

const manifest = (await Bun.file(`${outputDirectory}/nitro.json`).json()) as {
  publicDir: string;
};
const publicDirectory = resolve(outputDirectory, manifest.publicDir);
const workerBuild = await Bun.build({
  entrypoints: ["scripts/service-worker.ts"],
  target: "browser",
  format: "iife",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
});
if (!workerBuild.success) {
  throw new AggregateError(workerBuild.logs, "Service worker build failed");
}
const workerSource = resolve(outputDirectory, "service-worker.js");
await Bun.write(workerSource, workerBuild.outputs[0]);

const result = await injectManifest({
  swSrc: workerSource,
  swDest: resolve(publicDirectory, "sw.js"),
  globDirectory: publicDirectory,
  globPatterns: [
    "offline.html",
    "assets/**/*.{css,js}",
    "fonts/**/*.woff2",
    "brand/**/*.png",
    "apple-touch-icon.png",
    "manifest.webmanifest",
  ],
  // Shipped with the Geist family but not used by any stylesheet.
  globIgnores: ["fonts/geist/GeistPixel-Grid.woff2"],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
});
await rm(workerSource);

if (!(await Bun.file(resolve(publicDirectory, "offline.html")).exists())) {
  throw new Error("Offline startup shell was not generated");
}

if (!result.count) {
  throw new Error("Service worker has no assets to precache");
}

// Audio and strokes download from the page after install; see src/offline/files.ts.
const listFiles = async (pattern: string): Promise<OfflineFile[]> => {
  const files: OfflineFile[] = [];
  for await (const path of new Bun.Glob(pattern).scan({
    cwd: publicDirectory,
  })) {
    const hasher = new Bun.CryptoHasher("md5");
    hasher.update(await Bun.file(resolve(publicDirectory, path)).arrayBuffer());
    files.push({
      url: `/${path}`,
      revision: hasher.digest("hex").slice(0, 12),
    });
  }
  return files.sort((a, b) => a.url.localeCompare(b.url));
};
const offlineFiles: OfflineFiles = {
  audio: await listFiles("audio/pinyin/*.mp3"),
  strokes: await listFiles("hanzi/*.json"),
};
if (!(offlineFiles.audio.length && offlineFiles.strokes.length)) {
  throw new Error("Offline practice files are missing");
}
await Bun.write(
  resolve(publicDirectory, OFFLINE_FILES_URL.slice(1)),
  JSON.stringify(offlineFiles)
);
console.info(
  `Service worker: ${result.count} files, ${result.size} bytes precached`
);
