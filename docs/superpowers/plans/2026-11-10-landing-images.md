# Landing image optimization

Goal: reduce landing-page image transfers while preserving its photos, crops,
responsive layout, and current animations.

- [x] Capture a mobile and desktop baseline on the existing landing preview.
- [x] Generate WebP variants from the existing source images with
  Sharp, a development-only dependency. Keep the original assets available.
  Use 480/768/1152/1536px photo widths without upscaling, landscape collage variants, and
  raster logos bounded to twice their CSS display size. Preserve SVG logos.
- [x] Generate typed image metadata with Vite imports, intrinsic dimensions,
  and width descriptors. Use a small shared landing image component and
  section-specific `sizes` values. Preserve the collage's mobile art direction.
- [x] Retain lazy loading and async decoding; ensure a carousel image fallback
  clears its responsive candidates before switching source.
- [x] Document regeneration, check both app entries, lint changed components,
  and inspect mobile/desktop loading, image failures, and layout in a browser.
- [x] Compare cold-context image response bytes with the same scrolling sequence.

Validation uses the real browser and production assets; this reversible asset
and markup change does not need a new unit-test framework.

## Verification

- `npm run build:landing` passes.
- ESLint passes for the eight changed landing components and generated metadata.
- TypeScript app checks pass with `--noUnusedLocals false`; the normal full app
  build stops on the pre-existing unused `adminOnlyPermissions` declaration in
  `src/pages/officials/Users.tsx:10`. The node TypeScript project passes normally.
- Browser checks cover 375/390/639/640/768/1440/1920px widths, including DPR 2/3,
  portrait/landscape selection, broken images, horizontal overflow, carousel
  advancement, and deliberately failed photo/SVG requests exercising fallbacks.
- Before/after screenshots inspected for the event cards, top section, and
  contributor collage. The first real carousel photo loads eagerly with high
  priority; other photos retain lazy loading.

Distinct image payloads encountered during the same scroll sequence in fresh
Chromium contexts (production landing preview, reduced motion, external font
requests blocked equally in both runs):

| Viewport | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| 390 × 844, DPR 2 | 2,880,882 bytes | 1,597,867 bytes | 45% |
| 1440 × 900, DPR 1 | 3,231,054 bytes | 1,420,638 bytes | 56% |

These are image-payload comparisons, not field Core Web Vitals or page-load
time measurements. Generated assets are checked into source control when the
change is committed; no commit or deployment was made during this task.
