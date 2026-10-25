-- =====================================================================
-- 20261026100200_student_rpc_series.sql
--
-- Purpose
--   Student-side access to test series: internal helpers, the two anon
--   catalogue RPCs, and the student series RPCs.
--
--   Internal helpers (revoked from every browser role):
--     adm_student_uid()            caller of every student_* RPC (42501 if signed out)
--     adm_student_writer_uid()     + a profiles row and an unblocked account
--     adm_student_series(uuid)     a student's ACTIVE series access, one row per series:
--                                  direct (admin_series_enrollments, not revoked, not
--                                  expired) or through a lead course enrolment
--                                  (enrollments.is_active, not expired; never the
--                                  hidden house course)
--     adm_student_is_enrolled(uuid, uuid)
--     adm_live_series()            series a student may discover: published, active,
--                                  admin status published (or no admin row), not
--                                  deleted, availability not ended
--     adm_series_card(uuid, uuid)  the shared series JSON (see docs/STUDENT_RPC_CONTRACT.md)
--
--   Browser RPCs:
--     public_list_series(int), public_get_series(uuid)   anon + authenticated
--     student_list_series(text, uuid, int, int), student_get_series(uuid),
--     student_enroll(uuid), student_my_series()          authenticated
--
--   Admin-created series live on the hidden draft house course (B2-A1). They are
--   NOT visible in the lead's catalogue; these RPCs are the student path to them.
--
-- Security
--   SECURITY DEFINER, search_path = public, extensions. The student is always
--   auth.uid(), never a parameter. Tests and series are returned without
--   questions or answers.
--
-- Lead objects read
--   test_series, quizzes, quiz_questions, courses, categories, enrollments, profiles.
-- Lead objects written
--   None (enrolments go to our admin_series_enrollments).
--
-- ROLLBACK
--   drop function if exists public.student_my_series();
--   drop function if exists public.student_enroll(uuid);
--   drop function if exists public.student_get_series(uuid);
--   drop function if exists public.student_list_series(text, uuid, int, int);
--   drop function if exists public.public_get_series(uuid);
--   drop function if exists public.public_list_series(int);
--   drop function if exists public.adm_series_card(uuid, uuid);
--   drop function if exists public.adm_live_series();
--   drop function if exists public.adm_student_is_enrolled(uuid, uuid);
--   drop function if exists public.adm_student_series(uuid);
--   drop function if exists public.adm_student_writer_uid();
--   drop function if exists public.adm_student_uid();
-- =====================================================================
set search_path = public, extensions;

-- ================================================================ helpers
create or replace function public.adm_student_uid() returns uuid
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in to continue.' using errcode = '42501';
  end if;
  return v_uid;
end $$;

-- Writers need a profile (quiz_attempts.student_id references profiles) and
-- an account that is not blocked by an admin.
create or replace function public.adm_student_writer_uid() returns uuid
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := public.adm_student_uid();
begin
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Your profile is not set up yet. Sign out and sign in again.' using errcode = 'P0001';
  end if;
  if public.adm_is_account_blocked(v_uid) then
    raise exception 'Your account is blocked. Contact support.' using errcode = '42501';
  end if;
  return v_uid;
end $$;

create or replace function public.adm_student_series(p_student uuid)
returns table (series_id uuid, enrolled_at timestamptz, expires_at timestamptz, source text)
language sql stable security definer set search_path = public, extensions as $$
  select distinct on (x.sid) x.sid, x.enrolled_at, x.expires_at, x.source
    from (
      select e.series_id as sid, e.enrolled_at, e.expires_at, 'direct'::text as source
        from public.admin_series_enrollments e
       where e.student_id = p_student
         and e.revoked_at is null
         and (e.expires_at is null or e.expires_at > now())
      union all
      select s.id, en.enrolled_at, en.expiry_date, 'course'::text
        from public.enrollments en
        join public.test_series s on s.course_id = en.course_id
       where en.student_id = p_student
         and en.is_active
         and (en.expiry_date is null or en.expiry_date > now())
         and s.course_id is distinct from public.adm_house_course_id()
    ) x
   order by x.sid, x.enrolled_at;
