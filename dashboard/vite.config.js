import tailwindcss from '@tailwindcss/vite'
import devtools from 'solid-devtools/vite'
import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
  plugins: [tailwindcss(), devtools(), solidPlugin()],
  build: {
    outDir: 'build',
    emptyOutDir: true,
    target: 'esnext',
  },
  server: {
    port: 3000,
    strictPort: true,
    cors: false,
    proxy: {
      '^/api': {
        target: 'http://localhost:8080',
        ws: true,
      },
    },
  },
})
