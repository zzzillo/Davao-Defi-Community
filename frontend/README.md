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

`VITE_R2_PUBLIC_URL` should match the backend's `STORAGE_PUBLIC_BASE_URL`.
During local development, image URLs from that host are served through Vite's
`/r2/` proxy and the site's Vercel R2 rewrite.

The production landing HTML is generated at build time and served from
`/landing.html` at the site root. React hydrates that HTML in the browser. The
prerender renders the landing page with the published snapshot (fetched from the
public API at build time and embedded in the page), so its dynamic sections ship
as real content; the browser then loads a fresh snapshot with the existing single
request. If the build cannot reach the snapshot, those sections are prerendered
as placeholders. Image URLs still use the existing R2/Vercel delivery path. The
standard build and `build:landing` both run the prerender script after Vite.
See the root README's "Landing page snapshot" section for the settings.

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

## Icons

Icons use the Material Symbols font, requested from Google Fonts as a subset:
the `icon_names=` list in `index.html` and `landing.html` names every icon the
app renders, which keeps the font at about 10 KB instead of about 3.9 MB. When
you use a new icon, add it to that list in both files, in alphabetical order.
`src/iconFont.test.ts` fails if an icon used in the source is missing.

## Architecture notes

Authenticated resource data is cached in memory and refreshed after backend
SSE notifications. The landing shell is static HTML while its dynamic content
loads from the cached R2 snapshot endpoint after hydration.
Deployment details and the environment variable reference are maintained in
the root [README](../README.md).
