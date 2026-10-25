-- Trial for supabase/migrations/20261026090000_admin_allowlist.sql ONLY.
-- Runs the migration inside a transaction and rolls it back: nothing is kept.
-- Paste all of it into the SQL editor and run. Expect "Success. No rows returned".
-- A preflight problem raises "Admin allowlist preflight: ..." (also rolled back).
begin;

-- =====================================================================
-- 20261026090000_admin_allowlist.sql
--
-- Purpose
--   Close the self-promotion hole. adm_is_platform_admin() trusted
--   profiles.role alone, and the lead's RLS lets a user update their own
--   profiles row, role included. Admin status now needs BOTH:
--     1. a row in our allowlist public.adm_admin_users (no browser access), and
--     2. profiles.role still in ('admin', 'super_admin').
--   Removing either one revokes admin access.
--
--   Every server-side "is admin" decision of the port now goes through
--   public.adm_is_admin_user(uuid):
--     * adm_is_platform_admin()      (replaced: same signature, SECURITY DEFINER,
--                                     search_path and grants as Batch 1). It backs
--                                     adm_require_admin(), so every admin RPC,
--                                     get_admin_me, record_login, touch_session,
--                                     and the question-images storage policies.
--     * record_logout(text)          (replaced: admin auth events only for real admins)
--     * adm_resolve_audience(...)    (replaced: the 'admins' audience)
--     * assign_support_ticket(...)   (replaced: the assignee must be a real admin)
--   New read-only RPC: adm_list_admins() (admin only).
--
-- Lead objects read
--   public.profiles (id, role, full_name, email, created_at); auth.users (id),
--   which is only the FK target and the backfill join. Nothing in auth is altered.
--
-- Lead objects touched
--   None. The FK from adm_admin_users to auth.users adds Postgres's internal RI
--   triggers on auth.users (the same as any table referencing it).
--
-- How to add an admin (both steps; see docs/PORT_PROGRESS.md)
--   insert into public.adm_admin_users (user_id, created_by) values ('<user uuid>', '<your uuid>');
--   update public.profiles set role = 'admin' where id = '<user uuid>';   -- lead's approval
--
-- Before applying: review who the backfill will allowlist (anyone who has
-- already set their own role to admin would be included):
--   select id, email, full_name, role, created_at from public.profiles
--    where role in ('admin', 'super_admin') order by created_at;
--
-- ROLLBACK (one transaction; restores the 20261025 definitions exactly)
--   begin;
--   drop function if exists public.adm_list_admins();
--   create or replace function public.adm_is_platform_admin() returns boolean
--   language sql stable security definer set search_path = public, extensions as $$
--     select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'));
--   $$;
--   create or replace function public.record_logout(p_scope text default 'local') returns void
--   language plpgsql security definer set search_path = public, extensions as $$
--   declare
--     v_uid  uuid := auth.uid();
--     v_sid  uuid := public.adm_current_session_id();
--     v_role text;
--     v_global boolean := coalesce(p_scope, 'local') = 'global';
--   begin
--     if v_uid is null then return; end if;
--     if v_global then
--       update public.user_sessions set ended_at = now(), end_reason = 'logout_all'
--        where user_id = v_uid and ended_at is null;
--     elsif v_sid is not null then
--       update public.user_sessions set ended_at = now(), end_reason = 'logout'
--        where session_id = v_sid and ended_at is null;
--     end if;
--     select role into v_role from public.profiles where id = v_uid;
--     if v_role in ('admin', 'super_admin') then
--       insert into public.admin_auth_events (user_id, session_id, event_type, role, meta)
--       values (v_uid, v_sid, case when v_global then 'logout_all' else 'logout' end, v_role,
--               jsonb_build_object('scope', coalesce(p_scope, 'local')));
--     end if;
--   end $$;
--   create or replace function public.adm_resolve_audience(p_type text, p_series uuid[], p_users uuid[])
--   returns setof uuid
--   language sql stable security definer set search_path = public, extensions as $$
--     select p.id from public.profiles p left join public.students st on st.id = p.id
--      where p_type in ('all_users', 'learners') and p.role = 'student' and coalesce(st.account_status, 'active') = 'active'
--     union
--     select p.id from public.profiles p left join public.educator_admin_state es on es.user_id = p.id
--      where p_type in ('all_users', 'educators') and p.role = 'educator' and coalesce(es.account_status, 'active') = 'active'
--     union
--     select p.id from public.profiles p
--      where p_type in ('all_users', 'admins') and p.role in ('admin', 'super_admin')
--     union
--     select st.student_id from public.adm_series_students() st
--      where p_type = 'series_enrolled' and st.series_id = any (coalesce(p_series, '{}'))
--     union
--     select p.id from public.profiles p
--      where p_type = 'selected_users' and p.id = any (coalesce(p_users, '{}'));
--   $$;
--   create or replace function public.assign_support_ticket(p_id uuid, p_admin_id uuid) returns void
--   language plpgsql security definer set search_path = public, extensions as $$
--   declare v_old uuid;
--   begin
--     perform public.adm_require_admin();
--     if p_admin_id is not null
--        and not exists (select 1 from public.profiles where id = p_admin_id and role in ('admin', 'super_admin')) then
--       raise exception 'Assignee must be an admin.' using errcode = '22023';
--     end if;
--     select assigned_to into v_old from public.support_tickets where id = p_id for update;
--     if not found then raise exception 'Support ticket not found.' using errcode = 'P0002'; end if;
--     update public.support_tickets set assigned_to = p_admin_id, updated_at = now() where id = p_id;
--     perform public.adm_audit('support_ticket.assign', 'support_ticket', p_id,
--                              jsonb_build_object('assigned_to', v_old), jsonb_build_object('assigned_to', p_admin_id), null);
--   end $$;
--   drop function if exists public.adm_is_admin_user(uuid);
--   drop table if exists public.adm_admin_users;
--   commit;
--   (Grants survive create or replace, so the restored functions keep theirs.)
-- =====================================================================
set search_path = public, extensions;

