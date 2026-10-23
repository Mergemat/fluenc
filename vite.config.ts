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

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    // Production builds write here; reloading the dev tab for them is noise.
    watch: { ignored: ["**/.output/**", "**/.vercel/**"] },
  },
  environments: {
    client: {
      build: {
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
    nitro(),
    viteReact(),
  ],
});
