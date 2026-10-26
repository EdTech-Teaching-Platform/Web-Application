-- =====================================================================
-- supabase/tests/admin_fast_publish.sql
--
-- Smoke tests for 20261027110000_admin_fast_publish.sql.
-- LOCAL / DISPOSABLE DATABASE ONLY (inserts fixtures into auth.users and lead
-- tables). One transaction, rolled back. The test allowlists its own fixture
-- admin.
--
-- Expect "ok: ..." notices and "ok: all fast-publish checks passed".
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

-- A wizard payload: three tests, every question shape the save accepts.
create function pg_temp.payload(p_id uuid, p_name text, p_with_empty_test boolean) returns jsonb
language sql as $$
  select jsonb_build_object(
    'id', p_id, 'name', p_name, 'about', '<p>About</p>', 'whoFor', 'Aspirants', 'audience', 'Class 12',
    'syllabus', 'Full', 'startMethod', 'csv', 'pricing', 'free', 'price', '0', 'buildDeadline', '',
    'wizardState', jsonb_build_object('name', p_name),
    'classification', jsonb_build_object('subject', 'Maths', 'grade', '12', 'exam', 'JEE', 'difficulty', 'Medium',
                                         'languages', jsonb_build_array('English', ' ', 'Hindi')),
    'availability', jsonb_build_object('goLive', 'now', 'mode', 'always'),
    'lateSubmissions', jsonb_build_object('allowed', false),
    'tests', jsonb_build_array(
      jsonb_build_object('name', 'Algebra', 'instructions', 'Read carefully', 'duration', '30', 'passingPercent', '40',
        'attemptLimit', '2', 'plannedQuestions', '7', 'topics', jsonb_build_array('Sets', ''),
        'sections', jsonb_build_array(jsonb_build_object('name', 'Part A'), jsonb_build_object('name', '')),
        'questions', jsonb_build_array(
          jsonb_build_object('type', 'mcq_single', 'text', 'One plus one?', 'marks', '2', 'negativeMarks', '0.5',
            'difficulty', 'HARD', 'sectionPosition', '2', 'explanation', ' Two. ',
            'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', '1'), jsonb_build_object('key', 'B', 'text', '2'),
                                         jsonb_build_object('key', 'C', 'text', '  ')),
            'correctAnswers', jsonb_build_array('B')),
          jsonb_build_object('type', 'mcq_single', 'text', '   '),
          jsonb_build_object('type', 'mcq_multi', 'text', 'Primes?',
            'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', '2'), jsonb_build_object('key', 'B', 'text', '4'),
                                         jsonb_build_object('key', 'C', 'text', '5'), jsonb_build_object('key', 'D', 'text', '9')),
            'correctAnswers', jsonb_build_array('a', 'C')),
          jsonb_build_object('type', 'true_false', 'text', 'Zero is odd.', 'correctAnswers', jsonb_build_array('False')),
          jsonb_build_object('type', 'fill_blank', 'text', 'Capital of France is ___', 'correctAnswer', ' Paris '),
          jsonb_build_object('type', 'mcq', 'body', 'Editor shape', 'optionA', 'x', 'optionB', 'y', 'optionC', 'z', 'correctAnswer', 'c'),
          jsonb_build_object('type', 'objective', 'text', 'Flags',
            'options', jsonb_build_array(jsonb_build_object('label', 'X', 'is_correct', true), jsonb_build_object('label', 'Y'))),
          jsonb_build_object('type', '', 'text', 'Default type', 'source', 'paste',
            'options', jsonb_build_array(jsonb_build_object('text', 'P'), jsonb_build_object('text', 'Q')),
            'correctAnswer', 'Q'))),
      jsonb_build_object('name', 'Geometry', 'duration', '20',
        'questions', jsonb_build_array(
          jsonb_build_object('type', 'mcq_single', 'text', 'Triangle angles sum?',
            'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', '180'), jsonb_build_object('key', 'B', 'text', '360')),
            'correctAnswers', jsonb_build_array('A'))))
    ) || case when p_with_empty_test then jsonb_build_array(jsonb_build_object('name', '  ')) else '[]'::jsonb end);
$$;

do $fx$
declare
  v_admin  uuid := gen_random_uuid();
  v_course uuid;
  v_lead   uuid;
  v_quiz   uuid;
  v_q      uuid;
  v_asg    uuid;
