-- =====================================================================
-- 20261025110900_admin_rpc_performance.sql
--
-- Purpose
--   Test Performance Analytics (performanceApi.js) over the lead's quiz data:
--     get_tpa_filter_options(p_series)
--     get_tpa_summary(...)          -> object {total_attempts, avg_score, published_tests, avg_time_minutes}
--     get_tpa_subject_scores(...)   -> table(subject, avg_score, attempts)
--     get_tpa_series_engagement(...)-> table(series_id, series_title, educators, subject, attempts, avg_performance)
--     get_tpa_test_comparison(...)  -> table(test_id, test_title, series_title, educators, attempts, avg_score, avg_time_minutes)
--     get_tpa_leaderboard(p_series, p_from, p_to, p_limit)
--     export_tpa_rows(...)          -> table(series, subject, educators, test, attempts, avg_score_pct, avg_time_min)
--     log_export(p_page, p_filters, p_rows)  -> audit_logs (action 'export')
--   Shared filter params: p_series uuid, p_subject text, p_test uuid,
--   p_educator text (an educator id OR name: the page sends names), p_from, p_to.
--
-- Lead objects read
--   quizzes, quiz_attempts, test_series, profiles, courses (through adm_* helpers).
--
-- Assumptions
--   * An attempt counts when quiz_attempts.status is 'submitted' or 'timed_out'
--     and percentage is not null (F5 statuses; archived counted 'submitted').
--   * Minutes = time_taken_secs / 60, else submitted_at - started_at.
--   * "Published test" = quiz of a published series whose admin status is
--     published (or that has no admin row).
--   * get_tpa_summary returns an object (archived returned a table the page
--     could not read). p_educator changed from uuid to text; callers still send
--     a string, so no client change is needed.
--
-- ROLLBACK
--   drop function if exists public.log_export(text, jsonb, int),
--     public.export_tpa_rows(uuid, text, uuid, text, date, date),
--     public.get_tpa_leaderboard(uuid, date, date, int),
--     public.get_tpa_test_comparison(uuid, text, uuid, text, date, date),
--     public.get_tpa_series_engagement(uuid, text, uuid, text, date, date),
--     public.get_tpa_subject_scores(uuid, text, uuid, text, date, date),
--     public.get_tpa_summary(uuid, text, uuid, text, date, date),
--     public.get_tpa_filter_options(uuid),
--     public.adm_tpa_attempts(uuid, text, uuid, text, date, date),
--     public.adm_tpa_tests(uuid, text, uuid, text);
-- =====================================================================
set search_path = public, extensions;

create or replace function public.adm_tpa_tests(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator text default null
) returns table (test_id uuid, test_title text, test_position int, series_id uuid, series_title text, subject text,
                 educator_ids uuid[], educator_names text)
language sql stable security definer set search_path = public, extensions as $$
  with e as (
    select se.series_id, array_agg(distinct se.educator_id) as ids,
           string_agg(distinct se.educator_name, ', ') as names
      from public.adm_series_educators() se group by se.series_id
  )
  select q.id, q.title, q.series_sort_order, r.id, r.title, r.subject_name,
         coalesce(e.ids, '{}'::uuid[]), coalesce(e.names, 'Unassigned')
    from public.quizzes q
    join public.adm_series_rows() r on r.id = q.series_id
    left join public.quiz_admin qa on qa.quiz_id = q.id
    left join e on e.series_id = r.id
   where r.status = 'published' and coalesce(qa.status, 'published') = 'published'
     and (p_series is null or r.id = p_series)
     and (p_subject is null or p_subject in ('', 'all') or r.subject_name = p_subject)
     and (p_test is null or q.id = p_test)
     and (p_educator is null or p_educator in ('', 'all')
          or exists (select 1 from public.adm_series_educators() se
                      where se.series_id = r.id and (se.educator_id::text = p_educator or se.educator_name = p_educator)));
$$;

create or replace function public.adm_tpa_attempts(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator text default null,
  p_from date default null, p_to date default null
) returns table (attempt_id uuid, series_id uuid, test_id uuid, student_id uuid, percentage numeric,
                 minutes numeric, submitted_at timestamptz, subject text)
