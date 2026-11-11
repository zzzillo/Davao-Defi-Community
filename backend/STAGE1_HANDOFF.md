# Stage 1: database foundation handoff

Stage 1 prepares the backend for member profiles, invitations, media metadata,
and scoped activity records. It does not add Clerk invitation calls, R2 uploads,
member endpoints, seed data, or authorization changes. The app database role is
still a mirror; existing request authorization continues to read the Clerk
session claim. `superadmin` is present as a stored role value and fails closed
under the current role gates until a later stage defines its permissions.

## Python setup

Use Python 3.12. The direct application dependencies are pinned in
`requirements.txt`; `requirements-test.txt` adds the pinned HTTP client used by
the standard library test suite.

### macOS / Linux

```sh
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-test.txt
cp .env.example .env
```

### Windows PowerShell

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-test.txt
Copy-Item .env.example .env
```

Fill in only the integrations needed for the action you are running. The
`/health` route needs a working `DATABASE_URL`; it does not need Clerk keys or
R2 credentials. `ALLOWED_ORIGINS` accepts a comma-separated list. The example
includes Vite port 5174 for both `localhost` and `127.0.0.1`.

## Database URL and health behavior

`DATABASE_URL` may use `postgres://`, `postgresql://`, or
`postgresql+psycopg://`. App sessions and Alembic use the same normalizer. The
app can be imported before the URL is configured; `/health` returns HTTP 503
with a generic reason for missing, malformed, or unreachable database settings.
It returns HTTP 200 after `SELECT 1` succeeds.

The test target is kept separately in the ignored `backend/.env.test`. The
tracked `backend/.env.test.example` contains a harmless loopback placeholder.
Before running a live test-database command, validate the target with:

```sh
python scripts/upgrade_test_db.py --check-only
```

The migration script reads `TEST_DATABASE_URL` and the remote opt-in only from
`.env.test`; it reads the app database setting separately for isolation checks.
It validates the test target before using it and requires a PostgreSQL database
name ending in `_test`.
For remote hosts it also requires `ALLOW_REMOTE_TEST_DATABASE=true`, a separate
host/branch from `DATABASE_URL`, and a different normalized URL. For Neon,
create an isolated test branch and use a dedicated `ddc_stage1_test` database
there. The automated suite does not connect to either database. To migrate the
validated test target, run `python scripts/upgrade_test_db.py`.

## Migrations

The existing nine migrations are unchanged. Their head remains in the chain,
and `b0318e2a4c71` is the new head.

Review the role values before applying the migration to a database that already
has users. The migration adds a constraint for `member`, `official`, `admin`,
and `superadmin` and deliberately does not rewrite unknown legacy values. If
the query finds a value outside that list, decide the correct mapping before
migrating:

```sql
SELECT DISTINCT role FROM users ORDER BY role;
```

Generate and inspect SQL without a database connection:

```sh
DATABASE_URL='postgresql://test:test@127.0.0.1:5432/ddc_stage1_test' \
  python -m alembic upgrade head --sql > /tmp/ddc-stage1.sql
```

Then apply to the explicitly selected database:

```sh
python -m alembic current
python -m alembic upgrade head
python -m alembic current
python -m alembic check
```

On Windows PowerShell, set `DATABASE_URL` for the command first:

```powershell
$env:DATABASE_URL = "postgresql://..."
python -m alembic current
python -m alembic upgrade head
python -m alembic current
```

## Stage 1 schema

- `users`: nullable email for existing users, unique optional public `alias`,
  job `positions` capped at two, account status, profile photo object key,
  contributions, social links, contributor directory visibility/order, and
  role constraint including `superadmin`.
- `user_invitations`: email, assigned role, optional profile details, inviter,
  Clerk invitation id, pending/accepted/revoked/expired/failed lifecycle, and
  lifecycle timestamps.
- `media_assets`: unique storage key, uploader, purpose, validation state,
  object metadata, and validation timestamps.
- `activity_logs`: owner and a private/shared/user-management audience label so
  future scoped feeds can still identify ownership after content deletion.

No records are seeded. Uploaded bytes remain outside PostgreSQL.

## Offline checks

From `backend/`:

```sh
python -m unittest discover -s tests -v
python scripts/upgrade_test_db.py --check-only
```

The unittest suite imports the full app with database, Clerk, and R2 settings
unset and dotenv loading disabled; checks the health 503 response; validates
model constraints and test URL safety; and renders the full migration chain as
offline PostgreSQL SQL. It does not use your configured Neon databases.

## Neon verification — November 9, 2026

After the new Neon credentials were configured:

- Verified the application and test URLs use separate compute endpoints.
- Created `ddc_stage1_test` on the separate test target and updated only the
  ignored `.env.test` connection URL.
- Applied all ten migrations to the test database first, then the application
  database. Both reached `b0318e2a4c71`.
- Ran Alembic's schema comparison against both databases; neither reported
  new upgrade operations.
- Exercised `/health` through the application's ASGI interface against the real
  application database: HTTP 200, `{"status":"ok","database":1}`.
- Confirmed all ten application tables contain zero rows. No sample records or
  accounts were inserted.
- Reran all eleven offline tests and dependency checks successfully.

The first live run identified the missing SQLAlchemy async runtime dependency;
`requirements.txt` now requests `SQLAlchemy[asyncio]` so fresh installations
include it. Local Neon URLs also use `sslnegotiation=direct` and
`gssencmode=disable` after normal negotiation timed out; SSL remains required.
No credential values are recorded in this document. Clerk onboarding, role
enforcement, and R2 uploads remain later stages.
