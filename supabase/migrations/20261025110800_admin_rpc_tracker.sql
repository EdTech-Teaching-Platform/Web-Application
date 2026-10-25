-- =====================================================================
-- 20261025110800_admin_rpc_tracker.sql
--
-- Purpose
--   Test Series Tracker and repeated-question detection (trackerApi.js):
--     get_tracker_stats()                         -> object (archived returned a table the page could not read)
--     list_series_tracker(p_search, p_sort, p_subject, p_educator, p_status, p_page, p_size)
--     get_series_tracker_detail(p_series)         -> {series, assignments}
--     detect_repeated_questions()                 -> int (pairs stored)
--     list_repeated_matches(p_type, p_subject, p_series, p_review, p_page, p_size)
--     get_match_counts()                          -> table(total, needs_review, confirmed)
--     mark_match_reviewed(p_id) / dismiss_match(p_id, p_note) / flag_match_confirmed(p_id, p_note)
--
-- Lead objects read
--   test_series, quizzes, quiz_questions (via adm_series_rows / adm_assignment_rows).
--
-- Assumptions
--   * Tracker rows include every non-deleted series (lead-owned ones show
--     "No Assignments Yet"). Rows carry a seriesId key because
--     TestSeriesTracker.jsx looks rows up by g.seriesId.
--   * Detection compares questions of series quizzes only (quizzes.series_id
--     not null), needs pg_trgm, and is O(n^2) without the trigram index in
--     scripts/admin_indexes_concurrently.sql.
--
-- ROLLBACK
--   drop function if exists public.flag_match_confirmed(uuid, text), public.dismiss_match(uuid, text),
--     public.mark_match_reviewed(uuid), public.adm_review_match(uuid, text, text), public.get_match_counts(),
--     public.list_repeated_matches(text, text, uuid, text, int, int), public.detect_repeated_questions(),
--     public.adm_detect_repeated_questions(),   -- unschedule the Batch 3 cron job first
--     public.get_series_tracker_detail(uuid), public.list_series_tracker(text, text, text, text, text, int, int),
--     public.get_tracker_stats(), public.adm_series_tracker_rows();
-- =====================================================================
set search_path = public, extensions;

create or replace function public.adm_series_tracker_rows()
returns table (
  series_id uuid, code text, series_name text, subject text, educators text[], total_required bigint,
  tests_created bigint, tests_submitted bigint, tests_approved bigint, completion_pct numeric, deadline date,
  overall_status text, series_status text, created_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  with a as (
    select v.series_id,
           count(*) as total_required,
           count(*) filter (where v.status in ('submitted', 'under_review', 'revision_requested', 'approved', 'completed')) as tests_created,
           count(*) filter (where v.status in ('approved', 'completed')) as tests_approved,
           min(v.deadline) filter (where v.status not in ('approved', 'completed', 'cancelled', 'rejected')) as nearest_deadline,
           bool_or(v.display_status = 'overdue') as any_overdue,
           bool_or(v.status = 'revision_requested') as any_revision,
           array_agg(distinct v.educator_name) filter (where v.educator_name is not null) as educators,
           min(v.subject) as assignment_subject
      from public.adm_assignment_rows() v
     where v.status <> 'cancelled'
     group by v.series_id
  )
  select r.id, r.code, r.title, coalesce(r.subject_name, a.assignment_subject), coalesce(a.educators, '{}'),
         coalesce(a.total_required, 0), coalesce(a.tests_created, 0), coalesce(a.tests_created, 0),
         coalesce(a.tests_approved, 0),
         case when coalesce(a.total_required, 0) = 0 then 0
              else round(a.tests_approved::numeric / a.total_required * 100) end,
         a.nearest_deadline,
         case when a.total_required is null            then 'No Assignments Yet'
              when a.any_overdue                       then 'Overdue'
              when a.tests_approved = a.total_required then 'Complete'
              when a.any_revision                      then 'Needs Revision'
              else 'On Track' end,
         r.status, r.created_at
    from public.adm_series_rows() r
    left join a on a.series_id = r.id;
$$;

create or replace function public.get_tracker_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    select jsonb_build_object(
      'total_series',        (select count(*) from public.adm_series_rows()),
      'active_series',       (select count(*) from public.adm_series_rows() r where r.status = 'published'),
      'total_assignments',   count(*),
      'in_progress',         count(*) filter (where v.display_status = 'in_progress'),
      'pending_submissions', count(*) filter (where v.status in ('assigned', 'in_progress')),
      'pending_reviews',     count(*) filter (where v.status in ('submitted', 'under_review')),
      'completed',           count(*) filter (where v.status = 'completed'),
      'overdue',             count(*) filter (where v.display_status = 'overdue'))
      from public.adm_assignment_rows() v);