-- --------------------------------------------------------------- preflight
-- Read-only. Collects every problem, then raises once. Runs again (and fails
-- on "already exists") if someone re-applies this file by hand: that is intended.
do $pre$
declare
  v_problems text[] := '{}';
  v_name text;
begin
  -- Batches 1-3 objects this file replaces or calls.
  foreach v_name in array array[
    'public.adm_is_platform_admin()', 'public.adm_require_admin()', 'public.adm_current_session_id()',
    'public.record_logout(text)', 'public.adm_resolve_audience(text,uuid[],uuid[])',
    'public.adm_series_students()', 'public.assign_support_ticket(uuid,uuid)',
    'public.adm_audit(text,text,uuid,jsonb,jsonb,text)'
  ] loop
    if to_regprocedure(v_name) is null then
      v_problems := v_problems || format('missing function %s (Batches 1-3 not applied?)', v_name);
    end if;
  end loop;

  foreach v_name in array array['public.user_sessions', 'public.admin_auth_events', 'public.students',
                                'public.educator_admin_state', 'public.support_tickets', 'auth.users'] loop
    if to_regclass(v_name) is null then
      v_problems := v_problems || format('missing table %s', v_name);
    end if;
  end loop;

  foreach v_name in array array['id', 'role', 'full_name', 'email', 'created_at'] loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'profiles' and column_name = v_name) then
      v_problems := v_problems || format('missing column public.profiles.%s', v_name);
    end if;
  end loop;

  -- Name clashes: the new table and the two new functions must not exist yet.
  if to_regclass('public.adm_admin_users') is not null then
    v_problems := v_problems || 'name clash: public.adm_admin_users already exists'::text;
  end if;
  foreach v_name in array array['adm_is_admin_user', 'adm_list_admins'] loop
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = v_name) then
      v_problems := v_problems || format('name clash: function public.%s already exists', v_name);
    end if;
  end loop;

  -- Without at least one admin to backfill, nobody could use the admin portal.
  if to_regclass('auth.users') is not null and not exists (
       select 1 from public.profiles p join auth.users u on u.id = p.id
        where p.role in ('admin', 'super_admin')) then
    v_problems := v_problems || 'no admin / super_admin profile with an auth user to backfill'::text;
  end if;

  if cardinality(v_problems) > 0 then
    raise exception 'Admin allowlist preflight: %', array_to_string(v_problems, '; ');
  end if;
end $pre$;

-- ------------------------------------------------------------------- table
create table if not exists public.adm_admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid   -- who allowlisted them; plain uuid (audit only), null for the backfill
);
comment on table public.adm_admin_users is
  'Admin allowlist (admin port). Admin = row here AND profiles.role in (admin, super_admin). No browser access.';

alter table public.adm_admin_users enable row level security;
revoke all on table public.adm_admin_users from anon, authenticated;

-- Backfill: today's admins. Review the list first (see header).
insert into public.adm_admin_users (user_id, created_by)
select p.id, null
  from public.profiles p join auth.users u on u.id = p.id
 where p.role in ('admin', 'super_admin')
on conflict (user_id) do nothing;

-- ------------------------------------------------------------- the check
-- THE admin check. Internal: callable only through the functions below.
create or replace function public.adm_is_admin_user(p_user_id uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1
                   from public.adm_admin_users a
                   join public.profiles p on p.id = a.user_id
                  where a.user_id = p_user_id
                    and p.role in ('admin', 'super_admin'));
$$;

-- D5, hardened: same signature, SECURITY DEFINER and search_path as Batch 1.
create or replace function public.adm_is_platform_admin() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select public.adm_is_admin_user(auth.uid());
$$;

-- -------------------------------------------- functions that decided by role
-- Called by AuthContext.logout() for EVERY role before signOut(), so it must
-- never fail for students or educators. Events are recorded for admins only.
create or replace function public.record_logout(p_scope text default 'local') returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid  uuid := auth.uid();
  v_sid  uuid := public.adm_current_session_id();
  v_role text;
  v_global boolean := coalesce(p_scope, 'local') = 'global';
