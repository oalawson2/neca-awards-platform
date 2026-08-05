# Restoring from a database backup

Plain-language emergency instructions for restoring the NECA Supabase
database from one of the backups `backup.sh` produces. You don't need deep
database experience to follow this — just go step by step.

**Before you do anything:** restoring loads all the data from the backup
file into a database. It does **not** first erase whatever is already
there. If you restore into a database that still has data in it, you'll
likely get errors about things already existing (e.g. "table already
exists"). For that reason, **always restore into a brand-new, empty
database** — either a fresh Supabase project (if the old one was lost or
badly corrupted) or a newly created empty database (if you're just
practicing/testing a restore). Don't try to restore on top of a live
database that still has good data in it.

## Step 1 — Find the backup file you want to restore

Backups live on the app server, outside the app's own folder, at:

```
/home/necasmwo/neca-backups/
```

Each file is named like `neca-backup-2026-08-05-1400.sql` — the numbers
are the date and time (24-hour clock) the backup was taken. SSH into the
server and list them, newest first:

```bash
ls -lt /home/necasmwo/neca-backups/
```

Pick the most recent one from *before* whatever went wrong, and note its
full filename.

## Step 2 — Get a connection string for the database you're restoring into

This is a Postgres connection string, the same kind of value as
`SUPABASE_DB_URL` in `.env.example` — you'll find it in Supabase under
**Project Settings → Database → Connection string → URI**. Use the
**direct connection** (port `5432`), not the "Transaction pooler" one
(port `6543`) — the pooler can reject the kind of restore this needs.

If the old Supabase project is gone, create a new one first, then grab
*its* connection string from the same place.

It looks like this (with your real password and project ref filled in):

```
postgresql://postgres:<YOUR-PASSWORD>@db.<YOUR-PROJECT-REF>.supabase.co:5432/postgres
```

## Step 3 — Run the restore

From the app server (or anywhere with `psql` installed and network access
to Supabase), run:

```bash
psql "<CONNECTION-STRING-FROM-STEP-2>" -f "/home/necasmwo/neca-backups/<BACKUP-FILENAME-FROM-STEP-1>"
```

For example:

```bash
psql "postgresql://postgres:hunter2@db.abcxyzproject.supabase.co:5432/postgres" -f "/home/necasmwo/neca-backups/neca-backup-2026-08-05-1400.sql"
```

It'll print a lot of lines like `CREATE TABLE`, `COPY 123`, `ALTER TABLE`
as it recreates everything from the backup — that's normal and expected,
not an error. It's finished when it stops and gives you back the prompt.

## Step 4 — Check it worked

Open the Supabase dashboard for the project you restored into → **Table
Editor**, and confirm the tables and rows you expect are there. If the
app points at this project (`NEXT_PUBLIC_SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY` in the app's environment variables — see
`.env.example`), also just click around the live app once it's pointed
there.

## If something looks wrong

Stop and don't try more restores or other database commands on the same
database — that risks making things harder to untangle. Get in touch with
whoever manages the Supabase project/hosting before doing anything else,
and mention exactly which backup file you tried to restore and what error
(if any) `psql` printed.

## A note on where backups live

Backups currently only exist on the app server's disk
(`/home/necasmwo/neca-backups/`). If that disk were ever lost entirely,
the backups would go with it. It's worth periodically downloading the
newest file to somewhere else (e.g. `scp` it to a laptop, or upload it to
cloud storage) for real disaster-recovery coverage — this isn't automated
today.
