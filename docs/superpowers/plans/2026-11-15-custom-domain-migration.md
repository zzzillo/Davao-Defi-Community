# Davao DeFi Community Custom Domain Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the public Davao DeFi Community application to `https://davaodeficommunity.com` and give the API a stable custom hostname while preserving existing data, authentication, media, and email DNS.

**Architecture:** Keep Vercel for the React/Vite frontend, Render for FastAPI, Neon for PostgreSQL, Clerk for identity, and the current R2 bucket and Vercel `/r2` media proxy. Use `davaodeficommunity.com` as the canonical site, redirect `www` to the apex, and recreate the API service in the `Davao Defi Community` Render workspace because Render does not support moving an existing service between workspaces. Each of the three existing users will create a new account in Clerk Production using their existing verified email. After each signup, manually map the new Clerk ID to that person's existing Neon row by exact verified email. This keeps app-owned data and roles in place and avoids general automatic email-based provisioning. The apex, `www`, API, and Clerk DNS records have been configured and verified; production app cutover and user migration remain pending.

**Tech Stack:** React, TypeScript, Vite, FastAPI, Vercel, Render, Neon PostgreSQL, Clerk, Cloudflare R2.

---

## Current deployment facts

- The Vercel project is `davao-defi-community`; its connected project domain is currently `davao-defi-community.vercel.app`.
- Vercel reports `davaodeficommunity.com` and `www.davaodeficommunity.com` as verified, with `www` issuing a permanent 308 redirect to the apex.
- Vercel Production and Preview `VITE_API_URL` now point to `https://api.davaodeficommunity.com`. Production `VITE_CLERK_PUBLISHABLE_KEY` is set to the new Clerk Production key; Preview remains separate.
- The replacement Render service is `ddc-api-t98k.onrender.com` (service `srv-dbsirqui0phs73d9aed0`) in `Davao Defi Community`, Free plan. Its required environment-variable keys are now present in Render. The API custom domain is verified and its certificate is issued. `/health` returns `{"status":"ok","database":1}`; the new origin passes CORS preflight, and the public landing snapshot and a representative `/r2/` image both return successfully.
- The separate `MIGRATION_DATABASE_URL` variable is now present on the replacement service. Its value must remain a direct endpoint under a different database role from `DATABASE_URL`; do not expose either value in chat.
- Vercel's Production and Preview `VITE_API_URL` has been changed to `https://api.davaodeficommunity.com`. This affects future builds only. The live website still serves the previous deployment until the local source changes are deployed.
- Vercel's Production `VITE_CLERK_PUBLISHABLE_KEY` now contains the new Clerk Production publishable key; Preview remains separate. The live site still serves the previous deployment.
- Clerk Dashboard confirms the active instance is Development and contains three user records. Its existing app webhook points to the old API at `https://ddc-api-yo88.onrender.com/webhooks/clerk`; it also has Clerk's own internal webhook endpoint.
- The user confirmed these are real accounts and asked to preserve their identities and app roles/data. Clerk does not transfer Development users to Production. The Production instance has been created for `davaodeficommunity.com` with Development authentication/theme settings cloned. The selected route is for all three users to create new Production accounts and verify their existing email addresses. Then, after confirming the exact verified email and new Clerk ID for each user, update only the corresponding existing Neon row's `clerk_user_id` and any matching accepted invitation's `accepted_clerk_user_id` in a transaction. Passwords do not transfer. The existing `users` rows remain the source of truth for role, permissions, status, profiles, and content.
- Clerk Production is invite-only. All three existing users have pending Production invitations. After verifying Clerk's custom email DNS records, the pending invitations were re-sent. Clerk Email Logs now confirm `accepted` and `delivered` events for all three recipients; `delivered` means their mail servers accepted the messages, though it does not guarantee inbox placement. Recipients should check Spam, Promotions, and All Mail and open the newest invitation.
- Clerk's Frontend API (`clerk.davaodeficommunity.com`) and Account portal (`accounts.davaodeficommunity.com`) DNS records show Verified. The primary domain and all three Clerk email CNAME records (`clkmail`, `clk._domainkey`, `clk2._domainkey`) now show Verified; public DNS resolves to Clerk's mail and DKIM targets. HTTPS to the Frontend API hostname responds successfully. No MX/mailbox is configured because the domain is being used for outbound transactional messages only. A working sender mailbox and DMARC are deliverability recommendations, not blockers to sending; Clerk delivery is now confirmed.
- The owner entered the new Clerk Production secret key in the existing Render environment variables for the replacement API. `CLERK_ISSUER_URL` is set to `https://clerk.davaodeficommunity.com`; that Render deploy is live and `/health` returns `{"status":"ok","database":1}`. A Production webhook endpoint/signing secret is still needed before authentication is switched.
- The Clerk Development export CSV is downloaded locally and contains three records. Only one record contains a password digest. This digest will not be transferred; all three users will set up new Production sign-ins using the enabled email verification code or email link flow. Keep the CSV private and do not commit it.
- Neon snapshot `before-clerk-production-user-id-mapping` (`snap-frosty-field-bep8hm4s`) was created from the production branch before any Clerk ID remapping; it expires November 22, 2026.
- Clerk user import is unavailable from this client: the first Backend API request returned HTTP 403 `browser_signature_banned`, with an instruction not to retry from this client. The request happened before any user was created, so Production remains unchanged. The selected migration avoids that API: users create their own Production accounts, and their verified emails are matched to the existing Neon rows before app access is granted.
- `frontend/vercel.json`, `frontend/vite.config.ts`, and `backend/tests/test_production_docs.py` contain those hostnames. The Vercel Content Security Policy also names the current Clerk development host `generous-egret-3876.clerk.accounts.dev`.
- The Vercel site proxies R2 objects through `/r2/` to the current `r2.dev` bucket URL. This can remain in place during the domain change.
- The Render dashboard has a `Davao Defi Community` workspace and a separate `My Workspace`; the original API and its `ddc-rate-limits` Valkey service are in the latter. The replacement API and a new Free Valkey service have been created in the target workspace. Keep the source services running until cutover.
- Hostinger is the DNS provider. The apex A records point to Vercel (`216.198.79.1`, `64.29.17.1`), `www` points to the Vercel project CNAME, and `api` points to the replacement Render hostname. Clerk DNS points `clerk` and `accounts` to their Clerk services; both are verified in Clerk.
- No Neon migration or database hostname change is required for a web-domain cutover.
- Neon contains real application data and remains the same source-of-truth database for both the old and replacement APIs. Do not clone, reset, or migrate its contents for this domain cutover. Only Clerk ID columns need mapping if users are imported into Clerk Production; preserve existing Neon row IDs, profiles, roles, permissions, and content.
- The registrar/DNS provider is not identified in the repository. The exact DNS values must come from the Vercel, Render, Clerk, and (if used) Cloudflare dashboards.
- The repository describes a Clerk development instance. Before switching production keys, confirm the actual Vercel and Render Clerk environment. App profiles and roles are joined to Clerk by `clerk_user_id`; switching to a different Clerk instance without a user-ID migration would disconnect existing identities from those records.

