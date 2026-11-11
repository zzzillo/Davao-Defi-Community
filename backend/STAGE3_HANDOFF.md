# Stage 3: Clerk onboarding handoff

## Implemented

- Clerk session tokens prove identity. PostgreSQL remains the source of the
  user's role and account status; Clerk metadata never grants application
  access.
- New local users are created only after a local invitation for the exact
  verified primary email has an accepted state in Clerk. The Backend API's
  `primary_email_address_id` is used to select the primary address.
- An invited profile can include an initial display name, bio, alias, positions,
  contributions, and social links. Application edits and role/status fields are
  not read from Clerk metadata.
- Admins can invite members and officials. Superadmins can invite every role.
  The actor and target are rechecked under the shared Stage 2 advisory lock.
- Invitations are stored before delivery. The lifecycle is `pending`, `failed`,
  `accepted`, `revoked`, or `expired`. Retries and webhook reconciliation use an
  opaque local invitation marker, exact email, and provider state. The assigned
  role always comes from the local row. An uncertain result returns an error
  instead of claiming the email was sent.
- `POST /users/sync` fetches the current authenticated Clerk identity and fills
  the gap when a webhook has not arrived. Deleted and revoked identities cannot
  provision an account through this route.
- `POST /webhooks/clerk` verifies the raw Svix bytes, records duplicate
  receipts, handles `user.created`, `user.updated`, and `user.deleted`, and
  ignores delayed events for deletion tombstones. Clerk deletion suspends the
  local user and preserves its authored content and activity credit.
- Invitation create, accept, revoke, user deletion, and bootstrap lifecycle
  changes write to the existing activity log.
- `scripts/bootstrap_superadmin.py` is a one-time operator command. It requires
  a Clerk user with the exact verified primary email and refuses to run if any
  superadmin row already exists. It does not create a public endpoint or run on
  first login. Keep another active superadmin before deleting an administrator
  identity; bootstrap is not a recovery path after a superadmin has been
  created.
- `scripts/set_role.py` can demote an existing user, but cannot grant a role or
  create an account.

## API contracts

- `GET /admin/invitations?status=pending&limit=50&offset=0` lists invitations
  visible to the current admin tier. Admins see member and official invites;
  superadmins can also see admin and superadmin invites.
- `POST /admin/invitations` accepts:

  ```json
  {
    "email": "member@example.com",
    "role": "member",
    "profile_details": {"display_name": "New Member"}
  }
  ```

  Send an optional `Idempotency-Key` header to make a client retry refer to the
  same local invitation.
- `POST /admin/invitations/{id}/retry` reconciles or retries an uncertain or
  failed delivery. `POST /admin/invitations/{id}/revoke` closes local onboarding
  immediately and confirms the Clerk revocation. If acceptance already
  happened, suspend the account through `/admin/users/{id}/status`.
- The invitation response deliberately omits the Clerk invitation ID and
  failure detail. `502` responses include the local invitation ID and lifecycle
  state so an admin can use the retry/reconcile path.

## Create the Clerk development app

The fresh Clerk app and real session are **not configured or verified yet**.
The app keys are not available in this workspace. Create the development app
before filling any key fields:

