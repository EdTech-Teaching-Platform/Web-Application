-- =====================================================================
-- 20261025100400_admin_people_tables.sql
--
-- Purpose
--   Admin-only state about people, kept beside the lead's profile tables
--   (doc sections 2.13 / 2.14 / 2.17, decisions D6 / D8 / D9):
--     students               app-level block state + human code (STU-2001)
--     student_block_history  block / unblock trail
--     educator_admin_state   account status, finer review state, human code
--     educator_invites       bulk / individual invite queue
--     user_geo               student state / institution link
--     admin_auth_events      admin sign-in / sign-out trail (not audit_logs)
--     user_sessions          one row per signed-in admin browser
--     admin_notes            dashboard scratchpad
--   plus helpers that need these tables (adm_ensure_*, adm_is_account_blocked,
--   adm_end_user_sessions, adm_open_assignment_count).
--
-- Lead objects read
--   public.profiles (FK target, role), public.institutions (FK target).
--   No lead table is altered; there are no triggers on lead tables (D8).
--
-- Assumptions
--   * Rows are created by a one-time backfill (next file) and lazily by RPCs;
--     a missing students / educator_admin_state row means "active".
--   * All access is through SECURITY DEFINER RPCs: RLS on, no policies.
--   * test_assignments is created in Batch 2; adm_open_assignment_count checks
--     for it at run time and returns 0 until it exists.
--
-- ROLLBACK
--   drop function if exists public.adm_open_assignment_count(uuid, text[]);
--   drop function if exists public.adm_end_user_sessions(uuid, text, uuid);
--   drop function if exists public.adm_is_account_blocked(uuid);
--   drop function if exists public.adm_ensure_educator_state(uuid);
--   drop function if exists public.adm_ensure_student(uuid);
--   drop table if exists public.admin_notes, public.user_sessions, public.admin_auth_events,
--     public.user_geo, public.educator_invites, public.educator_admin_state,
--     public.student_block_history, public.students;
-- =====================================================================
set search_path = public, extensions;

-- ----------------------------------------------------------------- students
create table if not exists public.students (
  id              uuid primary key references public.profiles(id) on delete cascade,
  student_code    text not null unique default ('STU-' || nextval('public.adm_student_code_seq')),
  account_status  text not null default 'active' check (account_status in ('active', 'blocked')),
  blocked_reason  text,
  blocked_at      timestamptz,
  blocked_by      uuid references public.profiles(id) on delete set null,
  last_active_at  timestamptz,
  onboarded_via   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint students_blocked_reason_chk
    check (account_status <> 'blocked' or nullif(btrim(blocked_reason), '') is not null)
);
create index if not exists students_account_status_idx on public.students (account_status);

create table if not exists public.student_block_history (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  action      text not null check (action in ('blocked', 'unblocked')),
  reason      text,
  by_admin    uuid references public.profiles(id) on delete set null,
  at          timestamptz not null default now()
);
create index if not exists student_block_history_student_idx on public.student_block_history (student_id, at desc);