## Domain layout

| Purpose | Hostname | Provider |
|---|---|---|
| Canonical website | `davaodeficommunity.com` | Vercel project `davao-defi-community` |
| Website alias | `www.davaodeficommunity.com` redirects to apex | Vercel |
| FastAPI backend | `api.davaodeficommunity.com` | Replacement Render web service in `Davao Defi Community` |
| Clerk Frontend API (conditional) | `clerk.davaodeficommunity.com` | Existing/production Clerk instance, if configured |
| Database | Existing Neon hostname | No change |
| Media | `https://davaodeficommunity.com/r2/...` | Existing Vercel rewrite to R2 |

Use the records shown by each provider. Do not replace nameservers or remove unrelated DNS records just to point these hostnames; preserve existing MX, SPF, DKIM, DMARC, and verification records.

## Implementation files

- Modify `frontend/vercel.json`: point the landing snapshot rewrite at the new API hostname and update the report-only CSP to permit the new API and selected Clerk Frontend API hosts.
- Modify `frontend/vite.config.ts`: update the development API snapshot proxy and `/r2` proxy target from the old Vercel host to the canonical site host where needed.
- Modify `backend/tests/test_production_docs.py`: update production-origin, snapshot destination, and CSP assertions to the new hostnames while retaining unrelated-origin rejection and public-cache checks.
- Modify `README.md`: replace the old Vercel-host example for public image URLs and document the production domain layout and required Render/Vercel variables.
- Modify `frontend/.env.example` and `backend/.env.example` only if their comments or defaults need to explain the production values. Never commit real credentials.

