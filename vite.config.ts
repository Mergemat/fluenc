import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

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
          // The course catalog ships with the app. Its own chunk keeps its hash, so a code change
          // does not re-download the course.
          output: {
            codeSplitting: {
              groups: [
                { name: "curriculum", test: /curriculum\.generated\.json/ },
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
