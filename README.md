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

Deployment is via cPanel's Git Version Control feature reading
`.cpanel.yml` at the repo root, which builds the app (`output: "standalone"`
in `next.config.ts`) and copies the build output into the `neca-app`
Node.js app's application root (`/home/necasmwo/neca-app`). See
`deploy/ssh/README.md` for the SSH deploy key setup.
