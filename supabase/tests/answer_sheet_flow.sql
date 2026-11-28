-- =====================================================================
-- supabase/tests/answer_sheet_flow.sql
--
-- Written answers: typed during the test, answer sheet (PDF / photos) uploaded
-- AFTER the test in a short window, marked by the series educator or an admin.
-- Covers 20261120090000 (marking), 20261121090000 (model answer, history,
-- per-test time) and 20261128090000 (the answer-sheet flow). Replaces the
-- earlier written_answers.sql / written_answers_fixes.sql (per-question
-- uploads during the test, now retired).
-- LOCAL / DISPOSABLE DATABASE ONLY. Everything is rolled back.
--
--   1. no uploads during the test (sheet and the retired per-question path)
--   2. per-test window: default 5, clamped 0..120
--   3. after finishing: sheet files (PDF / photo), removable until Submit and
--      kept as history; written answers without text become pending
--   4. model answer hidden until published; shown after, by the final result
--   5. Submit closes the sheet at once; graders can publish immediately
--   6. graders: the sheet, removed files, submit time; candidate code; others refused
--   7. publish: score, statuses, feedback, notification
--   8. a violation auto-submit gets no window; an expired window refuses
--   9. a test without written questions has no sheet
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
  if not coalesce(p_cond, false) then raise exception 'FAILED: %', p_what; end if;
  raise notice 'ok: %', p_what;
end $$;