language sql stable security definer set search_path = public, extensions as $$
  select a.id, t.series_id, t.test_id, a.student_id, a.percentage,
         coalesce(a.time_taken_secs / 60.0, (extract(epoch from (a.submitted_at - a.started_at)) / 60.0)::numeric),
         a.submitted_at, t.subject
    from public.quiz_attempts a
    join public.adm_tpa_tests(p_series, p_subject, p_test, p_educator) t on t.test_id = a.quiz_id
   where a.status in ('submitted', 'timed_out') and a.percentage is not null
     and (p_from is null or (a.submitted_at at time zone 'Asia/Kolkata')::date >= p_from)
     and (p_to   is null or (a.submitted_at at time zone 'Asia/Kolkata')::date <= p_to);
$$;

-- {series:[{id,title}], subjects:[], tests:[{id,title,series_id}], educators:[{id,name}]}
create or replace function public.get_tpa_filter_options(p_series uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    with t as (select * from public.adm_tpa_tests())
    select jsonb_build_object(
      'series',    (select coalesce(jsonb_agg(jsonb_build_object('id', x.series_id, 'title', x.series_title) order by x.series_title), '[]'::jsonb)
                      from (select distinct t.series_id, t.series_title from t) x),
      'subjects',  (select coalesce(jsonb_agg(x.subject order by x.subject), '[]'::jsonb)
                      from (select distinct t.subject from t where t.subject is not null) x),
      'tests',     (select coalesce(jsonb_agg(jsonb_build_object('id', t.test_id, 'title', t.test_title, 'series_id', t.series_id)
                                              order by t.series_title, t.test_position), '[]'::jsonb)
                      from t where p_series is null or t.series_id = p_series),
      'educators', (select coalesce(jsonb_agg(jsonb_build_object('id', x.educator_id, 'name', x.educator_name) order by x.educator_name), '[]'::jsonb)
                      from (select distinct se.educator_id, se.educator_name
                              from public.adm_series_educators() se
                             where se.series_id in (select t.series_id from t)) x)));
end $$;

create or replace function public.get_tpa_summary(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator text default null,
  p_from date default null, p_to date default null
) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    with a as (select * from public.adm_tpa_attempts(p_series, p_subject, p_test, p_educator, p_from, p_to))
    select jsonb_build_object(
      'total_attempts',   (select count(*) from a),
      'avg_score',        (select coalesce(round(avg(a.percentage)), 0) from a),
      'published_tests',  (select count(*) from public.adm_tpa_tests(p_series, p_subject, p_test, p_educator)),
      'avg_time_minutes', (select coalesce(round(avg(a.minutes)), 0) from a)));
end $$;

