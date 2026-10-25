set search_path = public, extensions;
set check_function_bodies = off;
-- =====================================================================
-- UNIVERSAL LEARNING - TEST SERIES TRACKER PAGE (Admin) - Supabase SQL
-- Depends on: Test Series SQL + Assign Educators SQL
-- =====================================================================
-- ---------------------------------------------------------------- ENUMS
do $$ begin create type match_type   as enum ('exact','high','possible');                    exception when duplicate_object then null; end $$;
do $$ begin create type match_review as enum ('unreviewed','reviewed','dismissed','confirmed'); exception when duplicate_object then null; end $$;
-- ====================================================================
-- 1. TRACKER TABLE: one row per test series with roll-ups from its assignments
-- ====================================================================
create or replace view v_series_tracker with (security_invoker = true) as
with a as (
  select series_id,
    count(*)                                                                             as total_required,
    count(*) filter (where status in ('submitted','under_review','revision_requested','approved','completed')) as tests_created,
    count(*) filter (where status in ('approved','completed'))                           as tests_approved,
    min(deadline)                                                                        as nearest_deadline,
    bool_or(display_status = 'overdue')                                                  as any_overdue,
    bool_or(status = 'revision_requested')                                               as any_revision,
    array_agg(distinct educator_name) filter (where educator_name is not null)           as educators,
    min(subject)                                                                         as assignment_subject
  from v_assignments_list
  group by series_id
)
select
  s.id as series_id, s.code, s.title as series_name,
  coalesce(sub.name, a.assignment_subject)                    as subject,
  coalesce(a.educators, '{}')                                 as educators,          -- "Assigned Educators" column
  coalesce(a.total_required, 0)                               as total_required,     -- Required
  coalesce(a.tests_created, 0)                                as tests_created,      -- Created
  coalesce(a.tests_created, 0)                                as tests_submitted,    -- Submitted (same rule as the UI)
  coalesce(a.tests_approved, 0)                               as tests_approved,     -- Approved
  case when coalesce(a.total_required,0) = 0 then 0
       else round(a.tests_approved::numeric / a.total_required * 100) end as completion_pct,   -- Progress bar
  a.nearest_deadline                                          as deadline,           -- Deadline
  case when a.total_required is null            then 'No Assignments Yet'
       when a.any_overdue                       then 'Overdue'
       when a.tests_approved = a.total_required then 'Complete'
       when a.any_revision                      then 'Needs Revision'
       else 'On Track' end                                    as overall_status,     -- Overall Status badge
  s.status as series_status, s.created_at
from test_series s
left join subjects sub on sub.id = s.subject_id
left join a on a.series_id = s.id
where s.deleted_at is null;
-- Filter dropdown options
create or replace view v_tracker_educators with (security_invoker = true) as
select distinct educator_name as name from v_assignments_list where educator_name is not null order by 1;
-- Search + sort + filters + pagination (8 per page)
-- p_sort: deadline_asc | completion_desc | name_asc
-- p_status: 'On Track' | 'Complete' | 'Needs Revision' | 'Overdue' | 'No Assignments Yet'
create or replace function list_series_tracker(
  p_search text default null, p_sort text default 'deadline_asc',
  p_subject text default null, p_educator text default null, p_status text default null,
  p_page int default 1, p_size int default 8
) returns table (row_data jsonb, total_count bigint)
language sql stable security invoker as $$
  with f as (
    select * from v_series_tracker v
    where (p_search   is null or (v.series_name || ' ' || coalesce(v.subject,'')) ilike '%' || p_search || '%')
      and (p_subject  is null or v.subject = p_subject)
      and (p_educator is null or p_educator = any (v.educators))
      and (p_status   is null or v.overall_status = p_status)
  )
  select to_jsonb(f), count(*) over () from f
  order by
    case when p_sort = 'deadline_asc'    then deadline end asc nulls last,
    case when p_sort = 'completion_desc' then completion_pct end desc,
    case when p_sort = 'name_asc'        then series_name end asc,
    series_name
  limit p_size offset (greatest(p_page,1) - 1) * p_size;
$$;
-- Row click: series detail modal (4 counts + the assignment list)
create or replace function get_series_tracker_detail(p_series uuid) returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'series', to_jsonb(t),
    'assignments', (select coalesce(jsonb_agg(to_jsonb(a) order by a.deadline), '[]')
                    from v_assignments_list a where a.series_id = p_series))
  from v_series_tracker t where t.series_id = p_series;
$$;
-- ====================================================================
-- 2. STAT CARDS
-- ====================================================================
create or replace function get_tracker_stats()
returns table (total_series bigint, active_series bigint, total_assignments bigint,
               in_progress bigint, pending_submissions bigint, pending_reviews bigint, completed bigint, overdue bigint)
language sql stable security invoker as $$
  select
    (select count(*) from test_series where deleted_at is null),                          -- Total Test Series
    (select count(*) from test_series where deleted_at is null and status = 'published'), -- Active Test Series
    count(*),                                                                             -- Total Assignments
    count(*) filter (where display_status = 'in_progress'),
    count(*) filter (where status in ('assigned','in_progress')),
    count(*) filter (where status in ('submitted','under_review')),
    count(*) filter (where status = 'completed'),
    count(*) filter (where display_status = 'overdue')
  from v_assignments_list;
$$;
-- ====================================================================
-- 3. REPEATED-QUESTION DETECTION (side-by-side review)
-- ====================================================================
create or replace function norm_text(t text) returns text language sql immutable as
$$ select lower(btrim(regexp_replace(coalesce(t,''), '[^a-zA-Z0-9]+', ' ', 'g'))) $$;
create index if not exists idx_questions_norm_trgm on questions using gin (norm_text(body) gin_trgm_ops);
create table if not exists question_similarity_matches (
  id                 uuid primary key default gen_random_uuid(),
  pair_key           text not null unique,                       -- "<smaller id>::<larger id>"
  question_a_id      uuid not null references questions(id) on delete cascade,   -- original
  question_b_id      uuid not null references questions(id) on delete cascade,   -- matching
  similarity_percent int  not null check (similarity_percent between 0 and 100),
  match_type         match_type not null,                         -- exact >= 97, high >= 75, possible >= 50
  same_series        boolean not null default false,
  same_test          boolean not null default false,
  review_status      match_review not null default 'unreviewed',
  review_note        text,
  reviewed_by        uuid references profiles(id),
  reviewed_at        timestamptz,
  detected_at        timestamptz not null default now(),
  check (question_a_id <> question_b_id)
);
create index if not exists idx_matches_review on question_similarity_matches(review_status, match_type);
create index if not exists idx_matches_qa     on question_similarity_matches(question_a_id);
create index if not exists idx_matches_qb     on question_similarity_matches(question_b_id);
-- Run on page load, after a publish, or nightly via pg_cron. Review decisions are never overwritten.
create or replace function detect_repeated_questions() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare started timestamptz := clock_timestamp(); n int;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  perform set_config('pg_trgm.similarity_threshold', '0.5', true);
  with pairs as (
    select a.id as aid, b.id as bid, ta.id as tida, tb.id as tidb, ta.series_id as sera, tb.series_id as serb,
           similarity(norm_text(a.body), norm_text(b.body)) as sim
    from questions a
    join questions b on a.id < b.id and norm_text(a.body) % norm_text(b.body)
    join tests ta on ta.id = a.test_id
    join tests tb on tb.id = b.test_id
    where norm_text(a.body) <> ''
  )
  insert into question_similarity_matches (pair_key, question_a_id, question_b_id, similarity_percent, match_type, same_series, same_test, detected_at)
  select aid::text || '::' || bid::text, aid, bid, round(sim * 100)::int,
         (case when sim >= 0.97 then 'exact' when sim >= 0.75 then 'high' else 'possible' end)::match_type,
         sera = serb, tida = tidb, clock_timestamp()
  from pairs
  on conflict (pair_key) do update
    set similarity_percent = excluded.similarity_percent, match_type = excluded.match_type,
        same_series = excluded.same_series, same_test = excluded.same_test, detected_at = clock_timestamp();
  -- drop stale pairs nobody reviewed (question edited or deleted so they no longer match)
  delete from question_similarity_matches where review_status = 'unreviewed' and detected_at < started;
  select count(*) into n from question_similarity_matches;
  return n;
