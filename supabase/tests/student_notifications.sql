-- =====================================================================
-- supabase/tests/student_notifications.sql
--
-- Smoke tests for 20261107090000_student_notifications.sql, end to end:
-- a student reports an issue, the admin resolves it (set_moderation_status
-- writes the notification), the student sees it in student_list_notifications
-- and marks it read. Another student never sees or changes it; a blocked
-- student is refused.
-- LOCAL / DISPOSABLE DATABASE ONLY. One transaction, rolled back.
-- Expect "ok: ..." notices and "ok: all student notification checks passed".
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
  v_admin uuid := gen_random_uuid(); v_stu uuid := gen_random_uuid(); v_other uuid := gen_random_uuid(); u uuid;
  v_series uuid; v_test uuid; v_att uuid; v jsonb; v_fb uuid;
begin
  foreach u in array array[v_admin, v_stu, v_other] loop
    insert into auth.users (id, email) values (u, 'sn-' || u || '@test.local');
  end loop;
  insert into public.profiles (id, role, full_name, email) values
    (v_admin, 'admin', 'Inbox Admin', 'sn-' || v_admin || '@test.local'),
    (v_stu, 'student', 'Inbox Student', 'sn-' || v_stu || '@test.local'),
    (v_other, 'student', 'Other Student', 'sn-' || v_other || '@test.local');
  insert into public.adm_admin_users (user_id) values (v_admin);

  perform pg_temp.act_as(v_admin);
  v_series := public.upsert_test_series_full(jsonb_build_object(
    'name', 'Inbox test series', 'pricing', 'free', 'startMethod', 'scratch',
    'availability', jsonb_build_object('goLive', 'now', 'mode', 'always'),
    'tests', jsonb_build_array(jsonb_build_object('name', 'Unit 1', 'duration', '20', 'passingPercent', '50', 'attemptLimit', '3',
      'questions', jsonb_build_array(jsonb_build_object('type', 'mcq_single', 'text', 'Two plus two?', 'marks', '4',
        'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', '3'), jsonb_build_object('key', 'B', 'text', '4')),
        'correctAnswers', jsonb_build_array('B')))))), true);
  v_test := ((public.get_test_series(v_series)) #>> '{tests,0,id}')::uuid;

  perform pg_temp.act_as(v_stu);
  perform public.student_enroll(v_series);
  v := public.student_start_attempt(v_test);
  v_att := (v ->> 'attempt_id')::uuid;
  perform public.student_submit_attempt(v_att);
  v_fb := public.student_submit_feedback(v_att, 'issue', null, 'wrong_answer', ((v -> 'questions' -> 0) ->> 'id')::uuid, 'Option A should also be right.');

  perform pg_temp.remember('admin', v_admin); perform pg_temp.remember('stu', v_stu); perform pg_temp.remember('other', v_other);
  perform pg_temp.remember('series', v_series); perform pg_temp.remember('fb', v_fb);
end $fx$;

-- ------------------------------------------------------------ before
do $$
declare v jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('stu'));
  v := public.student_list_notifications();
  perform pg_temp.ok(jsonb_array_length(v -> 'rows') = 0 and (v ->> 'unread')::int = 0, 'before the resolve: the inbox is empty');
  perform pg_temp.act_as(null);
  perform pg_temp.expect_error('select public.student_list_notifications()', '42501');
  perform pg_temp.ok(true, 'signed out: refused (42501)');
end $$;

-- ------------------------------------------------- the admin resolves it
do $$
begin
  perform pg_temp.act_as(pg_temp.id('admin'));
  perform public.set_moderation_status(pg_temp.id('fb'), 'resolved', 'Thanks, option A is now accepted too. Your score was updated.');
end $$;

