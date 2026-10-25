-- =====================================================================
-- 20261026100300_student_rpc_exam.sql
--
-- Purpose
--   Taking a test: intro, start / resume, autosave, proctoring, server-side
--   scoring, the stored report.
--
--   Internal helpers (revoked from every browser role):
--     adm_attempt_deadline(timestamptz, int)  started_at + time limit (null = untimed)
--     adm_test_window(uuid)                   opens_at / closes_at: the series
--                                             availability window, narrowed by a custom
--                                             quiz_admin window
--     adm_attempt_question_order(uuid)        question order for one attempt: shuffled
--                                             deterministically per attempt when
--                                             quizzes.shuffle_questions, else sort_order
--     adm_finalize_attempt(uuid, text)        grades an in_progress attempt, writes
--                                             quiz_answers + quiz_attempts, stores the
--                                             report snapshot, returns it
--
--   Browser RPCs (authenticated): student_get_test_intro, student_start_attempt,
--   student_save_answer, student_log_proctor_event, student_submit_attempt,
--   student_get_report.
--
-- Rules
--   * Questions are returned without correct answers. Options are returned only
--     for multiple_choice / true_false: for fill_in_blank and short_answer the
--     options ARE the accepted / model answers.
--   * Deadline = started_at + quizzes.time_limit_mins, on the server clock.
--     Saves get a 10-second grace for network latency; a submit more than
--     15 seconds after the deadline is recorded as timed_out.
--   * Scoring (adm_finalize_attempt): points = quiz_questions.points; wrong
--     answers lose quiz_question_admin.negative_marks (default 0); unanswered = 0,
--     no penalty. multiple_choice / true_false: the selected set must equal the
--     correct set (all-or-nothing). fill_in_blank: trimmed, case-insensitive match
--     against any is_correct option. short_answer (incl. long answer / subjective)
--     or needs_manual_grading: "pending", not scored and left out of max_score /
--     percentage until graded. passed = percentage >= quizzes.passing_score.
--   * Correct answers and explanations in the report follow the lead's
--     quizzes.show_answers_after: 'submission' = always, 'passing' = only when
--     passed, 'never' = hidden.
--   * Proctoring: events in the violation list count, except one arriving
--     within 3 seconds of the previous counted one (a tab switch fires both
--     blur and visibilitychange). Violations > quiz_admin.max_violations
--     (default 3) auto-submit the attempt.
--
-- Lead objects written
--   quiz_attempts (insert; score, max_score, percentage, passed, submitted_at,
--   time_taken_secs, status), quiz_answers (insert / update / delete own rows).
--
-- ROLLBACK
--   drop function if exists public.student_get_report(uuid);
--   drop function if exists public.student_submit_attempt(uuid);
--   drop function if exists public.student_log_proctor_event(uuid, text, jsonb);
--   drop function if exists public.student_save_answer(uuid, uuid, jsonb);
--   drop function if exists public.student_start_attempt(uuid);
--   drop function if exists public.student_get_test_intro(uuid);
--   drop function if exists public.adm_finalize_attempt(uuid, text);
--   drop function if exists public.adm_report_bucket(jsonb);
--   drop function if exists public.adm_attempt_question_order(uuid);
--   drop function if exists public.adm_test_window(uuid);
--   drop function if exists public.adm_attempt_deadline(timestamptz, int);
-- =====================================================================
set search_path = public, extensions;

-- ================================================================ helpers
create or replace function public.adm_attempt_deadline(p_started_at timestamptz, p_minutes int) returns timestamptz
language sql immutable set search_path = public, extensions as $$
  select case when coalesce(p_minutes, 0) > 0 then p_started_at + make_interval(mins => p_minutes) end;
$$;