## Task 1: Confirm the production resources and protect existing DNS

- [x] Identify the registrar/DNS host and inspect current DNS records. Existing nameservers were left unchanged; the original zone had no mail records.
- [x] In Vercel, confirm `davao-defi-community` is the production project.
- [x] In Render, inspect the original API and its Valkey dependency in `My Workspace`. A replacement is required because Render does not support service transfer between workspaces.
- [x] In the Clerk Dashboard, confirm the active instance is Development and inspect the existing account count. It contains three user records, which the owner confirmed are real.
- [x] Inspect the Development webhook target. It currently points to the old Render API; the new Production instance still needs its own endpoint and signing secret.
- [x] Record the current Neon and R2 configuration; keep both resources unchanged for this migration.

**Gate:** Do not switch users to the Production instance until all three have completed Production sign-up and each new Clerk ID has been matched to exactly one existing Neon row by verified primary email. Do not create replacement Neon user rows; existing app profiles and permission records are keyed by Clerk user ID.

## Task 2: Attach the website domain to Vercel

- [x] Add `davaodeficommunity.com` to the existing `davao-defi-community` Vercel project.
- [x] Add `www.davaodeficommunity.com` and configure it to redirect permanently to `https://davaodeficommunity.com`.
- [x] Add the Vercel apex A records and `www` CNAME at Hostinger, preserving the existing nameservers and other DNS records.
- [x] Wait for Vercel to verify both names. Vercel now reports both domains verified; keep the existing `davao-defi-community.vercel.app` hostname available until the new domain has passed the smoke checks.
- [x] Confirm the new website responds over HTTPS and has an active Vercel certificate.
- [ ] After verification, configure the old Vercel hostname to redirect to the canonical domain if the Vercel project settings support that redirect cleanly.

## Task 3: Recreate the API service in the target Render workspace

- [x] Inspect the existing API service in `My Workspace` and record its linked repository/branch, build and start commands, runtime plan, and non-secret configuration names.
- [x] Create a new Free web service in `Davao Defi Community` from the same repository and production branch. Match the existing service's runtime and commands. Do not create another Neon database or R2 bucket.
- [x] Create a new Free Key Value instance named `ddc-rate-limits` in the target workspace and connect the replacement API to its same-workspace URL.
- [x] Configure the replacement service's environment using values entered directly in Render. Preserve the old API environment for rollback.
- [x] Use the new Valkey connection URL for `RATE_LIMIT_REDIS_URL` on the replacement API. Keep the current API connected to the current Valkey during the rollback window.
- [x] Confirm the replacement web service and Valkey are both on the Free plan before deploying them alongside the current production resources.
- [x] Add `api.davaodeficommunity.com` in the Custom Domains section of the new Render API service.
- [x] Add Render's requested `api` CNAME at Hostinger. Avoid conflicting `A`/`AAAA` entries for `api`.
- [x] Verify the custom hostname in Render and wait for its TLS certificate to become active. Render now reports Verified and Certificate Issued.
- [x] Check `https://api.davaodeficommunity.com/health`; it returns `{"status":"ok","database":1}`. The new origin passes CORS preflight, and the public snapshot and a representative proxied R2 asset return successfully.

