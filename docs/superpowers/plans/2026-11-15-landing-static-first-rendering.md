# Landing Static-First Rendering Implementation Plan

> **For agentic workers:** Use this plan task-by-task. Keep the Vite/React app and the existing R2 snapshot and image delivery paths.

**Goal:** Serve the landing page's layout and static content as ready-to-display HTML, then fill dynamic content containers asynchronously without making first render depend on backend response time.

**Architecture:** Generate the landing HTML at build time with React server rendering, serve it at `/` and `/landing.html`, and hydrate the same React tree in the browser. Dynamic sections start with stable placeholders and share the current cached snapshot request; the R2 publisher, snapshot endpoint, and image CDN routes remain in place. Other SPA routes continue to use the current empty-shell `index.html` entry.

**Tech Stack:** Vite, React 19, React Router 7, ReactDOM server rendering and hydration, Vercel rewrites, the existing FastAPI/R2 snapshot service.

---

## Scope and invariants

- Only the landing HTML delivery and landing component render states change.
- Preserve the R2 object key `landing/v1/snapshot.json`, backend publisher, `/landing/v1/snapshot.json` endpoint, `VITE_LANDING_SNAPSHOT_URL`, `/r2/:path*` rewrite, and the backend's configured public image URL.
- The management portal and all non-landing SPA routes continue to use `index.html` and `createRoot`.
- Keep one in-flight snapshot request shared in browser module memory. It is deduplication, not a persistent browser cache. Continue relying on the existing Vercel/backend cache headers for response caching.
- This plan uses one aggregate snapshot request. Dynamic section components render independently from the page shell, but their data becomes available from the same response. Do not fan this out into multiple backend requests without a separate product need.
- If both the R2-backed snapshot and backend fallback request fail, show the bundled partner logos, keep event/recap/article sections on their skeletons, and retry the snapshot then backend fallback in the background. Do not show an unavailable message.
- Before implementation, inspect the working tree. There are existing uncommitted changes in landing and shared frontend files; carry them forward and do not reset or overwrite them.

## Files to create or update

- Create `frontend/src/landing-server.tsx`: server-render entry that renders the existing app at `/` inside React Router's static router, without mounting browser auth behavior.
- Create `frontend/scripts/prerender-landing.mjs`: build helper that loads the server entry through Vite SSR, waits for React's streamed render to complete, maps SSR development asset URLs to Vite's hashed manifest URLs, and inserts the resulting markup into the built `landing.html` root.
- Update `frontend/src/landing-main.tsx`: hydrate pre-rendered markup in production, while retaining `createRoot` for the unrendered Vite development shell.
- Update `frontend/tsconfig.app.json` to expose Node stream types to the build-only server renderer; keep that renderer out of browser entry imports.
- Update `frontend/src/pages/public/Landing.tsx`: ensure all static sections and stable dynamic section placeholders are in the first render; keep snapshot fetching in effects and keep fetch errors scoped to dynamic section content.
- Update `frontend/src/components/LandingUpcomingRSVP.tsx` to use the featured event already present in the shared snapshot instead of issuing a second event-list request from the landing page.
- Update `frontend/src/components/DeferredSection.tsx`: allow its children to appear in generated HTML; preserve its viewport-based behavior for client-only deferred work without withholding the initial static DOM.
- Update `frontend/src/hooks/useTheme.ts` so the server and first client render use a stable theme state, then read the saved theme after hydration. Update browser-only initialization in `frontend/src/components/PhotoCarousel.tsx` so server render and first client render match. Audit `frontend/src/components/LandingWhatWeDo.tsx`, `frontend/src/components/ScrollExpand.tsx`, and `frontend/src/components/Grainient.tsx` to keep their browser API usage inside effects and event handlers.
- Update `frontend/src/index.css` so no-JavaScript visitors see the scroll-reveal content in the generated HTML. Do not rely on `data-revealed` being added by an effect for basic content visibility.
- Update `frontend/landing.html`: set the production landing metadata and retain its Vite entry.
- Update `frontend/package.json`: run the prerender helper after the normal Vite build and the dedicated landing build, targeting each respective output directory.
- Update `frontend/vercel.json`: add a `/` rewrite to `/landing.html` before the SPA catch-all; preserve the current snapshot-to-backend and media-to-R2 rewrites and cache headers.
- Update `frontend/src/pages/public/Landing.test.tsx` and create `frontend/src/landing-server.test.tsx`, preserving existing working-tree edits.
- Update `backend/tests/test_production_docs.py` to assert the current snapshot-to-backend rewrite instead of the stale direct-to-R2 expectation; keep checks for the R2 image rewrite and existing cache-enabling headers.
- Update `frontend/README.md` and the landing section of root `README.md` to document the SSG build flow and explicitly state that R2 remains the dynamic data/image source.

