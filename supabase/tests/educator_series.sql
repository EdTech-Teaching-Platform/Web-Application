-- =====================================================================
-- supabase/tests/educator_series.sql
--
-- Smoke tests for 20261028100100..100400 (educators on the shared test
-- series RPCs, approval, assignments, regrade, profile, stats).
-- LOCAL / DISPOSABLE DATABASE ONLY (fixtures in auth.users and lead tables).
-- One transaction, rolled back.
--
-- Admin behaviour is covered by the existing tests (admin_fast_publish,
-- admin_block_subjective, feedback_rpcs, student_rpcs), which run unchanged
-- on top of these files.
--
-- Expect "ok: ..." notices and "ok: all educator series checks passed".
-- =====================================================================
begin;

create function pg_temp.expect_error(p_sql text, p_code text, p_msg text default null) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate <> p_code then
      raise exception 'expected SQLSTATE % but got % (%) for: %', p_code, sqlstate, sqlerrm, p_sql;
    end if;
    if p_msg is not null and position(p_msg in sqlerrm) = 0 then
      raise exception 'expected message "%" but got "%"', p_msg, sqlerrm;
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

-- A small wizard payload: one test, two single-answer questions.
create function pg_temp.payload(p_id uuid, p_name text, p_questions boolean default true) returns jsonb
language sql as $$
  select jsonb_build_object(
    'id', p_id, 'name', p_name, 'pricing', 'free', 'startMethod', 'scratch',
    'availability', jsonb_build_object('goLive', 'now', 'mode', 'always'),
    'tests', jsonb_build_array(jsonb_build_object('name', 'Unit 1', 'duration', '20', 'passingPercent', '50',
      'questions', case when p_questions then jsonb_build_array(
        jsonb_build_object('type', 'mcq_single', 'text', 'Two plus two?', 'marks', '4',
          'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', '3'), jsonb_build_object('key', 'B', 'text', '4'),
                                       jsonb_build_object('key', 'C', 'text', '5')),
          'correctAnswers', jsonb_build_array('B')),
        jsonb_build_object('type', 'mcq_single', 'text', 'Capital of India?', 'marks', '4',
          'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', 'Delhi'), jsonb_build_object('key', 'B', 'text', 'Agra')),
          'correctAnswers', jsonb_build_array('A'))) else '[]'::jsonb end)));
$$;

do $fx$
declare
  v_admin uuid := gen_random_uuid();
  v_e1    uuid := gen_random_uuid();
  v_e2    uuid := gen_random_uuid();
  v_pend  uuid := gen_random_uuid();
  v_stu   uuid := gen_random_uuid();
  v_s1    uuid := gen_random_uuid();
  v_s2    uuid := gen_random_uuid();
  v_s3    uuid := gen_random_uuid();
  u       uuid;
begin
  foreach u in array array[v_admin, v_e1, v_e2, v_pend, v_stu, v_s1, v_s2, v_s3] loop
    insert into auth.users (id, email) values (u, 'es-' || u || '@test.local');
  end loop;
  insert into public.profiles (id, role, full_name, email) values
    (v_admin, 'admin', 'ES Admin', 'es-' || v_admin || '@test.local'),
    (v_e1, 'educator', 'Educator One', 'es-' || v_e1 || '@test.local'),
    (v_e2, 'educator', 'Educator Two', 'es-' || v_e2 || '@test.local'),
    (v_pend, 'educator', 'Pending Educator', 'es-' || v_pend || '@test.local'),
    (v_stu, 'student', 'ES Student', 'es-' || v_stu || '@test.local'),
    (v_s1, 'student', 'Student 1', 'es-' || v_s1 || '@test.local'),
    (v_s2, 'student', 'Student 2', 'es-' || v_s2 || '@test.local'),
    (v_s3, 'student', 'Student 3', 'es-' || v_s3 || '@test.local');
  insert into public.adm_admin_users (user_id) values (v_admin);
  insert into public.educator_profiles (user_id, full_name, phone, location, verification_status) values
    (v_e1, 'Educator One', '9000000001', 'Pune', 'verified'),
    (v_e2, 'Educator Two', '9000000002', 'Goa', 'verified'),
    (v_pend, 'Pending Educator', '9000000003', 'Agra', 'pending');
  perform pg_temp.remember('admin', v_admin); perform pg_temp.remember('e1', v_e1); perform pg_temp.remember('e2', v_e2);
  perform pg_temp.remember('pend', v_pend); perform pg_temp.remember('stu', v_stu);
  perform pg_temp.remember('s1', v_s1); perform pg_temp.remember('s2', v_s2); perform pg_temp.remember('s3', v_s3);
