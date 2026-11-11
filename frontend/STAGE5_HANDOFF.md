# Stage 5: frontend integration handoff

## Delivered

- The frontend now uses Clerk for sign-in and `useAppAuth` for the application
  account returned by `/users/me`. PostgreSQL role and status remain the access
  source; Clerk metadata does not grant application permissions. The existing
  `POST /users/sync` fallback is used when an authenticated `/users/me` read
  returns `409 profile_not_synced`; focus refreshes only GET the current user.
  Identity-field updates continue to come through the Clerk webhook.
- Returning focus to the browser tab triggers a background `/users/me` read so
  same-session role and status changes take effect. A normal refresh does not
  put the auth provider into its blocking loading state, so an open form stays
  mounted. A `401` or `403` clears the application account; transient failures
  keep the last known profile until the next refresh. Profile save uses this
  background refresh too.
- The protected admin outlet is keyed by database user ID, role, and status.
  Changing identity or access state resets nested management-page state.
  Management resource hooks also scope their visible results by identity,
  role, and status and refetch after those values change. Backend permission
  checks remain authoritative.
- Dashboard, Users, Profile, Activity, Events, Recaps, Blogs, and Partners use
  real API service calls. Public pages use published endpoints without a
  bearer token and show empty, loading, and retry states. The unused mock user,
  event, blog, post, and contributor fixtures and demo auth/API modules were
  removed; runtime content no longer falls back to demo records.
- Event banners, recap gallery photos, blog covers, partner logos, and profile
  photos upload authenticated JPEG, PNG, or WebP bytes through the backend
  media endpoint. Forms use returned storage keys, retain existing keys when
  the image is unchanged, and do not submit a local preview as a stored image.
  Content forms wait for uploads before enabling save; Profile uploads while
  saving and sends the returned profile-photo key. A superadmin editing another
  author's blog sends that blog's owner ID with its private cover upload.
- `/landing.html` routes to the Landing page for existing preview links. The
  frontend README now documents the full app on port 5174, required backend and
  Clerk configuration, and keeps the landing image workflow.

## Checks

Run these from `frontend/`:

| Command | Result |
| --- | --- |
| `npm test` | Passed: 10 files, 30 tests. Includes Clerk account-switch and background role/status refresh, profile photo and image-key flows, and owner-scoped blog-cover uploads. |
| `npm run build` | Passed TypeScript and production build. Vite reports the existing main chunk is over 500 kB. |
| `npm run build:landing` | Passed. |
| `npm run lint` | Still exits nonzero on six findings outside the Stage 5 integration: `DeferredSection.tsx` (`set-state-in-effect`), `Grainient.tsx` (`refs`), `PaginationControls.tsx` (`immutability`), `ScrollExpand.tsx` (`refs`), `SiteNavbar.tsx` (`only-export-components`), and `SlicedWaves.tsx` (`refs`). Stage 5 auth, upload, and admin files lint clean. |

The shared browser session was checked with a real Clerk superadmin sign-in on
localhost:5174, including Dashboard, Users, Profile, and Events. The root
coordinator also confirmed API health, empty public content totals, and `401`
for an anonymous dashboard request. No content write, deployment, commit, or
live-database mutation was performed during this handoff. The separate backend
handoffs document the real R2 object lifecycle check and backend test results;
frontend upload requests here are covered with mocked service tests.

## Limits

- Real browser image uploads and content saves were not performed in this
  stage, so no new content or media was written to the live database or bucket.
- A backend that has not been configured for R2 will reject uploads with its
  storage-unavailable response; the forms keep the selection retryable and do
  not submit an unattached local preview as a stored image.
- The full frontend lint command remains blocked by the six unrelated findings
  listed above. The normal and landing builds both succeed.
