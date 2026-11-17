-- =====================================================================
-- supabase/tests/security_idor.sql   (security audit, 2026-11-18)
--
-- Insecure direct object references with REAL ids (the RBAC sweep uses NULL
-- arguments). Student B and educator E2 try every object of student A /
-- educator E1 they could name:
--   * attempts: report, save answer, proctor event, submit, feedback, AI eval
--   * series: an unpublished series can't be enrolled in or started
--   * assignments: another educator's assignment, its comments
--   * tests / questions: update, delete, add a question, duplicate
--   * notifications / deletion requests: someone else's id does nothing
-- LOCAL / DISPOSABLE DATABASE ONLY. One transaction, rolled back.
-- Expect "ok: ..." notices and "ok: all IDOR checks passed".
-- =====================================================================
begin;

create function pg_temp.denied(p_sql text) returns boolean
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate in ('42501', 'P0002', 'UL403', '22023', 'P0001') then return true; end if;
    raise exception 'unexpected SQLSTATE % (%) for: %', sqlstate, sqlerrm, p_sql;
  end;
  return false;
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

do $fx$
declare
  v_admin uuid := gen_random_uuid(); v_a uuid := gen_random_uuid(); v_b uuid := gen_random_uuid();
  v_e1 uuid := gen_random_uuid(); v_e2 uuid := gen_random_uuid(); u uuid;
  v_series uuid; v_draft uuid; v_test uuid; v jsonb; v_att uuid; v_q uuid; v_e1series uuid; v_e1test uuid; v_e1q uuid; v_asg uuid;