end $$;

-- p_sort: deadline_asc | completion_desc | name_asc.
-- p_status: On Track | Complete | Needs Revision | Overdue | No Assignments Yet.
-- p_educator: educator name (the page builds the filter from names).
create or replace function public.list_series_tracker(
  p_search text default null, p_sort text default 'deadline_asc', p_subject text default null,
  p_educator text default null, p_status text default null, p_page int default 1, p_size int default 8
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 8), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with f as (
    select t.* from public.adm_series_tracker_rows() t
     where (v_like is null or (t.series_name || ' ' || coalesce(t.subject, '')) ilike v_like)
       and (p_subject is null or p_subject in ('', 'all') or t.subject = p_subject)
       and (p_educator is null or p_educator in ('', 'all') or p_educator = any (t.educators))
       and (p_status is null or p_status in ('', 'all') or t.overall_status = p_status)
  )
  select to_jsonb(f) || jsonb_build_object('seriesId', f.series_id), count(*) over ()
    from f
   order by case when p_sort = 'deadline_asc'    then f.deadline end asc nulls last,
            case when p_sort = 'completion_desc' then f.completion_pct end desc,
            case when p_sort = 'name_asc'        then f.series_name end asc,
            f.series_name, f.series_id
   limit v_size offset (v_page - 1) * v_size;
end $$;

create or replace function public.get_series_tracker_detail(p_series uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    select jsonb_build_object(
      'series', to_jsonb(t) || jsonb_build_object('seriesId', t.series_id),
      'assignments', (select coalesce(jsonb_agg(to_jsonb(a) order by a.deadline nulls last, a.code), '[]'::jsonb)
                        from public.adm_assignment_rows() a where a.series_id = p_series))
      from public.adm_series_tracker_rows() t where t.series_id = p_series);
end $$;

-- ------------------------------------------------- repeated questions
-- The detection itself, without an admin check, so the daily cron job
-- (20261025120800) can run it. Execute: postgres / service_role only.
create or replace function public.adm_detect_repeated_questions() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_started timestamptz := clock_timestamp();
  n int;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_trgm') then
    raise exception 'The pg_trgm extension is required for repeated-question detection.' using errcode = '0A000';
  end if;
  perform set_config('pg_trgm.similarity_threshold', '0.5', true);

  with qs as (
    select qq.id, qq.quiz_id, q.series_id, public.adm_norm_text(qq.question_text) as nt
      from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      left join public.test_series_admin sa on sa.series_id = q.series_id
     where q.series_id is not null and sa.deleted_at is null
  ), pairs as (
    select a.id as aid, b.id as bid, a.quiz_id as qa, b.quiz_id as qb, a.series_id as sera, b.series_id as serb,
           similarity(a.nt, b.nt) as sim
      from qs a join qs b on a.id < b.id and a.nt % b.nt
     where a.nt <> ''
  )
  insert into public.question_similarity_matches
    (pair_key, question_a_id, question_b_id, similarity_percent, match_type, same_series, same_test, detected_at)
  select aid::text || '::' || bid::text, aid, bid, least(round(sim * 100)::int, 100),
         case when sim >= 0.97 then 'exact' when sim >= 0.75 then 'high' else 'possible' end,
         sera = serb, qa = qb, clock_timestamp()
    from pairs
  on conflict (pair_key) do update
    set similarity_percent = excluded.similarity_percent, match_type = excluded.match_type,
        same_series = excluded.same_series, same_test = excluded.same_test, detected_at = clock_timestamp();

  -- unreviewed pairs that no longer match are dropped; review decisions are kept
  delete from public.question_similarity_matches where review_status = 'unreviewed' and detected_at < v_started;
  select count(*) into n from public.question_similarity_matches;
  return n;
end $$;

-- "Run detection" button (admins).
create or replace function public.detect_repeated_questions() returns int
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return public.adm_detect_repeated_questions();
end $$;

