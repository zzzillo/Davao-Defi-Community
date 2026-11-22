import { defineConfig, loadEnv } from 'vite'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const frontendRoot = fileURLToPath(new URL('.', import.meta.url))
  const localProdEnv = loadEnv(mode, frontendRoot, 'DDC_LOCAL_')
  const localProdDomain = localProdEnv.DDC_LOCAL_DOMAIN
  const localProdTlsKey = localProdEnv.DDC_LOCAL_TLS_KEY
  const localProdTlsCert = localProdEnv.DDC_LOCAL_TLS_CERT
  const useLocalProdDomain = Boolean(localProdDomain && localProdTlsKey && localProdTlsCert)

  return {
    ...(useLocalProdDomain && {
      // The previous sudo-launched Vite process left root-owned files under
      // node_modules/.vite. Keep this local mode's cache in the user's home.
      cacheDir: resolve(homedir(), 'Library/Caches/DDC-Vite-Prod'),
    }),
    build: {
      manifest: true,
      rollupOptions: {
        input: {
          app: fileURLToPath(new URL('./index.html', import.meta.url)),
          landing: fileURLToPath(new URL('./landing.html', import.meta.url)),
        },
      },
    },
    server: {
      // Vite runs unprivileged on 5175. A loopback-only PF redirect maps the
      // production-looking local HTTPS origin (port 443) to this port.
      host: useLocalProdDomain ? '127.0.0.1' : undefined,
      port: useLocalProdDomain ? 5175 : 5174,
      strictPort: true,
      ...(useLocalProdDomain && {
        hmr: {
          host: localProdDomain,
          clientPort: 443,
        },
        https: {
          key: readFileSync(localProdTlsKey),
          cert: readFileSync(localProdTlsCert),
        },
        allowedHosts: [localProdDomain],
      }),
      proxy: {
        '/landing/v1/snapshot.json': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/sitemap.xml': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/r2': {
          // Mirror Vercel's /r2 rewrite. That proxy can reach R2 even when the
          // developer's browser cannot connect directly to the public r2.dev URL.
          target: 'https://davaodeficommunity.com',
          changeOrigin: true,
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      babel({ presets: [reactCompilerPreset()] }),
      {
        // `vite preview` mirrors vercel.json after scripts/promote-landing.mjs:
        // "/" is the prerendered landing page (index.html) and every other page
        // path gets the app shell (app.html). Files are served as they are.
        name: 'preview-app-shell',
        configurePreviewServer(server) {
          server.middlewares.use((request, _response, next) => {
            const pathname = request.url?.split('?')[0] ?? '/'
            if (pathname !== '/' && !/\.[A-Za-z0-9]+$/.test(pathname)) request.url = '/app.html'
            next()
          })
        },
      },
    ],
  }
})
