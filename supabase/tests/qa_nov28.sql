-- =====================================================================
-- supabase/tests/qa_nov28.sql
--
-- Tests for 20261129090000_admin_qa_nov28_fixes.sql.
-- LOCAL / DISPOSABLE DATABASE ONLY. Never run it against the lead's project:
-- it inserts fixture rows into auth.users and lead tables. Everything runs in
-- one transaction and is rolled back.
--
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/qa_nov28.sql
--
-- Covers
--   1. adm_educator_students: admin only; the students of the educator's own
--      series (enrolled, or attempted), with series, progress and status; not
--      another educator's students; deleted accounts left out
--   2. adm_account_delete_by_admin: service role only; the admin is checked;
--      students only (no educator, admin or yourself); the student is blocked,
--      the deletion recorded (decided by the admin, not self-service) and
--      audited; list_students / get_student_stats leave the account out
--   3. onboarding: an educator submits with only name, phone and location (no
--      ID pictures); the optional fields are saved as null
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

create function pg_temp.as_service() returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
$$;

create function pg_temp.id(p_key text) returns uuid
language sql as $$ select nullif(current_setting('test.' || p_key, true), '')::uuid $$;

create function pg_temp.remember(p_key text, p_id uuid) returns uuid
language sql as $$ select set_config('test.' || p_key, p_id::text, true)::uuid $$;

do $fx$
declare
  v_admin uuid := gen_random_uuid(); v_e1 uuid := gen_random_uuid(); v_e2 uuid := gen_random_uuid(); v_e3 uuid := gen_random_uuid();
  v_s1 uuid := gen_random_uuid(); v_s2 uuid := gen_random_uuid(); v_s3 uuid := gen_random_uuid(); v_s4 uuid := gen_random_uuid(); u uuid;
begin
  foreach u in array array[v_admin, v_e1, v_e2, v_e3, v_s1, v_s2, v_s3, v_s4] loop
    insert into auth.users (id, email) values (u, 'q28-' || u || '@test.local');
  end loop;
  insert into public.profiles (id, role, full_name, email) values
    (v_admin, 'admin', 'Q28 Admin', 'q28-' || v_admin || '@test.local'),
    (v_e1, 'educator', 'Ashika', 'q28-' || v_e1 || '@test.local'),
    (v_e2, 'educator', 'Ravi', 'q28-' || v_e2 || '@test.local'),
    (v_s1, 'student', 'Riya Sen', 'q28-' || v_s1 || '@test.local'),
    (v_s2, 'student', 'Kabir Das', 'q28-' || v_s2 || '@test.local'),
    (v_s3, 'student', 'Not Enrolled', 'q28-' || v_s3 || '@test.local'),
    (v_s4, 'student', 'Ravi Student', 'q28-' || v_s4 || '@test.local');
  insert into public.adm_admin_users (user_id) values (v_admin);
  insert into public.educator_profiles (user_id, full_name, phone, location, verification_status) values
    (v_e1, 'Ashika', '9000000041', 'Pune', 'verified'),
    (v_e2, 'Ravi', '9000000042', 'Goa', 'verified');
  perform public.adm_backfill_educator_approvals();
  perform pg_temp.remember('admin', v_admin); perform pg_temp.remember('e1', v_e1); perform pg_temp.remember('e2', v_e2);
  perform pg_temp.remember('e3', v_e3);
  perform pg_temp.remember('s1', v_s1); perform pg_temp.remember('s2', v_s2); perform pg_temp.remember('s3', v_s3);
  perform pg_temp.remember('s4', v_s4);
end $fx$;