$$;

create or replace function public.adm_student_is_enrolled(p_series_id uuid, p_student_id uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.adm_student_series(p_student_id) a where a.series_id = p_series_id);
$$;

create or replace function public.adm_live_series() returns setof uuid
language sql stable security definer set search_path = public, extensions as $$
  select s.id
    from public.test_series s
    left join public.test_series_admin sa on sa.series_id = s.id
   where s.is_published
     and s.is_active
     and coalesce(sa.status, 'published') = 'published'
     and sa.deleted_at is null
     and (s.available_until is null or s.available_until > now());
$$;

-- Shared series JSON. p_student null = public view (no enrolment keys).
-- Counts cover published tests only (quiz_admin.status, or no admin row).
create or replace function public.adm_series_card(p_series_id uuid, p_student uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
           'id', s.id,
           'title', s.title,
           'description', s.description,
           'subject', coalesce(cat.name, sa.subject_label),
           'category_id', cat.id,
           'level', sa.level,
           'exam', sa.exam,
           'pricing', coalesce(sa.pricing, 'free'),
           'price_inr', coalesce(sa.price_inr, 0),
           'is_free', coalesce(sa.pricing, 'free') = 'free' or coalesce(sa.price_inr, 0) = 0,
           'cover_path', sa.cover_path,
           'available_from', s.available_from,
           'available_until', s.available_until,
           'access_days', sa.access_days,
           'tests_count', coalesce(t.cnt, 0),
           'questions_count', coalesce(t.questions, 0),
           'total_duration_mins', coalesce(t.mins, 0))
         || case when p_student is null then '{}'::jsonb else jsonb_build_object(
           'is_enrolled', public.adm_student_is_enrolled(s.id, p_student),
           'attempts_count', (select count(*) from public.quiz_attempts a
                                join public.quizzes q on q.id = a.quiz_id
                               where q.series_id = s.id and a.student_id = p_student)) end
    from public.test_series s
    left join public.test_series_admin sa on sa.series_id = s.id
    left join public.courses c on c.id = s.course_id
    left join public.categories cat on cat.id = coalesce(sa.subject_category_id, c.category_id)
    left join lateral (
      select count(*) as cnt, sum(q.time_limit_mins) as mins, sum(qc.n) as questions
        from public.quizzes q
        left join public.quiz_admin qa on qa.quiz_id = q.id
        left join lateral (select count(*) as n from public.quiz_questions qq where qq.quiz_id = q.id) qc on true
       where q.series_id = s.id and coalesce(qa.status, 'published') = 'published'
    ) t on true
   where s.id = p_series_id;
$$;

-- ============================================================ anon catalogue
create or replace function public.public_list_series(p_limit int default 10) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(public.adm_series_card(s.id, null) order by s.created_at desc, s.id), '[]'::jsonb)
    from (select s.id, s.created_at
            from public.test_series s
           where s.id in (select public.adm_live_series())
           order by s.created_at desc, s.id
           limit least(greatest(coalesce(p_limit, 10), 1), 50)) s;
$$;

create or replace function public.public_get_series(p_series_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_card jsonb;
begin
  if p_series_id is null or p_series_id not in (select public.adm_live_series()) then
    raise exception 'Test series not found.' using errcode = 'P0002';
  end if;
  v_card := public.adm_series_card(p_series_id, null);
  return v_card || jsonb_build_object(
    'instructions', (select instructions from public.test_series where id = p_series_id),
    'tests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', q.id, 'title', q.title, 'description', q.description,
               'position', q.series_sort_order, 'time_limit_mins', q.time_limit_mins,
               'questions_count', (select count(*) from public.quiz_questions qq where qq.quiz_id = q.id),
               'total_marks', (select coalesce(sum(qq.points), 0) from public.quiz_questions qq where qq.quiz_id = q.id),
               'max_attempts', q.max_attempts, 'passing_percentage', q.passing_score)
             order by q.series_sort_order, q.created_at, q.id)
        from public.quizzes q
        left join public.quiz_admin qa on qa.quiz_id = q.id
       where q.series_id = p_series_id and coalesce(qa.status, 'published') = 'published'), '[]'::jsonb));
