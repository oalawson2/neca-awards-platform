# NECA Employers' Excellence Awards Platform

A three-portal platform (Applicant, Secretariat, Jury) supporting the NECA
Employers' Excellence Awards two-stage process. Built by Aeros Marketing
Solutions for NECA.

**Status: scaffolding only.** No database schema, no real portal screens,
no live deployment yet — this repo currently just holds the project
foundation so implementation can move fast once judging criteria, the
application questionnaire, and design are finalized.

## Stack

- **Frontend:** Next.js 16 (App Router, TypeScript, Tailwind CSS v4)
- **Backend:** Supabase (Postgres + Auth + Storage)
- **Hosting:** Namecheap Stellar shared hosting via cPanel — "Setup Node.js
  App" + "Git Version Control" (git-push-to-deploy), **not** Vercel
- **Target URL:** `apply.necaexcellenceawards.com` (subdomain; the main
  `necaexcellenceawards.com` WordPress site is untouched and unrelated)

## Project structure

```
app/
  page.tsx                 landing page (placeholder)
  layout.tsx                root layout
  login/                    single login route (all three roles)
  (portals)/                route group for authenticated portal areas
    layout.tsx               shared portal chrome
    applicant/                Stage 1: employer application + questionnaire
    secretariat/               application review & program admin
    jury/                      Stage 2: jury review & scoring
lib/
  supabase/
    client.ts                Supabase client for Client Components
    server.ts                Supabase client for Server Components/Actions
  auth/
    session.ts                placeholder session/role lookup
proxy.ts                    role-based route gating (Next.js 16 renamed
                             `middleware.ts` to `proxy.ts` — see note below)
types/
  auth.ts                    UserRole, SessionUser types
deploy/
  ssh/                       cPanel deploy SSH key docs (keys themselves
                             are git-ignored, never committed)
.cpanel.yml                 cPanel Git Version Control deploy pipeline
.env.example                documented environment variable list
```

None of the portal directories have real screens yet — each is a single
placeholder page confirming the route resolves to the right area.

### A note on `proxy.ts`

Next.js 16 deprecated the `middleware.ts` convention in favor of `proxy.ts`
(same purpose: run logic before a request completes, e.g. auth redirects).
If you're used to `middleware.ts` from older Next.js docs/tutorials, that's
why this repo has `proxy.ts` instead.

## Auth (current state)

`lib/auth/session.ts` exports `getCurrentUser()`, which always returns
`null` right now — there's no real schema or Supabase Auth connection yet.
`proxy.ts` uses it to redirect any request under `/applicant`,
`/secretariat`, or `/jury` to `/login`. The login page itself
(`app/login/`) is a non-functional placeholder form. Once the Supabase
schema (with a `profiles`/roles table) exists, `getCurrentUser()` gets
real logic and the routing shell in `proxy.ts` starts working without
structural changes.

## Environment variables

See `.env.example` for the full documented list (Supabase, Anthropic API,
email service, site URL). Copy it to `.env.local` for local development —
none of the values are populated yet.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deployment

cPanel's own Git Version Control deploy feature couldn't be used on this
host, so deploys are manual: SSH into the `neca-app` Node.js App's
application root (`/home/necasmwo/neca-app`, already tracking this repo)
and run:

```bash
./deploy.sh
```

This pulls the latest commit, activates the Node virtual environment,
installs dependencies, builds (with the single-thread workaround this host
requires), and stages `public/` and `.next/static/` into
`.next/standalone/` — Next's `output: "standalone"` build doesn't include
either by default, and missing this step is what used to produce
unhelpful 500s on static assets that never showed up in the app's own
logs. The script stops immediately on any failure (`set -e`) rather than
leaving a partial deploy that looks like it succeeded.

**After every run of `deploy.sh`, go to cPanel → Setup Node.js App →
neca-app and click Stop, then Start** (not just Restart — Restart alone
has not reliably picked up changes on this host). The script prints this
reminder at the end, but it can't do this part itself since it only
exists in the cPanel UI.

cPanel's Node.js Selector "Application startup file" is
`.next/standalone/server.js` (relative to the application root) — that's
the actual server; `next start` is not used in production.

`.cpanel.yml` documents the equivalent steps for cPanel's Git Version
Control feature but isn't the active deploy path on this host — `deploy.sh`
is. See `deploy/ssh/README.md` for the SSH deploy key setup.

## Scheduled job: interview reminders

`requestInterview()` (juror clicks "Request Interview") sends the initial
invite immediately, synchronously, when clicked. The periodic follow-ups —
"you haven't booked yet" and "your interview is coming up" — don't send
themselves; something has to call `GET /api/cron/interview-reminders`
periodically. This app has no background job runner of its own, so that
"something" has to live outside it.

