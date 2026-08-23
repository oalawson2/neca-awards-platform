#!/usr/bin/env bash
#
# Manual deploy script for the neca-app Node.js App on cPanel.
#
# cPanel's own Git Version Control deploy feature couldn't be used on this
# host, so deploys are: SSH in, run this script, then manually Stop/Start
# the app in cPanel's Setup Node.js App page (see the reminder this script
# prints at the end — that part can't be automated from here).
#
# Builds into .next-build, a directory entirely separate from the live
# .next/standalone Passenger actually serves — never the live one — and
# only swaps the result into place (an atomic rename, effectively
# instant) after a smoke test confirms the new build actually boots and
# serves real responses. Next's own cleanDistDir default (true) wipes
# whatever directory `next build` targets the moment the build *starts*,
# long before a replacement exists (see next.config.ts's distDir
# comment) — so building straight into the live .next would delete the
# running server immediately on every deploy, leaving real applicants
# looking at a broken site for however long the build (or troubleshooting
# a failed one) takes. This way the live site keeps serving the OLD,
# working build, completely undisturbed, for the entire build + smoke
# test; the only moment it's touched at all is the swap itself, which
# takes seconds. See README's Deployment section for the full checklist,
# including where maintenance mode fits around this.
#
# Runs every step in order and stops on the first failure (set -e) so a
# partial deploy never silently looks like a successful one — and, per
# the above, a failure at any point up through the smoke test leaves the
# live site completely untouched, still on the previous build.
#
# Usage: ./deploy.sh   (from anywhere — it cds into APP_ROOT itself)

set -euo pipefail

APP_ROOT="/home/necasmwo/neca-app"
NODEVENV_ACTIVATE="/home/necasmwo/nodevenv/neca-app/24/bin/activate"
BUILD_DIST_DIR=".next-build"
SMOKE_TEST_PORT=39231

cd "$APP_ROOT"

echo "==> [1/9] Pulling latest from git..."
git pull

# Re-exec ourselves so the rest of THIS run reads the just-pulled version of
# this very file, not whatever bash already had buffered from before `git
# pull` ran. Without this, git pull updates deploy.sh on disk, but the
# already-running interpreter keeps executing the OLD content for the
# remainder of this same invocation — bash opened this file once at
# startup, and git's checkout replaces the file (new inode) rather than
# editing it in place, so the running process's own read of it is
# unaffected by the pull it just did. Confirmed via direct reproduction:
# running an old deploy.sh whose own git pull fetched a newer one still
# executed the OLD staging/smoke-test logic for the rest of that run, even
# though the file on disk was, by then, already the new version — this is
# what actually caused the static-asset-404 fix to appear to not be
# "really" deployed even though the fix commit had genuinely been pulled.
# DEPLOY_SH_REEXECED guards against looping if re-exec somehow ran twice.
if [ -z "${DEPLOY_SH_REEXECED:-}" ]; then
  exec env DEPLOY_SH_REEXECED=1 bash "$0" "$@"
fi

# Proves, from this run's own output, exactly what's actually executing —
# not something to infer from log wording. $0 read fresh here (independent
# of bash's own parse buffer) must match HEAD's deploy.sh; if it doesn't,
# something other than a normal git pull is at play (e.g. a second deploy
# mechanism — see README, .cpanel.yml is a documented-inactive fallback —
# touching this file/directory too).
echo "    Running $(readlink -f "$0" 2>/dev/null || echo "$0") @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown), sha256 $(sha256sum "$0" 2>/dev/null | cut -d' ' -f1)"

echo "==> [2/9] Activating Node virtual environment..."
# cPanel's own activate script references CL_VIRTUAL_ENV without a default
# before assigning it, which is fatal under `set -u`. Disable nounset just
# for the source, then restore it — don't drop -u for the whole script.
set +u
source "$NODEVENV_ACTIVATE"
set -u

