-- =====================================================================
-- supabase/tests/feedback_rpcs.sql
--
-- Smoke tests for test feedback / moderation (20261027100000 .. 100300).
-- LOCAL / DISPOSABLE DATABASE ONLY (inserts fixtures into auth.users and lead
-- tables). One transaction, rolled back.
-- Expect "ok: ..." notices and "ok: all feedback checks passed".
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

create function pg_temp.claims(p_key text) returns text
language sql as $$ select json_build_object('sub', current_setting('test.' || p_key), 'role', 'authenticated')::text $$;

do $fx$
declare
  v_admin uuid := gen_random_uuid(); v_a uuid := gen_random_uuid(); v_b uuid := gen_random_uuid();
  v_course uuid; v_series uuid; v_quiz uuid; v_quiz2 uuid; v_q1 uuid; v_other_q uuid; v_att uuid; v_open uuid;
begin
  insert into auth.users (id, email) values
    (v_admin, 'fb-admin-' || v_admin || '@t.local'), (v_a, 'fb-a-' || v_a || '@t.local'), (v_b, 'fb-b-' || v_b || '@t.local');
  insert into public.profiles (id, role, full_name, email) values
    (v_admin, 'admin', 'Moderator', 'fb-admin-' || v_admin || '@t.local'),
    (v_a, 'student', 'Student A', 'fb-a-' || v_a || '@t.local'),
    (v_b, 'student', 'Student B', 'fb-b-' || v_b || '@t.local');
  insert into public.adm_admin_users (user_id) values (v_admin);
  insert into public.courses (educator_id, title, slug) values (v_admin, 'FB course', 'fb-' || v_admin) returning id into v_course;
  insert into public.test_series (course_id, title, is_published, is_active) values (v_course, 'FB Physics series', true, true) returning id into v_series;
  insert into public.quizzes (course_id, series_id, title) values (v_course, v_series, 'FB Test 1') returning id into v_quiz;
  insert into public.quizzes (course_id, series_id, title) values (v_course, v_series, 'FB Test 2') returning id into v_quiz2;
  insert into public.quiz_questions (quiz_id, question_text, question_type, points, sort_order) values (v_quiz, 'Q1 text', 'multiple_choice', 1, 1) returning id into v_q1;
  insert into public.quiz_questions (quiz_id, question_text, question_type, points, sort_order) values (v_quiz2, 'Other', 'multiple_choice', 1, 1) returning id into v_other_q;
  insert into public.quiz_attempts (quiz_id, student_id, attempt_number, status, started_at, submitted_at, score, max_score, percentage)
  values (v_quiz, v_a, 1, 'submitted', now() - interval '20 minutes', now() - interval '5 minutes', 1, 1, 100) returning id into v_att;
  insert into public.quiz_attempts (quiz_id, student_id, attempt_number, status, started_at)
  values (v_quiz2, v_a, 1, 'in_progress', now()) returning id into v_open;

  perform set_config('test.admin', v_admin::text, true);
  perform set_config('test.a', v_a::text, true);
  perform set_config('test.b', v_b::text, true);
  perform set_config('test.series', v_series::text, true);
  perform set_config('test.q1', v_q1::text, true);
  perform set_config('test.other_q', v_other_q::text, true);
  perform set_config('test.att', v_att::text, true);
  perform set_config('test.open', v_open::text, true);
end $fx$;

-- ------------------------------------------------------------- anon
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  perform pg_temp.expect_error(format('select public.student_submit_feedback(%L, %L, 5, null, null, %L)', current_setting('test.att'), 'feedback', 'Great test'), '42501');
  perform pg_temp.expect_error('select public.student_my_feedback()', '42501');
  perform pg_temp.expect_error('select * from public.list_moderation_items()', '42501');
  perform pg_temp.expect_error('select public.get_moderation_stats()', '42501');
  perform pg_temp.ok(true, 'anon: every feedback / moderation RPC denied (42501)');
end $$;
reset role;

