import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type Plugin } from "vite";

// The course data is large. Shipped as a string for JSON.parse, it is read several times faster
// than the same object written out as JavaScript.
const GENERATED_JSON = /\.generated\.json$/;
const parsedJson = (): Plugin => ({
  name: "fluenc:parsed-json",
  enforce: "pre",
  async resolveId(source, importer) {
    if (!GENERATED_JSON.test(source)) {
      return null;
    }
    const resolved = await this.resolve(source, importer, { skipSelf: true });
    // Not ending in .json, so Vite's own JSON plugin leaves it alone.
    return resolved ? `\0parsed:${resolved.id}.js` : null;
  },
  async load(id) {
    if (!id.startsWith("\0parsed:")) {
      return null;
    }
    const file = id.slice("\0parsed:".length, -".js".length);
    this.addWatchFile(file);
    const text = await readFile(file, "utf8");
    return `export default JSON.parse(${JSON.stringify(JSON.stringify(JSON.parse(text)))});`;
  },
});

const DAY = 24 * 60 * 60;

/** A short hash of a folder's files: their names and bytes. */
function versionOf(dir: string, extension: string) {
  const hash = createHash("sha1");
  for (const name of readdirSync(dir)
    .filter((file) => file.endsWith(extension))
    .sort()) {
    hash.update(name);
    hash.update(readFileSync(`${dir}/${name}`));
  }
  return hash.digest("hex").slice(0, 12);
}

// Recordings are served under a path named by their content, so a device keeps each one for good
// and fetches it again only when they change.
const versioned = {
  audio: {
    dir: "assets/audio",
    url: `/audio/${versionOf("assets/audio", ".mp3")}`,
  },
};

// Files in these folders are served by Vercel's CDN. A missing one answers 404 there too, instead
// of starting the server to render a not-found page. Every request to the CDN is billed, so the
// browser keeps each file a while rather than asking again on every use.
const staticFolders = {
  brand: DAY,
  licenses: DAY,
};

const FONT_CHUNK = /\/assets\/fonts\/web\/[^/]+\/\d+\.woff2$/;

export default defineConfig({
  resolve: { tsconfigPaths: true },
  define: {
    "import.meta.env.FLUENC_AUDIO": JSON.stringify(versioned.audio.url),
  },
  server: {
    // Production builds write here; reloading the dev tab for them is noise.
    watch: { ignored: ["**/.output/**", "**/.vercel/**"] },
  },
  environments: {
    client: {
      build: {
        // `bun run bench --profile` reads function names from the profile.
        minify: process.env.FLUENC_UNMINIFIED !== "1",
        // A font chunk is fetched only when its characters are on screen; inlined, every page would
        // download it.
        assetsInlineLimit: (file) =>
          FONT_CHUNK.test(file) ? false : undefined,
        rolldownOptions: {
          // The course catalog and sentences ship with the app. Their own chunks keep their hash,
          // so a code change does not re-download the course.
          output: {
            codeSplitting: {
              groups: [
                { name: "curriculum", test: /curriculum\.generated\.json/ },
                { name: "sentences", test: /sentences\.generated\.json/ },
              ],
            },
          },
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      "@ionic/core/components",
      "@ionic/core/components/ion-content.js",
      "@ionic/core/components/ion-refresher.js",
      "@ionic/core/components/ion-refresher-content.js",
      "@lit/react",
    ],
  },
  plugins: [
    parsedJson(),
    tailwindcss(),
    tanstackStart({
      prerender: { enabled: true, autoStaticPathsDiscovery: false },
      pages: [
        {
          path: "/",
          prerender: {
            outputPath: "/offline",
            autoSubfolderIndex: false,
            crawlLinks: false,
            // Render Start's document shell without a learner snapshot or server loaders.
            headers: { "X-TSS_SHELL": "true" },
          },
        },
      ],
    }),
    nitro({
      publicAssets: [
        ...Object.entries(staticFolders).map(([folder, maxAge]) => ({
          baseURL: `/${folder}`,
          dir: `public/${folder}`,
          maxAge,
        })),
        ...Object.values(versioned).map(({ dir, url }) => ({
          baseURL: url,
          dir,
          maxAge: 365 * DAY,
        })),
      ],
      routeRules: {
        // Offline packs are named by their content (see scripts/build.ts).
        "/offline/**": {
          headers: { "cache-control": "public, max-age=31536000, immutable" },
        },
        // iOS asks for these names too; one icon answers all of them.
        "/apple-touch-icon-precomposed.png": {
          redirect: { to: "/apple-touch-icon.png", status: 301 },
        },
        "/brand/apple-touch-icon.png": {
          redirect: { to: "/apple-touch-icon.png", status: 301 },
        },
      },
      vercel: {
        // A request stuck on a slow upstream stops here instead of billing up to five minutes.
        functions: { maxDuration: 60 },
      },
    }),
    viteReact(),
  ],
});