**On this host, the simplest fit is cPanel's own Cron Jobs feature**
(cPanel → Cron Jobs), rather than an external service like cron-job.org —
no extra account, no outbound trust boundary, and it's already available
on this hosting plan. Set up one cron job:

- **Schedule:** once daily (any time works; the route itself throttles
  each individual reminder to at most once per 24h, so more frequent runs
  are harmless but redundant)
- **Command:**
  ```bash
  curl -s -o /dev/null -H "x-cron-secret: $CRON_SECRET" "https://apply.necaexcellenceawards.com/api/cron/interview-reminders"
  ```
  Replace `$CRON_SECRET` with the actual value you set for `CRON_SECRET`
  in the Node.js App's environment variables (cPanel → Setup Node.js App →
  neca-app), and the host with the real deployed URL. cPanel's cron editor
  doesn't expand shell env vars from the Node app, so paste the literal
  secret value into the command — don't commit it anywhere.

  Query-param form works too if a header is awkward in your cron tool:
  `.../api/cron/interview-reminders?secret=<CRON_SECRET>`

The route returns `401` if the secret is missing/wrong and `500` if
`CRON_SECRET` isn't configured on the server at all — so a misconfigured
cron job fails loudly in cPanel's cron mail/log rather than silently
no-op'ing. On success it returns a small JSON summary (`bookingRemindersSent`,
`attendanceRemindersSent`); check cPanel's cron job logs there if reminders
seem to be missing.

No real email is sent by this route yet — see `lib/email/send.ts`; every
reminder currently just logs `[mock-email] would send ...` to the app's
server log. Once `EMAIL_API_KEY`/`EMAIL_FROM_ADDRESS` are populated,
swapping in a real provider is a contained change inside `sendEmail()` —
no caller (including this route) needs to change.

## Scheduled job: database backups

The Supabase project is on the free tier, which doesn't include automatic
backups. `backup.sh` (repo root, same style/discipline as `deploy.sh` —
`set -euo pipefail`, stops loudly on any failure) runs `pg_dump` and
writes a timestamped dump to `/home/necasmwo/neca-backups/` — a directory
**outside the app's git repo entirely** (not just outside `public/`), so
it's never touched by `deploy.sh`'s `git pull`, never at risk of being
served as a static file, and survives even a from-scratch redeploy. It
keeps the 10 most recent backups and deletes older ones automatically, so
this can't quietly fill up disk over time.

**One-time setup on the server**, before the first scheduled run:

1. Confirm `pg_dump` is installed: `which pg_dump`. If it isn't, ask
   hosting support to install the PostgreSQL client tools — shared hosting
   doesn't always include them by default, and `backup.sh` will fail
   loudly (not silently) with a clear message if it's missing.
2. Create `/home/necasmwo/neca-app/.env.local` (if it doesn't already
   exist) containing at least:
   ```
   SUPABASE_DB_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
   ```
   Use the **direct** connection string from Supabase (port `5432`), not
   the pgbouncer/transaction-pooler one (port `6543`) — see
   `.env.example`. cPanel Cron Jobs run with a minimal environment and
   don't inherit the env vars configured in "Setup Node.js App", which is
   why this needs its own file rather than reusing that UI.

**cPanel Cron Job** (cPanel → Cron Jobs) — same reasoning as the interview
reminders job above: cPanel's own Cron Jobs feature over an external
service, since it's already available on this plan. Runs **daily**,
starting immediately and continuing for the life of the project (not a
phased/temporary thing):

- **Schedule:** once daily, e.g. `0 2 * * *` (2:00 AM server time — any
  time works, just pick one that isn't during a deploy)
- **Command:**
  ```bash
  /bin/bash /home/necasmwo/neca-app/backup.sh >> /home/necasmwo/neca-backups/backup.log 2>&1
  ```
  Redirecting to a log file in the same outside-the-repo backups
  directory means a failed run leaves a trail even if you don't check
  cPanel's cron notification email that day. cPanel's Cron Jobs UI also
  has its own "email" field if you'd rather get a notification per run —
  leave it blank to only rely on the log file.

If a backup ever fails, `backup.sh` exits non-zero and never leaves a
partial/empty `.sql` file behind — check `backup.log` (or the cron
notification email) for the specific error (missing `pg_dump`, missing
`.env.local`, or a `pg_dump` connection error are the three it reports
explicitly).

**To restore from a backup**, see [`RESTORE.md`](./RESTORE.md) — plain-
language, step by step, written for an emergency where you don't want to
be figuring out `psql` syntax from scratch.
