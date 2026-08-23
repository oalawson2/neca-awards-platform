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

**One-time setup, before the first deploy:** create a real `.env.local`
at the application root (`/home/necasmwo/neca-app/.env.local`, same
contents as `.env.example` but filled in) directly on the server —
never commit it. This is required *in addition to* cPanel's Setup
Node.js App environment variables UI, not instead of it: cPanel's UI is
only injected into the already-running app process, but `NEXT_PUBLIC_*`
vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
get inlined by webpack into the compiled app *at `next build` time* —
including into `proxy.ts`'s compiled output, which runs on every
request. `deploy.sh` builds over SSH, a shell that never sees cPanel's
env var UI, so without this file the build silently bakes in `undefined`
for those two vars — permanently, until the next build — and the
symptom is `Error: Your project's URL and Key are required to create a
Supabase client!` thrown from `.next/server/middleware.js`, persisting
no matter how many times you set the vars in cPanel and Stop/Start the
app afterward. `deploy.sh` now checks for this file and refuses to build
without it, so this can't silently recur. Once placed, it's untracked
and survives every future `git pull`.

cPanel's own Git Version Control deploy feature couldn't be used on this
host, so deploys are manual: SSH into the `neca-app` Node.js App's
application root (`/home/necasmwo/neca-app`, already tracking this repo)
and run:

```bash
./deploy.sh
```

This pulls the latest commit, activates the Node virtual environment,
installs dependencies, and **builds into a separate `.next-build`
directory — never the live `.next/standalone` a real applicant's request
might be hitting mid-deploy.** Next's own `cleanDistDir` default (`true`)
wipes whatever directory a build targets *the moment the build starts*,
long before a replacement exists (see `next.config.ts`'s `distDir`
comment) — so building straight into the live directory, as earlier
versions of this script did, would delete the running server the instant
`next build` starts, and any crash or OOM in between (this host is
memory-constrained enough that this has happened) left the site broken
for however long troubleshooting took. Now the live site keeps serving
the previous, working build completely undisturbed through the entire
build. Once the build finishes, `deploy.sh`:

1. patches the new `.next-build/standalone/server.js` to bind `0.0.0.0`
   unconditionally (see below),
2. stages `public/` and `.next-build/static/` into it, under a
   `standalone/.next-build/static` path that **must** match the distDir
   name from step 1 above — Next's `output: "standalone"` build doesn't
   include either by default, and `server.js` has that distDir name baked
   into its own compiled config at build time, so it looks for its static
   files (and its own server-side chunks, which Next's build already
   nests the same way) relative to whatever `NEXT_DIST_DIR` said, not a
   hardcoded `.next`. Getting this wrong doesn't 500 — pages still render,
   since the HTML only *references* `/_next/static/...` URLs rather than
   needing them to exist to be generated — every one of those requests
   just 404s once a real browser tries to load the CSS/JS, exactly the
   failure mode step 3's asset check below exists to catch,
3. **smoke-tests it** — boots that new `server.js` on a scratch local
   port, outside Passenger, and confirms `/` and `/login` both return
   real responses *and* that a real static asset URL pulled out of the
   rendered HTML actually loads — not just the page shell. A build
   finishing without error isn't the same as the server actually being
   able to start and serve everything the page needs — that gap is
   exactly what the `HOSTNAME` bind bug below (and, separately, the
   distDir/staging-path mismatch in step 2) looked like from the outside:
   build succeeded, deploy "succeeded," something in production was still
   broken. If the smoke test fails, the script exits here — the live site
   is untouched, still on the previous build, and `.next-build/` is left
   in place for inspection,
4. only then **swaps** the new build into place: the old
   `.next/standalone` is renamed to `.next/standalone.bak` (one rollback
   generation kept; roll back with
   `mv .next/standalone.bak .next/standalone`) and the new,
   already-verified one is renamed into `.next/standalone`. A rename on
   the same filesystem is effectively instant — this is the only moment
   the live path is touched at all.

The script stops immediately on any failure (`set -e`) — a partial
deploy never silently looks like a successful one, and per the above,
failing anywhere through the smoke test leaves the live site completely
untouched.

