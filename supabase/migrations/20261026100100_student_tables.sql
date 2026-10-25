-- =====================================================================
-- 20261026100100_student_tables.sql
--
-- Purpose
--   Creates exam taking and proctoring support tables and extends our
--   own quiz_admin table:
--     1. attempt_proctor_events: stores client-side and server-side proctoring
--        events (tab switch, fullscreen exits, etc.). Reachable only via RPCs.
--     2. attempt_reports: snapshot of the final graded performance report
--        for completed quiz attempts. Reachable only via RPCs.
--     3. quiz_admin extension columns: max_violations (default 3),
--        instructions_extra (supplementary test instructions).
--
-- Lead tables referenced (FK targets only; nothing on them is altered)
--   public.quiz_attempts (id)
--
-- Assumptions & Safety
--   - Additive only: no modifications to lead tables.
--   - FKs to lead tables are ON DELETE CASCADE and indexed.
--   - RLS is enabled on new tables with no browser policies; access is
--     restricted to SECURITY DEFINER functions.
--   - Table privileges are explicitly revoked from anon and authenticated.
--
-- ROLLBACK
--   alter table if exists public.quiz_admin
--     drop column if exists instructions_extra,
--     drop column if exists max_violations;
--   drop table if exists public.attempt_reports;
--   drop table if exists public.attempt_proctor_events;   -- also drops its index
-- =====================================================================
set search_path = public, extensions;

-- -------------------------------------------------- attempt_proctor_events
create table if not exists public.attempt_proctor_events (
  id           uuid primary key default gen_random_uuid(),
  attempt_id   uuid not null references public.quiz_attempts(id) on delete cascade,
  event_type   text not null,
  occurred_at  timestamptz not null default now(),
  meta         jsonb not null default '{}'::jsonb
);

-- Covers the FK (attempt_id is the leading column) and the per-attempt
-- violation count / debounce lookups.
create index if not exists attempt_proctor_events_attempt_idx
  on public.attempt_proctor_events (attempt_id, occurred_at);
comment on column public.attempt_proctor_events.meta is
  'Client details (truncated to 4 KB) plus "counted": whether the event counted as a violation.';

-- --------------------------------------------------------- attempt_reports
create table if not exists public.attempt_reports (
  attempt_id    uuid primary key references public.quiz_attempts(id) on delete cascade,
  report        jsonb not null,
  generated_at  timestamptz not null default now()
);

-- ----------------------------------------------------- quiz_admin columns
-- Add columns only to our own extension table.
alter table public.quiz_admin
  add column if not exists max_violations int not null default 3 check (max_violations >= 0),
  add column if not exists instructions_extra text;

-- --------------------------------------------------------------------- RLS
alter table public.attempt_proctor_events enable row level security;
alter table public.attempt_reports        enable row level security;

revoke all on table public.attempt_proctor_events from anon, authenticated;
revoke all on table public.attempt_reports        from anon, authenticated;
