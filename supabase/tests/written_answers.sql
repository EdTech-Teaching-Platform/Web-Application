-- =====================================================================
-- supabase/tests/written_answers.sql
--
-- Tests for 20261120090000_admin_written_answers.sql: typed or uploaded
-- written answers, marked by the series educator or an admin.
-- LOCAL / DISPOSABLE DATABASE ONLY. Never run it against the lead's project.
-- Everything runs in one transaction and is rolled back.
--
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/written_answers.sql
--
-- Covers
--   1. upload slot: own attempt only, written questions only, type / size,
--      5 files per answer; register checks the path and that the file arrived
--   2. submit: a typed answer and an upload-only answer are 'pending'; a blank
--      one is 'skipped'; the score leaves pending answers out
--   3. grace window: an upload 5 minutes after submitting makes a skipped
--      answer pending; after 15 minutes uploads and removals are refused
--   4. file access: the student, the series educator and admins; not another
--      student or another educator
--   5. grading: list (educator sees a candidate code, admin the name); another
--      educator refused; draft; publish waits for the window and needs every
--      answered question marked; marks over the maximum refused; publish
--      sets score, statuses, feedback, report.teacher, quiz_answers and a
--      notification; re-publish updates; uploads locked after publishing
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

-- What the Edge Function + browser do: slot, "PUT" (a storage.objects row), register.
create function pg_temp.upload(p_attempt uuid, p_question uuid, p_type text default 'image/jpeg') returns jsonb
language plpgsql as $$
declare v jsonb; v_path text; v_ext text;
begin
  v := public.student_answer_upload_slot(p_attempt, p_question, p_type, 1000);
  if not (v ->> 'allowed')::boolean then raise exception 'slot refused: %', v ->> 'error' using errcode = '22023'; end if;
  v_ext := case p_type when 'application/pdf' then 'pdf' when 'image/png' then 'png' else 'jpg' end;
  v_path := (v ->> 'student_id') || '/' || p_attempt || '/' || p_question || '/' || gen_random_uuid() || '.' || v_ext;
  insert into storage.objects (bucket_id, name, metadata) values ('answer-uploads', v_path, jsonb_build_object('size', 2048));
  return public.student_register_answer_upload(p_attempt, p_question, v_path, 'page-1.' || v_ext, p_type, 1000);
end $$;

do $fx$
declare
  v_admin uuid := gen_random_uuid(); v_e1 uuid := gen_random_uuid(); v_e2 uuid := gen_random_uuid();
  v_s1 uuid := gen_random_uuid(); v_s2 uuid := gen_random_uuid(); u uuid;
  v_series uuid; v_test uuid;