begin
  foreach u in array array[v_admin, v_a, v_b, v_e1, v_e2] loop
    insert into auth.users (id, email) values (u, 'idor-' || u || '@t.local');
  end loop;
  insert into public.profiles (id, role, full_name, email) values
    (v_admin, 'admin', 'IDOR Admin', 'idor-' || v_admin || '@t.local'),
    (v_a, 'student', 'Student A', 'idor-' || v_a || '@t.local'),
    (v_b, 'student', 'Student B', 'idor-' || v_b || '@t.local'),
    (v_e1, 'educator', 'Educator One', 'idor-' || v_e1 || '@t.local'),
    (v_e2, 'educator', 'Educator Two', 'idor-' || v_e2 || '@t.local');
  insert into public.adm_admin_users (user_id) values (v_admin);
  insert into public.educator_profiles (user_id, full_name, phone, location, verification_status) values
    (v_e1, 'Educator One', '9000000031', 'Pune', 'verified'), (v_e2, 'Educator Two', '9000000032', 'Goa', 'verified');
  perform public.adm_backfill_educator_approvals();

  perform pg_temp.act_as(v_admin);
  v_series := public.upsert_test_series_full(jsonb_build_object('name', 'IDOR live', 'pricing', 'free', 'startMethod', 'scratch',
    'availability', jsonb_build_object('goLive', 'now', 'mode', 'always'),
    'tests', jsonb_build_array(jsonb_build_object('name', 'T1', 'duration', '30', 'passingPercent', '40', 'attemptLimit', '3',
      'questions', jsonb_build_array(jsonb_build_object('type', 'mcq_single', 'text', 'Two?', 'marks', '4',
        'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', '2'), jsonb_build_object('key', 'B', 'text', '3')),
        'correctAnswers', jsonb_build_array('A')))))), true);
  v_draft := public.upsert_test_series_full(jsonb_build_object('name', 'IDOR draft', 'pricing', 'free', 'startMethod', 'scratch',
    'tests', jsonb_build_array(jsonb_build_object('name', 'D1', 'duration', '30',
      'questions', jsonb_build_array(jsonb_build_object('type', 'mcq_single', 'text', 'Draft?', 'marks', '4',
        'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', 'y'), jsonb_build_object('key', 'B', 'text', 'n')),
        'correctAnswers', jsonb_build_array('A')))))), false);
  v_test := ((public.get_test_series(v_series)) #>> '{tests,0,id}')::uuid;

  -- student A's attempt, in progress
  perform pg_temp.act_as(v_a);
  perform public.student_enroll(v_series);
  v := public.student_start_attempt(v_test);
  v_att := (v ->> 'attempt_id')::uuid;
  v_q := (v #>> '{questions,0,id}')::uuid;

  -- educator E1's own series, test, question and an assignment
  perform pg_temp.act_as(v_e1);
  v_e1series := public.upsert_test_series_full(jsonb_build_object('name', 'E1 own', 'pricing', 'free', 'startMethod', 'scratch',
    'tests', jsonb_build_array(jsonb_build_object('name', 'E1T', 'duration', '30',
      'questions', jsonb_build_array(jsonb_build_object('type', 'mcq_single', 'text', 'E1 q?', 'marks', '4',
        'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', 'y'), jsonb_build_object('key', 'B', 'text', 'n')),
        'correctAnswers', jsonb_build_array('A')))))), false);
  v_e1test := ((public.get_test_series(v_e1series)) #>> '{tests,0,id}')::uuid;
  v_e1q := ((public.get_test_series(v_e1series)) #>> '{tests,0,questions,0,id}')::uuid;
  perform pg_temp.act_as(v_admin);
  v_asg := (public.create_assignments(jsonb_build_object('seriesMode', 'existing', 'seriesId', v_series, 'subject', 'Maths',
             'testName', 'For E1', 'educatorIds', jsonb_build_array(v_e1), 'questionCount', 5, 'deadline', current_date + 5)))[1];

  perform pg_temp.remember('a', v_a); perform pg_temp.remember('b', v_b); perform pg_temp.remember('e1', v_e1); perform pg_temp.remember('e2', v_e2);
  perform pg_temp.remember('series', v_series); perform pg_temp.remember('draft', v_draft); perform pg_temp.remember('test', v_test);
  perform pg_temp.remember('att', v_att); perform pg_temp.remember('q', v_q);
  perform pg_temp.remember('e1series', v_e1series); perform pg_temp.remember('e1test', v_e1test); perform pg_temp.remember('e1q', v_e1q);
  perform pg_temp.remember('asg', v_asg);
end $fx$;

-- ------------------------------------------------- student B vs student A
do $$
declare v_draft_test uuid;
begin
  perform pg_temp.act_as(pg_temp.id('b'));
  perform pg_temp.ok(pg_temp.denied(format('select public.student_save_answer(%L, %L, %L)', pg_temp.id('att'), pg_temp.id('q'),
                                           '{"selected_option_ids": []}')), 'B cannot save answers into A''s attempt');
  perform pg_temp.ok(pg_temp.denied(format('select public.student_log_proctor_event(%L, %L)', pg_temp.id('att'), 'window_blur')),
                     'B cannot log proctoring events on A''s attempt (could force an auto-submit)');
  perform pg_temp.ok(pg_temp.denied(format('select public.student_submit_attempt(%L)', pg_temp.id('att'))), 'B cannot submit A''s attempt');
  perform pg_temp.ok(pg_temp.denied(format('select public.student_get_report(%L)', pg_temp.id('att'))), 'B cannot read A''s report');
  perform pg_temp.ok(pg_temp.denied(format('select public.student_ai_eval_request(%L)', pg_temp.id('att'))), 'B cannot start A''s AI evaluation');
  perform pg_temp.ok(pg_temp.denied(format('select public.student_submit_feedback(%L, %L, null, %L, %L, %L)', pg_temp.id('att'),
                                           'issue', 'wrong_answer', pg_temp.id('q'), 'Option A is wrong')), 'B cannot file feedback on A''s attempt');
  perform pg_temp.ok(pg_temp.denied(format('select public.student_enroll(%L)', pg_temp.id('draft'))), 'nobody can enrol in an unpublished series');
  select q.id into v_draft_test from public.quizzes q where q.series_id = pg_temp.id('draft') limit 1;
  perform pg_temp.ok(pg_temp.denied(format('select public.student_start_attempt(%L)', v_draft_test)), 'nobody can start an unpublished test');
  perform pg_temp.ok(not exists (select 1 from jsonb_array_elements(public.student_my_history() -> 'items') x
                                  where x ->> 'attempt_id' = pg_temp.id('att')::text), 'A''s attempt is not in B''s history');
  -- A's attempt is untouched
  perform pg_temp.ok((select status from public.quiz_attempts where id = pg_temp.id('att')) = 'in_progress', 'A''s attempt is still in progress');
end $$;

-- ---------------------------------------------- educator E2 vs educator E1
do $$
begin
  perform pg_temp.act_as(pg_temp.id('e2'));
  perform pg_temp.ok(pg_temp.denied(format('select public.educator_get_assignment(%L)', pg_temp.id('asg'))), 'E2 cannot open E1''s assignment');
  perform pg_temp.ok(pg_temp.denied(format('select public.educator_start_assignment(%L)', pg_temp.id('asg'))), 'E2 cannot start E1''s assignment');
  perform pg_temp.ok(pg_temp.denied(format('select public.educator_add_assignment_comment(%L, %L)', pg_temp.id('asg'), 'hi')),
                     'E2 cannot comment on E1''s assignment');
  perform pg_temp.ok(pg_temp.denied(format('select public.update_test(%L, %L)', pg_temp.id('e1test'), '{"name":"Hijacked"}')), 'E2 cannot edit E1''s test');
  perform pg_temp.ok(pg_temp.denied(format('select public.delete_test(%L)', pg_temp.id('e1test'))), 'E2 cannot delete E1''s test');
  perform pg_temp.ok(pg_temp.denied(format('select public.create_question(%L, %L)', pg_temp.id('e1test'), '{"type":"mcq_single","text":"x","marks":1}')),
                     'E2 cannot add a question to E1''s test');
  perform pg_temp.ok(pg_temp.denied(format('select public.delete_question(%L)', pg_temp.id('e1q'))), 'E2 cannot delete E1''s question');
  perform pg_temp.ok(pg_temp.denied(format('select public.duplicate_test(%L)', pg_temp.id('e1test'))), 'E2 cannot copy E1''s test');
  perform pg_temp.ok(pg_temp.denied(format('select public.update_test(%L, %L)', pg_temp.id('test'), '{"name":"Hijacked"}')),
                     'E2 cannot edit an admin series''s test');
  perform pg_temp.ok((select title from public.quizzes where id = pg_temp.id('e1test')) = 'E1T', 'E1''s test is unchanged');

  -- students can't use educator / admin authoring at all
  perform pg_temp.act_as(pg_temp.id('a'));
  perform pg_temp.ok(pg_temp.denied(format('select public.update_test(%L, %L)', pg_temp.id('test'), '{"name":"x"}')), 'a student cannot edit tests');
  perform pg_temp.ok(pg_temp.denied(format('select public.educator_get_assignment(%L)', pg_temp.id('asg'))), 'a student cannot open assignments');
  perform pg_temp.ok(pg_temp.denied(format('select public.get_student_detail(%L)', pg_temp.id('b'))), 'a student cannot read another student''s admin record');
  perform pg_temp.ok(pg_temp.denied(format('select public.block_student(%L, %L)', pg_temp.id('b'), 'nope')), 'a student cannot block another');
  perform pg_temp.ok(pg_temp.denied(format('select public.resolve_account_deletion_request(%L, %L)', gen_random_uuid(), 'approved')),
                     'a student cannot decide deletion requests');
end $$;

do $$ begin raise notice 'ok: all IDOR checks passed'; end $$;
rollback;
