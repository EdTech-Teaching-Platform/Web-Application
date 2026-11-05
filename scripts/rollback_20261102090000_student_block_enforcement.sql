-- =====================================================================
-- scripts/rollback_20261102090000_student_block_enforcement.sql   (GENERATED)
--
-- Undoes 20261102090000_student_block_enforcement.sql: restores the 2 replaced
-- functions verbatim from the files named above them, then drops the new ones.
-- Student blocks stay recorded (students.account_status); Auth bans set by
-- set-user-ban stay until lifted (unblock the student in the admin UI first,
-- or lift the ban in the Supabase dashboard: Authentication -> Users).
-- One transaction. Run only with "approved: rollback 20261102090000".
-- =====================================================================
begin;
set local search_path = public, extensions;

-- adm_student_uid (from 20261026100200_student_rpc_series.sql)
create or replace function public.adm_student_uid() returns uuid
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in to continue.' using errcode = '42501';
  end if;
  return v_uid;
end $$;

-- get_student_detail (from 20261025100700_admin_rpc_students.sql)
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
           'onboarded_via', s.onboarded_via)
    into r
    from public.profiles p
    left join public.student_profiles sp on sp.user_id = p.id
    left join public.students s on s.id = p.id
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

revoke all on function public.adm_student_uid() from public, anon, authenticated;
revoke all on function public.get_student_detail(uuid) from public, anon;
grant execute on function public.get_student_detail(uuid) to authenticated;

drop function if exists public.adm_record_user_ban(uuid, boolean, boolean, text);
drop function if exists public.adm_user_ban_check(uuid);
drop function if exists public.student_get_account_status();
drop function if exists public.adm_student_is_blocked(uuid);

commit;
