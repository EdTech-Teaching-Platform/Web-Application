# Admin port: push runbook

This runbook pushes the admin portal migrations to the lead's live Supabase database.

- **You run every step yourself, by hand, with the lead's approval.**
- Nothing here has been run by the port author.
- Each step says what output to expect. If a step doesn't match, stop.

Files involved:
- `supabase/migrations/20261025*_admin_*.sql`: 29 migrations in 3 batches. Each
  batch starts with a read-only preflight.
- `docs/trial_run.sql`: all 29 files inside `begin; … rollback;`.
- `scripts/admin_indexes_concurrently.sql`: indexes on lead tables, run by hand,
  one statement at a time.
- `scripts/admin_snapshot_lead_editor.sql`: a read-only before / after
  fingerprint, one row per object (`kind`, `name`, `hash`), for CSV export.
- `scripts/admin_verify_push_editor.sql`: read-only post-push checks, one row per
  check (`check_name`, `status`, `detail`). Generated from the migrations.

**Where SQL runs.** All SQL steps use the **Supabase SQL editor** (Dashboard →
SQL Editor → New query). The editor only shows the result of the last statement,
which is why the `_editor` scripts are each a single statement. The CLI steps
(`link`, `migration list`, `db push`) still run in a terminal.

The psql versions (`scripts/admin_snapshot_lead.sql`,
`scripts/admin_verify_push.sql`) are kept and check the same things, but they use
psql meta-commands (`\echo`, `\set`) and return several result sets, so they
don't work in the editor.

## 0. Preconditions

- [ ] **Approval.** The lead approves the push, the index script and the cron
      jobs.
- [ ] **Backup.** A recent backup or PITR point exists (Dashboard → Database →
      Backups). Note the time.
- [ ] **pg_cron is enabled** (Dashboard → Database → Extensions). The Batch 3
      preflight aborts without it.
- [ ] **pg_trgm is enabled.** It's needed by repeated-question detection and one
      index in the index script.
- [ ] **An admin exists.** At least one `profiles` row has role `admin` or
      `super_admin`. The Batch 1 preflight aborts otherwise. If you have to
      create the first admin, do it only for your own account, with the lead's
      approval.
- [ ] **Connection string (CLI only).** `DATABASE_URL` is a **direct or
      session-mode** connection (port 5432), not the transaction pooler (6543).
      It's needed only if you use psql instead of the editor.

```sh
export DATABASE_URL='postgresql://postgres.<ref>:<password>@<host>:5432/postgres'
npx supabase --version
```

## 1. Link the project

`supabase/.temp` was deleted, so the CLI isn't linked any more.

```sh
npx supabase link --project-ref <lead-project-ref>
```

## 2. Before-snapshot

1. In the SQL editor, paste all of `scripts/admin_snapshot_lead_editor.sql` and
   run it.
