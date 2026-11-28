-- Trial for supabase/migrations/20261129090000_admin_qa_nov28_fixes.sql ONLY (needs 20261128090000 applied).
-- Paste all of it into the SQL editor and run: expect "Success. No rows returned".
-- Everything is rolled back (the last line of this file is "rollback;").
begin;

-- =====================================================================
-- 20261129090000_admin_qa_nov28_fixes.sql
--
-- QA 28 Nov bug report. Needs 20261128090000.
--   Bug 3  the admin's educator profile, Students tab: the students of the
--          educator's test series (own series and series assigned to them),
--          with their series, progress and last activity.
--          New: adm_educator_students(uuid) (admin only).
--   Bug 4  an admin deletes a student's account (confirmed in the UI). The
--          admin-delete-student Edge Function calls
--          New: adm_account_delete_by_admin(uuid, uuid, text) (service role only):
--          records the deletion (account_deletion_requests, decided by the
--          admin), blocks the student and ends their sessions, audits
--          account.deleted_by_admin. The function then releases the email and
--          soft-deletes the Auth user, as delete-account does.
--          Replaced (ours, 20261025100700; copies marked "-- 20261129090000"):
--          list_students and get_student_stats leave out deleted accounts
--          (an approved account_deletion_requests row), so a deleted student
--          no longer shows in Students as "Blocked".
--   Onboarding  only the basic details (name, phone, location) are required for now;
--          qualifications, experience, subjects, languages, bio and the ID
--          pictures are optional (checked only when given).
--          Replaced (ours, 20261028090100 / 20261029100000; copies marked
--          "-- 20261129090000"): adm_educator_validate, adm_educator_clean,
--          educator_submit_onboarding.
--
-- No table, lead table, RLS or policy change.
-- Bug 1 (no model answer) and Bug 2 (Submit after the upload) are frontend only.
--
-- ROLLBACK: scripts/rollback_20261129090000_admin_qa_nov28_fixes.sql
-- =====================================================================
set search_path = public, extensions;

do $pre$
declare
  v_problems text[] := '{}';
  v_sig      text;
begin
  foreach v_sig in array array['public.adm_educator_validate(jsonb,integer)', 'public.adm_educator_clean(jsonb,integer)',
                               'public.educator_submit_onboarding()', 'public.adm_is_admin_user(uuid)',
                               'public.adm_end_user_sessions(uuid,text,uuid)', 'public.adm_ensure_student(uuid)',
                               'public.adm_account_deletion_json(uuid)', 'public.adm_house_course_id()',
                               'public.list_students(text,text,text,text,integer,integer)', 'public.get_student_stats()'] loop
    if to_regprocedure(v_sig) is null then v_problems := v_problems || format('missing %s', v_sig); end if;
  end loop;
  if to_regclass('public.answer_sheet_submissions') is null then
    v_problems := v_problems || 'apply 20261128090000 first'::text;
  end if;
  foreach v_sig in array array['adm_educator_students', 'adm_account_delete_by_admin'] loop
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = v_sig) then
      v_problems := v_problems || format('function public.%s already exists', v_sig);
    end if;
  end loop;
  if cardinality(v_problems) > 0 then raise exception 'QA 28 Nov preflight: %', array_to_string(v_problems, '; '); end if;
end $pre$;

