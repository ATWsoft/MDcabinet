import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Build ide priamo do ../assets, odkiaľ ho servuje PHP podľa manifestu.
// `base: './'` = všetky cesty sú relatívne, takže appka funguje aj v podadresári
// domény (https://firma.sk/dokumentacia/) bez akejkoľvek rekonfigurácie.
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: '../assets',
    // Bez podadresára – výsledné URL sú potom /assets/index-xxxx.js.
    assetsDir: '.',
    emptyOutDir: true,
    manifest: 'manifest.json',
    sourcemap: false,
    // Editor aj Markdown renderer sa načítavajú až pri otvorení dokumentu
    // (React.lazy v App.tsx), preto ich držíme vo vlastných chunkoch.
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 5173,
    proxy: {
      // Dev server posiela API na PHP kontajner z docker-compose.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: false,
      },
    },
  },
})