## Task 1: Make the landing tree server-renderable

**Files:** `frontend/src/pages/public/Landing.tsx`, `frontend/src/components/DeferredSection.tsx`, `frontend/src/components/PhotoCarousel.tsx`, `frontend/src/components/LandingWhatWeDo.tsx`, `frontend/src/components/ScrollExpand.tsx`, `frontend/src/components/Grainient.tsx`, `frontend/src/hooks/useTheme.ts`, `frontend/src/index.css`.

- [x] Inspect the complete landing component tree for `window`, `document`, storage, media-query, and observer access. In `PhotoCarousel`, move the `window` and `document` reads out of `useState` initializers. Keep browser API use in effects or event handlers; initialize SSR-visible state to the same value on the server and on the first client render.
- [x] In `useTheme`, initialize `dark` to a server/client-stable value, then read `localStorage` in a mount effect before persisting later theme changes. Keep the existing early theme class script in the HTML documents so dark page colors remain set before paint.
- [x] Make the base `.scroll-reveal` CSS visible with no JavaScript. Preserve reduced-motion behavior and avoid adding a CSS hide state that can remain active if hydration fails.
- [x] Change `DeferredSection` so its section contents are present in server HTML and on the first client render. Keep observers for animation or below-the-fold work after hydration; do not use the observer to omit static DOM from the initial HTML.
- [x] Ensure data-backed sections render fixed-height placeholders before `snapshot` is available. A failed snapshot/fallback must leave the surrounding section and the rest of the page visible.
- [x] Keep `loadLandingData()` in a client effect. Do not request the backend while generating the static HTML.
- [x] Make the landing RSVP section use the snapshot's `event` value only. The direct `/events?upcoming=true&limit=1` query is redundant because the snapshot publisher already includes the featured upcoming event.
- [x] Add focused assertions that server rendering returns the hero, static section structure, and dynamic placeholders without a browser global exception or a network request.
- [x] From `frontend`, run `npm test -- src/pages/public/Landing.test.tsx src/landing-server.test.tsx`. Expected: both focused suites pass.

## Task 2: Add a build-time React renderer for the landing entry

**Files:** create `frontend/src/landing-server.tsx`; create `frontend/scripts/prerender-landing.mjs`; create `frontend/src/landing-server.test.tsx`.

- [x] In `landing-server.tsx`, render `<App />` at location `/` inside `StaticRouter` re-exported from `react-router-dom`. Do not wrap this render in `ClerkWithRouter`; the public landing markup does not require an authenticated provider.
- [x] Use React 19's `prerenderToNodeStream` from `react-dom/static`, reject postponed output, and collect its completed prelude into one HTML string. Suspense boundaries currently emit small inline reveal scripts for already-rendered component chunks; they execute while parsing HTML and do not wait for the application bundle or backend response. The Vercel policy is report-only today; revisit this if it is enforced, because those generated scripts need an explicit CSP strategy.
- [x] In the prerender helper, accept exactly one output-directory argument, read `<output-dir>/landing.html` and `<output-dir>/.vite/manifest.json`, map every `/src/assets/...` URL in the streamed markup to its exact manifest `file` URL, then replace the single `<div id="root"></div>` mount point with the rendered markup. Exit nonzero if any source asset lacks a manifest entry or if the output file/mount point is missing.
- [x] Add a server-render unit test for a representative static heading and placeholders. Confirm no snapshot endpoint is requested during generation.
- [x] From `frontend`, run `npm test -- src/landing-server.test.tsx`. Expected: the server render contains the static heading and placeholders and the test observes no snapshot request.

## Task 3: Hydrate the pre-rendered HTML in the browser