**Why the server.js patch is needed:** Next's generated `server.js`
contains `const hostname = process.env.HOSTNAME || '0.0.0.0'`. This host
exports an ambient `HOSTNAME` shell variable set to the box's own name
(`server224.web-hosting.com`), which Passenger inherits when it spawns the
Node app — so without the patch, Next binds *only* to that resolved
address instead of all interfaces. Passenger/LiteSpeed proxy to the app
over localhost/a private socket, so an app that isn't listening on
`0.0.0.0` is unreachable from them even though it runs fine and returns
real 200s when hit directly by that exact hostname — the confusing
"works, but only from one exact address" symptom this fixes. Since
`server.js` is regenerated from scratch by every `next build`, this has
to be a post-build patch step (both `deploy.sh` and `.cpanel.yml` run
it), not a one-time edit to a committed file.

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

### Maintenance mode + preview bypass

Real applicants should only ever see the working site or a calm "we'll
be back shortly" page — never a build in progress or a broken deploy.
The rearchitected `deploy.sh` above already keeps the live site working
throughout a normal build (see above), but maintenance mode exists as an
explicit, deliberate safety net around the moments that still touch the
live path: the atomic swap and the cPanel Stop/Start.

**One-time setup:** paste the block in
`deploy/htaccess/maintenance-block.conf` into the live `.htaccess`
(`/home/necasmwo/neca-app/.htaccess`) by hand, at the very top, above
cPanel's own Passenger directives — that file is cPanel-managed
(regenerated whenever the Node App's settings change in the cPanel UI),
so it's kept as a reference here rather than deployed automatically.
Replace `REPLACE_WITH_SECRET` (both occurrences) with a real generated
secret (`python3 -c "import secrets; print(secrets.token_urlsafe(24))"`)
before saving, and re-check the live file after any future change to the
Node App's settings in case cPanel's regeneration ever clobbers more
than its own managed block.

This works by intercepting requests in `.htaccess` via `mod_rewrite`
*before* Passenger ever sees them — the same technique Phusion Passenger
itself documents for serving a maintenance page while the underlying app
is down, not a hack specific to this host. It was verified against a
real Apache + `mod_rewrite` instance (normal traffic passing through
untouched; every path blocked with a real 503 once the flag file exists;
the correct secret reaching the app and setting a cookie; the cookie
alone continuing to bypass on later requests; a wrong secret or cookie
still blocked; the maintenance page itself always loading directly with
no redirect loop; traffic resuming immediately once the flag is
removed) — see the comments in `deploy/htaccess/maintenance-block.conf`
for the two real bugs that testing caught and fixed. It has **not** been
verified against this host's actual LiteSpeed + Passenger stack directly
(this app has been bitten by LiteSpeed/Passenger-layer surprises before)
— do one careful live check after pasting it in, per the checklist below.

**Turn maintenance ON/OFF**, from the app root
(`/home/necasmwo/neca-app`):

```bash
touch MAINTENANCE_MODE   # ON  — every visitor gets the maintenance page
rm MAINTENANCE_MODE      # OFF — normal traffic resumes immediately
```

No Apache/Passenger restart needed either way — `mod_rewrite` checks for
the file fresh on every request.

**Preview bypass**, while maintenance is ON: visit
`https://apply.necaexcellenceawards.com/?preview=<the secret>` once — it
sets a cookie (~5.6 days, the default in the tested Apache build; revisit
the link if it ever expires mid-use) so normal browsing and clicking
through the app afterward doesn't need the query param on every request.
This goes through the real public domain — LiteSpeed, Passenger, all of
it — deliberately, not around it: hitting the app directly on its own
port would miss exactly the class of routing-layer bug this app has hit
before.

**Standard deploy checklist:**

```bash
touch MAINTENANCE_MODE                      # 1. shield real applicants
./deploy.sh                                 # 2. build, smoke-test, swap
#    cPanel -> Setup Node.js App -> neca-app -> Stop, then Start   # 3.
#    visit https://apply.necaexcellenceawards.com/?preview=<secret>
#    and click through the real deploy on the real domain           # 4.
rm MAINTENANCE_MODE                         # 5. once satisfied, reopen
```

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
