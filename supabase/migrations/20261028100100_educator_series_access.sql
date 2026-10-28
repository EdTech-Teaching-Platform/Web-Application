-- =====================================================================
-- 20261028100100_educator_series_access.sql
--
-- Purpose
--   Foundation for educators using the shared test series authoring RPCs
--   (20261028100200 swaps their admin check for these guards):
--     * test_series_admin (OUR table): + origin ('admin' | 'educator'),
--       rejection_reason, submitted_at, approved_by, approved_at; the status
--       CHECK also allows 'pending_approval' and 'rejected'.
--     * Guards (SECURITY DEFINER, read the tables, user = auth.uid()):
--         adm_actor_kind()                      -> 'admin' | 'educator' | null
--         adm_can_create_series()               -> admin or verified educator
--         adm_can_manage_series(p_series)       -> admin, or a verified educator who
--                                                  created it or holds an active assignment on it
--         adm_require_author()                  raise unless adm_can_create_series()
--         adm_require_series_access(p_series, p_write)
--         adm_require_series_access_or_new(p_series)   null = create
--         adm_require_series_owner(p_series)    admin, or the educator who created it
--       A caller who is neither admin nor verified educator gets the same
--       error as before: 42501 'Admin access required.'
--     * adm_educator_series_ids()               the caller's own + assigned series
--     * adm_series_is_independent_educator(p_series)
--     * Regrade (set-based): adm_attempt_latest_answers(p_quiz),
--       adm_rebuild_attempt_report(p_report, p_attempt), adm_regrade_quiz(p_quiz),
--       adm_question_grading_key(p_question), adm_update_options_in_place(...)
--
--   Active assignment = test_assignments row for the educator on the series
--   whose status is not 'cancelled' or 'rejected'.
--
-- Lead objects
--   Read: test_series, quizzes, quiz_questions, quiz_question_options,
--   quiz_attempts, quiz_answers. Written by adm_regrade_quiz: quiz_answers
--   (is_correct, points_earned), quiz_attempts (score, max_score, percentage,
--   passed); our attempt_reports.
--
-- ROLLBACK (whole set: scripts/rollback_20261028_educator_series.sql)
--   drop function if exists public.adm_update_options_in_place(uuid, text, jsonb);
--   drop function if exists public.adm_question_grading_key(uuid);
--   drop function if exists public.adm_regrade_quiz(uuid);
--   drop function if exists public.adm_rebuild_attempt_report(jsonb, uuid);
--   drop function if exists public.adm_attempt_latest_answers(uuid);
--   drop function if exists public.adm_series_is_independent_educator(uuid);
--   drop function if exists public.adm_require_series_owner(uuid);
--   drop function if exists public.adm_require_series_access_or_new(uuid);
--   drop function if exists public.adm_require_series_access(uuid, boolean);
--   drop function if exists public.adm_require_author();
--   drop function if exists public.adm_can_manage_series(uuid);
--   drop function if exists public.adm_can_create_series();
--   drop function if exists public.adm_educator_series_ids();
--   drop function if exists public.adm_actor_kind();
--   drop function if exists public.adm_series_review_json(uuid);
--   update public.test_series_admin set status = 'draft' where status in ('pending_approval', 'rejected');
--   alter table public.test_series_admin drop constraint if exists test_series_admin_status_check;
--   alter table public.test_series_admin add constraint test_series_admin_status_check
--     check (status in ('draft', 'scheduled', 'published', 'archived'));
--   drop index if exists public.test_series_admin_approved_by_idx;
--   drop index if exists public.test_series_admin_origin_status_idx;
--   alter table public.test_series_admin drop column if exists approved_at, drop column if exists approved_by,
--     drop column if exists submitted_at, drop column if exists rejection_reason, drop column if exists origin;
-- =====================================================================
set search_path = public, extensions;

-- -------------------------------------------------------- our table
alter table public.test_series_admin
  add column if not exists origin text not null default 'admin',
  add column if not exists rejection_reason text,
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz;
alter table public.test_series_admin drop constraint if exists test_series_admin_origin_check;
alter table public.test_series_admin add constraint test_series_admin_origin_check check (origin in ('admin', 'educator'));
alter table public.test_series_admin drop constraint if exists test_series_admin_status_check;
alter table public.test_series_admin add constraint test_series_admin_status_check
  check (status in ('draft', 'scheduled', 'published', 'archived', 'pending_approval', 'rejected'));
