# Security improvements implementation plan

> **For agentic workers:** Use the executing-plans skill to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add practical abuse controls and browser hardening to the deployed DDC web app while preserving its public landing snapshot and existing public content routes.

**Architecture:** Keep the landing snapshot, resized image variants, public directories, and published detail pages public. Add shared rate limiting and request-size enforcement at the FastAPI boundary, keep the API's existing Clerk and permission checks as the authorization layer, and configure browser response headers at Vercel. Disable public API documentation in production while retaining it for development. Confirm the runtime database role and deployment settings before making infrastructure changes.

**Tech Stack:** FastAPI/Starlette, Redis-compatible Render Key Value (Valkey), Render, Vercel `vercel.json`, pytest, and the existing React/Vite frontend.

---

## Production baseline and constraints

- The live frontend and backend were both deployed from commit `1ea0e5d1858b1df1afe5b6c04b96c157a3c465d4` during this review. The local checkout is older and has unrelated uncommitted changes; implementation must begin from a current branch containing the deployed code and must preserve those local edits.
- The live frontend already sends `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`. Keep it; do not add a second HSTS policy.
- The public landing snapshot and `/r2/` image proxy are intentional. Their public cache behavior, selected published content, and absence of browser credentials are requirements, not gaps.
- The live API permits the production frontend origin and rejects an unrelated origin. Preserve the allowlist; do not replace it with wildcard origins.
- The API is served directly from `ddc-api-yo88.onrender.com`, so Vercel firewall rules do not protect API routes. The Render service currently has public ingress and one instance. The deployed commit contains no application rate limiter.
- The live API currently returns `200` for `/docs` and `/openapi.json`; `/auth_test` returns `401` without a token.
- Vercel's `staging` branch deployment is a protected Preview; `main` remains the Production branch. Preview deployments are enabled so staging can be used before promoting changes to `main`. Render has one API service tracking `main`; this plan does not add a second backend, database, Clerk instance, or R2 bucket.

## Files and responsibilities

- Modify `backend/app/config.py` to load explicit environment, limiter, and request-size settings without exposing secret values.
- Create `backend/app/security/rate_limits.py` for the shared Redis-compatible limiter and identity-key rules.
- Modify `backend/app/main.py` to initialize and close the shared limiter client, install request-size enforcement, and configure production docs behavior.
- Modify `backend/app/routers/users.py`, `backend/app/routers/media.py`, `backend/app/routers/admin.py`, `backend/app/routers/activity_logs.py`, `backend/app/routers/realtime.py`, public list routers, and `backend/app/routers/webhooks.py` to apply route-specific limits and body caps.
- Modify `backend/requirements.txt` to add the Redis-compatible async client, pinned to a compatible release.
- Create focused backend tests under `backend/tests/` for rate-limit keys, `429` behavior, size-limit `413` responses, and production documentation settings.
- Modify `frontend/vercel.json` to add missing response headers while preserving the current snapshot cache headers and image proxy rewrite.
- Update `README.md` with required production environment settings, deployment order, and recovery behavior.

## Task 0: Use the existing staging Preview without adding infrastructure

**Files:**

- Update deployment documentation in `README.md` to explain staging Preview versus main Production.
- Keep the existing production API service on Render tracking `main` and the Vercel staging frontend Preview.
- Reuse the existing public API and data for read-only frontend checks; do not provision duplicate staging services or data stores.

- [x] **Step 1: Keep the environment roles clear.** Confirm Vercel's Production Branch stays `main`; `staging` is a protected frontend Preview. Keep the existing Render API service on `main`.
- [ ] **Step 2: Check frontend behavior in the staging Preview.** Use the existing API and public data for read-only checks of the landing snapshot, images, routing, and browser response headers. Do not use the Preview to exercise writes against production data.
- [ ] **Step 3: Verify backend changes before deployment.** Run backend unit and integration checks locally/CI against the existing test database and a mocked or local limiter store. Do not run load tests, mutate production records, or apply test migrations to the production database.
- [ ] **Step 4: Promote after checks pass.** Merge the verified `staging` commit into `main`; the existing Render API service and Vercel production site deploy from `main`.

## Task 1: Add shared, route-specific API rate limits

**Files:**

