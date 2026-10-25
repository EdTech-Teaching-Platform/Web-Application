-- =====================================================================
-- supabase/tests/student_rpcs.sql
--
-- Smoke tests for the student test-series RPCs (20261026100000..100400).
-- LOCAL / DISPOSABLE DATABASE ONLY (supabase start + migrations). Never run it
-- against the lead's project: it inserts fixture rows into auth.users and lead
-- tables. Everything runs in one transaction and is rolled back.
--
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/student_rpcs.sql
--
-- Expect the NOTICE lines "ok: ..." and a final "ok: all student RPC checks passed".
--
-- Covers
--   1. anon can call public_* only; student_* are denied (42501)
--   2. enrolment required; enrol is idempotent; draft tests are hidden
--   3. start returns no answers (no is_correct, no options for text questions); resume
--   4. autosave validation; one student cannot touch another's attempt or report
--   5. scoring: single / multi (all-or-nothing) / fill-in-blank (trim, case) /
--      manual (pending, excluded from max) / negative marks / skipped
--   6. submit is idempotent
--   7. deadline (server clock): save refused, submit -> timed_out
--   8. attempt limit
--   9. proctor: debounce, informational events, auto-submit over the limit
--  10. stats / dashboard / history shapes
--
-- Inside one transaction now() does not move, so "time passing" is simulated
-- by moving started_at / occurred_at back.
-- =====================================================================
begin;