create or replace function public.get_tpa_subject_scores(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator text default null,
  p_from date default null, p_to date default null
) returns table (subject text, avg_score numeric, attempts bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return query
  select a.subject, round(avg(a.percentage)), count(*)
    from public.adm_tpa_attempts(p_series, p_subject, p_test, p_educator, p_from, p_to) a
   where a.subject is not null
   group by a.subject
   order by 2 desc;
end $$;

create or replace function public.get_tpa_series_engagement(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator text default null,
  p_from date default null, p_to date default null
) returns table (series_id uuid, series_title text, educators text, subject text, attempts bigint, avg_performance numeric)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return query
  select s.series_id, s.series_title, s.educator_names, s.subject,
         count(a.attempt_id), coalesce(round(avg(a.percentage)), 0)
    from (select distinct t.series_id, t.series_title, t.subject, t.educator_names
            from public.adm_tpa_tests(p_series, p_subject, p_test, p_educator) t) s
    left join public.adm_tpa_attempts(p_series, p_subject, p_test, p_educator, p_from, p_to) a on a.series_id = s.series_id
   group by s.series_id, s.series_title, s.educator_names, s.subject
   order by s.series_title;
end $$;

create or replace function public.get_tpa_test_comparison(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator text default null,
  p_from date default null, p_to date default null
) returns table (test_id uuid, test_title text, series_title text, educators text, attempts bigint,
                 avg_score numeric, avg_time_minutes numeric)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return query
  select t.test_id, t.test_title, t.series_title, t.educator_names,
         count(a.attempt_id), coalesce(round(avg(a.percentage)), 0), coalesce(round(avg(a.minutes)), 0)
    from public.adm_tpa_tests(p_series, p_subject, p_test, p_educator) t
    left join public.adm_tpa_attempts(p_series, p_subject, p_test, p_educator, p_from, p_to) a on a.test_id = t.test_id
   group by t.test_id, t.test_title, t.series_title, t.educator_names, t.test_position
   order by t.series_title, t.test_position;
end $$;

-- p_series null = all series: each learner's attempt-weighted average.
-- Ties share a rank; percentile = share of learners scoring strictly below.
create or replace function public.get_tpa_leaderboard(
  p_series uuid default null, p_from date default null, p_to date default null, p_limit int default 10
) returns table (rank_no bigint, student_id uuid, learner text, score numeric, percentile numeric,
                 attempts bigint, total_learners bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return query
  with l as (
    select a.student_id as sid, avg(a.percentage) as sc, count(*) as n
      from public.adm_tpa_attempts(p_series, null, null, null, p_from, p_to) a
     group by a.student_id
  ), r as (
    select l.*, count(*) over () as total, rank() over (order by l.sc desc) as rk,
           count(*) over (partition by l.sc) as ties
      from l
  )
  select r.rk, r.sid, p.full_name, round(r.sc, 1),
         round(((r.total - (r.rk + r.ties - 1))::numeric / r.total) * 100, 1),
         r.n, r.total
    from r join public.profiles p on p.id = r.sid
   order by r.rk, p.full_name
   limit least(greatest(coalesce(p_limit, 10), 1), 100);
end $$;

create or replace function public.export_tpa_rows(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator text default null,
  p_from date default null, p_to date default null
) returns table (series text, subject text, educators text, test text, attempts bigint, avg_score_pct numeric, avg_time_min numeric)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return query
  select t.series_title, t.subject, t.educator_names, t.test_title,
         count(a.attempt_id), coalesce(round(avg(a.percentage)), 0), coalesce(round(avg(a.minutes)), 0)
    from public.adm_tpa_tests(p_series, p_subject, p_test, p_educator) t
    left join public.adm_tpa_attempts(p_series, p_subject, p_test, p_educator, p_from, p_to) a on a.test_id = t.test_id
   group by t.series_title, t.subject, t.educator_names, t.test_title, t.test_position
   order by t.series_title, t.test_position;
end $$;

-- Export trail goes to the lead's audit_logs (D9; replaces the archived export_log table).
create or replace function public.log_export(p_page text, p_filters jsonb, p_rows int) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  perform public.adm_audit('export', left(coalesce(nullif(btrim(p_page), ''), 'unknown'), 100), null, null,
                           jsonb_build_object('filters', p_filters, 'row_count', p_rows), null);
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_tpa_tests(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.adm_tpa_attempts(uuid, text, uuid, text, date, date) from public, anon, authenticated;

revoke all on function public.get_tpa_filter_options(uuid) from public, anon;
revoke all on function public.get_tpa_summary(uuid, text, uuid, text, date, date) from public, anon;
revoke all on function public.get_tpa_subject_scores(uuid, text, uuid, text, date, date) from public, anon;
revoke all on function public.get_tpa_series_engagement(uuid, text, uuid, text, date, date) from public, anon;
revoke all on function public.get_tpa_test_comparison(uuid, text, uuid, text, date, date) from public, anon;
revoke all on function public.get_tpa_leaderboard(uuid, date, date, int) from public, anon;
revoke all on function public.export_tpa_rows(uuid, text, uuid, text, date, date) from public, anon;
revoke all on function public.log_export(text, jsonb, int) from public, anon;

grant execute on function public.get_tpa_filter_options(uuid) to authenticated;
grant execute on function public.get_tpa_summary(uuid, text, uuid, text, date, date) to authenticated;
grant execute on function public.get_tpa_subject_scores(uuid, text, uuid, text, date, date) to authenticated;
grant execute on function public.get_tpa_series_engagement(uuid, text, uuid, text, date, date) to authenticated;
grant execute on function public.get_tpa_test_comparison(uuid, text, uuid, text, date, date) to authenticated;
grant execute on function public.get_tpa_leaderboard(uuid, date, date, int) to authenticated;
grant execute on function public.export_tpa_rows(uuid, text, uuid, text, date, date) to authenticated;
grant execute on function public.log_export(text, jsonb, int) to authenticated;
