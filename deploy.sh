#!/usr/bin/env bash
#
# Manual deploy script for the neca-app Node.js App on cPanel.
#
# cPanel's own Git Version Control deploy feature couldn't be used on this
# host, so deploys are: SSH in, run this script, then manually Stop/Start
# the app in cPanel's Setup Node.js App page (see the reminder this script
# prints at the end — that part can't be automated from here).
#
# Runs every step in order and stops on the first failure (set -e) so a
# partial deploy never silently looks like a successful one.
#
# Usage: ./deploy.sh   (from anywhere — it cds into APP_ROOT itself)

set -euo pipefail

APP_ROOT="/home/necasmwo/neca-app"
NODEVENV_ACTIVATE="/home/necasmwo/nodevenv/neca-app/24/bin/activate"

cd "$APP_ROOT"

echo "==> [1/6] Pulling latest from git..."
git pull

echo "==> [2/6] Activating Node virtual environment..."
# cPanel's own activate script references CL_VIRTUAL_ENV without a default
# before assigning it, which is fatal under `set -u`. Disable nounset just
# for the source, then restore it — don't drop -u for the whole script.
set +u
source "$NODEVENV_ACTIVATE"
set -u

echo "==> [3/6] Installing dependencies..."
npm install

echo "==> [4/6] Checking build-time env vars are present..."
# NEXT_PUBLIC_* vars get inlined by webpack into every bundle that
# references them *at `next build` time* — including proxy.ts, which
# becomes .next/server/middleware.js and runs on every request. cPanel's
# Node App environment variables (Setup Node.js App -> neca-app) are only
# injected into the already-running app process; this SSH shell (and thus
# `npm run build` below) never sees them. Without a real env file on disk
# here, the build silently bakes in `undefined` for these vars, and no
# amount of setting them in cPanel's UI or restarting the app afterward
# fixes it — the bundle was already compiled wrong. A `.env.local` (or
# `.env.production`) placed once directly on the server at
# $APP_ROOT/.env.local (never committed — see .gitignore) is what makes
# `next build` see them; it survives future `git pull`s since git doesn't
# touch untracked files.
if [ ! -f .env.local ] && [ ! -f .env.production ]; then
  echo "ERROR: no .env.local or .env.production found in $APP_ROOT."
  echo "  next build needs NEXT_PUBLIC_SUPABASE_URL and"
  echo "  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY on disk at build time — cPanel's"
  echo "  Node App environment variables UI alone is not enough (it only"
  echo "  reaches the running process, not this build step). Create"
  echo "  $APP_ROOT/.env.local once with those two vars (see .env.example)"
  echo "  and re-run this script."
  exit 1
fi

echo "==> [5/6] Building (RAYON_NUM_THREADS=1 — required on this host, see next.config.ts)..."
RAYON_NUM_THREADS=1 npm run build

echo "==> [6/6] Staging standalone output (public/ and .next/static aren't included by Next's standalone build)..."
mkdir -p .next/standalone/.next
cp -R public .next/standalone/
cp -R .next/static .next/standalone/.next/

echo ""
echo "=================================================================="
echo " Deploy files are staged. This script CANNOT restart the app for"
echo " you — that only works from the cPanel UI."
echo ""
echo " ACTION REQUIRED NOW:"
echo "   cPanel -> Setup Node.js App -> neca-app -> STOP, then START."
echo "   (Restart alone has not reliably picked up changes on this host —"
echo "   it must be a full Stop followed by Start.)"
echo "=================================================================="
