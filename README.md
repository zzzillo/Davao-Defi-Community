# Davao-Defi-Community

Community website for the Davao DeFi Community.

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

## One-time setup

### Backend

```sh
cd backend
python -m venv .venv
.venv/Scripts/pip install fastapi uvicorn "sqlalchemy[asyncio]" psycopg alembic python-dotenv clerk-backend-api svix
```

> There is no `requirements.txt` yet, so the install list above is the source of
> truth. Current versions: fastapi 0.141.1, uvicorn 0.52.2, SQLAlchemy 2.0.52,
> psycopg 3.3.4, alembic 1.19.1, python-dotenv 1.2.2, clerk-backend-api 7.0.0,
> svix 1.99.1.

Create `backend/.env` (see `backend/.env.example`):

```
DATABASE_URL=postgresql://...        # Neon connection string
CLERK_SECRET_KEY=sk_test_...         # Clerk Dashboard > API keys
CLERK_WEBHOOK_SIGNING_SECRET=whsec_... # filled in during "Clerk webhooks" below
```

Apply migrations:

```sh
.venv/Scripts/alembic upgrade head
```

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
.venv/Scripts/python -m app.main
```

Use `-m app.main`, not `python app/main.py`. The latter puts `backend/app/` on
`sys.path` instead of `backend/`, which breaks the `from app.…` imports.

Runs with `reload=True`, and on Windows pins uvicorn to `SelectorEventLoop` —
psycopg's async driver cannot run on the default `ProactorEventLoop`.

### 2. Frontend — http://localhost:5173

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

`/webhooks/clerk` is deliberately **not** behind `get_current_clerk_user` —
there is no logged-in user on a webhook. It authenticates the *sender* by
signature instead.

## Migrations

```sh
cd backend
.venv/Scripts/alembic revision --autogenerate -m "describe the change"
.venv/Scripts/alembic upgrade head
.venv/Scripts/alembic check          # verifies models and database agree
```

Always read the generated file before applying it. Autogenerate compares models
to the live database and guesses intent — renames in particular look like
drop-plus-add, which loses data.

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