create function pg_temp.act_as(p_user uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.id(p_key text) returns uuid
language sql as $$ select nullif(current_setting('test.' || p_key, true), '')::uuid $$;

create function pg_temp.remember(p_key text, p_id uuid) returns uuid
language sql as $$ select set_config('test.' || p_key, p_id::text, true)::uuid $$;

-- What the Edge Function + browser do for a sheet file: slot, "PUT", register.
create function pg_temp.sheet_upload(p_attempt uuid, p_type text default 'application/pdf') returns jsonb
language plpgsql as $$
declare v jsonb; v_path text; v_ext text;
begin
  v := public.student_sheet_upload_slot(p_attempt, p_type, 1000);
  if not (v ->> 'allowed')::boolean then raise exception 'slot refused: %', v ->> 'error' using errcode = '22023'; end if;
  v_ext := case p_type when 'application/pdf' then 'pdf' when 'image/png' then 'png' else 'jpg' end;
  v_path := (v ->> 'student_id') || '/' || p_attempt || '/sheet/' || gen_random_uuid() || '.' || v_ext;
  insert into storage.objects (bucket_id, name, metadata) values ('answer-uploads', v_path, jsonb_build_object('size', 2048));
  return public.student_register_sheet_upload(p_attempt, v_path, 'sheet.' || v_ext, p_type, 1000);
end $$;

create function pg_temp.row_of(p_report jsonb, p_question uuid) returns jsonb
language sql as $$ select x from jsonb_array_elements(p_report -> 'questions') x where x ->> 'question_id' = p_question::text $$;

do $fx$
declare
  v_admin uuid := gen_random_uuid(); v_e1 uuid := gen_random_uuid(); v_e2 uuid := gen_random_uuid();
  v_s1 uuid := gen_random_uuid(); v_s2 uuid := gen_random_uuid(); v_s3 uuid := gen_random_uuid(); u uuid;
  v_series uuid; v_test uuid; v_mcq_series uuid;
begin
  foreach u in array array[v_admin, v_e1, v_e2, v_s1, v_s2, v_s3] loop
    insert into auth.users (id, email) values (u, 'as-' || u || '@test.local');
  end loop;
  insert into public.profiles (id, role, full_name, email) values
    (v_admin, 'admin', 'AS Admin', 'as-' || v_admin || '@test.local'),
    (v_e1, 'educator', 'Ashika', 'as-' || v_e1 || '@test.local'),
    (v_e2, 'educator', 'Ravi', 'as-' || v_e2 || '@test.local'),
    (v_s1, 'student', 'Riya Sen', 'as-' || v_s1 || '@test.local'),
    (v_s2, 'student', 'Student Two', 'as-' || v_s2 || '@test.local'),
    (v_s3, 'student', 'Student Three', 'as-' || v_s3 || '@test.local');
  insert into public.adm_admin_users (user_id) values (v_admin);
  insert into public.educator_profiles (user_id, full_name, phone, location, verification_status) values
    (v_e1, 'Ashika', '9000000051', 'Pune', 'verified'), (v_e2, 'Ravi', '9000000052', 'Goa', 'verified');
  perform public.adm_backfill_educator_approvals();

  -- e1's series (approved): one MCQ, two written questions; answers shown only if passed.
  perform pg_temp.act_as(v_e1);
  v_series := public.upsert_test_series_full(jsonb_build_object(
    'name', 'Mechanics (sheet)', 'pricing', 'free', 'startMethod', 'scratch',
    'availability', jsonb_build_object('goLive', 'now', 'mode', 'always'),
    'tests', jsonb_build_array(jsonb_build_object('name', 'Motion', 'duration', '60', 'passingPercent', '50', 'attemptLimit', '5',
      'totalMarks', '24', 'showAnswersAfter', 'passing',
      'questions', jsonb_build_array(
        jsonb_build_object('type', 'mcq_single', 'text', 'SI unit of force?', 'marks', '4',
          'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', 'Newton'), jsonb_build_object('key', 'B', 'text', 'Joule')),
          'correctAnswers', jsonb_build_array('A')),
        jsonb_build_object('type', 'subjective', 'text', 'State Newton''s second law.', 'marks', '10',
          'modelAnswer', 'F = ma', 'answerInstructions', '5 + 5'),
        jsonb_build_object('type', 'subjective', 'text', 'Derive v = u + at.', 'marks', '10', 'modelAnswer', 'a = (v - u) / t'))))), false);
  perform public.educator_submit_series_for_approval(v_series);
  perform pg_temp.act_as(v_admin);
  perform public.approve_educator_series(v_series);
  v_test := ((public.get_test_series(v_series)) #>> '{tests,0,id}')::uuid;
  perform public.update_test(v_test, jsonb_build_object('showAnswersAfter', 'passing'));

  -- An MCQ-only series for section 9.
  v_mcq_series := public.upsert_test_series_full(jsonb_build_object(
    'name', 'MCQ only (sheet)', 'pricing', 'free', 'startMethod', 'scratch',
    'availability', jsonb_build_object('goLive', 'now', 'mode', 'always'),
    'tests', jsonb_build_array(jsonb_build_object('name', 'Quick', 'duration', '10', 'passingPercent', '40', 'attemptLimit', '5', 'totalMarks', '1',
      'questions', jsonb_build_array(jsonb_build_object('type', 'mcq_single', 'text', '2 + 2?', 'marks', '1',
        'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', '4'), jsonb_build_object('key', 'B', 'text', '5')),
        'correctAnswers', jsonb_build_array('A')))))), true);

  perform pg_temp.remember('admin', v_admin); perform pg_temp.remember('e1', v_e1); perform pg_temp.remember('e2', v_e2);
  perform pg_temp.remember('s1', v_s1); perform pg_temp.remember('s2', v_s2); perform pg_temp.remember('s3', v_s3);
  perform pg_temp.remember('series', v_series); perform pg_temp.remember('test', v_test);
  perform pg_temp.remember('mcq_series', v_mcq_series);
  perform pg_temp.remember('mcq_test', (select id from public.quizzes where series_id = v_mcq_series));
  perform pg_temp.remember('q_mcq', (select id from public.quiz_questions where quiz_id = v_test and question_type = 'multiple_choice'));
  perform pg_temp.remember('q_law', (select id from public.quiz_questions where quiz_id = v_test and question_text like 'State%'));
  perform pg_temp.remember('q_der', (select id from public.quiz_questions where quiz_id = v_test and question_text like 'Derive%'));
