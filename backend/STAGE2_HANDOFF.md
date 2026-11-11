# Stage 2 backend handoff

## Implemented

- Clerk verifies the signed identity. Every protected request loads the current active user from PostgreSQL; the database role and status control authorization. Clerk metadata cannot grant roles or permissions, and user webhooks sync identity fields only.
- Roles use the fixed cumulative module map: members manage their own Blogs; officials also manage all shared Events, Recaps, and Partners; admins also manage eligible users and activity; superadmins can manage all ranks and all Blogs.
- Public Events, Recaps, and Blogs stay publication-only. `/admin/*` management lists and details expose drafts within the caller's role and ownership scope. Blog writes are owner-scoped except for superadmins.
- User profile edits, public contributor list/detail and published articles, directory ordering, role changes, account suspension, and protected admin profile edits are available. Contributor responses omit internal IDs, email, role, and Clerk IDs; profile URLs use `public_slug`, independent from `alias`.
- Shared module records retain their creator. Activity rows carry actor, owner, and audience separately, and each mutation plus its audit record commits atomically. Admin activity visibility is scoped to shared work and allowed user-management targets; superadmins see the full feed.
- Role/status changes serialize on a PostgreSQL advisory transaction lock, then re-read the actor and target rows under row locks. This prevents stale sessions from acting after a concurrent demotion and preserves an active superadmin.
- The additive Alembic revision `ef784a036b2a` adds `users.public_slug` and `partners.creator_id`.

## API contracts

- Public content routes (`GET /blogs`, `GET /blogs/{id}`, `GET /blogs/slug/{slug}`, `GET /events`, `GET /events/{id}`, `GET /posts`, `GET /posts/{id}`, `GET /partners`, and `GET /partners/{id}`) return published records only. A published recap does not expose its linked event until that event is published.
- Authenticated content mutations remain on the resource routes. Blog mutations are limited to the owner, except superadmins; Event, Recap, and Partner mutations are shared across officials, admins, and superadmins. Creator fields are server-assigned on create and ignored/rejected as immutable on update.
- Management reads are `GET /admin/blogs[/{id}]`, `/admin/events[/{id}]`, `/admin/posts[/{id}]`, and `/admin/partners[/{id}]`. They support search, pagination, and creator filters while intersecting those filters with the caller's role scope; a filter cannot expand access.
- `GET /admin/dashboard` returns only the module totals and recent work available to the current role. `GET /activity-logs` is read-only and role-scoped; clients cannot create, change, or delete audit rows.
- `GET/PATCH /users/me` reads and edits the signed-in user's public profile. Public directory routes are `GET /users/contributors`, `GET /users/contributors/{public_slug}`, and `GET /users/contributors/{public_slug}/blogs`. The public contributor shape deliberately excludes email, role, status, Clerk ID, and database ID.
- Admin user management is under `/admin/users`: list/detail, role changes at `PATCH /admin/users/{id}/role`, suspension/reactivation at `/status`, public-profile edits at `/profile`, and contributor visibility/order at `/directory`. Admin can manage member/official access and edit admin peers' public profile/directory data; superadmin can manage all ranks. Neither can alter their own role or status. Suspending an account preserves authored content and activity credit.
- `UserRoleUpdate` accepts only the fixed role. Arbitrary permission lists and email changes are not profile API inputs. Null contributions/social-links are rejected; clients clear them with an empty list/object. Alias remains independent from the public contributor slug.

## Verification

Offline tests and syntax checks:

```sh
cd backend
./.venv/bin/python -m compileall -q app scripts tests
./.venv/bin/python -m unittest discover -s tests -v
```

The live API tests are opt-in and require `backend/.env.test`. Run the guarded migration first, then the suite:

```sh
cd backend
./.venv/bin/python scripts/upgrade_test_db.py
RUN_STAGE2_LIVE_TESTS=true ./.venv/bin/python -m unittest tests.test_stage2_live -v
```

The live test setup validates the isolated test URL against the configured application URL before redirecting the lazy app engine. It overrides only Clerk identity, uses the actual PostgreSQL-backed authorization and API code, and deletes its fixture rows after each test.

Results: offline suite **19 passed, 3 skipped**; isolated live API suite **3 passed** (173.661 seconds). The live suite exercised role/status enforcement, public and draft visibility, creator ownership, contributor privacy and slug behavior, activity visibility, audit rollback, and concurrent superadmin protection.

On 2026-11-09, revision `ef784a036b2a` was applied to the application database after review. `alembic check` reported no pending operations, the ASGI health endpoint returned HTTP 200 with a successful database query, all ten application tables contained zero rows, and `pip check` was clean.

## Deferred stages

- Invitation creation and delivery remain for Stage 3; no endpoint reports a successful invitation.
- R2 uploads and media validation remain for Stage 4; no upload behavior is claimed here.
- Frontend integration remains for Stage 5.