-- ============================================================ Bug 3
-- The educator's series: created by them (not deleted) or assigned to them.
-- A student belongs to the list when enrolled in one of them (direct or
-- through the series' course, expired included) or has attempted one of its tests.
--   status: completed (every published test of their series attempted),
--           active (activity or enrolment in the last 14 days),
--           at_risk (15 to 30 days), inactive (longer, or every enrolment expired).
-- -> {summary: {total, active, completed, at_risk, inactive},
--     students: [{id, name, email, initials, series: [{id, title}], enrolled_at,
--                 tests_total, tests_done, progress, last_active_at, status}]}  (500 most recent)
create or replace function public.adm_educator_students(p_educator uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_rows jsonb;
begin
  perform public.adm_require_admin();
  if p_educator is null then raise exception 'Educator is required.' using errcode = '22023'; end if;

  with ser as (
    select sa.series_id from public.test_series_admin sa
     where sa.created_by = p_educator and sa.deleted_at is null
    union
    select a.series_id from public.test_assignments a
     where a.educator_id = p_educator and a.status not in ('cancelled', 'rejected')
  ),
  links as (
    select e.series_id, e.student_id, e.enrolled_at,
           (e.expires_at is null or e.expires_at > now()) as current
      from public.admin_series_enrollments e
     where e.series_id in (select series_id from ser) and e.revoked_at is null
    union all
    select s.id, en.student_id, en.enrolled_at,
           (en.is_active and (en.expiry_date is null or en.expiry_date > now()))
      from public.enrollments en
      join public.test_series s on s.course_id = en.course_id
     where s.id in (select series_id from ser)
       and s.course_id is distinct from public.adm_house_course_id()
    union all
    select q.series_id, at.student_id, min(at.started_at), true
      from public.quiz_attempts at
      join public.quizzes q on q.id = at.quiz_id
     where q.series_id in (select series_id from ser)
     group by q.series_id, at.student_id
  ),
  per as (
    select l.student_id,
           array_agg(distinct l.series_id) as series_ids,
           min(l.enrolled_at) as enrolled_at,
           bool_or(l.current) as current
      from links l
      join public.profiles p on p.id = l.student_id and p.role = 'student'
     where not exists (select 1 from public.account_deletion_requests r   -- deleted accounts left out
                        where r.user_id = l.student_id and r.status = 'approved')
     group by l.student_id
  ),
  stats as (
    select per.*,
           (select count(*) from public.quizzes q
              left join public.quiz_admin qa on qa.quiz_id = q.id
             where q.series_id = any (per.series_ids) and coalesce(qa.status, 'published') = 'published') as tests_total,
           (select count(distinct at.quiz_id) from public.quiz_attempts at
              join public.quizzes q on q.id = at.quiz_id
              left join public.quiz_admin qa on qa.quiz_id = q.id
             where at.student_id = per.student_id and q.series_id = any (per.series_ids)
               and at.status in ('submitted', 'timed_out') and coalesce(qa.status, 'published') = 'published') as tests_done,
           (select max(coalesce(at.submitted_at, at.started_at)) from public.quiz_attempts at
              join public.quizzes q on q.id = at.quiz_id
             where at.student_id = per.student_id and q.series_id = any (per.series_ids)) as last_active_at
      from per
  ),
  res as (
    select st.*, p.full_name, p.email,
           case
             when st.tests_total > 0 and st.tests_done >= st.tests_total then 'completed'
             when not st.current then 'inactive'
             when greatest(st.last_active_at, st.enrolled_at) >= now() - interval '14 days' then 'active'
             when greatest(st.last_active_at, st.enrolled_at) >= now() - interval '30 days' then 'at_risk'
             else 'inactive'
           end as status
      from stats st
      join public.profiles p on p.id = st.student_id
  )
  select jsonb_build_object(
           'summary', jsonb_build_object(
             'total', count(*),
             'active', count(*) filter (where r.status = 'active'),
             'completed', count(*) filter (where r.status = 'completed'),
             'at_risk', count(*) filter (where r.status = 'at_risk'),
             'inactive', count(*) filter (where r.status = 'inactive')),
           'students', coalesce((
             select jsonb_agg(x.j order by x.sort_at desc nulls last, x.name)
               from (select r2.full_name as name, greatest(r2.last_active_at, r2.enrolled_at) as sort_at,
                            jsonb_build_object(
                              'id', r2.student_id, 'name', r2.full_name, 'email', r2.email,
                              'initials', public.adm_initials(r2.full_name),
                              'series', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title) order by s.title), '[]'::jsonb)
                                           from public.test_series s where s.id = any (r2.series_ids)),
                              'enrolled_at', r2.enrolled_at,
                              'tests_total', r2.tests_total, 'tests_done', r2.tests_done,
                              'progress', case when r2.tests_total > 0
                                               then least(100, round(100.0 * r2.tests_done / r2.tests_total))::int else 0 end,
                              'last_active_at', r2.last_active_at,
                              'status', r2.status) as j
                       from res r2
                      order by greatest(r2.last_active_at, r2.enrolled_at) desc nulls last
                      limit 500) x), '[]'::jsonb))
    into v_rows
    from res r;
  return v_rows;
end $$;

