-- =====================================================================
-- 20261026100400_student_rpc_dashboard.sql
--
-- Purpose
--   Student history, account stats and the dashboard feed:
--     student_my_history(int, int), student_get_stats(), student_dashboard()
--
-- Definitions
--   * finished attempt: status submitted or timed_out.
--   * tests_taken / tests_passed: distinct tests with a finished / passed attempt.
--   * accuracy: correct answers / graded answers (pending review and
--     unanswered questions are not graded answers).
--   * streak: consecutive calendar days (Asia/Kolkata) with a finished attempt,
--     counted back from today, or from yesterday when today has none yet.
--   * an in_progress attempt past its deadline is reported with is_expired =
--     true; the first student_get_report / student_start_attempt call grades it.
--
-- Security
--   SECURITY DEFINER, search_path = public, extensions; the student is auth.uid().
--
-- ROLLBACK
--   drop function if exists public.student_dashboard();
--   drop function if exists public.student_get_stats();
--   drop function if exists public.student_my_history(int, int);
-- =====================================================================
set search_path = public, extensions;

create or replace function public.student_my_history(p_page int default 1, p_size int default 20) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_uid   uuid := public.adm_student_uid();
  v_page  int  := greatest(coalesce(p_page, 1), 1);
  v_size  int  := least(greatest(coalesce(p_size, 20), 1), 100);
  v_total int;
begin
  select count(*) into v_total from public.quiz_attempts where student_id = v_uid;

  return jsonb_build_object(
    'total', v_total,
    'page', v_page,
    'size', v_size,
    'total_pages', greatest(ceil(v_total::numeric / v_size)::int, 1),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'attempt_id', x.id,
               'test_id', x.quiz_id,
               'test_title', x.test_title,
               'series_id', x.series_id,
               'series_title', x.series_title,
               'attempt_number', x.attempt_number,
               'status', x.status,
               'is_expired', x.status = 'in_progress' and x.deadline is not null and x.deadline < now(),
               'deadline', x.deadline,
               'score', x.score,
               'max_score', x.max_score,
               'percentage', x.percentage,
               'passed', x.passed,
               'started_at', x.started_at,
               'submitted_at', x.submitted_at,
               'time_taken_secs', x.time_taken_secs,
               'time_limit_mins', x.time_limit_mins,
               'has_report', x.has_report)
             order by coalesce(x.submitted_at, x.started_at) desc, x.id)
        from (select a.*, q.title as test_title, q.series_id, s.title as series_title, q.time_limit_mins,
                     public.adm_attempt_deadline(a.started_at, q.time_limit_mins) as deadline,
                     exists (select 1 from public.attempt_reports r where r.attempt_id = a.id) as has_report
                from public.quiz_attempts a
                join public.quizzes q on q.id = a.quiz_id
                left join public.test_series s on s.id = q.series_id
               where a.student_id = v_uid
               order by coalesce(a.submitted_at, a.started_at) desc, a.id
               limit v_size offset (v_page - 1) * v_size) x), '[]'::jsonb));
end $$;

create or replace function public.student_get_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_uid    uuid := public.adm_student_uid();
  v_today  date := (now() at time zone 'Asia/Kolkata')::date;
  v_att    record;
  v_acc    numeric;
  v_anchor date;
  v_streak int := 0;
begin
  select count(*) as attempts,
         count(distinct quiz_id) as tests,
         count(distinct quiz_id) filter (where passed) as passed,
         round(avg(percentage), 1) as avg_pct,
         max(percentage) as best_pct,
         coalesce(sum(time_taken_secs), 0) as secs
    into v_att
    from public.quiz_attempts
   where student_id = v_uid and status in ('submitted', 'timed_out');

  select round(count(*) filter (where ans.is_correct) * 100.0 / nullif(count(*), 0), 1)
    into v_acc
    from public.quiz_answers ans
    join public.quiz_attempts a on a.id = ans.attempt_id
   where a.student_id = v_uid and a.status in ('submitted', 'timed_out')
     and ans.is_correct is not null
     and (nullif(btrim(coalesce(ans.answer_text, '')), '') is not null
          or coalesce(cardinality(ans.selected_option_ids), 0) > 0);

  -- Streak: count days back from the anchor while they are consecutive.
  with days as (
    select distinct (submitted_at at time zone 'Asia/Kolkata')::date as d
      from public.quiz_attempts
     where student_id = v_uid and status in ('submitted', 'timed_out') and submitted_at is not null
  )
  select case when exists (select 1 from days where d = v_today) then v_today
              when exists (select 1 from days where d = v_today - 1) then v_today - 1 end
    into v_anchor;
  if v_anchor is not null then
    with days as (
      select distinct (submitted_at at time zone 'Asia/Kolkata')::date as d
        from public.quiz_attempts
       where student_id = v_uid and status in ('submitted', 'timed_out') and submitted_at is not null
    )
    select count(*) into v_streak
      from (select d, row_number() over (order by d desc) as rn from days where d <= v_anchor) x
     where x.d = v_anchor - (x.rn - 1)::int;
  end if;

  return jsonb_build_object(
    'tests_taken', v_att.tests,
    'attempts_taken', v_att.attempts,
    'tests_passed', v_att.passed,
    'series_enrolled', (select count(*) from public.adm_student_series(v_uid)),
    'average_percentage', coalesce(v_att.avg_pct, 0),
    'best_percentage', coalesce(v_att.best_pct, 0),
    'total_time_secs', v_att.secs,
    'current_streak', v_streak,
    'accuracy_percentage', coalesce(v_acc, 0));
