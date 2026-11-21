-- =====================================================================
-- supabase/tests/written_answers_fixes.sql
--
-- Tests for 20261121090000_admin_written_answers_fixes.sql (QA, 21 Nov).
-- LOCAL / DISPOSABLE DATABASE ONLY. Everything is rolled back.
--
-- Covers
--   1. the model answer of a written question is hidden in the student's
--      report until the marks are published (MCQ answers unchanged); shown after
--   3. after submitting: pages can be added but not removed; a file removed
--      during the test is kept for the teacher (removed_uploads) and hidden from
--      the student; uploads after submitting are flagged
--   4. the upload window is set per test (default 15, clamped 0..120); 0 means
--      only during the test; student and teacher see the same closing time
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

create function pg_temp.upload(p_attempt uuid, p_question uuid) returns jsonb
language plpgsql as $$
declare v jsonb; v_path text;
begin
  v := public.student_answer_upload_slot(p_attempt, p_question, 'image/jpeg', 1000);
  if not (v ->> 'allowed')::boolean then raise exception 'slot refused: %', v ->> 'error' using errcode = '22023'; end if;
  v_path := (v ->> 'student_id') || '/' || p_attempt || '/' || p_question || '/' || gen_random_uuid() || '.jpg';
  insert into storage.objects (bucket_id, name, metadata) values ('answer-uploads', v_path, jsonb_build_object('size', 2048));
  return public.student_register_answer_upload(p_attempt, p_question, v_path, 'page.jpg', 'image/jpeg', 1000);
end $$;

create function pg_temp.row_of(p_report jsonb, p_question uuid) returns jsonb
language sql as $$ select x from jsonb_array_elements(p_report -> 'questions') x where x ->> 'question_id' = p_question::text $$;

do $fx$
declare
  v_admin uuid := gen_random_uuid(); v_s1 uuid := gen_random_uuid(); v_s2 uuid := gen_random_uuid(); u uuid;
  v_series uuid; v_test uuid;
begin
  foreach u in array array[v_admin, v_s1, v_s2] loop
    insert into auth.users (id, email) values (u, 'wf-' || u || '@test.local');
  end loop;
  insert into public.profiles (id, role, full_name, email) values
    (v_admin, 'admin', 'WF Admin', 'wf-' || v_admin || '@test.local'),
    (v_s1, 'student', 'Student One', 'wf-' || v_s1 || '@test.local'),
    (v_s2, 'student', 'Student Two', 'wf-' || v_s2 || '@test.local');
  insert into public.adm_admin_users (user_id) values (v_admin);
  perform pg_temp.act_as(v_admin);
  v_series := public.upsert_test_series_full(jsonb_build_object(
    'name', 'Optics (fixes)', 'pricing', 'free', 'startMethod', 'scratch',
    'availability', jsonb_build_object('goLive', 'now', 'mode', 'always'),
    'tests', jsonb_build_array(jsonb_build_object('name', 'Lenses', 'duration', '60', 'passingPercent', '40', 'attemptLimit', '5',
      'totalMarks', '14',
      'questions', jsonb_build_array(
        jsonb_build_object('type', 'mcq_single', 'text', 'Unit of power of a lens?', 'marks', '4',
          'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', 'Dioptre'), jsonb_build_object('key', 'B', 'text', 'Metre')),
          'correctAnswers', jsonb_build_array('A'), 'explanation', 'P = 1/f in metres.'),
        jsonb_build_object('type', 'subjective', 'text', 'Derive the lens formula.', 'marks', '10',
          'modelAnswer', '1/v - 1/u = 1/f', 'explanation', 'Similar triangles.'))))), true);
  v_test := ((public.get_test_series(v_series)) #>> '{tests,0,id}')::uuid;
  perform pg_temp.remember('admin', v_admin); perform pg_temp.remember('s1', v_s1); perform pg_temp.remember('s2', v_s2);
  perform pg_temp.remember('series', v_series); perform pg_temp.remember('test', v_test);
  perform pg_temp.remember('q_mcq', (select id from public.quiz_questions where quiz_id = v_test and question_type = 'multiple_choice'));
  perform pg_temp.remember('q_w', (select id from public.quiz_questions where quiz_id = v_test and question_type = 'short_answer'));
end $fx$;

-- -------------------------------------------- 4. the setting (default 15, clamped)
do $$
declare v jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('admin'));
  perform pg_temp.ok((public.adm_test_json(pg_temp.id('test')) ->> 'answer_upload_minutes')::int = 15, 'default upload time: 15 minutes');
  v := public.update_test(pg_temp.id('test'), jsonb_build_object('answerUploadMinutes', 500));
  perform pg_temp.ok((v ->> 'answer_upload_minutes')::int = 120, 'over the maximum: clamped to 120');
  v := public.update_test(pg_temp.id('test'), jsonb_build_object('answerUploadMinutes', 30));
  perform pg_temp.ok((v ->> 'answer_upload_minutes')::int = 30, 'set to 30 minutes per test');
  v := public.update_test(pg_temp.id('test'), jsonb_build_object('name', 'Lenses'));
  perform pg_temp.ok((v ->> 'answer_upload_minutes')::int = 30, 'other edits keep it');