2. Export the result as CSV (the results pane's export / download option) and
   save it as `snapshot_before.csv`.
3. Note the `hash` in the row with `kind = lead_function_def`
   (`public.publish_test_series(uuid,boolean)`). Check 9 compares against it.

**Expect:** several thousand rows, sorted by `kind`, then `name`. Before saving,
make sure the export holds every row. If the editor caps result rows, raise or
remove the cap and run it again.

## 3. Re-run the trial

Files changed after your first successful trial run (FK actions and indexes,
notification preferences, cron detection). Run it again: paste all of
`docs/trial_run.sql` into a new editor query and run it.

**Expect:** "Success. No rows returned", with no error. The file starts with
`begin;` and ends with `rollback;`, so nothing is kept.

**If a statement fails,** Postgres skips the rest and rolls the transaction back,
so again nothing is kept. If the error is a preflight raise (`Admin port …
preflight: …`), read the message: it lists every problem at once.

## 4. Check the migration history

```sh
npx supabase migration list
```

**Expect:** 29 local-only versions, `20261025100000` … `20261025120800`, with an
empty Remote column.

**STOP if any version shows in Remote but not in Local** (the lead's own
migration history). `db push` will refuse. The fix is the lead's call:
- either add the lead's migration files to `supabase/migrations/`;
- or run `supabase migration repair`, which rewrites the remote history table.
  **Don't run repair without the lead.**

If a remote version is **newer** than `20261025…`, push needs `--include-all`.
Again, only with the lead's approval.

## 5. Dry run

```sh
npx supabase db push --dry-run
```

**Expect:** exactly the 29 `20261025*_admin_*.sql` files, in order, and nothing
else.

## 6. Push

```sh
npx supabase db push
```

- **How it applies:** each file runs in its own transaction, and the CLI stops
  at the first failure.
- **Preflights:** a failing preflight (`…00000`, `…10000`, `…20000`) changes
  nothing.
- **Mid-batch failure:** the files before it stay applied. Run
  `npx supabase migration list` to see which ones, then either fix and push again
  (files are idempotent: `if not exists` / `create or replace` on our own names),
  or roll back (section 10).

## 7. Indexes on lead tables (manual, CONCURRENTLY)

Open `scripts/admin_indexes_concurrently.sql` in the SQL editor. **Select one
`create index concurrently …` statement (both lines) and run only that
selection.** Wait for "Success", then do the next one: 15 statements in total.

- **Why one at a time:** running the whole file sends one multi-statement
  request. Postgres runs that as a single transaction, and every statement fails
  with `CREATE INDEX CONCURRENTLY cannot run inside a transaction block`.
- **Trigram index:** `adm_quiz_questions_norm_trgm` uses
  `extensions.gin_trgm_ops`. If it fails with "operator class does not exist",
  check where pg_trgm lives (the query is in the file header) and change the
  prefix.
- **What it builds:** 15 indexes on the lead's `callback_requests`,
  `institutions`, `audit_logs`, `profiles`, `quizzes`, `quiz_questions`,
  `quiz_attempts`, `quiz_answers`, `test_series`, `notifications`,
  `support_tickets` and `support_ticket_replies`.
- **Locking:** none of them blocks writes.
- **If one fails,** Postgres can leave an `INVALID` index behind. Find it with
  the query below, drop it with its `drop index concurrently …` line from the
  file's ROLLBACK block (on its own), and re-run that one statement. Every
  statement is `if not exists`, so re-running one that succeeded does nothing.

```sql
select indexrelid::regclass from pg_index where not indisvalid and indexrelid::regclass::text like '%adm\_%';
```

## 8. Verify

Paste all of `scripts/admin_verify_push_editor.sql` into the SQL editor and run
it. It returns **14 rows** (`check_name`, `status`, `detail`), and **every
`status` must be `PASS`**. On a `FAIL`, `detail` lists the offending objects.

| Check | PASS means |
|---|---|
| 1, 2: objects exist | no missing tables, sequences or function names |
| 3: RLS on our tables | all 30 tables have RLS enabled |
| 4: table privileges | anon / authenticated can't touch our tables directly |
| 5: anon execute | only `submit_callback_request` is callable by anon |
| 6: internal helpers | only `adm_is_platform_admin` and `adm_publish_test_series` are callable by authenticated |
| 7: server-only functions | cron, service-role and Edge-only functions aren't callable by authenticated |
| 8a / 8b: hardening | every function pins `search_path`; every browser RPC is SECURITY DEFINER |
| 9: lead `publish_test_series(uuid, boolean)` | it still exists. **Also compare by hand:** the `md5=` value in `detail` must equal the `lead_function_def` hash noted in section 2 |
| 10: cron | `adm_detect_repeated_questions`, `adm_dispatch_due_notifications`, `adm_purge_expired_report_results`, `adm_purge_old_admin_auth_events` and `adm_release_scheduled_series` all exist and are active |
| 11a / 11b: house course | the `platform-test-series-house` course exists (`detail` shows `status=draft`), plus the 2 settings rows |
| Summary | 30 of 30 tables and 237 of 237 function names are present |

Then the after-snapshot:

1. Run `scripts/admin_snapshot_lead_editor.sql` again.
2. Export it as `snapshot_after.csv`.
3. Diff the two files in a terminal (Git Bash on Windows):

```sh
diff snapshot_before.csv snapshot_after.csv | grep '^<'      # must print NOTHING
diff snapshot_before.csv snapshot_after.csv | grep '^>' | less # review the additions
```

A changed object shows as a `<` line (the old hash) plus a `>` line (the new
hash), with the same `kind` and `name`.

- **Any `<` line** means a lead object (function, column, constraint, RLS flag,
  policy, trigger, grant or cron job) changed. Stop and investigate.
- **Expected `>` lines:** our objects, the 14 columns added to
  `callback_requests` / `institutions` / `educator_verification_docs`, the two
  `question-images` storage policies, and the 5 `adm_` cron jobs.

## 9. Cron health (5–10 minutes after the push)

```sql
select j.jobname, d.status, d.start_time, left(d.return_message, 120) as message
  from cron.job_run_details d join cron.job j on j.jobid = d.jobid
 where j.jobname like 'adm\_%'
 order by d.start_time desc
 limit 20;
```

**Expect:** `succeeded` rows for `adm_dispatch_due_notifications` (every minute)
and `adm_release_scheduled_series` (every 5 minutes). The daily jobs appear after
02:00–03:00 GMT.

The schedules are in pg_cron's time zone (GMT by default).

The cron file is safe to run again: it removes and re-adds only the 5 `adm_` jobs.

## 10. Rollback order

1. **Restore:** the safest full rollback is restoring the backup or PITR point
   from section 0.
2. **Manual rollback:** otherwise, run the `-- ROLLBACK` block from each file's
   header **in this order** (newest first). In the SQL editor, run each block as
   one query wrapped in `begin;` … `commit;`. If any statement fails, the whole
   block is rolled back.

| Step | Source of the SQL | Notes |
|---|---|---|
| 1 | `20261025120800_admin_cron.sql` | Unschedule the 5 `adm_` jobs **first**, so nothing calls the functions being dropped. |
| 2 | `scripts/admin_indexes_concurrently.sql` (its ROLLBACK lines) | Run each `drop index concurrently` line **on its own**, with no `begin` / `commit`, the same way the indexes were built. Needed before dropping `adm_norm_text` (an index expression depends on it). |
| 3 | `20261025120700` → `120600` → `120500` → `120400` | `120400` also deletes the fanned-out inbox rows (`notifications where reference_type = 'notification_campaign'`). That is data in a lead table, so confirm with the lead. |
| 4 | `20261025120300` → `120200` → `120100` | `120100` drops the Batch 3 tables. |
| 5 | `20261025120000` | Preflight: nothing to roll back. |
| 6 | `20261025110900` → `110800` → `110700` → `110600` → `110500` → `110400` | Functions only. |
| 7 | `20261025110300` | Assignment tables. |
| 8 | `20261025110200` | The house course and setting. Only after every series on the house course is gone; those `test_series` / `quizzes` rows are lead-table data written by the RPCs, so decide with the lead. |
| 9 | `20261025110100` | Storage policies, the `question-images` bucket (only if empty), and the authoring tables. |
| 10 | `20261025110000` | Preflight: nothing to roll back. |
| 11 | `20261025100900` → `100800` → `100700` → `100600` | Functions only. |
| 12 | `20261025100500` | Backfill rows (or skip; the tables are dropped next). |
| 13 | `20261025100400` | People tables. |
| 14 | `20261025100300` | Drops the 14 added lead columns **and their data**. Take a backup first; confirm with the lead. |
| 15 | `20261025100200` → `100100` | Lookups (and the `dashboard_quote` setting), helpers and sequences. |
| 16 | `20261025100000` | Preflight: nothing to roll back. |

After a manual rollback, the CLI history still lists the versions as applied.
With the lead's approval, mark them reverted:

```sh
npx supabase migration repair --status reverted 20261025120800 20261025120700 20261025120600 20261025120500 \
  20261025120400 20261025120300 20261025120200 20261025120100 20261025120000 20261025110900 20261025110800 \
  20261025110700 20261025110600 20261025110500 20261025110400 20261025110300 20261025110200 20261025110100 \
  20261025110000 20261025100900 20261025100800 20261025100700 20261025100600 20261025100500 20261025100400 \
  20261025100300 20261025100200 20261025100100 20261025100000
```

**Partial rollback** (for example, Batch 3 only): run steps 1–5 (step 2 only for
the Batch 3 indexes) and repair only the `2026102512…` versions you reverted.

## 11. After the push: Edge Functions (separate approval)

Use `docs/EDGE_FUNCTIONS.md` for the secrets (`RESEND_API_KEY`, `EMAIL_FROM`,
`EDUCATOR_DOCS_BUCKET`, …) and the deploy commands:
- **Deploy only:** `create-educator-invites`, `revoke-user-sessions`,
  `send-notification-emails` and `sign-educator-document`.
- **Leave undeployed:** the payment and refund placeholders.

## Never

- **No `supabase db reset`** against this project. It drops the lead's data.
- **No `migration repair` or `--include-all`** without the lead.
- **No SQL on the `auth` schema.**
- **No edits to lead functions or policies,** including
  `publish_test_series(uuid, boolean)` and `is_admin()`.