end $fx$;

-- -------------------------------------------- 2. the per-test window
do $$
declare v jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('admin'));
  perform pg_temp.ok((public.adm_test_json(pg_temp.id('test')) ->> 'answer_upload_minutes')::int = 5, 'default answer-sheet time: 5 minutes');
  v := public.update_test(pg_temp.id('test'), jsonb_build_object('answerUploadMinutes', 500));
  perform pg_temp.ok((v ->> 'answer_upload_minutes')::int = 120, 'clamped to 120');
  v := public.update_test(pg_temp.id('test'), jsonb_build_object('answerUploadMinutes', 5));
  perform pg_temp.ok((v ->> 'answer_upload_minutes')::int = 5, 'back to 5');
end $$;

-- -------------------------------------------- 1. nothing during the test
do $$
declare v jsonb; v_att uuid;
begin
  perform pg_temp.act_as(pg_temp.id('s1'));
  perform public.student_enroll(pg_temp.id('series'));
  v := public.student_start_attempt(pg_temp.id('test'));
  v_att := (v ->> 'attempt_id')::uuid;
  perform pg_temp.remember('att', v_att);
  v := public.student_sheet_status(v_att);
  perform pg_temp.ok((v ->> 'has_written')::boolean and not (v ->> 'can_upload')::boolean and v ->> 'problem' like 'Finish the test first%'
                     and (v ->> 'grace_minutes')::int = 5, 'during the test: no sheet upload ("finish first"), 5-minute window announced');
  v := public.student_sheet_upload_slot(v_att, 'application/pdf', 1000);
  perform pg_temp.ok(not (v ->> 'allowed')::boolean, 'the sheet slot refuses during the test');
  v := public.student_answer_upload_slot(v_att, pg_temp.id('q_law'), 'image/jpeg', 1000);
  perform pg_temp.ok(not (v ->> 'allowed')::boolean and v ->> 'error' like '%after you finish the test%', 'the retired per-question upload refuses too');
  perform public.student_save_answer(v_att, pg_temp.id('q_mcq'), jsonb_build_object('selected_option_ids',
    (select jsonb_agg(o.id) from public.quiz_question_options o where o.question_id = pg_temp.id('q_mcq') and o.option_text = 'Newton')));
  perform public.student_save_answer(v_att, pg_temp.id('q_law'), jsonb_build_object('answer_text', 'Force equals mass times acceleration.'));
  perform public.student_submit_attempt(v_att);
end $$;

