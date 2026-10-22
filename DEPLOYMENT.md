# TaskNest deployment with Supabase

Supabase now supplies PostgreSQL and persistent file storage. The Go backend
continues to handle login, authorization, and uploads. AWS and outbound email
services are not required.

## Supabase project

Create your own Supabase project and configure `SUPABASE_URL`, `DATABASE_URL`,
`SUPABASE_SECRET_KEY`, and a unique long random `JWT_SECRET` in `backend/.env`
or the deployment host's secret settings. Startup applies the embedded schema.
Reference:
[Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
and [API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## Backend environment

```env
GIN_MODE=release
PORT=8080
PRODUCTION_DOMAIN=https://YOUR_FRONTEND_DOMAIN
JWT_SECRET=YOUR_LONG_RANDOM_SECRET
DATABASE_URL=YOUR_SUPABASE_POSTGRES_URI_WITH_SSLMODE_REQUIRE
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_YOUR_BACKEND_SECRET_KEY
SUPABASE_STORAGE_BUCKET=tasknest-uploads
```

Use the Session pooler URI (port 5432) for IPv4 backends or the direct URI when
IPv6 is available. The Go database pool is capped at five connections per backend
replica. The database role must be able to run migrations in `tasknest`.
The backend sets its own private-schema search path on each connection.

Set `FIREBASE_SERVICE_ACCOUNT_JSON` to the service account file path only if using existing Google sign-in, and
`GROQ_API_KEY` for AI. Supabase Auth is not used, so its email settings do not
control TaskNest login or signup.

Build the server in `backend` with `go build -o tasknest .` and deploy that binary.
Schema migrations are embedded. System environment values take precedence over
`.env`. Use HTTPS; authentication cookies are Secure in release mode.

## Storage

On the first configured startup, the backend creates `tasknest-uploads` if missing
using Supabase's Storage API, with public read URLs, a 10 MB file limit, and the
app's allowed image/PDF types. Uploads require an authenticated TaskNest session.
The backend sends its secret API key to Supabase; the browser never receives it.
No anonymous upload policy is needed. It will not change an existing private
bucket into a public bucket.

Public file links can be read by anyone who has the URL. This preserves the app's
current link behavior and is suitable for public assets. Confidential attachments
need a private bucket and an additional authorized download flow. See
[bucket access models](https://supabase.com/docs/guides/storage/buckets/fundamentals).

All uploads use Supabase Storage.
Storage setup failures stop startup instead of serving broken upload URLs.

## Frontend

In `frontend`, set `VITE_API_URL` to the HTTPS backend origin, then run:

```sh
npm ci
npm run build
```

Host `frontend/dist` on a static host with SPA routing. If the frontend and API
share an origin through a reverse proxy, leave `VITE_API_URL` blank and proxy
`/api` and `/tasks` to Go. Proxy routes must allow the upload size plus multipart
form overhead (at least 11 MB). Keep all Supabase/database secrets out of `VITE_*`.
The backend's built-in `/` route returns JSON, so use separate static hosting or
configure the reverse proxy to serve the frontend at `/`.

## Backend health monitoring

`GET /health` is a public liveness endpoint returning HTTP 200 and
`{"status":"ok"}`. It does not query Supabase or require login, and disables
response caching. Set Render's **Health Check Path** to `/health`.

The `Backend health check` GitHub Actions workflow requests this endpoint every
10 minutes from outside Render. After deploying the backend:

1. Under GitHub **Settings → Secrets and variables → Actions → Variables**, add
   the repository variable `RENDER_BACKEND_URL` with the backend HTTPS origin,
   such as `https://YOUR_SERVICE.onrender.com` (without `/health`). No secret is
   needed for this public endpoint. The job skips until this variable is set.
2. Merge the workflow into the default branch (`main`) to enable scheduling.
3. Open **Actions → Backend health check → Run workflow** to verify the deployed
   endpoint. The response must be HTTP 200 with the expected JSON body.

This can help avoid Render's 15-minute idle timeout, but GitHub schedules may
be delayed or dropped, so it cannot guarantee that the backend stays awake.
Public repository schedules are disabled after 60 days without repository
activity. Render may restart free instances, and keeping the backend running
uses the workspace's shared 750 free instance hours per month. See
[Render free service limits](https://render.com/docs/free) and
[GitHub scheduling limits](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
For a precise monitoring interval, use an external uptime monitoring service;
for continuous availability, use a paid backend instance.

This liveness check does not generate database activity. The separate scheduled
database check below handles that.

## Database check

`.github/workflows/database-check.yml` runs a read-only query against the task
table every 10 minutes, independently of the deployed backend.
It also supports a manual run from GitHub Actions. It never modifies task data
or prints task records or the connection URL.

To enable it:

1. In GitHub **Settings → Secrets and variables → Actions**, add the repository
   secret `SUPABASE_DATABASE_URL`. Use your Supabase **Session pooler** connection
   URI, with the real password and `sslmode=require`. GitHub's standard runners
   need an IPv4-compatible connection; a direct Supabase URI may require IPv6.
   The existing backend `DATABASE_URL` can be reused if it uses the Session pooler.
   Do not commit the URL or paste it in workflow files.
2. Merge this workflow into the repository's default branch (`main`). GitHub only
   schedules workflows that exist on the default branch.
3. Open **Actions → Database check → Run workflow** and confirm it succeeds.

Supabase can pause free projects with insufficient activity over seven days.
These scheduled reads can help, but do not guarantee exemption from pausing or resume
an already paused project. Resume a paused project in the Supabase dashboard.
Only a paid plan guarantees exemption from inactivity pausing.
See [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).

GitHub schedules can be delayed, and public repositories have scheduled workflows
disabled after 60 days without repository activity. Check Actions periodically;
re-enable the workflow there if needed. See
[GitHub scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Verification

- Backend tests and Storage HTTP tests exercise uploads, configuration, rejected
  file types/sizes, redirect handling, and bucket initialization without live keys.
- Run the rollback-only SQL smoke test against an isolated database with
  `psql --dbname="$TEST_DATABASE_URL" -f backend/config/testdata/supabase_smoke.sql`.
- After adding credentials, run the backend, then test signup, login, profile
  photos, task attachments, workspace tasks, and account deletion in the app.

Email-based password recovery is not implemented. Decide on a recovery process
before inviting users who need it. Review the project's free-plan usage limits
and arrange backups appropriate to the data before production launch.

Password signup does not verify email ownership. An existing password account
blocks Google sign-in for the same address; safe recovery or linking requires a
separate verified-ownership flow. Do not enable automatic email-based linking.

Bucket MIME restrictions are configured at creation. When the supported upload
types change, update existing buckets in Supabase Storage settings as well.