create or replace function public.adm_test_window(p_test_id uuid)
returns table (opens_at timestamptz, closes_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select greatest(s.available_from, case when qa.window_mode = 'custom' then qa.open_at end),
         least(s.available_until, case when qa.window_mode = 'custom' then qa.close_at end)
    from public.quizzes q
    left join public.test_series s on s.id = q.series_id
    left join public.quiz_admin qa on qa.quiz_id = q.id
   where q.id = p_test_id;
$$;

create or replace function public.adm_attempt_question_order(p_attempt_id uuid)
returns table (question_id uuid, seq int)
language sql stable security definer set search_path = public, extensions as $$
  select qq.id,
         (row_number() over (order by case when q.shuffle_questions then md5(a.id::text || qq.id::text) end,
                                      qq.sort_order, qq.created_at, qq.id))::int
    from public.quiz_attempts a
    join public.quizzes q on q.id = a.quiz_id
    join public.quiz_questions qq on qq.quiz_id = q.id
   where a.id = p_attempt_id;
$$;

-- One breakdown bucket from graded report rows (a jsonb array). accuracy =
-- correct / graded answers (pending and skipped are not graded answers).
create or replace function public.adm_report_bucket(p_rows jsonb) returns jsonb
language sql immutable set search_path = public, extensions as $$
  select jsonb_build_object(
           'total', count(*),
           'attempted', count(*) filter (where r ->> 'status' <> 'skipped'),
           'correct', count(*) filter (where r ->> 'status' = 'correct'),
           'incorrect', count(*) filter (where r ->> 'status' = 'incorrect'),
           'skipped', count(*) filter (where r ->> 'status' = 'skipped'),
           'pending', count(*) filter (where r ->> 'status' = 'pending'),
           'graded', count(*) filter (where r ->> 'status' in ('correct', 'incorrect')),
           'accuracy', coalesce(round(count(*) filter (where r ->> 'status' = 'correct') * 100.0
                                      / nullif(count(*) filter (where r ->> 'status' in ('correct', 'incorrect')), 0), 1), 0),
           'marks_earned', coalesce(sum((r ->> 'points_earned')::numeric), 0),
           'marks_possible', coalesce(sum((r ->> 'points')::numeric) filter (where r ->> 'status' <> 'pending'), 0))
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r;
$$;

-- Grades an in_progress attempt and stores the report. No auth check: callers
-- (student_submit_attempt, student_log_proctor_event, student_start_attempt,
-- student_get_report) verify ownership first. p_reason: 'student' | 'proctor_limit'
-- | 'time_up'. Returns the stored report if one exists; refuses attempts that
-- were finished outside this port (no report, not in_progress) rather than
-- regrading them.
create or replace function public.adm_finalize_attempt(p_attempt_id uuid, p_reason text default 'student')
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_att        record;
  v_quiz       record;
  v_report     jsonb;
  v_deadline   timestamptz;
  v_status     text;
  v_end        timestamptz;
  v_reveal     boolean;
  v_rows       jsonb := '[]'::jsonb;
  v_row        jsonb;
  q            record;
  v_ans        record;
  v_sel        text[];
  v_correct    text[];
  v_state      text;
  v_earned     numeric;
  v_score      numeric := 0;
  v_max        numeric := 0;
  v_total      numeric := 0;
  v_pct        numeric := 0;
  v_passed     boolean;
  v_pending    int := 0;
  v_violations int;
  v_limit      int;
  v_cmp        record;
  v_rank       int;
  v_lower      int;
begin
  select a.* into v_att from public.quiz_attempts a where a.id = p_attempt_id for update;
  if v_att.id is null then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;

  select r.report into v_report from public.attempt_reports r where r.attempt_id = p_attempt_id;
  if v_report is not null then
    return v_report;
  end if;
  if v_att.status <> 'in_progress' then
    raise exception 'No detailed report is available for this attempt.' using errcode = 'P0002';
  end if;

  select q2.id, q2.title, q2.time_limit_mins, q2.passing_score, q2.show_answers_after, q2.series_id,
         s.title as series_title, coalesce(qa.max_violations, 3) as max_violations
    into v_quiz
    from public.quizzes q2
    left join public.quiz_admin qa on qa.quiz_id = q2.id
    left join public.test_series s on s.id = q2.series_id
   where q2.id = v_att.quiz_id;

  v_deadline := public.adm_attempt_deadline(v_att.started_at, v_quiz.time_limit_mins);
  if v_deadline is not null and now() > v_deadline + interval '15 seconds' then
    v_status := 'timed_out';
    v_end    := v_deadline;
  else
    v_status := 'submitted';
    v_end    := least(now(), coalesce(v_deadline, now()));
  end if;

  select count(*) into v_violations
    from public.attempt_proctor_events e
   where e.attempt_id = p_attempt_id and coalesce((e.meta ->> 'counted')::boolean, false);
  v_limit := v_quiz.max_violations;

  -- ------------------------------------------------------------- grading
  for q in
    select o.seq as position, qq.id, qq.question_text, qq.question_type, qq.points, qq.explanation,
           qqa.admin_type,
           coalesce(qqa.negative_marks, 0) as negative_marks,
           coalesce(qqa.needs_manual_grading, false) or qq.question_type = 'short_answer' as manual,
           coalesce(nullif(btrim(qqa.topic), ''), 'General') as topic,
           coalesce(qqa.difficulty, 'unrated') as difficulty,
           coalesce(sec.name, 'General') as section,
           coalesce(sec.position, 0) as section_position
      from public.adm_attempt_question_order(p_attempt_id) o
      join public.quiz_questions qq on qq.id = o.question_id
      left join public.quiz_question_admin qqa on qqa.question_id = qq.id
      left join public.test_sections sec on sec.id = qqa.section_id
     order by o.seq
  loop
    v_total := v_total + q.points;

    select ans.id, ans.answer_text,
           (select array_agg(distinct x::text) from unnest(ans.selected_option_ids) x) as sel
      into v_ans
      from public.quiz_answers ans
     where ans.attempt_id = p_attempt_id and ans.question_id = q.id
     order by ans.created_at desc
     limit 1;
    v_sel := coalesce(v_ans.sel, '{}');

    select coalesce(array_agg(o.id::text), '{}') into v_correct
      from public.quiz_question_options o where o.question_id = q.id and o.is_correct;

    if cardinality(v_sel) = 0 and nullif(btrim(coalesce(v_ans.answer_text, '')), '') is null then
      v_state := 'skipped';  v_earned := 0;
    elsif q.manual then
      v_state := 'pending';  v_earned := null;
    elsif q.question_type in ('multiple_choice', 'true_false') then
      v_state := case when cardinality(v_correct) > 0 and v_sel @> v_correct and v_correct @> v_sel
                      then 'correct' else 'incorrect' end;
    elsif q.question_type = 'fill_in_blank' then
      v_state := case when exists (select 1 from public.quiz_question_options o
                                    where o.question_id = q.id and o.is_correct
                                      and lower(btrim(o.option_text)) = lower(btrim(v_ans.answer_text)))
                      then 'correct' else 'incorrect' end;
    else
      v_state := 'pending';  v_earned := null;   -- unknown type: leave for a human
    end if;

    if v_state = 'correct' then
      v_earned := q.points;
    elsif v_state = 'incorrect' then
      v_earned := -q.negative_marks;
    end if;

    if v_state = 'pending' then
      v_pending := v_pending + 1;
    else
      v_max   := v_max + q.points;
      v_score := v_score + v_earned;
    end if;

    -- quiz_answers: one graded row per question (skipped rows record 0).
    if v_ans.id is not null then
      update public.quiz_answers
         set is_correct = case v_state when 'correct' then true when 'pending' then null else false end,
             points_earned = v_earned
       where id = v_ans.id;
    else
      insert into public.quiz_answers (attempt_id, question_id, is_correct, points_earned)
      values (p_attempt_id, q.id, false, 0);
    end if;

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'position', q.position,
      'question_id', q.id,
      'text', q.question_text,
      'type', q.question_type,
      'ui_type', coalesce(q.admin_type, q.question_type),
      'section', q.section,
      'section_position', q.section_position,
      'topic', q.topic,
      'difficulty', q.difficulty,
      'status', v_state,
      'student_answer', case when cardinality(v_sel) > 0 then
                          (select string_agg(o.option_text, ', ' order by o.sort_order, o.id)
                             from public.quiz_question_options o
                            where o.question_id = q.id and o.id::text = any (v_sel))
                        else nullif(btrim(coalesce(v_ans.answer_text, '')), '') end,
      'selected_option_ids', to_jsonb(v_sel),
      '_correct_answer', case
                           when q.question_type in ('multiple_choice', 'true_false') then
                             (select string_agg(o.option_text, ', ' order by o.sort_order, o.id)
                                from public.quiz_question_options o where o.question_id = q.id and o.is_correct)
                           when q.question_type = 'fill_in_blank' then
                             (select string_agg(o.option_text, ' / ' order by o.sort_order, o.id)
                                from public.quiz_question_options o where o.question_id = q.id and o.is_correct)
                           else
                             (select string_agg(o.option_text, ' / ' order by o.sort_order, o.id)
                                from public.quiz_question_options o
                               where o.question_id = q.id and o.is_correct
                                 and o.option_text <> 'Manual grading: see rubric')
                         end,
      '_options', case when q.question_type in ('multiple_choice', 'true_false') then
                    (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'text', o.option_text,
                                                                  'selected', o.id::text = any (v_sel),
                                                                  'is_correct', o.is_correct)
                                               order by o.sort_order, o.id), '[]'::jsonb)
                       from public.quiz_question_options o where o.question_id = q.id)
                  else '[]'::jsonb end,
      'points', q.points,
      'negative_marks', q.negative_marks,
      'points_earned', v_earned,
      '_explanation', q.explanation,
      'time_spent_secs', null));
  end loop;

  v_pct    := case when v_max > 0 then greatest(round(v_score * 100.0 / v_max, 2), 0) else 0 end;
  v_passed := v_pct >= coalesce(v_quiz.passing_score, 0);
  v_reveal := case coalesce(v_quiz.show_answers_after, 'submission')
                when 'never' then false when 'passing' then v_passed else true end;

  update public.quiz_attempts
     set status = v_status,
         score = v_score,
         max_score = v_max,
         percentage = v_pct,
         passed = v_passed,
         submitted_at = v_end,
         time_taken_secs = greatest(extract(epoch from (v_end - v_att.started_at))::int, 0)
   where id = p_attempt_id;

  -- Comparison with every finished attempt of this test (this one included).
  -- Aggregates only: no other student's identity is read into the report.
  select count(*) as n, round(avg(a.percentage), 2) as avg_pct, max(a.percentage) as top_pct,
         round(avg(a.score), 2) as avg_score, max(a.score) as top_score
    into v_cmp
    from public.quiz_attempts a
   where a.quiz_id = v_att.quiz_id and a.status in ('submitted', 'timed_out') and a.percentage is not null;
  select count(*) filter (where a.percentage > v_pct) + 1, count(*) filter (where a.percentage < v_pct)
    into v_rank, v_lower
    from public.quiz_attempts a
   where a.quiz_id = v_att.quiz_id and a.status in ('submitted', 'timed_out') and a.percentage is not null;

  -- Breakdowns over the graded rows.
  v_report := jsonb_build_object(
    'version', 1,
    'attempt_id', p_attempt_id,
    'test_id', v_quiz.id,
    'test_title', v_quiz.title,
    'series_id', v_quiz.series_id,
    'series_title', v_quiz.series_title,
    'summary', jsonb_build_object(
      'status', v_status,
      'attempt_number', v_att.attempt_number,
      'started_at', v_att.started_at,
      'submitted_at', v_end,
      'time_taken_secs', greatest(extract(epoch from (v_end - v_att.started_at))::int, 0),
      'time_limit_mins', v_quiz.time_limit_mins,
      'score', v_score,
      'max_score', v_max,
      'total_marks', v_total,
      'percentage', v_pct,
      'passing_percentage', v_quiz.passing_score,
      'passed', v_passed,
      'provisional', v_pending > 0,
      'correct_count', (select count(*) from jsonb_array_elements(v_rows) r where r ->> 'status' = 'correct'),
      'incorrect_count', (select count(*) from jsonb_array_elements(v_rows) r where r ->> 'status' = 'incorrect'),
      'skipped_count', (select count(*) from jsonb_array_elements(v_rows) r where r ->> 'status' = 'skipped'),
      'pending_count', v_pending,
      'pending_marks', (select coalesce(sum((r ->> 'points')::numeric), 0) from jsonb_array_elements(v_rows) r
                         where r ->> 'status' = 'pending'),
      'rank', v_rank,
      'total_attempts', v_cmp.n,
      'percentile', case when v_cmp.n > 1 then round(v_lower * 100.0 / (v_cmp.n - 1), 1) else 100 end,
      'class_average', coalesce(v_cmp.avg_pct, 0),
      'topper_percentage', coalesce(v_cmp.top_pct, 0),
      'violations_count', v_violations,
      'violation_limit', v_limit,
      'auto_submitted', p_reason in ('proctor_limit', 'time_up') or v_status = 'timed_out',
      'auto_submit_reason', case when p_reason = 'proctor_limit' then 'proctor_limit'
                                 when p_reason = 'time_up' or v_status = 'timed_out' then 'time_up' end,
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
      'your_percentage', v_pct,
      'average_percentage', coalesce(v_cmp.avg_pct, 0),
      'topper_percentage', coalesce(v_cmp.top_pct, 0),
      'your_score', v_score,
      'average_score', coalesce(v_cmp.avg_score, 0),
      'topper_score', coalesce(v_cmp.top_score, 0),
      'difference_from_average', round(v_pct - coalesce(v_cmp.avg_pct, 0), 2),
      'difference_from_topper', round(v_pct - coalesce(v_cmp.top_pct, 0), 2)));

  -- Strengths / weaknesses: topics with at least one graded answer.
  v_report := v_report || jsonb_build_object(
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

  insert into public.attempt_reports (attempt_id, report, generated_at)
  values (p_attempt_id, v_report, now())
  on conflict (attempt_id) do nothing;

  return v_report;
end $$;

-- ========================================================== student RPCs
-- Enrolment is required. Never returns questions.
create or replace function public.student_get_test_intro(p_test_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_uid    uuid := public.adm_student_uid();
  v_test   record;
  v_win    record;
  v_stats  record;
  v_used   int;
  v_prog   record;
  v_reason text;
begin
  select q.*, s.title as series_title, s.instructions as series_instructions,
         qa.instructions_extra, coalesce(qa.max_violations, 3) as max_violations
    into v_test
    from public.quizzes q
    left join public.quiz_admin qa on qa.quiz_id = q.id
    left join public.test_series s on s.id = q.series_id
   where q.id = p_test_id
     and coalesce(qa.status, 'published') = 'published'
     and q.series_id in (select l.id from public.adm_live_series() l(id));
  if v_test.id is null then
    raise exception 'Test not found.' using errcode = 'P0002';
  end if;
  if not public.adm_student_is_enrolled(v_test.series_id, v_uid) then
    raise exception 'Enrol in this test series to take its tests.' using errcode = '42501';
  end if;

  select w.* into v_win from public.adm_test_window(p_test_id) w;
  select count(*) as questions, coalesce(sum(qq.points), 0) as marks,
         coalesce(max(qqa.negative_marks), 0) as max_negative
    into v_stats
    from public.quiz_questions qq
    left join public.quiz_question_admin qqa on qqa.question_id = qq.id
   where qq.quiz_id = p_test_id;
  select count(*) into v_used from public.quiz_attempts where quiz_id = p_test_id and student_id = v_uid;
  select a.id, public.adm_attempt_deadline(a.started_at, v_test.time_limit_mins) as deadline
    into v_prog
    from public.quiz_attempts a
   where a.quiz_id = p_test_id and a.student_id = v_uid and a.status = 'in_progress'
   order by a.started_at desc limit 1;

  v_reason := case
    when v_prog.id is not null and (v_prog.deadline is null or v_prog.deadline > now()) then null   -- resume
    when v_stats.questions = 0 then 'no_questions'
    when v_win.opens_at is not null and v_win.opens_at > now() then 'not_open_yet'
    when v_win.closes_at is not null and v_win.closes_at <= now() then 'closed'
    when v_used >= v_test.max_attempts then 'attempts_exhausted'
    else null end;

  return jsonb_build_object(
    'test_id', v_test.id,
    'test_title', v_test.title,
    'series_id', v_test.series_id,
    'series_title', v_test.series_title,
    'series_instructions', v_test.series_instructions,
    'test_instructions', v_test.description,
    'instructions_extra', v_test.instructions_extra,
    'duration_mins', v_test.time_limit_mins,
    'questions_count', v_stats.questions,
    'total_marks', v_stats.marks,
    'negative_marking', v_stats.max_negative > 0,
    'max_negative_marks', v_stats.max_negative,
    'passing_percentage', v_test.passing_score,
    'attempts_used', v_used,
    'attempts_allowed', v_test.max_attempts,
    'attempts_remaining', greatest(v_test.max_attempts - v_used, 0),
    'violation_limit', v_test.max_violations,
    'is_proctored', v_test.is_proctored,
    'show_answers_after', v_test.show_answers_after,
    'opens_at', v_win.opens_at,
    'closes_at', v_win.closes_at,
    'in_progress_attempt_id', case when v_prog.id is not null and (v_prog.deadline is null or v_prog.deadline > now())
                                   then v_prog.id end,
    'can_start', v_reason is null,
    'blocked_reason', v_reason,
    'server_now', now(),
    'sections', coalesce((select jsonb_agg(jsonb_build_object('name', sec.name, 'questions', sec.n)
                                           order by sec.position)
                            from (select coalesce(ts.name, 'General') as name, coalesce(ts.position, 0) as position,
                                         count(*) as n
                                    from public.quiz_questions qq
                                    left join public.quiz_question_admin qqa on qqa.question_id = qq.id
                                    left join public.test_sections ts on ts.id = qqa.section_id
                                   where qq.quiz_id = p_test_id
                                   group by ts.name, ts.position) sec), '[]'::jsonb));
end $$;

create or replace function public.student_start_attempt(p_test_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid        uuid := public.adm_student_writer_uid();
  v_test       record;
  v_win        record;
  v_prog       record;
  v_used       int;
  v_last_num   int;
  v_attempt_id uuid;
  v_attempt    record;
  v_resumed    boolean := false;
  v_deadline   timestamptz;
begin
  select q.*, coalesce(qa.shuffle_options, false) as shuffle_options, coalesce(qa.max_violations, 3) as max_violations
    into v_test
    from public.quizzes q
    left join public.quiz_admin qa on qa.quiz_id = q.id
   where q.id = p_test_id
     and coalesce(qa.status, 'published') = 'published'
     and q.series_id in (select l.id from public.adm_live_series() l(id));
  if v_test.id is null then
    raise exception 'Test not found.' using errcode = 'P0002';
  end if;
  if not public.adm_student_is_enrolled(v_test.series_id, v_uid) then
    raise exception 'Enrol in this test series to take its tests.' using errcode = '42501';
  end if;

  -- One start at a time per student and test (attempt limit under concurrency).
  perform pg_advisory_xact_lock(hashtextextended(p_test_id::text || ':' || v_uid::text, 0));

  -- Resume an unexpired attempt; grade an expired one first.
  select a.* into v_prog
    from public.quiz_attempts a
   where a.quiz_id = p_test_id and a.student_id = v_uid and a.status = 'in_progress'
   order by a.started_at desc limit 1;
  if v_prog.id is not null then
    v_deadline := public.adm_attempt_deadline(v_prog.started_at, v_test.time_limit_mins);
    if v_deadline is null or v_deadline > now() then
      v_attempt_id := v_prog.id;
      v_resumed    := true;
    else
      perform public.adm_finalize_attempt(v_prog.id, 'time_up');
    end if;
  end if;

  if v_attempt_id is null then
    select w.* into v_win from public.adm_test_window(p_test_id) w;
    if v_win.opens_at is not null and v_win.opens_at > now() then
      raise exception 'This test opens at %.', to_char(v_win.opens_at at time zone 'Asia/Kolkata', 'DD Mon YYYY HH24:MI "IST"')
        using errcode = 'P0001';
    end if;
    if v_win.closes_at is not null and v_win.closes_at <= now() then
      raise exception 'This test has closed.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.quiz_questions where quiz_id = p_test_id) then
      raise exception 'This test has no questions yet.' using errcode = 'P0001';
    end if;
    select count(*), coalesce(max(attempt_number), 0) into v_used, v_last_num
      from public.quiz_attempts where quiz_id = p_test_id and student_id = v_uid;
    if v_used >= v_test.max_attempts then
      raise exception 'You have used all % attempts for this test.', v_test.max_attempts using errcode = 'P0001';
    end if;
    insert into public.quiz_attempts (quiz_id, student_id, attempt_number, status, started_at)
    values (p_test_id, v_uid, greatest(v_used, v_last_num) + 1, 'in_progress', now())
    returning id into v_attempt_id;
  end if;

  select a.* into v_attempt from public.quiz_attempts a where a.id = v_attempt_id;
  v_deadline := public.adm_attempt_deadline(v_attempt.started_at, v_test.time_limit_mins);

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'test_id', p_test_id,
    'test_title', v_test.title,
    'series_id', v_test.series_id,
    'attempt_number', v_attempt.attempt_number,
    'resumed', v_resumed,
    'started_at', v_attempt.started_at,
    'deadline', v_deadline,
    'server_now', now(),
    'duration_mins', v_test.time_limit_mins,
    'is_proctored', v_test.is_proctored,
    'violation_limit', v_test.max_violations,
    'violations_count', (select count(*) from public.attempt_proctor_events e
                          where e.attempt_id = v_attempt.id and coalesce((e.meta ->> 'counted')::boolean, false)),
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', qq.id,
               'position', o.seq,
               'text', qq.question_text,
               'type', qq.question_type,
               'ui_type', coalesce(qqa.admin_type, qq.question_type),
               'multi_select', qq.question_type = 'multiple_choice'
                               and (select count(*) from public.quiz_question_options c
                                     where c.question_id = qq.id and c.is_correct) > 1,
               'points', qq.points,
               'negative_marks', coalesce(qqa.negative_marks, 0),
               'section', coalesce(sec.name, 'General'),
               'section_position', coalesce(sec.position, 0),
               'topic', qqa.topic,
               'difficulty', qqa.difficulty,
               'image_path', qqa.image_path,
               'answer_instructions', qqa.answer_instructions,
               'options', case when qq.question_type in ('multiple_choice', 'true_false') then (
                            select coalesce(jsonb_agg(jsonb_build_object('id', op.id, 'text', op.option_text)
                                                      order by case when v_test.shuffle_options
                                                                    then md5(v_attempt.id::text || op.id::text) end,
                                                               op.sort_order, op.id), '[]'::jsonb)
                              from public.quiz_question_options op where op.question_id = qq.id)
                          else '[]'::jsonb end)
             order by o.seq), '[]'::jsonb)
        from public.adm_attempt_question_order(v_attempt.id) o
        join public.quiz_questions qq on qq.id = o.question_id
        left join public.quiz_question_admin qqa on qqa.question_id = qq.id
        left join public.test_sections sec on sec.id = qqa.section_id),
    'saved_answers', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'question_id', ans.question_id,
               'answer_text', ans.answer_text,
               'selected_option_ids', coalesce(to_jsonb(ans.selected_option_ids), '[]'::jsonb))), '[]'::jsonb)
        from public.quiz_answers ans where ans.attempt_id = v_attempt.id));