end $$;

-- ============================================================ student series
create or replace function public.student_list_series(
  p_search   text default null,
  p_category uuid default null,
  p_page     int  default 1,
  p_size     int  default 12
) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_uid    uuid := public.adm_student_uid();
  v_like   text := public.adm_like(p_search);
  v_page   int  := greatest(coalesce(p_page, 1), 1);
  v_size   int  := least(greatest(coalesce(p_size, 12), 1), 50);
  v_total  int := 0;
  v_items  jsonb;
begin
  with matches as (
    select s.id, s.created_at
      from public.test_series s
      left join public.test_series_admin sa on sa.series_id = s.id
      left join public.courses c on c.id = s.course_id
      left join public.categories cat on cat.id = coalesce(sa.subject_category_id, c.category_id)
     where s.id in (select l.id from public.adm_live_series() l(id))
       and (p_category is null or cat.id = p_category)
       and (v_like is null or s.title ilike v_like or s.description ilike v_like
            or sa.subject_label ilike v_like or sa.exam ilike v_like or cat.name ilike v_like)
  ), page as (
    select m.id, m.created_at, count(*) over () as total
      from matches m
     order by m.created_at desc, m.id
     limit v_size offset (v_page - 1) * v_size
  )
  select coalesce(jsonb_agg(public.adm_series_card(p.id, v_uid) order by p.created_at desc, p.id), '[]'::jsonb),
         coalesce(max(p.total), 0)
    into v_items, v_total
    from page p;

  -- A page past the end has no rows to carry the window count.
  if v_total = 0 then
    select count(*) into v_total
      from public.test_series s
      left join public.test_series_admin sa on sa.series_id = s.id
      left join public.courses c on c.id = s.course_id
      left join public.categories cat on cat.id = coalesce(sa.subject_category_id, c.category_id)
     where s.id in (select l.id from public.adm_live_series() l(id))
       and (p_category is null or cat.id = p_category)
       and (v_like is null or s.title ilike v_like or s.description ilike v_like
            or sa.subject_label ilike v_like or sa.exam ilike v_like or cat.name ilike v_like);
  end if;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', v_page,
    'size', v_size,
    'total_pages', greatest(ceil(v_total::numeric / v_size)::int, 1),
    'categories', coalesce((
      select jsonb_agg(distinct jsonb_build_object('id', cat.id, 'name', cat.name))
        from public.test_series s
        left join public.test_series_admin sa on sa.series_id = s.id
        left join public.courses c on c.id = s.course_id
        join public.categories cat on cat.id = coalesce(sa.subject_category_id, c.category_id)
       where s.id in (select public.adm_live_series())), '[]'::jsonb));
end $$;