do $$
declare v jsonb; r jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('stu'));
  v := public.student_list_notifications();
  r := v -> 'rows' -> 0;
  perform pg_temp.ok(jsonb_array_length(v -> 'rows') = 1 and (v ->> 'unread')::int = 1, 'after the resolve: one unread notification');
  perform pg_temp.ok(r ->> 'title' = 'Your reported issue was resolved' and r ->> 'reference_type' = 'test_feedback'
                     and (r ->> 'reference_id')::uuid = pg_temp.id('fb') and not (r ->> 'is_read')::boolean,
                     'it names the resolution and points at the report');
  perform pg_temp.ok(r ->> 'body' like 'Thanks, option A is now accepted too.%', 'the body is the admin''s note to the student');
  perform pg_temp.ok(r ->> 'action_url' = '/student/test-series/' || pg_temp.id('series'), 'the link opens the test series');
  perform pg_temp.ok(jsonb_array_length(public.student_list_notifications(true) -> 'rows') = 1, 'unread-only lists it');
  perform pg_temp.remember('n1', (r ->> 'id')::uuid);

  -- another student never sees or changes it
  perform pg_temp.act_as(pg_temp.id('other'));
  perform pg_temp.ok(jsonb_array_length(public.student_list_notifications() -> 'rows') = 0, 'another student does not see it');
  perform pg_temp.ok(public.student_mark_notification_read(pg_temp.id('n1')) = 0
                     and public.student_mark_all_notifications_read() = 0, 'another student cannot mark it read');

  perform pg_temp.act_as(pg_temp.id('stu'));
  perform pg_temp.ok(public.student_mark_notification_read(pg_temp.id('n1')) = 1, 'the student marks it read');
  perform pg_temp.ok(public.student_mark_notification_read(pg_temp.id('n1')) = 0, 'marking again changes nothing');
  v := public.student_list_notifications();
  perform pg_temp.ok((v ->> 'unread')::int = 0 and (v -> 'rows' -> 0 ->> 'is_read')::boolean
                     and (v -> 'rows' -> 0 ->> 'read_at') is not null, 'read: still listed (the history stays), unread 0');
  perform pg_temp.ok(jsonb_array_length(public.student_list_notifications(true) -> 'rows') = 0, 'unread-only is empty');
end $$;

-- ------------------------------------- mark all, limit, unsafe links
do $$
declare v jsonb; i int;
begin
  for i in 1..3 loop
    insert into public.notifications (user_id, category, title, body, action_url, reference_type)
    values (pg_temp.id('stu'), 'system', 'Notice ' || i, 'Body ' || i,
            case i when 1 then 'https://evil.example/phish' when 2 then '/admin/usermanagement' else '/student/history' end, 'test');
  end loop;
  perform pg_temp.act_as(pg_temp.id('stu'));
  v := public.student_list_notifications(false, 2);
  perform pg_temp.ok(jsonb_array_length(v -> 'rows') = 2 and (v ->> 'unread')::int = 3, 'p_limit caps the rows; unread counts all');
  v := public.student_list_notifications(false, 100);
  perform pg_temp.ok((select count(*) from jsonb_array_elements(v -> 'rows') e where e ->> 'action_url' is not null) = 2,
                     'only /student/ links are returned (an outside or admin link becomes null)');
  perform pg_temp.ok(public.student_mark_all_notifications_read() = 3, 'mark all read: 3 rows');
  perform pg_temp.ok((public.student_list_notifications() ->> 'unread')::int = 0, 'nothing unread');
end $$;

-- ------------------------------------------------------- blocked
do $$
begin
  perform pg_temp.act_as(pg_temp.id('admin'));
  perform public.block_student(pg_temp.id('stu'), 'test');
  perform pg_temp.act_as(pg_temp.id('stu'));
  perform pg_temp.expect_error('select public.student_list_notifications()', 'UL403');
  perform pg_temp.expect_error('select public.student_mark_all_notifications_read()', 'UL403');
  perform pg_temp.ok(true, 'a blocked student is refused (UL403)');
  raise notice 'ok: all student notification checks passed';
end $$;

rollback;
