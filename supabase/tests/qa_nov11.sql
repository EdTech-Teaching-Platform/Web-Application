-- =====================================================================
-- supabase/tests/qa_nov11.sql
--
-- Smoke tests for 20261111090000_admin_qa_nov11.sql:
--   * an assignment keeps test_count / grade / exam / audience through create
--     and Edit Requirements (#23); the detail history names the actor (#24);
--   * "Recently assigned" is newest first by created_at, a cancelled one
--     keeps its place (#25); a cancelled assignment can't be edited (#22);
--   * adm_test_json returns the planned total next to the questions' sum
--     (#18 / #20);
--   * the delete-account request flow (#21): request, idempotent, cancel,
--     admin list, reject (notification), approve (student blocked,
--     educator suspended), non-admins refused.
-- LOCAL / DISPOSABLE DATABASE ONLY. One transaction, rolled back.
-- Expect "ok: ..." notices and "ok: all QA 11 Nov checks passed".
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
  v_admin uuid := gen_random_uuid(); v_edu uuid := gen_random_uuid(); v_stu uuid := gen_random_uuid();
  v_edu2 uuid := gen_random_uuid(); u uuid; v_series uuid;
begin
  foreach u in array array[v_admin, v_edu, v_stu, v_edu2] loop
    insert into auth.users (id, email) values (u, 'q11-' || u || '@test.local');
  end loop;
  insert into public.profiles (id, role, full_name, email) values
    (v_admin, 'admin', 'Q11 Admin', 'q11-' || v_admin || '@test.local'),
    (v_edu, 'educator', 'Ashika', 'q11-' || v_edu || '@test.local'),
    (v_edu2, 'educator', 'Second Educator', 'q11-' || v_edu2 || '@test.local'),
    (v_stu, 'student', 'Q11 Student', 'q11-' || v_stu || '@test.local');
  insert into public.adm_admin_users (user_id) values (v_admin);
  insert into public.educator_profiles (user_id, full_name, phone, location, verification_status) values
    (v_edu, 'Ashika', '9000000011', 'Pune', 'verified'),
    (v_edu2, 'Second Educator', '9000000012', 'Goa', 'verified');
  perform public.adm_backfill_educator_approvals();

  perform pg_temp.act_as(v_admin);
  v_series := public.upsert_test_series_full(jsonb_build_object(
    'name', 'Kirchhoff', 'pricing', 'free', 'startMethod', 'scratch',
    'availability', jsonb_build_object('goLive', 'now', 'mode', 'always'),
    'tests', jsonb_build_array(jsonb_build_object('name', 'Loops', 'duration', '20', 'passingPercent', '40', 'attemptLimit', '2',
      'totalMarks', '15',
      'questions', jsonb_build_array(jsonb_build_object('type', 'mcq_single', 'text', 'Current law?', 'marks', '3',
        'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', 'KCL'), jsonb_build_object('key', 'B', 'text', 'Ohm')),
        'correctAnswers', jsonb_build_array('A')))))), true);

  perform pg_temp.remember('admin', v_admin); perform pg_temp.remember('edu', v_edu); perform pg_temp.remember('edu2', v_edu2);
  perform pg_temp.remember('stu', v_stu); perform pg_temp.remember('series', v_series);
end $fx$;

-- -------------------------------------------------- assignments (#22-#25)
do $$
declare
  a1 uuid; a2 uuid; a3 uuid; v jsonb; r jsonb; v_order text[];
begin
  perform pg_temp.act_as(pg_temp.id('admin'));
  a1 := (public.create_assignments(jsonb_build_object('seriesMode', 'existing', 'seriesId', pg_temp.id('series'),
           'subject', 'Physics', 'testName', 'First', 'educatorIds', jsonb_build_array(pg_temp.id('edu')),
           'questionCount', 10, 'totalMarks', 15, 'testCount', 5, 'grade', '12th Grade', 'exam', 'JEE', 'audience', 'Droppers',
           'deadline', current_date + 7)))[1];
  update public.test_assignments set created_at = now() - interval '2 hours' where id = a1;
  a2 := (public.create_assignments(jsonb_build_object('seriesMode', 'existing', 'seriesId', pg_temp.id('series'),
           'subject', 'Physics', 'testName', 'Second', 'educatorIds', jsonb_build_array(pg_temp.id('edu')),
           'questionCount', 10, 'deadline', current_date + 3)))[1];
  update public.test_assignments set created_at = now() - interval '1 hour' where id = a2;
  a3 := (public.create_assignments(jsonb_build_object('seriesMode', 'existing', 'seriesId', pg_temp.id('series'),
           'subject', 'Physics', 'testName', 'Third', 'educatorIds', jsonb_build_array(pg_temp.id('edu')),
           'questionCount', 10, 'deadline', current_date + 9)))[1];

  select row_data into r from public.list_assignments(p_sort := 'deadline_asc', p_size := 50) l
   where (l.row_data ->> 'id')::uuid = a1;
  perform pg_temp.ok((r ->> 'test_count')::int = 5 and r ->> 'grade' = '12th Grade' and r ->> 'exam' = 'JEE'
                     and r ->> 'audience' = 'Droppers', 'created with 5 tests, grade, exam, audience: listed back (#23)');
  select row_data into r from public.list_assignments(p_sort := 'deadline_asc', p_size := 50) l
   where (l.row_data ->> 'id')::uuid = a2;
  perform pg_temp.ok((r ->> 'test_count')::int = 1, 'no test count given: 1');

  perform public.update_assignment_requirements(a1, jsonb_build_object('testCount', 4, 'exam', 'NEET'));
  v := public.get_assignment_detail(a1);
  perform pg_temp.ok((v #>> '{assignment,test_count}')::int = 4 and v #>> '{assignment,exam}' = 'NEET'
                     and v #>> '{assignment,grade}' = '12th Grade', 'Edit Requirements: 4 tests saved, untouched fields kept');
  perform pg_temp.ok(jsonb_array_length(v -> 'history') >= 2 and v #>> '{history,0,by}' = 'Q11 Admin',
                     'detail history names the admin (#24)');
  perform pg_temp.expect_error(format('select public.update_assignment_requirements(%L, %L)', a1, '{"testCount": 0}'), '22023');
  perform pg_temp.ok(true, 'test count 0 refused (22023)');

  perform public.cancel_assignment(a1, 'Not needed');
  select array_agg(l.row_data ->> 'test_name' order by l.ord) into v_order
    from (select row_data, row_number() over () as ord from public.list_assignments(p_sort := 'assigned_desc', p_size := 50)) l
   where l.row_data ->> 'test_name' in ('First', 'Second', 'Third');
  perform pg_temp.ok(v_order = array['Third', 'Second', 'First'],
                     'Recently assigned: newest first, the cancelled one keeps its place (#25): ' || array_to_string(v_order, ','));
  perform pg_temp.expect_error(format('select public.update_assignment_requirements(%L, %L)', a1, '{"testCount": 2}'), 'P0002');
  perform pg_temp.ok(true, 'a cancelled assignment cannot be edited (#22)');
end $$;

-- --------------------------------------------------- test marks (#18, #20)
do $$
declare v jsonb; v_test uuid;
begin
  perform pg_temp.act_as(pg_temp.id('admin'));
  v_test := ((public.get_test_series(pg_temp.id('series'))) #>> '{tests,0,id}')::uuid;
  perform public.update_test(v_test, jsonb_build_object('totalMarks', 15, 'passingMarks', 6));
  v := public.adm_test_json(v_test);
  perform pg_temp.ok((v ->> 'total_marks_planned')::numeric = 15 and (v ->> 'marks_sum')::numeric = 3,
                     'planned total 15 returned next to the questions'' 3 marks');
  perform pg_temp.ok((v ->> 'total_marks')::numeric = 3, 'total_marks unchanged (the questions'' sum)');
  perform pg_temp.ok((v ->> 'passing_marks')::numeric = 6, 'passing marks saved');
end $$;

-- ------------------------------------------------ delete account (#21)
do $$
declare v jsonb; v2 jsonb; n int; rid uuid;
begin
  perform pg_temp.act_as(null);
  perform pg_temp.expect_error('select public.account_request_deletion(null)', '42501');
  perform pg_temp.ok(true, 'signed out: refused');
  perform pg_temp.act_as(pg_temp.id('admin'));
  perform pg_temp.expect_error('select public.account_request_deletion(null)', '42501');
  perform pg_temp.ok(true, 'an admin account cannot use the self-service request');

  perform pg_temp.act_as(pg_temp.id('stu'));
  perform pg_temp.ok(public.account_get_deletion_request() is null, 'no request yet');
  v := public.account_request_deletion('Moving abroad');
  v2 := public.account_request_deletion('again');
  perform pg_temp.ok(v ->> 'status' = 'pending' and v ->> 'id' = v2 ->> 'id' and v2 ->> 'reason' = 'Moving abroad',
                     'student request is pending; asking again returns the same request');
  perform pg_temp.ok(public.account_cancel_deletion_request() ->> 'status' = 'cancelled', 'the student can withdraw it');
  perform pg_temp.ok(public.account_cancel_deletion_request() is null, 'nothing left to withdraw');
  v := public.account_request_deletion(null);
  perform pg_temp.expect_error('select * from public.list_account_deletion_requests()', '42501');
  perform pg_temp.ok(true, 'a student cannot list requests');
  perform pg_temp.expect_error(format('select public.resolve_account_deletion_request(%L, %L)', v ->> 'id', 'approved'), '42501');
  perform pg_temp.ok(true, 'a student cannot approve requests');
  perform pg_temp.remember('stu_req', (v ->> 'id')::uuid);

  perform pg_temp.act_as(pg_temp.id('edu'));
  v := public.account_request_deletion('Leaving');
  perform pg_temp.ok(v ->> 'status' = 'pending', 'educator request is pending');
  perform pg_temp.remember('edu_req', (v ->> 'id')::uuid);
  perform pg_temp.act_as(pg_temp.id('edu2'));
  perform pg_temp.remember('edu2_req', (public.account_request_deletion(null) ->> 'id')::uuid);

  perform pg_temp.act_as(pg_temp.id('admin'));
  select count(*) into n from public.list_account_deletion_requests('pending');
  perform pg_temp.ok(n = 3, 'admin lists the 3 pending requests');
  select count(*) into n from public.list_account_deletion_requests('all', 'Ashika');
  perform pg_temp.ok(n = 1, 'search by name');

  v := public.resolve_account_deletion_request(pg_temp.id('edu2_req'), 'rejected', 'Open assignments first.');
  perform pg_temp.ok(v ->> 'status' = 'rejected' and exists (select 1 from public.notifications
                       where user_id = pg_temp.id('edu2') and reference_type = 'account_deletion'),
                     'reject: status rejected, the user is notified');
  perform pg_temp.ok(not public.adm_is_account_blocked(pg_temp.id('edu2')), 'reject leaves the account active');
  perform pg_temp.expect_error(format('select public.resolve_account_deletion_request(%L, %L)', pg_temp.id('edu2_req'), 'approved'), '22023');
  perform pg_temp.ok(true, 'an already handled request cannot be decided again');

  v := public.resolve_account_deletion_request(pg_temp.id('stu_req'), 'approved', null);
  perform pg_temp.ok(v ->> 'status' = 'approved' and v ->> 'role' = 'student' and (v ->> 'user_id')::uuid = pg_temp.id('stu'),
                     'approve returns user_id and role (for set-user-ban)');
  perform pg_temp.ok(public.adm_is_account_blocked(pg_temp.id('stu')), 'approve: the student is blocked');
  v := public.resolve_account_deletion_request(pg_temp.id('edu_req'), 'approved', 'As requested');
  perform pg_temp.ok((select account_status from public.educator_admin_state where user_id = pg_temp.id('edu')) = 'suspended',
                     'approve: the educator is suspended');

  perform pg_temp.act_as(pg_temp.id('stu'));
  perform pg_temp.ok(public.account_get_deletion_request() ->> 'status' = 'approved', 'the student sees the decision');
  perform pg_temp.ok(not has_table_privilege('authenticated', 'public.account_deletion_requests', 'select'),
                     'the table is not readable directly');
end $$;

do $$ begin raise notice 'ok: all QA 11 Nov checks passed'; end $$;
rollback;
