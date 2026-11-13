-- =====================================================================
-- supabase/tests/qa_nov14.sql
--
-- Smoke tests for 20261114090000_admin_qa_nov14.sql:
--   * a test can't be published while its questions' marks differ from its
--     total (under: 3 of 40; over: 7 of 3); matching marks publish; the
--     series-level check (wizard / approval) gives the same answer;
--   * the Assign Educators badge counts open assignments only;
--   * tests split across educators (allocation), with marks and questions
--     shared in proportion; bad allocations refused;
--   * educators read and mark their own assignment notifications.
-- LOCAL / DISPOSABLE DATABASE ONLY. One transaction, rolled back.
-- Expect "ok: ..." notices and "ok: all QA 14 Nov checks passed".
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
  v_admin uuid := gen_random_uuid(); v_e1 uuid := gen_random_uuid(); v_e2 uuid := gen_random_uuid(); u uuid;
  v_series uuid; v_test uuid;
begin
  foreach u in array array[v_admin, v_e1, v_e2] loop
    insert into auth.users (id, email) values (u, 'q14-' || u || '@test.local');
  end loop;
  insert into public.profiles (id, role, full_name, email) values
    (v_admin, 'admin', 'Q14 Admin', 'q14-' || v_admin || '@test.local'),
    (v_e1, 'educator', 'Ashika', 'q14-' || v_e1 || '@test.local'),
    (v_e2, 'educator', 'Ravi', 'q14-' || v_e2 || '@test.local');
  insert into public.adm_admin_users (user_id) values (v_admin);
  insert into public.educator_profiles (user_id, full_name, phone, location, verification_status) values
    (v_e1, 'Ashika', '9000000021', 'Pune', 'verified'),
    (v_e2, 'Ravi', '9000000022', 'Goa', 'verified');
  perform public.adm_backfill_educator_approvals();

  perform pg_temp.act_as(v_admin);
  v_series := public.upsert_test_series_full(jsonb_build_object(
    'name', 'Kirchhoff Q14', 'pricing', 'free', 'startMethod', 'scratch',
    'availability', jsonb_build_object('goLive', 'now', 'mode', 'always'),
    'tests', jsonb_build_array(jsonb_build_object('name', 'Loops', 'duration', '20', 'passingPercent', '40', 'attemptLimit', '2',
      'totalMarks', '3',
      'questions', jsonb_build_array(jsonb_build_object('type', 'mcq_single', 'text', 'Current law?', 'marks', '3',
        'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', 'KCL'), jsonb_build_object('key', 'B', 'text', 'Ohm')),
        'correctAnswers', jsonb_build_array('A')))))), false);
  v_test := ((public.get_test_series(v_series)) #>> '{tests,0,id}')::uuid;
  perform pg_temp.remember('admin', v_admin); perform pg_temp.remember('e1', v_e1); perform pg_temp.remember('e2', v_e2);
  perform pg_temp.remember('series', v_series); perform pg_temp.remember('test', v_test);
end $fx$;

-- ------------------------------------------------------- publish marks rule
do $$
declare v_msg text;
begin
  perform pg_temp.act_as(pg_temp.id('admin'));
  perform pg_temp.ok(public.adm_validate_quiz_for_publish(pg_temp.id('test')) is null, 'marks match (3 of 3): ready');

  perform public.update_test(pg_temp.id('test'), jsonb_build_object('totalMarks', 40));
  v_msg := public.adm_validate_quiz_for_publish(pg_temp.id('test'));
  perform pg_temp.ok(v_msg like '%add up to 3 marks but the test''s total is 40%', 'under-allocated (3 of 40): ' || v_msg);
  perform pg_temp.expect_error(format('select public.set_test_status(%L, %L)', pg_temp.id('test'), 'published'), '22023');
  perform pg_temp.ok(true, '3 of 40: publish refused');
  perform pg_temp.ok(public.adm_series_publish_problem(pg_temp.id('series')) like '%add up to 3 marks%',
                     'the series-level check (wizard / approval) refuses too');

  perform public.update_test(pg_temp.id('test'), jsonb_build_object('totalMarks', 3));
  perform public.create_question(pg_temp.id('test'),
    '{"type":"mcq_single","text":"Voltage law?","marks":4,"options":[{"key":"A","text":"KVL"},{"key":"B","text":"KCL"}],"correctAnswers":["A"]}');
  v_msg := public.adm_validate_quiz_for_publish(pg_temp.id('test'));
  perform pg_temp.ok(v_msg like '%add up to 7 marks but the test''s total is 3%', 'over-allocated (7 of 3): ' || v_msg);
  perform pg_temp.expect_error(format('select public.set_test_status(%L, %L)', pg_temp.id('test'), 'published'), '22023');
  perform pg_temp.ok(true, '7 of 3: publish refused');

  perform public.update_test(pg_temp.id('test'), jsonb_build_object('totalMarks', 7));
  perform public.set_test_status(pg_temp.id('test'), 'published');
  perform pg_temp.ok((public.adm_test_json(pg_temp.id('test')) ->> 'status') = 'published', 'marks match (7 of 7): published');
  perform pg_temp.ok(public.adm_series_publish_problem(pg_temp.id('series')) is null, 'series-level check passes');
end $$;

-- ------------------------------------------- allocation + badge + notifications
do $$
declare ids uuid[]; v jsonb; r record; n int; v_badge int;
begin
  perform pg_temp.act_as(pg_temp.id('admin'));
  perform pg_temp.expect_error(format('select public.create_assignments(%L)', jsonb_build_object(
    'seriesMode', 'existing', 'seriesId', pg_temp.id('series'), 'subject', 'Physics', 'testName', 'Split',
    'educatorIds', jsonb_build_array(pg_temp.id('e1'), pg_temp.id('e2')), 'testCount', 2, 'deadline', current_date + 5,
    'allocation', jsonb_build_array(jsonb_build_object('educatorId', pg_temp.id('e1'), 'tests', 2),
                                    jsonb_build_object('educatorId', pg_temp.id('e2'), 'tests', 1)))), '22023');
  perform pg_temp.ok(true, 'allocation not adding up to the number of tests: refused');
  perform pg_temp.expect_error(format('select public.create_assignments(%L)', jsonb_build_object(
    'seriesMode', 'existing', 'seriesId', pg_temp.id('series'), 'subject', 'Physics', 'testName', 'Split',
    'testCount', 2, 'deadline', current_date + 5,
    'allocation', jsonb_build_array(jsonb_build_object('educatorId', pg_temp.id('e1'), 'tests', 1),
                                    jsonb_build_object('educatorId', pg_temp.id('e1'), 'tests', 1)))), '22023');
  perform pg_temp.ok(true, 'the same educator twice: refused');

  ids := public.create_assignments(jsonb_build_object(
    'seriesMode', 'existing', 'seriesId', pg_temp.id('series'), 'subject', 'Physics', 'testName', 'Split',
    'educatorIds', jsonb_build_array(pg_temp.id('e1'), pg_temp.id('e2')), 'testCount', 2, 'totalMarks', 30,
    'questionCount', 20, 'deadline', current_date + 5,
    'allocation', jsonb_build_array(jsonb_build_object('educatorId', pg_temp.id('e1'), 'tests', 1),
                                    jsonb_build_object('educatorId', pg_temp.id('e2'), 'tests', 1))));
  perform pg_temp.ok(cardinality(ids) = 2, 'two tests, two educators: two assignments');
  for r in select educator_id, test_count, total_marks, question_count from public.test_assignments where id = any (ids) loop
    perform pg_temp.ok(r.test_count = 1 and r.total_marks = 15 and r.question_count = 10,
                       'each educator: 1 test, 15 of 30 marks, 10 of 20 questions');
  end loop;

  ids := public.create_assignments(jsonb_build_object(
    'seriesMode', 'existing', 'seriesId', pg_temp.id('series'), 'subject', 'Physics', 'testName', 'Old style',
    'educatorIds', jsonb_build_array(pg_temp.id('e1')), 'testCount', 3, 'totalMarks', 60, 'deadline', current_date + 5));
  perform pg_temp.ok((select test_count = 3 and total_marks = 60 from public.test_assignments where id = ids[1]),
                     'no allocation: one educator gets all 3 tests and 60 marks (as before)');

  -- badge: 3 open now; cancel one -> 2
  select (x ->> 'badge')::int into v_badge from jsonb_array_elements(public.get_admin_nav()) x where x ->> 'key' = 'assign_educators';
  perform pg_temp.ok(v_badge = 3, 'badge = 3 open assignments');
  perform public.cancel_assignment(ids[1], 'no');
  select (x ->> 'badge')::int into v_badge from jsonb_array_elements(public.get_admin_nav()) x where x ->> 'key' = 'assign_educators';
  perform pg_temp.ok(v_badge = 2, 'a cancelled assignment leaves the badge (2)');

  -- educator notifications
  perform pg_temp.act_as(pg_temp.id('e1'));
  v := public.educator_list_assignment_notifications();
  perform pg_temp.ok((v ->> 'unread')::int = 3 and jsonb_array_length(v -> 'rows') = 3,
                     'Ashika has 3 unread assignment notifications (2 assigned + 1 cancelled)');
  perform pg_temp.ok(exists (select 1 from jsonb_array_elements(v -> 'rows') x where x ->> 'message' like '%1 test.%'),
                     'the message says how many tests are theirs');
  perform pg_temp.act_as(pg_temp.id('e2'));
  n := public.educator_mark_assignment_notification_read((v #>> '{rows,0,id}')::uuid);
  perform pg_temp.ok(n = 0, 'another educator cannot mark it read');
  perform pg_temp.act_as(pg_temp.id('e1'));
  n := public.educator_mark_assignment_notification_read((v #>> '{rows,0,id}')::uuid);
  perform pg_temp.ok(n = 1 and (public.educator_list_assignment_notifications() ->> 'unread')::int = 2, 'mark one read: 2 unread');
  n := public.educator_mark_all_assignment_notifications_read();
  perform pg_temp.ok(n = 2, 'mark all read: 2 changed');
  perform pg_temp.ok((public.educator_list_assignment_notifications(true) ->> 'unread')::int = 0, 'nothing unread');
  perform pg_temp.act_as(pg_temp.id('admin'));
  perform pg_temp.expect_error('select public.educator_list_assignment_notifications()', '42501');
  perform pg_temp.ok(true, 'not an educator: refused');
end $$;

do $$ begin raise notice 'ok: all QA 14 Nov checks passed'; end $$;
rollback;
