import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    build: {
      // electron-vite leaves the renderer unminified by default; that was ~675 kB of JS.
      minify: true,
      rollupOptions: {
        output: {
          // Third-party code changes rarely, so keep it in its own cacheable chunk.
          manualChunks(id: string): string | undefined {
            if (id.includes('node_modules')) return 'vendor'
            return undefined
          }
        }
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
