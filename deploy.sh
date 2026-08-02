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

echo "==> [1/5] Pulling latest from git..."
git pull

echo "==> [2/5] Activating Node virtual environment..."
source "$NODEVENV_ACTIVATE"

echo "==> [3/5] Installing dependencies..."
npm install

echo "==> [4/5] Building (RAYON_NUM_THREADS=1 — required on this host, see next.config.ts)..."
RAYON_NUM_THREADS=1 npm run build

echo "==> [5/5] Staging standalone output (public/ and .next/static aren't included by Next's standalone build)..."
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
