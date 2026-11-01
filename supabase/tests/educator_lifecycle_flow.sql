-- =====================================================================
-- supabase/tests/educator_lifecycle_flow.sql
--
-- End-to-end educator lifecycle, written for the Supabase SQL editor (also
-- runs in the local PGlite harness). EVERYTHING IS ROLLED BACK: the
-- throwaway users, documents, series and assignments disappear at the end.
-- Needs 20261028* and 20261029* applied. Run the whole file at once.
--
-- Result: one row per step (#, step, ok, detail). Every step catches its
-- own error, so a failure shows as ok = false with the message instead of
-- aborting the run.
--
-- Actors: a throwaway admin (allowlisted), three throwaway educators
-- (approve / reject / request-changes branches) and a throwaway student.
-- Educator and student steps run as the browser role
-- (request.jwt.claims + set local role authenticated); admin steps run after
-- reset role with the admin's claims.
-- =====================================================================
begin;

create temp table flow_steps (n serial primary key, step text not null, ok boolean not null, detail text) on commit drop;
grant all on table pg_temp.flow_steps to public;
grant usage on sequence pg_temp.flow_steps_n_seq to public;

create function pg_temp.step(p_step text, p_ok boolean, p_detail text default null) returns void
language sql as $$ insert into pg_temp.flow_steps (step, ok, detail) values (p_step, coalesce(p_ok, false), left(p_detail, 400)) $$;

create function pg_temp.act(p_key text) returns void
language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', current_setting('flow.' || p_key), 'role', 'authenticated')::text, true);
$$;

create function pg_temp.id(p_key text) returns uuid
language sql as $$ select nullif(current_setting('flow.' || p_key, true), '')::uuid $$;

-- The educator side of onboarding, as the current (educator) user:
-- start, three steps, both ID pictures, submit. Returns the submit status.
create function pg_temp.onboard(p_key text) returns text
language plpgsql as $$
declare
  v_uid uuid := pg_temp.id(p_key);
begin
  perform public.educator_start_onboarding('Flow ' || p_key, '+91 90000 00' || lpad((ascii(right(p_key, 1)) % 100)::text, 2, '0'));
  perform public.educator_save_onboarding_step(1, jsonb_build_object('full_name', 'Flow ' || p_key || ' Teacher',
            'phone', '+91 90000 00011', 'location', 'Pune'));
  perform public.educator_save_onboarding_step(2, '{"qualifications":"MSc Mathematics","experience_years":6}');
  perform public.educator_save_onboarding_step(3, jsonb_build_object('subjects', jsonb_build_array('Mathematics'),
            'languages', jsonb_build_array('English'), 'bio', repeat('I teach algebra and calculus. ', 3)));
  perform public.educator_register_document('government_id', v_uid || '/government_id-front-1.jpg', 'front');
  perform public.educator_register_document('government_id', v_uid || '/government_id-back-1.jpg', 'back');
  return public.educator_submit_onboarding() ->> 'status';
end $$;

-- ------------------------------------------------------------ fixtures
do $fx$
declare
  k      text;
  u      uuid;
  v_bucket text;
begin
  foreach k in array array['admin', 'edu', 'edu2', 'edu3', 'student'] loop
    u := gen_random_uuid();
    perform set_config('flow.' || k, u::text, true);
    insert into auth.users (id, email, aud, role) values (u, 'flow-' || k || '-' || u || '@example.invalid', 'authenticated', 'authenticated');
  end loop;
  insert into public.profiles (id, role, full_name, email) values
    (pg_temp.id('admin'), 'admin', 'Flow Admin', 'flow-admin-' || pg_temp.id('admin') || '@example.invalid'),
    (pg_temp.id('student'), 'student', 'Flow Student', 'flow-student-' || pg_temp.id('student') || '@example.invalid');
  insert into public.adm_admin_users (user_id) values (pg_temp.id('admin'));

  -- uploaded ID pictures (as educator-upload-url + the browser would leave them)
  select id into v_bucket from storage.buckets order by (id = 'educator-verification-docs') desc, id limit 1;
  if v_bucket is null then
    insert into storage.buckets (id, name) values ('flow-test-docs', 'flow-test-docs') returning id into v_bucket;
  end if;
  foreach k in array array['edu', 'edu2', 'edu3'] loop
    insert into storage.objects (bucket_id, name, metadata) values
      (v_bucket, pg_temp.id(k) || '/government_id-front-1.jpg', '{"size": 2048, "mimetype": "image/jpeg"}'),
      (v_bucket, pg_temp.id(k) || '/government_id-back-1.jpg', '{"size": 2048, "mimetype": "image/jpeg"}');
  end loop;
  perform pg_temp.step('fixtures: throwaway admin, 3 educators, student, uploaded ID files', true, 'bucket ' || v_bucket);
end $fx$;

-- ===================================================== approve branch: educator
set local role authenticated;
do $$
declare v text;
begin
  perform pg_temp.act('edu');
  begin
    v := pg_temp.onboard('edu');
    perform pg_temp.step('educator: start onboarding, save 3 steps, register ID front + back, submit', v = 'pending', 'status ' || v);
  exception when others then perform pg_temp.step('educator: onboarding', false, sqlerrm); end;
  begin
    perform public.educator_get_dashboard();
    perform pg_temp.step('educator: verified-only RPC refused while pending', false, 'educator_get_dashboard succeeded');
  exception when others then
    perform pg_temp.step('educator: verified-only RPC refused while pending', sqlstate = '42501', sqlstate || ' ' || sqlerrm);
  end;
end $$;
reset role;

-- ===================================================== admin: queue, approve
do $$
declare v jsonb;
begin
  perform pg_temp.act('admin');
  begin
    select r.row_data into v from public.list_educators(p_verification => 'pending', p_size => 100) r
     where (r.row_data ->> 'id')::uuid = pg_temp.id('edu');
    perform pg_temp.step('admin: educator in list_educators (pending filter)', v ->> 'verification_status' = 'pending',
                         coalesce(v ->> 'verification_status', 'not listed'));
  exception when others then perform pg_temp.step('admin: list_educators pending', false, sqlerrm); end;
  begin
    perform public.set_educator_verification(pg_temp.id('edu'), 'approved', null);
    perform pg_temp.step('admin: approve (set_educator_verification approved)', true, null);
  exception when others then perform pg_temp.step('admin: approve', false, sqlerrm); end;
end $$;

-- ===================================================== educator: approved
set local role authenticated;
do $$
declare v jsonb;
begin
  perform pg_temp.act('edu');
  begin
    v := public.educator_get_status();
    perform pg_temp.step('educator: educator_get_status is approved', v ->> 'status' = 'approved', v::text);
  exception when others then perform pg_temp.step('educator: get_status', false, sqlerrm); end;
  begin
    v := public.educator_get_dashboard();
    perform pg_temp.step('educator: educator_get_dashboard works', jsonb_typeof(v) = 'object', left(v::text, 120));
  exception when others then perform pg_temp.step('educator: dashboard', false, sqlerrm); end;
end $$;
reset role;

-- ===================================================== admin: lists, assign
do $$
declare
  v    jsonb;
  ids  uuid[];
  stats jsonb;
begin
  perform pg_temp.act('admin');
  begin
    select r.row_data into v from public.list_educators(p_verification => 'approved', p_size => 100) r
     where (r.row_data ->> 'id')::uuid = pg_temp.id('edu');
    perform pg_temp.step('admin: educator in list_educators with status approved', v ->> 'verification_status' = 'approved'
                         and v ->> 'account_status' = 'active', coalesce(v ->> 'verification_status', 'not listed'));
  exception when others then perform pg_temp.step('admin: list_educators approved', false, sqlerrm); end;
  begin
    stats := public.get_educator_stats();
    perform pg_temp.step('admin: get_educator_stats counts approved', (stats #>> '{by_state,approved}')::int >= 1, stats::text);
  exception when others then perform pg_temp.step('admin: stats', false, sqlerrm); end;
  begin
    select r.row_data into v from public.list_assignable_educators(p_size => 200) r
     where (r.row_data ->> 'id')::uuid = pg_temp.id('edu');
    perform pg_temp.step('admin: educator in list_assignable_educators', v is not null,
                         coalesce(v ->> 'name', 'not listed') || ' · open ' || coalesce(v ->> 'open_assignments', '?'));
  exception when others then perform pg_temp.step('admin: list_assignable_educators', false, sqlerrm); end;
  begin
    ids := public.create_assignments(jsonb_build_object(
      'seriesMode', 'new', 'newSeriesName', 'Flow series ' || pg_temp.id('edu'), 'subject', 'Mathematics',
      'testName', 'Flow algebra test', 'educatorIds', jsonb_build_array(pg_temp.id('edu')), 'questionCount', 1,
      'deadline', current_date + 7));
    perform set_config('flow.assignment', ids[1]::text, true);
    perform set_config('flow.series', (select series_id::text from public.test_assignments where id = ids[1]), true);
    perform pg_temp.step('admin: create a series and assign it (create_assignments)', ids[1] is not null, 'assignment ' || ids[1]);
  exception when others then perform pg_temp.step('admin: create_assignments', false, sqlerrm); end;
end $$;

-- ===================================================== educator: build, publish
set local role authenticated;
do $$
declare
  v    jsonb;
  quiz uuid;
begin
  perform pg_temp.act('edu');
  begin
    v := public.educator_list_assignments('open');
    perform pg_temp.step('educator: educator_list_assignments shows it',
                         exists (select 1 from jsonb_array_elements(v) a where (a ->> 'id')::uuid = pg_temp.id('assignment')),
                         jsonb_array_length(v) || ' open');
  exception when others then perform pg_temp.step('educator: list_assignments', false, sqlerrm); end;
  begin
    v := public.educator_start_assignment(pg_temp.id('assignment'));
    quiz := (v -> 'test' ->> 'id')::uuid;
    perform set_config('flow.quiz', quiz::text, true);
    perform pg_temp.step('educator: start the assignment (test shell created)',
                         v -> 'assignment' ->> 'status' = 'in_progress' and quiz is not null, 'test ' || coalesce(quiz::text, '—'));
  exception when others then perform pg_temp.step('educator: start_assignment', false, sqlerrm); end;
  begin
    v := public.create_question(pg_temp.id('quiz'), '{"type":"mcq_single","text":"2x = 6, x = ?","optionA":"2","optionB":"3","optionC":"4","optionD":"6","correctAnswer":"B","marks":4}');
    perform pg_temp.step('educator: add content (create_question)', v ? 'id', 'question ' || (v ->> 'id'));
  exception when others then perform pg_temp.step('educator: create_question', false, sqlerrm); end;
  begin
    v := public.adm_publish_test_series(pg_temp.id('series'), true);
    perform pg_temp.step('educator: publish the assigned series', v ->> 'status' = 'published', v::text);
  exception when others then perform pg_temp.step('educator: publish', false, sqlerrm); end;
  begin
    v := public.educator_get_assignment(pg_temp.id('assignment'));
    perform pg_temp.step('educator: the assignment is completed', v -> 'assignment' ->> 'status' = 'completed', v -> 'assignment' ->> 'status');
  exception when others then perform pg_temp.step('educator: assignment completed', false, sqlerrm); end;
end $$;

-- ===================================================== student: sees it
do $$
declare v jsonb;
begin
  perform pg_temp.act('student');
  begin
    v := public.student_list_series(p_search => 'Flow series ' || pg_temp.id('edu'));
    perform pg_temp.step('student: student_list_series shows the published series', v::text like '%' || pg_temp.id('series') || '%',
                         left(v::text, 160));
  exception when others then perform pg_temp.step('student: list_series', false, sqlerrm); end;
end $$;

-- ===================================================== reject branch
do $$
declare v text;
begin
  perform pg_temp.act('edu2');
  begin
    v := pg_temp.onboard('edu2');
    perform pg_temp.step('reject branch: educator 2 submits', v = 'pending', 'status ' || v);
  exception when others then perform pg_temp.step('reject branch: onboarding', false, sqlerrm); end;
end $$;
reset role;
do $$
begin
  perform pg_temp.act('admin');
  begin
    perform public.set_educator_verification(pg_temp.id('edu2'), 'rejected', 'The ID picture is unreadable.');
    perform pg_temp.step('reject branch: admin rejects with a reason', true, null);
  exception when others then perform pg_temp.step('reject branch: reject', false, sqlerrm); end;
  begin
    perform public.set_educator_verification(pg_temp.id('edu2'), 'rejected', null);
    perform pg_temp.step('reject branch: a reject without a reason is refused', false, 'accepted');
  exception when others then
    perform pg_temp.step('reject branch: a reject without a reason is refused', sqlstate = '22023', sqlerrm);
  end;
  perform pg_temp.step('reject branch: admin list shows rejected and excludes it from assignable',
    (select r.row_data ->> 'verification_status' from public.list_educators(p_size => 100) r where (r.row_data ->> 'id')::uuid = pg_temp.id('edu2')) = 'rejected'
    and not exists (select 1 from public.list_assignable_educators(p_size => 200) r where (r.row_data ->> 'id')::uuid = pg_temp.id('edu2')), null);
end $$;
set local role authenticated;
do $$
declare v jsonb;
begin
  perform pg_temp.act('edu2');
  begin
    v := public.educator_get_status();
    perform pg_temp.step('reject branch: educator sees rejected with the reason, can edit',
                         v ->> 'status' = 'rejected' and v ->> 'note' = 'The ID picture is unreadable.' and (v ->> 'can_edit')::boolean, v::text);
    v := public.educator_submit_onboarding();
    perform pg_temp.step('reject branch: resubmits, pending again', v ->> 'status' = 'pending', v ->> 'status');
  exception when others then perform pg_temp.step('reject branch: educator', false, sqlerrm); end;
end $$;

-- ===================================================== request-changes branch
do $$
declare v text;
begin
  perform pg_temp.act('edu3');
  begin
    v := pg_temp.onboard('edu3');
    perform pg_temp.step('changes branch: educator 3 submits', v = 'pending', 'status ' || v);
  exception when others then perform pg_temp.step('changes branch: onboarding', false, sqlerrm); end;
end $$;
reset role;
do $$
begin
  perform pg_temp.act('admin');
  begin
    perform public.set_educator_verification(pg_temp.id('edu3'), 'changes_requested', 'Add your B.Ed details.');
    perform pg_temp.step('changes branch: admin requests changes',
      (select r.row_data ->> 'verification_status' from public.list_educators(p_size => 100) r where (r.row_data ->> 'id')::uuid = pg_temp.id('edu3')) = 'changes_requested', null);
  exception when others then perform pg_temp.step('changes branch: request changes', false, sqlerrm); end;
end $$;
set local role authenticated;
do $$
declare v jsonb;
begin
  perform pg_temp.act('edu3');
  begin
    v := public.educator_get_status();
    perform pg_temp.step('changes branch: educator sees changes_requested with the note, can edit',
                         v ->> 'status' = 'changes_requested' and v ->> 'note' = 'Add your B.Ed details.' and (v ->> 'can_edit')::boolean, v::text);
    perform public.educator_save_onboarding_step(2, '{"qualifications":"MSc Mathematics, B.Ed","experience_years":6}');
    v := public.educator_submit_onboarding();
    perform pg_temp.step('changes branch: edits and resubmits, pending again', v ->> 'status' = 'pending', v ->> 'status');
  exception when others then perform pg_temp.step('changes branch: educator', false, sqlerrm); end;
end $$;
reset role;

-- ===================================================== suspension
do $$
begin
  perform pg_temp.act('admin');
  begin
    perform public.set_educator_account_status(pg_temp.id('edu'), 'suspended', 'Flow test');
    perform pg_temp.step('suspend: admin suspends the approved educator; not assignable any more',
      not exists (select 1 from public.list_assignable_educators(p_size => 200) r where (r.row_data ->> 'id')::uuid = pg_temp.id('edu'))
      and (select r.row_data ->> 'effective_state' from public.list_educators(p_size => 100) r where (r.row_data ->> 'id')::uuid = pg_temp.id('edu')) = 'suspended',
      null);
  exception when others then perform pg_temp.step('suspend', false, sqlerrm); end;
end $$;
set local role authenticated;
do $$
begin
  perform pg_temp.act('edu');
  perform pg_temp.step('suspend: educator sees suspended and is not verified',
                       public.educator_get_status() ->> 'status' = 'suspended' and not public.adm_is_verified_educator(), null);
end $$;
reset role;

select n as "#", step, ok, detail from pg_temp.flow_steps order by n;
rollback;
