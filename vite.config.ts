import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the built app works from any static host or subpath,
// including GitHub Pages project sites.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173 },
})