create index if not exists test_series_admin_approved_by_idx on public.test_series_admin (approved_by) where approved_by is not null;
create index if not exists test_series_admin_origin_status_idx on public.test_series_admin (origin, status) where deleted_at is null;

-- ------------------------------------------------------------ guards
create or replace function public.adm_actor_kind() returns text
language sql stable security definer set search_path = public, extensions as $$
  select case when public.adm_is_platform_admin() then 'admin'
              when public.adm_is_verified_educator() then 'educator' end;
$$;

-- The caller's own series plus the series they hold an active assignment on.
create or replace function public.adm_educator_series_ids() returns setof uuid
language sql stable security definer set search_path = public, extensions as $$
  select sa.series_id from public.test_series_admin sa
   where sa.created_by = auth.uid() and sa.deleted_at is null
  union
  select a.series_id from public.test_assignments a
   where a.educator_id = auth.uid() and a.status not in ('cancelled', 'rejected');
$$;

create or replace function public.adm_can_create_series() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select public.adm_is_platform_admin() or public.adm_is_verified_educator();
$$;

create or replace function public.adm_can_manage_series(p_series uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select public.adm_is_platform_admin()
      or (p_series is not null and public.adm_is_verified_educator()
          and p_series in (select public.adm_educator_series_ids()));
$$;

create or replace function public.adm_require_author() returns void
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.adm_can_create_series() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
end $$;

-- Admins pass (the function then checks the row exists, as before). A
-- verified educator needs to manage the series; while it waits for approval
-- they can read it but not change it.
create or replace function public.adm_require_series_access(p_series uuid, p_write boolean) returns void
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if public.adm_is_platform_admin() then return; end if;
  if not public.adm_is_verified_educator() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  if not public.adm_can_manage_series(p_series) then
    raise exception 'You can''t manage this test series.' using errcode = '42501';
  end if;
  if p_write and exists (select 1 from public.test_series_admin sa
                          where sa.series_id = p_series and sa.status = 'pending_approval') then
    raise exception 'This series is waiting for admin approval. You can edit it again after the review.' using errcode = '42501';
  end if;
end $$;

create or replace function public.adm_require_series_access_or_new(p_series uuid) returns void
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if p_series is null then
    perform public.adm_require_author();
  else
    perform public.adm_require_series_access(p_series, true);
  end if;
end $$;

-- Delete / submit for approval: admin, or the educator who created the series.
create or replace function public.adm_require_series_owner(p_series uuid) returns void
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_series_access(p_series, true);
  if not public.adm_is_platform_admin()
     and not exists (select 1 from public.test_series_admin sa
                      where sa.series_id = p_series and sa.created_by = auth.uid() and sa.deleted_at is null) then
    raise exception 'Only the educator who created this series can do this.' using errcode = '42501';
  end if;
end $$;

-- An educator's own series with no active assignment: published only
-- through approve_educator_series.
create or replace function public.adm_series_is_independent_educator(p_series uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.test_series_admin sa where sa.series_id = p_series and sa.origin = 'educator')
     and not exists (select 1 from public.test_assignments a
                      where a.series_id = p_series and a.status not in ('cancelled', 'rejected'));
$$;

-- Review fields of a series (not in adm_series_rows): merged into the
-- list_test_series rows and the get_test_series object by 20261028100200.
create or replace function public.adm_series_review_json(p_series uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select jsonb_build_object('origin', sa.origin, 'rejection_reason', sa.rejection_reason,
                                             'submitted_at', sa.submitted_at, 'approved_at', sa.approved_at)
                     from public.test_series_admin sa where sa.series_id = p_series),
                  jsonb_build_object('origin', 'admin'));
$$;