-- Visible when the series is live, or when the caller is enrolled (so an
-- enrolled student keeps read access after the series ends).
create or replace function public.student_get_series(p_series_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_uid    uuid := public.adm_student_uid();
  v_access record;
begin
  select a.* into v_access from public.adm_student_series(v_uid) a where a.series_id = p_series_id;
  if p_series_id is null
     or not (p_series_id in (select public.adm_live_series())
             or (v_access.series_id is not null and exists (
                   select 1 from public.test_series s
                     left join public.test_series_admin sa on sa.series_id = s.id
                    where s.id = p_series_id and s.is_active and sa.deleted_at is null))) then
    raise exception 'Test series not found.' using errcode = 'P0002';
  end if;

  return public.adm_series_card(p_series_id, v_uid) || jsonb_build_object(
    'instructions', (select instructions from public.test_series where id = p_series_id),
    'enrollment', case when v_access.series_id is null then null else jsonb_build_object(
                    'enrolled_at', v_access.enrolled_at, 'expires_at', v_access.expires_at,
                    'source', v_access.source) end,
    'tests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', q.id, 'title', q.title, 'description', q.description,
               'position', q.series_sort_order, 'time_limit_mins', q.time_limit_mins,
               'is_proctored', q.is_proctored,
               'questions_count', st.questions, 'total_marks', st.marks,
               'passing_percentage', q.passing_score,
               'opens_at', w.opens_at, 'closes_at', w.closes_at,
               'attempts_used', coalesce(att.used, 0),
               'attempts_allowed', q.max_attempts,
               'attempts_remaining', greatest(q.max_attempts - coalesce(att.used, 0), 0),
               'best_score', att.best_score,
               'best_percentage', att.best_pct,
               'passed', coalesce(att.passed, false),
               'latest_attempt_id', att.latest_id,
               'latest_status', att.latest_status,
               'in_progress_attempt_id', att.in_progress_id)
             order by q.series_sort_order, q.created_at, q.id)
        from public.quizzes q
        left join public.quiz_admin qa on qa.quiz_id = q.id
        cross join lateral public.adm_test_window(q.id) w
        cross join lateral (select count(*) as questions, coalesce(sum(qq.points), 0) as marks
                              from public.quiz_questions qq where qq.quiz_id = q.id) st
        left join lateral (
          select count(*) as used,
                 max(a.score) filter (where a.status in ('submitted', 'timed_out')) as best_score,
                 max(a.percentage) filter (where a.status in ('submitted', 'timed_out')) as best_pct,
                 bool_or(a.passed) as passed,
                 (array_agg(a.id order by a.started_at desc))[1] as latest_id,
                 (array_agg(a.status order by a.started_at desc))[1] as latest_status,
                 (array_agg(a.id order by a.started_at desc) filter (where a.status = 'in_progress'))[1] as in_progress_id
            from public.quiz_attempts a
           where a.quiz_id = q.id and a.student_id = v_uid
        ) att on true
       where q.series_id = p_series_id and coalesce(qa.status, 'published') = 'published'), '[]'::jsonb));
end $$;