echo "==> [3/9] Installing dependencies..."
# Updates APP_ROOT/node_modules (the build toolchain) only — the live app
# runs from the separate, self-contained .next/standalone/node_modules
# a previous successful build already produced, so this can't affect it.
npm install

echo "==> [4/9] Checking build-time env vars are present..."
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
ENV_FILE=""
if [ -f .env.local ]; then
  ENV_FILE=.env.local
elif [ -f .env.production ]; then
  ENV_FILE=.env.production
else
  echo "ERROR: no .env.local or .env.production found in $APP_ROOT."
  echo "  next build needs NEXT_PUBLIC_SUPABASE_URL and"
  echo "  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY on disk at build time — cPanel's"
  echo "  Node App environment variables UI alone is not enough (it only"
  echo "  reaches the running process, not this build step). Create"
  echo "  $APP_ROOT/.env.local once with those two vars (see .env.example)"
  echo "  and re-run this script."
  exit 1
fi

echo "==> [5/9] Building into $BUILD_DIST_DIR (RAYON_NUM_THREADS=1 — required on this host, see next.config.ts)..."
# NEXT_DIST_DIR routes this build's output away from the live .next — see
# next.config.ts's distDir option. The live .next/standalone is not
# touched by anything in this step.
RAYON_NUM_THREADS=1 NEXT_DIST_DIR="$BUILD_DIST_DIR" npm run build

echo "==> [6/9] Forcing the new standalone server to bind 0.0.0.0..."
# Next's own generated server.js (freshly regenerated by every build, so
# this has to be patched post-build, not edited once) contains `const
# hostname = process.env.HOSTNAME || '0.0.0.0'` — see node_modules/next/
# dist/build/utils.js's SERVER_FILE template. This host exports an
# ambient HOSTNAME shell var (its own name, "server224.web-hosting.com")
# that Passenger inherits when it spawns the Node app, so without this
# Next binds *only* to that resolved address instead of all interfaces —
# Passenger/LiteSpeed proxy to the app over localhost/a private socket,
# so an app that isn't listening on 0.0.0.0 is unreachable from them even
# though it runs fine and returns real 200s when hit directly by that
# exact hostname. Force it unconditionally so no ambient env var can
# narrow the bind again.
sed -i "s/const hostname = process.env.HOSTNAME || '0.0.0.0'/const hostname = '0.0.0.0'/" "$BUILD_DIST_DIR/standalone/server.js"

echo "==> [7/9] Staging public/ and $BUILD_DIST_DIR/static into the new standalone build..."
# Next's standalone build doesn't include either by default. The static
# files MUST land under standalone/$BUILD_DIST_DIR/static, not a
# hardcoded standalone/.next/static: server.js has its distDir baked into
# its own compiled config as whatever NEXT_DIST_DIR was at build time
# (".next-build" here, not ".next"), and Next's own standalone assembly
# already nests the server-side chunks the same way (standalone/
# .next-build/server/...) — confirmed by inspecting a real build. Get
# this wrong and pages still render (the HTML doesn't need the asset
# files to exist), so curl-ing `/` alone won't catch it — every
# /_next/static/* request 404s once a real browser tries to load CSS/JS,
# which is exactly how this was first found. The smoke test below fetches
# a real static asset for precisely this reason.
mkdir -p "$BUILD_DIST_DIR/standalone/$BUILD_DIST_DIR"
cp -R public "$BUILD_DIST_DIR/standalone/"
cp -R "$BUILD_DIST_DIR/static" "$BUILD_DIST_DIR/standalone/$BUILD_DIST_DIR/"