begin
  if v_uid is null then return; end if;

  if v_global then
    update public.user_sessions set ended_at = now(), end_reason = 'logout_all'
     where user_id = v_uid and ended_at is null;
  elsif v_sid is not null then
    update public.user_sessions set ended_at = now(), end_reason = 'logout'
     where session_id = v_sid and ended_at is null;
  end if;

  if public.adm_is_admin_user(v_uid) then
    select role into v_role from public.profiles where id = v_uid;
    insert into public.admin_auth_events (user_id, session_id, event_type, role, meta)
    values (v_uid, v_sid, case when v_global then 'logout_all' else 'logout' end, v_role,
            jsonb_build_object('scope', coalesce(p_scope, 'local')));
  end if;
end $$;

create or replace function public.adm_resolve_audience(p_type text, p_series uuid[], p_users uuid[])
returns setof uuid
language sql stable security definer set search_path = public, extensions as $$
  select p.id from public.profiles p left join public.students st on st.id = p.id
   where p_type in ('all_users', 'learners') and p.role = 'student' and coalesce(st.account_status, 'active') = 'active'
  union
  select p.id from public.profiles p left join public.educator_admin_state es on es.user_id = p.id
   where p_type in ('all_users', 'educators') and p.role = 'educator' and coalesce(es.account_status, 'active') = 'active'
  union
  select a.user_id from public.adm_admin_users a join public.profiles p on p.id = a.user_id
   where p_type in ('all_users', 'admins') and p.role in ('admin', 'super_admin')
  union
  select st.student_id from public.adm_series_students() st
   where p_type = 'series_enrolled' and st.series_id = any (coalesce(p_series, '{}'))
  union
  select p.id from public.profiles p
   where p_type = 'selected_users' and p.id = any (coalesce(p_users, '{}'));
$$;

create or replace function public.assign_support_ticket(p_id uuid, p_admin_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_old uuid;
begin
  perform public.adm_require_admin();
  if p_admin_id is not null and not public.adm_is_admin_user(p_admin_id) then
    raise exception 'Assignee must be an admin.' using errcode = '22023';
  end if;
  select assigned_to into v_old from public.support_tickets where id = p_id for update;
  if not found then raise exception 'Support ticket not found.' using errcode = 'P0002'; end if;
  update public.support_tickets set assigned_to = p_admin_id, updated_at = now() where id = p_id;
  perform public.adm_audit('support_ticket.assign', 'support_ticket', p_id,
                           jsonb_build_object('assigned_to', v_old), jsonb_build_object('assigned_to', p_admin_id), null);
end $$;

-- ------------------------------------------------------------------- RPC
-- {admins: [{user_id, name, email, role, active, created_at, created_by, created_by_name}],
--  role_without_allowlist: [{user_id, name, email, role, created_at}]}
-- active = false: allowlisted, but the profile role is no longer admin.
-- role_without_allowlist: profiles claiming an admin role that are NOT admins
-- (e.g. self-promoted); review them.
create or replace function public.adm_list_admins() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return jsonb_build_object(
    'admins', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', a.user_id, 'name', p.full_name, 'email', p.email, 'role', p.role,
               'active', coalesce(p.role in ('admin', 'super_admin'), false),
               'created_at', a.created_at, 'created_by', a.created_by, 'created_by_name', cb.full_name)
             order by a.created_at, a.user_id)
        from public.adm_admin_users a
        left join public.profiles p  on p.id  = a.user_id
        left join public.profiles cb on cb.id = a.created_by), '[]'::jsonb),
    'role_without_allowlist', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', p.id, 'name', p.full_name, 'email', p.email, 'role', p.role, 'created_at', p.created_at)
             order by p.created_at, p.id)
        from public.profiles p
       where p.role in ('admin', 'super_admin')
         and not exists (select 1 from public.adm_admin_users a where a.user_id = p.id)), '[]'::jsonb));
end $$;

-- ------------------------------------------------------------------ grants
-- Restated exactly as in 20261025100100 / 100600 / 120400 / 120600
-- (create or replace keeps grants anyway).
revoke all on function public.adm_is_platform_admin() from public, anon;
grant execute on function public.adm_is_platform_admin() to authenticated;
revoke all on function public.record_logout(text) from public, anon;
grant execute on function public.record_logout(text) to authenticated;
revoke all on function public.adm_resolve_audience(text, uuid[], uuid[]) from public, anon, authenticated;
revoke all on function public.assign_support_ticket(uuid, uuid) from public, anon;
grant execute on function public.assign_support_ticket(uuid, uuid) to authenticated;

-- New.
revoke all on function public.adm_is_admin_user(uuid) from public, anon, authenticated;
revoke all on function public.adm_list_admins() from public, anon;
grant execute on function public.adm_list_admins() to authenticated;

rollback;