end $$;
-- optional nightly: select cron.schedule('detect-dupes', '0 2 * * *', 'select detect_repeated_questions()');
create or replace view v_repeated_matches with (security_invoker = true) as
select m.id, m.pair_key, m.match_type, m.similarity_percent, m.same_series, m.same_test,
       m.review_status, m.review_note, m.reviewed_at, m.detected_at,
       qa.id as original_question_id, qa.body as original_text, qa.type as original_type,
       ta.id as original_test_id, ta.title as original_test_name, sa.id as original_series_id, sa.title as original_series_name,
       coalesce(qa.subject, suba.name) as original_subject,
       qb.id as matching_question_id, qb.body as matching_text, qb.type as matching_type,
       tb.id as matching_test_id, tb.title as matching_test_name, sb.id as matching_series_id, sb.title as matching_series_name,
       coalesce(qb.subject, subb.name) as matching_subject
from question_similarity_matches m
join questions qa on qa.id = m.question_a_id  join tests ta on ta.id = qa.test_id  join test_series sa on sa.id = ta.series_id
left join subjects suba on suba.id = sa.subject_id
join questions qb on qb.id = m.question_b_id  join tests tb on tb.id = qb.test_id  join test_series sb on sb.id = tb.series_id
left join subjects subb on subb.id = sb.subject_id
where sa.deleted_at is null and sb.deleted_at is null;
-- Filters: match type, subject, series, review status
create or replace function list_repeated_matches(
  p_type text default null, p_subject text default null, p_series uuid default null, p_review text default null,
  p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language sql stable security invoker as $$
  with f as (
    select * from v_repeated_matches v
    where (p_type    is null or v.match_type::text = p_type)
      and (p_subject is null or v.original_subject = p_subject or v.matching_subject = p_subject)
      and (p_series  is null or v.original_series_id = p_series or v.matching_series_id = p_series)
      and (p_review  is null or v.review_status::text = p_review)
  )
  select to_jsonb(f), count(*) over () from f order by similarity_percent desc
  limit p_size offset (greatest(p_page,1) - 1) * p_size;
$$;
-- Side-by-side modal buttons
create or replace function _review_match(p_id uuid, p_status match_review, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update question_similarity_matches
     set review_status = p_status, review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
end $$;
create or replace function mark_match_reviewed(p_id uuid) returns void language sql security definer set search_path = public as
$$ select _review_match(p_id, 'reviewed', null) $$;
create or replace function dismiss_match(p_id uuid, p_note text default 'Reviewed and judged not a real duplicate.') returns void language sql security definer set search_path = public as
$$ select _review_match(p_id, 'dismissed', p_note) $$;
create or replace function flag_match_confirmed(p_id uuid, p_note text default 'Confirmed duplicate â€” needs correction.') returns void language sql security definer set search_path = public as
$$ select _review_match(p_id, 'confirmed', p_note) $$;
-- Count of matches still needing review (badge)
create or replace function get_match_counts() returns table (total bigint, needs_review bigint, confirmed bigint)
language sql stable security invoker as $$
  select count(*), count(*) filter (where review_status = 'unreviewed'), count(*) filter (where review_status = 'confirmed')
  from question_similarity_matches;
$$;
-- ====================================================================
-- ROW LEVEL SECURITY (admin only)
-- ====================================================================
alter table question_similarity_matches enable row level security;
drop policy if exists matches_admin on question_similarity_matches;
create policy matches_admin on question_similarity_matches for all using (is_admin()) with check (is_admin());
-- =====================================================================
-- UNIVERSAL LEARNING - TEST PERFORMANCE ANALYTICS PAGE (Admin) - Supabase SQL
-- Depends on: Test Series SQL (test_series, tests, subjects, test_attempts, profiles, is_admin)
--             Assign Educators SQL (test_assignments)
-- =====================================================================
-- ---------------------------------------------------------------- INDEXES
create index if not exists idx_attempts_submitted   on test_attempts(submitted_at) where status = 'submitted';
create index if not exists idx_attempts_series_time on test_attempts(series_id, submitted_at) where status = 'submitted';
create index if not exists idx_attempts_test_time   on test_attempts(test_id, submitted_at) where status = 'submitted';
create index if not exists idx_attempts_student_ser on test_attempts(student_id, series_id) where status = 'submitted';
-- ====================================================================
-- 1. BUILDING BLOCKS
-- ====================================================================
-- Educators attached to a series (from active assignments); empty means "Unassigned"
create or replace view v_series_educators with (security_invoker = true) as
select distinct a.series_id, a.educator_id, p.full_name as educator_name
from test_assignments a join profiles p on p.id = a.educator_id
where a.status not in ('cancelled','rejected');
-- Published tests in published series, with subject and educators
create or replace view v_tpa_tests with (security_invoker = true) as
select t.id as test_id, t.title as test_title, t.position,
       s.id as series_id, s.title as series_title, sub.name as subject,
       coalesce(array_agg(distinct se.educator_id) filter (where se.educator_id is not null), '{}') as educator_ids,
       coalesce(string_agg(distinct se.educator_name, ', '), 'Unassigned') as educator_names
from tests t
join test_series s on s.id = t.series_id and s.deleted_at is null and s.status = 'published'
left join subjects sub on sub.id = s.subject_id
left join v_series_educators se on se.series_id = s.id
where t.status = 'published'
group by t.id, s.id, sub.name;
-- Tests that match the page filters (series / subject / test / educator)
create or replace function _tpa_tests(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator uuid default null
) returns setof v_tpa_tests language sql stable security invoker as $$
  select * from v_tpa_tests v
  where (p_series   is null or v.series_id = p_series)
    and (p_subject  is null or v.subject = p_subject)
    and (p_test     is null or v.test_id = p_test)
    and (p_educator is null or p_educator = any (v.educator_ids));
$$;
-- Submitted attempts that match all filters, including the From / To date range
create or replace function _tpa_attempts(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator uuid default null,
  p_from date default null, p_to date default null
) returns table (attempt_id uuid, series_id uuid, test_id uuid, student_id uuid,
                 percentage numeric, minutes numeric, submitted_at timestamptz, subject text)
language sql stable security invoker as $$
  select a.id, a.series_id, a.test_id, a.student_id, a.percentage,
         extract(epoch from (a.submitted_at - a.started_at)) / 60.0, a.submitted_at, t.subject
  from test_attempts a
  join _tpa_tests(p_series, p_subject, p_test, p_educator) t on t.test_id = a.test_id
  where a.status = 'submitted'
    and (p_from is null or a.submitted_at::date >= p_from)
    and (p_to   is null or a.submitted_at::date <= p_to);
$$;
-- ====================================================================
-- 2. FILTER DROPDOWNS (All Test Series / All Subjects / All Tests / All Educators)
-- ====================================================================
create or replace function get_tpa_filter_options(p_series uuid default null) returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'series',    (select coalesce(jsonb_agg(jsonb_build_object('id', series_id, 'title', series_title) order by series_title), '[]')
                  from (select distinct series_id, series_title from v_tpa_tests) x),
    'subjects',  (select coalesce(jsonb_agg(subject order by subject), '[]')
                  from (select distinct subject from v_tpa_tests where subject is not null) x),
    'tests',     (select coalesce(jsonb_agg(jsonb_build_object('id', test_id, 'title', test_title, 'series_id', series_id) order by series_title, position), '[]')
                  from v_tpa_tests where p_series is null or series_id = p_series),      -- "All Tests" narrows when a series is picked
    'educators', (select coalesce(jsonb_agg(jsonb_build_object('id', educator_id, 'name', educator_name) order by educator_name), '[]')
                  from (select distinct se.educator_id, se.educator_name
                        from v_series_educators se join v_tpa_tests t on t.series_id = se.series_id) x));
$$;
-- ====================================================================
-- 3. SUMMARY CARDS
-- ====================================================================
create or replace function get_tpa_summary(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator uuid default null,
  p_from date default null, p_to date default null
) returns table (total_attempts bigint, avg_score numeric, published_tests bigint, avg_time_minutes numeric)
language sql stable security invoker as $$
  select
    (select count(*) from _tpa_attempts(p_series,p_subject,p_test,p_educator,p_from,p_to)),                           -- Total Test Attempts
    (select coalesce(round(avg(percentage)), 0) from _tpa_attempts(p_series,p_subject,p_test,p_educator,p_from,p_to)), -- Average Score
    (select count(*) from _tpa_tests(p_series,p_subject,p_test,p_educator)),                                           -- Published Tests (in view)
    (select coalesce(round(avg(minutes)), 0) from _tpa_attempts(p_series,p_subject,p_test,p_educator,p_from,p_to));    -- Average Time Taken
$$;
-- ====================================================================
-- 4. SUBJECT-WISE AVERAGE SCORE (line chart)
-- ====================================================================
create or replace function get_tpa_subject_scores(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator uuid default null,
  p_from date default null, p_to date default null
) returns table (subject text, avg_score numeric, attempts bigint)
language sql stable security invoker as $$
  select a.subject, round(avg(a.percentage)), count(*)
  from _tpa_attempts(p_series,p_subject,p_test,p_educator,p_from,p_to) a
  where a.subject is not null
  group by a.subject order by 2 desc;
$$;
-- ====================================================================
-- 5. TEST SERIES ENGAGEMENT TABLE
-- ====================================================================
create or replace function get_tpa_series_engagement(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator uuid default null,
  p_from date default null, p_to date default null
) returns table (series_id uuid, series_title text, educators text, subject text, attempts bigint, avg_performance numeric)
language sql stable security invoker as $$
  select s.series_id, s.series_title, s.educator_names, s.subject,
         count(a.attempt_id), coalesce(round(avg(a.percentage)), 0)
  from (select distinct t.series_id, t.series_title, t.subject, t.educator_names
        from _tpa_tests(p_series,p_subject,p_test,p_educator) t) s
  left join _tpa_attempts(p_series,p_subject,p_test,p_educator,p_from,p_to) a on a.series_id = s.series_id
  group by s.series_id, s.series_title, s.educator_names, s.subject
  order by s.series_title;
$$;
-- ====================================================================
-- 6. TEST-WISE SCORE COMPARISON TABLE
-- ====================================================================
create or replace function get_tpa_test_comparison(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator uuid default null,
  p_from date default null, p_to date default null
) returns table (test_id uuid, test_title text, series_title text, educators text,
                 attempts bigint, avg_score numeric, avg_time_minutes numeric)
language sql stable security invoker as $$
  select t.test_id, t.test_title, t.series_title, t.educator_names,
         count(a.attempt_id), coalesce(round(avg(a.percentage)), 0), coalesce(round(avg(a.minutes)), 0)
  from _tpa_tests(p_series,p_subject,p_test,p_educator) t
  left join _tpa_attempts(p_series,p_subject,p_test,p_educator,p_from,p_to) a on a.test_id = t.test_id
  group by t.test_id, t.test_title, t.series_title, t.educator_names, t.position
  order by t.series_title, t.position;
$$;
-- ====================================================================
-- 7. LEADERBOARD & RANKING (own series dropdown; top 3 podium + top 10 table)
-- ====================================================================
-- p_series = null means "All Test Series": each learner's attempt-weighted average across all series.
-- Rank: ties share a rank. Percentile: share of learners scoring strictly below.
create or replace function get_tpa_leaderboard(
  p_series uuid default null, p_from date default null, p_to date default null, p_limit int default 10
) returns table (rank_no bigint, student_id uuid, learner text, score numeric, percentile numeric,
                 attempts bigint, total_learners bigint)
language sql stable security invoker as $$
  with l as (
    select a.student_id, avg(a.percentage) as score, count(*) as attempts
    from _tpa_attempts(p_series, null, null, null, p_from, p_to) a
    group by a.student_id
  ), r as (
    select l.*, count(*) over () as n,
           rank() over (order by score desc) as rk,
           count(*) over (partition by score) as ties
    from l
  )
  select r.rk, r.student_id, p.full_name, round(r.score, 1),
         round(((r.n - (r.rk + r.ties - 1))::numeric / r.n) * 100, 1),
         r.attempts, r.n
  from r join profiles p on p.id = r.student_id
  order by r.rk, p.full_name
  limit p_limit;
$$;
-- Podium = first 3 rows. Footer "Top 8 of 8 learners" = rows returned of total_learners.
create or replace view v_tpa_series_options with (security_invoker = true) as
select distinct series_id as id, series_title as title from v_tpa_tests order by series_title;
-- ====================================================================
-- 8. EXPORT CSV
-- ====================================================================
-- Flat rows for the CSV file (same filters as the page); the browser turns them into a CSV
create or replace function export_tpa_rows(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator uuid default null,
  p_from date default null, p_to date default null
) returns table (series text, subject text, educators text, test text, attempts bigint, avg_score_pct numeric, avg_time_min numeric)
language sql stable security invoker as $$
  select t.series_title, t.subject, t.educator_names, t.test_title,
         count(a.attempt_id), coalesce(round(avg(a.percentage)), 0), coalesce(round(avg(a.minutes)), 0)
  from _tpa_tests(p_series,p_subject,p_test,p_educator) t
  left join _tpa_attempts(p_series,p_subject,p_test,p_educator,p_from,p_to) a on a.test_id = t.test_id
  group by t.series_title, t.subject, t.educator_names, t.test_title, t.position
  order by t.series_title, t.position;
$$;
-- Audit trail of exports (who exported what)
create table if not exists export_log (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid references profiles(id),
  page       text not null,                     -- 'test_performance_analytics'
  filters    jsonb,
  row_count  int,
  created_at timestamptz default now()
);
alter table export_log enable row level security;
drop policy if exists export_log_admin on export_log;
create policy export_log_admin on export_log for all using (is_admin()) with check (is_admin());
create or replace function log_export(p_page text, p_filters jsonb, p_rows int) returns void
language sql security invoker as $$
  insert into export_log (admin_id, page, filters, row_count) values (auth.uid(), p_page, p_filters, p_rows);
$$;
-- ---------- 1. Payouts (educator money out; reuse your table if you already have one) ----------
do $$ begin create type payout_status as enum ('pending','processing','paid','failed');
exception when duplicate_object then null; end $$;
create table if not exists payouts (
  id                uuid primary key default gen_random_uuid(),
  educator_id       uuid not null references educators(id) on delete restrict,
  period_start      date,
  period_end        date,
  amount_inr        numeric(12,2) not null check (amount_inr >= 0),
  status            payout_status not null default 'pending',
  gateway_payout_id text,
  failure_reason    text,
  paid_at           timestamptz,
  created_by        uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint payouts_paid_has_date check (status <> 'paid' or paid_at is not null)
);
alter table payouts add column if not exists paid_at timestamptz;
alter table payouts add column if not exists failure_reason text;
alter table payouts add column if not exists gateway_payout_id text;
drop trigger if exists trg_payouts_updated on payouts;
create trigger trg_payouts_updated before update on payouts for each row execute function set_updated_at();
-- ---------- 2. Indexes (every figure on the page is a date-range aggregate) ----------
create index if not exists payments_paid_at_all_idx    on payments (paid_at) where status in ('paid','refunded');
create index if not exists payments_created_status_idx on payments (created_at, status);
create index if not exists refund_approved_at_idx      on refund_requests (decided_at) where status = 'approved';
create index if not exists payouts_paid_at_idx         on payouts (paid_at) where status = 'paid';
create index if not exists payouts_status_idx          on payouts (status);
create index if not exists payouts_educator_idx        on payouts (educator_id);
-- ---------- 3. Date-range dropdown ("Last 30 days") ----------
create or replace function resolve_date_range(
  p_range text default 'last_30_days', p_from date default null, p_to date default null
) returns table (d_from date, d_to date)
language sql stable as $$
  with today as (select (now() at time zone 'Asia/Kolkata')::date as d)
  select
    case p_range
      when 'last_7_days'  then d - 6
      when 'last_30_days' then d - 29
      when 'last_90_days' then d - 89
      when 'this_month'   then date_trunc('month', d)::date
      when 'last_month'   then (date_trunc('month', d) - interval '1 month')::date
      when 'this_year'    then date_trunc('year', d)::date
      when 'all_time'     then date '2000-01-01'
      when 'custom'       then coalesce(p_from, d - 29)
      else d - 29 end,
    case p_range
      when 'last_month'   then (date_trunc('month', d) - interval '1 day')::date
      when 'custom'       then coalesce(p_to, d)
      else d end
  from today;
$$;
-- ---------- 4. Cards: Gross revenue / Net revenue (+ payout & payment-performance extras) ----------
create or replace function get_financial_summary(
  p_range text default 'last_30_days', p_from date default null, p_to date default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_from date; v_to date; t0 timestamptz; t1 timestamptz;
  v_gross numeric; v_txns int; v_refunds numeric; v_payouts numeric; v_fees numeric;
  v_attempts int; v_ok int; v_failed int; v_pending_payouts numeric;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select d_from, d_to into v_from, v_to from resolve_date_range(p_range, p_from, p_to);
  t0 := v_from::timestamp at time zone 'Asia/Kolkata';
  t1 := (v_to + 1)::timestamp at time zone 'Asia/Kolkata';
  -- GROSS = everything successfully charged in range (a later-refunded sale still counts as gross)
  select coalesce(sum(amount_inr),0), count(*), coalesce(sum(platform_fee_inr),0)
    into v_gross, v_txns, v_fees
    from payments where status in ('paid','refunded') and paid_at >= t0 and paid_at < t1;
  select coalesce(sum(amount_inr),0) into v_refunds
    from refund_requests where status = 'approved' and decided_at >= t0 and decided_at < t1;
  select coalesce(sum(amount_inr),0) into v_payouts
    from payouts where status = 'paid' and paid_at >= t0 and paid_at < t1;
  select coalesce(sum(amount_inr),0) into v_pending_payouts
    from payouts where status in ('pending','processing');
  select count(*) filter (where status in ('paid','refunded','failed')),
         count(*) filter (where status in ('paid','refunded')),
         count(*) filter (where status = 'failed')
    into v_attempts, v_ok, v_failed
    from payments where created_at >= t0 and created_at < t1;
  return jsonb_build_object(
    'range', jsonb_build_object('key', p_range, 'from', v_from, 'to', v_to),
    'gross_revenue_inr',  v_gross,
    'transactions',       v_txns,                              -- "19 transactions"
    'refunds_inr',        v_refunds,
    'payouts_paid_inr',   v_payouts,
    'net_revenue_inr',    v_gross - v_payouts - v_refunds,     -- "After payouts & refunds"
    'platform_fees_inr',  v_fees,
    'pending_payouts_inr', v_pending_payouts,
    'payment_performance', jsonb_build_object(
        'attempts', v_attempts, 'successful', v_ok, 'failed', v_failed,
        'success_rate_pct', case when v_attempts = 0 then null else round(100.0 * v_ok / v_attempts, 1) end));
end $$;
-- ---------- 5. "Revenue Trend" chart: Revenue line + Refunds line ----------
create or replace function get_revenue_trend(
  p_range text default 'last_30_days', p_from date default null, p_to date default null,
  p_granularity text default 'auto'                       -- auto | day | week | month
) returns table (bucket date, revenue_inr numeric, refunds_inr numeric,
                 payouts_inr numeric, net_inr numeric, transactions int)
language plpgsql stable security definer set search_path = public as $$
declare v_from date; v_to date; t0 timestamptz; t1 timestamptz; g text;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select d_from, d_to into v_from, v_to from resolve_date_range(p_range, p_from, p_to);
  t0 := v_from::timestamp at time zone 'Asia/Kolkata';
  t1 := (v_to + 1)::timestamp at time zone 'Asia/Kolkata';
  g := case when p_granularity in ('day','week','month') then p_granularity
            when (v_to - v_from) < 92  then 'day'
            when (v_to - v_from) < 400 then 'week'
            else 'month' end;
  return query
  with buckets as (
    select generate_series(date_trunc(g, v_from::timestamp)::date, v_to, ('1 ' || g)::interval)::date as b
  ),
  rev as (
    select date_trunc(g, paid_at at time zone 'Asia/Kolkata')::date b,
           sum(amount_inr) amt, count(*)::int n
      from payments where status in ('paid','refunded') and paid_at >= t0 and paid_at < t1 group by 1),
  ref as (
    select date_trunc(g, decided_at at time zone 'Asia/Kolkata')::date b, sum(amount_inr) amt
      from refund_requests where status = 'approved' and decided_at >= t0 and decided_at < t1 group by 1),
  pay as (
    select date_trunc(g, paid_at at time zone 'Asia/Kolkata')::date b, sum(amount_inr) amt
      from payouts where status = 'paid' and paid_at >= t0 and paid_at < t1 group by 1)
  select bu.b,
         coalesce(rev.amt,0), coalesce(ref.amt,0), coalesce(pay.amt,0),
         coalesce(rev.amt,0) - coalesce(ref.amt,0) - coalesce(pay.amt,0),
         coalesce(rev.n,0)
  from buckets bu
  left join rev on rev.b = bu.b
  left join ref on ref.b = bu.b
  left join pay on pay.b = bu.b
  order by bu.b;
end $$;
-- ---------- 6. One call per page load / dropdown change ----------
create or replace function get_financial_analytics(
  p_range text default 'last_30_days', p_from date default null, p_to date default null
) returns jsonb
language sql stable security invoker as $$
  select get_financial_summary(p_range, p_from, p_to)
         || jsonb_build_object('trend',
              coalesce((select jsonb_agg(to_jsonb(t) order by t.bucket)
                          from get_revenue_trend(p_range, p_from, p_to) t), '[]'::jsonb));
$$;
-- Options for the "Date range" dropdown
create or replace function get_financial_range_options() returns jsonb
language sql immutable as $$
  select jsonb_build_array(
    jsonb_build_object('key','last_7_days',  'label','Last 7 days'),
    jsonb_build_object('key','last_30_days', 'label','Last 30 days'),
    jsonb_build_object('key','last_90_days', 'label','Last 90 days'),
    jsonb_build_object('key','this_month',   'label','This month'),
    jsonb_build_object('key','last_month',   'label','Last month'),
    jsonb_build_object('key','this_year',    'label','This year'),
    jsonb_build_object('key','all_time',     'label','All time'),
    jsonb_build_object('key','custom',       'label','Custom range'));
$$;
-- ---------- 7. Grants ----------
revoke execute on function get_financial_summary(text,date,date), get_revenue_trend(text,date,date,text),
  get_financial_analytics(text,date,date) from public, anon;
grant execute on function get_financial_summary(text,date,date), get_revenue_trend(text,date,date,text),
  get_financial_analytics(text,date,date), get_financial_range_options(), resolve_date_range(text,date,date)
  to authenticated;
-- ---------- 8. RLS ----------
alter table payouts enable row level security;
drop policy if exists payouts_admin_select on payouts;
create policy payouts_admin_select on payouts for select to authenticated using (is_admin());
drop policy if exists payouts_own_select on payouts;
create policy payouts_own_select on payouts for select to authenticated using (educator_id = auth.uid());
revoke insert, update, delete on payouts from anon, authenticated;   -- writes via your payout RPC / service role
-- =====================================================================
-- Universal Learning â€“ Regional Growth (Supabase / PostgreSQL)
-- Reuses: profiles, payments, is_admin(), resolve_date_range() (from Financial Analytics)
-- Re-runnable.
-- =====================================================================
create extension if not exists pg_trgm;
-- ---------- 1. Reference tables ----------
create table if not exists regions (                       -- Indian states / UTs
  code          text primary key,                          -- 'MH'
  name          text not null unique,                      -- 'Maharashtra'
  primary_city  text,                                      -- fallback city label
  sort_order    int not null default 0,
  is_active     boolean not null default true
);
insert into regions (code, name, primary_city) values
 ('AP','Andhra Pradesh','Visakhapatnam'),('AR','Arunachal Pradesh','Itanagar'),('AS','Assam','Guwahati'),
 ('BR','Bihar','Patna'),('CG','Chhattisgarh','Raipur'),('GA','Goa','Panaji'),('GJ','Gujarat','Ahmedabad'),
 ('HR','Haryana','Gurugram'),('HP','Himachal Pradesh','Shimla'),('JH','Jharkhand','Ranchi'),
 ('KA','Karnataka','Bengaluru'),('KL','Kerala','Kochi'),('MP','Madhya Pradesh','Bhopal'),
 ('MH','Maharashtra','Pune'),('MN','Manipur','Imphal'),('ML','Meghalaya','Shillong'),('MZ','Mizoram','Aizawl'),
 ('NL','Nagaland','Kohima'),('OD','Odisha','Bhubaneswar'),('PB','Punjab','Ludhiana'),('RJ','Rajasthan','Jaipur'),
 ('SK','Sikkim','Gangtok'),('TN','Tamil Nadu','Chennai'),('TG','Telangana','Hyderabad'),('TR','Tripura','Agartala'),
 ('UP','Uttar Pradesh','Lucknow'),('UK','Uttarakhand','Dehradun'),('WB','West Bengal','Kolkata'),
 ('AN','Andaman and Nicobar Islands','Port Blair'),('CH','Chandigarh','Chandigarh'),
 ('DN','Dadra and Nagar Haveli and Daman and Diu','Daman'),('DL','Delhi','Delhi'),
 ('JK','Jammu and Kashmir','Srinagar'),('LA','Ladakh','Leh'),('LD','Lakshadweep','Kavaratti'),
 ('PY','Puducherry','Puducherry')
on conflict (code) do nothing;
create table if not exists institutions (                  -- schools / coaching centres ("14 institutions")
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  state_code  text not null references regions(code),
  city        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- who belongs to which institution, and a snapshot of it on every sale
alter table profiles add column if not exists institution_id uuid references institutions(id) on delete set null;
alter table payments add column if not exists institution_id uuid references institutions(id) on delete set null;
create or replace function set_payment_institution() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.institution_id is null then
    select institution_id into new.institution_id from profiles where id = new.user_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_payment_institution on payments;
create trigger trg_payment_institution before insert on payments for each row execute function set_payment_institution();
-- optional one-time backfill for existing rows:
--   update payments p set institution_id = pr.institution_id
--     from profiles pr where pr.id = p.user_id and p.institution_id is null;
drop trigger if exists trg_institutions_updated on institutions;
create trigger trg_institutions_updated before update on institutions for each row execute function set_updated_at();
-- ---------- 2. Indexes ----------
create index if not exists institutions_state_idx     on institutions (state_code) where is_active;
create index if not exists institutions_city_trgm     on institutions using gin (city gin_trgm_ops);
create index if not exists regions_name_trgm          on regions using gin (name gin_trgm_ops);
create index if not exists profiles_institution_idx   on profiles (institution_id);
create index if not exists payments_inst_paid_idx     on payments (institution_id, paid_at) where status = 'paid';
-- ---------- 3. Internal aggregate (revenue per state for a date window) ----------
create or replace function _regional_revenue(p_from date, p_to date)
returns table (state_code text, revenue numeric, txns int)
language sql stable security definer set search_path = public as $$
  select i.state_code, sum(p.amount_inr), count(*)::int
  from payments p
  join institutions i on i.id = p.institution_id
  where p.status = 'paid'
    and p.paid_at >= p_from::timestamp at time zone 'Asia/Kolkata'
    and p.paid_at <  (p_to + 1)::timestamp at time zone 'Asia/Kolkata'
  group by i.state_code;
$$;
revoke all on function _regional_revenue(date,date) from public, anon, authenticated;
-- ---------- 4. Summary cards ----------
create or replace function get_regional_summary(
  p_range text default 'last_30_days', p_from date default null, p_to date default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_from date; v_to date; r jsonb;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select d_from, d_to into v_from, v_to from resolve_date_range(p_range, p_from, p_to);
  with cur as (select * from _regional_revenue(v_from, v_to)),
       prv as (select * from _regional_revenue(v_from - (v_to - v_from) - 1, v_from - 1)),
       g as (select c.state_code, c.revenue,
                    case when p.revenue > 0 then (c.revenue - p.revenue) / p.revenue * 100 end as mom
               from cur c left join prv p using (state_code)),
       top as (select g.state_code, g.revenue, rg.name from g join regions rg on rg.code = g.state_code
                order by g.revenue desc limit 1)
  select jsonb_build_object(
    'range', jsonb_build_object('key', p_range, 'from', v_from, 'to', v_to),
    'regions_tracked', (select count(distinct state_code) from institutions where is_active),     -- 8
    'institutions',    (select count(*) from institutions where is_active),                       -- "14 institutions"
    'total_revenue_inr', coalesce((select sum(revenue) from cur), 0),                             -- "Selected time period"
    'top_region', (select jsonb_build_object('code', state_code, 'name', name, 'revenue_inr', revenue) from top),
    'avg_growth_pct', (select round(sum(mom * revenue) / nullif(sum(revenue),0), 1)               -- "Revenue-weighted"
                         from g where mom is not null))
  into r;
  return r;
end $$;
-- ---------- 5. Revenue Growth Trend (line chart; "All India" + time-range dropdowns) ----------
create or replace function get_regional_trend(
  p_range text default 'last_30_days', p_from date default null, p_to date default null,
  p_state_code text default null                                 -- null = All India
) returns table (bucket date, revenue_inr numeric, cumulative_inr numeric, transactions int)
language plpgsql stable security definer set search_path = public as $$
declare v_from date; v_to date; t0 timestamptz; t1 timestamptz; g text;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select d_from, d_to into v_from, v_to from resolve_date_range(p_range, p_from, p_to);
  t0 := v_from::timestamp at time zone 'Asia/Kolkata';
  t1 := (v_to + 1)::timestamp at time zone 'Asia/Kolkata';
  g := case when (v_to - v_from) < 92 then 'day' when (v_to - v_from) < 400 then 'week' else 'month' end;
  return query
  with buckets as (
    select generate_series(date_trunc(g, v_from::timestamp)::date, v_to, ('1 ' || g)::interval)::date b),
  rev as (
    select date_trunc(g, p.paid_at at time zone 'Asia/Kolkata')::date b, sum(p.amount_inr) amt, count(*)::int n
      from payments p join institutions i on i.id = p.institution_id
     where p.status = 'paid' and p.paid_at >= t0 and p.paid_at < t1
       and (p_state_code is null or p_state_code in ('','all') or i.state_code = p_state_code)
     group by 1)
  select bu.b, coalesce(rev.amt,0),
         sum(coalesce(rev.amt,0)) over (order by bu.b), coalesce(rev.n,0)
  from buckets bu left join rev on rev.b = bu.b
  order by bu.b;
end $$;
-- ---------- 6. Revenue by Region (bar chart) ----------
create or replace function get_revenue_by_region(
  p_range text default 'last_30_days', p_from date default null, p_to date default null, p_limit int default 10
) returns table (state_code text, region text, revenue_inr numeric, pct_of_max numeric, pct_of_total numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_from date; v_to date;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select d_from, d_to into v_from, v_to from resolve_date_range(p_range, p_from, p_to);
  return query
  with c as (select * from _regional_revenue(v_from, v_to)),
       t as (select coalesce(sum(revenue),0) tot, coalesce(max(revenue),0) mx from c)
  select r.code, r.name, coalesce(c.revenue,0),
         case when t.mx = 0 then 0 else round(coalesce(c.revenue,0) / t.mx * 100, 1) end,     -- bar fill height
         case when t.tot = 0 then 0 else round(coalesce(c.revenue,0) / t.tot * 100, 1) end
  from regions r
  left join c on c.state_code = r.code, t
  where exists (select 1 from institutions i where i.state_code = r.code and i.is_active)
  order by coalesce(c.revenue,0) desc, r.name
  limit greatest(p_limit,1);
end $$;
-- ---------- 7. Region Comparison table: search + sort + pagination ----------
create or replace function list_region_comparison(
  p_range  text default 'last_30_days', p_from date default null, p_to date default null,
  p_search text default null,                          -- state or city
  p_sort   text default 'revenue_desc',                -- revenue_desc | mom_desc | yoy_desc | institutions_desc | name_asc
  p_page   int default 1, p_size int default 8
) returns table (row_data jsonb, total_count bigint)
language sql stable security definer set search_path = public as $$
  with b as (select d_from f, d_to t from resolve_date_range(p_range, p_from, p_to)),
  cur as (select c.* from b, _regional_revenue(b.f, b.t) c),
  prv as (select c.* from b, _regional_revenue(b.f - (b.t - b.f) - 1, b.f - 1) c),            -- MoM comparison window
  yoy as (select c.* from b, _regional_revenue((b.f - interval '1 year')::date, (b.t - interval '1 year')::date) c),
  base as (
    select r.code, r.name,
      (select count(*) from institutions i where i.state_code = r.code and i.is_active)        as inst,
      coalesce(cur.revenue,0) as rev, prv.revenue as prev_rev, yoy.revenue as yoy_rev,
      coalesce((select i.city from institutions i
                 where i.state_code = r.code and i.is_active
                 order by (select coalesce(sum(p.amount_inr),0) from payments p
                            where p.institution_id = i.id and p.status = 'paid'
                              and p.paid_at >= b.f::timestamp at time zone 'Asia/Kolkata'
                              and p.paid_at <  (b.t + 1)::timestamp at time zone 'Asia/Kolkata') desc, i.city
                 limit 1), r.primary_city) as city
    from regions r cross join b
    left join cur on cur.state_code = r.code
    left join prv on prv.state_code = r.code
    left join yoy on yoy.state_code = r.code
    where is_admin()
      and exists (select 1 from institutions i where i.state_code = r.code and i.is_active)
      and (p_search is null or p_search = ''
           or r.name ilike '%'||p_search||'%' or r.primary_city ilike '%'||p_search||'%'
           or exists (select 1 from institutions i where i.state_code = r.code and i.city ilike '%'||p_search||'%'))
  ),
  g as (
    select base.*,
      case when prev_rev > 0 then round((rev - prev_rev) / prev_rev * 100, 1) end as mom,
      case when yoy_rev  > 0 then round((rev - yoy_rev)  / yoy_rev  * 100, 1) end as yoy
    from base
  )
  select jsonb_build_object('state_code', g.code, 'region', g.name, 'city', g.city,
                            'institutions', g.inst, 'revenue_inr', g.rev, 'mom_pct', g.mom, 'yoy_pct', g.yoy),
         count(*) over ()
  from g
  order by
    case p_sort when 'name_asc' then g.name end asc,
    case p_sort when 'mom_desc'          then g.mom end desc nulls last,
    case p_sort when 'yoy_desc'          then g.yoy end desc nulls last,
    case p_sort when 'institutions_desc' then g.inst end desc,
    g.rev desc, g.name
  limit greatest(p_size,1) offset (greatest(p_page,1)-1) * greatest(p_size,1);
$$;
-- ---------- 8. Dropdown options ----------
create or replace function get_regional_filter_options() returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'regions', jsonb_build_array(jsonb_build_object('code','all','name','All India'))
               || coalesce((select jsonb_agg(jsonb_build_object('code', r.code, 'name', r.name) order by r.name)
                              from regions r where exists
                               (select 1 from institutions i where i.state_code = r.code and i.is_active)), '[]'::jsonb),
    'ranges',  get_financial_range_options());
$$;
-- ---------- 9. One call for the whole page header + charts (table is separate: search/pagination) ----------
create or replace function get_regional_growth(
  p_range text default 'last_30_days', p_from date default null, p_to date default null,
  p_state_code text default null
) returns jsonb
language sql stable security invoker as $$
  select get_regional_summary(p_range, p_from, p_to)
    || jsonb_build_object(
         'trend',     coalesce((select jsonb_agg(to_jsonb(t) order by t.bucket)
                                  from get_regional_trend(p_range, p_from, p_to, p_state_code) t), '[]'::jsonb),
         'by_region', coalesce((select jsonb_agg(to_jsonb(x)) from get_revenue_by_region(p_range, p_from, p_to) x), '[]'::jsonb));
$$;
-- ---------- 10. Grants ----------
revoke execute on function get_regional_summary(text,date,date), get_regional_trend(text,date,date,text),
  get_revenue_by_region(text,date,date,int), list_region_comparison(text,date,date,text,text,int,int),
  get_regional_growth(text,date,date,text) from public, anon;
grant execute on function get_regional_summary(text,date,date), get_regional_trend(text,date,date,text),
  get_revenue_by_region(text,date,date,int), list_region_comparison(text,date,date,text,text,int,int),
  get_regional_growth(text,date,date,text), get_regional_filter_options() to authenticated;
-- ---------- 11. RLS ----------
alter table regions      enable row level security;
alter table institutions enable row level security;
drop policy if exists regions_read on regions;
create policy regions_read on regions for select to authenticated using (true);
drop policy if exists institutions_admin_all on institutions;
create policy institutions_admin_all on institutions for all to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists institutions_read_own on institutions;
create policy institutions_read_own on institutions for select to authenticated
  using (id = (select institution_id from profiles where id = auth.uid()));
revoke insert, update, delete on regions from anon, authenticated;
-- =====================================================================
-- Universal Learning â€“ Reports & Analytics (custom report builder)
-- Reuses: profiles, students, educators, test_series, series_enrollments, test_assignments,
--         payments, subjects, regions, is_admin(), resolve_date_range() (Financial Analytics)
-- Re-runnable.
-- =====================================================================
-- ---------- 1. Enum ----------
do $$ begin create type report_run_status as enum ('running','completed','failed');
exception when duplicate_object then null; end $$;
-- ---------- 2. Report catalog: drives the "Report type" dropdown AND the dynamic filters ----------
create table if not exists report_types (
  key          text primary key,                       -- 'enrollment'
  label        text not null,
  description  text,
  date_label   text not null default 'Date',           -- what the date range filters, shown as helper text
  columns      jsonb not null,                         -- [{"key","label"}] = table + CSV column order
  filters      jsonb not null default '[]'::jsonb,     -- [{"key","label","type","options"|"source"}]
  sort_order   int not null default 0,
  is_active    boolean not null default true
);
insert into report_types (key, label, description, date_label, sort_order, columns, filters) values
('enrollment', 'Enrollment report', 'Who enrolled in which test series', 'Enrolled on', 1,
 '[{"key":"enrollment_id","label":"Enrollment ID"},{"key":"student","label":"Student"},{"key":"email","label":"Email"},
   {"key":"test_series","label":"Test series"},{"key":"educator","label":"Educator"},{"key":"enrolled_on","label":"Enrolled on"},
   {"key":"status","label":"Status"},{"key":"amount_paid_inr","label":"Amount paid (INR)"}]',
 '[{"key":"series_id","label":"Test series","type":"select","source":"series"},
   {"key":"educator_id","label":"Educator","type":"select","source":"educators"},
   {"key":"status","label":"Status","type":"select","options":["active","revoked"]}]'),
('test_series', 'Courses / test series report', 'Catalogue, enrollments and revenue per test series', 'Created on', 2,
 '[{"key":"title","label":"Test series"},{"key":"subject","label":"Subject"},{"key":"status","label":"Status"},
   {"key":"pricing","label":"Pricing"},{"key":"price_inr","label":"Price (INR)"},{"key":"educators","label":"Educators"},
   {"key":"created_on","label":"Created on"},{"key":"enrollments","label":"Enrollments"},{"key":"revenue_inr","label":"Revenue (INR)"}]',
 '[{"key":"subject_id","label":"Subject","type":"select","source":"subjects"},
   {"key":"status","label":"Status","type":"select","options":["draft","scheduled","published","archived"]},
   {"key":"pricing","label":"Pricing","type":"select","options":["free","paid"]},
   {"key":"educator_id","label":"Educator","type":"select","source":"educators"}]'),
('educators', 'Educator report', 'Educator status, load and earnings', 'Joined on', 3,
 '[{"key":"educator","label":"Educator"},{"key":"email","label":"Email"},{"key":"verification_status","label":"Verification"},
   {"key":"account_status","label":"Account"},{"key":"joined_on","label":"Joined on"},
   {"key":"series_assigned","label":"Test series assigned"},{"key":"sales","label":"Sales"},{"key":"earnings_inr","label":"Earnings (INR)"}]',
 '[{"key":"verification_status","label":"Verification","type":"select","options":["pending","verified","rejected"]},
   {"key":"account_status","label":"Account status","type":"select","options":["active","suspended","blocked"]}]'),
('students', 'Student report', 'Registrations, enrollments and spend', 'Registered on', 4,
 '[{"key":"student","label":"Student"},{"key":"email","label":"Email"},{"key":"grade","label":"Grade"},
   {"key":"account_status","label":"Account"},{"key":"registered_on","label":"Registered on"},
   {"key":"enrollments","label":"Enrollments"},{"key":"total_spent_inr","label":"Total spent (INR)"}]',
 '[{"key":"grade","label":"Grade","type":"select","source":"grades"},
   {"key":"account_status","label":"Account status","type":"select","options":["active","blocked"]},
   {"key":"has_enrollment","label":"Has enrollment","type":"select","options":["yes","no"]}]')