**Files:** `frontend/src/landing-main.tsx`, `frontend/src/pages/public/Landing.test.tsx`.

- [x] Build one shared React tree containing `StrictMode`, `BrowserRouter`, `ClerkWithRouter`, and `App`, matching the existing client setup.
- [x] If `#root` already contains pre-rendered nodes, call `hydrateRoot(root, tree)`. If it is empty, call `createRoot(root).render(tree)` so local Vite development still works without a prerender step. The branch should follow this shape:

  ```tsx
  const root = document.getElementById('root')!
  const tree = <StrictMode><BrowserRouter><ClerkWithRouter><App /></ClerkWithRouter></BrowserRouter></StrictMode>
  if (root.hasChildNodes()) hydrateRoot(root, tree)
  else createRoot(root).render(tree)
  ```

- [x] Keep dynamic content loading in the existing client-side `Landing` effect. Preserve the in-flight promise map and the backend fallback behavior.
- [x] Test that static landing markup remains visible while the snapshot promise is pending, dynamic sections fill when it resolves, and snapshot failure invokes the backend fallback without removing the static shell.
- [x] From `frontend`, run `npm test -- src/pages/public/Landing.test.tsx`. Expected: the delayed snapshot and fallback cases pass, with no hydration mismatch warnings.

## Task 4: Wire SSG into both Vite builds and Vercel routing

**Files:** `frontend/package.json`, `frontend/landing.html`, `frontend/vercel.json`, `backend/tests/test_production_docs.py`.

- [x] Update the production landing document title and description in `landing.html`; keep its `landing-main.tsx` entry and existing font preconnects.
- [x] Append `node scripts/prerender-landing.mjs dist` to the standard production build after `vite build` completes.
- [x] Append `node scripts/prerender-landing.mjs dist-landing` to `build:landing` after its Vite build completes, so its preview output has the same rendered markup.
- [x] Add the exact-root Vercel rewrite `{ "source": "/", "destination": "/landing.html" }` before the catch-all rewrite. Do not change the existing `/landing/v1/snapshot.json` or `/r2/:path*` destinations or their headers.
- [x] Update `backend/tests/test_production_docs.py` to assert that `/landing/v1/snapshot.json` rewrites to `https://ddc-api-yo88.onrender.com/landing/v1/snapshot.json`, `/r2/:path*` rewrites to the existing R2 public URL, and both routes keep their current cache-enabling headers. Remove its stale expectation that the snapshot is fetched directly from R2.
- [x] Confirm in Vercel config review that `/` rewrites to the static landing document while `/admin` and other non-file routes still reach the SPA catch-all.
- [x] From `frontend`, run `npm run build` and `npm run build:landing`. Expected: both commands exit successfully; `dist/landing.html` and `dist-landing/landing.html` contain landing markup inside `#root`.
- [x] From `backend`, run `python -m unittest tests.test_production_docs`. Expected: the Vercel rewrite and header assertions pass.

## Task 5: Document operation and cache behavior

**Files:** `frontend/README.md`, root `README.md`.

- [x] Explain that Vite generates the landing HTML at build time and React hydrates it in the browser.
- [x] Explain that the dynamic sections still use the single R2-backed snapshot request and the backend fallback; static HTML generation does not query R2 or PostgreSQL.
- [x] Explain that `landing/v1/snapshot.json`, the `/r2` image proxy, and existing CDN caching remain unchanged.
- [x] Document that the dedicated landing build must run its prerender step after Vite, and that the main SPA fallback remains for other routes.

## Acceptance checks

- The production response for `/` contains visible landing HTML inside `#root` before JavaScript runs, and all local image URLs reference existing hashed files from the Vite build.
- The response for `/landing.html` contains the same static landing HTML.
- With the snapshot request delayed, the page layout, hero, static imagery, and dynamic-section placeholders remain visible; resolved data fills the relevant sections afterward.
- When the snapshot fails, the frontend still tries the existing backend fallback and does not remove the static page shell.
- `/admin` and other SPA routes still load the existing application entry.
- Snapshot and image traffic still use the existing backend/R2/Vercel routes and cache policy.
- Hydration emits no mismatch warnings on `/` or `/landing.html`.