end $$;

-- -------------------------------------------- during the test, then submit
do $$
declare v jsonb; v_att uuid;
begin
  perform pg_temp.act_as(pg_temp.id('s1'));
  perform public.student_enroll(pg_temp.id('series'));
  v := public.student_start_attempt(pg_temp.id('test'));
  v_att := (v ->> 'attempt_id')::uuid;
  perform pg_temp.remember('att', v_att);
  v := pg_temp.upload(v_att, pg_temp.id('q_w'));
  perform pg_temp.ok((v ->> 'can_remove')::boolean and (v ->> 'grace_minutes')::int = 30, 'during the test: files can be removed; 30-minute window');
  v := pg_temp.upload(v_att, pg_temp.id('q_w'));
  perform pg_temp.remember('removed', (v #>> '{uploads,0,id}')::uuid);
  v := public.student_remove_answer_upload((v #>> '{uploads,0,id}')::uuid);
  perform pg_temp.ok(jsonb_array_length(v -> 'uploads') = 1, 'a file removed during the test disappears for the student');
  perform pg_temp.ok((select removed_at is not null from public.answer_uploads where id = pg_temp.id('removed')), 'but it is kept, marked removed');
  perform pg_temp.expect_error(format('select public.adm_answer_upload_access(%L)', pg_temp.id('removed')), 'P0002');
  perform pg_temp.ok(true, 'and the student can''t open it any more');
  perform public.student_save_answer(v_att, pg_temp.id('q_mcq'), jsonb_build_object('selected_option_ids',
    (select jsonb_agg(o.id) from public.quiz_question_options o where o.question_id = pg_temp.id('q_mcq') and o.option_text = 'Dioptre')));
  perform public.student_submit_attempt(v_att);
end $$;

-- -------------------------------------------- 1. model answer hidden until published
do $$
declare v jsonb; r jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('s1'));
  v := public.student_get_report(pg_temp.id('att'));
  r := pg_temp.row_of(v, pg_temp.id('q_w'));
  perform pg_temp.ok(r ->> 'status' = 'pending' and r -> 'correct_answer' = 'null'::jsonb and r -> 'explanation' = 'null'::jsonb
                     and (r ->> 'model_answer_pending')::boolean, 'pending written answer: no model answer, no explanation');
  r := pg_temp.row_of(v, pg_temp.id('q_mcq'));
  perform pg_temp.ok(r ->> 'correct_answer' = 'Dioptre' and r ->> 'explanation' = 'P = 1/f in metres.', 'the MCQ answer is still shown');
  perform pg_temp.ok((select report #>> '{questions,1,correct_answer}' from public.attempt_reports where attempt_id = pg_temp.id('att')) is not null
                     or exists (select 1 from jsonb_array_elements((select report -> 'questions' from public.attempt_reports where attempt_id = pg_temp.id('att'))) x
                                 where x ->> 'question_id' = pg_temp.id('q_w')::text and x ->> 'correct_answer' = '1/v - 1/u = 1/f'),
                     'the stored report keeps it (shown after marking)');
end $$;

-- -------------------------------------------- 3. after submitting: add only, flagged
do $$
declare v jsonb; g jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('s1'));
  update public.quiz_attempts set submitted_at = now() - interval '20 minutes' where id = pg_temp.id('att');
  -- now() doesn't move inside one transaction: put the test-time uploads before the submit
  update public.answer_uploads set created_at = now() - interval '25 minutes' where attempt_id = pg_temp.id('att');
  v := public.student_list_answer_uploads(pg_temp.id('att'));
  perform pg_temp.ok((v ->> 'can_upload')::boolean and not (v ->> 'can_remove')::boolean,
                     '20 minutes after submitting with a 30-minute window: can add, can''t remove');
  perform pg_temp.expect_error(format('select public.student_remove_answer_upload(%L)', v #>> '{uploads,0,id}'), '22023');
  perform pg_temp.ok(true, 'removing after submitting is refused');
  v := pg_temp.upload(pg_temp.id('att'), pg_temp.id('q_w'));
  perform pg_temp.ok(jsonb_array_length(v -> 'uploads') = 2, 'adding a page after submitting works');

  perform pg_temp.act_as(pg_temp.id('admin'));
  g := public.grading_get_attempt(pg_temp.id('att'));
  perform pg_temp.ok((g ->> 'upload_window_minutes')::int = 30, 'the teacher sees the 30-minute rule');
  perform pg_temp.ok(jsonb_array_length(g #> '{questions,0,uploads}') = 2
                     and not (g #>> '{questions,0,uploads,0,after_submission}')::boolean
                     and (g #>> '{questions,0,uploads,1,after_submission}')::boolean,
                     'current files: one from the test, one flagged "after submitting"');
  perform pg_temp.ok(jsonb_array_length(g #> '{questions,0,removed_uploads}') = 1
                     and g #>> '{questions,0,removed_uploads,0,removed_at}' is not null, 'the removed file is in the history, with its time');
  perform pg_temp.ok(public.adm_answer_upload_access(pg_temp.id('removed')) ? 'path', 'and the teacher can open it');
  perform pg_temp.act_as(pg_temp.id('s1'));
  perform pg_temp.ok((public.student_list_answer_uploads(pg_temp.id('att')) ->> 'window_closes_at')::timestamptz
                     = (g ->> 'upload_window_closes_at')::timestamptz, 'student and teacher see the same closing time');

  update public.quiz_attempts set submitted_at = now() - interval '31 minutes' where id = pg_temp.id('att');
  v := public.student_answer_upload_slot(pg_temp.id('att'), pg_temp.id('q_w'), 'image/jpeg', 1000);
  perform pg_temp.ok(not (v ->> 'allowed')::boolean, 'after 30 minutes uploads close');
end $$;

-- -------------------------------------------- publish: the model answer appears
do $$
declare v jsonb; r jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('admin'));
  perform public.grading_save(pg_temp.id('att'), jsonb_build_array(jsonb_build_object('question_id', pg_temp.id('q_w'), 'marks', 7)), null, true);
  perform pg_temp.act_as(pg_temp.id('s1'));
  r := pg_temp.row_of(public.student_get_report(pg_temp.id('att')), pg_temp.id('q_w'));
  perform pg_temp.ok(r ->> 'correct_answer' = '1/v - 1/u = 1/f' and not r ? 'model_answer_pending', 'after publishing: the model answer is shown');
end $$;

-- -------------------------------------------- 0 minutes: only during the test
do $$
declare v jsonb; v_att uuid;
begin
  perform pg_temp.act_as(pg_temp.id('admin'));
  perform public.update_test(pg_temp.id('test'), jsonb_build_object('answerUploadMinutes', 0));
  perform pg_temp.act_as(pg_temp.id('s2'));
  perform public.student_enroll(pg_temp.id('series'));
  v := public.student_start_attempt(pg_temp.id('test'));
  v_att := (v ->> 'attempt_id')::uuid;
  perform public.student_submit_attempt(v_att);
  update public.quiz_attempts set submitted_at = now() - interval '1 second' where id = v_att;
  v := public.student_answer_upload_slot(v_att, pg_temp.id('q_w'), 'image/jpeg', 1000);
  perform pg_temp.ok(not (v ->> 'allowed')::boolean and (public.student_list_answer_uploads(v_att) ->> 'grace_minutes')::int = 0,
                     '0 minutes: no uploads once submitted');
end $$;

do $$ begin raise notice 'ok: all written answer fix checks passed'; end $$;
rollback;