-- ------------------------------------------------------------- student A
select set_config('request.jwt.claims', pg_temp.claims('a'), true);
set local role authenticated;
do $$
declare v_id uuid; i int;
begin
  perform pg_temp.expect_error(format('select public.student_submit_feedback(%L, %L, null, null, null, %L)', current_setting('test.att'), 'feedback', 'No stars here'), '22023');
  perform pg_temp.expect_error(format('select public.student_submit_feedback(%L, %L, 6, null, null, %L)', current_setting('test.att'), 'feedback', 'Too many stars'), '22023');
  perform pg_temp.expect_error(format('select public.student_submit_feedback(%L, %L, null, null, null, %L)', current_setting('test.att'), 'query', ' hi '), '22023');
  perform pg_temp.expect_error(format('select public.student_submit_feedback(%L, %L, null, null, null, %L)', current_setting('test.att'), 'query', repeat('x', 2001)), '22023');
  perform pg_temp.expect_error(format('select public.student_submit_feedback(%L, %L, null, %L, null, %L)', current_setting('test.att'), 'issue', 'spelling', 'Wrong category'), '22023');
  perform pg_temp.expect_error(format('select public.student_submit_feedback(%L, %L, null, null, %L, %L)', current_setting('test.att'), 'issue', current_setting('test.other_q'), 'Question from another test'), '22023');
  perform pg_temp.expect_error(format('select public.student_submit_feedback(%L, %L, null, null, null, %L)', current_setting('test.open'), 'query', 'Still running'), 'P0001');
  perform pg_temp.expect_error(format('select public.student_submit_feedback(%L, %L, null, null, null, %L)', current_setting('test.att'), 'complaint', 'Bad kind'), '22023');
  perform pg_temp.ok(true, 'submit: rating, length, category, question, unfinished attempt and kind are validated');

  v_id := public.student_submit_feedback(current_setting('test.att')::uuid, 'feedback', 4, null, null, '  Nice and fair test.  ');
  perform pg_temp.ok(v_id is not null, 'submit: feedback with a rating returns the new id');
  perform set_config('test.fb1', v_id::text, true);
  v_id := public.student_submit_feedback(current_setting('test.att')::uuid, 'issue', 3, 'wrong_answer', current_setting('test.q1')::uuid, 'Option B is also correct.');
  perform set_config('test.fb2', v_id::text, true);
  -- (the table itself is not readable by students; check through the RPC)
  perform pg_temp.ok((select e ->> 'rating' is null and e ->> 'question_id' = current_setting('test.q1') and e ->> 'message' = 'Option B is also correct.'
                        from jsonb_array_elements(public.student_my_feedback()) e where e ->> 'id' = v_id::text),
                     'submit: issue keeps the question, drops the rating, trims the message');
  perform pg_temp.ok((select e ->> 'message' = 'Nice and fair test.' from jsonb_array_elements(public.student_my_feedback()) e
                       where e ->> 'id' = current_setting('test.fb1')), 'submit: message trimmed');
  perform pg_temp.expect_error('select count(*) from public.test_feedback', '42501');
  for i in 1..3 loop
    perform public.student_submit_feedback(current_setting('test.att')::uuid, 'query', null, null, null, 'Question number ' || i);
  end loop;
  perform pg_temp.expect_error(format('select public.student_submit_feedback(%L, %L, null, null, null, %L)', current_setting('test.att'), 'query', 'Sixth message'), 'P0001');
  perform pg_temp.ok(jsonb_array_length(public.student_my_feedback(current_setting('test.series')::uuid)) = 5,
                     'limit: the 6th message of the day is refused; student_my_feedback lists 5');
  perform pg_temp.expect_error('select * from public.list_moderation_items()', '42501');
  perform pg_temp.ok(true, 'a student cannot use the moderation RPCs');
end $$;
reset role;

-- ------------------------------------------------------------- student B
select set_config('request.jwt.claims', pg_temp.claims('b'), true);
set local role authenticated;
do $$
begin
  perform pg_temp.expect_error(format('select public.student_submit_feedback(%L, %L, 5, null, null, %L)', current_setting('test.att'), 'feedback', 'Not my attempt'), 'P0002');
  perform pg_temp.ok(public.student_my_feedback() = '[]'::jsonb, 'isolation: B cannot use A''s attempt and sees none of A''s items');