end $$;

-- p_answer: {"selected_option_ids": [uuid, ...]} for multiple_choice / true_false,
-- {"answer_text": "..."} otherwise; null, {} or an empty value clears the answer.
create or replace function public.student_save_answer(p_attempt_id uuid, p_question_id uuid, p_answer jsonb)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid      uuid := public.adm_student_writer_uid();
  v_att      record;
  v_deadline timestamptz;
  v_type     text;
  v_sel      text[];
  v_text     text;
  v_ans_id   uuid;
begin
  select a.id, a.student_id, a.status, a.started_at, a.quiz_id, q.time_limit_mins
    into v_att
    from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
   where a.id = p_attempt_id
   for update of a;
  if v_att.id is null or v_att.student_id <> v_uid then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;
  if v_att.status <> 'in_progress' then
    raise exception 'This attempt has already been submitted.' using errcode = 'P0001';
  end if;
  v_deadline := public.adm_attempt_deadline(v_att.started_at, v_att.time_limit_mins);
  if v_deadline is not null and now() > v_deadline + interval '10 seconds' then
    raise exception 'Time is up for this attempt.' using errcode = 'P0001';
  end if;

  select question_type into v_type from public.quiz_questions where id = p_question_id and quiz_id = v_att.quiz_id;
  if v_type is null then
    raise exception 'Question is not part of this test.' using errcode = '22023';
  end if;

  if v_type in ('multiple_choice', 'true_false') then
    if jsonb_typeof(p_answer -> 'selected_option_ids') = 'array' then
      -- Only ids of this question's options are kept.
      select array_agg(distinct o.id::text) into v_sel
        from public.quiz_question_options o
       where o.question_id = p_question_id
         and o.id::text in (select jsonb_array_elements_text(p_answer -> 'selected_option_ids'));
      if jsonb_array_length(p_answer -> 'selected_option_ids') > 0 and v_sel is null then
        raise exception 'Unknown option for this question.' using errcode = '22023';
      end if;
    end if;
  else
    v_text := left(nullif(btrim(coalesce(p_answer ->> 'answer_text', '')), ''), 20000);
  end if;

  select id into v_ans_id from public.quiz_answers
   where attempt_id = p_attempt_id and question_id = p_question_id
   order by created_at desc limit 1;

  if v_sel is null and v_text is null then
    delete from public.quiz_answers where attempt_id = p_attempt_id and question_id = p_question_id;
  -- v_sel holds validated option ids. ::uuid[] writes into the column whether
  -- the lead declared it uuid[] or text[] (uuid -> text is an assignment cast,
  -- text -> uuid is not).
  elsif v_ans_id is not null then
    update public.quiz_answers set answer_text = v_text, selected_option_ids = v_sel::uuid[] where id = v_ans_id;
  else
    insert into public.quiz_answers (attempt_id, question_id, answer_text, selected_option_ids)
    values (p_attempt_id, p_question_id, v_text, v_sel::uuid[]);
  end if;

  return jsonb_build_object('saved', true, 'cleared', v_sel is null and v_text is null,
                            'question_id', p_question_id, 'saved_at', now(), 'server_now', now(),
                            'deadline', v_deadline);
