-- =====================================================================
-- supabase/tests/student_block.sql
--
-- Smoke tests for 20261102090000_student_block_enforcement.sql.
-- LOCAL / DISPOSABLE DATABASE ONLY. One transaction, rolled back.
-- Expect "ok: ..." notices and "ok: all student block checks passed".
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
  v_series uuid; v_test uuid; v_att uuid; v jsonb;
begin
  foreach u in array array[v_admin, v_stu, v_other] loop
    insert into auth.users (id, email) values (u, 'sb-' || u || '@test.local');
  end loop;
  insert into public.profiles (id, role, full_name, email) values
    (v_admin, 'admin', 'Block Admin', 'sb-' || v_admin || '@test.local'),
    (v_stu, 'student', 'Blocked Student', 'sb-' || v_stu || '@test.local'),
    (v_other, 'student', 'Other Student', 'sb-' || v_other || '@test.local');
  insert into public.adm_admin_users (user_id) values (v_admin);

  perform pg_temp.act_as(v_admin);
  v_series := public.upsert_test_series_full(jsonb_build_object(
    'name', 'Block test series', 'pricing', 'free', 'startMethod', 'scratch',
    'availability', jsonb_build_object('goLive', 'now', 'mode', 'always'),
    'tests', jsonb_build_array(jsonb_build_object('name', 'Unit 1', 'duration', '20', 'passingPercent', '50', 'attemptLimit', '3',
      'questions', jsonb_build_array(jsonb_build_object('type', 'mcq_single', 'text', 'Two plus two?', 'marks', '4',
        'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', '3'), jsonb_build_object('key', 'B', 'text', '4')),
        'correctAnswers', jsonb_build_array('B')))))), true);
  v_test := ((public.get_test_series(v_series)) #>> '{tests,0,id}')::uuid;

  -- before the block: the student uses the portal
  perform pg_temp.act_as(v_stu);
  perform public.student_enroll(v_series);
  v := public.student_start_attempt(v_test);
  v_att := (v ->> 'attempt_id')::uuid;
  perform pg_temp.remember('admin', v_admin); perform pg_temp.remember('stu', v_stu); perform pg_temp.remember('other', v_other);
  perform pg_temp.remember('series', v_series); perform pg_temp.remember('test', v_test); perform pg_temp.remember('att', v_att);
  perform pg_temp.remember('q', ((v -> 'questions' -> 0) ->> 'id')::uuid);
end $fx$;

do $$
begin
  perform pg_temp.act_as(pg_temp.id('stu'));
  perform pg_temp.ok(jsonb_typeof(public.student_dashboard()) = 'object' and not (public.student_get_account_status() ->> 'blocked')::boolean,
                     'before: the student uses the portal; status not blocked');
  perform pg_temp.act_as(pg_temp.id('admin'));
  perform public.block_student(pg_temp.id('stu'), 'Sharing answers in the exam (internal note)');
end $$;

-- ------------------------------------------------- every student RPC refuses
do $$
declare
  s uuid := pg_temp.id('series'); t uuid := pg_temp.id('test'); a uuid := pg_temp.id('att'); q uuid := pg_temp.id('q');
  stmt text;
  n int := 0;
begin
  perform pg_temp.act_as(pg_temp.id('stu'));
  foreach stmt in array array[
    'select public.student_dashboard()',
    'select public.student_list_series()',
    format('select public.student_get_series(%L)', s),
    format('select public.student_enroll(%L)', s),
    'select public.student_my_series()',
    format('select public.student_get_test_intro(%L)', t),
    format('select public.student_start_attempt(%L)', t),
    format('select public.student_save_answer(%L, %L, %L::jsonb)', a, q, '{"selected_option_ids": []}'),
    format('select public.student_log_proctor_event(%L, %L)', a, 'tab_switch'),
    format('select public.student_submit_attempt(%L)', a),
    format('select public.student_get_report(%L)', a),
    'select public.student_my_history()',
    'select public.student_get_stats()',
    format('select public.student_submit_feedback(%L, %L, 4, null, null, %L)', a, 'feedback', 'Nice test overall'),
    'select public.student_my_feedback()']
  loop
    perform pg_temp.expect_error(stmt, 'UL403', 'account_blocked');
    n := n + 1;
  end loop;
  perform pg_temp.ok(n = 15, 'blocked: all 15 student RPCs refuse with UL403 account_blocked');

  perform pg_temp.ok((public.student_get_account_status() ->> 'blocked')::boolean
                     and public.student_get_account_status() ->> 'reason_public' like 'Your account has been blocked%'
                     and position('internal note' in public.student_get_account_status()::text) = 0,
                     'blocked: student_get_account_status still answers, with a generic reason (never the admin''s)');

  perform pg_temp.act_as(pg_temp.id('other'));
  perform pg_temp.ok(jsonb_typeof(public.student_dashboard()) = 'object', 'another student is not affected');
end $$;

-- ------------------------------------------------- admin: detail and ban helpers
do $$
declare v jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('admin'));
  v := public.get_student_detail(pg_temp.id('stu'));
  perform pg_temp.ok(v ->> 'status' = 'blocked' and v ->> 'blocked_by_name' = 'Block Admin' and v ->> 'blocked_at' is not null
                     and v #>> '{block_history,0,action}' = 'blocked' and v #>> '{block_history,0,by_name}' = 'Block Admin',
                     'admin detail: status, reason, date, who and the history');

  v := public.adm_user_ban_check(pg_temp.id('stu'));
  perform pg_temp.ok((v ->> 'exists')::boolean and (v ->> 'blocked')::boolean and not (v ->> 'is_admin')::boolean and not (v ->> 'is_self')::boolean,
                     'ban check: a blocked student');
  v := public.adm_user_ban_check(pg_temp.id('admin'));
  perform pg_temp.ok((v ->> 'is_admin')::boolean and (v ->> 'is_self')::boolean, 'ban check: an admin (and self) is flagged');
  perform public.adm_record_user_ban(pg_temp.id('stu'), true, true, 'banned until unblocked');
  perform pg_temp.ok(exists (select 1 from public.audit_logs where action = 'user.auth_ban' and target_id = pg_temp.id('stu')
                              and actor_id = pg_temp.id('admin') and (after_state ->> 'ok')::boolean),
                     'ban audit row written');

  perform pg_temp.act_as(pg_temp.id('other'));
  perform pg_temp.expect_error(format('select public.adm_user_ban_check(%L)', pg_temp.id('stu')), '42501');
  perform pg_temp.expect_error(format('select public.adm_record_user_ban(%L, true, true)', pg_temp.id('stu')), '42501');
  perform pg_temp.ok(true, 'ban helpers: admins only');
end $$;

-- ------------------------------------------------- unblock restores
do $$
begin
  perform pg_temp.act_as(pg_temp.id('admin'));
  perform public.unblock_student(pg_temp.id('stu'));
  perform pg_temp.act_as(pg_temp.id('stu'));
  perform pg_temp.ok(jsonb_typeof(public.student_dashboard()) = 'object' and jsonb_typeof(public.student_my_series()) = 'array'
                     and not (public.student_get_account_status() ->> 'blocked')::boolean,
                     'unblock: the student is back in');
end $$;

do $$
begin
  perform pg_temp.ok(not has_function_privilege('authenticated', 'public.adm_student_is_blocked(uuid)', 'execute')
                     and not has_function_privilege('anon', 'public.student_get_account_status()', 'execute')
                     and has_function_privilege('authenticated', 'public.student_get_account_status()', 'execute'),
                     'grants');
end $$;

do $$ begin raise notice 'ok: all student block checks passed'; end $$;
rollback;
