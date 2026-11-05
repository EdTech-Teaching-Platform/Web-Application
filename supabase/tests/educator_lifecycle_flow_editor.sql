-- =====================================================================
-- supabase/tests/educator_lifecycle_flow_editor.sql
--
-- The educator lifecycle flow (the steps of educator_lifecycle_flow.sql plus,
-- since 20261104090000, the account round trips and the action matrix),
-- as ONE DO block for the Supabase SQL editor. Paste the whole file and run.
--
-- How it reports: every step appends {step, ok, detail} to a jsonb array.
-- At the end the block RAISES AN EXCEPTION whose message is the result:
--   line 1   "PASS: n of n steps" or "FAIL: k of n steps failed"
--   then     each failing step (step: detail)
--   then     every step, numbered, with ok / FAIL
-- Raising aborts the transaction, so NOTHING is kept (throwaway users,
-- documents, series and assignments all disappear). The editor shows the
-- message as an error even when everything passed: read line 1.
--
-- Needs 20261028*, 20261029090000 and 20261029100000 applied.
--
-- Identity switching: educator and student steps run as the browser role
-- (EXECUTE 'set local role authenticated' + request.jwt.claims); admin steps
-- run as the editor's own role (EXECUTE 'reset role') with the admin's
-- claims. Switches happen OUTSIDE the begin/exception sub-blocks: a caught
-- error rolls a sub-block back to its savepoint, which would also undo a
-- role or claims change made inside it.
-- =====================================================================
do $flow$
declare
  v_steps  jsonb := '[]'::jsonb;
  v_admin  uuid := gen_random_uuid();
  v_edu    uuid := gen_random_uuid();
  v_edu2   uuid := gen_random_uuid();
  v_edu3   uuid := gen_random_uuid();
  v_stu    uuid := gen_random_uuid();
  v_edus   uuid[];
  v_assignment uuid;
  v_series uuid;
  v_quiz   uuid;
  v_bucket text;
  v        jsonb;
  t        text;
  ids      uuid[];
  u        uuid;
  i        int;
  v_fail   int;
  v_msg    text;
