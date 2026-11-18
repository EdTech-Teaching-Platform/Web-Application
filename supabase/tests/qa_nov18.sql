-- =====================================================================
-- supabase/tests/qa_nov18.sql
--
-- Tests for 20261118090000_admin_qa_nov18.sql (and an end-to-end check of
-- the attempt limit, QA 18 Nov #2).
-- LOCAL / DISPOSABLE DATABASE ONLY. Never run it against the lead's project:
-- it inserts fixture rows into auth.users and lead tables. Everything runs in
-- one transaction and is rolled back.
--
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/qa_nov18.sql
--
-- Covers
--   1. attempt limit: a test saved with "Attempts allowed" 2 through the wizard
--      allows exactly 2 attempts; the intro and series card say so
--   2. assignment with 2 tests: the educator sees test_count 2, created 0 / 1 / 2,
--      remaining, the tests list; start creates "Name - Test 1" with half the
--      questions and marks; add creates Test 2; a third is refused; a
--      deleted test frees its slot; another educator can't add
--   3. delete account: service role only (anon, student refused); a student is
--      blocked, an educator suspended, a pending request closed; one record per
--      deletion (self_service); admins refused
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

do $fx$
declare
  v_admin uuid := gen_random_uuid(); v_e1 uuid := gen_random_uuid(); v_e2 uuid := gen_random_uuid();
  v_s1 uuid := gen_random_uuid(); v_s2 uuid := gen_random_uuid(); u uuid;
begin
  foreach u in array array[v_admin, v_e1, v_e2, v_s1, v_s2] loop
    insert into auth.users (id, email) values (u, 'q18-' || u || '@test.local');
  end loop;
  insert into public.profiles (id, role, full_name, email) values
    (v_admin, 'admin', 'Q18 Admin', 'q18-' || v_admin || '@test.local'),
    (v_e1, 'educator', 'Ashika', 'q18-' || v_e1 || '@test.local'),
    (v_e2, 'educator', 'Ravi', 'q18-' || v_e2 || '@test.local'),
    (v_s1, 'student', 'Student One', 'q18-' || v_s1 || '@test.local'),
    (v_s2, 'student', 'Student Two', 'q18-' || v_s2 || '@test.local');
  insert into public.adm_admin_users (user_id) values (v_admin);
  insert into public.educator_profiles (user_id, full_name, phone, location, verification_status) values
    (v_e1, 'Ashika', '9000000031', 'Pune', 'verified'),
    (v_e2, 'Ravi', '9000000032', 'Goa', 'verified');
  perform public.adm_backfill_educator_approvals();
  perform pg_temp.remember('admin', v_admin); perform pg_temp.remember('e1', v_e1); perform pg_temp.remember('e2', v_e2);
  perform pg_temp.remember('s1', v_s1); perform pg_temp.remember('s2', v_s2);
end $fx$;

-- ------------------------------------------------------- 1. attempt limit
do $$
declare sid uuid; qid uuid; a jsonb; v jsonb; i int; n_ok int := 0; v_err text;
begin
  perform pg_temp.act_as(pg_temp.id('admin'));
  sid := public.upsert_test_series_full(jsonb_build_object(
    'name', 'Q18 Attempts', 'pricing', 'free', 'startMethod', 'scratch',
    'availability', jsonb_build_object('goLive', 'now', 'mode', 'always'),
    'tests', jsonb_build_array(jsonb_build_object('name', 'Two tries', 'duration', '20', 'passingPercent', '50',
      'attemptLimit', '2', 'totalMarks', '4', 'status', 'published',
      'questions', jsonb_build_array(jsonb_build_object('type', 'mcq_single', 'text', 'Two plus two?', 'marks', '4',
        'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', '3'), jsonb_build_object('key', 'B', 'text', '4')),
        'correctAnswers', jsonb_build_array('B')))))), true);
  select id into qid from public.quizzes where series_id = sid;
  perform pg_temp.ok((select max_attempts from public.quizzes where id = qid) = 2, 'wizard "Attempts allowed" 2 is saved as max_attempts 2');

  perform pg_temp.act_as(pg_temp.id('s1'));
  perform public.student_enroll(sid);
  for i in 1..3 loop
    begin
      a := public.student_start_attempt(qid);
      perform public.student_submit_attempt((a ->> 'attempt_id')::uuid);
      n_ok := n_ok + 1;
    exception when others then
      v_err := sqlerrm;
    end;
  end loop;
  perform pg_temp.ok(n_ok = 2 and v_err like 'You have used all 2 attempts%', 'attempt limit 2: two attempts, the third refused (' || coalesce(v_err, '-') || ')');
  v := public.student_get_test_intro(qid);
  perform pg_temp.ok((v ->> 'can_start')::boolean = false and v ->> 'blocked_reason' = 'attempts_exhausted'
                     and (v ->> 'attempts_remaining')::int = 0, 'intro: attempts exhausted, nothing remaining');
  v := public.student_get_series(sid) -> 'tests' -> 0;
  perform pg_temp.ok((v ->> 'attempts_used')::int = 2 and (v ->> 'attempts_allowed')::int = 2, 'series card: 2 of 2 used');
end $$;

