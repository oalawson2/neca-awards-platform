#!/usr/bin/env bash
#
# Daily database backup for the NECA Supabase project (free tier — no
# automatic backups included).
#
# Dumps the database via pg_dump, keeps the most recent KEEP_COUNT backups,
# and deletes older ones automatically. Stops on the first failure (set -e)
# and never leaves a broken/empty file where a good backup should be — see
# the tmp-file-then-move logic below.
#
# Meant to be triggered daily by a cPanel Cron Job — see the README's
# "Scheduled job: database backups" section for the exact cron setup, and
# RESTORE.md for how to restore from a backup file in an emergency.
#
# Usage: ./backup.sh   (from anywhere — it doesn't need to run from
# APP_ROOT, but does need BACKUP_ENV_FILE to exist)

set -euo pipefail

APP_ROOT="/home/necasmwo/neca-app"

# Outside the app's git repo entirely (not just outside public/) — this
# directory is never touched by `git pull` in deploy.sh, so backups can't
# be wiped by a redeploy, accidentally committed, or served as a static
# file by Next.js (which only serves what's under public/ or matched by an
# app route — a sibling directory like this is invisible to it either way,
# but living outside the repo is the belt-and-braces version of that, and
# survives even if the repo directory itself were ever recreated from
# scratch). Override with BACKUP_DIR if this host's layout differs.
BACKUP_DIR="${BACKUP_DIR:-/home/necasmwo/neca-backups}"

KEEP_COUNT=10

# cPanel Cron Jobs run with a minimal environment — they don't inherit the
# env vars configured in cPanel's "Setup Node.js App" UI (those are only
# injected into the Node process itself). So this script needs its own way
# to find SUPABASE_DB_URL: a small env file, not the calling shell's
# environment.
BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-$APP_ROOT/.env.local}"

if [ ! -f "$BACKUP_ENV_FILE" ]; then
  echo "ERROR: $BACKUP_ENV_FILE not found." >&2
  echo "Create it with a line like:" >&2
  echo "  SUPABASE_DB_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" >&2
  echo "(the direct connection string from Supabase -> Project Settings -> Database, not the pgbouncer/transaction pooler one — see .env.example)." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$BACKUP_ENV_FILE"
set +a

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "ERROR: SUPABASE_DB_URL is not set in $BACKUP_ENV_FILE." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump is not installed on this host. Ask hosting support to install the PostgreSQL client tools (pg_dump), then re-run this script." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y-%m-%d-%H%M)"
BACKUP_FILE="$BACKUP_DIR/neca-backup-$TIMESTAMP.sql"
TMP_FILE="$BACKUP_FILE.tmp"

echo "==> [1/2] Backing up NECA Supabase database to $BACKUP_FILE ..."

# Dump to a .tmp file first and only rename it into place once pg_dump has
# actually succeeded and produced a non-empty file — so a failed or
# half-written dump never looks like a valid backup sitting in $BACKUP_DIR.
if pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges --format=plain --file="$TMP_FILE"; then
  if [ -s "$TMP_FILE" ]; then
    mv "$TMP_FILE" "$BACKUP_FILE"
    echo "    SUCCESS: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
  else
    rm -f "$TMP_FILE"
    echo "    FAILED: pg_dump produced an empty file. No backup was saved." >&2
    exit 1
  fi
else
  rm -f "$TMP_FILE"
  echo "    FAILED: pg_dump exited with an error. No backup was saved." >&2
  exit 1
fi

echo "==> [2/2] Pruning old backups (keeping the most recent $KEEP_COUNT)..."
mapfile -t old_backups < <(ls -1t "$BACKUP_DIR"/neca-backup-*.sql 2>/dev/null | tail -n "+$((KEEP_COUNT + 1))")
if [ "${#old_backups[@]}" -eq 0 ]; then
  echo "    nothing to prune ($(ls -1 "$BACKUP_DIR"/neca-backup-*.sql 2>/dev/null | wc -l) backup(s) on disk)."
else
  for old in "${old_backups[@]}"; do
    echo "    removing $old"
    rm -f "$old"
  done
fi

echo "==> Done."