on conflict (key) do update
  set label = excluded.label, description = excluded.description, date_label = excluded.date_label,
      columns = excluded.columns, filters = excluded.filters, sort_order = excluded.sort_order;
-- ---------- 3. Report runs (powers "Not generated yet" â†’ "Generated â€¦", preview and CSV) ----------
create table if not exists report_runs (
  id               uuid primary key default gen_random_uuid(),
  report_type      text not null references report_types(key),
  range_key        text not null,
  date_from        date not null,
  date_to          date not null,
  filters          jsonb not null default '{}'::jsonb,
  status           report_run_status not null default 'running',
  row_count        int,
  result_rows      jsonb,                                  -- snapshot: preview and CSV always match
  error            text,
  requested_by     uuid references profiles(id) on delete set null,
  requested_at     timestamptz not null default now(),
  generated_at     timestamptz,
  csv_downloads    int not null default 0,
  last_exported_at timestamptz,
  expires_at       timestamptz not null default (now() + interval '7 days')   -- snapshot is cleared after this
);
create index if not exists report_runs_user_idx on report_runs (requested_by, requested_at desc);
create index if not exists report_runs_type_idx on report_runs (report_type, requested_at desc);
create index if not exists report_runs_exp_idx  on report_runs (expires_at) where result_rows is not null;
-- ---------- 4. Per-type queries (internal) â€“ each returns one jsonb object per row ----------
create or replace function _report_enrollment(p_from date, p_to date, p_f jsonb) returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'enrollment_id', se.id, 'student', pr.full_name, 'email', pr.email, 'test_series', ts.title,
    'educator', (select string_agg(distinct ep.full_name, ', ') from test_assignments ta
                  join profiles ep on ep.id = ta.educator_id where ta.series_id = ts.id),
    'enrolled_on', (se.created_at at time zone 'Asia/Kolkata')::date,
    'status', case when se.revoked_at is not null then 'revoked' else 'active' end,
    'amount_paid_inr', coalesce((select sum(pm.amount_inr) from payments pm
                                  where pm.user_id = se.user_id and pm.series_id = se.series_id and pm.status = 'paid'), 0))
  from series_enrollments se
  join profiles pr on pr.id = se.user_id
  join test_series ts on ts.id = se.series_id
  where se.created_at >= p_from::timestamp at time zone 'Asia/Kolkata'
    and se.created_at <  (p_to + 1)::timestamp at time zone 'Asia/Kolkata'
    and (p_f->>'series_id' is null or se.series_id = (p_f->>'series_id')::uuid)
    and (p_f->>'educator_id' is null or exists (select 1 from test_assignments ta
           where ta.series_id = se.series_id and ta.educator_id = (p_f->>'educator_id')::uuid))
    and (p_f->>'status' is null or (case when se.revoked_at is not null then 'revoked' else 'active' end) = p_f->>'status')
  order by se.created_at desc;
