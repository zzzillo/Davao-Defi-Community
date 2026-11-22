import { defineConfig } from 'vitest/config'
import { mergeConfig } from 'vite'
import viteConfig from './vite.config.ts'

// vite.config.ts exports a function of the mode, and mergeConfig only merges
// plain objects, so resolve it for the current run before merging.
export default defineConfig((env) => mergeConfig(
  viteConfig(env),
  {
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      clearMocks: true,
      restoreMocks: true,
    },
  },
))
