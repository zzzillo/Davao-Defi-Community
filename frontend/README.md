# Frontend

The DDC website frontend is a React and TypeScript single-page app built with
Vite. It serves the public site and the Clerk-authenticated management portal.

## Local development

```sh
npm ci
cp .env.example .env
npm run dev
```

Vite serves the app at <http://localhost:5174>. The API defaults to
`http://127.0.0.1:8000`. Set `VITE_API_URL` in `.env` to use a different API
address and set `VITE_CLERK_PUBLISHABLE_KEY` to enable sign-in. Do not commit
`.env` or paste secrets into issues or pull requests. See the root
[README](../README.md) for complete local setup, webhook, and database steps.

## Useful commands

```sh
npm test             # run frontend unit tests
npm run lint         # lint the frontend
npm run build        # type-check and build the full app
npm run build:landing # build the standalone landing page entry
npm run optimize:landing  # regenerate responsive landing image variants
```

Landing photos and fallback partner logos are generated as WebP variants from
the original assets. When changing those originals, commit the generated files
and `src/data/landingImages.ts` with them. The generator and source inventory
are in `scripts/optimize-landing-images.mjs`.

## Architecture notes

Authenticated resource data is cached in memory and refreshed after backend
SSE notifications. The landing page can use the cached R2 snapshot endpoint.
Deployment details and the environment variable reference are maintained in
the root [README](../README.md).