$$;
create or replace function _report_test_series(p_from date, p_to date, p_f jsonb) returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'title', ts.title, 'subject', sb.name, 'status', ts.status::text,
    'pricing', case when ts.is_free then 'free' else 'paid' end, 'price_inr', ts.price_inr,
    'educators', (select string_agg(distinct ep.full_name, ', ') from test_assignments ta
                   join profiles ep on ep.id = ta.educator_id where ta.series_id = ts.id),
    'created_on', (ts.created_at at time zone 'Asia/Kolkata')::date,
    'enrollments', (select count(*) from series_enrollments se where se.series_id = ts.id),
    'revenue_inr', coalesce((select sum(pm.amount_inr) from payments pm where pm.series_id = ts.id and pm.status = 'paid'), 0))
  from test_series ts
  left join subjects sb on sb.id = ts.subject_id
  where ts.deleted_at is null
    and ts.created_at >= p_from::timestamp at time zone 'Asia/Kolkata'
    and ts.created_at <  (p_to + 1)::timestamp at time zone 'Asia/Kolkata'
    and (p_f->>'subject_id' is null or ts.subject_id = (p_f->>'subject_id')::uuid)
    and (p_f->>'status'     is null or ts.status::text = p_f->>'status')
    and (p_f->>'pricing'    is null or (case when ts.is_free then 'free' else 'paid' end) = p_f->>'pricing')
    and (p_f->>'educator_id' is null or exists (select 1 from test_assignments ta
           where ta.series_id = ts.id and ta.educator_id = (p_f->>'educator_id')::uuid))
  order by ts.created_at desc;