-- Idempotent. Free series: direct enrolment (expires after access_days when
-- set). Paid series: STUB: needs payments model (F4) -> 0A000.
create or replace function public.student_enroll(p_series_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid     uuid := public.adm_student_writer_uid();
  v_pricing text;
  v_price   numeric;
  v_days    int;
  v_access  record;
begin
  if p_series_id is null or p_series_id not in (select public.adm_live_series()) then
    raise exception 'Test series not found.' using errcode = 'P0002';
  end if;

  select a.* into v_access from public.adm_student_series(v_uid) a where a.series_id = p_series_id;
  if v_access.series_id is not null then
    return jsonb_build_object('series_id', p_series_id, 'enrolled', true, 'already_enrolled', true,
                              'enrolled_at', v_access.enrolled_at, 'expires_at', v_access.expires_at);
  end if;

  if exists (select 1 from public.admin_series_enrollments
              where series_id = p_series_id and student_id = v_uid and revoked_at is not null) then
    raise exception 'Your access to this series was revoked. Contact support.' using errcode = '42501';
  end if;

  select coalesce(sa.pricing, 'free'), coalesce(sa.price_inr, 0), sa.access_days
    into v_pricing, v_price, v_days
    from public.test_series s left join public.test_series_admin sa on sa.series_id = s.id
   where s.id = p_series_id;

  if v_pricing = 'paid' and v_price > 0 then
    -- STUB: needs payments model (F4)
    raise exception 'Paid test series cannot be bought yet.' using errcode = '0A000';
  end if;

  -- An expired direct enrolment is renewed; a revoked one was refused above.
  insert into public.admin_series_enrollments (series_id, student_id, enrolled_at, expires_at, amount_paid)
  values (p_series_id, v_uid, now(), case when v_days is not null then now() + make_interval(days => v_days) end, 0)
  on conflict (series_id, student_id) do update
     set enrolled_at = excluded.enrolled_at, expires_at = excluded.expires_at
   where admin_series_enrollments.revoked_at is null;

  return jsonb_build_object('series_id', p_series_id, 'enrolled', true, 'already_enrolled', false,
                            'enrolled_at', now(),
                            'expires_at', case when v_days is not null then now() + make_interval(days => v_days) end);
end $$;

-- Enrolled series (active access only) with progress over published tests.
create or replace function public.student_my_series() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := public.adm_student_uid();
begin
  return (
  select coalesce(jsonb_agg(
           public.adm_series_card(a.series_id, v_uid) || jsonb_build_object(
             'enrolled_at', a.enrolled_at,
             'expires_at', a.expires_at,
             'source', a.source,
             'tests_attempted', coalesce(p.tests_attempted, 0),
             'progress_percentage', case when coalesce(t.cnt, 0) = 0 then 0
                                         else round(coalesce(p.tests_attempted, 0) * 100.0 / t.cnt, 1) end,
             'best_score', p.best_score,
             'best_percentage', p.best_pct,
             'latest_score', p.latest_score,
             'latest_percentage', p.latest_pct,
             'latest_attempt_at', p.latest_at)
           order by a.enrolled_at desc, a.series_id), '[]'::jsonb)
    from public.adm_student_series(v_uid) a
    join public.test_series s on s.id = a.series_id and s.is_active
    left join public.test_series_admin sa on sa.series_id = s.id
    left join lateral (
      select count(*) as cnt from public.quizzes q
        left join public.quiz_admin qa on qa.quiz_id = q.id
       where q.series_id = s.id and coalesce(qa.status, 'published') = 'published'
    ) t on true
    left join lateral (
      select count(distinct att.quiz_id) as tests_attempted,
             max(att.score) as best_score,
             max(att.percentage) as best_pct,
             (array_agg(att.score order by att.submitted_at desc nulls last))[1] as latest_score,
             (array_agg(att.percentage order by att.submitted_at desc nulls last))[1] as latest_pct,
             max(att.submitted_at) as latest_at
        from public.quiz_attempts att
        join public.quizzes q on q.id = att.quiz_id
       where q.series_id = s.id
         and att.student_id = v_uid
         and att.status in ('submitted', 'timed_out')
    ) p on true
   where sa.deleted_at is null);
end $$;

-- ================================================================== grants
revoke all on function public.adm_student_uid() from public, anon, authenticated;
revoke all on function public.adm_student_writer_uid() from public, anon, authenticated;
revoke all on function public.adm_student_series(uuid) from public, anon, authenticated;
revoke all on function public.adm_student_is_enrolled(uuid, uuid) from public, anon, authenticated;
revoke all on function public.adm_live_series() from public, anon, authenticated;
revoke all on function public.adm_series_card(uuid, uuid) from public, anon, authenticated;

revoke all on function public.public_list_series(int) from public;
grant execute on function public.public_list_series(int) to anon, authenticated;
revoke all on function public.public_get_series(uuid) from public;
grant execute on function public.public_get_series(uuid) to anon, authenticated;

revoke all on function public.student_list_series(text, uuid, int, int) from public, anon;
grant execute on function public.student_list_series(text, uuid, int, int) to authenticated;
revoke all on function public.student_get_series(uuid) from public, anon;
grant execute on function public.student_get_series(uuid) to authenticated;
revoke all on function public.student_enroll(uuid) from public, anon;
grant execute on function public.student_enroll(uuid) to authenticated;
revoke all on function public.student_my_series() from public, anon;
grant execute on function public.student_my_series() to authenticated;
