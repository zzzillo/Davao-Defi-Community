# Davao-Defi-Community

Community website for the Davao DeFi Community.

The repository is public and accepts pull requests. Read
[CONTRIBUTING.md](CONTRIBUTING.md) before opening one. The project does not yet
include a license; until one is chosen, public visibility should not be taken
as permission to reuse the code.

| Layer | Stack |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | FastAPI |
| Database | Neon PostgreSQL |
| ORM / migrations | SQLAlchemy 2.x (async) + Alembic |
| Auth | Clerk |

Clerk owns identity (credentials, sessions). Neon owns application data (profile,
team). The two are joined by `clerk_user_id` — no credential is ever stored in
our database.

## Requirements

- Python 3.12 (developed on 3.12.10)
- Node 20+ (developed on 24.18.1)
- A Neon PostgreSQL database
- A Clerk application (development instance)

## Project layout

- `frontend/` — React single-page app and Vite configuration.
- `backend/` — FastAPI API, database models, migrations, and API tests.
- `.github/` — issue forms and the pull request template.

## Checks before a pull request

Run the checks for the part you changed:

```sh
# Frontend
cd frontend
npm test
npm run lint
npm run build

# Backend (from the repository root, with backend/.venv active)
cd backend
python -m unittest discover -s tests
```

Some backend integration tests require the isolated database described in
`backend/.env.test.example`; never point test commands at production data.

## One-time setup

### Backend

```sh
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-test.txt
```

On Windows PowerShell, use `py -3.12 -m venv .venv`, then install with
`.\\.venv\\Scripts\\python.exe -m pip install -r requirements-test.txt`.
Pinned direct dependencies live in `backend/requirements.txt`; the test file
adds the ASGI client. Cross-platform setup, isolated test database checks, and
the Stage 1 schema handoff are in [backend/STAGE1_HANDOFF.md](backend/STAGE1_HANDOFF.md).

Create `backend/.env` (see `backend/.env.example`):

```
DATABASE_URL=postgresql://...        # Neon connection string
MIGRATION_DATABASE_URL=              # Optional locally; production-only owner credential for Alembic
DATABASE_LISTEN_URL=                 # Optional direct PostgreSQL URL for LISTEN/NOTIFY
CLERK_SECRET_KEY=sk_test_...         # Clerk Dashboard > API keys
CLERK_WEBHOOK_SIGNING_SECRET=whsec_... # filled in during "Clerk webhooks" below
ALLOWED_ORIGINS=http://localhost:5174,http://127.0.0.1:5174
```

Apply migrations:

```sh
python -m alembic upgrade head
```

Production keeps `DATABASE_URL` on a restricted runtime role. Set
`MIGRATION_DATABASE_URL` to a separate owner role and direct, non-pooled
endpoint for Alembic migrations; the API does not use this credential.
`DATABASE_URL` can remain pooled for runtime requests. The production migration
command fails closed if this separate credential is missing, uses the runtime
role, or uses a `-pooler.` endpoint. The local
development command above can continue to use `DATABASE_URL` when no migration
URL is configured. The isolated `upgrade_test_db.py` helper explicitly directs
both URLs to the validated test database.

### Frontend

```sh
cd frontend
npm install
```

Create `frontend/.env` (see `frontend/.env.example`):

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

## Running locally

Three terminals. All three must be running for signup to sync to the database.

### 1. Backend — http://127.0.0.1:8000

```sh
cd backend
python -m app.main
```

On Windows, run `.\\.venv\\Scripts\\python.exe -m app.main` from `backend/`.

Use `-m app.main`, not `python app/main.py`. The latter puts `backend/app/` on
`sys.path` instead of `backend/`, which breaks the `from app.…` imports.

Runs with `reload=True`, and on Windows pins uvicorn to `SelectorEventLoop` —
psycopg's async driver cannot run on the default `ProactorEventLoop`.

### 2. Frontend — http://localhost:5174

```sh
cd frontend
npm run dev
```

### 3. Clerk webhook tunnel

Clerk's servers cannot reach `127.0.0.1`. This opens an outbound connection to a
public relay and forwards deliveries to the local backend.

```sh
npx -y clerk@latest webhooks token          # once; prints c_xxxxxxxxxx
npx -y clerk@latest webhooks listen --token c_xxxxxxxxxx --forward-to http://localhost:8000/webhooks/clerk
```

The `--token` pins the relay URL so it survives restarts. Without it you get a
new URL each time and have to re-edit the Clerk Dashboard.

## Clerk webhooks (one-time Dashboard setup)

Events do not flow until an endpoint exists, even with the tunnel running.

1. Clerk Dashboard → **Configure → Webhooks → Add Endpoint**
2. **Endpoint URL**: the relay URL printed by `webhooks listen`
   (`https://webhooks.clerk.com/in/c_…/`)