end $$;

-- Violation types: visibility_hidden, window_blur, fullscreen_exit, copy, cut,
-- paste, contextmenu, print, devtools. Informational (recorded, never counted):
-- fullscreen_enter, attempt_resumed, warning_acknowledged.
create or replace function public.student_log_proctor_event(p_attempt_id uuid, p_event_type text, p_meta jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid      uuid := public.adm_student_uid();
  v_att      record;
  v_deadline timestamptz;
  v_type     text := lower(btrim(coalesce(p_event_type, '')));
  v_counted  boolean;
  v_count    int;
  v_meta     jsonb := coalesce(p_meta, '{}'::jsonb);
  v_auto     boolean := false;
  v_reason   text;
begin
  if v_type not in ('visibility_hidden', 'window_blur', 'fullscreen_exit', 'copy', 'cut', 'paste', 'contextmenu',
                    'print', 'devtools', 'fullscreen_enter', 'attempt_resumed', 'warning_acknowledged') then
    raise exception 'Unknown proctor event: %', left(p_event_type, 40) using errcode = '22023';
  end if;

  select a.id, a.student_id, a.status, a.started_at, q.time_limit_mins, coalesce(qa.max_violations, 3) as max_violations
    into v_att
    from public.quiz_attempts a
    join public.quizzes q on q.id = a.quiz_id
    left join public.quiz_admin qa on qa.quiz_id = q.id
   where a.id = p_attempt_id
   for update of a;
  if v_att.id is null or v_att.student_id <> v_uid then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;

  if v_att.status = 'in_progress' then
    v_deadline := public.adm_attempt_deadline(v_att.started_at, v_att.time_limit_mins);
    if v_deadline is not null and now() > v_deadline + interval '10 seconds' then
      perform public.adm_finalize_attempt(p_attempt_id, 'time_up');
      v_auto := true;
      v_reason := 'time_up';
    else
      v_counted := v_type not in ('fullscreen_enter', 'attempt_resumed', 'warning_acknowledged')
                   and not exists (select 1 from public.attempt_proctor_events e
                                    where e.attempt_id = p_attempt_id
                                      and coalesce((e.meta ->> 'counted')::boolean, false)
                                      and e.occurred_at > now() - interval '3 seconds');
      if pg_column_size(v_meta) > 4096 or jsonb_typeof(v_meta) <> 'object' then
        v_meta := jsonb_build_object('truncated', true);
      end if;
      insert into public.attempt_proctor_events (attempt_id, event_type, occurred_at, meta)
      values (p_attempt_id, v_type, now(), v_meta || jsonb_build_object('counted', v_counted));
    end if;
  end if;

  select count(*) into v_count
    from public.attempt_proctor_events e
   where e.attempt_id = p_attempt_id and coalesce((e.meta ->> 'counted')::boolean, false);

  if not v_auto and v_att.status = 'in_progress' and v_count > v_att.max_violations then
    perform public.adm_finalize_attempt(p_attempt_id, 'proctor_limit');
    v_auto := true;
    v_reason := 'proctor_limit';
  end if;

  return jsonb_build_object(
    'attempt_id', p_attempt_id,
    'recorded', v_att.status = 'in_progress' and v_reason is distinct from 'time_up',
    'counted', coalesce(v_counted, false),
    'violations_count', v_count,
    'violation_limit', v_att.max_violations,
    'remaining', greatest(v_att.max_violations - v_count, 0),
    'auto_submitted', v_auto,
    'auto_submit_reason', v_reason,
    'status', (select status from public.quiz_attempts where id = p_attempt_id));
end $$;

-- Idempotent: a second call returns the stored report.
create or replace function public.student_submit_attempt(p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid   uuid := public.adm_student_uid();
  v_owner uuid;
begin
  select student_id into v_owner from public.quiz_attempts where id = p_attempt_id for update;
  if v_owner is null or v_owner <> v_uid then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;
  return public.adm_finalize_attempt(p_attempt_id, 'student');
end $$;

-- The stored report for the caller's own attempt. An in_progress attempt past
-- its deadline is graded first (time_up); one still running is refused.
create or replace function public.student_get_report(p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid    uuid := public.adm_student_uid();
  v_att    record;
  v_report jsonb;
begin
  select a.id, a.student_id, a.status, a.started_at, q.time_limit_mins
    into v_att
    from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
   where a.id = p_attempt_id;
  if v_att.id is null or v_att.student_id <> v_uid then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;

  select report into v_report from public.attempt_reports where attempt_id = p_attempt_id;
  if v_report is not null then
    return v_report;
  end if;

  if v_att.status = 'in_progress' then
    if coalesce(public.adm_attempt_deadline(v_att.started_at, v_att.time_limit_mins) + interval '10 seconds', 'infinity') > now() then
      raise exception 'This attempt has not been submitted yet.' using errcode = 'P0001';
    end if;
    return public.adm_finalize_attempt(p_attempt_id, 'time_up');
  end if;
  raise exception 'No detailed report is available for this attempt.' using errcode = 'P0002';
end $$;

-- ================================================================== grants
revoke all on function public.adm_attempt_deadline(timestamptz, int) from public, anon, authenticated;
revoke all on function public.adm_test_window(uuid) from public, anon, authenticated;
revoke all on function public.adm_attempt_question_order(uuid) from public, anon, authenticated;
revoke all on function public.adm_report_bucket(jsonb) from public, anon, authenticated;
revoke all on function public.adm_finalize_attempt(uuid, text) from public, anon, authenticated;

revoke all on function public.student_get_test_intro(uuid) from public, anon;
grant execute on function public.student_get_test_intro(uuid) to authenticated;
revoke all on function public.student_start_attempt(uuid) from public, anon;
grant execute on function public.student_start_attempt(uuid) to authenticated;
revoke all on function public.student_save_answer(uuid, uuid, jsonb) from public, anon;
grant execute on function public.student_save_answer(uuid, uuid, jsonb) to authenticated;
revoke all on function public.student_log_proctor_event(uuid, text, jsonb) from public, anon;
grant execute on function public.student_log_proctor_event(uuid, text, jsonb) to authenticated;
revoke all on function public.student_submit_attempt(uuid) from public, anon;
grant execute on function public.student_submit_attempt(uuid) to authenticated;
revoke all on function public.student_get_report(uuid) from public, anon;
grant execute on function public.student_get_report(uuid) to authenticated;
