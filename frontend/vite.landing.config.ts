import { defineConfig, mergeConfig } from 'vite'
import appConfig from './vite.config.ts'

/** Serve the dedicated landing entry as the site root on the preview server. */
export default mergeConfig(
  appConfig,
  defineConfig({
    build: {
      outDir: 'dist-landing',
      rollupOptions: {
        input: './landing.html',
      },
    },
    plugins: [
      {
        name: 'landing-root',
        configureServer(server) {
          server.middlewares.use((request, _response, next) => {
            if (request.url === '/') request.url = '/landing.html'
            next()
          })
        },
      },
    ],
  }),
)