begin
  insert into auth.users (id, email) values (v_admin, 'fp-' || v_admin || '@test.local');
  insert into public.profiles (id, role, full_name, email) values (v_admin, 'admin', 'Fixture Admin', 'fp-' || v_admin || '@test.local');
  insert into public.adm_admin_users (user_id) values (v_admin);

  -- a series the lead's app made on a paid course: no admin row yet
  insert into public.courses (educator_id, title, slug, price) values (v_admin, 'FP course', 'fp-' || v_admin, 499) returning id into v_course;
  insert into public.test_series (course_id, title, is_published) values (v_course, 'FP lead series ' || v_course, false) returning id into v_lead;
  insert into public.quizzes (course_id, series_id, series_sort_order, title) values (v_course, v_lead, 1, 'Lead test') returning id into v_quiz;
  insert into public.quiz_questions (quiz_id, question_text, question_type, points, sort_order)
  values (v_quiz, 'No correct option yet', 'multiple_choice', 1, 1) returning id into v_q;
  insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order) values (v_q, 'A', false, 1), (v_q, 'B', false, 2);
  insert into public.test_assignments (series_id, educator_id, status, test_id) values (v_lead, v_admin, 'approved', v_quiz) returning id into v_asg;

  perform set_config('test.admin', v_admin::text, true);
  perform set_config('test.lead', v_lead::text, true);
  perform set_config('test.q', v_q::text, true);
  perform set_config('test.asg', v_asg::text, true);
end $fx$;

-- ------------------------------------------------------------ helpers alone
do $$
begin
  perform pg_temp.ok((select array_agg(o.option_text || ':' || o.is_correct || ':' || o.sort_order order by o.sort_order)
                        from public.adm_question_options('multiple_choice',
                               '{"options":[{"key":"A","text":"1"},{"key":"B","text":" "},{"key":"C","text":"3"}],"correctAnswers":["c"]}') o)
                     = array['1:false:1', '3:true:2'], 'options: blank options skipped, keys matched case-insensitively, renumbered');
  perform pg_temp.ok((select count(*) from public.adm_question_options('true_false', '{"correctAnswers":["True"]}') o where o.is_correct) = 1,
                     'options: true / false gets True and False, one correct');
  perform pg_temp.ok((select o.option_text from public.adm_question_options('fill_in_blank', '{"correctAnswer":"Paris"}') o) = 'Paris',
                     'options: fill in the blank gets its accepted answer');
  perform pg_temp.ok(not exists (select 1 from public.adm_question_options('essay', '{}')), 'options: unknown lead type gets none');
end $$;

-- The RPCs run as the fixture admin; the checks read tables as the owner.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.admin'), 'role', 'authenticated')::text, true);

-- --------------------------------------------------------- draft, then publish
do $$
declare
  sid uuid;
  v   jsonb;
  n   int;
