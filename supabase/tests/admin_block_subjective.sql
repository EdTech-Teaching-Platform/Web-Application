-- =====================================================================
-- supabase/tests/admin_block_subjective.sql
--
-- Smoke tests for 20261027090000_admin_block_subjective.sql.
-- LOCAL / DISPOSABLE DATABASE ONLY (inserts fixtures into auth.users and lead
-- tables). One transaction, rolled back. Needs an admin in adm_admin_users:
-- the test allowlists its own fixture admin.
--
-- Expect "ok: ..." notices and "ok: all block-subjective checks passed".
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

do $fx$
declare
  v_admin uuid := gen_random_uuid();
  v_course uuid; v_series uuid; v_quiz uuid; v_clean uuid; v_subj uuid; v_mcq uuid;
begin
  insert into auth.users (id, email) values (v_admin, 'blk-' || v_admin || '@test.local');
  insert into public.profiles (id, role, full_name, email) values (v_admin, 'admin', 'Fixture Admin', 'blk-' || v_admin || '@test.local');
  insert into public.adm_admin_users (user_id) values (v_admin);
  insert into public.courses (educator_id, title, slug) values (v_admin, 'Blk course', 'blk-' || v_admin) returning id into v_course;
  insert into public.test_series (course_id, title) values (v_course, 'Blk series ' || v_course) returning id into v_series;
  insert into public.test_series_admin (series_id) values (v_series);

  -- a test that already has a subjective question (written before the guard)
  insert into public.quizzes (course_id, series_id, title) values (v_course, v_series, 'With subjective') returning id into v_quiz;
  insert into public.quiz_questions (quiz_id, question_text, question_type, points, sort_order)
  values (v_quiz, 'Explain', 'short_answer', 5, 1) returning id into v_subj;
  insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order) values (v_subj, 'Manual grading: see rubric', true, 1);
  insert into public.quiz_question_admin (question_id, admin_type, needs_manual_grading) values (v_subj, 'subjective', true);
  insert into public.quiz_questions (quiz_id, question_text, question_type, points, sort_order)
  values (v_quiz, 'Pick one', 'multiple_choice', 1, 2) returning id into v_mcq;
  insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order) values (v_mcq, 'A', true, 1), (v_mcq, 'B', false, 2);
  insert into public.quiz_question_admin (question_id, admin_type) values (v_mcq, 'mcq_single');

  insert into public.quizzes (course_id, series_id, title) values (v_course, v_series, 'Clean') returning id into v_clean;

  perform set_config('test.admin', v_admin::text, true);
  perform set_config('test.quiz', v_quiz::text, true);
  perform set_config('test.clean', v_clean::text, true);
  perform set_config('test.subj', v_subj::text, true);
  perform set_config('test.mcq', v_mcq::text, true);
