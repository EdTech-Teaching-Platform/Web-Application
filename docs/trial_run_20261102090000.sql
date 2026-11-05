-- Trial for supabase/migrations/20261102090000_student_block_enforcement.sql ONLY.
-- Paste all of it into the SQL editor and run: expect "Success. No rows returned".
-- Everything is rolled back (the last line of this file is "rollback;").
begin;

-- =====================================================================
-- 20261102090000_student_block_enforcement.sql
--
-- Purpose (QA triage P2, bugs #15 / #16 / #26)
--   A blocked student could still sign in and use the student portal: the
--   block was app-level only (D6) and only the WRITE RPCs checked it
--   (adm_student_writer_uid). Every read RPC (dashboard, lists, series, intro,
--   history, stats, report, my series, my feedback) went through
--   adm_student_uid(), which never looked at the block.
--
--   1. adm_student_is_blocked(uuid): internal; true when students.account_status
--      = 'blocked'.
--   2. adm_student_uid() now refuses a blocked caller with a stable error the
--      frontend detects:
--        SQLSTATE 'UL403', message 'account_blocked', hint 'account_blocked',
--        detail: a generic sentence (never the admin's internal reason).
--      All 15 student_* RPCs take the caller from adm_student_uid() (writers
--      through adm_student_writer_uid(), which calls it first), so every one
--      of them refuses a blocked student, effective immediately (existing
--      access tokens included):
--        student_dashboard, student_list_series, student_get_series,
--        student_enroll, student_my_series, student_get_test_intro,
--        student_start_attempt, student_save_answer, student_log_proctor_event,
--        student_submit_attempt, student_get_report, student_my_history,
--        student_get_stats, student_submit_feedback, student_my_feedback.
--      (There is no student orders RPC.)
--   3. student_get_account_status(): never refused for a block; returns
--      {blocked, reason_public, status}. reason_public is a generic message.
--   4. For the set-user-ban Edge Function (Auth-level ban; admin only):
--        adm_user_ban_check(uuid)   who the target is (exists, role, admin?,
--                                   self?, blocked in SQL?)
--        adm_record_user_ban(uuid, boolean, boolean, text)  audit row
--                                   user.auth_ban / user.auth_unban (+ ok / error)
--      Both require an admin caller (adm_require_admin).
--   5. get_student_detail adds the block details for the admin page:
--      blocked_by, blocked_by_name and block_history (last 10 block / unblock
--      events with the admin's name). Everything else is unchanged.
--
-- Our objects only (adm_* helpers and our RPCs); no lead table, trigger, RLS
-- or policy changes.
--
-- ROLLBACK
--   scripts/rollback_20261102090000_student_block_enforcement.sql
-- =====================================================================
set search_path = public, extensions;

-- --------------------------------------------------------------- preflight
do $pre$
declare
  v_problems text[] := '{}';
  v_sig      text;
begin
  foreach v_sig in array array[
    'public.adm_student_uid()', 'public.adm_student_writer_uid()', 'public.adm_is_account_blocked(uuid)',
    'public.adm_require_admin()', 'public.adm_is_platform_admin()', 'public.adm_audit(text,text,uuid,jsonb,jsonb,text)',
    'public.adm_initials(text)', 'public.get_student_detail(uuid)', 'public.block_student(uuid,text)', 'public.unblock_student(uuid)']
  loop
    if to_regprocedure(v_sig) is null then
      v_problems := v_problems || format('missing %s (apply the earlier migrations first)', v_sig);
    end if;
  end loop;
  foreach v_sig in array array['adm_student_is_blocked', 'student_get_account_status', 'adm_user_ban_check', 'adm_record_user_ban'] loop
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = v_sig) then
      v_problems := v_problems || format('function public.%s already exists', v_sig);
    end if;
  end loop;
  if to_regclass('public.students') is null or to_regclass('public.student_block_history') is null
     or to_regclass('public.adm_admin_users') is null then
    v_problems := v_problems || 'missing students / student_block_history / adm_admin_users'::text;
  end if;
  if cardinality(v_problems) > 0 then
    raise exception 'Student block enforcement preflight: %', array_to_string(v_problems, '; ');
  end if;
end $pre$;

-- ------------------------------------------------------------------ helpers
create or replace function public.adm_student_is_blocked(p_user uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.students s where s.id = p_user and s.account_status = 'blocked');
$$;

-- adm_student_uid: from 20261026100200_student_rpc_series.sql, with the
-- marked 20261102090000 block check.
create or replace function public.adm_student_uid() returns uuid
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in to continue.' using errcode = '42501';
  end if;
  -- 20261102090000: a blocked student is refused by every student RPC.
  if public.adm_student_is_blocked(v_uid) then
    raise exception 'account_blocked'
      using errcode = 'UL403', hint = 'account_blocked',
            detail = 'Your account has been blocked. Contact the administrator to restore access.';
  end if;
  return v_uid;
end $$;

-- The student's own account state. Never refused for a block (the blocked
-- screen needs it); the admin's internal reason is never returned.
create or replace function public.student_get_account_status() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_uid     uuid := auth.uid();
  v_blocked boolean;
begin
  if v_uid is null then
    raise exception 'Sign in to continue.' using errcode = '42501';
  end if;
  v_blocked := public.adm_student_is_blocked(v_uid);
  return jsonb_build_object(
    'blocked', v_blocked,
    'status', case when v_blocked then 'blocked' else 'active' end,
    'reason_public', case when v_blocked
      then 'Your account has been blocked by the administrator. Contact support to restore access.' end);
end $$;

-- For set-user-ban: who the target is. Admin only.
create or replace function public.adm_user_ban_check(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_role text;
begin
  perform public.adm_require_admin();
  select p.role into v_role from public.profiles p where p.id = p_user;
  return jsonb_build_object(
    'exists', v_role is not null or exists (select 1 from auth.users u where u.id = p_user),
    'role', v_role,
    'is_self', p_user = auth.uid(),
    'is_admin', coalesce(v_role in ('admin', 'super_admin'), false)
                or exists (select 1 from public.adm_admin_users a where a.user_id = p_user),
    'blocked', public.adm_is_account_blocked(p_user));
end $$;

-- For set-user-ban: the audit row (after the Auth Admin API call). Admin only.
create or replace function public.adm_record_user_ban(p_user uuid, p_banned boolean, p_ok boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  perform public.adm_audit(case when p_banned then 'user.auth_ban' else 'user.auth_unban' end, 'user', p_user, null,
                           jsonb_build_object('banned', p_banned, 'ok', p_ok), left(p_note, 500));
end $$;

-- get_student_detail: from 20261025100700_admin_rpc_students.sql, with the
-- marked 20261102090000 block details.
create or replace function public.get_student_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  r        jsonb;
  v_series jsonb := '[]'::jsonb;
begin
  perform public.adm_require_admin();

  select jsonb_build_object(
           'id', p.id, 'student_code', s.student_code, 'full_name', p.full_name, 'email', p.email,
           'initials', public.adm_initials(p.full_name), 'grade', sp.grade, 'school_name', sp.school_name,
           'registered_at', p.created_at, 'status', coalesce(s.account_status, 'active'),
           'phone', p.phone, 'city', p.location, 'state', g.state_code,
           'last_active_at', s.last_active_at, 'blocked_reason', s.blocked_reason, 'blocked_at', s.blocked_at,
           'onboarded_via', s.onboarded_via,
           -- 20261102090000: who blocked the student, and the block / unblock trail
           'blocked_by', s.blocked_by, 'blocked_by_name', bp.full_name,
           'block_history', coalesce((
             select jsonb_agg(jsonb_build_object('action', h.action, 'reason', h.reason, 'at', h.at,
                                                 'by', h.by_admin, 'by_name', hp.full_name) order by h.at desc)
               from (select * from public.student_block_history x where x.student_id = p.id order by x.at desc limit 10) h
               left join public.profiles hp on hp.id = h.by_admin), '[]'::jsonb))
    into r
    from public.profiles p
    left join public.student_profiles sp on sp.user_id = p.id
    left join public.students s on s.id = p.id
    left join public.profiles bp on bp.id = s.blocked_by   -- 20261102090000
    left join public.user_geo g on g.user_id = p.id
   where p.id = p_id and p.role = 'student';
  if r is null then return null; end if;

  -- Course enrolments (the lead's model) with lesson completion %.
  r := r || jsonb_build_object('enrolled_courses', coalesce((
    select jsonb_agg(jsonb_build_object(
             'course_id', c.id, 'title', c.title, 'enrolled_at', e.enrolled_at, 'is_active', e.is_active,
             'progress', coalesce((
               select round(100.0 * count(*) filter (where lp.status = 'completed')
                            / nullif((select count(*) from public.lessons l where l.course_id = c.id), 0))
                 from public.lesson_progress lp
                where lp.student_id = p_id and lp.course_id = c.id), 0))
           order by e.enrolled_at desc)
      from public.enrollments e
      join public.courses c on c.id = e.course_id
     where e.student_id = p_id), '[]'::jsonb));

  -- Admin-sold test series enrolments (Batch 2 table), when present.
  if to_regclass('public.admin_series_enrollments') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('series_id', ase.series_id, 'title', ts.title,
                                                   'enrolled_at', ase.enrolled_at, 'progress', 0)
                                order by ase.enrolled_at desc), '[]'::jsonb)
        from public.admin_series_enrollments ase
        join public.test_series ts on ts.id = ase.series_id
       where ase.student_id = $1
    $q$ into v_series using p_id;
  end if;
  return r || jsonb_build_object('enrolled_series', v_series);
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_student_is_blocked(uuid) from public, anon, authenticated;
revoke all on function public.adm_student_uid() from public, anon, authenticated;   -- unchanged: internal
revoke all on function public.student_get_account_status() from public, anon;
grant execute on function public.student_get_account_status() to authenticated;
revoke all on function public.adm_user_ban_check(uuid) from public, anon;
grant execute on function public.adm_user_ban_check(uuid) to authenticated;         -- admin check inside
revoke all on function public.adm_record_user_ban(uuid, boolean, boolean, text) from public, anon;
grant execute on function public.adm_record_user_ban(uuid, boolean, boolean, text) to authenticated;   -- admin check inside
revoke all on function public.get_student_detail(uuid) from public, anon;
grant execute on function public.get_student_detail(uuid) to authenticated;

-- smoke checks
do $chk$
begin
  if to_regprocedure('public.student_get_account_status()') is null or to_regprocedure('public.adm_user_ban_check(uuid)') is null then
    raise exception 'trial: new functions missing';
  end if;
  if position('adm_student_is_blocked' in pg_get_functiondef('public.adm_student_uid()'::regprocedure)) = 0 then
    raise exception 'trial: adm_student_uid does not check the block';
  end if;
  if position('block_history' in pg_get_functiondef('public.get_student_detail(uuid)'::regprocedure)) = 0 then
    raise exception 'trial: get_student_detail has no block_history';
  end if;
  if has_function_privilege('authenticated', 'public.adm_student_is_blocked(uuid)', 'execute') then
    raise exception 'trial: adm_student_is_blocked is callable by authenticated';
  end if;
end $chk$;

rollback;