$$;
create or replace function _report_educators(p_from date, p_to date, p_f jsonb) returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'educator', pr.full_name, 'email', pr.email,
    'verification_status', e.verification_status::text, 'account_status', e.account_status::text,
    'joined_on', (pr.created_at at time zone 'Asia/Kolkata')::date,
    'series_assigned', (select count(distinct ta.series_id) from test_assignments ta where ta.educator_id = e.id),
    'sales',        (select count(*) from payments pm where pm.educator_id = e.id and pm.status = 'paid'),
    'earnings_inr', coalesce((select sum(pm.educator_earning_inr) from payments pm
                               where pm.educator_id = e.id and pm.status = 'paid'), 0))
  from educators e
  join profiles pr on pr.id = e.id
  where pr.created_at >= p_from::timestamp at time zone 'Asia/Kolkata'
    and pr.created_at <  (p_to + 1)::timestamp at time zone 'Asia/Kolkata'
    and (p_f->>'verification_status' is null or e.verification_status::text = p_f->>'verification_status')
    and (p_f->>'account_status'      is null or e.account_status::text      = p_f->>'account_status')
  order by pr.created_at desc;
$$;
create or replace function _report_students(p_from date, p_to date, p_f jsonb) returns setof jsonb
language sql stable security definer set search_path = public as $$
  with s as (
    select st.id, pr.full_name, pr.email, st.grade, st.account_status::text as acct, pr.created_at,
           (select count(*) from series_enrollments se where se.user_id = st.id) as enr,
           coalesce((select sum(pm.amount_inr) from payments pm where pm.user_id = st.id and pm.status = 'paid'), 0) as spent
    from students st join profiles pr on pr.id = st.id
    where pr.created_at >= p_from::timestamp at time zone 'Asia/Kolkata'
      and pr.created_at <  (p_to + 1)::timestamp at time zone 'Asia/Kolkata'
      and (p_f->>'grade' is null or st.grade = p_f->>'grade')
      and (p_f->>'account_status' is null or st.account_status::text = p_f->>'account_status')
  )
  select jsonb_build_object('student', full_name, 'email', email, 'grade', grade, 'account_status', acct,
           'registered_on', (created_at at time zone 'Asia/Kolkata')::date,
           'enrollments', enr, 'total_spent_inr', spent)
  from s
  where (p_f->>'has_enrollment' is null
         or (p_f->>'has_enrollment' = 'yes' and enr > 0) or (p_f->>'has_enrollment' = 'no' and enr = 0))
  order by created_at desc;