end $$;

create or replace function public.student_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_uid   uuid := public.adm_student_uid();
  v_stats jsonb := public.student_get_stats();
begin
  return jsonb_build_object(
    -- Unexpired in_progress attempts.
    'continue_learning', coalesce((
      select jsonb_agg(jsonb_build_object(
               'attempt_id', x.id, 'test_id', x.quiz_id, 'test_title', x.title,
               'series_id', x.series_id, 'series_title', x.series_title,
               'attempt_number', x.attempt_number, 'started_at', x.started_at, 'deadline', x.deadline,
               'answered', x.answered, 'questions_count', x.questions)
             order by x.started_at desc)
        from (select a.id, a.quiz_id, a.attempt_number, a.started_at, q.title, q.series_id, s.title as series_title,
                     public.adm_attempt_deadline(a.started_at, q.time_limit_mins) as deadline,
                     (select count(*) from public.quiz_answers ans where ans.attempt_id = a.id) as answered,
                     (select count(*) from public.quiz_questions qq where qq.quiz_id = a.quiz_id) as questions
                from public.quiz_attempts a
                join public.quizzes q on q.id = a.quiz_id
                left join public.test_series s on s.id = q.series_id
               where a.student_id = v_uid and a.status = 'in_progress'
                 and coalesce(public.adm_attempt_deadline(a.started_at, q.time_limit_mins), 'infinity') > now()
               order by a.started_at desc limit 5) x), '[]'::jsonb),
    -- Up to 6 enrolled series with progress (same shape as student_my_series items).
    'enrolled_series', coalesce((
      select jsonb_agg(e order by (e ->> 'enrolled_at') desc)
        from (select e from jsonb_array_elements(public.student_my_series()) e
               order by (e ->> 'enrolled_at') desc limit 6) y), '[]'::jsonb),
    -- Last 5 finished attempts.
    'recent_history', coalesce((
      select jsonb_agg(jsonb_build_object(
               'attempt_id', x.id, 'test_id', x.quiz_id, 'test_title', x.title,
               'series_id', x.series_id, 'series_title', x.series_title,
               'attempt_number', x.attempt_number, 'status', x.status, 'score', x.score, 'max_score', x.max_score,
               'percentage', x.percentage, 'passed', x.passed, 'submitted_at', x.submitted_at,
               'time_taken_secs', x.time_taken_secs, 'has_report', x.has_report)
             order by x.submitted_at desc nulls last)
        from (select a.*, q.title, q.series_id, s.title as series_title,
                     exists (select 1 from public.attempt_reports r where r.attempt_id = a.id) as has_report
                from public.quiz_attempts a
                join public.quizzes q on q.id = a.quiz_id
                left join public.test_series s on s.id = q.series_id
               where a.student_id = v_uid and a.status in ('submitted', 'timed_out')
               order by a.submitted_at desc nulls last limit 5) x), '[]'::jsonb),
    'stats', jsonb_build_object(
      'tests_taken', v_stats -> 'tests_taken',
      'tests_passed', v_stats -> 'tests_passed',
      'average_percentage', v_stats -> 'average_percentage',
      'current_streak', v_stats -> 'current_streak',
      'series_enrolled', v_stats -> 'series_enrolled'),
    -- Live series the caller is not enrolled in; same subject first.
    'recommended_series', coalesce((
      select jsonb_agg(public.adm_series_card(r.id, v_uid) order by r.same_subject desc, r.created_at desc)
        from (select s.id, s.created_at,
                     coalesce(coalesce(sa.subject_category_id, c.category_id) in (
                       select coalesce(sa2.subject_category_id, c2.category_id)
                         from public.adm_student_series(v_uid) m
                         join public.test_series s2 on s2.id = m.series_id
                         left join public.test_series_admin sa2 on sa2.series_id = s2.id
                         left join public.courses c2 on c2.id = s2.course_id), false) as same_subject
                from public.test_series s
                left join public.test_series_admin sa on sa.series_id = s.id
                left join public.courses c on c.id = s.course_id
               where s.id in (select l.id from public.adm_live_series() l(id))
                 and not public.adm_student_is_enrolled(s.id, v_uid)
               order by 3 desc, s.created_at desc
               limit 6) r), '[]'::jsonb));
end $$;

revoke all on function public.student_my_history(int, int) from public, anon;
grant execute on function public.student_my_history(int, int) to authenticated;
revoke all on function public.student_get_stats() from public, anon;
grant execute on function public.student_get_stats() to authenticated;
revoke all on function public.student_dashboard() from public, anon;
grant execute on function public.student_dashboard() to authenticated;