-- ------------------------------------------------ 1. the educator's students
do $$
declare sid uuid; sid2 uuid; qid uuid; a jsonb; v jsonb; r jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('admin'));
  sid := public.upsert_test_series_full(jsonb_build_object(
    'name', 'Q28 Ashika Physics', 'pricing', 'free', 'startMethod', 'scratch',
    'availability', jsonb_build_object('goLive', 'now', 'mode', 'always'),
    'tests', jsonb_build_array(jsonb_build_object('name', 'Motion', 'duration', '20', 'passingPercent', '50',
      'attemptLimit', '2', 'totalMarks', '4', 'status', 'published',
      'questions', jsonb_build_array(jsonb_build_object('type', 'mcq_single', 'text', 'Two plus two?', 'marks', '4',
        'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', '3'), jsonb_build_object('key', 'B', 'text', '4')),
        'correctAnswers', jsonb_build_array('B')))))), true);
  sid2 := public.upsert_test_series_full(jsonb_build_object(
    'name', 'Q28 Ravi Maths', 'pricing', 'free', 'startMethod', 'scratch',
    'availability', jsonb_build_object('goLive', 'now', 'mode', 'always'),
    'tests', jsonb_build_array(jsonb_build_object('name', 'Sums', 'duration', '20', 'passingPercent', '50',
      'attemptLimit', '2', 'totalMarks', '4', 'status', 'published',
      'questions', jsonb_build_array(jsonb_build_object('type', 'mcq_single', 'text', 'One plus one?', 'marks', '4',
        'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', '2'), jsonb_build_object('key', 'B', 'text', '3')),
        'correctAnswers', jsonb_build_array('A')))))), true);
  -- the educators' own series (as if they had created them)
  update public.test_series_admin set created_by = pg_temp.id('e1'), origin = 'educator' where series_id = sid;
  update public.test_series_admin set created_by = pg_temp.id('e2'), origin = 'educator' where series_id = sid2;
  select id into qid from public.quizzes where series_id = sid;

  perform pg_temp.act_as(pg_temp.id('s1'));
  perform public.student_enroll(sid);
  perform pg_temp.act_as(pg_temp.id('s2'));
  perform public.student_enroll(sid);
  a := public.student_start_attempt(qid);
  perform public.student_submit_attempt((a ->> 'attempt_id')::uuid);
  perform pg_temp.act_as(pg_temp.id('s4'));
  perform public.student_enroll(sid2);

  perform pg_temp.act_as(pg_temp.id('e1'));
  perform pg_temp.expect_error(format('select public.adm_educator_students(%L)', pg_temp.id('e1')), '42501');
  perform pg_temp.ok(true, 'an educator can''t call adm_educator_students (admin only)');

  perform pg_temp.act_as(pg_temp.id('admin'));
  v := public.adm_educator_students(pg_temp.id('e1'));
  perform pg_temp.ok((v #>> '{summary,total}')::int = 2 and jsonb_array_length(v -> 'students') = 2,
                     'Ashika: her 2 students (not the unenrolled one, not Ravi''s)');
  select x into r from jsonb_array_elements(v -> 'students') x where x ->> 'name' = 'Kabir Das';
  perform pg_temp.ok(r ->> 'status' = 'completed' and (r ->> 'progress')::int = 100 and (r ->> 'tests_done')::int = 1
                     and r #>> '{series,0,title}' = 'Q28 Ashika Physics' and r ->> 'last_active_at' is not null,
                     'Kabir: every test attempted -> completed, 100%, with the series title');
  select x into r from jsonb_array_elements(v -> 'students') x where x ->> 'name' = 'Riya Sen';
  perform pg_temp.ok(r ->> 'status' = 'active' and (r ->> 'progress')::int = 0 and r ->> 'initials' = 'RS',
                     'Riya: enrolled today, nothing attempted -> active, 0%');
  perform pg_temp.ok((v #>> '{summary,completed}')::int = 1 and (v #>> '{summary,active}')::int = 1, 'summary counts');
  v := public.adm_educator_students(pg_temp.id('e2'));
  perform pg_temp.ok((v #>> '{summary,total}')::int = 1 and v #>> '{students,0,name}' = 'Ravi Student', 'Ravi: only his student');
  v := public.adm_educator_students(gen_random_uuid());
  perform pg_temp.ok((v #>> '{summary,total}')::int = 0 and v -> 'students' = '[]'::jsonb, 'an educator without series: none');
end $$;

-- ------------------------------------------------ 2. admin deletes a student
do $$
declare v jsonb; n_before bigint; n_after bigint;
begin
  perform pg_temp.act_as(pg_temp.id('admin'));
  n_before := (public.get_student_stats() ->> 'total')::bigint;

  perform pg_temp.act_as(pg_temp.id('admin'));
  set local role authenticated;
  perform pg_temp.expect_error(format('select public.adm_account_delete_by_admin(%L, %L, null)', pg_temp.id('admin'), pg_temp.id('s1')), '42501');
  reset role;
  perform pg_temp.ok(true, 'signed-in users (even admins) can''t call adm_account_delete_by_admin directly (service role only)');

  perform pg_temp.as_service();
  perform pg_temp.expect_error(format('select public.adm_account_delete_by_admin(%L, %L, null)', pg_temp.id('e1'), pg_temp.id('s1')), '42501');
  perform pg_temp.ok(true, 'a non-admin caller is refused');
  perform pg_temp.expect_error(format('select public.adm_account_delete_by_admin(%L, %L, null)', pg_temp.id('admin'), pg_temp.id('e1')), '42501');
  perform pg_temp.ok(true, 'an educator account can''t be deleted this way');
  perform pg_temp.expect_error(format('select public.adm_account_delete_by_admin(%L, %L, null)', pg_temp.id('admin'), pg_temp.id('admin')), '42501');
  perform pg_temp.ok(true, 'an admin can''t delete themselves');
  perform pg_temp.expect_error(format('select public.adm_account_delete_by_admin(%L, %L, null)', pg_temp.id('admin'), gen_random_uuid()), 'P0002');
  perform pg_temp.ok(true, 'an unknown user: not found');

  -- a pending self-request is closed by the admin's deletion
  perform pg_temp.act_as(pg_temp.id('s1'));
  perform public.account_request_deletion('please remove me');
  perform pg_temp.as_service();
  set local role service_role;
  v := public.adm_account_delete_by_admin(pg_temp.id('admin'), pg_temp.id('s1'), 'Requested by email');
  reset role;
  perform pg_temp.ok(v ->> 'status' = 'approved' and not (v ->> 'self_service')::boolean and v ->> 'role' = 'student',
                     'deletion recorded: approved, by the admin (not self-service)');
  perform pg_temp.ok((select count(*) from public.account_deletion_requests where user_id = pg_temp.id('s1')) = 1
                     and (select decided_by from public.account_deletion_requests where user_id = pg_temp.id('s1')) = pg_temp.id('admin'),
                     'the pending request became the record, decided by the admin');
  perform pg_temp.ok(public.adm_is_account_blocked(pg_temp.id('s1')), 'the student is blocked at once');
  perform pg_temp.ok(exists (select 1 from public.audit_logs where action = 'account.deleted_by_admin'
                              and target_id = pg_temp.id('s1') and actor_id = pg_temp.id('admin')), 'audited as account.deleted_by_admin');
  perform pg_temp.act_as(pg_temp.id('s1'));
  perform pg_temp.expect_error('select public.student_my_series()', 'UL403');
  perform pg_temp.ok(true, 'the deleted student''s RPCs are refused');

  perform pg_temp.act_as(pg_temp.id('admin'));
  perform pg_temp.ok(not exists (select 1 from public.list_students(null, null, null, 'registered_desc', 1, 100) r
                                  where (r.row_data ->> 'id')::uuid = pg_temp.id('s1')),
                     'list_students leaves the deleted account out');
  perform pg_temp.ok(exists (select 1 from public.list_students(null, null, null, 'registered_desc', 1, 100) r
                              where (r.row_data ->> 'id')::uuid = pg_temp.id('s2')), 'other students are still listed');
  n_after := (public.get_student_stats() ->> 'total')::bigint;
  perform pg_temp.ok(n_after = n_before - 1, 'get_student_stats: one student fewer');
  perform pg_temp.ok((public.adm_educator_students(pg_temp.id('e1')) #>> '{summary,total}')::int = 1,
                     'the educator''s Students tab leaves the deleted account out too');
end $$;

-- ------------------------------------------------ 3. minimal onboarding
do $$
declare e uuid := pg_temp.id('e3'); v jsonb;
begin
  perform pg_temp.act_as(e);
  perform public.educator_start_onboarding('Neha Kulkarni', '+91 98765 11111');
  perform public.educator_save_onboarding_step(1, '{"full_name":"Neha Kulkarni","phone":"+91 98765 11111","location":"Nagpur"}');
  v := public.educator_submit_onboarding();
  perform pg_temp.ok(v ->> 'status' = 'pending', 'submitted with only name, phone and location, and no ID pictures');
  perform pg_temp.ok((select qualifications is null and experience_years is null and bio is null and subjects is null and languages is null
                             and location = 'Nagpur'
                        from public.educator_profiles where user_id = e), 'the optional fields are saved as null');
end $$;

do $$ begin raise notice 'ok: all QA 28 Nov checks passed'; end $$;
rollback;