-- ============================================================ Bug 4
-- Called by the admin-delete-student Edge Function with the service role
-- (auth.uid() is null there), after it checked the caller is an admin.
-- p_admin is checked again here. Students only, never yourself.
create or replace function public.adm_account_delete_by_admin(p_admin uuid, p_user uuid, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_role text;
  v_id   uuid;
  v_why  text := nullif(left(btrim(coalesce(p_reason, '')), 1000), '');
  v_note constant text := 'Account deleted by an admin.';
  v_prev text;
begin
  if p_admin is null or p_user is null then raise exception 'Admin and user are required.' using errcode = '22023'; end if;
  if not public.adm_is_admin_user(p_admin) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  if p_admin = p_user then raise exception 'You can''t delete your own account here.' using errcode = '42501'; end if;
  select p.role into v_role from public.profiles p where p.id = p_user;
  if v_role is null then raise exception 'Student not found.' using errcode = 'P0002'; end if;
  if v_role <> 'student' or exists (select 1 from public.adm_admin_users a where a.user_id = p_user) then
    raise exception 'Only student accounts can be deleted here.' using errcode = '42501';
  end if;

  -- One record: close a pending request, or add a new one.
  update public.account_deletion_requests
     set status = 'approved', self_service = false, decided_at = now(), decided_by = p_admin,
         decision_note = coalesce(v_why, v_note)
   where user_id = p_user and status = 'pending'
  returning id into v_id;
  if v_id is null then
    insert into public.account_deletion_requests (user_id, role, reason, status, self_service, decided_at, decided_by, decision_note)
    values (p_user, 'student', null, 'approved', false, now(), p_admin, coalesce(v_why, v_note))
    returning id into v_id;
  end if;

  -- Stop all access at once (the Auth soft delete follows in the Edge Function).
  perform public.adm_ensure_student(p_user);
  select account_status into v_prev from public.students where id = p_user for update;
  if v_prev is distinct from 'blocked' then
    update public.students
       set account_status = 'blocked', blocked_reason = v_note, blocked_at = now(), blocked_by = p_admin
     where id = p_user;
    insert into public.student_block_history (student_id, action, reason, by_admin)
    values (p_user, 'blocked', v_note, p_admin);
  end if;
  perform public.adm_end_user_sessions(p_user, 'account_deleted');

  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, before_state, after_state, reason)
  values (p_admin, 'admin', 'account.deleted_by_admin', 'user', p_user,
          jsonb_build_object('account_status', v_prev),
          jsonb_build_object('request_id', v_id, 'role', 'student'), v_why);

  return public.adm_account_deletion_json(v_id)
         || jsonb_build_object('user_id', p_user, 'role', 'student', 'self_service', false);
end $$;

-- list_students: from 20261025100700_admin_rpc_students.sql, with the marked
-- 20261129090000 edit (deleted accounts left out).
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
       and not exists (select 1 from public.account_deletion_requests r   -- 20261129090000
                        where r.user_id = p.id and r.status = 'approved')
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

-- get_student_stats: from 20261025100700_admin_rpc_students.sql, with the
-- marked 20261129090000 edits (deleted accounts left out).
create or replace function public.get_student_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_total bigint; v_blocked bigint;
begin
  perform public.adm_require_admin();
  select count(*) into v_total from public.profiles p
   where p.role = 'student'
     and not exists (select 1 from public.account_deletion_requests r where r.user_id = p.id and r.status = 'approved');   -- 20261129090000
  select count(*) into v_blocked
    from public.students s join public.profiles p on p.id = s.id and p.role = 'student'
   where s.account_status = 'blocked'
     and not exists (select 1 from public.account_deletion_requests r where r.user_id = p.id and r.status = 'approved');   -- 20261129090000
  return jsonb_build_object('total', v_total, 'active', v_total - v_blocked, 'blocked', v_blocked);
end $$;

-- ============================================================ onboarding
-- adm_educator_validate: from 20261028090100_educator_onboarding.sql, with the
-- marked 20261129090000 edits (steps 2 and 3 optional; checked when given).
create or replace function public.adm_educator_validate(p jsonb, p_step int) returns jsonb
language plpgsql immutable set search_path = public, extensions as $$
declare
  e   jsonb := '{}'::jsonb;
  v   text;
  arr jsonb;
  n   int;
  total int;
