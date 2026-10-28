-- Trial for the educator test series files ONLY:
--   20261028100000_educator_series_preflight.sql
--   20261028100100_educator_series_access.sql
--   20261028100200_educator_series_guards.sql
--   20261028100300_educator_series_approval.sql
--   20261028100400_educator_series_portal.sql
-- Apply after the educator onboarding files (20261028090*).
-- Paste all of it into the SQL editor and run: expect "Success. No rows returned".
-- Everything is rolled back (the last line of this file is "rollback;").
begin;

-- =====================================================================
-- 20261028100000_educator_series_preflight.sql
--
-- Purpose
--   Read-only checks before 20261028100100..100400 (educators on the shared
--   test series RPCs). Collects every problem and raises once. Writes nothing.
--     * the educator onboarding files (20261028090*) and the fast publish
--       file (20261027110000) are applied;
--     * the functions 20261028100200 replaces exist (ours);
--     * our tables / columns used exist, the status CHECK name is the one we
--       replace, the new columns don't exist yet;
--     * none of the new function names exist.
--
-- ROLLBACK
--   Nothing to roll back.
-- =====================================================================
set search_path = public, extensions;

do $pre$
declare
  v_problems text[] := '{}';
  v_list     text[];
begin
  select coalesce(array_agg(x.sig order by x.sig), '{}') into v_list
    from unnest(array[
      -- prerequisites
      'public.adm_is_verified_educator()', 'public.adm_require_verified_educator()', 'public.adm_is_platform_admin()',
      'public.adm_require_admin()', 'public.adm_audit(text,text,uuid,jsonb,jsonb,text)', 'public.adm_series_rows()',
      'public.adm_series_publish_problem(uuid)', 'public.adm_question_options(text,jsonb)', 'public.adm_question_is_subjective(uuid)',
      'public.adm_report_bucket(jsonb)', 'public.adm_assignment_rows()', 'public.adm_asg_log(uuid,text,text)',
      'public.adm_test_json(uuid)', 'public.adm_question_json(uuid)', 'public.adm_series_students()',
      'public.adm_sync_series_to_lead(uuid)', 'public.adm_educator_validate(jsonb,integer)', 'public.adm_educator_clean(jsonb,integer)',
      -- replaced by 20261028100200
      'public.get_test_series_stats()', 'public.list_test_series(text,text,text,text,integer,integer)',
      'public.get_test_series(uuid)', 'public.series_name_exists(text,uuid)', 'public.create_test_series(jsonb)',
      'public.update_test_series(uuid,jsonb)', 'public.delete_test_series(uuid)', 'public.duplicate_test_series(uuid)',
      'public.save_wizard_draft(uuid,jsonb)', 'public.discard_wizard_draft(uuid)', 'public.upsert_test_series_full(jsonb,boolean)',
      'public.set_test_status(uuid,text)', 'public.create_test(uuid,jsonb)', 'public.update_test(uuid,jsonb)',
      'public.delete_test(uuid)', 'public.duplicate_test(uuid)', 'public.create_test_section(uuid,jsonb)',
      'public.update_test_section(uuid,jsonb)', 'public.delete_test_section(uuid)', 'public.create_question(uuid,jsonb)',
      'public.update_question(uuid,jsonb)', 'public.delete_question(uuid)', 'public.create_question_option(uuid,jsonb)',
      'public.update_question_option(uuid,jsonb)', 'public.delete_question_option(uuid)',
      'public.adm_new_house_series(text,text,text)', 'public.adm_publish_test_series(uuid,boolean)'
    ]) as x(sig)
   where to_regprocedure(x.sig) is null;
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('missing functions (apply 20261027110000 and 20261028090* first?): ' || array_to_string(v_list, ', '));
  end if;

  select coalesce(array_agg(x.t || '.' || x.c order by x.t, x.c), '{}') into v_list
    from (values ('test_series_admin', 'created_by'), ('test_series_admin', 'status'), ('test_series_admin', 'deleted_at'),
                 ('test_assignments', 'educator_id'), ('test_assignments', 'series_id'), ('test_assignments', 'test_id'),
                 ('test_assignments', 'status'), ('assignment_comments', 'question_id'), ('assignment_history', 'note'),
                 ('attempt_reports', 'report'), ('quiz_answers', 'selected_option_ids'), ('quiz_answers', 'points_earned'),
                 ('test_feedback', 'rating'), ('notifications', 'reference_type')) as x(t, c)
   where not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = x.t and column_name = x.c);
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('missing columns: ' || array_to_string(v_list, ', '));
  end if;

  if not exists (select 1 from pg_constraint where conrelid = to_regclass('public.test_series_admin')
                    and conname = 'test_series_admin_status_check') then
    v_problems := v_problems || 'missing constraint test_series_admin_status_check'::text;
  end if;
  select coalesce(array_agg(c order by c), '{}') into v_list
    from unnest(array['origin', 'rejection_reason', 'submitted_at', 'approved_by', 'approved_at']) c
   where exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'test_series_admin' and column_name = c);
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('test_series_admin columns already exist: ' || array_to_string(v_list, ', '));
  end if;

  select coalesce(array_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' order by p.proname), '{}')
    into v_list
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in (
       'adm_actor_kind', 'adm_educator_series_ids', 'adm_can_create_series', 'adm_can_manage_series', 'adm_require_author',
       'adm_require_series_access', 'adm_require_series_access_or_new', 'adm_require_series_owner',
       'adm_series_is_independent_educator', 'adm_attempt_latest_answers', 'adm_question_grading_key',
       'adm_rebuild_attempt_report', 'adm_regrade_quiz', 'adm_update_options_in_place', 'adm_quiz_series',
       'adm_publish_series_core', 'adm_series_content_problem', 'adm_notify_series_decision', 'adm_educator_assignment_json',
       'educator_submit_series_for_approval', 'list_pending_series_approvals', 'approve_educator_series',
       'reject_educator_series', 'educator_list_assignments', 'educator_get_assignment', 'educator_start_assignment',
       'educator_add_assignment_comment', 'educator_get_profile', 'educator_update_profile', 'educator_get_stats',
       'educator_get_dashboard');
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('functions already exist: ' || array_to_string(v_list, ', '));
  end if;

  if cardinality(v_problems) > 0 then
    raise exception 'Educator series preflight: %', array_to_string(v_problems, '; ');
  end if;
end $pre$;

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

-- =====================================================================
-- 20261028100200_educator_series_guards.sql   (GENERATED by gen_educator_series.cjs; see PORT_PROGRESS)
--
-- Purpose
--   The shared test series RPCs become role-aware. SAME names, parameters and
--   result JSON; the only change in each body is its first line,
--   `perform public.adm_require_admin();`, replaced by one of the
--   20261028100100 guards (marked "-- 20261028100200"), plus the marked edits:
--     * list_test_series / get_test_series_stats: an educator sees only their
--       own and assigned series; list rows drop course_educator_id / created_by
--       for educators. list rows and get_test_series also carry origin,
--       rejection_reason, submitted_at and approved_at (adm_series_review_json).
--     * save_wizard_draft: also saves the wizard state of a 'rejected' series.
--     * set_test_status: an educator can't publish a test of their own
--       series before an admin approved it.
--     * update_question: an answered question's options are edited in place
--       (ids kept; adding / removing refused); a change to its marks,
--       negative marks or correct answer re-scores the quiz
--       (adm_regrade_quiz); the result has 'regraded_attempts'.
--     * update_question_option: the correct flag may change on an answered
--       question (re-scored); every edit is audited with before / after;
--       the result has 'regraded_attempts'.
--     * adm_new_house_series: origin = 'educator' when an educator creates it.
--     * adm_publish_test_series: the body moves unchanged (minus the admin
--       check) to adm_publish_series_core (also used by
--       approve_educator_series). The wrapper checks access, refuses to
--       publish an educator's own series (approval only) and completes the
--       caller's open assignment when an educator publishes an assigned series.
--   For an admin every function behaves exactly as before.
--
-- Guards used (20261028100100)
--   adm_require_author()                    create / name check / lists
--   adm_require_series_access(series, w)    everything series-scoped (w = writes)
--   adm_require_series_access_or_new(id)    wizard save (null = new series)
--   adm_require_series_owner(series)        delete, discard draft
--   adm_quiz_series(quiz)                   series of a test (new helper here)
--
-- ROLLBACK
--   scripts/rollback_20261028_educator_series.sql restores every function
--   below verbatim from the file named above it, and drops
--   adm_publish_series_core and adm_quiz_series.
-- =====================================================================
set search_path = public, extensions;

create or replace function public.adm_quiz_series(p_quiz uuid) returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select q.series_id from public.quizzes q where q.id = p_quiz;
$$;
revoke all on function public.adm_quiz_series(uuid) from public, anon, authenticated;

-- get_test_series_stats: from 20261025110500_admin_rpc_test_series.sql
create or replace function public.get_test_series_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_author();   -- 20261028100200: admin or verified educator
  return (
    with r as (select x.id from public.adm_series_rows() x
                 -- 20261028100200: an educator counts only their own and assigned series
                 where public.adm_is_platform_admin() or x.id in (select public.adm_educator_series_ids())),
         att as (select q.series_id, a.percentage
                   from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
                   join r on r.id = q.series_id
                  where a.status in ('submitted', 'timed_out'))
    select jsonb_build_object(
      'total_series',    (select count(*) from r),
      'total_enrolled',  (select count(*) from (select distinct st.series_id, st.student_id
                                                  from public.adm_series_students() st join r on r.id = st.series_id) e),
      'total_attempts',  (select count(*) from att),
      'avg_performance', coalesce((select round(avg(sa)) from (select avg(att.percentage) as sa from att group by att.series_id) z), 0)));
end $$;

-- list_test_series: from 20261025110500_admin_rpc_test_series.sql
create or replace function public.list_test_series(
  p_search text default null, p_status text default null, p_pricing text default null,
  p_timeline text default null, p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 10), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_author();   -- 20261028100200: admin or verified educator
  return query
  with base as (select b.* from public.adm_series_rows() b
                -- 20261028100200: an educator lists only their own and assigned series
                where public.adm_is_platform_admin() or b.id in (select public.adm_educator_series_ids())),
       cnt as (select q.series_id, count(*) as n from public.quizzes q where q.series_id is not null group by q.series_id),
       enr as (select st.series_id, count(distinct st.student_id) as n from public.adm_series_students() st group by st.series_id),
       att as (select q.series_id, count(*) as n, round(avg(a.percentage)) as av
                 from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
                where a.status in ('submitted', 'timed_out') group by q.series_id),
       f as (
         select b.*, coalesce(cnt.n, 0) as test_count, coalesce(enr.n, 0) as enrollments,
                coalesce(att.n, 0) as attempts, coalesce(att.av, 0) as avg_score
           from base b
           left join cnt on cnt.series_id = b.id
           left join enr on enr.series_id = b.id
           left join att on att.series_id = b.id
          where (v_like is null
                 or (b.title || ' ' || coalesce(b.subject_name, '') || ' ' || coalesce(b.audience, '') || ' ' || coalesce(b.code, '')) ilike v_like)
            and (p_status is null or p_status in ('', 'all') or b.status = p_status)
            and (p_pricing is null or p_pricing in ('', 'all')
                 or (p_pricing = 'free' and b.is_free) or (p_pricing = 'paid' and not b.is_free))
            and (p_timeline is null or p_timeline in ('', 'all') or b.timeline = p_timeline)
       )
  select (to_jsonb(f) - 'wizard_state'
          -- 20261028100200: no admin-side ids in an educator's rows
          - case when public.adm_is_platform_admin() then '' else 'course_educator_id' end
          - case when public.adm_is_platform_admin() then '' else 'created_by' end)
         || jsonb_build_object('icon_key', null::text)
         || public.adm_series_review_json(f.id),   -- 20261028100200: origin, rejection_reason, submitted_at, approved_at
         count(*) over ()
    from f
   order by f.created_at desc, f.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

-- get_test_series: from 20261025110500_admin_rpc_test_series.sql
create or replace function public.get_test_series(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v jsonb;
begin
  perform public.adm_require_series_access(p_id, false);   -- 20261028100200: admin or the series' educator
  v := public.adm_series_json(p_id) || public.adm_series_review_json(p_id);   -- 20261028100200: review fields
  if v is null then return null; end if;
  return v || jsonb_build_object('tests', coalesce((
    select jsonb_agg(public.adm_test_json(q.id) order by q.series_sort_order, q.created_at)
      from public.quizzes q where q.series_id = p_id), '[]'::jsonb));
end $$;

-- series_name_exists: from 20261027110000_admin_fast_publish.sql
create or replace function public.series_name_exists(p_name text, p_exclude uuid default null) returns boolean
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_author();   -- 20261028100200: admin or verified educator
  return public.adm_series_name_taken(p_name, p_exclude);
end $$;

-- create_test_series: from 20261025110500_admin_rpc_test_series.sql
create or replace function public.create_test_series(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id      uuid;
  v_name    text := nullif(btrim(coalesce(p ->> 'name', '')), '');
  v_subject text := nullif(btrim(coalesce(p ->> 'subject', '')), '');
  v_pricing text := case when p ->> 'pricing' = 'paid' then 'paid' else 'free' end;
  v_price   numeric;
begin
  perform public.adm_require_author();   -- 20261028100200: admin or verified educator
  if v_name is null then raise exception 'Series name is required.' using errcode = '22023'; end if;
  if exists (select 1 from public.adm_series_rows() r where lower(btrim(r.title)) = lower(v_name)) then
    raise exception 'A test series with this name already exists.' using errcode = '23505';
  end if;
  v_price := case when v_pricing = 'paid' then coalesce(nullif(p ->> 'price', '')::numeric, 0) else 0 end;
  if v_pricing = 'paid' and v_price <= 0 then
    raise exception 'Enter a price for a paid series.' using errcode = '22023';
  end if;

  v_id := public.adm_new_house_series(v_name, p ->> 'description', 'manual');
  update public.test_series set instructions = nullif(p ->> 'instructions', '') where id = v_id;
  update public.test_series_admin
     set audience            = nullif(btrim(coalesce(p ->> 'audience', '')), ''),
         pricing             = v_pricing,
         price_inr           = v_price,
         subject_category_id = public.adm_subject_category(v_subject),
         subject_label       = v_subject
   where series_id = v_id;

  perform public.adm_set_series_availability(v_id, nullif(p ->> 'startDate', '')::date, nullif(p ->> 'endDate', '')::date);
  perform public.adm_sync_series_to_lead(v_id);
  perform public.adm_audit('test_series.create', 'test_series', v_id, null, jsonb_build_object('title', v_name), null);
  return public.adm_series_json(v_id);
end $$;

-- update_test_series: from 20261025110500_admin_rpc_test_series.sql
create or replace function public.update_test_series(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  cur        public.test_series_admin;
  v_before   jsonb;
  v_name     text;
  v_subject  text;
  v_pricing  text;
  v_price    numeric;
  v_start    date;
  v_end      date;
  v_dates    boolean := p ? 'startDate' or p ? 'endDate';
begin
  perform public.adm_require_series_access(p_id, true);   -- 20261028100200: admin or the series' educator
  perform public.adm_require_series(p_id);
  perform public.adm_ensure_series_admin(p_id);
  select * into cur from public.test_series_admin where series_id = p_id for update;
  v_before := public.adm_series_json(p_id);

  if p ? 'name' then
    v_name := nullif(btrim(coalesce(p ->> 'name', '')), '');
    if v_name is null then raise exception 'Series name is required.' using errcode = '22023'; end if;
    if exists (select 1 from public.adm_series_rows() r where lower(btrim(r.title)) = lower(v_name) and r.id <> p_id) then
      raise exception 'A test series with this name already exists.' using errcode = '23505';
    end if;
    update public.test_series set title = left(v_name, 150), updated_at = now() where id = p_id;
  end if;
  if p ? 'description' then
    update public.test_series set description = nullif(p ->> 'description', ''), updated_at = now() where id = p_id;
  end if;
  if p ? 'instructions' then
    update public.test_series set instructions = nullif(p ->> 'instructions', ''), updated_at = now() where id = p_id;
  end if;

  v_pricing := case when p ? 'pricing' then case when p ->> 'pricing' = 'paid' then 'paid' else 'free' end else cur.pricing end;
  v_price   := case when v_pricing = 'free' then 0
                    when p ? 'price' then coalesce(nullif(p ->> 'price', '')::numeric, 0)
                    else cur.price_inr end;
  if v_pricing = 'paid' and v_price <= 0 then
    raise exception 'Enter a price for a paid series.' using errcode = '22023';
  end if;
  select case when p ? 'startDate' then nullif(p ->> 'startDate', '')::date else r.start_date end,
         case when p ? 'endDate' then nullif(p ->> 'endDate', '')::date else r.end_date end
    into v_start, v_end
    from public.adm_series_rows() r where r.id = p_id;
  v_subject := nullif(btrim(coalesce(p ->> 'subject', '')), '');

  update public.test_series_admin
     set audience            = case when p ? 'audience' then nullif(btrim(coalesce(p ->> 'audience', '')), '') else audience end,
         subject_category_id = case when p ? 'subject' then public.adm_subject_category(v_subject) else subject_category_id end,
         subject_label       = case when p ? 'subject' then v_subject else subject_label end,
         pricing             = v_pricing,
         price_inr           = v_price,
         status              = case when p ->> 'status' = 'draft' and status in ('published', 'scheduled') then 'draft' else status end
   where series_id = p_id;

  if v_dates then
    perform public.adm_set_series_availability(p_id, v_start, v_end);
  end if;
  perform public.adm_sync_series_to_lead(p_id);
  perform public.adm_audit(case when p ->> 'status' = 'draft' and cur.status in ('published', 'scheduled')
                                then 'test_series.unpublish' else 'test_series.update' end,
                           'test_series', p_id, v_before, public.adm_series_json(p_id), null);
  return public.adm_series_json(p_id);
end $$;

-- delete_test_series: from 20261025110500_admin_rpc_test_series.sql
create or replace function public.delete_test_series(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_series_owner(p_id);   -- 20261028100200: admin or the educator who created it
  perform public.adm_require_series(p_id);
  perform public.adm_ensure_series_admin(p_id);
  update public.test_series_admin set deleted_at = now() where series_id = p_id;
  perform public.adm_sync_series_to_lead(p_id);   -- is_active = false, is_published = false
  perform public.adm_audit('test_series.delete', 'test_series', p_id, null, null, null);
end $$;

-- duplicate_test_series: from 20261025110500_admin_rpc_test_series.sql
create or replace function public.duplicate_test_series(p_id uuid) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  src   record;
  v_new uuid;
  q     record;
  v_n   int := 0;
begin
  perform public.adm_require_series_access(p_id, false);   -- 20261028100200: admin or the series' educator
  perform public.adm_require_series(p_id);
  select r.* into src from public.adm_series_rows() r where r.id = p_id;

  v_new := public.adm_new_house_series(left(src.title || ' (Copy)', 150), src.about, 'duplicate');
  update public.test_series set instructions = src.instructions where id = v_new;
  update public.test_series_admin
     set who_for = src.who_for, audience = src.audience, syllabus = src.syllabus,
         pricing = src.pricing, price_inr = src.price_inr,
         subject_category_id = src.subject_category_id, subject_label = src.subject_name,
         grade = src.grade, exam = src.exam, level = src.level, languages = coalesce(src.languages, '{}'),
         monthly_limit = src.monthly_limit, access_days = src.access_days,
         late_allowed = coalesce(src.late_allowed, false) and src.late_grace_minutes is not null,
         late_grace_minutes = src.late_grace_minutes
   where series_id = v_new;

  for q in select x.id from public.quizzes x where x.series_id = p_id order by x.series_sort_order, x.created_at loop
    v_n := v_n + 1;
    perform public.adm_copy_quiz(q.id, v_new, v_n, null);
  end loop;

  -- Copy the source window unless it is invalid (then the copy is undated).
  update public.test_series n
     set available_from = o.available_from, available_until = o.available_until
    from public.test_series o
   where n.id = v_new and o.id = p_id
     and (o.available_from is null or o.available_until is null or o.available_until > o.available_from);
  perform public.adm_sync_series_to_lead(v_new);
  perform public.adm_audit('test_series.duplicate', 'test_series', v_new, null, jsonb_build_object('source', p_id), null);
  return v_new;
end $$;

-- save_wizard_draft: from 20261025110500_admin_rpc_test_series.sql
create or replace function public.save_wizard_draft(p_id uuid, p_state jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id     uuid := p_id;
  v_name   text := nullif(btrim(coalesce(p_state ->> 'name', '')), '');
  v_method text := nullif(p_state ->> 'startMethod', '');
begin
  perform public.adm_require_series_access_or_new(p_id);   -- 20261028100200
  if v_method not in ('scratch', 'duplicate', 'csv', 'ai', 'manual') then v_method := null; end if;
  if v_id is null then
    v_id := public.adm_new_house_series(coalesce(v_name, 'Untitled series'), nullif(p_state ->> 'about', ''), v_method);
    update public.test_series_admin set wizard_state = p_state where series_id = v_id;
  else
    perform public.adm_require_series(v_id);
    perform public.adm_ensure_series_admin(v_id);
    update public.test_series_admin
       set wizard_state = p_state, start_method = coalesce(v_method, start_method)
     where series_id = v_id and status in ('draft', 'rejected');   -- 20261028100200: a rejected series is edited again
    if found and v_name is not null then
      update public.test_series set title = left(v_name, 150), updated_at = now() where id = v_id;
    end if;
  end if;
  return v_id;
end $$;

-- discard_wizard_draft: from 20261025110500_admin_rpc_test_series.sql
create or replace function public.discard_wizard_draft(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_series_owner(p_id);   -- 20261028100200
  update public.test_series_admin set deleted_at = now()
   where series_id = p_id and status = 'draft' and deleted_at is null;
  if found then
    perform public.adm_sync_series_to_lead(p_id);
  end if;
end $$;

-- upsert_test_series_full: from 20261027110000_admin_fast_publish.sql
create or replace function public.upsert_test_series_full(p jsonb, p_publish boolean default false) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  sid       uuid := nullif(p ->> 'id', '')::uuid;
  c         jsonb := coalesce(p -> 'classification', '{}'::jsonb);
  a         jsonb := coalesce(p -> 'availability', '{}'::jsonb);
  l         jsonb := coalesce(p -> 'lateSubmissions', '{}'::jsonb);
  v_name    text := nullif(btrim(coalesce(p ->> 'name', '')), '');
  v_subject text := nullif(btrim(coalesce(c ->> 'subject', '')), '');
  v_method  text := nullif(p ->> 'startMethod', '');
  v_pricing text := case when p ->> 'pricing' = 'paid' then 'paid' else 'free' end;
  v_price   numeric;
  v_mode    text := case when a ->> 'mode' = 'window' then 'window' else 'always' end;
  v_golive  text := case when a ->> 'goLive' = 'schedule' then 'schedule' else 'now' end;
  v_source  text;
  v_langs   text[];
  v_course  uuid;
  v_quiz    uuid;
  t         jsonb;
  tpos      int;
  v_tests   int := 0;
begin
  perform public.adm_require_series_access_or_new(nullif(p ->> 'id', '')::uuid);   -- 20261028100200
  if v_name is null then raise exception 'Series name is required.' using errcode = '22023'; end if;
  if v_method not in ('scratch', 'duplicate', 'csv', 'ai', 'manual') then v_method := null; end if;
  v_source := case v_method when 'csv' then 'csv' when 'ai' then 'ai' when 'duplicate' then 'duplicate' else 'manual' end;
  v_price := case when v_pricing = 'paid' then coalesce(nullif(p ->> 'price', '')::numeric, 0) else 0 end;
  if v_pricing = 'paid' and v_price <= 0 then
    raise exception 'Enter a price for a paid series.' using errcode = '22023';
  end if;
  -- Two saves with the same name (a double click on a new series) wait for
  -- each other, so the second one sees the first one's series.
  perform pg_advisory_xact_lock(hashtextextended('adm_series_name:' || lower(v_name), 0));
  if public.adm_series_name_taken(v_name, sid) then
    raise exception 'A test series with this name already exists.' using errcode = '23505';
  end if;
  select coalesce(array_agg(btrim(x)) filter (where btrim(x) <> ''), '{}') into v_langs
    from jsonb_array_elements_text(case when jsonb_typeof(c -> 'languages') = 'array' then c -> 'languages' else '[]'::jsonb end) x;

  if sid is null then
    sid := public.adm_new_house_series(v_name, p ->> 'about', v_method);
  else
    perform public.adm_require_series(sid);
    -- The row lock makes concurrent saves of this series run one after the other.
    select course_id into v_course from public.test_series where id = sid for update;
    if v_course is distinct from public.adm_house_course_id() then
      raise exception 'This series belongs to a course; edit its tests individually instead of replacing them.' using errcode = '22023';
    end if;
    if exists (select 1 from public.quiz_attempts qat join public.quizzes qz on qz.id = qat.quiz_id where qz.series_id = sid) then
      raise exception 'This series already has attempts; edit tests and questions individually instead of replacing them.' using errcode = '22023';
    end if;
    perform public.adm_ensure_series_admin(sid);
    update public.test_series set title = left(v_name, 150), description = nullif(p ->> 'about', ''), updated_at = now()
     where id = sid;
    perform public.adm_delete_series_quizzes(sid);
  end if;
  if p ? 'instructions' then
    update public.test_series set instructions = nullif(p ->> 'instructions', '') where id = sid;
  end if;

  update public.test_series_admin set
    who_for             = nullif(p ->> 'whoFor', ''),
    audience            = nullif(btrim(coalesce(p ->> 'audience', '')), ''),
    syllabus            = nullif(p ->> 'syllabus', ''),
    start_method        = coalesce(v_method, start_method),
    pricing             = v_pricing,
    price_inr           = v_price,
    subject_category_id = public.adm_subject_category(v_subject),
    subject_label       = v_subject,
    grade               = nullif(c ->> 'grade', ''),
    exam                = nullif(c ->> 'exam', ''),
    level               = nullif(c ->> 'difficulty', ''),
    languages           = v_langs,
    go_live_mode        = v_golive,
    go_live_at          = case when v_golive = 'schedule' then nullif(a ->> 'goLiveAt', '')::timestamptz end,
    monthly_limit      = case when coalesce((a ->> 'monthlyLimited')::boolean, false) then nullif(a ->> 'monthlyLimit', '')::int end,
    access_days         = case when coalesce((a ->> 'accessLimited')::boolean, false) then nullif(a ->> 'accessDays', '')::int end,
    late_allowed        = coalesce((l ->> 'allowed')::boolean, false),
    late_grace_minutes  = case when coalesce((l ->> 'allowed')::boolean, false) then nullif(l ->> 'graceMinutes', '')::int end,
    build_deadline      = nullif(p ->> 'buildDeadline', '')::date,
    wizard_state        = p -> 'wizardState'
  where series_id = sid;
  -- Window dates go to test_series.available_from / available_until (after
  -- go_live_* is saved, which can push available_from later).
  perform public.adm_set_series_availability(sid,
    case when v_mode = 'window' then nullif(a ->> 'openAt', '')::date end,
    case when v_mode = 'window' then nullif(a ->> 'closeAt', '')::date end);

  select course_id into v_course from public.test_series where id = sid;
  for t, tpos in
    select e.t, e.ord
      from jsonb_array_elements(case when jsonb_typeof(p -> 'tests') = 'array' then p -> 'tests' else '[]'::jsonb end)
           with ordinality as e(t, ord)
  loop
    v_tests := tpos;
    insert into public.quizzes (course_id, series_id, series_sort_order, title)
    values (v_course, sid, tpos, left(coalesce(nullif(btrim(coalesce(t ->> 'name', '')), ''), 'Test ' || tpos), 200))
    returning id into v_quiz;
    perform public.adm_apply_test_fields(v_quiz, t - 'name');

    insert into public.test_sections (quiz_id, position, name, instructions, planned_questions, planned_marks)
    select v_quiz, e.ord, coalesce(nullif(btrim(coalesce(e.s ->> 'name', '')), ''), 'Section ' || e.ord), e.s ->> 'instructions',
           nullif(e.s ->> 'questionCount', '')::int, nullif(e.s ->> 'marks', '')::numeric
      from jsonb_array_elements(case when jsonb_typeof(t -> 'sections') = 'array' then t -> 'sections' else '[]'::jsonb end)
           with ordinality as e(s, ord);

    perform public.adm_insert_questions_bulk(v_quiz, t -> 'questions', v_source);
  end loop;

  perform public.adm_sync_series_to_lead(sid);
  perform public.adm_audit('test_series.wizard_save', 'test_series', sid, null,
                           jsonb_build_object('tests', v_tests, 'publish', coalesce(p_publish, false)), null);
  if coalesce(p_publish, false) then
    perform public.adm_publish_test_series(sid, true);
  end if;
  return sid;
end $$;

-- set_test_status: from 20261025110600_admin_rpc_tests_questions.sql
create or replace function public.set_test_status(p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_msg text;
  v_old text;
begin
  perform public.adm_require_series_access(public.adm_quiz_series(p_id), true);   -- 20261028100200: admin or the series' educator
  -- 20261028100200: an educator's own series is published through approval
  if p_status = 'published' and not public.adm_is_platform_admin()
     and public.adm_series_is_independent_educator(public.adm_quiz_series(p_id))
     and coalesce((select sa.status from public.test_series_admin sa where sa.series_id = public.adm_quiz_series(p_id)), 'draft') <> 'published' then
    raise exception 'Submit the series for approval; its tests are published when an admin approves it.' using errcode = '42501';
  end if;
  perform public.adm_require_quiz(p_id);
  if p_status not in ('draft', 'published') then
    raise exception 'Unknown test status: %', p_status using errcode = '22023';
  end if;
  if p_status = 'published' then
    v_msg := public.adm_validate_quiz_for_publish(p_id);
    if v_msg is not null then raise exception '%', v_msg using errcode = '22023'; end if;
  end if;
  insert into public.quiz_admin (quiz_id) values (p_id) on conflict (quiz_id) do nothing;
  select status into v_old from public.quiz_admin where quiz_id = p_id for update;
  update public.quiz_admin set status = p_status where quiz_id = p_id;
  if p_status = 'published' then
    perform public.adm_complete_assignments_for_quiz(p_id);
  end if;
  perform public.adm_audit('test.' || case when p_status = 'published' then 'publish' else 'unpublish' end,
                           'quiz', p_id, jsonb_build_object('status', v_old), jsonb_build_object('status', p_status), null);
  return public.adm_test_json(p_id);
end $$;

-- create_test: from 20261025110600_admin_rpc_tests_questions.sql
create or replace function public.create_test(p_series_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_course uuid;
  v_pos    int;
  v_quiz   uuid;
  q        jsonb;
  qpos     int := 0;
begin
  perform public.adm_require_series_access(p_series_id, true);   -- 20261028100200: admin or the series' educator
  perform public.adm_require_series(p_series_id);
  if nullif(btrim(coalesce(p ->> 'name', '')), '') is null then
    raise exception 'Test name is required.' using errcode = '22023';
  end if;
  select course_id into v_course from public.test_series where id = p_series_id;
  select coalesce(max(series_sort_order), 0) + 1 into v_pos from public.quizzes where series_id = p_series_id;

  insert into public.quizzes (course_id, series_id, series_sort_order, title)
  values (v_course, p_series_id, v_pos, left(btrim(p ->> 'name'), 200))
  returning id into v_quiz;
  perform public.adm_apply_test_fields(v_quiz, p - 'status' - 'questions');

  for q in select * from jsonb_array_elements(case when jsonb_typeof(p -> 'questions') = 'array' then p -> 'questions' else '[]'::jsonb end) loop
    if public.adm_insert_question(v_quiz, qpos + 1, q - 'id', null, 'manual') is not null then
      qpos := qpos + 1;
    end if;
  end loop;

  perform public.adm_audit('test.create', 'quiz', v_quiz, null, jsonb_build_object('series_id', p_series_id, 'title', p ->> 'name'), null);
  if p ->> 'status' = 'published' then
    return public.set_test_status(v_quiz, 'published');
  end if;
  return public.adm_test_json(v_quiz);
end $$;

-- update_test: from 20261025110600_admin_rpc_tests_questions.sql
create or replace function public.update_test(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_old text;
begin
  perform public.adm_require_series_access(public.adm_quiz_series(p_id), true);   -- 20261028100200: admin or the series' educator
  perform public.adm_require_quiz(p_id);
  perform public.adm_apply_test_fields(p_id, p - 'status' - 'questions');
  select coalesce(qa.status, 'draft') into v_old from public.quiz_admin qa where qa.quiz_id = p_id;
  perform public.adm_audit('test.update', 'quiz', p_id, null, p - 'questions', null);
  if p ->> 'status' in ('draft', 'published') and p ->> 'status' is distinct from v_old then
    return public.set_test_status(p_id, p ->> 'status');
  end if;
  return public.adm_test_json(p_id);
end $$;

-- delete_test: from 20261025110600_admin_rpc_tests_questions.sql
create or replace function public.delete_test(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_series uuid;
begin
  perform public.adm_require_series_access(public.adm_quiz_series(p_id), true);   -- 20261028100200: admin or the series' educator
  v_series := public.adm_require_quiz(p_id);
  perform public.adm_delete_quiz(p_id);
  perform public.adm_audit('test.delete', 'quiz', p_id, jsonb_build_object('series_id', v_series), null, null);
end $$;

-- duplicate_test: from 20261025110600_admin_rpc_tests_questions.sql
create or replace function public.duplicate_test(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_series uuid;
  v_pos    int;
  v_title  text;
  v_new    uuid;
begin
  perform public.adm_require_series_access(public.adm_quiz_series(p_id), true);   -- 20261028100200: admin or the series' educator
  v_series := public.adm_require_quiz(p_id);
  select coalesce(max(series_sort_order), 0) + 1 into v_pos from public.quizzes where series_id = v_series;
  select title || ' (Copy)' into v_title from public.quizzes where id = p_id;
  v_new := public.adm_copy_quiz(p_id, v_series, v_pos, v_title);
  perform public.adm_audit('test.duplicate', 'quiz', v_new, null, jsonb_build_object('source', p_id), null);
  return public.adm_test_json(v_new);
end $$;

-- create_test_section: from 20261025110600_admin_rpc_tests_questions.sql
create or replace function public.create_test_section(p_test_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_pos int;
  r     public.test_sections;
begin
  perform public.adm_require_series_access(public.adm_quiz_series(p_test_id), true);   -- 20261028100200: admin or the series' educator
  perform public.adm_require_quiz(p_test_id);
  if nullif(btrim(coalesce(p ->> 'name', '')), '') is null then
    raise exception 'Section name is required.' using errcode = '22023';
  end if;
  v_pos := coalesce(nullif(p ->> 'position', '')::int,
                    (select coalesce(max(position), 0) + 1 from public.test_sections where quiz_id = p_test_id));
  insert into public.test_sections (quiz_id, position, name, instructions, planned_questions, planned_marks)
  values (p_test_id, v_pos, btrim(p ->> 'name'), nullif(p ->> 'instructions', ''),
          coalesce(nullif(p ->> 'planned_questions', ''), nullif(p ->> 'plannedQuestions', ''))::int,
          coalesce(nullif(p ->> 'planned_marks', ''), nullif(p ->> 'plannedMarks', ''))::numeric)
  returning * into r;
  return to_jsonb(r);
end $$;

-- update_test_section: from 20261025110600_admin_rpc_tests_questions.sql
create or replace function public.update_test_section(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r public.test_sections;
begin
  perform public.adm_require_series_access(public.adm_quiz_series((select quiz_id from public.test_sections where id = p_id)), true);   -- 20261028100200: admin or the series' educator
  perform public.adm_require_quiz((select quiz_id from public.test_sections where id = p_id));
  if p ? 'name' and nullif(btrim(coalesce(p ->> 'name', '')), '') is null then
    raise exception 'Section name is required.' using errcode = '22023';
  end if;
  update public.test_sections set
    name              = case when p ? 'name' then btrim(p ->> 'name') else name end,
    instructions      = case when p ? 'instructions' then nullif(p ->> 'instructions', '') else instructions end,
    position          = case when p ? 'position' then coalesce(nullif(p ->> 'position', '')::int, position) else position end,
    planned_questions = case when p ? 'planned_questions' then nullif(p ->> 'planned_questions', '')::int
                             when p ? 'plannedQuestions' then nullif(p ->> 'plannedQuestions', '')::int else planned_questions end,
    planned_marks     = case when p ? 'planned_marks' then nullif(p ->> 'planned_marks', '')::numeric
                             when p ? 'plannedMarks' then nullif(p ->> 'plannedMarks', '')::numeric else planned_marks end
  where id = p_id
  returning * into r;
  return to_jsonb(r);
end $$;

-- delete_test_section: from 20261025110600_admin_rpc_tests_questions.sql
create or replace function public.delete_test_section(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_series_access(public.adm_quiz_series((select quiz_id from public.test_sections where id = p_id)), true);   -- 20261028100200: admin or the series' educator
  perform public.adm_require_quiz((select quiz_id from public.test_sections where id = p_id));
  delete from public.test_sections where id = p_id;   -- questions keep their rows; section_id becomes null
end $$;

-- create_question: from 20261025110600_admin_rpc_tests_questions.sql
create or replace function public.create_question(p_test_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_pos     int;
  v_section uuid := coalesce(nullif(p ->> 'section_id', ''), nullif(p ->> 'sectionId', ''))::uuid;
  v_id      uuid;
begin
  perform public.adm_require_series_access(public.adm_quiz_series(p_test_id), true);   -- 20261028100200: admin or the series' educator
  perform public.adm_require_quiz(p_test_id);
  if v_section is not null and not exists (select 1 from public.test_sections where id = v_section and quiz_id = p_test_id) then
    raise exception 'Section does not belong to this test.' using errcode = '22023';
  end if;
  v_pos := coalesce(nullif(p ->> 'position', '')::int,
                    (select coalesce(max(sort_order), 0) + 1 from public.quiz_questions where quiz_id = p_test_id));
  v_id := public.adm_insert_question(p_test_id, v_pos, p, v_section, 'manual');
  if v_id is null then raise exception 'Question text is required.' using errcode = '22023'; end if;
  perform public.adm_audit('question.create', 'quiz_question', v_id, null, jsonb_build_object('test_id', p_test_id), null);
  return public.adm_question_json(v_id);
end $$;

-- update_question: from 20261027090000_admin_block_subjective.sql
create or replace function public.update_question(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_quiz        uuid;
  v_cur_lead    text;
  v_type        text;
  v_lead        text;
  v_answered    boolean;
  v_text        text;
  v_has_options boolean := jsonb_typeof(p -> 'options') = 'array' or p ? 'optionA' or p ? 'optionB';
  v_before      jsonb;
  v_key         jsonb;      -- 20261028100200
  v_regraded    int := 0;   -- 20261028100200
begin
  perform public.adm_require_series_access(public.adm_quiz_series((select quiz_id from public.quiz_questions where id = p_id)), true);   -- 20261028100200: admin or the series' educator
  select quiz_id, question_type into v_quiz, v_cur_lead from public.quiz_questions where id = p_id for update;
  if v_quiz is null then raise exception 'Question not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz(v_quiz);
  v_answered := exists (select 1 from public.quiz_answers where question_id = p_id);
  -- 20261027090000: existing subjective questions are read-only.
  if public.adm_question_is_subjective(p_id) then
    raise exception 'Short answer, long answer and subjective questions are coming soon and can''t be edited yet. Existing ones stay as they are; you can delete them.'
      using errcode = '22023';
  end if;
  v_before := public.adm_question_json(p_id);
  v_key := public.adm_question_grading_key(p_id);   -- 20261028100200

  if p ? 'type' then
    v_type := lower(btrim(coalesce(p ->> 'type', '')));
    v_lead := public.adm_map_question_type(v_type);
    if v_lead is null then raise exception 'Unsupported question type: %', v_type using errcode = '22023'; end if;
    perform public.adm_assert_question_type_allowed(v_type);
    if v_answered and v_lead <> v_cur_lead then
      raise exception 'Students have answered this question; its type cannot change.' using errcode = '22023';
    end if;
  end if;
  if p ? 'text' or p ? 'body' then
    v_text := nullif(btrim(coalesce(p ->> 'text', p ->> 'body', '')), '');
    if v_text is null then raise exception 'Question text is required.' using errcode = '22023'; end if;
  end if;

  update public.quiz_questions set
    question_text = coalesce(v_text, question_text),
    question_type = coalesce(v_lead, question_type),
    points        = case when p ? 'marks' then coalesce(nullif(p ->> 'marks', '')::numeric, points) else points end,
    explanation   = case when p ? 'explanation' then nullif(btrim(coalesce(p ->> 'explanation', '')), '') else explanation end,
    sort_order    = case when p ? 'position' then coalesce(nullif(p ->> 'position', '')::int, sort_order) else sort_order end
  where id = p_id;

  insert into public.quiz_question_admin (question_id, admin_type)
  values (p_id, public.adm_ui_question_type(v_cur_lead)) on conflict (question_id) do nothing;
  update public.quiz_question_admin set
    admin_type           = coalesce(v_type, admin_type),
    needs_manual_grading = case when v_type is not null then v_type in ('subjective', 'long_answer', 'descriptive') else needs_manual_grading end,
    negative_marks       = case when p ? 'negativeMarks' then greatest(coalesce(nullif(p ->> 'negativeMarks', '')::numeric, 0), 0)
                                when p ? 'negative_marks' then greatest(coalesce(nullif(p ->> 'negative_marks', '')::numeric, 0), 0)
                                else negative_marks end,
    difficulty           = case when lower(coalesce(p ->> 'difficulty', '')) in ('easy', 'medium', 'hard') then lower(p ->> 'difficulty') else difficulty end,
    subject              = case when p ? 'subject' then nullif(btrim(coalesce(p ->> 'subject', '')), '') else subject end,
    topic                = case when p ? 'topic' then nullif(btrim(coalesce(p ->> 'topic', '')), '') else topic end,
    image_path           = case when p ? 'image' then nullif(p ->> 'image', '')
                                when p ? 'image_path' then nullif(p ->> 'image_path', '') else image_path end,
    answer_instructions  = case when p ? 'answerInstructions' then nullif(p ->> 'answerInstructions', '')
                                when p ? 'rubric' then nullif(p ->> 'rubric', '')
                                when p ? 'answer_instructions' then nullif(p ->> 'answer_instructions', '') else answer_instructions end,
    section_id           = case when p ? 'section_id' then nullif(p ->> 'section_id', '')::uuid
                                when p ? 'sectionId' then nullif(p ->> 'sectionId', '')::uuid else section_id end
  where question_id = p_id;

  -- Options are replaced only when the payload carries option texts, when the
  -- question is (or became) a text-answer type, or when its accepted / model
  -- answer changed. Text-answer questions always get exactly one correct
  -- option (accepted answer, model answer or the manual-grading placeholder;
  -- see adm_insert_options), so they stay publishable under the lead's rule.
  if v_has_options or (v_lead is not null and v_lead not in ('multiple_choice', 'true_false'))
     or ((p ? 'correctAnswer' or p ? 'answer' or p ? 'modelAnswer' or p ? 'model_answer')
         and coalesce(v_lead, v_cur_lead) in ('fill_in_blank', 'short_answer')) then
    if v_answered then
      -- 20261028100200: answered: the same options are edited in place (their ids are in
      -- students' answers); adding or removing options is refused.
      perform public.adm_update_options_in_place(p_id, (select question_type from public.quiz_questions where id = p_id),
                                                 p || jsonb_build_object('type', (select admin_type from public.quiz_question_admin
                                                                                   where question_id = p_id)));
    else
      delete from public.quiz_question_options where question_id = p_id;
      perform public.adm_insert_options(p_id, (select question_type from public.quiz_questions where id = p_id),
                                        p || jsonb_build_object('type', (select admin_type from public.quiz_question_admin
                                                                          where question_id = p_id)));
    end if;
  end if;

  -- 20261028100200: marks or the correct answer changed on an answered question: re-score.
  if v_answered and public.adm_question_grading_key(p_id) is distinct from v_key then
    v_regraded := public.adm_regrade_quiz(v_quiz);
  end if;
  perform public.adm_audit('question.update', 'quiz_question', p_id, v_before, public.adm_question_json(p_id), null);
  return public.adm_question_json(p_id) || jsonb_build_object('regraded_attempts', v_regraded);
end $$;

-- delete_question: from 20261025110600_admin_rpc_tests_questions.sql
create or replace function public.delete_question(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_quiz uuid;
begin
  perform public.adm_require_series_access(public.adm_quiz_series((select quiz_id from public.quiz_questions where id = p_id)), true);   -- 20261028100200: admin or the series' educator
  select quiz_id into v_quiz from public.quiz_questions where id = p_id;
  if v_quiz is null then raise exception 'Question not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz(v_quiz);
  if exists (select 1 from public.quiz_answers where question_id = p_id) then
    raise exception 'Students have answered this question; it cannot be deleted.' using errcode = '23503';
  end if;
  delete from public.quiz_question_options where question_id = p_id;
  delete from public.quiz_questions where id = p_id;
  perform public.adm_audit('question.delete', 'quiz_question', p_id, jsonb_build_object('test_id', v_quiz), null, null);
end $$;

-- create_question_option: from 20261027090000_admin_block_subjective.sql
create or replace function public.create_question_option(p_question_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_quiz  uuid;
  v_label text := nullif(btrim(coalesce(p ->> 'label', p ->> 'text', p ->> 'option_text', '')), '');
  v_pos   int;
  v_id    uuid;
begin
  perform public.adm_require_series_access(public.adm_quiz_series((select quiz_id from public.quiz_questions where id = p_question_id)), true);   -- 20261028100200: admin or the series' educator
  select quiz_id into v_quiz from public.quiz_questions where id = p_question_id;
  if v_quiz is null then raise exception 'Question not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz(v_quiz);
  -- 20261027090000: existing subjective questions are read-only.
  if public.adm_question_is_subjective(p_question_id) then
    raise exception 'Short answer, long answer and subjective questions are coming soon and can''t be edited yet. Existing ones stay as they are; you can delete them.'
      using errcode = '22023';
  end if;
  if v_label is null then raise exception 'Option text is required.' using errcode = '22023'; end if;
  if exists (select 1 from public.quiz_answers where question_id = p_question_id) then
    raise exception 'Students have answered this question; options cannot be added.' using errcode = '22023';
  end if;
  v_pos := coalesce(nullif(p ->> 'position', '')::int,
                    (select coalesce(max(sort_order), 0) + 1 from public.quiz_question_options where question_id = p_question_id));
  insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
  values (p_question_id, v_label, coalesce((p ->> 'is_correct')::boolean, (p ->> 'isCorrect')::boolean, false), v_pos)
  returning id into v_id;
  return (select o.v from jsonb_array_elements(public.adm_question_json(p_question_id) -> 'options') as o(v)
           where o.v ->> 'id' = v_id::text);
end $$;

-- update_question_option: from 20261027090000_admin_block_subjective.sql
create or replace function public.update_question_option(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_question uuid;
  v_correct  boolean;
  v_new      boolean := coalesce((p ->> 'is_correct')::boolean, (p ->> 'isCorrect')::boolean);
  v_key      jsonb;      -- 20261028100200
  v_before   jsonb;      -- 20261028100200
  v_regraded int := 0;   -- 20261028100200
begin
  perform public.adm_require_series_access(public.adm_quiz_series((select qq.quiz_id from public.quiz_question_options o join public.quiz_questions qq on qq.id = o.question_id where o.id = p_id)), true);   -- 20261028100200: admin or the series' educator
  select question_id, is_correct into v_question, v_correct from public.quiz_question_options where id = p_id for update;
  if v_question is null then raise exception 'Option not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz((select quiz_id from public.quiz_questions where id = v_question));
  if public.adm_question_is_subjective(v_question) then
    raise exception 'Short answer, long answer and subjective questions are coming soon and can''t be edited yet. Existing ones stay as they are; you can delete them.'
      using errcode = '22023';
  end if;
  -- 20261028100200: an answered question may change its correct answer; it is re-scored below.
  v_key := public.adm_question_grading_key(v_question);
  v_before := public.adm_question_json(v_question);
  if (p ? 'label' or p ? 'text') and nullif(btrim(coalesce(p ->> 'label', p ->> 'text', '')), '') is null then
    raise exception 'Option text is required.' using errcode = '22023';
  end if;
  if v_new is false and (select question_type from public.quiz_questions where id = v_question) in ('fill_in_blank', 'short_answer') then
    raise exception 'A text-answer question keeps its answer option marked correct; edit its text instead.' using errcode = '22023';
  end if;
  update public.quiz_question_options set
    option_text = coalesce(nullif(btrim(coalesce(p ->> 'label', p ->> 'text', '')), ''), option_text),
    is_correct  = coalesce(v_new, is_correct),
    sort_order  = case when p ? 'position' then coalesce(nullif(p ->> 'position', '')::int, sort_order) else sort_order end
  where id = p_id;
  -- 20261028100200: re-score answered attempts, audit before / after
  if exists (select 1 from public.quiz_answers where question_id = v_question)
     and public.adm_question_grading_key(v_question) is distinct from v_key then
    v_regraded := public.adm_regrade_quiz((select quiz_id from public.quiz_questions where id = v_question));
  end if;
  perform public.adm_audit('question.option_update', 'quiz_question_option', p_id, v_before,
                           public.adm_question_json(v_question), null);
  return (select o.v || jsonb_build_object('regraded_attempts', v_regraded)
            from jsonb_array_elements(public.adm_question_json(v_question) -> 'options') as o(v)
           where o.v ->> 'id' = p_id::text);
end $$;

-- delete_question_option: from 20261025110600_admin_rpc_tests_questions.sql
create or replace function public.delete_question_option(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_question uuid;
begin
  perform public.adm_require_series_access(public.adm_quiz_series((select qq.quiz_id from public.quiz_question_options o join public.quiz_questions qq on qq.id = o.question_id where o.id = p_id)), true);   -- 20261028100200: admin or the series' educator
  select question_id into v_question from public.quiz_question_options where id = p_id;
  if v_question is null then raise exception 'Option not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz((select quiz_id from public.quiz_questions where id = v_question));
  if exists (select 1 from public.quiz_answers where question_id = v_question) then
    raise exception 'Students have answered this question; options cannot be removed.' using errcode = '23503';
  end if;
  if (select question_type from public.quiz_questions where id = v_question) in ('fill_in_blank', 'short_answer')
     and (select count(*) from public.quiz_question_options where question_id = v_question and is_correct and id <> p_id) = 0 then
    raise exception 'A text-answer question needs its answer option; edit it instead of deleting it.' using errcode = '22023';
  end if;
  delete from public.quiz_question_options where id = p_id;
end $$;

-- adm_new_house_series: from 20261025110400_admin_b2_authoring_helpers.sql
create or replace function public.adm_new_house_series(p_title text, p_about text, p_start_method text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_house uuid := public.adm_house_course_id();
  v_id    uuid;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
begin
  if v_house is null then
    raise exception 'The admin house course is not configured (platform_settings admin_house_course_id).' using errcode = 'P0001';
  end if;
  if v_title is null then
    raise exception 'Series name is required.' using errcode = '22023';
  end if;
  insert into public.test_series (course_id, title, description, is_active, is_published)
  values (v_house, left(v_title, 150), nullif(p_about, ''), true, false)
  returning id into v_id;
  insert into public.test_series_admin (series_id, status, start_method, created_by, origin)
  values (v_id, 'draft',
          case when p_start_method in ('scratch', 'duplicate', 'csv', 'ai', 'manual') then p_start_method end,
          auth.uid(),
          case when public.adm_is_platform_admin() then 'admin' else 'educator' end);   -- 20261028100200: origin
  return v_id;
end $$;

-- adm_publish_test_series: role-aware wrapper (20261028100200)
-- the 20261027110000 body, unchanged except the name and the removed admin check
create or replace function public.adm_publish_series_core(p_id uuid, p_publish boolean default true) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  s         public.test_series;
  v_publish boolean;
  v_live    boolean;
  v_status  text;
  v_msg     text;
  v_tests   int;
begin
  perform public.adm_require_series(p_id);
  perform public.adm_ensure_series_admin(p_id);
  select * into s from public.test_series where id = p_id for update;
  v_publish := coalesce(p_publish, true);
  select count(*) into v_tests from public.quizzes where series_id = p_id;

  if v_publish then
    if s.available_from is not null and s.available_until is not null and s.available_until <= s.available_from then
      raise exception 'The closing time must be after the opening time.' using errcode = '22023';
    end if;
    v_msg := public.adm_series_publish_problem(p_id);
    if v_msg is not null then raise exception '%', v_msg using errcode = '22023'; end if;
    if v_tests = 0 then
      raise exception 'Add at least one test before publishing.' using errcode = '22023';
    end if;
    select case when sa.go_live_mode = 'schedule' and sa.go_live_at > now() then 'scheduled' else 'published' end
      into v_status from public.test_series_admin sa where sa.series_id = p_id;
  else
    v_status := 'draft';
  end if;

  -- A future go-live keeps the lead's is_published = false ('scheduled');
  -- release_scheduled_series() flips it once go_live_at has passed.
  v_live := v_status = 'published';
  update public.test_series_admin
     set status = v_status,
         published_at = case when v_live then coalesce(published_at, now()) else published_at end
   where series_id = p_id;
  update public.test_series set is_published = v_live, updated_at = now() where id = p_id;

  if v_publish then
    insert into public.quiz_admin (quiz_id, status)
    select q.id, 'published' from public.quizzes q where q.series_id = p_id
    on conflict (quiz_id) do update set status = 'published';
  end if;
  if v_live then
    perform public.adm_complete_assignments_for_series(p_id);
  end if;

  perform public.adm_audit(case when v_status = 'scheduled' then 'test_series.schedule'
                                when v_publish then 'test_series.publish' else 'test_series.unpublish' end,
                           'test_series', p_id, jsonb_build_object('is_published', s.is_published),
                           jsonb_build_object('is_published', v_live, 'status', v_status), null);
  return jsonb_build_object('series_id', p_id, 'is_published', v_live, 'tests', v_tests, 'status', v_status);
end $$;

create or replace function public.adm_publish_test_series(p_id uuid, p_publish boolean default true) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v jsonb;
  n int;
begin
  perform public.adm_require_series_access(p_id, true);
  if coalesce(p_publish, true) and public.adm_series_is_independent_educator(p_id) then
    raise exception 'This series was created by an educator: it is published when an admin approves it (Submit for approval).'
      using errcode = '42501';
  end if;
  v := public.adm_publish_series_core(p_id, p_publish);
  -- An educator publishing an assigned series completes their open assignment on it.
  if not public.adm_is_platform_admin() and v ->> 'status' in ('published', 'scheduled') then
    with u as (
      update public.test_assignments a set status = 'completed'
       where a.series_id = p_id and a.educator_id = auth.uid()
         and a.status not in ('completed', 'cancelled', 'rejected')
      returning a.id
    )
    insert into public.assignment_history (assignment_id, action, by_user, note)
    select u.id, 'Completed', auth.uid(), 'Published by the educator.' from u;
    get diagnostics n = row_count;
    if n > 0 then
      perform public.adm_audit('assignment.complete', 'test_series', p_id, null, jsonb_build_object('assignments', n), null);
    end if;
  end if;
  return v;
end $$;

revoke all on function public.adm_publish_series_core(uuid, boolean) from public, anon, authenticated;
revoke all on function public.adm_publish_test_series(uuid, boolean) from public, anon;
grant execute on function public.adm_publish_test_series(uuid, boolean) to authenticated;

-- =====================================================================
-- 20261028100300_educator_series_approval.sql
--
-- Purpose
--   Approval workflow for series an educator creates on their own
--   (origin 'educator', no active assignment):
--     educator_submit_series_for_approval(p_series_id)          educator -> jsonb
--     list_pending_series_approvals(p_search, p_page, p_size)    admin -> (row_data, total_count)
--     approve_educator_series(p_series_id)                       admin -> jsonb (publish result)
--     reject_educator_series(p_series_id, p_reason)              admin -> jsonb
--   States (test_series_admin.status): draft | rejected -> pending_approval
--   -> published / scheduled (approve) | rejected (reject). While pending, the
--   educator can read but not change the series (adm_require_series_access).
--   Approve publishes through adm_publish_series_core, the same path as
--   adm_publish_test_series.
--   Decisions notify the educator in the lead's notifications (category
--   'moderation', reference_type 'educator_series'); skipped, never failing
--   the decision, if the lead's CHECK refuses it or the educator turned off
--   in-app 'moderation' notifications.
--
-- ROLLBACK (whole set: scripts/rollback_20261028_educator_series.sql)
--   drop function if exists public.reject_educator_series(uuid, text);
--   drop function if exists public.approve_educator_series(uuid);
--   drop function if exists public.list_pending_series_approvals(text, int, int);
--   drop function if exists public.educator_submit_series_for_approval(uuid);
--   drop function if exists public.adm_notify_series_decision(uuid, text, text);
--   drop function if exists public.adm_series_content_problem(uuid);
-- =====================================================================
set search_path = public, extensions;

-- The publish checks without publishing: window, every test has questions,
-- every question has a correct answer, at least one test, no subjective
-- question (20261027090000). Null when the series can be published.
create or replace function public.adm_series_content_problem(p_series uuid) returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  s     public.test_series;
  v_msg text;
begin
  select * into s from public.test_series where id = p_series;
  if s.available_from is not null and s.available_until is not null and s.available_until <= s.available_from then
    return 'The closing time must be after the opening time.';
  end if;
  v_msg := public.adm_series_publish_problem(p_series);
  if v_msg is not null then return v_msg; end if;
  if not exists (select 1 from public.quizzes where series_id = p_series) then
    return 'Add at least one test before publishing.';
  end if;
  select format('"%s" has a short answer, long answer or subjective question. They are coming soon; remove it first.', q.title)
    into v_msg
    from public.quizzes q join public.quiz_questions qq on qq.quiz_id = q.id
   where q.series_id = p_series and public.adm_question_is_subjective(qq.id)
   order by q.series_sort_order, q.created_at
   limit 1;
  return v_msg;
end $$;

create or replace function public.adm_notify_series_decision(p_series uuid, p_decision text, p_reason text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user  uuid;
  v_title text;
begin
  select sa.created_by, s.title into v_user, v_title
    from public.test_series_admin sa join public.test_series s on s.id = sa.series_id
   where sa.series_id = p_series;
  if v_user is null then return; end if;
  if exists (select 1 from public.notification_preferences np
              where np.user_id = v_user and np.category = 'moderation' and not np.in_app) then
    return;
  end if;
  begin
    insert into public.notifications (user_id, category, title, body, action_url, reference_type, reference_id)
    values (v_user, 'moderation',
            case when p_decision = 'approved' then 'Your test series is approved' else 'Your test series needs changes' end,
            left(case when p_decision = 'approved' then format('"%s" is now live for students.', v_title)
                      else format('"%s" was not approved. Reason: %s Edit it and submit it again.', v_title, coalesce(p_reason, '—')) end, 2000),
            '/teacher/test-series', 'educator_series', p_series);
  exception when check_violation or foreign_key_violation or not_null_violation then
    raise notice 'series decision notification skipped: %', sqlerrm;
  end;
end $$;

-- ------------------------------------------------------------ educator
create or replace function public.educator_submit_series_for_approval(p_series_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_status text;
  v_msg    text;
begin
  perform public.adm_require_verified_educator();
  perform public.adm_require_series_owner(p_series_id);   -- also refuses while pending
  if not public.adm_series_is_independent_educator(p_series_id) then
    raise exception 'This series is assigned to you by an admin: publish it directly instead.' using errcode = '22023';
  end if;
  select sa.status into v_status from public.test_series_admin sa where sa.series_id = p_series_id for update;
  if v_status not in ('draft', 'rejected') then
    raise exception 'Only a draft or a rejected series can be submitted (this one is %).', v_status using errcode = '22023';
  end if;
  v_msg := public.adm_series_content_problem(p_series_id);
  if v_msg is not null then raise exception '%', v_msg using errcode = '22023'; end if;

  update public.test_series_admin
     set status = 'pending_approval', submitted_at = now(), rejection_reason = null
   where series_id = p_series_id;
  perform public.adm_sync_series_to_lead(p_series_id);
  perform public.adm_audit('test_series.submit_for_approval', 'test_series', p_series_id,
                           jsonb_build_object('status', v_status), jsonb_build_object('status', 'pending_approval'), null);
  return jsonb_build_object('series_id', p_series_id, 'status', 'pending_approval', 'submitted_at', now());
end $$;

-- --------------------------------------------------------------- admin
create or replace function public.list_pending_series_approvals(
  p_search text default null, p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 10), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with f as (
    select s.id, s.title, sa.code, sa.submitted_at, sa.created_by as educator_id,
           coalesce(ep.full_name, p.full_name) as educator_name, p.email as educator_email,
           coalesce(cat.name, sa.subject_label) as subject_name, sa.audience, sa.pricing, sa.price_inr,
           (select count(*) from public.quizzes q where q.series_id = s.id) as test_count,
           (select count(*) from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id where q.series_id = s.id) as question_count,
           s.created_at
      from public.test_series_admin sa
      join public.test_series s on s.id = sa.series_id
      left join public.profiles p on p.id = sa.created_by
      left join public.educator_profiles ep on ep.user_id = sa.created_by
      left join public.categories cat on cat.id = sa.subject_category_id
     where sa.status = 'pending_approval' and sa.deleted_at is null
       and (v_like is null or (s.title || ' ' || coalesce(sa.code, '') || ' ' || coalesce(ep.full_name, p.full_name, '')
                               || ' ' || coalesce(p.email, '')) ilike v_like)
  )
  select to_jsonb(f), count(*) over ()
    from f
   order by f.submitted_at nulls last, f.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

create or replace function public.approve_educator_series(p_series_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_status text;
  v        jsonb;
begin
  perform public.adm_require_admin();
  select sa.status into v_status from public.test_series_admin sa
   where sa.series_id = p_series_id and sa.deleted_at is null for update;
  if v_status is null then raise exception 'Test series not found.' using errcode = 'P0002'; end if;
  if v_status <> 'pending_approval' then
    raise exception 'Only a series waiting for approval can be approved (this one is %).', v_status using errcode = '22023';
  end if;
  update public.test_series_admin set approved_by = auth.uid(), approved_at = now(), rejection_reason = null
   where series_id = p_series_id;
  v := public.adm_publish_series_core(p_series_id, true);   -- same path as adm_publish_test_series
  perform public.adm_audit('test_series.approve', 'test_series', p_series_id,
                           jsonb_build_object('status', v_status), jsonb_build_object('status', v ->> 'status'), null);
  perform public.adm_notify_series_decision(p_series_id, 'approved', null);
  return v;
end $$;

create or replace function public.reject_educator_series(p_series_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_status text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform public.adm_require_admin();
  if v_reason is null then raise exception 'A reason is required.' using errcode = '22023'; end if;
  select sa.status into v_status from public.test_series_admin sa
   where sa.series_id = p_series_id and sa.deleted_at is null for update;
  if v_status is null then raise exception 'Test series not found.' using errcode = 'P0002'; end if;
  if v_status <> 'pending_approval' then
    raise exception 'Only a series waiting for approval can be rejected (this one is %).', v_status using errcode = '22023';
  end if;
  update public.test_series_admin set status = 'rejected', rejection_reason = left(v_reason, 2000)
   where series_id = p_series_id;
  perform public.adm_sync_series_to_lead(p_series_id);
  perform public.adm_audit('test_series.reject', 'test_series', p_series_id,
                           jsonb_build_object('status', v_status), jsonb_build_object('status', 'rejected'), v_reason);
  perform public.adm_notify_series_decision(p_series_id, 'rejected', v_reason);
  return jsonb_build_object('series_id', p_series_id, 'status', 'rejected', 'rejection_reason', v_reason);
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_series_content_problem(uuid) from public, anon, authenticated;
revoke all on function public.adm_notify_series_decision(uuid, text, text) from public, anon, authenticated;
revoke all on function public.educator_submit_series_for_approval(uuid) from public, anon;
revoke all on function public.list_pending_series_approvals(text, int, int) from public, anon;
revoke all on function public.approve_educator_series(uuid) from public, anon;
revoke all on function public.reject_educator_series(uuid, text) from public, anon;
grant execute on function public.educator_submit_series_for_approval(uuid) to authenticated;
grant execute on function public.list_pending_series_approvals(text, int, int) to authenticated;
grant execute on function public.approve_educator_series(uuid) to authenticated;
grant execute on function public.reject_educator_series(uuid, text) to authenticated;

-- =====================================================================
-- 20261028100400_educator_series_portal.sql
--
-- Purpose
--   Teacher-portal RPCs for VERIFIED educators. Every function starts with
--   `perform public.adm_require_verified_educator();` (enforcement rule,
--   checked by supabase/tests/educator_onboarding.sql):
--     educator_list_assignments(p_status)                     -> jsonb array
--     educator_get_assignment(p_assignment_id)                -> jsonb
--     educator_start_assignment(p_assignment_id)              -> jsonb (assignment)
--     educator_add_assignment_comment(p_assignment_id, p_comment, p_question_id)
--     educator_get_profile() / educator_update_profile(p_fields)
--     educator_get_stats() / educator_get_dashboard()
--   Contract: docs/EDUCATOR_RPC_CONTRACT.md.
--
--   Assignments use the real test_assignments columns and statuses; history
--   rows are written with adm_asg_log as the admin RPCs do. Starting an
--   assignment creates its test through create_test (the admin's function),
--   which the assignee may call through adm_require_series_access.
--   No student identity is returned: stats are counts and averages only.
--   Earnings are not returned (payments are on hold, F4).
--
-- ROLLBACK (whole set: scripts/rollback_20261028_educator_series.sql)
--   drop function if exists public.educator_get_dashboard();
--   drop function if exists public.educator_get_stats();
--   drop function if exists public.educator_update_profile(jsonb);
--   drop function if exists public.educator_get_profile();
--   drop function if exists public.educator_add_assignment_comment(uuid, text, uuid);
--   drop function if exists public.educator_start_assignment(uuid);
--   drop function if exists public.educator_get_assignment(uuid);
--   drop function if exists public.educator_list_assignments(text);
--   drop function if exists public.adm_educator_assignment_json(uuid);
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------- assignments
-- The caller's assignment: requirements, history, comments, and the test
-- built for it (if any). Null when it isn't theirs.
create or replace function public.adm_educator_assignment_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
           'assignment', to_jsonb(v) - 'educator_name',
           'series', (select jsonb_build_object('id', s.id, 'title', s.title, 'status', sa.status, 'code', sa.code)
                        from public.test_series s left join public.test_series_admin sa on sa.series_id = s.id
                       where s.id = v.series_id),
           'test', case when v.test_id is not null then public.adm_test_json(v.test_id) end,
           'history', (select coalesce(jsonb_agg(jsonb_build_object('action', h.action, 'note', h.note, 'at', h.at,
                                                                    'by_me', h.by_user = auth.uid()) order by h.at), '[]'::jsonb)
                         from public.assignment_history h where h.assignment_id = v.id),
           'comments', (select coalesce(jsonb_agg(jsonb_build_object(
                                          'id', c.id, 'comment', c.comment, 'question_id', c.question_id,
                                          'question_ref', c.question_ref, 'created_at', c.created_at,
                                          'from', case when c.author_id = auth.uid() then 'me' else 'admin' end)
                                        order by c.created_at), '[]'::jsonb)
                          from public.assignment_comments c where c.assignment_id = v.id))
    from public.adm_assignment_rows() v
   where v.id = p_id and v.educator_id = auth.uid();
$$;

-- p_status: null / 'all' | 'open' (not completed / cancelled / rejected) | 'overdue' | any status
create or replace function public.educator_list_assignments(p_status text default null) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_verified_educator();
  return coalesce((
    select jsonb_agg((to_jsonb(v) - 'educator_name')
                     || jsonb_build_object('series_status', sa.status,
                                           'comment_count', (select count(*) from public.assignment_comments c where c.assignment_id = v.id))
                     order by v.deadline nulls last, v.code)
      from public.adm_assignment_rows() v
      left join public.test_series_admin sa on sa.series_id = v.series_id
     where v.educator_id = auth.uid()
       and (p_status is null or p_status in ('', 'all')
            or (p_status = 'open' and v.status not in ('completed', 'cancelled', 'rejected'))
            or (p_status = 'overdue' and v.display_status = 'overdue')
            or v.status = p_status)), '[]'::jsonb);
end $$;

create or replace function public.educator_get_assignment(p_assignment_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v jsonb;
begin
  perform public.adm_require_verified_educator();
  v := public.adm_educator_assignment_json(p_assignment_id);
  if v is null then raise exception 'Assignment not found.' using errcode = 'P0002'; end if;
  return v;
end $$;

-- assigned -> in_progress; creates the test shell (create_test) the first time.
create or replace function public.educator_start_assignment(p_assignment_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  a      public.test_assignments;
  v_test jsonb;
begin
  perform public.adm_require_verified_educator();
  select * into a from public.test_assignments
   where id = p_assignment_id and educator_id = auth.uid() for update;
  if a.id is null then raise exception 'Assignment not found.' using errcode = 'P0002'; end if;
  if a.status in ('completed', 'cancelled', 'rejected') then
    raise exception 'This assignment is closed (%).', a.status using errcode = '22023';
  end if;
  if a.test_id is null then
    v_test := public.create_test(a.series_id, jsonb_build_object(
      'name', coalesce(nullif(btrim(a.test_name), ''), 'Test'),
      'instructions', coalesce(a.instructions, ''),
      'duration', a.duration_minutes,
      'totalMarks', a.total_marks,
      'plannedQuestions', a.question_count,
      'topics', to_jsonb(a.topics)));
    update public.test_assignments set test_id = (v_test ->> 'id')::uuid where id = a.id;
  end if;
  if a.status = 'assigned' then
    update public.test_assignments set status = 'in_progress' where id = a.id;
    perform public.adm_asg_log(a.id, 'Started', 'The educator started building the test.');
    perform public.adm_audit('assignment.start', 'test_assignment', a.id,
                             jsonb_build_object('status', a.status), jsonb_build_object('status', 'in_progress'), null);
  end if;
  return public.adm_educator_assignment_json(a.id);
end $$;

create or replace function public.educator_add_assignment_comment(
  p_assignment_id uuid, p_comment text, p_question_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_text text := btrim(coalesce(p_comment, ''));
  v_id   uuid;
  a      public.test_assignments;
begin
  perform public.adm_require_verified_educator();
  select * into a from public.test_assignments where id = p_assignment_id and educator_id = auth.uid();
  if a.id is null then raise exception 'Assignment not found.' using errcode = 'P0002'; end if;
  if char_length(v_text) < 1 or char_length(v_text) > 2000 then
    raise exception 'Write a comment of up to 2000 characters.' using errcode = '22023';
  end if;
  if p_question_id is not null and not exists (
       select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
        where qq.id = p_question_id and q.series_id = a.series_id) then
    raise exception 'That question is not in this assignment''s series.' using errcode = '22023';
  end if;
  insert into public.assignment_comments (assignment_id, question_id, comment, author_id)
  values (a.id, p_question_id, v_text, auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'comment', v_text, 'question_id', p_question_id, 'from', 'me', 'created_at', now());
end $$;

-- -------------------------------------------------------------- profile
create or replace function public.educator_get_profile() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid();
begin
  perform public.adm_require_verified_educator();
  return (
    select jsonb_build_object(
             'id', p.id, 'email', p.email, 'educator_code', st.educator_code,
             'full_name', coalesce(ep.full_name, p.full_name), 'phone', nullif(coalesce(nullif(ep.phone, ''), p.phone), ''),
             'location', nullif(ep.location, 'Not provided'), 'bio', ep.bio, 'photo_url', ep.photo_url,
             'qualifications', ep.qualifications, 'experience_years', ep.experience_years,
             'subjects', to_jsonb(coalesce(ep.subjects::text[], '{}'::text[])),
             'languages', to_jsonb(coalesce(ep.languages::text[], '{}'::text[])),
             'verification_status', ep.verification_status, 'verified_at', ep.verified_at,
             'rating_avg', ep.rating_avg, 'joined_at', coalesce(ep.created_at, p.created_at),
             'documents', (select coalesce(jsonb_agg(jsonb_build_object(
                                     'doc_type', d.doc_type, 'doc_name', d.doc_name,
                                     'status', case d.is_verified when true then 'approved' when false then 'rejected' else 'pending' end,
                                     'uploaded_at', d.created_at) order by d.doc_type, d.doc_name), '[]'::jsonb)
                             from public.educator_verification_docs d where d.educator_id = p.id))
      from public.profiles p
      join public.educator_profiles ep on ep.user_id = p.id
      left join public.educator_admin_state st on st.user_id = p.id
     where p.id = v_uid);
end $$;

-- p_fields: any of bio, qualifications, experience_years, subjects, languages,
-- phone, location, photo_url. Other keys are refused. Field errors: 22023
-- "Check the highlighted fields." with DETAIL {field: message}.
create or replace function public.educator_update_profile(p_fields jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid     uuid := auth.uid();
  v_allowed text[] := array['bio', 'qualifications', 'experience_years', 'subjects', 'languages', 'phone', 'location', 'photo_url'];
  v_bad     text[];
  v_errors  jsonb;
  v_form    jsonb;
  v_photo   text;
  v_before  jsonb;
  v_clean   jsonb := '{}'::jsonb;
begin
  perform public.adm_require_verified_educator();
  if jsonb_typeof(p_fields) is distinct from 'object' or p_fields = '{}'::jsonb then
    raise exception 'Nothing to update.' using errcode = '22023';
  end if;
  select array_agg(k) into v_bad from jsonb_object_keys(p_fields) k where k <> all (v_allowed);
  if v_bad is not null then
    raise exception 'These fields can''t be changed here: %', array_to_string(v_bad, ', ') using errcode = '42501';
  end if;

  v_before := public.educator_get_profile();
  -- validate the changed fields with the onboarding rules
  v_form := jsonb_build_object('full_name', v_before ->> 'full_name', 'phone', v_before ->> 'phone',
                               'location', v_before ->> 'location', 'qualifications', v_before ->> 'qualifications',
                               'experience_years', v_before -> 'experience_years', 'subjects', v_before -> 'subjects',
                               'languages', v_before -> 'languages', 'bio', v_before ->> 'bio') || (p_fields - 'photo_url');
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_errors
    from jsonb_each(public.adm_educator_validate(v_form, 0)) e
   where p_fields ? e.key;
  if p_fields ? 'photo_url' then
    v_photo := nullif(btrim(coalesce(p_fields ->> 'photo_url', '')), '');
    if v_photo is not null and (position(v_uid::text || '/' in v_photo) <> 1 or v_photo !~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,200}$') then
      v_errors := v_errors || jsonb_build_object('photo_url', 'Upload the photo through the portal.');
    end if;
  end if;
  if v_errors <> '{}'::jsonb then
    raise exception 'Check the highlighted fields.' using errcode = '22023', detail = v_errors::text;
  end if;

  if p_fields ? 'phone' or p_fields ? 'location' then
    v_clean := v_clean || public.adm_educator_clean(v_form, 1) - 'full_name';
  end if;
  if p_fields ? 'qualifications' or p_fields ? 'experience_years' then
    v_clean := v_clean || public.adm_educator_clean(v_form, 2);
  end if;
  if p_fields ? 'subjects' or p_fields ? 'languages' or p_fields ? 'bio' then
    v_clean := v_clean || public.adm_educator_clean(v_form, 3);
  end if;

  update public.educator_profiles set
    phone            = case when p_fields ? 'phone' then v_clean ->> 'phone' else phone end,
    location         = case when p_fields ? 'location' then v_clean ->> 'location' else location end,
    qualifications   = case when p_fields ? 'qualifications' then v_clean ->> 'qualifications' else qualifications end,
    experience_years = case when p_fields ? 'experience_years' then (v_clean ->> 'experience_years')::int else experience_years end,
    subjects         = case when p_fields ? 'subjects' then (select array_agg(x) from jsonb_array_elements_text(v_clean -> 'subjects') x) else subjects end,
    languages        = case when p_fields ? 'languages' then (select array_agg(x) from jsonb_array_elements_text(v_clean -> 'languages') x) else languages end,
    bio              = case when p_fields ? 'bio' then v_clean ->> 'bio' else bio end,
    photo_url        = case when p_fields ? 'photo_url' then v_photo else photo_url end
  where user_id = v_uid;
  if p_fields ? 'phone' or p_fields ? 'location' then
    update public.profiles set
      phone    = case when p_fields ? 'phone' then v_clean ->> 'phone' else phone end,
      location = case when p_fields ? 'location' then v_clean ->> 'location' else location end
    where id = v_uid;
  end if;
  perform public.adm_audit('educator.profile_update', 'educator', v_uid, v_before - 'documents',
                           public.educator_get_profile() - 'documents', null);
  return public.educator_get_profile();
end $$;

-- ---------------------------------------------------------------- stats
create or replace function public.educator_get_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_verified_educator();
  return (
    with mine as (select x as id from public.adm_educator_series_ids() x),
         ser as (select s.id, s.title, coalesce(sa.status, 'draft') as status
                   from mine join public.test_series s on s.id = mine.id
                   left join public.test_series_admin sa on sa.series_id = s.id
                  where sa.deleted_at is null),
         qz  as (select q.id, q.series_id from public.quizzes q join ser on ser.id = q.series_id),
         att as (select a.quiz_id, qz.series_id, a.student_id, a.percentage, a.passed, a.submitted_at
                   from public.quiz_attempts a join qz on qz.id = a.quiz_id
                  where a.status in ('submitted', 'timed_out')),
         asg as (select a.status, a.deadline from public.test_assignments a where a.educator_id = auth.uid()),
         fb  as (select f.rating from public.test_feedback f join ser on ser.id = f.series_id
                  where f.kind = 'feedback' and f.rating is not null)
    select jsonb_build_object(
      'series', jsonb_build_object(
        'total', (select count(*) from ser),
        'by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                        from (select status, count(*) as n from ser group by status) x)),
      'tests', (select count(*) from qz),
      'questions', (select count(*) from public.quiz_questions qq join qz on qz.id = qq.quiz_id),
      'learners', (select count(*) from (select student_id from att
                                         union
                                         select st.student_id from public.adm_series_students() st join ser on ser.id = st.series_id) l),
      'attempts', (select count(*) from att),
      'average_score', coalesce((select round(avg(percentage), 1) from att), 0),
      'pass_rate', coalesce((select round(100.0 * count(*) filter (where passed) / nullif(count(*), 0), 1) from att), 0),
      'per_series', (select coalesce(jsonb_agg(jsonb_build_object(
                                       'series_id', ser.id, 'title', ser.title, 'status', ser.status,
                                       'attempts', coalesce(m.n, 0), 'average_score', coalesce(m.avg_pct, 0),
                                       'pass_rate', coalesce(m.pass_rate, 0))
                                     order by coalesce(m.n, 0) desc, ser.title), '[]'::jsonb)
                       from ser
                       left join (select series_id, count(*) as n, round(avg(percentage), 1) as avg_pct,
                                         round(100.0 * count(*) filter (where passed) / nullif(count(*), 0), 1) as pass_rate
                                    from att group by series_id) m on m.series_id = ser.id),
      'trend', (select coalesce(jsonb_agg(jsonb_build_object('week', w.week, 'attempts', coalesce(t.n, 0),
                                                             'average_score', coalesce(t.avg_pct, 0)) order by w.week), '[]'::jsonb)
                  from (select (date_trunc('week', now()) - make_interval(weeks => g))::date as week
                          from generate_series(0, 11) g) w
                  left join (select date_trunc('week', submitted_at)::date as week, count(*) as n,
                                    round(avg(percentage), 1) as avg_pct
                               from att where submitted_at >= date_trunc('week', now()) - interval '11 weeks'
                              group by 1) t on t.week = w.week),
      'assignments', jsonb_build_object(
        'open', (select count(*) from asg where status not in ('completed', 'cancelled', 'rejected')),
        'due_soon', (select count(*) from asg where status not in ('completed', 'cancelled', 'rejected', 'approved')
                       and deadline between current_date and current_date + 7),
        'overdue', (select count(*) from asg where status not in ('completed', 'cancelled', 'rejected', 'approved')
                      and deadline < current_date),
        'completed', (select count(*) from asg where status = 'completed')),
      'ratings', jsonb_build_object(
        'count', (select count(*) from fb),
        'average', coalesce((select round(avg(rating), 2) from fb), 0),
        'distribution', (select jsonb_build_object('1', count(*) filter (where rating = 1), '2', count(*) filter (where rating = 2),
                                                   '3', count(*) filter (where rating = 3), '4', count(*) filter (where rating = 4),
                                                   '5', count(*) filter (where rating = 5)) from fb))));
end $$;

create or replace function public.educator_get_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_stats jsonb;
begin
  perform public.adm_require_verified_educator();
  v_stats := public.educator_get_stats();
  return jsonb_build_object(
    'assigned', (select coalesce(jsonb_agg(jsonb_build_object(
                                   'id', v.id, 'code', v.code, 'test_name', v.test_name, 'series_id', v.series_id,
                                   'series_name', v.series_name, 'deadline', v.deadline, 'status', v.status,
                                   'display_status', v.display_status, 'progress', v.progress)
                                 order by v.deadline nulls last, v.code), '[]'::jsonb)
                   from (select * from public.adm_assignment_rows() x
                          where x.educator_id = auth.uid() and x.status not in ('completed', 'cancelled', 'rejected')
                          order by x.deadline nulls last limit 5) v),
    'drafts', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'status', sa.status,
                                                            'rejection_reason', sa.rejection_reason, 'updated_at', s.updated_at)
                                         order by s.updated_at desc), '[]'::jsonb)
                 from (select * from public.test_series_admin x
                        where x.created_by = auth.uid() and x.deleted_at is null and x.status in ('draft', 'rejected')
                        order by x.updated_at desc limit 5) sa
                 join public.test_series s on s.id = sa.series_id),
    'pending_approval', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'submitted_at', sa.submitted_at)
                                                   order by sa.submitted_at), '[]'::jsonb)
                           from public.test_series_admin sa join public.test_series s on s.id = sa.series_id
                          where sa.created_by = auth.uid() and sa.deleted_at is null and sa.status = 'pending_approval'),
    'published_count', coalesce((v_stats #>> '{series,by_status,published}')::int, 0),
    'recent_activity', (select coalesce(jsonb_agg(jsonb_build_object('action', l.action, 'target_type', l.target_type,
                                                                     'target_id', l.target_id, 'at', l.created_at)
                                                  order by l.created_at desc), '[]'::jsonb)
                          from (select * from public.audit_logs x where x.actor_id = auth.uid()
                                 order by x.created_at desc limit 10) l),
    'stats', jsonb_build_object('learners', v_stats -> 'learners', 'attempts', v_stats -> 'attempts',
                                'average_score', v_stats -> 'average_score', 'pass_rate', v_stats -> 'pass_rate',
                                'series', v_stats #> '{series,total}', 'assignments', v_stats -> 'assignments',
                                'rating', v_stats #> '{ratings,average}'));
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_educator_assignment_json(uuid) from public, anon, authenticated;
revoke all on function public.educator_list_assignments(text) from public, anon;
revoke all on function public.educator_get_assignment(uuid) from public, anon;
revoke all on function public.educator_start_assignment(uuid) from public, anon;
revoke all on function public.educator_add_assignment_comment(uuid, text, uuid) from public, anon;
revoke all on function public.educator_get_profile() from public, anon;
revoke all on function public.educator_update_profile(jsonb) from public, anon;
revoke all on function public.educator_get_stats() from public, anon;
revoke all on function public.educator_get_dashboard() from public, anon;
grant execute on function public.educator_list_assignments(text) to authenticated;
grant execute on function public.educator_get_assignment(uuid) to authenticated;
grant execute on function public.educator_start_assignment(uuid) to authenticated;
grant execute on function public.educator_add_assignment_comment(uuid, text, uuid) to authenticated;
grant execute on function public.educator_get_profile() to authenticated;
grant execute on function public.educator_update_profile(jsonb) to authenticated;
grant execute on function public.educator_get_stats() to authenticated;
grant execute on function public.educator_get_dashboard() to authenticated;

-- smoke checks on the new definitions (no rows are written)
do $chk$
begin
  if public.adm_actor_kind() is not null then
    raise exception 'trial: the SQL editor user should be neither admin nor educator';
  end if;
  if public.adm_can_manage_series(gen_random_uuid()) then
    raise exception 'trial: adm_can_manage_series allowed a random series';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'test_series_admin_status_check'
                  and pg_get_constraintdef(oid) like '%pending_approval%') then
    raise exception 'trial: status CHECK not widened';
  end if;
end $chk$;

rollback;