-- -------------------------------------------- 3. after finishing: the sheet
do $$
declare v jsonb; r jsonb; g jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('s1'));
  v := public.student_sheet_status(pg_temp.id('att'));
  perform pg_temp.ok((v ->> 'can_upload')::boolean and (v ->> 'window_closes_at')::timestamptz
                       = (select submitted_at + interval '5 minutes' from public.quiz_attempts where id = pg_temp.id('att')),
                     'finished: the sheet is open until submit time + 5 minutes');
  r := pg_temp.row_of(public.student_get_report(pg_temp.id('att')), pg_temp.id('q_der'));
  perform pg_temp.ok(r ->> 'status' = 'skipped', 'before any sheet, the untyped written answer is skipped');

  v := pg_temp.sheet_upload(pg_temp.id('att'), 'image/jpeg');
  perform pg_temp.remember('photo', (v #>> '{uploads,0,id}')::uuid);
  v := pg_temp.sheet_upload(pg_temp.id('att'), 'application/pdf');
  perform pg_temp.ok(jsonb_array_length(v -> 'uploads') = 2, 'a photo and a PDF on the sheet');
  v := public.student_remove_sheet_upload(pg_temp.id('photo'));
  perform pg_temp.ok(jsonb_array_length(v -> 'uploads') = 1, 'a file can be removed before Submit');
  perform pg_temp.ok((select removed_at is not null from public.answer_uploads where id = pg_temp.id('photo')), 'and it is kept as removed');
  r := pg_temp.row_of(public.student_get_report(pg_temp.id('att')), pg_temp.id('q_der'));
  perform pg_temp.ok(r ->> 'status' = 'pending', 'with a sheet, the untyped written answer becomes pending');

  -- 4. model answer hidden before publishing
  perform pg_temp.ok(r -> 'correct_answer' = 'null'::jsonb and (r ->> 'model_answer_pending')::boolean, 'no model answer before marking');

  perform pg_temp.act_as(pg_temp.id('e1'));
  g := public.grading_get_attempt(pg_temp.id('att'));
  perform pg_temp.ok(not (g ->> 'can_publish')::boolean, 'while the student is still on the sheet screen, publishing waits');
end $$;

-- -------------------------------------------- 5. Submit closes the sheet
do $$
declare v jsonb; g jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('s1'));
  v := public.student_submit_answer_sheet(pg_temp.id('att'));
  perform pg_temp.ok(not (v ->> 'can_upload')::boolean and v ->> 'sheet_submitted_at' is not null
                     and v ->> 'problem' like '%already submitted%', 'Submit: the sheet is closed for good');
  perform pg_temp.ok((public.student_submit_answer_sheet(pg_temp.id('att')) ->> 'sheet_submitted_at') = v ->> 'sheet_submitted_at', 'Submit is idempotent');
  v := public.student_sheet_upload_slot(pg_temp.id('att'), 'application/pdf', 1000);
  perform pg_temp.ok(not (v ->> 'allowed')::boolean, 'no uploads after Submit');
  perform pg_temp.expect_error(format('select public.student_remove_sheet_upload(%L)',
    (select id from public.answer_uploads where attempt_id = pg_temp.id('att') and removed_at is null limit 1)), '22023');
  perform pg_temp.ok(true, 'and no removing');

  -- 6. graders
  perform pg_temp.act_as(pg_temp.id('e1'));
  g := public.grading_get_attempt(pg_temp.id('att'));
  perform pg_temp.ok((g ->> 'can_publish')::boolean, 'after Submit the evaluator can publish straight away');
  perform pg_temp.ok(jsonb_array_length(g #> '{sheet,files}') = 1 and g #>> '{sheet,files,0,content_type}' = 'application/pdf'
                     and g #>> '{sheet,files,0,created_at}' is not null and jsonb_array_length(g #> '{sheet,removed}') = 1
                     and g #>> '{sheet,submitted_at}' is not null, 'the evaluator sees the sheet, its time, the removed photo and the submit time');
  perform pg_temp.ok(g #>> '{attempt,candidate}' like 'Candidate %' and not (g -> 'attempt') ? 'student_name', 'educator: candidate code only');
  perform pg_temp.ok(public.adm_answer_upload_access(pg_temp.id('photo')) ? 'path', 'the evaluator can open the removed photo');
  perform pg_temp.act_as(pg_temp.id('e2'));
  perform pg_temp.expect_error(format('select public.grading_get_attempt(%L)', pg_temp.id('att')), '42501');
  perform pg_temp.act_as(pg_temp.id('s2'));
  perform pg_temp.expect_error(format('select public.student_sheet_status(%L)', pg_temp.id('att')), 'P0002');
  perform pg_temp.ok(true, 'another educator and another student are refused');
end $$;

-- -------------------------------------------- 7. publish; model answer by the final result
do $$
declare v jsonb; r jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('e1'));
  perform pg_temp.expect_error(format('select public.grading_save(%L, %L)', pg_temp.id('att'),
    jsonb_build_array(jsonb_build_object('question_id', pg_temp.id('q_law'), 'marks', 11))), '22023');
  v := public.grading_save(pg_temp.id('att'), jsonb_build_array(
         jsonb_build_object('question_id', pg_temp.id('q_law'), 'marks', 8, 'feedback', 'Add the formula.'),
         jsonb_build_object('question_id', pg_temp.id('q_der'), 'marks', 10, 'feedback', 'Clear.')), 'Good work.', true);
  perform pg_temp.ok(v #>> '{evaluation,status}' = 'published', 'published right after Submit');
  perform pg_temp.act_as(pg_temp.id('s1'));
  v := public.student_get_report(pg_temp.id('att'));
  perform pg_temp.ok((v #>> '{summary,score}')::numeric = 22 and (v #>> '{summary,max_score}')::numeric = 24 and (v #>> '{summary,passed}')::boolean,
                     'report: 22 of 24, passed');
  r := pg_temp.row_of(v, pg_temp.id('q_der'));
  perform pg_temp.ok(r ->> 'correct_answer' = 'a = (v - u) / t' and not r ? 'model_answer_pending',
                     'after publishing, "show answers if passed" + passed: the model answer is shown');
  perform pg_temp.ok(r #>> '{teacher_evaluation,feedback}' = 'Clear.', 'with the teacher''s feedback');
  perform pg_temp.ok(exists (select 1 from public.notifications where user_id = pg_temp.id('s1') and category = 'assessment_result'),
                     'the student is notified once the marks are published');
end $$;

-- -------------------------------------------- 8. violations: no window; expiry
do $$
declare v jsonb; v_att uuid;
begin
  perform pg_temp.act_as(pg_temp.id('s2'));
  perform public.student_enroll(pg_temp.id('series'));
  v := public.student_start_attempt(pg_temp.id('test'));
  v_att := (v ->> 'attempt_id')::uuid;
  perform public.adm_finalize_attempt(v_att, 'proctor_limit');
  v := public.student_sheet_status(v_att);
  perform pg_temp.ok(not (v ->> 'can_upload')::boolean and v ->> 'problem' like '%too many violations%', 'auto-submitted for violations: no answer sheet');
  perform pg_temp.act_as(pg_temp.id('admin'));
  perform pg_temp.ok((public.grading_get_attempt(v_att) ->> 'can_publish')::boolean, 'and the evaluator can publish at once');

  perform pg_temp.act_as(pg_temp.id('s3'));
  perform public.student_enroll(pg_temp.id('series'));
  v := public.student_start_attempt(pg_temp.id('test'));
  v_att := (v ->> 'attempt_id')::uuid;
  perform public.student_submit_attempt(v_att);
  update public.quiz_attempts set submitted_at = now() - interval '6 minutes' where id = v_att;
  v := public.student_sheet_status(v_att);
  perform pg_temp.ok(not (v ->> 'can_upload')::boolean and v ->> 'problem' like '%time to upload%', '6 minutes later: the sheet window is over');
  v := public.student_submit_answer_sheet(v_att);
  perform pg_temp.ok((v ->> 'sheet_submitted_at')::timestamptz <= (v ->> 'window_closes_at')::timestamptz or v ->> 'window_closes_at' is null,
                     'a late Submit is recorded at the window''s end at the latest');
end $$;

-- -------------------------------------------- 9. no written questions, no sheet
do $$
declare v jsonb; v_att uuid;
begin
  perform pg_temp.act_as(pg_temp.id('s3'));
  perform public.student_enroll(pg_temp.id('mcq_series'));
  v := public.student_start_attempt(pg_temp.id('mcq_test'));
  v_att := (v ->> 'attempt_id')::uuid;
  perform public.student_submit_attempt(v_att);
  v := public.student_sheet_status(v_att);
  perform pg_temp.ok(not (v ->> 'has_written')::boolean and not (v ->> 'can_upload')::boolean, 'an MCQ-only test has no answer sheet');
end $$;

do $$ begin raise notice 'ok: all answer sheet flow checks passed'; end $$;
rollback;