1. Sign in to the [Clerk Dashboard](https://dashboard.clerk.com/) and create a
   new development application for the Davao DeFi Community site.
2. In **User & authentication → Email**, enable **Sign-up with email** and
   **Sign-in with email**, require the email address, and leave **Verify at
   sign-up** enabled. The default email verification code is sufficient.
3. In **Access mode**, select **Invite-only** and save. This restricts signup to
   users with a valid Clerk invitation. The application also checks its own
   local invitation record before granting access.
4. In **API keys**, copy the development Secret Key. In **Domains**, find the
   development Frontend API (FAPI) URL; it is the session token's `iss` value.
   Put the backend values in the ignored `backend/.env` file:

   ```dotenv
   CLERK_SECRET_KEY=sk_test_...
   CLERK_ISSUER_URL=https://<your-instance-issuer>
   CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
   ```

   `CLERK_ISSUER_URL` must be the exact HTTPS FAPI origin shown under **Domains**
   and used by the token `iss` claim, without a path. Set the webhook secret in
   step 5. Keep the secret key and webhook secret out of frontend variables.
   The publishable key is stored in ignored `frontend/.env.local`. The frontend
   still uses its demo auth until Stage 5 is integrated.
5. Start the backend on port 8000, then run the [Clerk CLI webhook relay](https://clerk.com/docs/cli):

   The backend must connect to a database at migration head `a45c7f2d91de`.
   The application and isolated test databases were migrated to this revision
   on 2026-11-10. Run the migration script for any other database before
   starting onboarding against it.

   ```sh
   cd backend
   .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

   In a second terminal, run:

   ```sh
   cd backend
   npx -y clerk@latest webhooks listen --forward-to http://localhost:8000/webhooks/clerk --json
   ```

   In **Webhooks** in the Clerk Dashboard, add the relay URL printed by the
   command and subscribe to `user.created`, `user.updated`, and `user.deleted`.
   Save the endpoint and copy its signing secret into
   `CLERK_WEBHOOK_SIGNING_SECRET` in `backend/.env`.
6. After the app is configured, create its first superadmin once:

   The Dashboard login is separate from a user in the new app. For this first
   application user only, use **Invitations** in the Clerk Dashboard to invite
   your own verified primary email, then accept the invitation through Clerk's
   hosted Account Portal. That establishes the Clerk identity; it does not add
   a local app role. Restart the backend after writing the API and webhook
   values to `.env` so the cached settings reload.

   ```sh
   cd backend
   .venv/bin/python scripts/bootstrap_superadmin.py your-verified-email@example.com
   ```

   The email must be the Clerk account's verified primary email. The script
   checks the local database for any existing superadmin and exits if one is
   already present.

Clerk keeps identity and sessions. Do not add `role`, `permissions`, or access
rules to Clerk metadata; local database rows own those values. The invitation
marker in public metadata is only an opaque reconciliation ID and is never used
to decide a role.

## Verification and pending work

- Offline suite: **28 passed, 7 skipped**. The skipped tests require opt-in live
  database environment variables.
- Stage 3 live suite: **4 passed in 127.7 seconds** against the isolated
  `backend/.env.test` database, using a fake Clerk provider. The tests created
  no Clerk users and sent no real invitation email.
- Combined Stage 2 and Stage 3 live suite: **7 passed in 256.910 seconds**.
- The isolated test target and application database were migrated from
  `ef784a036b2a` to `a45c7f2d91de`. Alembic reported no remaining upgrade
  operations. The application `/health` check returned HTTP 200 and all 11
  application tables contained zero rows.
- `compileall`, `pip check`, and `git diff --check` passed.
- The new development instance's backend secret key, issuer, frontend
  publishable key, and webhook signing secret are configured in ignored files
  with mode `600`. Read-only SDK checks confirmed that the Backend API JWKS
  matches the issuer's public JWKS and found exactly one Clerk account matching
  the selected verified primary email; it was not banned. The API listing did
  not include a deleted field.
- The backend is running locally on `127.0.0.1:8000` and `/health` returns
  HTTP 200. The webhook signing secret is configured in the ignored backend
  env file, and an unsigned webhook POST returns HTTP 400. A Clerk CLI relay is
  currently running; its temporary URL is provided separately.
- A synthetic, correctly signed `setup.check` event sent through the relay
  received HTTP 403. Sending the same event directly to the local webhook
  handler returned HTTP 200. The exact test receipt was removed afterward;
  counts remained unchanged across all 11 application tables (zero rows before
  and after). One actual signed Clerk `user.created` delivery was received and
  its receipt remains in the database. The receipt stores no payload or subject.
  User review confirmed that email is required, email sign-in is enabled,
  signup verification is enabled, and the app is Invite-only.
- The selected account was bootstrapped as the first local superadmin using
  `scripts/bootstrap_superadmin.py`. Verification found exactly one matching
  active, nondeleted `SUPERADMIN` row and exactly one linked bootstrap audit.
  The application has one local user. Health remains HTTP 200 and the schema
  remains at `a45c7f2d91de`.
- The first account was created and verified through user-directed Clerk
  onboarding; real browser login through this site's frontend remains pending
  because frontend auth is still in demo mode. Stage 4 R2 and Stage 5 frontend
  integration remain separate work.

## Next user action

The user confirmed the email requirement, email sign-in, signup verification,
and Invite-only access settings. The first signed Clerk webhook has already
been received, and the selected first account is bootstrapped locally; do not
rerun the one-time bootstrap. Real browser login remains pending Stage 5
frontend auth integration. Do not send secret keys or the webhook signing
secret through chat.

Official setup references: [invite-only access mode](https://clerk.com/docs/guides/secure/restricting-access),
[inviting users](https://clerk.com/docs/guides/users/inviting),
[webhook overview](https://clerk.com/docs/guides/development/webhooks/overview),
[Clerk CLI](https://clerk.com/docs/cli),
[FAPI URL in Domains](https://clerk.com/docs/guides/how-clerk-works/overview),
[session token `iss` claim](https://clerk.com/docs/guides/sessions/session-tokens).