begin
  p := coalesce(p, '{}'::jsonb);
  if p_step in (0, 1) then
    v := btrim(coalesce(p ->> 'full_name', ''));
    if char_length(v) < 2 or char_length(v) > 120 or v !~ '[[:alpha:]]' then
      e := e || jsonb_build_object('full_name', 'Enter your full name (2 to 120 characters).');
    end if;
    v := btrim(coalesce(p ->> 'phone', ''));
    if v !~ '^\+?[0-9 ()-]{7,20}$' or char_length(regexp_replace(v, '[^0-9]', '', 'g')) not between 7 and 15 then
      e := e || jsonb_build_object('phone', 'Enter a valid phone number (7 to 15 digits).');
    end if;
    v := btrim(coalesce(p ->> 'location', ''));
    if char_length(v) < 2 or char_length(v) > 120 or lower(v) = 'not provided' then
      e := e || jsonb_build_object('location', 'Enter your city or location (2 to 120 characters).');
    end if;
  end if;
  if p_step in (0, 2) then
    v := btrim(coalesce(p ->> 'qualifications', ''));
    if v <> '' and (char_length(v) < 2 or char_length(v) > 500) then   -- 20261129090000: optional
      e := e || jsonb_build_object('qualifications', 'Qualifications must be 2 to 500 characters.');
    end if;
    v := btrim(coalesce(p ->> 'experience_years', ''));
    if v <> '' and (v !~ '^\d{1,2}$' or v::int > 60) then   -- 20261129090000: optional
      e := e || jsonb_build_object('experience_years', 'Years of experience must be a whole number from 0 to 60.');
    end if;
  end if;
  if p_step in (0, 3) then
    -- 20261129090000: subjects and languages optional (an empty or missing list is fine)
    arr := case when jsonb_typeof(p -> 'subjects') = 'array' then p -> 'subjects' end;
    select count(*) filter (where btrim(x) <> '' and char_length(btrim(x)) <= 60), count(*) into n, total
      from jsonb_array_elements_text(coalesce(arr, '[]'::jsonb)) x;
    if (p ? 'subjects' and jsonb_typeof(p -> 'subjects') not in ('array', 'null')) or n > 20 or n <> total then
      e := e || jsonb_build_object('subjects', 'Add up to 20 subjects (each up to 60 characters).');
    end if;
    arr := case when jsonb_typeof(p -> 'languages') = 'array' then p -> 'languages' end;
    select count(*) filter (where btrim(x) <> '' and char_length(btrim(x)) <= 40), count(*) into n, total
      from jsonb_array_elements_text(coalesce(arr, '[]'::jsonb)) x;
    if (p ? 'languages' and jsonb_typeof(p -> 'languages') not in ('array', 'null')) or n > 10 or n <> total then
      e := e || jsonb_build_object('languages', 'Add up to 10 teaching languages (each up to 40 characters).');
    end if;
    v := btrim(coalesce(p ->> 'bio', ''));
    if char_length(v) > 1000 then   -- 20261129090000: optional, no minimum
      e := e || jsonb_build_object('bio', 'Keep the bio to 1000 characters or fewer.');
    end if;
  end if;
  return e;
end $$;

-- adm_educator_clean: from 20261028090100_educator_onboarding.sql, with the
-- marked 20261129090000 edits (empty optional fields are stored as null / []).
create or replace function public.adm_educator_clean(p jsonb, p_step int) returns jsonb
language sql immutable set search_path = public, extensions as $$
  select case p_step
    when 1 then jsonb_build_object('full_name', btrim(p ->> 'full_name'), 'phone', btrim(p ->> 'phone'),
                                   'location', btrim(p ->> 'location'))
    when 2 then jsonb_build_object('qualifications', nullif(btrim(p ->> 'qualifications'), ''),   -- 20261129090000
                                   'experience_years', (nullif(btrim(p ->> 'experience_years'), ''))::int)   -- 20261129090000
    when 3 then jsonb_build_object(
                  'subjects', (select coalesce(jsonb_agg(s order by o), '[]'::jsonb)
                                 from (select btrim(x) as s, min(i) as o
                                         from jsonb_array_elements_text(case when jsonb_typeof(p -> 'subjects') = 'array' then p -> 'subjects' else '[]'::jsonb end)   -- 20261129090000
                                              with ordinality as t(x, i)
                                        group by btrim(x)) d),
                  'languages', (select coalesce(jsonb_agg(s order by o), '[]'::jsonb)
                                  from (select btrim(x) as s, min(i) as o
                                          from jsonb_array_elements_text(case when jsonb_typeof(p -> 'languages') = 'array' then p -> 'languages' else '[]'::jsonb end)   -- 20261129090000
                                               with ordinality as t(x, i)
                                         group by btrim(x)) d),
                  'bio', nullif(btrim(p ->> 'bio'), ''))   -- 20261129090000
    else '{}'::jsonb end;
