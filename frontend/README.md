# Frontend application

Run `npm run dev` from this folder and open http://localhost:5174. This is the single frontend development server and serves the full DDC app, including public routes and the Clerk-powered Portal. If port 5174 is occupied, Vite exits instead of starting on another port. Live content requires the backend at `VITE_API_URL` (defaults to `http://127.0.0.1:8000`), and Portal sign-in requires `VITE_CLERK_PUBLISHABLE_KEY` in `.env` plus a configured backend. The `/landing.html` entry remains available for existing landing page preview links.

## Resource caching and live updates

Resource hooks cache API responses in memory by resource, query parameters, and
management identity (database user, Clerk identity, role, and account status).
Cached lists and details stay visible during background revalidation. Successful
content writes invalidate the affected public and current-management caches;
account switches, role/status changes, and signout clear management entries.

While a database-backed account is signed in, the app connects to the backend's
authenticated `/realtime/events` SSE endpoint with the Clerk bearer token.
PostgreSQL changes invalidate Events, Recaps, Blogs, Partners, Users, public
contributors, and Dashboard totals as applicable. The stream reconnects after
network loss, and the app revalidates when the tab returns to the foreground.
No stream runs for signed-out sessions, and closing the app aborts the stream.

## Landing images

Landing photos use generated WebP widths with responsive `srcSet`/`sizes`.
Raster partner logos are bounded to 352 × 112 pixels (twice the maximum
display size); existing vector logos stay as SVGs. The contributor collage
keeps separate portrait and landscape sources.

After changing an original photo or logo, run:

```sh
npm run optimize:landing
npm run build:landing
```

The image inventory and encoding settings live in
`scripts/optimize-landing-images.mjs`. Commit its generated files in
`src/assets/landing/` and `src/data/landingImages.ts` alongside source changes.
Generation is a development step; production builds use the committed assets
and do not need to process images. Original assets remain available for other
pages. `LandingImage` supplies intrinsic dimensions, lazy loading, and async
decoding; each section supplies `sizes` for its layout. For `object-cover`
containers, account for the source's cropped width when setting `sizes`.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
