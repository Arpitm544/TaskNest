# TaskNest

TaskNest connects students for task sharing and collaboration. It uses React,
Vite, and Tailwind CSS with a Go/Gin backend. Supabase provides PostgreSQL and
file storage. The backend keeps the existing JWT cookie login, optional Firebase
Google sign-in, and Groq AI integration. Email delivery has been removed.

For AI, configure `GROQ_API_KEY` and optionally `GROQ_MODEL` (default
`openai/gpt-oss-20b`).

## Requirements

- Go 1.25 or newer.
- Node.js 20.19+ on the 20.x line, or 22.12+.
- A Supabase project with its database connection URL and a backend secret key.

## Configure Supabase

The project created for this workspace is **TaskNest**, in Mumbai:
[Open Supabase](https://supabase.com/dashboard/project/dpvluojenuonxuasbvyk).
Its initial PostgreSQL schema has already been applied; there was no existing
TaskNest data to import.

Copy `backend/.env.example` to `backend/.env` if `.env` does not already exist.
For this workspace, an ignored `.env` has already been created with the project
URL and a random JWT secret. Fill these two values locally:

```env
DATABASE_URL=postgresql://postgres.PROJECT_REF:YOUR_DATABASE_PASSWORD@YOUR_SESSION_POOLER_HOST:5432/postgres?sslmode=require
SUPABASE_SECRET_KEY=sb_secret_YOUR_BACKEND_SECRET_KEY
```

1. In the project's **Connect** dialog, copy the PostgreSQL URI. For an IPv4
   backend use the **Session pooler** URI on port 5432; direct connections need
   IPv6 unless the project has the IPv4 add-on. Replace the database password
   and URI-encode special characters in it. Use the hostname shown by Supabase.
2. Under **Settings → API Keys**, copy a **secret** key (`sb_secret_...`). Keep
   it in the backend environment. A publishable key is not sufficient.
3. Keep `SUPABASE_URL=https://dpvluojenuonxuasbvyk.supabase.co` and
   `SUPABASE_STORAGE_BUCKET=tasknest-uploads` for the project created here.

The connector does not expose the database password or backend secret key. Never
commit `.env` or put a secret key in a `VITE_*` variable. No frontend Supabase
client or publishable key is needed: all app data and uploads go through Go.

Reference: [database connections](https://supabase.com/docs/guides/database/connecting-to-postgres),
[API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## Run the backend

From `backend`:

```sh
go mod download
go run main.go
```

The backend listens on port 8080 by default. It checks the database migrations
and upload bucket before starting. Database failures stop startup instead of
leaving a partially initialized app. System environment variables take precedence
over `.env` values.

The first configured startup creates `tasknest-uploads` as a **public** bucket if
it is missing, allowing PNG, JPEG, GIF, WebP, AVIF, and PDF files up to 10 MB.
An existing private bucket is never automatically made public. Files receive
random names, and the backend detects their content rather than trusting the
client's extension. Existing profile/task upload API responses retain `{url}`.

Anyone with an uploaded file's URL can read it, matching the app's existing
permanent-link behavior. Use this bucket for public assets, not confidential
files. Restricted documents require a separate private bucket and authorization
flow. See [Supabase bucket access models](https://supabase.com/docs/guides/storage/buckets/fundamentals).

## Run the frontend

From `frontend`, run `npm ci` and create `.env`:

```env
VITE_API_URL=http://localhost:8080

# Optional Firebase Google sign-in configuration.
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Run `npm run dev` and open the displayed URL, normally `http://localhost:5173`.
Email/password login works without Firebase. Google sign-in additionally needs
`FIREBASE_SERVICE_ACCOUNT_JSON` configured on the backend.

## Accounts

- Signup creates an account immediately and directs the user to sign in.
- Password changes require the current password and a new password of 6–72 bytes.
- Account deletion requires the current password, or a fresh sign-in with the
  same Google account for Google profiles.
- Google sign-in does not silently merge with a password account using the same
  address. Use that account's existing login method.
- There are no verification codes, outbound email notifications, or email-based
  password recovery. Recovery would need a separate implementation.
- Email addresses remain account identifiers and targets for in-app invitations.

## Database layout and migrations

App tables live in the private **tasknest** schema. They are not exposed through
Supabase's default public Data API. The backend connects as the database owner,
sets its connection search path to `tasknest`, and performs authorization through
its existing routes. Do not add `tasknest` to exposed schemas or grant access to
`anon`/`authenticated` without implementing a corresponding authorization model.

`backend/config/migrations/*.sql` is embedded in the backend binary. Startup
applies pending files in one transaction, records their SHA-256 checksums in
`tasknest.schema_migrations`, and locks migration execution across replicas.
Add a new file for schema changes; do not edit an already applied migration.

A shared PostgreSQL sequence keeps IDs distinct across task types. Marketplace
and workspace milestones keep their existing `task_id` API but internally resolve
to proper foreign keys, including cascading cleanup on task deletion. Workspace
columns used by task creation and AI features are included in the initial schema.

The optional development seeder in `backend/tools/seeder` now targets `tasknest`.
Run it from that folder only after initializing the database; it adds demo data.

## Checks

Uploads always use Supabase Storage. AWS and local disk storage are no longer
needed.

```sh
cd backend
go test ./...
# Optional: run native PostgreSQL integration checks on an isolated test database.
TEST_DATABASE_URL='your-test-connection-uri' go test ./config -run TestPostgresMigrationAndSchemaIntegration -v
cd ../frontend
npm run build
```

The rollback-only SQL smoke test is in
`backend/config/testdata/supabase_smoke.sql`. It checks both task types,
milestones, globally unique IDs, foreign keys, cascades, and private-schema access.
See [DEPLOYMENT.md](./DEPLOYMENT.md) for production settings.
