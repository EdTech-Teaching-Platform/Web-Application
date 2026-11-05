-- =====================================================================
-- supabase/tests/admin_qa_fixes.sql
--
-- Smoke tests for 20261104090000_admin_qa_fixes.sql: P7 (the student detail
-- lists only that student's own active enrolments, with real progress) and
-- P4 item 5 (the tracker shows the creator of an independent series).
-- The P3 action matrix is covered by educator_lifecycle_flow_editor.sql.
-- LOCAL / DISPOSABLE DATABASE ONLY. One transaction, rolled back.
-- Expect "ok: ..." notices and "ok: all QA fix checks passed".
-- =====================================================================
begin;

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

create function pg_temp.series(p_name text, p_publish boolean) returns uuid
language sql as $$
  select public.upsert_test_series_full(jsonb_build_object(
    'name', p_name, 'pricing', 'free', 'startMethod', 'scratch',
    'availability', jsonb_build_object('goLive', 'now', 'mode', 'always'),
    'tests', jsonb_build_array(
      jsonb_build_object('name', 'Unit 1', 'duration', '20', 'passingPercent', '50', 'attemptLimit', '3',
        'questions', jsonb_build_array(jsonb_build_object('type', 'mcq_single', 'text', 'Two plus two?', 'marks', '4',
          'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', '3'), jsonb_build_object('key', 'B', 'text', '4')),
          'correctAnswers', jsonb_build_array('B')))),
      jsonb_build_object('name', 'Unit 2', 'duration', '20', 'passingPercent', '50', 'attemptLimit', '3',
        'questions', jsonb_build_array(jsonb_build_object('type', 'mcq_single', 'text', 'Three plus three?', 'marks', '4',
          'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', '6'), jsonb_build_object('key', 'B', 'text', '7')),
          'correctAnswers', jsonb_build_array('A')))))), p_publish);
$$;

do $fx$
declare
  v_admin uuid := gen_random_uuid(); v_s1 uuid := gen_random_uuid(); v_s2 uuid := gen_random_uuid();
  v_edu uuid := gen_random_uuid(); u uuid;
begin
  foreach u in array array[v_admin, v_s1, v_s2, v_edu] loop
    insert into auth.users (id, email) values (u, 'qa-' || u || '@test.local');
  end loop;
  insert into public.profiles (id, role, full_name, email) values
    (v_admin, 'admin', 'QA Admin', 'qa-' || v_admin || '@test.local'),
    (v_s1, 'student', 'QA Student One', 'qa-' || v_s1 || '@test.local'),
    (v_s2, 'student', 'QA Student Two', 'qa-' || v_s2 || '@test.local'),
    (v_edu, 'educator', 'QA Creator', 'qa-' || v_edu || '@test.local');
  insert into public.adm_admin_users (user_id) values (v_admin);
  insert into public.educator_profiles (user_id, full_name, phone, location, verification_status)
  values (v_edu, 'QA Creator', '9000000021', 'Pune', 'verified');
  perform public.adm_set_educator_state(v_edu, 'approved', null, v_admin);

  perform pg_temp.act_as(v_admin);
  perform pg_temp.remember('a', pg_temp.series('QA Physics', true));
  perform pg_temp.remember('b', pg_temp.series('QA Chemistry', true));
  perform pg_temp.remember('c', pg_temp.series('QA Biology', true));
  perform pg_temp.remember('admin_only', pg_temp.series('QA Admin draft', false));
  perform pg_temp.remember('a_test', ((public.get_test_series(pg_temp.id('a'))) #>> '{tests,0,id}')::uuid);
  perform pg_temp.act_as(v_edu);
  perform pg_temp.remember('indep', pg_temp.series('QA Independent', false));
  perform pg_temp.remember('admin', v_admin); perform pg_temp.remember('s1', v_s1);
  perform pg_temp.remember('s2', v_s2); perform pg_temp.remember('edu', v_edu);
end $fx$;

-- ------------------------------------------------------- P7: enrolments
do $$
declare v jsonb; att uuid;
begin
  -- s1: Physics (one test submitted); s2: Chemistry, plus Biology revoked
  perform pg_temp.act_as(pg_temp.id('s1'));
  perform public.student_enroll(pg_temp.id('a'));
  att := (public.student_start_attempt(pg_temp.id('a_test')) ->> 'attempt_id')::uuid;
  perform public.student_submit_attempt(att);
  perform pg_temp.act_as(pg_temp.id('s2'));
  perform public.student_enroll(pg_temp.id('b'));
  perform public.student_enroll(pg_temp.id('c'));
  update public.admin_series_enrollments set revoked_at = now(), revoke_reason = 'refund'
   where student_id = pg_temp.id('s2') and series_id = pg_temp.id('c');

  perform pg_temp.act_as(pg_temp.id('admin'));
  v := public.get_student_detail(pg_temp.id('s1'));
  perform pg_temp.ok(jsonb_array_length(v -> 'enrolled_series') = 1 and v #>> '{enrolled_series,0,title}' = 'QA Physics',
                     'student 1: only their own series');
  perform pg_temp.ok((v #>> '{enrolled_series,0,tests_total}')::int = 2 and (v #>> '{enrolled_series,0,tests_done}')::int = 1
                     and (v #>> '{enrolled_series,0,progress}')::numeric = 50 and (v #>> '{enrolled_series,0,attempts}')::int = 1
                     and v #>> '{enrolled_series,0,best_score}' is not null,
                     'student 1: real progress (1 of 2 tests), attempts and best score');
  v := public.get_student_detail(pg_temp.id('s2'));
  perform pg_temp.ok(jsonb_array_length(v -> 'enrolled_series') = 1 and v #>> '{enrolled_series,0,title}' = 'QA Chemistry'
                     and (v #>> '{enrolled_series,0,progress}')::numeric = 0,
                     'student 2: a different list; the revoked enrolment is not shown');
end $$;

-- ------------------------------------------------------- P4.5: tracker
do $$
declare v jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('admin'));
  select r.row_data into v from public.list_series_tracker(p_size => 100) r where (r.row_data ->> 'series_id')::uuid = pg_temp.id('indep');
  perform pg_temp.ok(v ->> 'overall_status' = 'Independent' and v ->> 'origin' = 'educator' and v ->> 'creator_name' = 'QA Creator'
                     and (v ->> 'total_required')::int = 0 and jsonb_array_length(v -> 'educators') = 0,
                     'tracker: an independent series shows its creator and "Independent" (not counted as assigned)');
  select r.row_data into v from public.list_series_tracker(p_size => 100) r where (r.row_data ->> 'series_id')::uuid = pg_temp.id('admin_only');
  perform pg_temp.ok(v ->> 'overall_status' = 'No Assignments Yet' and v ->> 'origin' = 'admin',
                     'tracker: an admin series without assignments still reads "No Assignments Yet"');
  perform pg_temp.ok(exists (select 1 from public.list_series_tracker(p_educator => 'QA Creator', p_size => 100) r
                              where (r.row_data ->> 'series_id')::uuid = pg_temp.id('indep')),
                     'tracker: the educator filter finds the creator''s independent series');
  v := public.get_series_tracker_detail(pg_temp.id('indep'));
  perform pg_temp.ok(v #>> '{series,creator_name}' = 'QA Creator' and v #>> '{series,overall_status}' = 'Independent',
                     'tracker detail: creator and status');
end $$;

do $$ begin raise notice 'ok: all QA fix checks passed'; end $$;
rollback;