-- ------------------------------------------------- 2. assignment tests
do $$
declare ids uuid[]; aid uuid; v jsonb; l jsonb; t2 uuid;
begin
  perform pg_temp.act_as(pg_temp.id('admin'));
  ids := public.create_assignments(jsonb_build_object(
    'seriesMode', 'new', 'newSeriesName', 'Q18 Assigned Series', 'subject', 'Physics', 'testName', 'Optics',
    'educatorIds', jsonb_build_array(pg_temp.id('e1')), 'testCount', 2, 'totalMarks', 30,
    'questionCount', 20, 'duration', 45, 'deadline', current_date + 7));
  aid := ids[1];
  perform pg_temp.remember('asg', aid);

  perform pg_temp.act_as(pg_temp.id('e1'));
  l := public.educator_list_assignments(null) -> 0;
  perform pg_temp.ok((l ->> 'test_count')::int = 2 and (l ->> 'tests_created')::int = 0 and (l ->> 'tests_remaining')::int = 2
                     and not l ? 'tests', 'list: 2 tests required, 0 created, 2 to go');
  v := public.educator_get_assignment(aid) -> 'assignment';
  perform pg_temp.ok((v ->> 'test_count')::int = 2 and jsonb_array_length(v -> 'tests') = 0, 'detail: test_count 2, no tests yet');

  v := public.educator_start_assignment(aid) -> 'assignment';
  perform pg_temp.ok((v ->> 'tests_created')::int = 1 and (v ->> 'tests_remaining')::int = 1
                     and v #>> '{tests,0,title}' = 'Optics - Test 1', 'start: "Optics - Test 1" created, 1 to go');
  perform pg_temp.ok((select q.max_attempts is not null and qa.planned_questions = 10 and qa.total_marks_planned = 15
                        from public.quizzes q join public.quiz_admin qa on qa.quiz_id = q.id
                       where q.id = (v #>> '{tests,0,id}')::uuid), 'test 1 has its share: 10 questions, 15 marks');

  perform pg_temp.act_as(pg_temp.id('e2'));
  perform pg_temp.expect_error(format('select public.educator_add_assignment_test(%L)', aid), 'P0002');
  perform pg_temp.ok(true, 'another educator can''t add a test to it');

  perform pg_temp.act_as(pg_temp.id('e1'));
  v := public.educator_add_assignment_test(aid) -> 'assignment';
  t2 := (v #>> '{tests,1,id}')::uuid;
  perform pg_temp.ok((v ->> 'tests_created')::int = 2 and (v ->> 'tests_remaining')::int = 0
                     and v #>> '{tests,1,title}' = 'Optics - Test 2', 'add: "Optics - Test 2", 0 to go');
  perform pg_temp.expect_error(format('select public.educator_add_assignment_test(%L)', aid), '22023');
  perform pg_temp.ok(true, 'a third test is refused');
  perform pg_temp.ok((public.educator_list_assignments(null) -> 0 ->> 'tests_created')::int = 2, 'list shows 2 created');

  perform public.delete_test(t2);
  v := public.educator_get_assignment(aid) -> 'assignment';
  perform pg_temp.ok((v ->> 'tests_created')::int = 1 and (v ->> 'tests_remaining')::int = 1, 'a deleted test frees its slot');
  v := public.educator_add_assignment_test(aid) -> 'assignment';
  perform pg_temp.ok((v ->> 'tests_created')::int = 2, 'and it can be created again');

  perform pg_temp.act_as(pg_temp.id('s1'));
  perform pg_temp.expect_error(format('select public.educator_add_assignment_test(%L)', aid), '42501');
  perform pg_temp.ok(true, 'a student can''t add tests');
end $$;

-- ------------------------------------------------- 3. delete account
do $$
declare v jsonb; n int;
begin
  -- browser roles can't call it
  perform pg_temp.act_as(pg_temp.id('s1'));
  set local role authenticated;
  perform pg_temp.expect_error(format('select public.adm_account_delete_self(%L, null)', pg_temp.id('s1')), '42501');
  reset role;
  set local role anon;
  perform pg_temp.expect_error(format('select public.adm_account_delete_self(%L, null)', pg_temp.id('s1')), '42501');
  reset role;
  perform pg_temp.ok(true, 'anon and signed-in users can''t call adm_account_delete_self (service role only)');

  -- student with a pending request: the request is closed, the account blocked
  perform pg_temp.act_as(pg_temp.id('s1'));
  perform public.account_request_deletion('old request');
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  v := public.adm_account_delete_self(pg_temp.id('s1'), 'Not using it');
  reset role;
  perform pg_temp.ok(v ->> 'status' = 'approved' and (v ->> 'self_service')::boolean and v ->> 'role' = 'student',
                     'student: deletion recorded (approved, self-service)');
  select count(*) into n from public.account_deletion_requests where user_id = pg_temp.id('s1');
  perform pg_temp.ok(n = 1 and not exists (select 1 from public.account_deletion_requests
                                            where user_id = pg_temp.id('s1') and status = 'pending'),
                     'the pending request became the deletion record (one row)');
  perform pg_temp.ok(public.adm_is_account_blocked(pg_temp.id('s1')), 'student: blocked at once');
  perform pg_temp.ok(exists (select 1 from public.audit_logs where action = 'account.deleted_by_user' and target_id = pg_temp.id('s1')),
                     'audited as account.deleted_by_user');
  perform pg_temp.act_as(pg_temp.id('s1'));
  perform pg_temp.expect_error('select public.student_my_series()', 'UL403');
  perform pg_temp.ok(true, 'a deleted student''s RPCs are refused');

  -- educator: suspended
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  v := public.adm_account_delete_self(pg_temp.id('e2'), null);
  perform pg_temp.ok(v ->> 'role' = 'educator' and (select account_status from public.educator_admin_state where user_id = pg_temp.id('e2')) = 'suspended',
                     'educator: suspended at once');

  -- admins never
  perform pg_temp.expect_error(format('select public.adm_account_delete_self(%L, null)', pg_temp.id('admin')), '42501');
  perform pg_temp.ok(true, 'an admin account can''t be deleted this way');
end $$;

do $$ begin raise notice 'ok: all QA 18 Nov checks passed'; end $$;
rollback;
