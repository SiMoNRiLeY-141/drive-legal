import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Use a relative base so the build works when served from GitHub Pages
  // (which serves sites under /<owner>/<repo>/). A relative base ensures
  // asset paths are resolved correctly regardless of repo path.
  base: './',
  plugins: [react()],
})