end $fx$;

-- --------------------------------------------------- ownership and access
do $$
declare
  sid uuid;
  adm uuid;
  qid uuid;
  v   jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('admin'));
  adm := pg_temp.remember('adm_series', public.upsert_test_series_full(pg_temp.payload(null, 'ES Admin Series'), false));

  perform pg_temp.act_as(pg_temp.id('e1'));
  sid := pg_temp.remember('e1_series', public.upsert_test_series_full(pg_temp.payload(null, 'ES Educator Series'), false));
  perform pg_temp.ok((select origin = 'educator' and created_by = pg_temp.id('e1') and status = 'draft'
                        from public.test_series_admin where series_id = sid)
                     and (select course_id from public.test_series where id = sid) = public.adm_house_course_id(),
                     'create: origin educator, created_by, draft, on the house course');
  perform pg_temp.ok((select origin from public.test_series_admin where series_id = adm) = 'admin', 'create: admin series has origin admin');
  perform pg_temp.ok((select count(*) from public.list_test_series(p_size => 100)) = 1
                     and (select (r.row_data ->> 'id')::uuid from public.list_test_series(p_size => 100) r) = sid
                     and not exists (select 1 from public.list_test_series(p_size => 100) r where r.row_data ? 'created_by'),
                     'list: an educator sees only their own series, without admin ids');
  perform pg_temp.ok((public.get_test_series_stats() ->> 'total_series')::int = 1, 'stats: counted over the educator''s series');
  v := public.get_test_series(sid);
  perform pg_temp.ok(jsonb_array_length(v -> 'tests') = 1, 'get: an educator reads their own series');
  perform pg_temp.expect_error(format('select public.get_test_series(%L)', adm), '42501', 'can''t manage');
  qid := (v #>> '{tests,0,questions,0,id}')::uuid;
  perform pg_temp.remember('e1_q1', qid);
  perform pg_temp.remember('e1_quiz', (v #>> '{tests,0,id}')::uuid);

  perform pg_temp.act_as(pg_temp.id('admin'));
  perform pg_temp.ok((select count(*) from public.list_test_series(p_size => 100) r
                       where (r.row_data ->> 'id')::uuid in (sid, adm)) = 2, 'list: the admin sees every series');

  -- another educator
  perform pg_temp.act_as(pg_temp.id('e2'));
  perform pg_temp.expect_error(format('select public.get_test_series(%L)', sid), '42501');
  perform pg_temp.expect_error(format('select public.upsert_test_series_full(%L)', pg_temp.payload(sid, 'Hijack')), '42501');
  perform pg_temp.expect_error(format('select public.create_test(%L, ''{"name":"X"}'')', sid), '42501');
  perform pg_temp.expect_error(format('select public.update_question(%L, ''{"text":"Changed"}'')', qid), '42501');
  perform pg_temp.expect_error(format('select public.delete_test_series(%L)', sid), '42501');
  perform pg_temp.ok(not exists (select 1 from public.list_test_series(p_size => 100)), 'list: another educator sees none of them');

  -- pending educator, student
  perform pg_temp.act_as(pg_temp.id('pend'));
  perform pg_temp.expect_error(format('select public.upsert_test_series_full(%L)', pg_temp.payload(null, 'Pending try')), '42501', 'Admin access required');
  perform pg_temp.expect_error('select * from public.list_test_series()', '42501');
  perform pg_temp.expect_error('select public.educator_get_dashboard()', '42501');
  perform pg_temp.act_as(pg_temp.id('stu'));
  perform pg_temp.expect_error('select * from public.list_test_series()', '42501', 'Admin access required');
  perform pg_temp.expect_error(format('select public.get_test_series(%L)', sid), '42501');
end $$;

-- --------------------------------------------------------- approval flow
do $$
declare
  sid uuid := pg_temp.id('e1_series');
  v   jsonb;
  t2  jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('e1'));
  perform pg_temp.expect_error(format('select public.adm_publish_test_series(%L)', sid), '42501', 'approves it');
  perform pg_temp.expect_error(format('select public.upsert_test_series_full(%L, true)', pg_temp.payload(sid, 'ES Educator Series')), '42501');
  perform pg_temp.expect_error(format('select public.set_test_status(%L, ''published'')', pg_temp.id('e1_quiz')), '42501');

  t2 := public.create_test(sid, '{"name":"Empty unit","duration":10}');
  perform pg_temp.expect_error(format('select public.educator_submit_series_for_approval(%L)', sid), '22023', '"Empty unit" has no questions.');
  perform public.delete_test((t2 ->> 'id')::uuid);
  v := public.educator_submit_series_for_approval(sid);
  perform pg_temp.ok(v ->> 'status' = 'pending_approval'
                     and not (select is_published from public.test_series where id = sid), 'submit: pending approval, not published');
  perform pg_temp.expect_error(format('select public.update_test(%L, ''{"name":"Renamed"}'')', pg_temp.id('e1_quiz')), '42501', 'waiting for admin approval');
  perform pg_temp.expect_error(format('select public.educator_submit_series_for_approval(%L)', sid), '42501');
  perform pg_temp.ok(public.get_test_series(sid) ->> 'status' = 'pending_approval', 'pending: the educator can still read it');

  perform pg_temp.act_as(pg_temp.id('admin'));
  v := (select r.row_data from public.list_pending_series_approvals() r where (r.row_data ->> 'id')::uuid = sid);
  perform pg_temp.ok(v ->> 'educator_name' = 'Educator One' and (v ->> 'question_count')::int = 2 and (v ->> 'test_count')::int = 1,
                     'admin: pending list with educator and counts');
  perform pg_temp.expect_error(format('select public.reject_educator_series(%L, '' '')', sid), '22023', 'reason');
  v := public.reject_educator_series(sid, 'Add explanations to every question.');
  perform pg_temp.ok((select status = 'rejected' and rejection_reason = 'Add explanations to every question.'
                        from public.test_series_admin where series_id = sid)
                     and exists (select 1 from public.notifications where user_id = pg_temp.id('e1') and reference_type = 'educator_series'
                                    and reference_id = sid and category = 'moderation'),
                     'reject: reason stored, educator notified');
  perform pg_temp.expect_error(format('select public.approve_educator_series(%L)', sid), '22023');

  perform pg_temp.act_as(pg_temp.id('e1'));
  perform public.update_test(pg_temp.id('e1_quiz'), '{"instructions":"Read every question."}');
  perform pg_temp.ok(public.educator_submit_series_for_approval(sid) ->> 'status' = 'pending_approval', 'resubmit after rejection');

  perform pg_temp.act_as(pg_temp.id('e2'));
  perform pg_temp.expect_error(format('select public.approve_educator_series(%L)', sid), '42501');
  perform pg_temp.act_as(pg_temp.id('admin'));
  v := public.approve_educator_series(sid);
  perform pg_temp.ok(v ->> 'status' = 'published' and (select is_published from public.test_series where id = sid)
                     and (select approved_by = pg_temp.id('admin') and approved_at is not null and status = 'published'
                            from public.test_series_admin where series_id = sid)
                     and (select count(*) from public.notifications where reference_id = sid and reference_type = 'educator_series') = 2,
                     'approve: published through the publish path, approved_by / at, notified');
end $$;

-- ---------------------------------------------------- assigned series
do $$
declare
  adm  uuid := pg_temp.id('adm_series');
  aid  uuid;
  v    jsonb;
  quiz uuid;
begin
  perform pg_temp.act_as(pg_temp.id('admin'));
  aid := (public.create_assignments(jsonb_build_object('seriesMode', 'existing', 'seriesId', adm, 'subject', 'Maths',
            'testName', 'Algebra set', 'educatorIds', jsonb_build_array(pg_temp.id('e2')), 'questionCount', 10,
            'deadline', current_date + 5, 'topics', jsonb_build_array('Linear equations'))))[1];
  insert into public.assignment_comments (assignment_id, comment, author_id) values (aid, 'Keep it at JEE level.', pg_temp.id('admin'));

  perform pg_temp.act_as(pg_temp.id('e2'));
  v := public.educator_list_assignments('open');
  perform pg_temp.ok(jsonb_array_length(v) = 1 and v -> 0 ->> 'id' = aid::text and not (v -> 0) ? 'educator_name',
                     'assignments: listed for the assignee');
  v := public.educator_get_assignment(aid);
  perform pg_temp.ok(v -> 'comments' -> 0 ->> 'from' = 'admin' and v -> 'series' ->> 'id' = adm::text, 'assignment: requirements and admin comments');
  v := public.educator_start_assignment(aid);
  quiz := (v -> 'test' ->> 'id')::uuid;
  perform pg_temp.ok(v -> 'assignment' ->> 'status' = 'in_progress' and v -> 'test' ->> 'title' = 'Algebra set'
                     and (v -> 'test' ->> 'planned_questions')::int = 10
                     and exists (select 1 from public.assignment_history where assignment_id = aid and action = 'Started'),
                     'start: in progress, test shell created with create_test, history row');
  perform pg_temp.ok(public.educator_start_assignment(aid) -> 'test' ->> 'id' = quiz::text, 'start: idempotent');
  perform public.educator_add_assignment_comment(aid, 'Question 3 uses the new syllabus.');
  perform public.create_question(quiz, '{"type":"mcq_single","text":"x + 1 = 3, x = ?","optionA":"1","optionB":"2","optionC":"3","optionD":"4","correctAnswer":"B","marks":4}');
  perform pg_temp.ok((select count(*) from public.list_test_series(p_size => 100)) = 1, 'list: the assignee sees the assigned series');
  perform pg_temp.expect_error(format('select public.delete_test_series(%L)', adm), '42501', 'Only the educator who created');

  perform pg_temp.act_as(pg_temp.id('e1'));
  perform pg_temp.expect_error(format('select public.get_test_series(%L)', adm), '42501');
  perform pg_temp.expect_error(format('select public.educator_get_assignment(%L)', aid), 'P0002');

  perform pg_temp.act_as(pg_temp.id('e2'));
  v := public.adm_publish_test_series(adm, true);
  perform pg_temp.ok(v ->> 'status' = 'published'
                     and (select status from public.test_assignments where id = aid) = 'completed'
                     and exists (select 1 from public.assignment_history where assignment_id = aid and action = 'Completed'),
                     'assigned series: the educator publishes directly; assignment completed');
end $$;

-- ---------------------------------------------------------------- regrade
do $$
declare
  quiz uuid := pg_temp.id('e1_quiz');
  q1   uuid := pg_temp.id('e1_q1');
  q2   uuid;
  o    record;
  i    int := 0;
  a1   uuid; a2 uuid; a3 uuid;
  ids_before uuid[];
  v    jsonb;
  r    jsonb;
  s    uuid;
begin
  select id into q2 from public.quiz_questions where quiz_id = quiz and id <> q1;
  -- three finished attempts (finalized by the student pipeline):
  --   s1: q1 = '4' (B, correct), q2 = Delhi (correct)   -> 8 / 8
  --   s2: q1 = '5' (C, wrong),   q2 = Delhi (correct)   -> 4 / 8
  --   s3: q1 = '5' (C, wrong),   q2 = Agra  (wrong)     -> 0 / 8
  foreach s in array array[pg_temp.id('s1'), pg_temp.id('s2'), pg_temp.id('s3')] loop
    insert into public.quiz_attempts (quiz_id, student_id, attempt_number) values (quiz, s, 1) returning id into a3;
    insert into public.quiz_answers (attempt_id, question_id, selected_option_ids)
    select a3, q1, array[(select id::text from public.quiz_question_options where question_id = q1
                           and option_text = case when s = pg_temp.id('s1') then '4' else '5' end)]::text[];
    insert into public.quiz_answers (attempt_id, question_id, selected_option_ids)
    select a3, q2, array[(select id::text from public.quiz_question_options where question_id = q2
                           and option_text = case when s = pg_temp.id('s3') then 'Agra' else 'Delhi' end)]::text[];
    perform public.adm_finalize_attempt(a3);
    i := i + 1;
    perform pg_temp.remember('att' || i, a3);
  end loop;
  a1 := pg_temp.id('att1'); a2 := pg_temp.id('att2'); a3 := pg_temp.id('att3');
  perform pg_temp.ok((select array_agg(percentage order by percentage desc) from public.quiz_attempts where id in (a1, a2, a3))
                     = array[100, 50, 0]::numeric[], 'regrade: baseline scores 100 / 50 / 0');
  select array_agg(id order by sort_order) into ids_before from public.quiz_question_options where question_id = q1;

  -- the "correct" answer to q1 was wrong: 5 is the intended answer. Fix it as the educator.
  perform pg_temp.act_as(pg_temp.id('e1'));
  v := public.update_question(q1, '{"type":"mcq_single","text":"Two plus three?","optionA":"3","optionB":"4","optionC":"5","correctAnswer":"C","explanation":"2 + 3 = 5"}');
  perform pg_temp.ok((v ->> 'regraded_attempts')::int = 3, 'regrade: the edit re-scored 3 attempts');
  perform pg_temp.ok((select array_agg(id order by sort_order) from public.quiz_question_options where question_id = q1) = ids_before,
                     'regrade: option ids kept (edited in place)');
  perform pg_temp.ok((select percentage from public.quiz_attempts where id = a1) = 50
                     and (select percentage from public.quiz_attempts where id = a2) = 100
                     and (select percentage from public.quiz_attempts where id = a3) = 50
                     and (select passed from public.quiz_attempts where id = a2)
                     and (select score from public.quiz_attempts where id = a1) = 4,
                     'regrade: scores now 50 / 100 / 50, passed recomputed');
  perform pg_temp.ok((select is_correct from public.quiz_answers where attempt_id = a2 and question_id = q1)
                     and not (select is_correct from public.quiz_answers where attempt_id = a1 and question_id = q1),
                     'regrade: quiz_answers.is_correct flipped');

  r := (select report from public.attempt_reports where attempt_id = a2);
  perform pg_temp.ok((r #>> '{summary,percentage}')::numeric = 100 and (r #>> '{summary,correct_count}')::int = 2
                     and (r #>> '{summary,rank}')::int = 1 and r ? 'regraded_at'
                     and (select q ->> 'status' from jsonb_array_elements(r -> 'questions') q where q ->> 'question_id' = q1::text) = 'correct'
                     and (select q ->> 'correct_answer' from jsonb_array_elements(r -> 'questions') q where q ->> 'question_id' = q1::text) = '5'
                     and (select q ->> 'text' from jsonb_array_elements(r -> 'questions') q where q ->> 'question_id' = q1::text) = 'Two plus three?',
                     'regrade: report rebuilt (summary, status, correct answer, text, rank)');

  -- a fresh attempt with s2's answers, finalized after the fix, must score the same
  perform pg_temp.act_as(null);
  insert into public.quiz_attempts (quiz_id, student_id, attempt_number) values (quiz, pg_temp.id('s2'), 2) returning id into s;
  insert into public.quiz_answers (attempt_id, question_id, selected_option_ids)
  select s, q1, array[(select id::text from public.quiz_question_options where question_id = q1 and option_text = '5')]::text[];
  insert into public.quiz_answers (attempt_id, question_id, selected_option_ids)
  select s, q2, array[(select id::text from public.quiz_question_options where question_id = q2 and option_text = 'Delhi')]::text[];
  v := public.adm_finalize_attempt(s);
  r := (select report from public.attempt_reports where attempt_id = a2);
  perform pg_temp.ok(v -> 'summary' -> 'score' = r -> 'summary' -> 'score' and v -> 'summary' -> 'max_score' = r -> 'summary' -> 'max_score'
                     and v -> 'summary' -> 'percentage' = r -> 'summary' -> 'percentage'
                     and v #> '{breakdowns,by_difficulty}' = r #> '{breakdowns,by_difficulty}'
                     and v -> 'questions' = r -> 'questions',
                     'regrade: the regraded report matches a fresh grading of the same answers');

  -- marks change re-scores; structural changes stay refused
  perform pg_temp.act_as(pg_temp.id('e1'));
  v := public.update_question(q2, '{"marks":"6"}');
  perform pg_temp.ok((v ->> 'regraded_attempts')::int = 4 and (select max_score from public.quiz_attempts where id = a1) = 10
                     and (select score from public.quiz_attempts where id = a1) = 6, 'regrade: a marks change re-scores (6 / 10)');
  perform pg_temp.expect_error(format('select public.update_question(%L, %L)', q1,
    '{"type":"mcq_single","optionA":"3","optionB":"4","optionC":"5","optionD":"6","correctAnswer":"C"}'), '22023', 'can''t be added or removed');
  perform pg_temp.expect_error(format('select public.delete_question_option(%L)', ids_before[1]), '23503');
  perform pg_temp.expect_error(format('select public.delete_question(%L)', q1), '23503');
  -- option-level correct flips (now allowed), audited: Agra becomes the only correct answer
  -- (multiple choice is all-or-nothing, so Delhi is unmarked first)
  perform public.update_question_option((select id from public.quiz_question_options where question_id = q2 and option_text = 'Delhi'),
                                        '{"is_correct":false}');
  select id into o from public.quiz_question_options where question_id = q2 and option_text = 'Agra';
  v := public.update_question_option(o.id, '{"is_correct":true}');
  -- s3 answered q1 = 5 (correct, 4) and q2 = Agra (now correct, 6): 10 / 10
  perform pg_temp.ok((v ->> 'regraded_attempts')::int = 4 and (select percentage from public.quiz_attempts where id = a3) = 100
                     and exists (select 1 from public.audit_logs where action = 'question.option_update' and target_id = o.id
                                    and before_state is not null and after_state is not null),
                     'regrade: option-level correct flips re-score and are audited');
  perform pg_temp.ok(exists (select 1 from public.audit_logs where action = 'test.regrade' and target_id = quiz), 'regrade: audited');

  -- the same behaviour for an admin: back to Delhi
  perform pg_temp.act_as(pg_temp.id('admin'));
  perform public.update_question_option(o.id, '{"is_correct":false}');
  v := public.update_question_option((select id from public.quiz_question_options where question_id = q2 and option_text = 'Delhi'),
                                     '{"is_correct":true}');
  -- s3: q1 correct (4), q2 Agra wrong (0): 4 / 10
  perform pg_temp.ok((v ->> 'regraded_attempts')::int = 4 and (select percentage from public.quiz_attempts where id = a3) = 40,
                     'regrade: the same for an admin');

  -- no student identity in educator outputs
  perform pg_temp.act_as(pg_temp.id('e1'));
  v := public.educator_get_stats();
  perform pg_temp.ok((v ->> 'attempts')::int = 4 and (v ->> 'learners')::int = 3 and (v ->> 'pass_rate')::numeric > 0
                     and jsonb_array_length(v -> 'trend') = 12
                     and position(pg_temp.id('s1')::text in v::text) = 0 and position(pg_temp.id('s2')::text in v::text) = 0,
                     'stats: attempts, learners, pass rate, 12-week trend, no student ids');
  v := public.educator_get_dashboard();
  perform pg_temp.ok((v ->> 'published_count')::int = 1 and jsonb_array_length(v -> 'recent_activity') > 0
                     and position(pg_temp.id('s1')::text in v::text) = 0, 'dashboard: published count, activity, no student ids');
end $$;

-- ---------------------------------------------------------------- profile
do $$
declare
  v    jsonb;
  det  text;
begin
  perform pg_temp.act_as(pg_temp.id('e1'));
  v := public.educator_get_profile();
  perform pg_temp.ok(v ->> 'verification_status' = 'verified' and v ->> 'location' = 'Pune', 'profile: read');
  perform pg_temp.expect_error('select public.educator_update_profile(''{"verification_status":"verified"}'')', '42501', 'can''t be changed');
  perform pg_temp.expect_error('select public.educator_update_profile(''{"bio":"too short"}'')', '22023');
  begin
    perform public.educator_update_profile('{"experience_years":99,"phone":"12"}');
  exception when sqlstate '22023' then
    get stacked diagnostics det = pg_exception_detail;
  end;
  perform pg_temp.ok(det::jsonb ?& array['experience_years', 'phone'] and not det::jsonb ? 'bio', 'profile: field errors only for the fields sent');
  v := public.educator_update_profile(jsonb_build_object('bio', repeat('Physics teacher. ', 5), 'subjects', jsonb_build_array('Physics', 'Physics'),
                                                         'location', ' Mumbai '));
  perform pg_temp.ok(v ->> 'location' = 'Mumbai' and v -> 'subjects' = '["Physics"]' and v ->> 'verification_status' = 'verified'
                     and (select role from public.profiles where id = pg_temp.id('e1')) = 'educator'
                     and exists (select 1 from public.audit_logs where action = 'educator.profile_update' and actor_id = pg_temp.id('e1')),
                     'profile: whitelisted fields saved, audited, role and verification untouched');
  perform pg_temp.expect_error(format('select public.educator_update_profile(%L)',
                                      jsonb_build_object('photo_url', pg_temp.id('e2') || '/me.jpg')), '22023');
end $$;

do $$ begin raise notice 'ok: all educator series checks passed'; end $$;
rollback;
