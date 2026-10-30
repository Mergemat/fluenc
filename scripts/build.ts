import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { injectManifest } from "workbox-build";

import {
  OFFLINE_FILES_URL,
  type OfflineFiles,
  type OfflineGroup,
  packFiles,
} from "../src/offline/files";
import { migrateDatabase } from "./local-db";

// Only production: preview builds may share its database and must not apply a branch's migrations.
// Runs before the build so a failed migration stops the deploy.
if (process.env.VERCEL_ENV === "production") {
  await migrateDatabase();
  console.info("Database: migrations applied");
}

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
    "assets/**/*.{css,js,woff2}",
    "brand/**/*.png",
    "apple-touch-icon.png",
    "manifest.webmanifest",
  ],
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
const md5 = (bytes: Uint8Array) => {
  const hasher = new Bun.CryptoHasher("md5");
  hasher.update(bytes);
  return hasher.digest("hex").slice(0, 12);
};
const packGroup = async (
  name: string,
  pattern: string,
  json: boolean
): Promise<OfflineGroup> => {
  const files: Parameters<typeof packFiles>[0] = [];
  for await (const path of new Bun.Glob(pattern).scan({
    cwd: publicDirectory,
  })) {
    const bytes = await Bun.file(resolve(publicDirectory, path)).bytes();
    files.push({ url: `/${path}`, bytes });
  }
  files.sort((a, b) => a.url.localeCompare(b.url));
  const packed = packFiles(files, json);
  // Named by its content, so it can be cached for good; see the /offline rule in vite.config.ts.
  const pack = `/offline/${name}.${md5(packed.bytes)}.${json ? "json" : "bin"}`;
  await Bun.write(resolve(publicDirectory, pack.slice(1)), packed.bytes);
  return { pack, size: packed.bytes.length, files: packed.files };
};
const offlineFiles: OfflineFiles = {
  // One folder each, named by its content (see vite.config.ts).
  audio: await packGroup("audio", "audio/*/*.mp3", false),
  strokes: await packGroup("strokes", "strokes/*/*.json", true),
};
if (!(offlineFiles.audio.files.length && offlineFiles.strokes.files.length)) {
  throw new Error("Offline practice files are missing");
}
await Bun.write(
  resolve(publicDirectory, OFFLINE_FILES_URL.slice(1)),
  JSON.stringify(offlineFiles)
);
console.info(
  `Service worker: ${result.count} files, ${result.size} bytes precached`
);