## Task 4: Prepare Clerk for the new site and API

- [x] Create a Clerk Production instance for `davaodeficommunity.com`, cloning authentication and theme settings from Development. Clerk does not transfer Development users to Production.
- [x] Keep Clerk Production invite-only and send a Production invitation to each existing user's email. All invitations are pending acceptance.
- [x] Request a Development user export; Clerk reports that the three-user CSV is ready.
- [ ] Have each of the three users create a new Production sign-in and complete email verification. They need to use the same email as their existing Neon account. Their old passwords and password hashes will not transfer.
- [ ] For each signed-up user, confirm Clerk shows the primary email as verified and record the new Clerk user ID. Keep a private mapping of verified email → existing Neon user row → new Clerk ID.
- [x] Create a Neon snapshot/restore point before changing Clerk ID links.
- [ ] In one reviewed transaction, update only `users.clerk_user_id` and matching `user_invitations.accepted_clerk_user_id` values, verifying every email/row/ID mapping is one-to-one. Keep all other user columns and related content unchanged. Re-read and verify the rows after commit.
- [ ] Do not route the production app to the new Clerk instance until all three Production accounts exist and the Neon ID mapping is verified.
- [x] Configure the Production Frontend API and Account portal on `clerk.davaodeficommunity.com` / `accounts.davaodeficommunity.com` and add the required CNAME records at Hostinger. Both records show Verified; HTTPS works for the Frontend API hostname.
- [x] Add Clerk's three email CNAME records at Hostinger and confirm all show Verified in Clerk and resolve publicly.
- [x] Re-send pending invitations after Clerk email DNS verification and confirm the `accepted` and `delivered` Email Logs events for all three recipients.
- [ ] Configure the new canonical site origin and sign-in/sign-up redirect URLs in Clerk. If social sign-in is enabled, update each provider's allowed callback/redirect URLs as Clerk requires.
- [x] Use the new publishable key and exact Frontend API issuer for Clerk Production. The issuer is `https://clerk.davaodeficommunity.com` (the verified Clerk Frontend API domain); it is set on Render. Confirm the resulting deploy is healthy before app cutover.
- [ ] Create the Clerk webhook endpoint at `https://api.davaodeficommunity.com/webhooks/clerk` in the selected instance, subscribe to the required user events, enter its signing secret directly in Render, then send a test event and confirm acceptance.
- [ ] Keep `CLERK_SECRET_KEY` on Render only. Put the matching publishable key in Vercel build environments; never expose backend secrets through `VITE_*` variables.

## Task 5: Update backend and frontend runtime configuration

- [x] On the replacement Render service, set `ALLOWED_ORIGINS=https://davaodeficommunity.com`, `STORAGE_PUBLIC_BASE_URL=https://davaodeficommunity.com/r2`, and `LANDING_SNAPSHOT_ENABLED=true`.
- [x] Set `RATE_LIMIT_REDIS_URL` to the new same-workspace Valkey connection. The user confirmed the value is entered.
- [x] Set `DATABASE_URL`, a separate-role direct `MIGRATION_DATABASE_URL`, the required Clerk Production secret, exact production issuer, and R2 credentials on the replacement service. A Production webhook signing secret still needs configuration. Keep all secret values in Render; do not share them in chat.
- [x] In Vercel Production and Preview build variables, set `VITE_API_URL=https://api.davaodeficommunity.com`; `VITE_LANDING_SNAPSHOT_URL=/landing/v1/snapshot.json` was already configured.
- [x] Set the Clerk Production `VITE_CLERK_PUBLISHABLE_KEY` in Vercel Production only. Preview remains separate from production authentication.
- [ ] Keep `VITE_R2_PUBLIC_URL` pointed at the existing public R2 origin for local development proxying. Production asset URLs should use the site's `/r2/` rewrite through the configured backend storage public base.
- [x] Deploy/restart Render with the current server-side values before publishing a Vercel build that sends browser API requests to the custom API hostname. Update Render again after setting the exact Clerk issuer and webhook secret.

