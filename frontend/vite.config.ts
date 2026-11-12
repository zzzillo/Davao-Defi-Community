import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/landing/v1/snapshot.json': {
        target: 'https://davao-defi-community.vercel.app',
        changeOrigin: true,
      },
      '/r2': {
        // Mirror Vercel's /r2 rewrite. That proxy can reach R2 even when the
        // developer's browser cannot connect directly to the public r2.dev URL.
        target: 'https://davao-defi-community.vercel.app',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] })
  ],
})