3. **Subscribe to events**: `user.created`
4. Copy the endpoint's **Signing Secret** into `CLERK_WEBHOOK_SIGNING_SECRET`
   in `backend/.env`, then **restart the backend**

## How a signup flows

```
React <SignUp />  →  Clerk creates the user
                  →  user.created webhook  →  Svix relay  →  POST /webhooks/clerk
                  →  signature verified with CLERK_WEBHOOK_SIGNING_SECRET
                  →  User row inserted in Neon
GET /users/me     →  verifies session token, finds the row by clerk_user_id
```

The webhook is asynchronous. A brand-new account can briefly get a 404 from
`/users/me` before the webhook lands — expected, not an error.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Liveness + database check |
| GET | `/auth_test` | Bearer token | Confirms Clerk token verification |
| GET | `/users/me` | Bearer token | Current user's local profile |
| POST | `/webhooks/clerk` | Svix signature | Creates the local User row |
| GET | `/realtime/events` | Bearer token | Authenticated SSE resource change notifications |

`/webhooks/clerk` is deliberately **not** behind `get_current_clerk_user` —
there is no logged-in user on a webhook. It authenticates the *sender* by
signature instead.

## Deployments and security checks

The Vercel `staging` branch creates a protected Preview deployment; `main` is
the Production branch. Preview uses the existing public API and data, so use it
for read-only checks of the landing page, images, routing, and response headers.
Do not use Preview to exercise writes against production data. Render continues
to run one API service from `main`; this setup does not require a second API,
database, Clerk instance, or media bucket.

Verify backend changes locally or in CI against the isolated test database and
a test/local rate-limit store before merging. Deploy shared production
infrastructure before the API version that depends on it. Keep service URLs,
database credentials, and limiter credentials in server-side Render variables;
never add them to `VITE_*` variables. After deployment, check health, auth and
permission behavior, rate-limit responses, body-size rejection, and API docs
visibility without modifying production content.

The API docs and OpenAPI schema are enabled by default in local development
and disabled in production. `API_DOCS_ENABLED` can explicitly override this;
leave it unset for the production default. The frontend sends a report-only CSP
using the Clerk, API, Google Fonts, Photon, and theme-bootstrap sources found in
the current build. Review browser DevTools reports on staging for landing,
images, sign-in, and admin flows before considering a stricter enforced policy.
No remote CSP report collector is configured yet.

The public landing snapshot, public image variants, public directories, and
published detail pages are intentional. Their availability and cache behavior
must remain unchanged by security headers or rate limiting.

## Cached resource reads and live refresh

The Stage 6 implementation and verification notes are in
[backend/STAGE6_HANDOFF.md](backend/STAGE6_HANDOFF.md).

React resource hooks keep successful responses in memory, keyed by resource,
query parameters, and (for management reads) the current database user, Clerk
identity, role, and account status. A cached response renders immediately while
the hook revalidates in the background. Signing out or changing account,
role, or status clears the private cache; nothing is persisted in local storage.

When the app is authenticated, the browser opens `/realtime/events` with its
Clerk bearer token. PostgreSQL triggers call `pg_notify` after a committed
insert, update, or delete on events, recaps (`posts`), blogs, partners, users,
and invitations. Notifications and SSE messages contain only the resource
name. The frontend refreshes matching queries and Dashboard totals, reconnects
after network loss, and revalidates when a hidden tab returns to the foreground.
Closing the tab closes the stream; signed-out sessions do not open one.

The backend keeps one PostgreSQL `LISTEN` connection per worker process and
fans notifications out to that worker's SSE clients. Application reads and
writes continue using `DATABASE_URL`, which may be pooled. Neon transaction
poolers accept `LISTEN` SQL but do not retain its subscription reliably; when
`DATABASE_URL` uses Neon's `-pooler.` hostname, the backend derives the direct
hostname for its listener. For other providers, set `DATABASE_LISTEN_URL` to a
direct or session-pooled PostgreSQL URL that supports long-lived `LISTEN`.
Each worker uses one such direct connection, so include one additional database
connection per running worker in provider capacity. If the listener is down,
it reconnects with backoff while SSE clients receive heartbeats; focus and
reconnect recovery refresh the active frontend data.

## Landing page snapshot

The landing page reads `landing/v1/snapshot.json` from Cloudflare R2 through
FastAPI's authenticated storage client. FastAPI publishes the cards and totals
after committed changes to public content and refreshes the featured event at
its start time. The publisher uploads the WebP variants before replacing the
snapshot. Content edits appear on new visits and reloads after the CDN cache
expires, usually within about a minute. If the snapshot request fails, the
frontend calls `/landing/v1/fallback.json`, which builds the same content from
PostgreSQL without reading R2. The first 15 partner logos are bundled as local
assets and used only on that fallback path; event and article images continue
to use their configured public URLs.

Roll out the publisher before switching the frontend to the snapshot.

