import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart({
      prerender: { enabled: true, autoStaticPathsDiscovery: false },
      pages: [{
        path: '/',
        prerender: {
          outputPath: '/offline',
          autoSubfolderIndex: false,
          crawlLinks: false,
          // Render Start's document shell without a learner snapshot or server loaders.
          headers: { 'X-TSS_SHELL': 'true' },
        },
      }],
    }),
    nitro(),
    viteReact(),
  ],
})