begin
  sid := public.upsert_test_series_full(pg_temp.payload(null, 'FP Series', true), false);
  perform set_config('test.sid', sid::text, true);
  perform pg_temp.ok((select count(*) from public.quizzes where series_id = sid) = 3, 'draft: three tests written');
  perform pg_temp.ok((select string_agg(title, '|' order by series_sort_order) from public.quizzes where series_id = sid) = 'Algebra|Geometry|Test 3',
                     'draft: test order and the default name');
  perform pg_temp.ok((select string_agg(qq.sort_order::text, ',' order by qq.sort_order)
                        from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
                       where q.series_id = sid and q.title = 'Algebra') = '1,2,3,4,5,6,7',
                     'draft: blank question skipped, positions 1..7 without gaps');
  perform pg_temp.ok((select count(*) from public.quiz_question_admin qa join public.quiz_questions qq on qq.id = qa.question_id
                        join public.quizzes q on q.id = qq.quiz_id where q.series_id = sid) = 8, 'draft: one admin row per question');

  select jsonb_object_agg(qq.question_text, jsonb_build_object(
           'type', qq.question_type, 'admin', qa.admin_type, 'points', qq.points, 'neg', qa.negative_marks, 'diff', qa.difficulty,
           'src', qa.source, 'section', ts.name, 'expl', qq.explanation,
           'opts', (select jsonb_agg(o.option_text || case when o.is_correct then '*' else '' end order by o.sort_order)
                      from public.quiz_question_options o where o.question_id = qq.id)))
    into v
    from public.quiz_questions qq
    join public.quizzes q on q.id = qq.quiz_id
    join public.quiz_question_admin qa on qa.question_id = qq.id
    left join public.test_sections ts on ts.id = qa.section_id
   where q.series_id = sid;
  perform pg_temp.ok(v -> 'One plus one?' = '{"type":"multiple_choice","admin":"mcq_single","points":2,"neg":0.50,"diff":"hard","src":"csv","section":"Section 2","expl":"Two.","opts":["1","2*"]}'::jsonb,
                     'draft: single answer MCQ (marks, negative marks, difficulty, source, section, explanation, options)');
  perform pg_temp.ok(v -> 'Primes?' -> 'opts' = '["2*","4","5*","9"]', 'draft: multiple answer MCQ');
  perform pg_temp.ok(v -> 'Zero is odd.' -> 'opts' = '["True","False*"]' and v -> 'Zero is odd.' ->> 'type' = 'true_false', 'draft: true / false defaults');
  perform pg_temp.ok(v -> 'Capital of France is ___' -> 'opts' = '["Paris*"]' and v -> 'Capital of France is ___' ->> 'points' = '4',
                     'draft: fill in the blank, default 4 marks');
  perform pg_temp.ok(v -> 'Editor shape' -> 'opts' = '["x","y","z*"]', 'draft: editor shape optionA..optionC');
  perform pg_temp.ok(v -> 'Flags' -> 'opts' = '["X*","Y"]' and v -> 'Flags' ->> 'admin' = 'objective', 'draft: is_correct flags');
  perform pg_temp.ok(v -> 'Default type' ->> 'admin' = 'objective' and v -> 'Default type' ->> 'src' = 'paste'
                     and v -> 'Default type' -> 'opts' = '["P","Q*"]', 'draft: empty type is objective, per-question source, match by text');
  perform pg_temp.ok((select string_agg(name, '|' order by position) from public.test_sections ts join public.quizzes q on q.id = ts.quiz_id
                       where q.series_id = sid) = 'Part A|Section 2', 'draft: sections with default names');
  perform pg_temp.ok((select status from public.test_series_admin where series_id = sid) = 'draft'
                     and not (select is_published from public.test_series where id = sid), 'draft: still a draft');
  perform pg_temp.ok((select languages from public.test_series_admin where series_id = sid) = array['English', 'Hindi'], 'draft: languages trimmed');

  -- publish refuses the empty third test and writes nothing
  perform pg_temp.expect_error(format('select public.upsert_test_series_full(%L, true)', pg_temp.payload(sid, 'FP Series', true)),
                               '22023', '"Test 3" has no questions.');
  perform pg_temp.ok((select count(*) from public.quizzes where series_id = sid) = 3
                     and (select status from public.test_series_admin where series_id = sid) = 'draft', 'publish error: nothing changed');

  -- publish without it: tests replaced, everything published
  select count(*) into n from public.quiz_question_options o join public.quiz_questions qq on qq.id = o.question_id
    join public.quizzes q on q.id = qq.quiz_id where q.series_id = sid;
  perform pg_temp.ok(public.upsert_test_series_full(pg_temp.payload(sid, '  fp series  ', false), true) = sid, 'publish: same series id');
  perform pg_temp.ok((select count(*) from public.quizzes where series_id = sid) = 2, 'publish: old tests replaced');
  perform pg_temp.ok((select count(*) from public.quiz_question_options o join public.quiz_questions qq on qq.id = o.question_id
                        join public.quizzes q on q.id = qq.quiz_id where q.series_id = sid) = n and n = 18,
                     'publish: options rewritten, none left behind (18)');
  perform pg_temp.ok((select title from public.test_series where id = sid) = 'fp series', 'publish: new name saved');
  perform pg_temp.ok((select status from public.test_series_admin where series_id = sid) = 'published'
                     and (select is_published from public.test_series where id = sid)
                     and not exists (select 1 from public.quiz_admin qa join public.quizzes q on q.id = qa.quiz_id
                                      where q.series_id = sid and qa.status <> 'published')
                     and (select count(*) from public.quiz_admin qa join public.quizzes q on q.id = qa.quiz_id where q.series_id = sid) = 2,
                     'publish: series and every test published');
  perform pg_temp.ok((select count(*) from public.audit_logs where target_id = sid and action = 'test_series.publish') = 1,
                     'publish: audited once');
end $$;

-- ------------------------------------------------------------- refusals
do $$
declare
  sid uuid := current_setting('test.sid')::uuid;
  bad jsonb;