create function pg_temp.expect_error(p_sql text, p_code text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate <> p_code then
      raise exception 'expected SQLSTATE % but got % (%) for: %', p_code, sqlstate, sqlerrm, p_sql;
    end if;
    return;
  end;
  raise exception 'expected SQLSTATE % but the call succeeded: %', p_code, p_sql;
end $$;

create function pg_temp.ok(p_cond boolean, p_what text) returns void
language plpgsql as $$
begin
  if not coalesce(p_cond, false) then
    raise exception 'FAILED: %', p_what;
  end if;
  raise notice 'ok: %', p_what;
end $$;

-- Sign in as a fixture user for the rest of the statement batch.
create function pg_temp.claims(p_key text) returns text
language sql as $$
  select json_build_object('sub', current_setting('test.' || p_key), 'role', 'authenticated')::text;
$$;

-- ------------------------------------------------------------ fixtures
do $fx$
declare
  v_a   uuid := gen_random_uuid();
  v_b   uuid := gen_random_uuid();
  v_edu uuid := gen_random_uuid();
  v_course uuid; v_series uuid; v_quiz uuid; v_quiz2 uuid; v_draft uuid;
  v_q1 uuid; v_q2 uuid; v_q3 uuid; v_q4 uuid; v_p1 uuid;
  v_q1_ok uuid; v_q1_bad uuid; v_q2_a uuid; v_q2_b uuid; v_q2_c uuid;
begin
  insert into auth.users (id, email) values
    (v_a, 'stu-a-' || v_a || '@test.local'), (v_b, 'stu-b-' || v_b || '@test.local'),
    (v_edu, 'edu-' || v_edu || '@test.local');
  insert into public.profiles (id, role, full_name, email) values
    (v_a, 'student', 'Student A', 'stu-a-' || v_a || '@test.local'),
    (v_b, 'student', 'Student B', 'stu-b-' || v_b || '@test.local'),
    (v_edu, 'educator', 'Educator', 'edu-' || v_edu || '@test.local');

  insert into public.courses (educator_id, title, slug)
  values (v_edu, 'Fixture course', 'fixture-' || v_edu) returning id into v_course;
  insert into public.test_series (course_id, title, description, is_published, is_active)
  values (v_course, 'Fixture series ' || v_course, 'Smoke test series', true, true) returning id into v_series;
  insert into public.test_series_admin (series_id, status, pricing, price_inr)
  values (v_series, 'published', 'free', 0);

  -- Test 1: 30 min, 2 attempts, pass at 50 %, 2 violations allowed.
  insert into public.quizzes (course_id, series_id, title, time_limit_mins, max_attempts, passing_score, series_sort_order)
  values (v_course, v_series, 'Fixture test 1', 30, 2, 50, 1) returning id into v_quiz;
  insert into public.quiz_admin (quiz_id, status, max_violations) values (v_quiz, 'published', 2);

  insert into public.quiz_questions (quiz_id, question_text, question_type, points, sort_order, explanation)
  values (v_quiz, 'Single choice', 'multiple_choice', 1, 1, 'Because.') returning id into v_q1;
  insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
  values (v_q1, 'Right', true, 1) returning id into v_q1_ok;
  insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
  values (v_q1, 'Wrong', false, 2) returning id into v_q1_bad;
  insert into public.quiz_question_admin (question_id, admin_type, negative_marks, topic, difficulty)
  values (v_q1, 'mcq_single', 0.25, 'Algebra', 'easy');

  insert into public.quiz_questions (quiz_id, question_text, question_type, points, sort_order)
  values (v_quiz, 'Multi choice', 'multiple_choice', 2, 2) returning id into v_q2;
  insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
  values (v_q2, 'A', true, 1) returning id into v_q2_a;
  insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
  values (v_q2, 'B', true, 2) returning id into v_q2_b;
  insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
  values (v_q2, 'C', false, 3) returning id into v_q2_c;
  insert into public.quiz_question_admin (question_id, admin_type, topic, difficulty)
  values (v_q2, 'mcq_multi', 'Algebra', 'medium');

  insert into public.quiz_questions (quiz_id, question_text, question_type, points, sort_order)
  values (v_quiz, 'Capital of France', 'fill_in_blank', 1, 3) returning id into v_q3;
  insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
  values (v_q3, 'Paris', true, 1);
  insert into public.quiz_question_admin (question_id, admin_type, topic, difficulty)
  values (v_q3, 'fill_blank', 'Geography', 'easy');

  insert into public.quiz_questions (quiz_id, question_text, question_type, points, sort_order)
  values (v_quiz, 'Explain', 'short_answer', 5, 4) returning id into v_q4;
  insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
  values (v_q4, 'Manual grading: see rubric', true, 1);
  insert into public.quiz_question_admin (question_id, admin_type, needs_manual_grading, topic, difficulty)
  values (v_q4, 'subjective', true, 'Geography', 'hard');

  -- Test 2: proctor limit 1, one attempt.
  insert into public.quizzes (course_id, series_id, title, time_limit_mins, max_attempts, passing_score, series_sort_order)
  values (v_course, v_series, 'Fixture test 2', 10, 1, 50, 2) returning id into v_quiz2;
  insert into public.quiz_admin (quiz_id, status, max_violations) values (v_quiz2, 'published', 1);
  insert into public.quiz_questions (quiz_id, question_text, question_type, points, sort_order)
  values (v_quiz2, 'True?', 'true_false', 1, 1) returning id into v_p1;
  insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
  values (v_p1, 'True', true, 1), (v_p1, 'False', false, 2);

  -- Test 3: draft, must stay hidden.
  insert into public.quizzes (course_id, series_id, title, time_limit_mins, max_attempts, series_sort_order)
  values (v_course, v_series, 'Fixture draft', 10, 1, 3) returning id into v_draft;
  insert into public.quiz_admin (quiz_id, status) values (v_draft, 'draft');

  perform set_config('test.a', v_a::text, true);
  perform set_config('test.b', v_b::text, true);
  perform set_config('test.series', v_series::text, true);
  perform set_config('test.quiz', v_quiz::text, true);
  perform set_config('test.quiz2', v_quiz2::text, true);
  perform set_config('test.draft', v_draft::text, true);
  perform set_config('test.q1', v_q1::text, true);
  perform set_config('test.q2', v_q2::text, true);
  perform set_config('test.q3', v_q3::text, true);
  perform set_config('test.q4', v_q4::text, true);
  perform set_config('test.q1_ok', v_q1_ok::text, true);
  perform set_config('test.q1_bad', v_q1_bad::text, true);
  perform set_config('test.q2_a', v_q2_a::text, true);
  perform set_config('test.q2_b', v_q2_b::text, true);
  perform set_config('test.q2_c', v_q2_c::text, true);
end $fx$;

-- ------------------------------------------------------------ 1. anon
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare v jsonb;
begin
  v := public.public_list_series(50);
  perform pg_temp.ok(exists (select 1 from jsonb_array_elements(v) e where e ->> 'id' = current_setting('test.series')),
                     'anon: public_list_series lists the fixture series');
  v := public.public_get_series(current_setting('test.series')::uuid);
  perform pg_temp.ok(jsonb_array_length(v -> 'tests') = 2, 'anon: public_get_series lists the 2 published tests (draft hidden)');
  perform pg_temp.ok(v::text not like '%is_correct%' and v::text not like '%question_text%',
                     'anon: public_get_series has no questions or answers');
  perform pg_temp.expect_error('select public.student_list_series()', '42501');
  perform pg_temp.expect_error('select public.student_dashboard()', '42501');
  perform pg_temp.expect_error(format('select public.student_start_attempt(%L)', current_setting('test.quiz')), '42501');
  perform pg_temp.expect_error(format('select public.student_get_report(%L)', gen_random_uuid()), '42501');
  perform pg_temp.ok(true, 'anon: every student_* call denied with 42501');
end $$;
reset role;

-- ------------------------------------------------------- 2-6. student A
select set_config('request.jwt.claims', pg_temp.claims('a'), true);
set local role authenticated;
do $$
declare
  v       jsonb;
  v_att   uuid;
  v_rep   jsonb;
  v_rep2  jsonb;
begin
  -- 2. enrolment
  perform pg_temp.expect_error(format('select public.student_get_test_intro(%L)', current_setting('test.quiz')), '42501');
  v := public.student_enroll(current_setting('test.series')::uuid);
  perform pg_temp.ok((v ->> 'already_enrolled')::boolean = false, 'enrol: first call enrols');
  v := public.student_enroll(current_setting('test.series')::uuid);
  perform pg_temp.ok((v ->> 'already_enrolled')::boolean, 'enrol: second call is idempotent');
  perform pg_temp.expect_error(format('select public.student_get_test_intro(%L)', current_setting('test.draft')), 'P0002');
  v := public.student_get_test_intro(current_setting('test.quiz')::uuid);
  perform pg_temp.ok((v ->> 'questions_count')::int = 4 and (v ->> 'total_marks')::numeric = 9
                     and (v ->> 'negative_marking')::boolean and (v ->> 'can_start')::boolean
                     and (v ->> 'violation_limit')::int = 2, 'intro: counts, marks, negative marking, limit');

  -- 3. start: no answers leak
  v := public.student_start_attempt(current_setting('test.quiz')::uuid);
  v_att := (v ->> 'attempt_id')::uuid;
  perform set_config('test.att1', v_att::text, true);
  perform pg_temp.ok(jsonb_array_length(v -> 'questions') = 4 and v::text not like '%is_correct%'
                     and v::text not like '%Paris%' and v::text not like '%Manual grading%',
                     'start: 4 questions, no correct flags, no accepted / model answers');
  perform pg_temp.ok((select bool_and(jsonb_array_length(q -> 'options') = 0)
                        from jsonb_array_elements(v -> 'questions') q
                       where q ->> 'type' in ('fill_in_blank', 'short_answer')),
                     'start: text questions have no options');
  perform pg_temp.ok(v ->> 'deadline' is not null and (v ->> 'resumed')::boolean = false, 'start: deadline set');
  v := public.student_start_attempt(current_setting('test.quiz')::uuid);
  perform pg_temp.ok((v ->> 'attempt_id')::uuid = v_att and (v ->> 'resumed')::boolean, 'start again: resumes the same attempt');

  -- 4. autosave
  perform public.student_save_answer(v_att, current_setting('test.q1')::uuid,
            jsonb_build_object('selected_option_ids', jsonb_build_array(current_setting('test.q1_ok'))));
  perform public.student_save_answer(v_att, current_setting('test.q2')::uuid,
            jsonb_build_object('selected_option_ids', jsonb_build_array(current_setting('test.q2_b'), current_setting('test.q2_a'))));
  perform public.student_save_answer(v_att, current_setting('test.q3')::uuid, '{"answer_text": "  paris "}');
  perform public.student_save_answer(v_att, current_setting('test.q4')::uuid, '{"answer_text": "My essay"}');
  perform pg_temp.expect_error(format('select public.student_save_answer(%L, %L, %L)', v_att, current_setting('test.q1'),
            jsonb_build_object('selected_option_ids', jsonb_build_array(current_setting('test.q2_c')))), '22023');
  perform pg_temp.expect_error(format('select public.student_save_answer(%L, %L, %L)', v_att, gen_random_uuid(),
            '{"answer_text":"x"}'), '22023');
  v := public.student_start_attempt(current_setting('test.quiz')::uuid);
  perform pg_temp.ok(jsonb_array_length(v -> 'saved_answers') = 4, 'resume: 4 saved answers come back');

  -- 5-6. submit + scoring + idempotency
  v_rep := public.student_submit_attempt(v_att);
  perform pg_temp.ok((v_rep #>> '{summary,score}')::numeric = 4 and (v_rep #>> '{summary,max_score}')::numeric = 4
                     and (v_rep #>> '{summary,percentage}')::numeric = 100,
                     'score: single 1 + multi 2 + fill-in-blank 1 = 4 / 4 (manual excluded)');
  perform pg_temp.ok((v_rep #>> '{summary,pending_count}')::int = 1 and (v_rep #>> '{summary,provisional}')::boolean
                     and (v_rep #>> '{summary,pending_marks}')::numeric = 5, 'score: subjective is pending, 5 marks');
  perform pg_temp.ok((v_rep #>> '{summary,status}') = 'submitted' and (v_rep #>> '{summary,passed}')::boolean,
                     'submit: status submitted, passed');
  perform pg_temp.ok((select q ->> 'correct_answer' from jsonb_array_elements(v_rep -> 'questions') q
                       where q ->> 'type' = 'short_answer') is null,
                     'report: the manual-grading placeholder is never shown as the answer');
  perform pg_temp.ok(jsonb_array_length(v_rep #> '{breakdowns,by_topic}') = 2, 'report: topic breakdown');
  v_rep2 := public.student_submit_attempt(v_att);
  perform pg_temp.ok(v_rep2 = v_rep, 'submit again: same stored report');
  perform pg_temp.ok(public.student_get_report(v_att) = v_rep, 'get_report: returns the stored report');
  perform pg_temp.expect_error(format('select public.student_save_answer(%L, %L, %L)', v_att, current_setting('test.q3'),
            '{"answer_text":"x"}'), 'P0001');
end $$;
reset role;

-- --------------------------------------------- 4b. student B is isolated
select set_config('request.jwt.claims', pg_temp.claims('b'), true);
set local role authenticated;
do $$
begin
  perform pg_temp.expect_error(format('select public.student_get_report(%L)', current_setting('test.att1')), 'P0002');
  perform pg_temp.expect_error(format('select public.student_submit_attempt(%L)', current_setting('test.att1')), 'P0002');
  perform pg_temp.expect_error(format('select public.student_save_answer(%L, %L, %L)', current_setting('test.att1'),
            current_setting('test.q3'), '{"answer_text":"x"}'), 'P0002');
  perform pg_temp.expect_error(format('select public.student_log_proctor_event(%L, %L)', current_setting('test.att1'),
            'window_blur'), 'P0002');
  perform pg_temp.ok(((public.student_my_history()) ->> 'total')::int = 0, 'isolation: B sees none of A''s attempts');
end $$;
reset role;

-- ------------------------------------- 7-8. deadline and attempt limit (A)
select set_config('request.jwt.claims', pg_temp.claims('a'), true);
set local role authenticated;
do $$
declare v jsonb;
begin
  v := public.student_start_attempt(current_setting('test.quiz')::uuid);
  perform set_config('test.att2', v ->> 'attempt_id', true);
  perform pg_temp.ok((v ->> 'attempt_number')::int = 2, 'attempt 2 started');
  perform public.student_save_answer((v ->> 'attempt_id')::uuid, current_setting('test.q1')::uuid,
            jsonb_build_object('selected_option_ids', jsonb_build_array(current_setting('test.q1_bad'))));
end $$;
reset role;

update public.quiz_attempts set started_at = now() - interval '31 minutes' where id = current_setting('test.att2')::uuid;

set local role authenticated;
do $$
declare v jsonb;
begin
  perform pg_temp.expect_error(format('select public.student_save_answer(%L, %L, %L)', current_setting('test.att2'),
            current_setting('test.q3'), '{"answer_text":"Paris"}'), 'P0001');
  v := public.student_submit_attempt(current_setting('test.att2')::uuid);
  perform pg_temp.ok(v #>> '{summary,status}' = 'timed_out' and (v #>> '{summary,auto_submit_reason}') = 'time_up',
                     'deadline: late submit is timed_out');
  perform pg_temp.ok((v #>> '{summary,score}')::numeric = -0.25 and (v #>> '{summary,percentage}')::numeric = 0
                     and (v #>> '{summary,skipped_count}')::int = 3,
                     'scoring: wrong single choice = -0.25, percentage floors at 0, 3 skipped (no penalty)');
  perform pg_temp.expect_error(format('select public.student_start_attempt(%L)', current_setting('test.quiz')), 'P0001');
  perform pg_temp.ok(true, 'attempt limit: a 3rd attempt is refused');
end $$;

-- ------------------------------------------------------------ 9. proctor
do $$
declare v jsonb; v_att uuid;
begin
  v := public.student_start_attempt(current_setting('test.quiz2')::uuid);
  v_att := (v ->> 'attempt_id')::uuid;
  perform set_config('test.att3', v_att::text, true);
  perform pg_temp.expect_error(format('select public.student_log_proctor_event(%L, %L)', v_att, 'teleport'), '22023');
  v := public.student_log_proctor_event(v_att, 'window_blur', '{"at":"q1"}');
  perform pg_temp.ok((v ->> 'counted')::boolean and (v ->> 'violations_count')::int = 1
                     and (v ->> 'auto_submitted')::boolean = false and (v ->> 'remaining')::int = 0,
                     'proctor: first violation counted, limit not exceeded');
  v := public.student_log_proctor_event(v_att, 'visibility_hidden');
  perform pg_temp.ok((v ->> 'counted')::boolean = false and (v ->> 'violations_count')::int = 1,
                     'proctor: blur + visibilitychange of one switch counts once');
  v := public.student_log_proctor_event(v_att, 'fullscreen_enter');
  perform pg_temp.ok((v ->> 'counted')::boolean = false, 'proctor: informational events are not violations');
end $$;
reset role;

update public.attempt_proctor_events set occurred_at = now() - interval '10 seconds'
 where attempt_id = current_setting('test.att3')::uuid;

set local role authenticated;
do $$
declare v jsonb;
begin
  v := public.student_log_proctor_event(current_setting('test.att3')::uuid, 'copy');
  perform pg_temp.ok((v ->> 'auto_submitted')::boolean and v ->> 'auto_submit_reason' = 'proctor_limit'
                     and v ->> 'status' = 'submitted', 'proctor: 2 violations > limit 1 auto-submits');
  v := public.student_get_report(current_setting('test.att3')::uuid);
  perform pg_temp.ok(v #>> '{summary,auto_submit_reason}' = 'proctor_limit'
                     and (v #>> '{summary,violations_count}')::int = 2, 'proctor: noted in the report');

  -- 10. shapes
  v := public.student_get_stats();
  perform pg_temp.ok((v ->> 'tests_taken')::int = 2 and (v ->> 'attempts_taken')::int = 3
                     and (v ->> 'series_enrolled')::int = 1 and (v ->> 'current_streak')::int = 1,
                     'stats: 2 tests, 3 attempts, 1 series, streak 1');
  v := public.student_dashboard();
  perform pg_temp.ok(v ?& array['continue_learning', 'enrolled_series', 'recent_history', 'stats', 'recommended_series'],
                     'dashboard: all sections present');
  v := public.student_my_history(1, 2);
  perform pg_temp.ok((v ->> 'total')::int = 3 and jsonb_array_length(v -> 'items') = 2 and (v ->> 'total_pages')::int = 2,
                     'history: paginated');
  v := public.student_my_series();
  perform pg_temp.ok(jsonb_array_length(v) = 1 and (v -> 0 ->> 'tests_attempted')::int = 2, 'my series: progress');
  v := public.student_get_series(current_setting('test.series')::uuid);
  perform pg_temp.ok(jsonb_array_length(v -> 'tests') = 2 and (v ->> 'is_enrolled')::boolean, 'get_series: tests + enrolment');
  raise notice 'ok: all student RPC checks passed';
end $$;
reset role;

rollback;