$$;

-- educator_submit_onboarding: from 20261029100000_educator_state_fix.sql, with
-- the marked 20261129090000 edits (the ID pictures are optional; empty
-- optional fields are saved as null).
create or replace function public.educator_submit_onboarding() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid    uuid := auth.uid();
  v_status jsonb;
  v_form   jsonb;
  v_errors jsonb;
begin
  perform public.adm_require_educator();
  v_status := public.adm_educator_status_json(v_uid);
  if not (v_status ->> 'can_edit')::boolean then
    raise exception 'This application can''t be submitted now (status: %).', v_status ->> 'status' using errcode = '22023';
  end if;
  v_form := public.adm_educator_form(v_uid);
  v_errors := public.adm_educator_validate(v_form, 0);
  -- 20261129090000: the front and back of the ID are no longer required
  if v_errors <> '{}'::jsonb then
    raise exception 'Complete every step before you submit.' using errcode = '22023', detail = v_errors::text;
  end if;

  update public.educator_profiles
     set full_name = v_form ->> 'full_name',
         phone = v_form ->> 'phone',
         location = v_form ->> 'location',
         qualifications = nullif(btrim(coalesce(v_form ->> 'qualifications', '')), ''),   -- 20261129090000
         experience_years = (nullif(btrim(coalesce(v_form ->> 'experience_years', '')), ''))::int,   -- 20261129090000
         subjects = (select array_agg(x) from jsonb_array_elements_text(
                       case when jsonb_typeof(v_form -> 'subjects') = 'array' then v_form -> 'subjects' else '[]'::jsonb end) x),   -- 20261129090000
         languages = (select array_agg(x) from jsonb_array_elements_text(
                       case when jsonb_typeof(v_form -> 'languages') = 'array' then v_form -> 'languages' else '[]'::jsonb end) x),   -- 20261129090000
         bio = nullif(btrim(coalesce(v_form ->> 'bio', '')), '')   -- 20261129090000
   where user_id = v_uid;
  update public.profiles
     set full_name = v_form ->> 'full_name', phone = v_form ->> 'phone', location = v_form ->> 'location'
   where id = v_uid;
  -- 20261029100000: the one state writer (review_state submitted, submitted_at, lead 'pending')
  perform public.adm_set_educator_state(v_uid, 'pending', null, v_uid);
  update public.educator_onboarding set step = 5 where user_id = v_uid;

  perform public.adm_audit('educator.onboarding_submit', 'educator', v_uid,
                           jsonb_build_object('value', v_status ->> 'status'), jsonb_build_object('value', 'pending'), null);
  return public.adm_educator_status_json(v_uid);
end $$;

-- ============================================================ grants
revoke all on function public.adm_educator_students(uuid) from public, anon;
grant execute on function public.adm_educator_students(uuid) to authenticated;
revoke all on function public.adm_account_delete_by_admin(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.adm_account_delete_by_admin(uuid, uuid, text) to service_role;
revoke all on function public.list_students(text, text, text, text, int, int) from public, anon;
grant execute on function public.list_students(text, text, text, text, int, int) to authenticated;
revoke all on function public.get_student_stats() from public, anon;
grant execute on function public.get_student_stats() to authenticated;
revoke all on function public.adm_educator_validate(jsonb, int) from public, anon, authenticated;
revoke all on function public.adm_educator_clean(jsonb, int) from public, anon, authenticated;
revoke all on function public.educator_submit_onboarding() from public, anon;
grant execute on function public.educator_submit_onboarding() to authenticated;

rollback;
