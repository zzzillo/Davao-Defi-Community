# Contributing

Thanks for helping improve the Davao DeFi Community website. Bug reports,
feature discussions, and pull requests are welcome.

## Before you start

- Search existing issues and pull requests to avoid duplicating work.
- For a large change or a new feature, open an issue first so the scope can be
  discussed before you invest time in implementation.
- Do not include credentials, `.env` files, production data, or personal data
  in commits, screenshots, issues, or pull requests.

## Set up the project

Follow the root [README](README.md) for the supported Python and Node versions,
environment variables, database setup, and Clerk webhook configuration. Use
development credentials and an isolated database for local work.

## Make a change

1. Create a branch from the latest `main`, for example
   `feature/event-filters` or `fix/profile-ordering`.
2. Keep changes focused and use the existing formatting and naming patterns.
3. Add or update tests when behavior changes.
4. Update documentation when setup, configuration, or user-visible behavior
   changes.
5. Run the relevant frontend or backend checks listed in the root README.
6. Open a pull request against `main` and complete the pull request template.

Do not commit generated dependencies or build output (`node_modules`, `.venv`,
`dist`), local environment files, or database dumps.

## Database changes

Create an Alembic migration for schema changes. Review generated migrations
manually, preserve existing data, and test against an isolated database. Never
run test or migration commands against production unless the change is an
approved production deployment.

## Pull requests

Describe the user-visible change, link related issues, and include screenshots
for UI changes where useful. Explain any migration or configuration steps and
list the checks you ran. Keep unrelated formatting or cleanup out of a
feature-specific pull request.