The default rollout can use the project's Vercel hostname while no custom
domain is available. `frontend/vercel.json` proxies the snapshot path through
the backend's authenticated R2 client and lets Vercel cache successful
responses at the edge for 45 seconds. Snapshot errors use `no-store` so they
are retried on the next visit. Set `VITE_LANDING_SNAPSHOT_URL=/landing/v1/snapshot.json`
for production and preview builds. The `/r2/:path*` route can also proxy R2 media through Vercel;
set the backend's `STORAGE_PUBLIC_BASE_URL` to
`https://davao-defi-community.vercel.app/r2` so responsive image URLs use it.
Vercel caches media according to the immutable cache headers already set by the
uploader. The R2 development URL is rate limited, so the landing snapshot is
served through the backend instead of that public development URL.

1. For production caching and image delivery, connect a [Cloudflare custom domain](https://developers.cloudflare.com/r2/buckets/public-buckets/)
   to the existing media bucket and set the backend's `STORAGE_PUBLIC_BASE_URL`
   to that HTTPS domain. In the bucket's [CORS policy](https://developers.cloudflare.com/r2/buckets/cors/),
   allow `GET` from the production frontend origin and any intended preview
   origins. Preserve any existing CORS entries.
2. Add a [Cloudflare Cache Rule](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/)
   for the exact snapshot hostname and `/landing/v1/snapshot.json` path. Make
   it eligible for cache and respect origin headers for edge and browser TTL.
   The object sets `Cache-Control: public, max-age=0, s-maxage=45`. Ensure
   errors bypass caching and the image variants keep their immutable cache headers.
3. Run `python -m alembic upgrade head` from `backend` and deploy the backend
   with `LANDING_SNAPSHOT_ENABLED=true`. Keep the publishing process running so
   it can receive database notifications and advance events on time. Use a
   separate R2 bucket for any other database with publishing enabled.
4. Wait for `Published landing snapshot` in the backend logs on the first
   publish. Verify the backend snapshot endpoint returns valid JSON with the
   45-second cache header on success and `no-store` on errors. Request the
   Vercel snapshot path twice within 45 seconds and confirm the second response
   is served from cache.
5. Set `VITE_LANDING_SNAPSHOT_URL=/landing/v1/snapshot.json` for frontend
   builds. Verify `/` and `/landing.html` use the snapshot when available, then
   simulate a snapshot timeout while keeping PostgreSQL reachable and confirm
   the backend fallback returns landing content with local partner logos.

## Migrations

```sh
cd backend
python -m alembic revision --autogenerate -m "describe the change"
python -m alembic upgrade head
python -m alembic check          # verifies models and database agree
```

Always read the generated file before applying it. Autogenerate compares models
to the live database and guesses intent — renames in particular look like
drop-plus-add, which loses data.

### Runtime database role

The API role should not own the schema or have DDL privileges. For the current
application tables, grant only `CONNECT` on the application database, `USAGE` on
the `public` schema, and `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on the
runtime tables (`users`, `teams`, `events`, `posts`, `post_images`, `blogs`,
`partners`, `activity_logs`, `media_assets`, `clerk_webhook_events`, and
`user_invitations`). Set matching default table privileges for the migration
owner so newly created app tables remain usable by the runtime role. The current
models use application-generated UUIDs, so they do not need sequence grants;
`alembic_version` is migration-only. The listener uses PostgreSQL's built-in
`LISTEN`, `pg_notify`, and advisory-lock functions; no extra custom-function
grants are required. If `DATABASE_LISTEN_URL` is set explicitly, use the
restricted runtime role there too.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `400 Invalid webhook signature` | `CLERK_WEBHOOK_SIGNING_SECRET` doesn't match the Dashboard endpoint, or backend not restarted after editing `.env` | Re-copy the secret, restart the backend. `--reload` watches `.py` files only, not `.env` |
| `Method Not Allowed` when opening the relay URL in a browser | Browsers send GET; the relay only accepts POST | Expected. Test with the Dashboard's **Send Example** or a real signup |
| `401 session-token-missing` on `/users/me` in the browser address bar | A typed URL cannot carry an `Authorization` header | Call it from the app, which attaches the Clerk token |
| `404 User profile not found` right after signup | Webhook hasn't landed yet | Retry. If it never arrives, terminal 3 wasn't running |
| CORS error *together with* a 5xx | Starlette's error middleware sits outside `CORSMiddleware`, so unhandled exceptions return without CORS headers | Ignore the CORS message; fix the 5xx. The backend log has the real traceback |
| `psycopg cannot use ProactorEventLoop` | Windows default event loop | Already handled in `app/main.py` and `alembic/env.py`; make sure you launch via `-m app.main` |
| Backend changes have no effect; stale responses | An orphaned process still holds port 8000 | `netstat -ano \| findstr :8000` — more than one `LISTENING` row means a stale process. `taskkill /PID <pid> /F /T` |
| App-level `logger.info` lines missing from output | Uvicorn doesn't configure the root logger | Not a bug. Access logs still show the request |