end $$;
reset role;

-- ------------------------------------------------------------- admin
select set_config('request.jwt.claims', pg_temp.claims('admin'), true);
set local role authenticated;
do $$
declare v jsonb; n bigint;
begin
  select count(*) into n from public.list_moderation_items(null, null, 'open', null, 1, 50);
  perform pg_temp.ok(n = 5, 'list: 5 open items');
  select max(total_count) into n from public.list_moderation_items(null, 'query', null, null, 1, 2);
  perform pg_temp.ok(n = 3, 'list: kind filter and total_count (3 queries, page of 2)');
  select row_data into v from public.list_moderation_items('Option B', null, null, current_setting('test.series')::uuid, 1, 10);
  perform pg_temp.ok(v ->> 'student_name' = 'Student A' and v ->> 'series_title' = 'FB Physics series' and v ->> 'test_title' = 'FB Test 1'
                     and v ->> 'kind' = 'issue', 'list: search + series filter; row has student, series, test');

  v := public.get_moderation_stats();
  perform pg_temp.ok((v ->> 'new')::int = 5 and (v ->> 'avg_rating')::numeric = 4 and (v -> 'by_kind' ->> 'query')::int = 3,
                     'stats: counts, average rating of feedback, by kind');

  perform pg_temp.expect_error(format('select public.set_moderation_status(%L, %L, null)', current_setting('test.fb2'), 'resolved'), '22023');
  perform pg_temp.expect_error(format('select public.set_moderation_status(%L, %L, null)', current_setting('test.fb2'), 'new'), '22023');
  v := public.set_moderation_status(current_setting('test.fb2')::uuid, 'in_review', null);
  perform pg_temp.ok(v ->> 'status' = 'in_review' and v ->> 'reviewed_by_name' = 'Moderator', 'status: in review without a note');
  v := public.set_moderation_status(current_setting('test.fb2')::uuid, 'resolved', 'Thanks, option B was also accepted. Scores updated.');
  perform pg_temp.ok(v ->> 'status' = 'resolved', 'status: resolved with a note');
  perform pg_temp.ok(exists (select 1 from public.notifications n
                              where n.reference_type = 'test_feedback' and n.reference_id = current_setting('test.fb2')::uuid
                                and n.category = 'support_ticket' and n.user_id = current_setting('test.a')::uuid),
                     'resolve: the student is notified (support_ticket / test_feedback)');
  v := public.get_moderation_item(current_setting('test.fb2')::uuid);
  perform pg_temp.ok(jsonb_array_length(v -> 'history') = 2 and v -> 'question' ->> 'text' = 'Q1 text'
                     and (v -> 'attempt' ->> 'percentage')::numeric = 100,
                     'detail: question, attempt and the audit history (2 status changes)');
  perform pg_temp.ok((select count(*) from public.audit_logs where target_type = 'test_feedback'
                        and target_id = current_setting('test.fb2')::uuid and action = 'moderation.status'
                        and actor_id = current_setting('test.admin')::uuid) = 2, 'audit_logs: written with the real columns');
  v := public.set_moderation_status(current_setting('test.fb1')::uuid, 'dismissed', 'Thanks!');
  v := public.get_moderation_filter_options();
  perform pg_temp.ok(jsonb_array_length(v -> 'series') = 1 and jsonb_array_length(v -> 'kinds') = 3, 'filter options');
  perform pg_temp.expect_error(format('select public.get_moderation_item(%L)', gen_random_uuid()), 'P0002');
end $$;
reset role;

select set_config('request.jwt.claims', pg_temp.claims('a'), true);
set local role authenticated;
do $$
declare v jsonb;
begin
  select e into v from jsonb_array_elements(public.student_my_feedback()) e where e ->> 'id' = current_setting('test.fb2');
  perform pg_temp.ok(v ->> 'status' = 'resolved' and v ->> 'admin_note' like 'Thanks, option B%' and (v ->> 'question_position')::int = 1,
                     'student sees the status, the admin note and the question number');
  raise notice 'ok: all feedback checks passed';
end $$;
reset role;

rollback;