$$;
revoke all on function _report_enrollment(date,date,jsonb), _report_test_series(date,date,jsonb),
  _report_educators(date,date,jsonb), _report_students(date,date,jsonb) from public, anon, authenticated;
-- ---------- 5. Builder options: report-type dropdown, date-range dropdown ----------
create or replace function get_report_builder_options() returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'types',  coalesce((select jsonb_agg(jsonb_build_object('key', key, 'label', label, 'description', description,
                         'date_label', date_label, 'columns', columns, 'filters', filters) order by sort_order)
                          from report_types where is_active), '[]'::jsonb),
    'ranges', get_financial_range_options());
$$;
-- Fills the "select" filters that come from data ("Select a report type to see its filters")
create or replace function get_report_filter_options(p_type text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'series',    coalesce((select jsonb_agg(jsonb_build_object('value', id, 'label', title) order by title)
                             from test_series where deleted_at is null), '[]'),
    'educators', coalesce((select jsonb_agg(jsonb_build_object('value', e.id, 'label', p.full_name) order by p.full_name)
                             from educators e join profiles p on p.id = e.id), '[]'),
    'subjects',  coalesce((select jsonb_agg(jsonb_build_object('value', id, 'label', name) order by name) from subjects), '[]'),
    'grades',    coalesce((select jsonb_agg(jsonb_build_object('value', g, 'label', g) order by g)
                             from (select distinct grade g from students where grade is not null) x), '[]'));