-- ----------------------------------------------------- educator_admin_state
create table if not exists public.educator_admin_state (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  educator_code   text not null unique default ('EDU-' || nextval('public.adm_educator_code_seq')),
  account_status  text not null default 'active'
                  check (account_status in ('active', 'inactive', 'suspended', 'deleted')),
  status_reason   text,
  suspended_at    timestamptz,
  deleted_at      timestamptz,
  review_state    text check (review_state in ('under_review', 'changes_requested')),   -- D7
  review_note     text,
  gender          text,
  dob             date,
  last_active_at  timestamptz,
  onboarded_via   text not null default 'self',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists educator_admin_state_account_idx on public.educator_admin_state (account_status);

create table if not exists public.educator_invites (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  phone             text,
  email             text not null,
  qualification     text,
  years_experience  int check (years_experience is null or years_experience between 0 and 60),
  subjects          text[] not null default '{}',
  status            text not null default 'pending' check (status in ('pending', 'sent', 'accepted', 'expired', 'failed')),
  user_id           uuid references public.profiles(id) on delete set null,
  invited_by        uuid references public.profiles(id) on delete set null,
  invited_at        timestamptz not null default now(),
  sent_at           timestamptz,
  accepted_at       timestamptz,
  error             text
);
create unique index if not exists educator_invites_open_email_uidx
  on public.educator_invites (lower(email)) where status in ('pending', 'sent');

-- ----------------------------------------------------------------- user_geo
create table if not exists public.user_geo (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  state_code      text references public.regions(code),
  institution_id  uuid references public.institutions(id) on delete set null,
  source          text not null default 'admin' check (source in ('admin', 'self', 'import', 'derived')),
  updated_at      timestamptz not null default now()
);
create index if not exists user_geo_state_idx on public.user_geo (state_code);

-- -------------------------------------------------------- admin_auth_events
create table if not exists public.admin_auth_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  session_id  uuid,
  event_type  text not null check (event_type in ('login', 'logout', 'logout_all', 'session_revoked', 'login_blocked')),
  role        text,
  user_agent  text,
  ip_hash     text,
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists admin_auth_events_user_idx on public.admin_auth_events (user_id, created_at desc);
create index if not exists admin_auth_events_type_idx on public.admin_auth_events (event_type, created_at desc);

-- ------------------------------------------------------------ user_sessions
create table if not exists public.user_sessions (
  session_id    uuid primary key,                 -- session_id claim of the Supabase JWT
  user_id       uuid not null references public.profiles(id) on delete cascade,
  role          text,
  user_agent    text,
  ip_hash       text,
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  ended_at      timestamptz,
  end_reason    text check (end_reason in ('logout', 'logout_all', 'revoked', 'expired'))
);
create index if not exists user_sessions_open_idx on public.user_sessions (user_id) where ended_at is null;
create index if not exists user_sessions_seen_idx on public.user_sessions (last_seen_at desc);

-- -------------------------------------------------------------- admin_notes
create table if not exists public.admin_notes (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references public.profiles(id) on delete cascade,
  text        text not null check (char_length(btrim(text)) between 1 and 500),
  is_done     boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists admin_notes_admin_idx on public.admin_notes (admin_id, created_at);

-- ------------------------------------------------ foreign-key indexes
-- Every column that references a lead table is indexed (FK audit), so a
-- delete on the lead table never scans these tables.
create index if not exists students_blocked_by_idx              on public.students (blocked_by) where blocked_by is not null;
create index if not exists student_block_history_by_admin_idx   on public.student_block_history (by_admin) where by_admin is not null;
create index if not exists educator_invites_user_idx            on public.educator_invites (user_id) where user_id is not null;
create index if not exists educator_invites_invited_by_idx      on public.educator_invites (invited_by) where invited_by is not null;
create index if not exists user_geo_institution_idx             on public.user_geo (institution_id) where institution_id is not null;
create index if not exists user_sessions_user_idx               on public.user_sessions (user_id);

-- --------------------------------------------------- updated_at triggers
-- (own tables only; nothing is attached to lead tables)
drop trigger if exists trg_students_touch on public.students;
create trigger trg_students_touch before update on public.students
  for each row execute function public.adm_touch_updated_at();
drop trigger if exists trg_educator_admin_state_touch on public.educator_admin_state;
create trigger trg_educator_admin_state_touch before update on public.educator_admin_state
  for each row execute function public.adm_touch_updated_at();
drop trigger if exists trg_user_geo_touch on public.user_geo;
create trigger trg_user_geo_touch before update on public.user_geo
  for each row execute function public.adm_touch_updated_at();
drop trigger if exists trg_admin_notes_touch on public.admin_notes;
create trigger trg_admin_notes_touch before update on public.admin_notes
  for each row execute function public.adm_touch_updated_at();

-- ------------------------------------------------------------------ helpers
-- D8: lazy creation of the side rows.
create or replace function public.adm_ensure_student(p_id uuid) returns void
language sql security definer set search_path = public, extensions as $$
  insert into public.students (id)
  select p.id from public.profiles p where p.id = p_id and p.role = 'student'
  on conflict (id) do nothing;
$$;

create or replace function public.adm_ensure_educator_state(p_id uuid) returns void
language sql security definer set search_path = public, extensions as $$
  insert into public.educator_admin_state (user_id)
  select p.id from public.profiles p where p.id = p_id and p.role = 'educator'
  on conflict (user_id) do nothing;
$$;

-- D6: blocking is app-level only.
create or replace function public.adm_is_account_blocked(p_user uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.students where id = p_user and account_status = 'blocked')
      or exists (select 1 from public.educator_admin_state
                  where user_id = p_user and account_status in ('inactive', 'suspended', 'deleted'));
$$;

-- Marks a user's open sessions as ended and records one event. App-level only:
-- the auth schema is never touched from SQL (D6); the Edge Function in Batch 4
-- revokes the real refresh tokens through the Admin API.
create or replace function public.adm_end_user_sessions(p_user uuid, p_reason text, p_except uuid default null)
returns int
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  update public.user_sessions
     set ended_at = now(), end_reason = 'revoked'
   where user_id = p_user and ended_at is null
     and (p_except is null or session_id <> p_except);
  get diagnostics n = row_count;
  insert into public.admin_auth_events (user_id, event_type, role, meta)
  values (p_user, 'session_revoked', (select role from public.profiles where id = p_user),
          jsonb_build_object('reason', p_reason, 'sessions', n, 'by', auth.uid()));
  return n;
end $$;

-- Open test assignments held by an educator. test_assignments arrives in
-- Batch 2, so the table is looked up at run time.
create or replace function public.adm_open_assignment_count(p_educator uuid, p_statuses text[]) returns int
language plpgsql stable security definer set search_path = public, extensions as $$
declare n int := 0;
begin
  if to_regclass('public.test_assignments') is not null then
    execute 'select count(*)::int from public.test_assignments where educator_id = $1 and status = any ($2)'
       into n using p_educator, p_statuses;
  end if;
  return n;
end $$;

revoke all on function public.adm_ensure_student(uuid) from public, anon, authenticated;
revoke all on function public.adm_ensure_educator_state(uuid) from public, anon, authenticated;
revoke all on function public.adm_is_account_blocked(uuid) from public, anon, authenticated;
revoke all on function public.adm_end_user_sessions(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.adm_open_assignment_count(uuid, text[]) from public, anon, authenticated;

-- -------------------------------------------------------------------- RLS
alter table public.students              enable row level security;
alter table public.student_block_history enable row level security;
alter table public.educator_admin_state  enable row level security;
alter table public.educator_invites      enable row level security;
alter table public.user_geo              enable row level security;
alter table public.admin_auth_events     enable row level security;
alter table public.user_sessions         enable row level security;
alter table public.admin_notes           enable row level security;
revoke all on table public.students, public.student_block_history, public.educator_admin_state,
  public.educator_invites, public.user_geo, public.admin_auth_events, public.user_sessions, public.admin_notes
  from anon, authenticated;