begin
  perform pg_temp.expect_error(format('select public.upsert_test_series_full(%L)', pg_temp.payload(null, 'FP SERIES', false)),
                               '23505', 'already exists');
  perform pg_temp.ok(public.series_name_exists(' Fp Series ', null) and not public.series_name_exists('fp series', sid),
                     'name check: case and spaces ignored, the series itself excluded');

  bad := jsonb_set(pg_temp.payload(null, 'FP bad 1', false), '{tests,1,questions,0,type}', '"subjective"');
  perform pg_temp.expect_error(format('select public.upsert_test_series_full(%L)', bad), '22023', 'coming soon');
  bad := jsonb_set(pg_temp.payload(null, 'FP bad 2', false), '{tests,1,questions,0,type}', '"long_answer"');
  perform pg_temp.expect_error(format('select public.upsert_test_series_full(%L)', bad), '22023', 'coming soon');
  bad := jsonb_set(pg_temp.payload(null, 'FP bad 3', false), '{tests,0,questions,4,correctAnswer}', '""');
  perform pg_temp.expect_error(format('select public.upsert_test_series_full(%L)', bad), '22023', 'Fill-in-the-blank questions need an accepted answer.');
  bad := jsonb_set(pg_temp.payload(null, 'FP bad 4', false), '{tests,1,questions,0,type}', '"essay"');
  perform pg_temp.expect_error(format('select public.upsert_test_series_full(%L)', bad), '22023', 'Unsupported question type: essay');
  -- a blank subjective question is skipped, as before
  bad := jsonb_set(jsonb_set(pg_temp.payload(null, 'FP ok blank', false), '{tests,1,questions,0,type}', '"subjective"'),
                   '{tests,1,questions,0,text}', '""');
  perform pg_temp.ok(public.upsert_test_series_full(bad) is not null, 'refusals: a blank subjective question is skipped');
  perform pg_temp.ok(not exists (select 1 from public.test_series where title in ('FP bad 1', 'FP bad 2', 'FP bad 3', 'FP bad 4')),
                     'refusals: nothing written');
end $$;

-- as the browser role: the RPCs are granted, the helpers are not
set local role authenticated;
do $$
declare
  sid uuid := current_setting('test.sid')::uuid;
begin
  perform pg_temp.ok(public.series_name_exists('FP Series', null), 'authenticated: series_name_exists is granted');
  perform pg_temp.ok(public.upsert_test_series_full(pg_temp.payload(null, 'FP as browser', false), true) is not null,
                     'authenticated: upsert_test_series_full (publish) is granted');
  perform pg_temp.expect_error(format('select public.adm_delete_series_quizzes(%L)', sid), '42501');
  perform pg_temp.expect_error(format('select public.adm_insert_questions_bulk(%L, ''[]'')', gen_random_uuid()), '42501');
  perform pg_temp.expect_error(format('select public.adm_series_publish_problem(%L)', sid), '42501');
  perform pg_temp.expect_error('select public.adm_question_options(''multiple_choice'', ''{}'')', '42501');
  perform pg_temp.expect_error(format('select public.adm_complete_assignments_for_series(%L)', sid), '42501');
  perform pg_temp.expect_error(format('select public.adm_series_name_taken(%L, null)', 'x'), '42501');
end $$;
reset role;

-- ------------------------------------- publish a lead series (admin row, validation, assignments)
do $$
declare
  v_lead uuid := current_setting('test.lead')::uuid;
  v jsonb;
begin
  perform pg_temp.expect_error(format('select public.adm_publish_test_series(%L)', v_lead), '22023',
                               '"Lead test" has 1 question(s) without a correct answer.');
end $$;

do $$
begin
  -- the failed publish rolled back its admin row; create it the way the RPCs do and compare with adm_series_rows()
  perform public.adm_ensure_series_admin(current_setting('test.lead')::uuid);
  perform pg_temp.ok((select sa.status = 'draft' and sa.pricing = 'paid' and sa.price_inr = 499
                        from public.test_series_admin sa where sa.series_id = current_setting('test.lead')::uuid),
                     'ensure admin row: seeded like adm_series_rows() (draft, paid 499)');
  update public.quiz_question_options set is_correct = true where question_id = current_setting('test.q')::uuid and option_text = 'B';
end $$;

do $$
declare
  v_lead uuid := current_setting('test.lead')::uuid;
  v jsonb;
begin
  v := public.adm_publish_test_series(v_lead);
  perform pg_temp.ok(v = jsonb_build_object('series_id', v_lead, 'is_published', true, 'tests', 1, 'status', 'published'),
                     'lead series: published, same result shape');
  perform pg_temp.ok((select status from public.test_assignments where id = current_setting('test.asg')::uuid) = 'completed'
                     and (select count(*) from public.assignment_history where assignment_id = current_setting('test.asg')::uuid
                            and action = 'Completed') = 1, 'lead series: approved assignment completed and logged');
  perform pg_temp.expect_error(format('select public.upsert_test_series_full(%L)',
                                      pg_temp.payload(v_lead, 'FP lead rename', false)), '22023', 'belongs to a course');
end $$;

do $$ begin raise notice 'ok: all fast-publish checks passed'; end $$;
rollback;