# Ground-truth self-check: an earlier version of this comment claimed the
# check below was "reading the actual bytes on disk" when it was actually
# just comparing two shell variables that are equal by construction
# (server.js's baked distDir vs. $BUILD_DIST_DIR — both come from the same
# $BUILD_DIST_DIR used for NEXT_DIST_DIR at build time, so they can only
# disagree if something outside this script's own build step interfered).
# That comparison is kept below as a cheap sanity check, but the real
# verification is: does a static file actually exist where server.js will
# look for it. `find` is run into a captured variable, not straight into
# a pipeline, specifically because piping it directly into `sed` here
# once caused this script to die silently under `pipefail` (find exits
# non-zero when the directory doesn't exist, its own stderr had been
# redirected to /dev/null, and set -e killed the script with no message
# at all) — confirmed by deliberately reproducing a broken staging
# destination and finding that exact silent-death behavior first.
BAKED_DISTDIR="$(grep -o '"distDir":"[^"]*"' "$BUILD_DIST_DIR/standalone/server.js" | sed -E 's/"distDir":"\.\/?//; s/"$//')"
if [ "$BAKED_DISTDIR" != "$BUILD_DIST_DIR" ]; then
  echo "ERROR: server.js's baked distDir ('$BAKED_DISTDIR') doesn't match"
  echo "  this run's own BUILD_DIST_DIR ('$BUILD_DIST_DIR') — something"
  echo "  other than this script's own build step wrote that server.js."
  echo "  Live site is untouched. Not proceeding to the smoke test or swap."
  exit 1
fi
STAGED_CSS="$(find "$BUILD_DIST_DIR/standalone/$BAKED_DISTDIR/static" -name "*.css" 2>/dev/null | head -1 || true)"
if [ -z "$STAGED_CSS" ]; then
  echo "ERROR: no .css file found under"
  echo "  '$BUILD_DIST_DIR/standalone/$BAKED_DISTDIR/static' after staging —"
  echo "  server.js (distDir '$BAKED_DISTDIR') will 404 on every static"
  echo "  asset. Live site is untouched. Not proceeding to the smoke test"
  echo "  or swap. Check what's actually in $BUILD_DIST_DIR/standalone/ —"
  echo "  a second deploy mechanism touching this directory concurrently"
  echo "  (cPanel's own Git Version Control auto-deploy, if enabled — see"
  echo "  README, .cpanel.yml is a documented-inactive fallback, not kept"
  echo "  in sync with this script) is the leading suspect if the staging"
  echo "  commands above look correct but this still fires."
  exit 1
fi
echo "    On-disk confirmation — server.js expects distDir '$BAKED_DISTDIR', found $STAGED_CSS"

echo "==> [8/9] Smoke-testing the new build before it ever touches the live site..."
# Boots the freshly-built server.js standalone (outside Passenger, on a
# scratch port) and confirms it actually serves real responses — a build
# finishing without error is not the same as the server being able to
# start and respond; that gap is exactly what the HOSTNAME bind bug above
# looked like from the outside (build succeeded, deploy "succeeded",
# production was unreachable). Only public routes are checked (no
# service-role/session-dependent ones), since this shell may not have
# every runtime secret cPanel's Node App env UI holds — this step is
# about "does the process boot and serve", not full feature coverage.
# Aborts here, before the swap step, leaves the live site completely
# untouched on its previous build.
# A stale process from an earlier interrupted run could still be bound to
# SMOKE_TEST_PORT and would make this test spuriously pass against old
# code instead of the new build — clear it first rather than risk that.
pkill -f "$BUILD_DIST_DIR/standalone/server.js" >/dev/null 2>&1 || true

set +u
# `exec` here matters: without it, `node` runs as a *child* of this
# backgrounded subshell, so $! is the subshell's PID, not node's — killing
# the subshell alone leaves node itself running as an orphan, silently
# bound to SMOKE_TEST_PORT for good. A subsequent deploy's smoke test
# would then hit that leftover process instead of its own new build and
# report a false pass — confirmed by hitting exactly this while testing
# this script: an orphaned node from one run made a deliberately broken
# second build's smoke test "pass". `exec` replaces the subshell process
# with node itself, so $! is node's real PID and `kill` actually reaches it.
(set -a; source "$ENV_FILE"; set +a; exec env PORT="$SMOKE_TEST_PORT" HOSTNAME=127.0.0.1 node "$BUILD_DIST_DIR/standalone/server.js" >/tmp/neca-smoke-test.log 2>&1) &
SMOKE_PID=$!
set -u
cleanup_smoke_test() {
  kill "$SMOKE_PID" >/dev/null 2>&1 || true
  wait "$SMOKE_PID" 2>/dev/null || true
  # Belt-and-suspenders in case anything still slipped through.
  pkill -f "$BUILD_DIST_DIR/standalone/server.js" >/dev/null 2>&1 || true
}
trap cleanup_smoke_test EXIT

SMOKE_OK=1
SMOKE_FAIL_REASON=""
for i in $(seq 1 15); do
  HOME_HTML="$(curl -sf "http://127.0.0.1:$SMOKE_TEST_PORT/")" || { sleep 1; continue; }
  if ! curl -sf -o /dev/null "http://127.0.0.1:$SMOKE_TEST_PORT/login"; then
    sleep 1
    continue
  fi
  # A page returning 200 doesn't mean its assets do — the HTML just
  # *references* /_next/static/... URLs, it doesn't require them to
  # exist. Pull a real one out of the rendered HTML and fetch it too,
  # the same way a browser actually would; this is what catches a
  # distDir/staging-path mismatch between the compiled server and where
  # deploy.sh put the static files; see step 7's comment for the exact
  # bug this once was.
  ASSET_PATH="$(echo "$HOME_HTML" | grep -oE '/_next/static/[^"'"'"']+\.(js|css)' | head -1)"
  if [ -z "$ASSET_PATH" ]; then
    SMOKE_FAIL_REASON="no /_next/static/*.js|css reference found in / — can't verify asset serving"
    sleep 1
    continue
  fi
  if curl -sf -o /dev/null "http://127.0.0.1:$SMOKE_TEST_PORT$ASSET_PATH"; then
    SMOKE_OK=0
    break
  fi
  SMOKE_FAIL_REASON="static asset 404: $ASSET_PATH"
  sleep 1
done

cleanup_smoke_test
trap - EXIT

if [ "$SMOKE_OK" -ne 0 ]; then
  echo "ERROR: the new build did not come up cleanly within 15s (/, /login, and a"
  echo "  real static asset all need to serve). ${SMOKE_FAIL_REASON:-no response at all}."
  echo "  Live site is untouched — still serving the previous build. Log:"
  echo "  ---------------------------------------------------------------"
  cat /tmp/neca-smoke-test.log || true
  echo "  ---------------------------------------------------------------"
  echo "  Fix the issue and re-run ./deploy.sh. $BUILD_DIST_DIR/ is left"
  echo "  in place for inspection; it'll be overwritten by the next run."
  exit 1
fi
echo "    Smoke test passed: / and /login served real responses, and a real static asset ($ASSET_PATH) loaded."

echo "==> [9/9] Swapping the new build into place (near-instant)..."
# mkdir first: on a first-ever run of this build process .next/ (the
# live path's parent) may not exist yet at all, since a distDir-overridden
# build never creates it — `mv` needs the destination's parent directory
# to already exist.
mkdir -p .next
rm -rf .next/standalone.bak
if [ -d .next/standalone ]; then
  mv .next/standalone .next/standalone.bak
fi
mv "$BUILD_DIST_DIR/standalone" .next/standalone

echo ""
echo "=================================================================="
echo " Deploy complete. Previous build kept at .next/standalone.bak in"
echo " case a rollback is ever needed (mv .next/standalone.bak"
echo " .next/standalone). This script CANNOT restart the app for you —"
echo " that only works from the cPanel UI."
echo ""
echo " ACTION REQUIRED NOW:"
echo "   cPanel -> Setup Node.js App -> neca-app -> STOP, then START."
echo "   (Restart alone has not reliably picked up changes on this host —"
echo "   it must be a full Stop followed by Start.)"
echo ""
echo " Then verify through the real public domain before trusting it —"
echo " see README's Deployment section for the maintenance-mode +"
echo " preview-bypass checklist."
echo "=================================================================="
