# Project rules (read every session)

This repo is the React + Vite frontend plus Supabase code for the Universal Learning LMS admin portal.
The Supabase project is the LEAD'S LIVE PRODUCTION database (shared). Treat it as production.

HARD RULES
- Never run `supabase db push`, `db reset`, `db query`, `migration repair`, `functions deploy`,
  `secrets set`, or any psql/SQL against the linked project unless I explicitly say
  "approved: <command>" in the current conversation. `--dry-run` and `migration list` are allowed.
- Never create or replace a function that already exists in the lead's database. Our functions are
  prefixed adm_ or are the RPC names listed in docs/ADMIN_ON_EXISTING_DB.md section 4 (checked by the
  preflight migrations).
- Migrations are additive only: no drop, alter type, rename, new CHECK/NOT NULL, trigger, RLS change or
  policy change on lead tables. Foreign keys from our tables to lead tables must be
  ON DELETE CASCADE or SET NULL and indexed. See docs/PORT_PROGRESS.md and the port prompt
  (COPILOT_PORT_TO_EXISTING_DB.md) for the decisions D1-D13 and facts F1-F9.
- Never edit an already-applied migration file. After the real push, fixes go in NEW timestamped files
  (supabase/migrations/20261025HHMMSS_admin_<name>.sql or later).
- Never print or commit secrets (.env, service-role keys, API keys). The service-role key never goes in src/.
- Do not run supabase/seed_dev.sql against the linked project.
- After code changes: npm run build and npm test must pass. Report lint warnings only for files you changed.
- Keep docs/PORT_PROGRESS.md current: files, objects, assumptions, open items.