- Create `backend/app/security/__init__.py`.
- Create `backend/app/security/rate_limits.py`.
- Modify `backend/app/config.py`.
- Modify `backend/app/main.py`.
- Modify `backend/app/routers/users.py`, `backend/app/routers/media.py`, `backend/app/routers/webhooks.py`, `backend/app/routers/events.py`, `backend/app/routers/posts.py`, `backend/app/routers/blogs.py`, `backend/app/routers/partners.py`, `backend/app/routers/admin.py`, `backend/app/routers/activity_logs.py`, and `backend/app/routers/realtime.py`.
- Modify `backend/requirements.txt`.
- Create `backend/tests/test_rate_limits.py`.

- [x] **Step 1: Define and document the initial route policy.** Configure separate policies for public list/search reads, authenticated writes, `/users/sync`, `/media/uploads`, and `/webhooks/clerk`. Use the current Render service's observed request logs to choose thresholds; avoid imposing a low IP-only ceiling on public GETs because community members may share NAT addresses. Configure burst and sustained windows separately where needed. *(The available seven-day request-log query returned no rows; conservative initial defaults are documented for tuning.)*
- [x] **Step 2: Add a Redis-compatible shared store.** Add an async Redis client dependency and use a Render Key Value internal connection URL from a server-only environment variable. Use atomic operations with expiring keys, bounded key names, and no token or secret material in keys or logs. Rate-limit identities should use the verified local user ID for authenticated activity and a client address only for anonymous traffic.
- [x] **Step 3: Resolve client IPs from trusted proxy metadata only.** Confirm which forwarded header Render controls for requests to this service. Ignore caller-supplied forwarding headers unless they are overwritten by the trusted ingress. Add a test proving that an arbitrary `X-Forwarded-For` value cannot bypass an IP limit.
- [x] **Step 4: Wire client lifecycle and configured limits.** Initialize one async client during FastAPI lifespan startup and close it on shutdown. Return `429` with a `Retry-After` value when an action exceeds its policy. Add a health signal/log for limiter connectivity without returning Redis addresses or credentials.
- [x] **Step 5: Protect the expensive paths first.** Add the tightest user-keyed limits to `/users/sync` and `/media/uploads`; add the public-read policy to list/search routes; add user-keyed limits to `/admin` and other authenticated writes; cap new `/realtime/events` connections per user to control reconnect floods. Apply a webhook delivery ceiling only after confirming it accommodates Clerk retries and normal event bursts. Preserve existing Clerk verification, permission dependencies, upload authorization, and webhook event deduplication.
- [x] **Step 6: Test limit behavior and failure modes.** Mock the shared store in unit tests. Verify counts are isolated by user or anonymous client, a limit produces `429` and retry metadata, expiry permits later requests, bogus forwarding headers do not change identity, and backend store failure follows the documented policy. Fail closed for expensive authenticated operations; preserve public GET availability with a conservative per-process fallback and an alert if the shared store is unavailable.
- [ ] **Step 7: Deploy the shared store before the production API.** Create the smallest suitable Render Key Value instance in the API's region, configure its internal connection URL as a secret environment variable, test locally with a compatible store, then merge to `main` and deploy the API. Render lists a free 25 MB tier, which is enough to trial expiring rate-limit keys, but its data is non-persistent; counters resetting after a restart is an accepted limitation for rate limits. [Render Key Value documentation](https://render.com/docs/key-value), [Render pricing](https://render.com/pricing)

## Task 2: Bound API request bodies

**Files:**

- Create `backend/app/security/request_limits.py`.
- Modify `backend/app/main.py`.
- Modify `backend/app/routers/webhooks.py`.
- Preserve `backend/app/routers/media.py`'s existing bounded 10 MB image streaming.
- Create `backend/tests/test_request_limits.py`.

- [x] **Step 1: Add a streaming ASGI request-size guard.** Reject requests with a declared `Content-Length` above the configured limit before parsing; also count streamed chunks so a missing or false length cannot bypass the guard. Use `413` and a stable error reason. Do not read and buffer the request a second time in middleware.
- [x] **Step 2: Set route-aware limits.** Use a default 1 MiB ceiling for JSON request bodies, which accommodates the 100,000-character blog body plus JSON overhead. Give `/webhooks/clerk` an explicit 1 MiB ceiling before Svix verification. Leave `/media/uploads` on its existing 10 MiB streaming path and retain its decoded-image pixel cap.
- [x] **Step 3: Test both declared and streamed sizes.** Verify oversized declared bodies are rejected without reading the body, oversized chunked bodies are stopped during streaming, ordinary JSON within the limit reaches validation, webhook signatures still verify for bounded payloads, and image uploads continue to accept valid files up to their current limit.

## Task 3: Harden production browser responses and API docs

**Files:**