-- Rows keep the archived v_repeated_matches keys.
create or replace function public.list_repeated_matches(
  p_type text default null, p_subject text default null, p_series uuid default null, p_review text default null,
  p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_size int := least(greatest(coalesce(p_size, 10), 1), 200);
  v_page int := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with sr as (select r.id, r.title, r.subject_name from public.adm_series_rows() r),
  v as (
    select m.id, m.pair_key, m.match_type, m.similarity_percent, m.same_series, m.same_test,
           m.review_status, m.review_note, m.reviewed_at, m.detected_at,
           qa.id as original_question_id, qa.question_text as original_text,
           coalesce(qaa.admin_type, public.adm_ui_question_type(qa.question_type)) as original_type,
           ta.id as original_test_id, ta.title as original_test_name,
           sa.id as original_series_id, sa.title as original_series_name,
           coalesce(qaa.subject, sa.subject_name) as original_subject,
           qb.id as matching_question_id, qb.question_text as matching_text,
           coalesce(qba.admin_type, public.adm_ui_question_type(qb.question_type)) as matching_type,
           tb.id as matching_test_id, tb.title as matching_test_name,
           sb.id as matching_series_id, sb.title as matching_series_name,
           coalesce(qba.subject, sb.subject_name) as matching_subject
      from public.question_similarity_matches m
      join public.quiz_questions qa on qa.id = m.question_a_id
      left join public.quiz_question_admin qaa on qaa.question_id = qa.id
      join public.quizzes ta on ta.id = qa.quiz_id
      join sr sa on sa.id = ta.series_id
      join public.quiz_questions qb on qb.id = m.question_b_id
      left join public.quiz_question_admin qba on qba.question_id = qb.id
      join public.quizzes tb on tb.id = qb.quiz_id
      join sr sb on sb.id = tb.series_id
  )
  select to_jsonb(v), count(*) over ()
    from v
   where (p_type is null or p_type in ('', 'all') or v.match_type = p_type)
     and (p_subject is null or p_subject in ('', 'all') or v.original_subject = p_subject or v.matching_subject = p_subject)
     and (p_series is null or v.original_series_id = p_series or v.matching_series_id = p_series)
     and (p_review is null or p_review in ('', 'all') or v.review_status = p_review)
   order by v.similarity_percent desc, v.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

create or replace function public.get_match_counts() returns table (total bigint, needs_review bigint, confirmed bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return query
  select count(*), count(*) filter (where m.review_status = 'unreviewed'), count(*) filter (where m.review_status = 'confirmed')
    from public.question_similarity_matches m;
end $$;

create or replace function public.adm_review_match(p_id uuid, p_status text, p_note text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  update public.question_similarity_matches
     set review_status = p_status, review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
  if not found then raise exception 'Match not found.' using errcode = 'P0002'; end if;
end $$;

create or replace function public.mark_match_reviewed(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_review_match(p_id, 'reviewed', null);
end $$;

create or replace function public.dismiss_match(p_id uuid, p_note text default 'Reviewed and judged not a real duplicate.') returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_review_match(p_id, 'dismissed', p_note);
end $$;

create or replace function public.flag_match_confirmed(p_id uuid, p_note text default 'Confirmed duplicate - needs correction.') returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_review_match(p_id, 'confirmed', p_note);
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_series_tracker_rows() from public, anon, authenticated;
revoke all on function public.adm_review_match(uuid, text, text) from public, anon, authenticated;

revoke all on function public.get_tracker_stats() from public, anon;
revoke all on function public.list_series_tracker(text, text, text, text, text, int, int) from public, anon;
revoke all on function public.get_series_tracker_detail(uuid) from public, anon;
revoke all on function public.adm_detect_repeated_questions() from public, anon, authenticated;
grant execute on function public.adm_detect_repeated_questions() to postgres, service_role;
revoke all on function public.detect_repeated_questions() from public, anon;
revoke all on function public.list_repeated_matches(text, text, uuid, text, int, int) from public, anon;
revoke all on function public.get_match_counts() from public, anon;
revoke all on function public.mark_match_reviewed(uuid) from public, anon;
revoke all on function public.dismiss_match(uuid, text) from public, anon;
revoke all on function public.flag_match_confirmed(uuid, text) from public, anon;

grant execute on function public.get_tracker_stats() to authenticated;
grant execute on function public.list_series_tracker(text, text, text, text, text, int, int) to authenticated;
grant execute on function public.get_series_tracker_detail(uuid) to authenticated;
grant execute on function public.detect_repeated_questions() to authenticated;
grant execute on function public.list_repeated_matches(text, text, uuid, text, int, int) to authenticated;
grant execute on function public.get_match_counts() to authenticated;
grant execute on function public.mark_match_reviewed(uuid) to authenticated;
grant execute on function public.dismiss_match(uuid, text) to authenticated;
grant execute on function public.flag_match_confirmed(uuid, text) to authenticated;