**User action:** Each account holder should search Spam, Promotions, and All Mail for the newest Clerk invitation and complete their own Production sign-up and email verification. Clerk confirms all three invitation emails were delivered to the recipient mail servers. Until their accounts exist, `/users/sync` will deny app access because the backend intentionally refuses to attach a new Clerk identity to an existing user by email. After the verified email and Clerk ID are matched and the existing Neon row is updated, their next sign-in will load the preserved account and role. Do not ask users to create replacement app profiles or share passwords.

## Task 6: Replace hardcoded host references in the repository

- [x] In `frontend/vercel.json`, change the `/landing/v1/snapshot.json` destination to `https://api.davaodeficommunity.com/landing/v1/snapshot.json` and allow the API and Clerk Production hosts under the report-only CSP.
- [x] In `frontend/vite.config.ts`, point the snapshot development proxy at `https://api.davaodeficommunity.com` and the `/r2` proxy at the canonical Vercel domain.
- [x] In `backend/tests/test_production_docs.py`, update production-origin and snapshot assertions to the new website and API hostnames, retaining the unrelated-origin rejection assertion.
- [x] In `README.md`, update the production media proxy example to the canonical domain.
- [x] Search the repository for old Vercel and Render hostnames. Remaining Clerk Development hostname references are intentionally retained until the active Clerk instance is confirmed.

## Task 7: Cut over and verify without changing application data

- [x] Deploy the replacement backend settings; confirm `/health` and CORS preflight from `https://davaodeficommunity.com`. Clerk webhook delivery remains to be tested after the endpoint is updated.
- [ ] Build and deploy the Vercel production project with the updated source, API URL, and matching Clerk publishable key.
- [x] Verify `https://davaodeficommunity.com` returns successfully, the `www` redirect is 308, static assets/security headers are present, and the root domain has working TLS. SPA deep links remain to be checked after the new deployment.
- [x] Verify the public landing snapshot and a representative R2-backed image through the new API and website domains.
- [ ] Verify sign-in, sign-out, session restoration, `/users/me`, an authorized read-only admin view, and SSE `/realtime/events`. Do not exercise production writes as part of cutover checks.
- [ ] Confirm production API docs remain hidden, CORS rejects an unrelated origin, and the prior Vercel and Render hostnames still work during the rollback window.
- [ ] After the new site and API are stable, switch the old Vercel hostname to a redirect and retain the old Render hostname as a fallback. Remove old DNS records only after confirming they are not used by mail, OAuth, webhooks, or rollback.

## Rollback

If the new site or API fails, restore the previous Vercel Production environment values and old rewrite/proxy destinations, and restore the previous Render CORS/storage/Clerk environment values. Repoint only the API CNAME to the old service if needed. Keep the old Render service running until the replacement passes smoke checks. Keep Neon, R2 objects, and Clerk user records untouched during rollback. If Clerk production domain or instance settings were changed, restore the prior verified Clerk settings and key pair before asking users to sign in again.

## Provider references

- [Vercel: Set up a custom domain](https://vercel.com/docs/domains/set-up-custom-domain)
- [Render: Custom Domains](https://render.com/docs/custom-domains)
- [Render FAQ: transferring services between workspaces](https://render.com/docs/faq)
- [Clerk: Deploy to production](https://clerk.com/docs/guides/development/deployment/production)
- [Clerk: Change domain](https://clerk.com/docs/guides/development/deployment/changing-domains)
- [Cloudflare R2: Public buckets and custom domains](https://developers.cloudflare.com/r2/buckets/public-buckets/)
