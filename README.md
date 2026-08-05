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