end $$;
-- ---------- 6. "Generate report" button ----------
create or replace function generate_report(
  p_type text, p_range text, p_from date default null, p_to date default null,
  p_filters jsonb default '{}'::jsonb, p_preview int default 100
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t report_types; v_from date; v_to date; v_run uuid; v_rows jsonb; v_n int; v_f jsonb;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into t from report_types where key = p_type and is_active;
  if not found then raise exception 'Select a report type.'; end if;
  if p_range is null or p_range in ('', 'none') then raise exception 'Select a date range.'; end if;
  select d_from, d_to into v_from, v_to from resolve_date_range(p_range, p_from, p_to);
  if v_from > v_to then raise exception 'Start date must be on or before the end date.'; end if;
  -- drop blank filters so "All" means no filter
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into v_f
    from jsonb_each(coalesce(p_filters, '{}'::jsonb)) as f(k, v)
   where v <> 'null'::jsonb and v <> '""'::jsonb;
  insert into report_runs (report_type, range_key, date_from, date_to, filters, status, requested_by)
  values (p_type, p_range, v_from, v_to, v_f, 'running', auth.uid())
  returning id into v_run;
  begin
    select coalesce(jsonb_agg(x.r), '[]'::jsonb), count(*) into v_rows, v_n
    from (
      select r from (
        select r from _report_enrollment(v_from, v_to, v_f) r   where p_type = 'enrollment'
        union all
        select r from _report_test_series(v_from, v_to, v_f) r  where p_type = 'test_series'
        union all
        select r from _report_educators(v_from, v_to, v_f) r    where p_type = 'educators'
        union all
        select r from _report_students(v_from, v_to, v_f) r     where p_type = 'students'
      ) u
      limit 10001
    ) x;
    if v_n > 10000 then raise exception 'More than 10,000 rows. Narrow the date range or add filters.'; end if;
    update report_runs set status = 'completed', row_count = v_n, result_rows = v_rows, generated_at = now()
     where id = v_run;
  exception when others then
    update report_runs set status = 'failed', error = sqlerrm where id = v_run;
    return jsonb_build_object('ok', false, 'run_id', v_run, 'error', sqlerrm);
  end;
  return jsonb_build_object(
    'ok', true, 'run_id', v_run, 'type', p_type, 'label', t.label,
    'range', jsonb_build_object('key', p_range, 'from', v_from, 'to', v_to),
    'filters', v_f, 'columns', t.columns, 'row_count', v_n, 'generated_at', now(),
    'rows', (select coalesce(jsonb_agg(e order by i), '[]'::jsonb)
               from jsonb_array_elements(v_rows) with ordinality as a(e, i) where i <= greatest(p_preview, 1)));
end $$;
-- Re-open / page through a generated report (preview table)
create or replace function get_report_run(p_run_id uuid, p_page int default 1, p_size int default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r report_runs; t report_types;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into r from report_runs where id = p_run_id;
  if not found then raise exception 'Report not found.'; end if;
  select * into t from report_types where key = r.report_type;
  if r.result_rows is null then raise exception 'This report has expired. Generate it again.'; end if;
  return jsonb_build_object(
    'run_id', r.id, 'type', r.report_type, 'label', t.label, 'status', r.status,
    'range', jsonb_build_object('key', r.range_key, 'from', r.date_from, 'to', r.date_to),
    'filters', r.filters, 'columns', t.columns, 'row_count', r.row_count, 'generated_at', r.generated_at,
    'rows', (select coalesce(jsonb_agg(e order by i), '[]'::jsonb)
               from jsonb_array_elements(r.result_rows) with ordinality as a(e, i)
              where i > (greatest(p_page,1)-1) * greatest(p_size,1) and i <= greatest(p_page,1) * greatest(p_size,1)));
end $$;
-- ---------- 7. "CSV" button ----------
create or replace function export_report_csv(p_run_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r report_runs; t report_types; v_head text; v_body text;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into r from report_runs where id = p_run_id and status = 'completed';
  if not found then raise exception 'Generate a report first.'; end if;
  if r.result_rows is null then raise exception 'This report has expired. Generate it again.'; end if;
  select * into t from report_types where key = r.report_type;
  select string_agg('"' || replace(c->>'label', '"', '""') || '"', ',' order by o) into v_head
    from jsonb_array_elements(t.columns) with ordinality as cc(c, o);
  select coalesce(string_agg(line, E'\n' order by ord), '') into v_body
  from (
    select rr.ord,
           (select string_agg('"' || replace(
                      case when coalesce(rr.r->>(c->>'key'),'') ~ '^[=+\-@]'          -- spreadsheet formula guard
                           then '''' || (rr.r->>(c->>'key')) else coalesce(rr.r->>(c->>'key'),'') end,
                      '"', '""') || '"', ',' order by o)
              from jsonb_array_elements(t.columns) with ordinality as cc(c, o)) as line
    from jsonb_array_elements(r.result_rows) with ordinality as rr(r, ord)
  ) z;
  update report_runs set csv_downloads = csv_downloads + 1, last_exported_at = now() where id = p_run_id;
  return jsonb_build_object(
    'filename', r.report_type || '-report-' || to_char(r.generated_at at time zone 'Asia/Kolkata', 'YYYYMMDD-HH24MI') || '.csv',
    'content', E'\ufeff' || v_head || E'\n' || v_body);                                 -- BOM so Excel reads â‚¹/UTF-8 correctly
end $$;
-- ---------- 8. Recent runs ----------
create or replace function list_report_runs(p_page int default 1, p_size int default 10)
returns table (row_data jsonb, total_count bigint)
language sql stable security invoker as $$
  select jsonb_build_object('id', r.id, 'report_type', r.report_type, 'label', t.label,
           'range_key', r.range_key, 'date_from', r.date_from, 'date_to', r.date_to, 'filters', r.filters,
           'status', r.status, 'row_count', r.row_count, 'generated_at', r.generated_at,
           'requested_at', r.requested_at, 'can_reopen', (r.result_rows is not null)),
         count(*) over ()
  from report_runs r join report_types t on t.key = r.report_type
  where r.requested_by = auth.uid() or is_admin()
  order by r.requested_at desc
  limit greatest(p_size,1) offset (greatest(p_page,1)-1) * greatest(p_size,1);
$$;
-- Housekeeping: clears expired snapshots but keeps the run record.
create or replace function purge_expired_report_results() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update report_runs set result_rows = null where result_rows is not null and expires_at < now();
  get diagnostics n = row_count; return n;
end $$;
-- select cron.schedule('purge-report-results', '30 2 * * *', $$select purge_expired_report_results()$$);
-- ---------- 9. Grants ----------
revoke all on function generate_report(text,text,date,date,jsonb,int), get_report_run(uuid,int,int),
  export_report_csv(uuid), get_report_filter_options(text), purge_expired_report_results() from public, anon;
grant execute on function get_report_builder_options(), get_report_filter_options(text),
  generate_report(text,text,date,date,jsonb,int), get_report_run(uuid,int,int),
  export_report_csv(uuid), list_report_runs(int,int) to authenticated;
revoke all on function purge_expired_report_results() from authenticated;
-- ---------- 10. RLS ----------
alter table report_types enable row level security;
alter table report_runs  enable row level security;
drop policy if exists report_types_admin_read on report_types;
create policy report_types_admin_read on report_types for select to authenticated using (is_admin());
drop policy if exists report_runs_select on report_runs;
create policy report_runs_select on report_runs for select to authenticated
  using (is_admin() or requested_by = auth.uid());
revoke insert, update, delete on report_types, report_runs from anon, authenticated;   -- writes via RPCs only
-- =====================================================================
-- Universal Learning â€“ Publish Notifications (Supabase / PostgreSQL)
-- Reuses: profiles, students, educators, series_enrollments, test_series, is_admin(), set_updated_at(), pg_trgm
-- Re-runnable.
-- =====================================================================
create extension if not exists pg_trgm;