end $fx$;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.admin'), 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare v jsonb;
begin
  -- creating subjective types is refused, whatever the spelling
  perform pg_temp.expect_error(format('select public.create_question(%L, %L)', current_setting('test.clean'),
    '{"type":"short_answer","text":"Why?","marks":2}'), '22023');
  perform pg_temp.expect_error(format('select public.create_question(%L, %L)', current_setting('test.clean'),
    '{"type":"long_answer","text":"Why?","marks":2}'), '22023');
  perform pg_temp.expect_error(format('select public.create_question(%L, %L)', current_setting('test.clean'),
    '{"type":"subjective","text":"Why?","marks":2}'), '22023');
  perform pg_temp.expect_error(format('select public.create_question(%L, %L)', current_setting('test.clean'),
    '{"type":"descriptive","text":"Why?","marks":2}'), '22023');
  perform pg_temp.ok(true, 'create: short / long / subjective / descriptive refused (22023)');

  -- fill in the blank needs an accepted answer
  perform pg_temp.expect_error(format('select public.create_question(%L, %L)', current_setting('test.clean'),
    '{"type":"fill_blank","text":"Capital of France?","marks":1}'), '22023');
  v := public.create_question(current_setting('test.clean')::uuid,
    '{"type":"fill_blank","text":"Capital of France?","marks":1,"correctAnswer":"Paris"}');
  perform pg_temp.ok(v ->> 'lead_type' = 'fill_in_blank' and (v -> 'options' -> 0 ->> 'label') = 'Paris',
    'create: fill in the blank needs and stores the accepted answer');

  -- the allowed types still work
  v := public.create_question(current_setting('test.clean')::uuid,
    '{"type":"mcq_multi","text":"Vectors?","marks":2,"options":[{"key":"A","text":"Velocity"},{"key":"B","text":"Speed"},{"key":"C","text":"Force"},{"key":"D","text":"Mass"}],"correctAnswers":["A","C"]}');
  perform pg_temp.ok((select count(*) from jsonb_array_elements(v -> 'options') o where (o ->> 'is_correct')::boolean) = 2,
    'create: MCQ with multiple answers keeps both correct options');
  v := public.create_question(current_setting('test.clean')::uuid,
    '{"type":"true_false","text":"Sky is blue","marks":1,"options":[{"key":"A","text":"True"},{"key":"B","text":"False"}],"correctAnswers":["A"]}');
  perform pg_temp.ok(v ->> 'lead_type' = 'true_false', 'create: true / false works');
  v := public.create_question(current_setting('test.clean')::uuid,
    '{"type":"mcq_single","text":"One?","marks":1,"optionA":"x","optionB":"y","optionC":"z","optionD":"w","correctAnswer":"B"}');
  perform pg_temp.ok(v ->> 'lead_type' = 'multiple_choice', 'create: MCQ single works');

  -- editing an existing subjective question is refused; reading it still works
  perform pg_temp.expect_error(format('select public.update_question(%L, %L)', current_setting('test.subj'), '{"text":"Explain more"}'), '22023');
  perform pg_temp.expect_error(format('select public.update_question(%L, %L)', current_setting('test.subj'), '{"marks":9}'), '22023');
  perform pg_temp.expect_error(format('select public.create_question_option(%L, %L)', current_setting('test.subj'), '{"label":"x"}'), '22023');
  perform pg_temp.expect_error(format('select public.update_question_option(%L, %L)',
    (select id from public.quiz_question_options where question_id = current_setting('test.subj')::uuid limit 1), '{"label":"y"}'), '22023');
  perform pg_temp.ok((public.get_test_series((select series_id from public.quizzes where id = current_setting('test.quiz')::uuid))) is not null,
    'existing subjective question: edits refused, series still readable');

  -- turning an objective question into a subjective one is refused
  perform pg_temp.expect_error(format('select public.update_question(%L, %L)', current_setting('test.mcq'), '{"type":"subjective"}'), '22023');
  v := public.update_question(current_setting('test.mcq')::uuid, '{"text":"Pick one (edited)"}');
  perform pg_temp.ok(v ->> 'body' = 'Pick one (edited)', 'update: objective edits still work; switching to subjective refused');

  -- duplicating a test with a subjective question is refused; a clean one copies
  perform pg_temp.expect_error(format('select public.duplicate_test(%L)', current_setting('test.quiz')), '22023');
  v := public.duplicate_test(current_setting('test.clean')::uuid);
  perform pg_temp.ok((v ->> 'question_count')::int = 4, 'duplicate: refused with subjective, works without (4 questions copied)');

  -- deleting the subjective question still works
  perform public.delete_question(current_setting('test.subj')::uuid);
  perform pg_temp.ok(not exists (select 1 from public.quiz_questions where id = current_setting('test.subj')::uuid),
    'delete: an existing subjective question can be deleted');
  v := public.duplicate_test(current_setting('test.quiz')::uuid);
  perform pg_temp.ok(v ->> 'id' is not null, 'duplicate: works once the subjective question is gone');
  raise notice 'ok: all block-subjective checks passed';
end $$;
reset role;

rollback;