begin
  -- ------------------------------------------------------------ fixtures (editor role)
  foreach u in array array[v_admin, v_edu, v_edu2, v_edu3, v_stu] loop
    insert into auth.users (id, email, aud, role) values (u, 'flow-' || u || '@example.invalid', 'authenticated', 'authenticated');
  end loop;
  insert into public.profiles (id, role, full_name, email) values
    (v_admin, 'admin', 'Flow Admin', 'flow-' || v_admin || '@example.invalid'),
    (v_stu, 'student', 'Flow Student', 'flow-' || v_stu || '@example.invalid');
  insert into public.adm_admin_users (user_id) values (v_admin);
  -- uploaded ID pictures (as educator-upload-url + the browser would leave them)
  select b.id into v_bucket from storage.buckets b order by (b.id = 'educator-verification-docs') desc, b.id limit 1;
  if v_bucket is null then
    insert into storage.buckets (id, name) values ('flow-test-docs', 'flow-test-docs') returning id into v_bucket;
  end if;
  v_edus := array[v_edu, v_edu2, v_edu3];
  foreach u in array v_edus loop
    insert into storage.objects (bucket_id, name, metadata) values
      (v_bucket, u || '/government_id-front-1.jpg', '{"size": 2048, "mimetype": "image/jpeg"}'),
      (v_bucket, u || '/government_id-back-1.jpg', '{"size": 2048, "mimetype": "image/jpeg"}');
  end loop;
  v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'fixtures: throwaway admin, 3 educators, student, uploaded ID files',
             'ok', true, 'detail', 'bucket ' || v_bucket));

  -- ------------------------------------------- the three educators onboard (browser role)
  -- edu: approve branch, edu2: reject branch, edu3: request-changes branch
  for i in 1 .. 3 loop
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', v_edus[i], 'role', 'authenticated')::text, true);
    begin
      perform public.educator_start_onboarding('Flow educator ' || i, '+91 90000 0001' || i);
      perform public.educator_save_onboarding_step(1, jsonb_build_object('full_name', 'Flow Educator ' || i,
                'phone', '+91 90000 0001' || i, 'location', 'Pune'));
      perform public.educator_save_onboarding_step(2, '{"qualifications":"MSc Mathematics","experience_years":6}');
      perform public.educator_save_onboarding_step(3, jsonb_build_object('subjects', jsonb_build_array('Mathematics'),
                'languages', jsonb_build_array('English'), 'bio', repeat('I teach algebra and calculus. ', 3)));
      perform public.educator_register_document('government_id', v_edus[i] || '/government_id-front-1.jpg', 'front');
      perform public.educator_register_document('government_id', v_edus[i] || '/government_id-back-1.jpg', 'back');
      t := public.educator_submit_onboarding() ->> 'status';
      v_steps := v_steps || jsonb_build_array(jsonb_build_object('step',
                 'educator ' || i || ': start onboarding, save 3 steps, register ID front + back, submit',
                 'ok', coalesce(t = 'pending', false), 'detail', 'status ' || coalesce(t, 'null')));
    exception when others then
      v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'educator ' || i || ': onboarding', 'ok', false, 'detail', sqlerrm));
    end;
  end loop;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_edu, 'role', 'authenticated')::text, true);
  begin
    perform public.educator_get_dashboard();
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'educator: verified-only RPC refused while pending',
               'ok', false, 'detail', 'educator_get_dashboard succeeded'));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'educator: verified-only RPC refused while pending',
               'ok', sqlstate = '42501', 'detail', sqlstate || ' ' || sqlerrm));
  end;

  -- ================================================ admin: queue, approve
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  begin
    select r.row_data into v from public.list_educators(p_verification => 'pending', p_size => 100) r
     where (r.row_data ->> 'id')::uuid = v_edu;
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'admin: educator in list_educators (pending filter)',
               'ok', coalesce(v ->> 'verification_status' = 'pending', false), 'detail', coalesce(v ->> 'verification_status', 'not listed')));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'admin: list_educators pending', 'ok', false, 'detail', sqlerrm));
  end;
  begin
    perform public.set_educator_verification(v_edu, 'approved', null);
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'admin: approve (set_educator_verification approved)', 'ok', true, 'detail', null));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'admin: approve', 'ok', false, 'detail', sqlerrm));
  end;

  -- ================================================ educator: approved
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_edu, 'role', 'authenticated')::text, true);
  begin
    v := public.educator_get_status();
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'educator: educator_get_status is approved',
               'ok', coalesce(v ->> 'status' = 'approved', false), 'detail', left(v::text, 400)));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'educator: get_status', 'ok', false, 'detail', sqlerrm));
  end;
  begin
    v := public.educator_get_dashboard();
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'educator: educator_get_dashboard works',
               'ok', coalesce(jsonb_typeof(v) = 'object', false), 'detail', left(v::text, 120)));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'educator: dashboard', 'ok', false, 'detail', sqlerrm));
  end;

  -- ================================================ admin: lists, assign
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  begin
    select r.row_data into v from public.list_educators(p_verification => 'approved', p_size => 100) r
     where (r.row_data ->> 'id')::uuid = v_edu;
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'admin: educator in list_educators with status approved',
               'ok', coalesce(v ->> 'verification_status' = 'approved' and v ->> 'account_status' = 'active', false),
               'detail', coalesce(v ->> 'verification_status', 'not listed')));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'admin: list_educators approved', 'ok', false, 'detail', sqlerrm));
  end;
  begin
    v := public.get_educator_stats();
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'admin: get_educator_stats counts approved',
               'ok', coalesce((v #>> '{by_state,approved}')::int >= 1, false), 'detail', left(v::text, 400)));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'admin: stats', 'ok', false, 'detail', sqlerrm));
  end;
  begin
    v := null;
    select r.row_data into v from public.list_assignable_educators(p_size => 200) r
     where (r.row_data ->> 'id')::uuid = v_edu;
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'admin: educator in list_assignable_educators',
               'ok', v is not null, 'detail', coalesce(v ->> 'name', 'not listed') || ' · open ' || coalesce(v ->> 'open_assignments', '?')));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'admin: list_assignable_educators', 'ok', false, 'detail', sqlerrm));
  end;
  begin
    ids := public.create_assignments(jsonb_build_object(
      'seriesMode', 'new', 'newSeriesName', 'Flow series ' || v_edu, 'subject', 'Mathematics',
      'testName', 'Flow algebra test', 'educatorIds', jsonb_build_array(v_edu), 'questionCount', 1,
      'deadline', current_date + 7));
    v_assignment := ids[1];
    select a.series_id into v_series from public.test_assignments a where a.id = v_assignment;
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'admin: create a series and assign it (create_assignments)',
               'ok', v_assignment is not null, 'detail', 'assignment ' || coalesce(v_assignment::text, 'null')));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'admin: create_assignments', 'ok', false, 'detail', sqlerrm));
  end;

  -- ================================================ educator: build, publish
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_edu, 'role', 'authenticated')::text, true);
  begin
    v := public.educator_list_assignments('open');
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'educator: educator_list_assignments shows it',
               'ok', exists (select 1 from jsonb_array_elements(v) a where (a ->> 'id')::uuid = v_assignment),
               'detail', jsonb_array_length(v) || ' open'));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'educator: list_assignments', 'ok', false, 'detail', sqlerrm));
  end;
  begin
    v := public.educator_start_assignment(v_assignment);
    v_quiz := (v -> 'test' ->> 'id')::uuid;
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'educator: start the assignment (test shell created)',
               'ok', coalesce(v -> 'assignment' ->> 'status' = 'in_progress' and v_quiz is not null, false),
               'detail', 'test ' || coalesce(v_quiz::text, '—')));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'educator: start_assignment', 'ok', false, 'detail', sqlerrm));
  end;
  begin
    v := public.create_question(v_quiz, '{"type":"mcq_single","text":"2x = 6, x = ?","optionA":"2","optionB":"3","optionC":"4","optionD":"6","correctAnswer":"B","marks":4}');
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'educator: add content (create_question)',
               'ok', v ? 'id', 'detail', 'question ' || (v ->> 'id')));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'educator: create_question', 'ok', false, 'detail', sqlerrm));
  end;
  begin
    v := public.adm_publish_test_series(v_series, true);
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'educator: publish the assigned series',
               'ok', coalesce(v ->> 'status' = 'published', false), 'detail', left(v::text, 400)));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'educator: publish', 'ok', false, 'detail', sqlerrm));
  end;
  begin
    v := public.educator_get_assignment(v_assignment);
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'educator: the assignment is completed',
               'ok', coalesce(v -> 'assignment' ->> 'status' = 'completed', false), 'detail', v -> 'assignment' ->> 'status'));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'educator: assignment completed', 'ok', false, 'detail', sqlerrm));
  end;

  -- ================================================ student: sees it
  perform set_config('request.jwt.claims', json_build_object('sub', v_stu, 'role', 'authenticated')::text, true);
  begin
    v := public.student_list_series(p_search => 'Flow series ' || v_edu);
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'student: student_list_series shows the published series',
               'ok', coalesce(v::text like '%' || v_series || '%', false), 'detail', left(v::text, 160)));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'student: list_series', 'ok', false, 'detail', sqlerrm));
  end;

  -- ================================================ reject branch (educator 2)
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  begin
    perform public.set_educator_verification(v_edu2, 'rejected', 'The ID picture is unreadable.');
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'reject branch: admin rejects with a reason', 'ok', true, 'detail', null));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'reject branch: reject', 'ok', false, 'detail', sqlerrm));
  end;
  begin
    perform public.set_educator_verification(v_edu2, 'rejected', null);
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'reject branch: a reject without a reason is refused', 'ok', false, 'detail', 'accepted'));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'reject branch: a reject without a reason is refused',
               'ok', sqlstate = '22023', 'detail', sqlerrm));
  end;
  begin
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'reject branch: admin list shows rejected and excludes it from assignable',
      'ok', coalesce((select r.row_data ->> 'verification_status' from public.list_educators(p_size => 100) r
                       where (r.row_data ->> 'id')::uuid = v_edu2) = 'rejected'
                     and not exists (select 1 from public.list_assignable_educators(p_size => 200) r
                                      where (r.row_data ->> 'id')::uuid = v_edu2), false),
      'detail', null));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'reject branch: admin lists', 'ok', false, 'detail', sqlerrm));
  end;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_edu2, 'role', 'authenticated')::text, true);
  begin
    v := public.educator_get_status();
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'reject branch: educator sees rejected with the reason, can edit',
               'ok', coalesce(v ->> 'status' = 'rejected' and v ->> 'note' = 'The ID picture is unreadable.' and (v ->> 'can_edit')::boolean, false),
               'detail', left(v::text, 400)));
    v := public.educator_submit_onboarding();
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'reject branch: resubmits, pending again',
               'ok', coalesce(v ->> 'status' = 'pending', false), 'detail', v ->> 'status'));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'reject branch: educator', 'ok', false, 'detail', sqlerrm));
  end;

  -- ================================================ request-changes branch (educator 3)
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  begin
    perform public.set_educator_verification(v_edu3, 'changes_requested', 'Add your B.Ed details.');
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'changes branch: admin requests changes',
      'ok', coalesce((select r.row_data ->> 'verification_status' from public.list_educators(p_size => 100) r
                       where (r.row_data ->> 'id')::uuid = v_edu3) = 'changes_requested', false),
      'detail', null));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'changes branch: request changes', 'ok', false, 'detail', sqlerrm));
  end;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_edu3, 'role', 'authenticated')::text, true);
  begin
    v := public.educator_get_status();
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'changes branch: educator sees changes_requested with the note, can edit',
               'ok', coalesce(v ->> 'status' = 'changes_requested' and v ->> 'note' = 'Add your B.Ed details.' and (v ->> 'can_edit')::boolean, false),
               'detail', left(v::text, 400)));
    perform public.educator_save_onboarding_step(2, '{"qualifications":"MSc Mathematics, B.Ed","experience_years":6}');
    v := public.educator_submit_onboarding();
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'changes branch: edits and resubmits, pending again',
               'ok', coalesce(v ->> 'status' = 'pending', false), 'detail', v ->> 'status'));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'changes branch: educator', 'ok', false, 'detail', sqlerrm));
  end;

  -- ================================================ suspension
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  begin
    perform public.set_educator_account_status(v_edu, 'suspended', 'Flow test');
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'suspend: admin suspends the approved educator; not assignable any more',
      'ok', coalesce(not exists (select 1 from public.list_assignable_educators(p_size => 200) r where (r.row_data ->> 'id')::uuid = v_edu)
                     and (select r.row_data ->> 'effective_state' from public.list_educators(p_size => 100) r
                           where (r.row_data ->> 'id')::uuid = v_edu) = 'suspended', false),
      'detail', null));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'suspend', 'ok', false, 'detail', sqlerrm));
  end;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_edu, 'role', 'authenticated')::text, true);
  begin
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'suspend: educator sees suspended and is not verified',
               'ok', coalesce(public.educator_get_status() ->> 'status' = 'suspended' and not public.adm_is_verified_educator(), false),
               'detail', null));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'suspend: educator', 'ok', false, 'detail', sqlerrm));
  end;
  -- ================================================ round trips and the action matrix (20261104090000)
  -- educator 1: suspended above -> reactivate -> deactivate -> activate -> suspend -> reactivate
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  begin
    perform public.set_educator_account_status(v_edu, 'active', null);
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'round trip: reactivate the suspended educator',
               'ok', public.adm_educator_effective_state(v_edu) = 'approved', 'detail', public.adm_educator_effective_state(v_edu)));
    perform public.set_educator_account_status(v_edu, 'inactive', 'Flow: deactivate');
    v := public.get_educator_detail(v_edu);
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'round trip: deactivate (actions now activate, delete)',
               'ok', v #>> '{educator,account_status}' = 'inactive' and v #> '{educator,actions}' = '["activate", "delete"]'::jsonb,
               'detail', (v #> '{educator,actions}')::text));
    perform public.set_educator_account_status(v_edu, 'active', null);
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'round trip: activate after deactivate (bug #4)',
               'ok', public.adm_educator_effective_state(v_edu) = 'approved'
                     and exists (select 1 from public.list_assignable_educators(p_size => 200) r where (r.row_data ->> 'id')::uuid = v_edu),
               'detail', public.adm_educator_effective_state(v_edu)));
    perform public.set_educator_account_status(v_edu, 'suspended', 'Flow: suspend');
    perform public.set_educator_account_status(v_edu, 'active', null);
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'round trip: suspend, then reactivate',
               'ok', public.adm_educator_effective_state(v_edu) = 'approved', 'detail', public.adm_educator_effective_state(v_edu)));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'round trip: educator 1', 'ok', false, 'detail', sqlerrm));
  end;
  begin
    perform public.set_educator_verification(v_edu, 'rejected', 'Flow: reject an approved educator');
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'matrix: an approved educator can''t be rejected', 'ok', false, 'detail', 'accepted'));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'matrix: an approved educator can''t be rejected',
               'ok', sqlstate = '22023', 'detail', sqlerrm));
  end;

  -- educator 2 (pending after the resubmission above): no account actions; reject -> reconsider -> approve
  begin
    perform public.set_educator_account_status(v_edu2, 'suspended', 'Flow: suspend a pending educator');
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'matrix: a pending educator can''t be suspended', 'ok', false, 'detail', 'accepted'));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'matrix: a pending educator can''t be suspended',
               'ok', sqlstate = '22023', 'detail', sqlerrm));
  end;
  begin
    perform public.set_educator_verification(v_edu2, 'rejected', 'Flow: second rejection');
    v := public.get_educator_detail(v_edu2);
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'reject: rejected, account inactive, actions reconsider + delete (bug #3)',
               'ok', v #>> '{educator,effective_state}' = 'rejected' and v #>> '{educator,account_status}' = 'inactive'
                     and v #> '{educator,actions}' = '["reconsider", "delete"]'::jsonb,
               'detail', (v #> '{educator,actions}')::text || ' ' || coalesce(v #>> '{educator,account_status}', '')));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'reject: educator 2', 'ok', false, 'detail', sqlerrm));
  end;
  begin
    perform public.set_educator_account_status(v_edu2, 'inactive', 'Flow');
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'matrix: a rejected educator can''t be deactivated', 'ok', false, 'detail', 'accepted'));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'matrix: a rejected educator can''t be deactivated',
               'ok', sqlstate = '22023', 'detail', sqlerrm));
  end;
  begin
    perform public.set_educator_verification(v_edu2, 'approved', null);
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'matrix: a rejected educator can''t be approved before a reconsider', 'ok', false, 'detail', 'accepted'));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'matrix: a rejected educator can''t be approved before a reconsider',
               'ok', sqlstate = '22023', 'detail', sqlerrm));
  end;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_edu2, 'role', 'authenticated')::text, true);
  begin
    v := public.educator_get_status();
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'reject: the educator sees rejected (not suspended) with the reason',
               'ok', coalesce(v ->> 'status' = 'rejected' and v ->> 'note' = 'Flow: second rejection' and (v ->> 'can_edit')::boolean, false),
               'detail', left(v::text, 300)));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'reject: educator 2 status', 'ok', false, 'detail', sqlerrm));
  end;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  begin
    perform public.set_educator_verification(v_edu2, 'under_review', null);
    v := public.get_educator_detail(v_edu2);
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'reconsider: under review, account active again',
               'ok', v #>> '{educator,effective_state}' = 'under_review' and v #>> '{educator,account_status}' = 'active',
               'detail', coalesce(v #>> '{educator,effective_state}', '') || ' / ' || coalesce(v #>> '{educator,account_status}', '')));
    perform public.set_educator_verification(v_edu2, 'approved', null);
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'reconsider, then approve',
               'ok', public.adm_educator_effective_state(v_edu2) = 'approved', 'detail', public.adm_educator_effective_state(v_edu2)));
  exception when others then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('step', 'reconsider: educator 2', 'ok', false, 'detail', sqlerrm));
  end;

  execute 'reset role';

  -- ================================================ result (aborts: nothing is kept)
  select count(*) filter (where not (s ->> 'ok')::boolean) into v_fail from jsonb_array_elements(v_steps) s;
  v_msg := case when v_fail = 0 then format('PASS: %s of %s steps', jsonb_array_length(v_steps), jsonb_array_length(v_steps))
                else format('FAIL: %s of %s steps failed', v_fail, jsonb_array_length(v_steps)) end;
  select v_msg || coalesce(E'\n' || string_agg(format('FAILED #%s %s: %s', e.n, e.s ->> 'step', coalesce(e.s ->> 'detail', '')), E'\n' order by e.n), '')
    into v_msg
    from jsonb_array_elements(v_steps) with ordinality as e(s, n)
   where not (e.s ->> 'ok')::boolean;
  select v_msg || E'\n\nAll steps:\n' || string_agg(format('%s. %s  %s%s', e.n, case when (e.s ->> 'ok')::boolean then 'ok  ' else 'FAIL' end,
                                                         e.s ->> 'step', coalesce(' (' || (e.s ->> 'detail') || ')', '')), E'\n' order by e.n)
    into v_msg
    from jsonb_array_elements(v_steps) with ordinality as e(s, n);
  raise exception '%', v_msg
    using detail = 'Raised on purpose so the transaction rolls back: nothing from this run is kept.',
          errcode = case when v_fail = 0 then 'P0001' else 'P0004' end;
end $flow$;