- Modify `frontend/vercel.json`.
- Modify `backend/app/config.py` and `backend/app/main.py`.
- Create `backend/tests/test_production_docs.py`.
- Update deployment notes in `README.md`.

- [ ] **Step 1: Keep the live HSTS policy and add safe headers.** Add `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a frame restriction (`Content-Security-Policy: frame-ancestors 'none'`, with `X-Frame-Options: DENY` for older clients) to the general Vercel response rule. Preserve the dedicated snapshot cache headers and `/r2/:path*` rewrite/cache rule. Do not add `X-XSS-Protection`.
- [ ] **Step 2: Roll out CSP in report-only mode first.** Add a report-only policy for HTML responses after inventorying actual sources in the production bundle: Clerk's configured frontend API/script hosts, the deployed API host, Google Fonts, Photon, and the inline theme initialization. Use a hash or nonce for the inline script instead of allowing all inline scripts. Check browser reports for sign-in, landing, image, and admin flows before enforcing CSP.
- [ ] **Step 3: Hide interactive API documentation in production.** Add a boolean setting that defaults to docs enabled in development and disabled in production. Configure FastAPI's `docs_url`, `redoc_url`, and `openapi_url` from that setting at app construction. Keep authorization independent of this setting.
- [ ] **Step 4: Verify regression boundaries.** Tests should prove production docs and OpenAPI return `404`, development docs remain available, CORS still allows the production origin and rejects an unrelated origin, the landing snapshot remains anonymous and cacheable, and the image proxy still serves the current public variants.
- [ ] **Step 5: Deploy and inspect real responses.** Deploy the frontend to the protected Preview first. Inspect frontend headers for `/`, `/landing.html`, the snapshot, and a proxied image; verify no security header changes the cache policy or blocks assets. Verify backend docs behavior locally/CI before deploying the API to `main`, then check the production API after deployment.

## Task 4: Verify database privilege separation and dependency monitoring

**Files:**

- Review `backend/app/database.py`, `backend/alembic/env.py`, and environment configuration in Render without displaying secret values.
- If runtime and migration credentials are shared, modify `backend/app/config.py`, `backend/app/database.py`, `backend/alembic/env.py`, `backend/.env.example`, and `README.md` to separate them.
- Add repository-native dependency scanning configuration only after checking existing GitHub workflow settings.

- [ ] **Step 1: Identify the effective database role without revealing credentials.** In the controlled deployment environment, check only the PostgreSQL role name and ownership/grant properties for the runtime connection. Do not print connection strings or secret values into logs or chat.
- [ ] **Step 2: Separate roles if the runtime credential owns the schema.** Create a non-owner application role with only the table, sequence, and function privileges needed at runtime, including the existing notification/listener behavior. Keep migration credentials in a separate server-only variable. Verify the app works with the restricted role before rotating away from the old runtime credential.
- [ ] **Step 3: Add automated dependency alerts.** Check whether GitHub Dependabot or equivalent scanning already covers `backend/requirements.txt` and `frontend/package-lock.json`. If not, enable version and security updates for both ecosystems and make CI report dependency audit findings without logging environment secrets.

## Release order and acceptance criteria

1. Start from a branch containing deployed commit `1ea0e5d` and preserve the existing local changes; do not reset or overwrite the current working tree.
2. Complete Task 0; use staging Preview for frontend and read-only integration checks.
3. Verify backend controls locally/CI against test fixtures and the test database.
4. Merge the verified change to `main`, deploy the shared limiter store, and deploy production API/frontend.
5. Verify database role separation as a separate controlled change; perform it only if the deployed runtime credential is over-privileged.
6. Confirm anonymous landing snapshot and image requests still return `200`, retain the 45-second snapshot edge cache, and disclose no private fields.
7. Confirm unrelated CORS origins remain rejected, protected API routes still return `401` without authentication, and role checks still gate writes.
8. Confirm rate limits return `429` with a usable retry interval, oversized JSON/webhook bodies return `413`, and current valid image uploads remain within the existing 10 MB/pixel boundaries.
9. Confirm HSTS remains present, the new response headers are present, CSP violations are reviewed before enforcement, and production API docs are unavailable unless deliberately re-enabled.

## Scope exclusions

- Do not authenticate or privatize the landing snapshot, public R2 variants, public directories, or published detail pages.
- Do not put Clerk, database, or R2 credentials in frontend variables or responses.
- Do not change the snapshot contents, selected published fields, or 45-second cache window as part of this work.
- Do not treat CORS as authorization or use IP allowlisting to make a deliberately public API private.
