-- =====================================================================
-- 20261025100700_admin_rpc_students.sql
--
-- Purpose
--   Student Management RPCs (D4). These replace the direct table reads and
--   writes that src/portals/admin/services/studentsApi.js made against
--   students / v_students_list / series_enrollments / student_block_history.
--     get_student_stats()                         -> {total, active, blocked}
--     list_students(p_search, p_status, p_grade, p_sort, p_page, p_size)
--                                                 -> table(row_data jsonb, total_count bigint)
--     get_student_detail(p_id)                    -> row + enrolled_courses + enrolled_series
--     block_student(p_id, p_reason) / unblock_student(p_id)
--
-- Lead objects read
--   profiles (role 'student'), student_profiles (grade), enrollments, courses,
--   lessons, lesson_progress, test_series. Writes: audit_logs (via adm_audit).
--
-- Assumptions
--   * Block state is app-level only (D6): students.account_status. Open
--     user_sessions rows are ended; auth tokens are revoked by the Edge
--     Function in Batch 4.
--   * student_profiles.grade is free text; the 'Grade 6'..'Grade 12' UI filter
--     compares the digits (adm_grade_matches).
--   * Fixes from the doc appendix: no series_enrollments.user_id. Series
--     enrolments are read from admin_series_enrollments (Batch 2) when that
--     table exists, looked up at run time.
--
-- ROLLBACK
--   drop function if exists public.unblock_student(uuid);
--   drop function if exists public.block_student(uuid, text);
--   drop function if exists public.get_student_detail(uuid);
--   drop function if exists public.list_students(text, text, text, text, int, int);
--   drop function if exists public.get_student_stats();
--   drop function if exists public.adm_grade_matches(text, text);
-- =====================================================================
set search_path = public, extensions;

create or replace function public.adm_grade_matches(p_grade text, p_filter text) returns boolean
language sql immutable set search_path = public, extensions as $$
  select case
    when p_filter is null or btrim(p_filter) in ('', 'all') then true
    when regexp_replace(p_filter, '\D', '', 'g') <> ''
      then regexp_replace(coalesce(p_grade, ''), '\D', '', 'g') = regexp_replace(p_filter, '\D', '', 'g')
    else lower(btrim(coalesce(p_grade, ''))) = lower(btrim(p_filter))
  end;
$$;

-- ------------------------------------------------------------------ stats
create or replace function public.get_student_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_total bigint; v_blocked bigint;
begin
  perform public.adm_require_admin();
  select count(*) into v_total from public.profiles where role = 'student';
  select count(*) into v_blocked
    from public.students s join public.profiles p on p.id = s.id and p.role = 'student'
   where s.account_status = 'blocked';
  return jsonb_build_object('total', v_total, 'active', v_total - v_blocked, 'blocked', v_blocked);
end $$;

-- ------------------------------------------------------------------- list
-- p_status: active | blocked | all/null.  p_sort: registered_desc | registered_asc | name_asc
create or replace function public.list_students(
  p_search text default null, p_status text default null, p_grade text default null,
  p_sort text default 'registered_desc', p_page int default 1, p_size int default 8
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 8), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with base as (
    select p.id, s.student_code, p.full_name, p.email, p.phone, p.location as city, sp.grade,
           p.created_at as registered_at, coalesce(s.account_status, 'active') as account_status,
           s.blocked_reason, s.blocked_at, s.last_active_at, s.onboarded_via
      from public.profiles p
      left join public.student_profiles sp on sp.user_id = p.id
      left join public.students s on s.id = p.id
     where p.role = 'student'
  ), f as (
    select b.* from base b
     where (v_like is null or b.full_name ilike v_like or b.email ilike v_like
            or coalesce(b.student_code, '') ilike v_like)
       and (p_status is null or p_status in ('', 'all') or b.account_status = p_status)
       and public.adm_grade_matches(b.grade, p_grade)
  )
  select jsonb_build_object(
           'id', f.id, 'student_code', f.student_code, 'full_name', f.full_name, 'email', f.email,
           'initials', public.adm_initials(f.full_name), 'grade', f.grade, 'registered_at', f.registered_at,
           'status', f.account_status, 'phone', f.phone, 'city', f.city, 'state', null::text,
           'last_active_at', f.last_active_at, 'blocked_reason', f.blocked_reason, 'blocked_at', f.blocked_at,
           'onboarded_via', f.onboarded_via),
         count(*) over ()
    from f
   order by case when p_sort = 'name_asc'       then f.full_name end asc,
            case when p_sort = 'registered_asc' then f.registered_at end asc,
            f.registered_at desc, f.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

-- ----------------------------------------------------------------- detail
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

-- ----------------------------------------------------------- block/unblock
create or replace function public.block_student(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_before jsonb;
begin
  perform public.adm_require_admin();
  if not exists (select 1 from public.profiles where id = p_id and role = 'student') then
    raise exception 'Student not found.' using errcode = 'P0002';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Please give a reason for blocking this student.' using errcode = '22023';
  end if;
  perform public.adm_ensure_student(p_id);
  select jsonb_build_object('status', account_status) into v_before from public.students where id = p_id for update;
  if v_before ->> 'status' = 'blocked' then
    raise exception 'This student is already blocked.' using errcode = '22023';
  end if;

  update public.students
     set account_status = 'blocked', blocked_reason = btrim(p_reason), blocked_at = now(), blocked_by = auth.uid()
   where id = p_id;
  insert into public.student_block_history (student_id, action, reason, by_admin)
  values (p_id, 'blocked', btrim(p_reason), auth.uid());
  perform public.adm_end_user_sessions(p_id, 'account_blocked');
  perform public.adm_audit('student.block', 'student', p_id, v_before,
                           jsonb_build_object('status', 'blocked'), btrim(p_reason));
end $$;

create or replace function public.unblock_student(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_before jsonb;
begin
  perform public.adm_require_admin();
  if not exists (select 1 from public.profiles where id = p_id and role = 'student') then
    raise exception 'Student not found.' using errcode = 'P0002';
  end if;
  perform public.adm_ensure_student(p_id);
  select jsonb_build_object('status', account_status, 'blocked_reason', blocked_reason)
    into v_before from public.students where id = p_id for update;
  if v_before ->> 'status' <> 'blocked' then
    raise exception 'This student is not blocked.' using errcode = '22023';
  end if;

  update public.students
     set account_status = 'active', blocked_reason = null, blocked_at = null, blocked_by = null
   where id = p_id;
  insert into public.student_block_history (student_id, action, by_admin) values (p_id, 'unblocked', auth.uid());
  perform public.adm_audit('student.unblock', 'student', p_id, v_before, jsonb_build_object('status', 'active'), null);
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_grade_matches(text, text) from public, anon, authenticated;

revoke all on function public.get_student_stats() from public, anon;
revoke all on function public.list_students(text, text, text, text, int, int) from public, anon;
revoke all on function public.get_student_detail(uuid) from public, anon;
revoke all on function public.block_student(uuid, text) from public, anon;
revoke all on function public.unblock_student(uuid) from public, anon;

grant execute on function public.get_student_stats() to authenticated;
grant execute on function public.list_students(text, text, text, text, int, int) to authenticated;
grant execute on function public.get_student_detail(uuid) to authenticated;
grant execute on function public.block_student(uuid, text) to authenticated;
grant execute on function public.unblock_student(uuid) to authenticated;