begin
  foreach u in array array[v_admin, v_e1, v_e2, v_s1, v_s2] loop
    insert into auth.users (id, email) values (u, 'wa-' || u || '@test.local');
  end loop;
  insert into public.profiles (id, role, full_name, email) values
    (v_admin, 'admin', 'WA Admin', 'wa-' || v_admin || '@test.local'),
    (v_e1, 'educator', 'Ashika', 'wa-' || v_e1 || '@test.local'),
    (v_e2, 'educator', 'Ravi', 'wa-' || v_e2 || '@test.local'),
    (v_s1, 'student', 'Riya Sen', 'wa-' || v_s1 || '@test.local'),
    (v_s2, 'student', 'Other Student', 'wa-' || v_s2 || '@test.local');
  insert into public.adm_admin_users (user_id) values (v_admin);
  insert into public.educator_profiles (user_id, full_name, phone, location, verification_status) values
    (v_e1, 'Ashika', '9000000041', 'Pune', 'verified'), (v_e2, 'Ravi', '9000000042', 'Goa', 'verified');
  perform public.adm_backfill_educator_approvals();

  -- e1's own series (approved by the admin): one MCQ and three written questions.
  perform pg_temp.act_as(v_e1);
  v_series := public.upsert_test_series_full(jsonb_build_object(
    'name', 'Mechanics (written)', 'pricing', 'free', 'startMethod', 'scratch',
    'availability', jsonb_build_object('goLive', 'now', 'mode', 'always'),
    'tests', jsonb_build_array(jsonb_build_object('name', 'Motion', 'duration', '60', 'passingPercent', '40', 'attemptLimit', '3',
      'totalMarks', '34',
      'questions', jsonb_build_array(
        jsonb_build_object('type', 'mcq_single', 'text', 'SI unit of force?', 'marks', '4',
          'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', 'Newton'), jsonb_build_object('key', 'B', 'text', 'Joule')),
          'correctAnswers', jsonb_build_array('A')),
        jsonb_build_object('type', 'subjective', 'text', 'State Newton''s second law.', 'marks', '10',
          'modelAnswer', 'F = ma', 'answerInstructions', '5 for the statement, 5 for the formula.'),
        jsonb_build_object('type', 'subjective', 'text', 'Derive v = u + at.', 'marks', '10'),
        jsonb_build_object('type', 'subjective', 'text', 'Draw a free-body diagram of a block on an incline.', 'marks', '10'))))), false);
  perform public.educator_submit_series_for_approval(v_series);
  perform pg_temp.act_as(v_admin);
  perform public.approve_educator_series(v_series);
  v_test := ((public.get_test_series(v_series)) #>> '{tests,0,id}')::uuid;

  perform pg_temp.remember('admin', v_admin); perform pg_temp.remember('e1', v_e1); perform pg_temp.remember('e2', v_e2);
  perform pg_temp.remember('s1', v_s1); perform pg_temp.remember('s2', v_s2);
  perform pg_temp.remember('series', v_series); perform pg_temp.remember('test', v_test);
  perform pg_temp.remember('q_mcq', (select id from public.quiz_questions where quiz_id = v_test and question_type = 'multiple_choice'));
  perform pg_temp.remember('q_typed', (select id from public.quiz_questions where quiz_id = v_test and question_text like 'State%'));
  perform pg_temp.remember('q_upload', (select id from public.quiz_questions where quiz_id = v_test and question_text like 'Derive%'));
  perform pg_temp.remember('q_blank', (select id from public.quiz_questions where quiz_id = v_test and question_text like 'Draw%'));
end $fx$;

-- ------------------------------------------------- 1. during the test
do $$
declare v jsonb; v_att uuid; v_path text; i int;
begin
  perform pg_temp.ok(pg_temp.id('q_upload') is not null and pg_temp.id('q_blank') is not null, 'fixture: 1 MCQ + 3 written questions');
  perform pg_temp.act_as(pg_temp.id('s1'));
  perform public.student_enroll(pg_temp.id('series'));
  v := public.student_start_attempt(pg_temp.id('test'));
  v_att := (v ->> 'attempt_id')::uuid;
  perform pg_temp.remember('att', v_att);

  v := public.student_answer_upload_slot(v_att, pg_temp.id('q_mcq'), 'image/jpeg', 1000);
  perform pg_temp.ok(not (v ->> 'allowed')::boolean and v ->> 'error' like '%only for written questions%', 'no uploads for an MCQ');
  v := public.student_answer_upload_slot(v_att, pg_temp.id('q_upload'), 'text/html', 1000);
  perform pg_temp.ok(not (v ->> 'allowed')::boolean and (v ->> 'status')::int = 400, 'HTML refused (photo / PDF only)');
  v := public.student_answer_upload_slot(v_att, pg_temp.id('q_upload'), 'application/pdf', 20000000);
  perform pg_temp.ok(not (v ->> 'allowed')::boolean and v ->> 'error' like '%10 MB%', 'over 10 MB refused');

  v := pg_temp.upload(v_att, pg_temp.id('q_upload'));
  perform pg_temp.ok(jsonb_array_length(v -> 'uploads') = 1 and (v ->> 'can_upload')::boolean
                     and v #>> '{uploads,0,file_name}' = 'page-1.jpg', 'photo uploaded and registered');
  v := pg_temp.upload(v_att, pg_temp.id('q_upload'), 'application/pdf');
  perform pg_temp.ok(jsonb_array_length(v -> 'uploads') = 2, 'a PDF too');

  -- register: path must be this student's / attempt's / question's, and the object must exist
  perform pg_temp.expect_error(format('select public.student_register_answer_upload(%L, %L, %L, ''x.jpg'', ''image/jpeg'', 10)',
    v_att, pg_temp.id('q_upload'), pg_temp.id('s2') || '/' || v_att || '/' || pg_temp.id('q_upload') || '/' || gen_random_uuid() || '.jpg'), '22023');
  v_path := pg_temp.id('s1') || '/' || v_att || '/' || pg_temp.id('q_upload') || '/' || gen_random_uuid() || '.jpg';
  perform pg_temp.expect_error(format('select public.student_register_answer_upload(%L, %L, %L, ''x.jpg'', ''image/jpeg'', 10)',
    v_att, pg_temp.id('q_upload'), v_path), '22023');
  perform pg_temp.ok(true, 'register refuses another user''s path and a file that never arrived');

  for i in 3..5 loop perform pg_temp.upload(v_att, pg_temp.id('q_upload')); end loop;
  v := public.student_answer_upload_slot(v_att, pg_temp.id('q_upload'), 'image/jpeg', 1000);
  perform pg_temp.ok(not (v ->> 'allowed')::boolean and v ->> 'error' like '%up to 5 files%', 'a 6th file is refused');
  v := public.student_list_answer_uploads(v_att);
  v := public.student_remove_answer_upload((v #>> '{uploads,4,id}')::uuid);
  perform pg_temp.ok(jsonb_array_length(v -> 'uploads') = 4, 'a file can be removed during the test');

  perform pg_temp.act_as(pg_temp.id('s2'));
  v := public.student_answer_upload_slot(v_att, pg_temp.id('q_upload'), 'image/jpeg', 1000);
  perform pg_temp.ok(not (v ->> 'allowed')::boolean and (v ->> 'status')::int = 404, 'another student can''t upload to this attempt');
  perform pg_temp.expect_error(format('select public.student_list_answer_uploads(%L)', v_att), 'P0002');
  perform pg_temp.ok(true, 'or list its files');
end $$;

-- ------------------------------------------------- 2. submit
do $$
declare v jsonb; r jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('s1'));
  perform public.student_save_answer(pg_temp.id('att'), pg_temp.id('q_mcq'), jsonb_build_object('selected_option_ids',
    (select jsonb_agg(o.id) from public.quiz_question_options o where o.question_id = pg_temp.id('q_mcq') and o.option_text = 'Newton')));
  perform public.student_save_answer(pg_temp.id('att'), pg_temp.id('q_typed'), jsonb_build_object('answer_text', 'Force equals mass times acceleration.'));
  perform public.student_submit_attempt(pg_temp.id('att'));
  v := public.student_get_report(pg_temp.id('att'));
  select x into r from jsonb_array_elements(v -> 'questions') x where x ->> 'question_id' = pg_temp.id('q_upload')::text;
  perform pg_temp.ok(r ->> 'status' = 'pending' and (r ->> 'upload_count')::int = 4, 'upload-only answer: pending (not skipped), 4 files');
  select x into r from jsonb_array_elements(v -> 'questions') x where x ->> 'question_id' = pg_temp.id('q_typed')::text;
  perform pg_temp.ok(r ->> 'status' = 'pending', 'typed answer: pending');
  select x into r from jsonb_array_elements(v -> 'questions') x where x ->> 'question_id' = pg_temp.id('q_blank')::text;
  perform pg_temp.ok(r ->> 'status' = 'skipped', 'blank answer: skipped');
  perform pg_temp.ok((v #>> '{summary,pending_count}')::int = 2 and (v #>> '{summary,score}')::numeric = 4
                     and (v #>> '{summary,max_score}')::numeric = 14,
                     'score 4 of 14 (MCQ + the skipped question; the 2 pending are left out)');
  perform pg_temp.ok((select is_correct is null and points_earned is null from public.quiz_answers
                       where attempt_id = pg_temp.id('att') and question_id = pg_temp.id('q_upload')), 'quiz_answers: upload-only row ungraded');
end $$;

-- ------------------------------------------------- 3. grace window
do $$
declare v jsonb; r jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('s1'));
  update public.quiz_attempts set submitted_at = now() - interval '5 minutes' where id = pg_temp.id('att');
  v := pg_temp.upload(pg_temp.id('att'), pg_temp.id('q_blank'));
  perform pg_temp.ok((v ->> 'can_upload')::boolean, 'an upload 5 minutes after submitting is accepted');
  v := public.student_get_report(pg_temp.id('att'));
  select x into r from jsonb_array_elements(v -> 'questions') x where x ->> 'question_id' = pg_temp.id('q_blank')::text;
  perform pg_temp.ok(r ->> 'status' = 'pending' and (v #>> '{summary,pending_count}')::int = 3
                     and (v #>> '{summary,max_score}')::numeric = 4, 'the skipped answer is now pending (score 4 of 4 so far)');

  update public.quiz_attempts set submitted_at = now() - interval '16 minutes' where id = pg_temp.id('att');
  v := public.student_answer_upload_slot(pg_temp.id('att'), pg_temp.id('q_blank'), 'image/jpeg', 1000);
  perform pg_temp.ok(not (v ->> 'allowed')::boolean and v ->> 'error' like '%time to upload%', 'after 15 minutes uploads are refused');
  v := public.student_list_answer_uploads(pg_temp.id('att'));
  perform pg_temp.ok(not (v ->> 'can_upload')::boolean, 'the list says so');
  perform pg_temp.expect_error(format('select public.student_remove_answer_upload(%L)', v #>> '{uploads,0,id}'), '22023');
  perform pg_temp.ok(true, 'and files can''t be removed any more');
  perform pg_temp.remember('upload1', (v #>> '{uploads,0,id}')::uuid);
end $$;

-- ------------------------------------------------- 4. file access
do $$
declare v jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('s1'));
  v := public.adm_answer_upload_access(pg_temp.id('upload1'));
  perform pg_temp.ok(v ->> 'path' like pg_temp.id('s1') || '/%', 'the student can open their own file');
  perform pg_temp.act_as(pg_temp.id('e1'));
  perform pg_temp.ok(public.adm_answer_upload_access(pg_temp.id('upload1')) ? 'path', 'the series educator can');
  perform pg_temp.act_as(pg_temp.id('admin'));
  perform pg_temp.ok(public.adm_answer_upload_access(pg_temp.id('upload1')) ? 'path', 'an admin can');
  perform pg_temp.act_as(pg_temp.id('s2'));
  perform pg_temp.expect_error(format('select public.adm_answer_upload_access(%L)', pg_temp.id('upload1')), 'P0002');
  perform pg_temp.act_as(pg_temp.id('e2'));
  perform pg_temp.expect_error(format('select public.adm_answer_upload_access(%L)', pg_temp.id('upload1')), 'P0002');
  perform pg_temp.ok(true, 'another student and another educator can''t');
  perform pg_temp.ok(not has_table_privilege('authenticated', 'public.answer_uploads', 'select')
                     and (select not public from storage.buckets where id = 'answer-uploads'),
                     'the table has no browser grants and the bucket is private');
end $$;

-- ------------------------------------------------- 5. grading
do $$
declare v jsonb; l jsonb; r jsonb; n int;
begin
  -- list
  perform pg_temp.act_as(pg_temp.id('e1'));
  select row_data into l from public.grading_list_attempts('pending') limit 1;
  perform pg_temp.ok(l ->> 'attempt_id' = pg_temp.id('att')::text and (l ->> 'written_count')::int = 3
                     and (l ->> 'pending_count')::int = 3 and l ->> 'candidate' like 'Candidate %'
                     and not l ? 'student_name' and not l ? 'student_email',
                     'educator: the attempt waits for marking, shown as a candidate code (no name or email)');
  perform pg_temp.act_as(pg_temp.id('admin'));
  select row_data into l from public.grading_list_attempts('pending') limit 1;
  perform pg_temp.ok(l ->> 'student_name' = 'Riya Sen', 'admin: also sees the name');
  perform pg_temp.act_as(pg_temp.id('e2'));
  perform pg_temp.ok(not exists (select 1 from public.grading_list_attempts('all')), 'another educator sees nothing');
  perform pg_temp.expect_error(format('select public.grading_get_attempt(%L)', pg_temp.id('att')), '42501');
  perform pg_temp.expect_error(format('select public.grading_save(%L, ''[]'')', pg_temp.id('att')), '42501');
  perform pg_temp.ok(true, 'and can''t open or mark it');
  perform pg_temp.act_as(pg_temp.id('s1'));
  perform pg_temp.expect_error(format('select public.grading_get_attempt(%L)', pg_temp.id('att')), '42501');
  perform pg_temp.ok(true, 'a student can''t either');

  -- detail
  perform pg_temp.act_as(pg_temp.id('e1'));
  v := public.grading_get_attempt(pg_temp.id('att'));
  perform pg_temp.ok(jsonb_array_length(v -> 'questions') = 3 and (v ->> 'can_publish')::boolean
                     and v #>> '{questions,0,typed_answer}' = 'Force equals mass times acceleration.'
                     and v #>> '{questions,0,marking_guide}' like '5 for the statement%'
                     and jsonb_array_length(v #> '{questions,1,uploads}') = 4
                     and (v #>> '{objective,marks_earned}')::numeric = 4,
                     'detail: 3 written questions with the typed answer, marking guide, 4 uploads; MCQ part 4');

  -- validation
  perform pg_temp.expect_error(format('select public.grading_save(%L, %L)', pg_temp.id('att'),
    jsonb_build_array(jsonb_build_object('question_id', pg_temp.id('q_typed'), 'marks', 11))), '22023');
  perform pg_temp.expect_error(format('select public.grading_save(%L, %L)', pg_temp.id('att'),
    jsonb_build_array(jsonb_build_object('question_id', pg_temp.id('q_mcq'), 'marks', 1))), '22023');
  perform pg_temp.ok(true, 'marks over the maximum, or for an MCQ, are refused');

  -- draft
  v := public.grading_save(pg_temp.id('att'), jsonb_build_array(
         jsonb_build_object('question_id', pg_temp.id('q_typed'), 'marks', 8, 'feedback', 'Good, add the formula.')),
       'Solid start.', false);
  perform pg_temp.ok(v #>> '{evaluation,status}' = 'draft' and (v #>> '{questions,0,grade,marks}')::numeric = 8, 'draft saved');
  perform pg_temp.act_as(pg_temp.id('s1'));
  perform pg_temp.ok((public.student_get_report(pg_temp.id('att')) #>> '{summary,pending_count}')::int = 3,
                     'the student doesn''t see draft marks');

  -- publish needs every answered question
  perform pg_temp.act_as(pg_temp.id('e1'));
  perform pg_temp.expect_error(format('select public.grading_save(%L, ''[]'', null, true)', pg_temp.id('att')), '22023');
  perform pg_temp.ok(true, 'publish refused while answered questions are unmarked');

  v := public.grading_save(pg_temp.id('att'), jsonb_build_array(
         jsonb_build_object('question_id', pg_temp.id('q_upload'), 'marks', 10, 'feedback', 'Clear derivation.'),
         jsonb_build_object('question_id', pg_temp.id('q_blank'), 'marks', 0, 'feedback', 'The diagram is missing the normal force.')),
       'Solid start. Practise diagrams.', true);
  perform pg_temp.ok(v #>> '{evaluation,status}' = 'published', 'published');

  perform pg_temp.act_as(pg_temp.id('s1'));
  v := public.student_get_report(pg_temp.id('att'));
  perform pg_temp.ok((v #>> '{summary,score}')::numeric = 22 and (v #>> '{summary,max_score}')::numeric = 34
                     and (v #>> '{summary,pending_count}')::int = 0 and not (v #>> '{summary,provisional}')::boolean
                     and (v #>> '{summary,passed}')::boolean,
                     'report: 22 of 34 (4 + 8 + 10 + 0), nothing pending, passed');
  select x into r from jsonb_array_elements(v -> 'questions') x where x ->> 'question_id' = pg_temp.id('q_typed')::text;
  perform pg_temp.ok(r ->> 'status' = 'partial' and (r ->> 'points_earned')::numeric = 8
                     and r #>> '{teacher_evaluation,feedback}' = 'Good, add the formula.', 'typed answer: partial 8/10 with feedback');
  select x into r from jsonb_array_elements(v -> 'questions') x where x ->> 'question_id' = pg_temp.id('q_upload')::text;
  perform pg_temp.ok(r ->> 'status' = 'correct', 'uploaded answer: correct 10/10');
  select x into r from jsonb_array_elements(v -> 'questions') x where x ->> 'question_id' = pg_temp.id('q_blank')::text;
  perform pg_temp.ok(r ->> 'status' = 'incorrect', 'diagram: incorrect 0/10');
  perform pg_temp.ok(v #>> '{teacher,overall_feedback}' = 'Solid start. Practise diagrams.', 'overall feedback in the report');
  perform pg_temp.ok((select score = 22 and passed from public.quiz_attempts where id = pg_temp.id('att'))
                     and (select points_earned = 8 from public.quiz_answers where attempt_id = pg_temp.id('att') and question_id = pg_temp.id('q_typed')),
                     'quiz_attempts and quiz_answers updated');
  select count(*) into n from public.notifications
   where user_id = pg_temp.id('s1') and category = 'assessment_result' and action_url = '/student/report/' || pg_temp.id('att');
  perform pg_temp.ok(n = 1, 'the student is notified with a link to the report');
  v := public.student_answer_upload_slot(pg_temp.id('att'), pg_temp.id('q_blank'), 'image/jpeg', 1000);
  perform pg_temp.ok(not (v ->> 'allowed')::boolean, 'no uploads after the evaluation is published');

  -- re-publish
  perform pg_temp.act_as(pg_temp.id('admin'));
  v := public.grading_save(pg_temp.id('att'), jsonb_build_array(
         jsonb_build_object('question_id', pg_temp.id('q_blank'), 'marks', 3, 'feedback', 'Partly right on second look.')),
       'Solid start. Practise diagrams.', true);
  perform pg_temp.act_as(pg_temp.id('s1'));
  v := public.student_get_report(pg_temp.id('att'));
  perform pg_temp.ok((v #>> '{summary,score}')::numeric = 25, 'an admin re-marks: 25 of 34');
  perform pg_temp.ok(exists (select 1 from public.notifications where user_id = pg_temp.id('s1') and title = 'Your marks were updated'),
                     'and the student is told the marks changed');
  perform pg_temp.act_as(pg_temp.id('e1'));
  perform pg_temp.ok(not exists (select 1 from public.grading_list_attempts('pending'))
                     and exists (select 1 from public.grading_list_attempts('published')), 'the list moves it to "published"');
end $$;

-- ------------------------------------------------- publish waits for the window
do $$
declare v jsonb; v_att uuid;
begin
  perform pg_temp.act_as(pg_temp.id('s2'));
  perform public.student_enroll(pg_temp.id('series'));
  v := public.student_start_attempt(pg_temp.id('test'));
  v_att := (v ->> 'attempt_id')::uuid;
  perform public.student_save_answer(v_att, pg_temp.id('q_typed'), jsonb_build_object('answer_text', 'F = ma'));
  perform public.student_submit_attempt(v_att);
  perform pg_temp.act_as(pg_temp.id('e1'));
  v := public.grading_get_attempt(v_att);
  perform pg_temp.ok(not (v ->> 'can_publish')::boolean, 'just submitted: can''t publish yet (upload window open)');
  perform pg_temp.expect_error(format('select public.grading_save(%L, %L, null, true)', v_att,
    jsonb_build_array(jsonb_build_object('question_id', pg_temp.id('q_typed'), 'marks', 10))), '22023');
  perform pg_temp.ok(true, 'publish is refused until the window closes');
  v := public.grading_save(v_att, jsonb_build_array(jsonb_build_object('question_id', pg_temp.id('q_typed'), 'marks', 10)), null, false);
  perform pg_temp.ok(v #>> '{evaluation,status}' = 'draft', 'a draft can be saved meanwhile');
end $$;

do $$ begin raise notice 'ok: all written answer checks passed'; end $$;
rollback;