-- ------------------------------------------------------------ regrade
-- The graded answer row per (attempt, question) for this quiz's finished
-- attempts that have a report from this port (adm_finalize_attempt).
create or replace function public.adm_attempt_latest_answers(p_quiz uuid)
returns table (id uuid, attempt_id uuid, question_id uuid, answer_text text, sel text[], is_correct boolean, points_earned numeric)
language sql stable security definer set search_path = public, extensions as $$
  select distinct on (x.attempt_id, x.question_id)
         x.id, x.attempt_id, x.question_id, x.answer_text,
         coalesce((select array_agg(distinct s::text) from unnest(x.selected_option_ids) s), '{}'::text[]),
         x.is_correct, x.points_earned
    from public.quiz_answers x
    join public.quiz_attempts a on a.id = x.attempt_id
   where a.quiz_id = p_quiz and a.status in ('submitted', 'timed_out')
     and exists (select 1 from public.attempt_reports r where r.attempt_id = a.id)
   order by x.attempt_id, x.question_id, x.created_at desc, x.id;
$$;

-- What grading depends on: marks, negative marks, the correct options (and
-- their text, which fill-in-the-blank matching and the report use).
create or replace function public.adm_question_grading_key(p_question uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
           'points', qq.points, 'neg', coalesce(qa.negative_marks, 0), 'type', qq.question_type,
           'correct', coalesce((select jsonb_agg(jsonb_build_array(o.id, o.option_text) order by o.id)
                                  from public.quiz_question_options o where o.question_id = qq.id and o.is_correct), '[]'::jsonb))
    from public.quiz_questions qq
    left join public.quiz_question_admin qa on qa.question_id = qq.id
   where qq.id = p_question;
$$;

