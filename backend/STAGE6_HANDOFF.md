# Stage 6: in-memory resource cache and realtime invalidation

## Delivered

- Added an in-memory React response cache for list and detail hooks. Keys
  include the resource, serialized parameters, and for management reads the
  database user ID, Clerk identity, role, and account status. Public entries
  use a separate `public` scope. Private entries clear when identity, role,
  status, or sign-in state changes.
- Cached responses render immediately while the hook revalidates. The hooks
  expose a `refreshing` flag, and Dashboard and Users retain cached content
  while showing a small background refresh status.
- Successful event mutations invalidate Events, Recaps, and Dashboard. Post,
  blog, and partner writes invalidate their resource plus Dashboard. User,
  role, profile, and invitation changes invalidate public contributor data,
  the current management user query, and Dashboard totals.
- The Users page's combined account and invitation query uses the same scoped
  cache. Public contributor lists/details also subscribe to user invalidations.
- Added authenticated `GET /realtime/events`, a fetch-based SSE stream that
  sends only `resource_changed` messages with `{ "resource": "..." }`. It
  never sends row IDs, content, role values, or other record fields. The
  endpoint uses the existing current-user dependency with function scope, so
  authentication and its database session finish before the stream response
  starts. It returns no-cache, unbuffered event-stream headers plus
  15-second heartbeats.
- Added migration `c1db5f4e31a8` with transactional `AFTER INSERT OR UPDATE OR
  DELETE` triggers for `events`, `posts`, `blogs`, `partners`, `users`, and
  `user_invitations`. Invitations map to `users`. PostgreSQL delivers each
  `NOTIFY` after its write transaction commits.
- FastAPI lifespan starts one listener task per worker, fans events out to
  that worker's SSE subscribers, and cancels/cleans up the listener on
  shutdown. Each subscriber coalesces pending names in a set: repeated changes
  collapse to one refresh per resource while distinct resource invalidations
  are retained during slow reads.
  Listener failures reconnect with exponential backoff up to 30 seconds. Each
  successful `LISTEN` reconnect publishes every resource name to active SSE
  subscribers, recovering cache invalidations missed while PostgreSQL was
  unavailable.
- The frontend opens one authenticated fetch stream only after Clerk and the
  database account are loaded. It closes on signout, identity changes, or
  unmount; reconnect and foreground recovery invalidate cached resources.
  `users` events also refresh the current application account so changed role
  or status takes effect promptly. Signed-out sessions have no SSE connection.

## Database listener and pooler behavior

The app keeps normal CRUD on `DATABASE_URL`. The optional `DATABASE_LISTEN_URL`
is for the long-lived PostgreSQL session that runs `LISTEN`.

On the guarded Neon `backend/.env.test` database, `LISTEN` succeeded through
the pooled host, but a notification sent through a second pooled connection
did not reach that subscription. The test branch's direct host received the
notification, including when the writer used the pooler. The service therefore
uses `DATABASE_LISTEN_URL` when configured and otherwise removes Neon's
`-pooler.` host label from a pooled URL. Providers with another transaction
pooler should set `DATABASE_LISTEN_URL` to a direct or session-pooled endpoint
that preserves listener sessions.

Each running worker opens one direct listener connection, regardless of its
number of browser subscribers. With multiple workers, PostgreSQL sends the
notification to each worker's listener and each worker fans it out locally.
Budget one additional direct connection per app worker with the database
provider. Opening an SSE stream uses a normal short-lived authentication
database checkout; its function-scoped dependency closes before the response
starts. Active SSE clients hold a socket and an in-memory subscription, not a
database connection. If the listener cannot connect, SSE remains available for
heartbeats and the listener retries; once `LISTEN` succeeds, the listener
invalidates all resources for connected browsers. Browser-focus recovery also
re-fetches active queries. Changes made while nobody is listening are not
queued by PostgreSQL.

The frontend response cache expires entries after 30 minutes and caps the
process-local map at 100 keys using least-recently-used eviction. Keys retain
their resource, parameter, and identity scope, so eviction does not combine
public and management data.

## Migration and validation isolation

The Stage 6 migration was applied only to the guarded, separate
`ddc_stage1_test` database configured in `backend/.env.test`. The application
database was not migrated, and no production deployment was performed. The
full environment should apply the migration through its normal migration
process before enabling Stage 6 notifications there.

Before migrating the isolated target, the existing script's check-only guard
passed without opening a connection:

```sh
cd backend
./.venv/bin/python scripts/upgrade_test_db.py --check-only
```

The opt-in live integration suite validates the test target name/host before
connecting. It creates prefixed test-only rows, listens on the derived direct
test host, confirms that an uncommitted write emits no notification, checks
create/update/delete delivery for each trigger resource (including invitations
as `users`), and removes its fixtures in teardown:

```sh
RUN_STAGE6_LIVE_TESTS=true ./.venv/bin/python -m unittest tests.test_stage6_realtime.Stage6LiveTriggerTests -v
```

Never set the application `DATABASE_URL` to the target database for this suite;
it uses the explicit `TEST_DATABASE_URL` from `.env.test` after the `_test` and
separate-host guard passes.

## Verification

- Backend `compileall` passed.
- Backend offline suite: 63 tests passed, 14 opt-in live tests skipped.
- Stage 6 realtime suite: 12 tests passed, including the live trigger test
  against the guarded isolated Neon test database, covering six table mappings
  and commit delivery semantics. Unit coverage includes listener reconnect
  resync, session release before SSE streaming, and lifespan cleanup.
- Frontend suite: 47 tests passed across 14 files. Coverage includes cache
  hits and identity scoping, TTL/LRU eviction, targeted invalidation,
  successful mutation invalidation, Dashboard background display, contributor
  refresh, SSE auth headers, reconnect behavior, and stream cleanup.
- Frontend TypeScript and production build passed. Vite retains its existing
  warning that the main chunk exceeds 500 kB.
- No application database migration, application content/user write, Clerk
  write, R2 write, or production deployment was performed for Stage 6.