-- Rebuilds one stored report (the format adm_finalize_attempt writes, see
-- docs/STUDENT_RPC_CONTRACT.md) from the re-graded answers, the attempt's new
-- score and the current questions / options. Keeps every key; adds
-- 'regraded_at'.
create or replace function public.adm_rebuild_attempt_report(p_report jsonb, p_attempt uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  a        record;
  qz       record;
  v_reveal boolean;
  v_rows   jsonb;
  v_cmp    record;
  v_rank   int;
  v_lower  int;
  v_report jsonb;
begin
  select x.* into a from public.quiz_attempts x where x.id = p_attempt;
  select q.passing_score, coalesce(q.show_answers_after, 'submission') as show into qz from public.quizzes q where q.id = a.quiz_id;
  v_reveal := case qz.show when 'never' then false when 'passing' then coalesce(a.passed, false) else true end;

  -- question rows with the hidden parts (_correct_answer, _options, _explanation)
  select coalesce(jsonb_agg(
           e.r || jsonb_build_object(
             'text', coalesce(qq.question_text, e.r ->> 'text'),
             'status', case when ans.id is null then e.r ->> 'status'
                            when ans.is_correct then 'correct'
                            when ans.is_correct is null then 'pending'
                            when cardinality(ans.sel) = 0 and nullif(btrim(coalesce(ans.answer_text, '')), '') is null then 'skipped'
                            else 'incorrect' end,
             'points', coalesce(qq.points, (e.r ->> 'points')::numeric),
             'negative_marks', coalesce(qa.negative_marks, (e.r ->> 'negative_marks')::numeric, 0),
             'points_earned', case when ans.id is null then e.r -> 'points_earned' else to_jsonb(ans.points_earned) end,
             '_explanation', qq.explanation,
             '_correct_answer', case
                when qq.question_type in ('multiple_choice', 'true_false') then
                  (select string_agg(o.option_text, ', ' order by o.sort_order, o.id)
                     from public.quiz_question_options o where o.question_id = qq.id and o.is_correct)
                when qq.question_type = 'fill_in_blank' then
                  (select string_agg(o.option_text, ' / ' order by o.sort_order, o.id)
                     from public.quiz_question_options o where o.question_id = qq.id and o.is_correct)
                else
                  (select string_agg(o.option_text, ' / ' order by o.sort_order, o.id)
                     from public.quiz_question_options o
                    where o.question_id = qq.id and o.is_correct and o.option_text <> 'Manual grading: see rubric') end,
             '_options', case when qq.question_type in ('multiple_choice', 'true_false') then
                (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'text', o.option_text,
                                                              'selected', o.id::text in (select jsonb_array_elements_text(e.r -> 'selected_option_ids')),
                                                              'is_correct', o.is_correct)
                                           order by o.sort_order, o.id), '[]'::jsonb)
                   from public.quiz_question_options o where o.question_id = qq.id)
                else '[]'::jsonb end)
           order by e.ord), '[]'::jsonb)
    into v_rows
    from jsonb_array_elements(coalesce(p_report -> 'questions', '[]'::jsonb)) with ordinality as e(r, ord)
    left join public.quiz_questions qq on qq.id = (e.r ->> 'question_id')::uuid
    left join public.quiz_question_admin qa on qa.question_id = qq.id
    left join lateral (select x.id, x.answer_text, x.is_correct, x.points_earned,
                              coalesce((select array_agg(distinct s::text) from unnest(x.selected_option_ids) s), '{}'::text[]) as sel
                         from public.quiz_answers x
                        where x.attempt_id = p_attempt and x.question_id = qq.id
                        order by x.created_at desc, x.id limit 1) ans on true;

  select count(*) as n, round(avg(x.percentage), 2) as avg_pct, max(x.percentage) as top_pct,
         round(avg(x.score), 2) as avg_score, max(x.score) as top_score
    into v_cmp
    from public.quiz_attempts x
   where x.quiz_id = a.quiz_id and x.status in ('submitted', 'timed_out') and x.percentage is not null;
  select count(*) filter (where x.percentage > a.percentage) + 1, count(*) filter (where x.percentage < a.percentage)
    into v_rank, v_lower
    from public.quiz_attempts x
   where x.quiz_id = a.quiz_id and x.status in ('submitted', 'timed_out') and x.percentage is not null;

  v_report := p_report || jsonb_build_object(
    'summary', coalesce(p_report -> 'summary', '{}'::jsonb) || jsonb_build_object(
      'score', a.score,
      'max_score', a.max_score,
      'total_marks', (select coalesce(sum((r ->> 'points')::numeric), 0) from jsonb_array_elements(v_rows) r),
      'percentage', a.percentage,
      'passed', a.passed,
      'provisional', exists (select 1 from jsonb_array_elements(v_rows) r where r ->> 'status' = 'pending'),
      'correct_count', (select count(*) from jsonb_array_elements(v_rows) r where r ->> 'status' = 'correct'),
      'incorrect_count', (select count(*) from jsonb_array_elements(v_rows) r where r ->> 'status' = 'incorrect'),
      'skipped_count', (select count(*) from jsonb_array_elements(v_rows) r where r ->> 'status' = 'skipped'),
      'pending_count', (select count(*) from jsonb_array_elements(v_rows) r where r ->> 'status' = 'pending'),
      'pending_marks', (select coalesce(sum((r ->> 'points')::numeric), 0) from jsonb_array_elements(v_rows) r
                         where r ->> 'status' = 'pending'),
      'passing_percentage', qz.passing_score,
      'rank', v_rank,
      'total_attempts', v_cmp.n,
      'percentile', case when v_cmp.n > 1 then round(v_lower * 100.0 / (v_cmp.n - 1), 1) else 100 end,
      'class_average', coalesce(v_cmp.avg_pct, 0),
      'topper_percentage', coalesce(v_cmp.top_pct, 0),
      'answers_hidden', not v_reveal),
    'questions', (select coalesce(jsonb_agg(
                    (r - '_correct_answer' - '_options' - '_explanation') || jsonb_build_object(
                      'correct_answer', case when v_reveal then r -> '_correct_answer' else 'null'::jsonb end,
                      'explanation', case when v_reveal then r -> '_explanation' else 'null'::jsonb end,
                      'options', case when v_reveal then r -> '_options'
                                      else (select coalesce(jsonb_agg(o - 'is_correct'), '[]'::jsonb)
                                              from jsonb_array_elements(r -> '_options') o) end)
                    order by (r ->> 'position')::int), '[]'::jsonb)
                    from jsonb_array_elements(v_rows) r),
    'breakdowns', jsonb_build_object(
      'by_section', (select coalesce(jsonb_agg(b order by (b ->> 'position')::int, b ->> 'name'), '[]'::jsonb) from (
                       select jsonb_build_object('name', r ->> 'section', 'position', min((r ->> 'section_position')::int))
                              || public.adm_report_bucket(jsonb_agg(r)) as b
                         from jsonb_array_elements(v_rows) r group by r ->> 'section') x),
      'by_topic', (select coalesce(jsonb_agg(b order by b ->> 'name'), '[]'::jsonb) from (
                     select jsonb_build_object('name', r ->> 'topic') || public.adm_report_bucket(jsonb_agg(r)) as b
                       from jsonb_array_elements(v_rows) r group by r ->> 'topic') x),
      'by_difficulty', (select coalesce(jsonb_agg(b order by case b ->> 'name' when 'easy' then 1 when 'medium' then 2
                                                                                 when 'hard' then 3 else 4 end), '[]'::jsonb) from (
                          select jsonb_build_object('name', r ->> 'difficulty') || public.adm_report_bucket(jsonb_agg(r)) as b
                            from jsonb_array_elements(v_rows) r group by r ->> 'difficulty') x)),
    'comparison', jsonb_build_object(
      'your_percentage', a.percentage,
      'average_percentage', coalesce(v_cmp.avg_pct, 0),
      'topper_percentage', coalesce(v_cmp.top_pct, 0),
      'your_score', a.score,
      'average_score', coalesce(v_cmp.avg_score, 0),
      'topper_score', coalesce(v_cmp.top_score, 0),
      'difference_from_average', round(a.percentage - coalesce(v_cmp.avg_pct, 0), 2),
      'difference_from_topper', round(a.percentage - coalesce(v_cmp.top_pct, 0), 2)),
    'regraded_at', now());

  return v_report || jsonb_build_object(
    'strengths', (select coalesce(jsonb_agg(jsonb_build_object('topic', t ->> 'name', 'accuracy', (t ->> 'accuracy')::numeric)
                                            order by (t ->> 'accuracy')::numeric desc, t ->> 'name'), '[]'::jsonb)
                    from (select t from jsonb_array_elements(v_report #> '{breakdowns,by_topic}') t
                           where (t ->> 'graded')::int > 0 and (t ->> 'accuracy')::numeric >= 60
                           order by (t ->> 'accuracy')::numeric desc, t ->> 'name' limit 3) s),
    'weaknesses', (select coalesce(jsonb_agg(jsonb_build_object('topic', t ->> 'name', 'accuracy', (t ->> 'accuracy')::numeric)
                                             order by (t ->> 'accuracy')::numeric, t ->> 'name'), '[]'::jsonb)
                     from (select t from jsonb_array_elements(v_report #> '{breakdowns,by_topic}') t
                            where (t ->> 'graded')::int > 0 and (t ->> 'accuracy')::numeric < 60
                            order by (t ->> 'accuracy')::numeric, t ->> 'name' limit 3) s));
end $$;

-- Re-scores every finished attempt of the quiz that has a report from this
-- port, with the same rules as adm_finalize_attempt, in three statements
-- (answers, attempts, reports). Returns the number of attempts re-scored.
-- Attempts finished by the lead's own app (no attempt_reports row) are left
-- as they are.
create or replace function public.adm_regrade_quiz(p_quiz uuid) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_pass numeric;
  v_n    int;
begin
  select coalesce(q.passing_score, 0) into v_pass from public.quizzes q where q.id = p_quiz for update;
  perform 1 from public.quiz_attempts a
   where a.quiz_id = p_quiz and a.status in ('submitted', 'timed_out')
     and exists (select 1 from public.attempt_reports r where r.attempt_id = a.id)
   for update of a;

  -- 1. answers
  with qi as (
    select qq.id, qq.question_type, qq.points, coalesce(qa.negative_marks, 0) as neg,
           coalesce(qa.needs_manual_grading, false) or qq.question_type = 'short_answer' as manual,
           coalesce((select array_agg(o.id::text) from public.quiz_question_options o
                      where o.question_id = qq.id and o.is_correct), '{}'::text[]) as correct
      from public.quiz_questions qq
      left join public.quiz_question_admin qa on qa.question_id = qq.id
     where qq.quiz_id = p_quiz
  ),
  g as (
    select l.id, qi.points, qi.neg,
           case
             when cardinality(l.sel) = 0 and nullif(btrim(coalesce(l.answer_text, '')), '') is null then 'skipped'
             when qi.manual then 'pending'
             when qi.question_type in ('multiple_choice', 'true_false') then
               case when cardinality(qi.correct) > 0 and l.sel @> qi.correct and qi.correct @> l.sel then 'correct' else 'incorrect' end
             when qi.question_type = 'fill_in_blank' then
               case when exists (select 1 from public.quiz_question_options o
                                  where o.question_id = qi.id and o.is_correct
                                    and lower(btrim(o.option_text)) = lower(btrim(l.answer_text)))
                    then 'correct' else 'incorrect' end
             else 'pending' end as st
      from public.adm_attempt_latest_answers(p_quiz) l
      join qi on qi.id = l.question_id
  )
  update public.quiz_answers x
     set is_correct = case g.st when 'correct' then true when 'pending' then null else false end,
         points_earned = case g.st when 'correct' then g.points when 'incorrect' then -g.neg when 'skipped' then 0 end
    from g
   where x.id = g.id;

  -- 2. attempts
  with s as (
    select l.attempt_id,
           coalesce(sum(l.points_earned) filter (where l.is_correct is not null), 0) as score,
           coalesce(sum(qq.points) filter (where l.is_correct is not null), 0) as mx
      from public.adm_attempt_latest_answers(p_quiz) l
      join public.quiz_questions qq on qq.id = l.question_id
     group by l.attempt_id
  )
  update public.quiz_attempts a
     set score = s.score,
         max_score = s.mx,
         percentage = case when s.mx > 0 then greatest(round(s.score * 100.0 / s.mx, 2), 0) else 0 end,
         passed = (case when s.mx > 0 then greatest(round(s.score * 100.0 / s.mx, 2), 0) else 0 end) >= v_pass
    from s
   where a.id = s.attempt_id;
  get diagnostics v_n = row_count;

  -- 3. reports
  update public.attempt_reports r
     set report = public.adm_rebuild_attempt_report(r.report, r.attempt_id)
    from public.quiz_attempts a
   where a.id = r.attempt_id and a.quiz_id = p_quiz and a.status in ('submitted', 'timed_out');

  if v_n > 0 then
    perform public.adm_audit('test.regrade', 'quiz', p_quiz, null, jsonb_build_object('attempts', v_n), null);
  end if;
  return v_n;
end $$;

-- Edits an answered question's options without replacing them (their ids are
-- in students' answers): the n-th desired option (adm_question_options order)
-- updates the n-th existing one. Adding or removing options is refused.
create or replace function public.adm_update_options_in_place(p_question uuid, p_lead text, q jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_new int;
  v_old int;
begin
  select count(*) into v_new from public.adm_question_options(p_lead, q);
  select count(*) into v_old from public.quiz_question_options where question_id = p_question;
  if v_new <> v_old then
    raise exception 'Students have answered this question, so options can''t be added or removed. You can still change their text and which ones are correct.'
      using errcode = '22023';
  end if;
  if not exists (select 1 from public.adm_question_options(p_lead, q) d where d.is_correct) then
    raise exception 'Mark at least one option as correct.' using errcode = '22023';
  end if;
  update public.quiz_question_options o
     set option_text = d.option_text, is_correct = d.is_correct
    from (select x.id, row_number() over (order by x.sort_order, x.id) as rn
            from public.quiz_question_options x where x.question_id = p_question) e
    join (select y.option_text, y.is_correct, row_number() over (order by y.sort_order) as rn
            from public.adm_question_options(p_lead, q) y) d on d.rn = e.rn
   where o.id = e.id;
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_series_review_json(uuid) from public, anon, authenticated;
revoke all on function public.adm_actor_kind() from public, anon;
grant execute on function public.adm_actor_kind() to authenticated;   -- describes the caller only
revoke all on function public.adm_educator_series_ids() from public, anon, authenticated;
revoke all on function public.adm_can_create_series() from public, anon, authenticated;
revoke all on function public.adm_can_manage_series(uuid) from public, anon, authenticated;
revoke all on function public.adm_require_author() from public, anon, authenticated;
revoke all on function public.adm_require_series_access(uuid, boolean) from public, anon, authenticated;
revoke all on function public.adm_require_series_access_or_new(uuid) from public, anon, authenticated;
revoke all on function public.adm_require_series_owner(uuid) from public, anon, authenticated;
revoke all on function public.adm_series_is_independent_educator(uuid) from public, anon, authenticated;
revoke all on function public.adm_attempt_latest_answers(uuid) from public, anon, authenticated;
revoke all on function public.adm_question_grading_key(uuid) from public, anon, authenticated;
revoke all on function public.adm_rebuild_attempt_report(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.adm_regrade_quiz(uuid) from public, anon, authenticated;
revoke all on function public.adm_update_options_in_place(uuid, text, jsonb) from public, anon, authenticated;
