-- =====================================================================
-- supabase/tests/educator_onboarding.sql
--
-- Smoke tests for 20261028090100_educator_onboarding.sql and
-- 20261028090200_educator_admin_review.sql.
-- LOCAL / DISPOSABLE DATABASE ONLY (inserts fixtures into auth.users,
-- storage and lead tables). One transaction, rolled back.
--
-- Also the ENFORCEMENT check: every educator_* function that is not one of
-- the seven onboarding RPCs must refuse a pending educator (42501) and start
-- with adm_require_verified_educator(); every educator_* function refuses a
-- student (42501).
--
-- Expect "ok: ..." notices and "ok: all educator onboarding checks passed".
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

-- The DETAIL (field errors) of a call that must fail with 22023.
create function pg_temp.field_errors(p_sql text) returns jsonb
language plpgsql as $$
declare v_detail text;
begin
  begin
    execute p_sql;
  exception when sqlstate '22023' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return coalesce(nullif(v_detail, ''), '{}')::jsonb;
  end;
  raise exception 'expected 22023 but the call succeeded: %', p_sql;
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

create function pg_temp.uid(p_key text) returns uuid
language sql as $$ select current_setting('test.' || p_key)::uuid $$;

-- The onboarding RPCs any educator may call; every other educator_* is verified-only.
create function pg_temp.onboarding_rpcs() returns text[]
language sql as $$
  select array['educator_start_onboarding', 'educator_save_onboarding_step', 'educator_register_document',
               'educator_remove_document', 'educator_submit_onboarding', 'educator_get_status', 'educator_get_onboarding'];
$$;

do $fx$
declare
  v_admin uuid := gen_random_uuid();
  v_edu   uuid := gen_random_uuid();
  v_stu   uuid := gen_random_uuid();
  v_pend  uuid := gen_random_uuid();
  v_ver   uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values
    (v_admin, 'eo-admin-' || v_admin || '@test.local'), (v_edu, 'EO-Edu-' || v_edu || '@Test.local'),
    (v_stu, 'eo-stu-' || v_stu || '@test.local'), (v_pend, 'eo-pend-' || v_pend || '@test.local'),
    (v_ver, 'eo-ver-' || v_ver || '@test.local');
  insert into public.profiles (id, role, full_name, email) values
    (v_admin, 'admin', 'EO Admin', 'eo-admin-' || v_admin || '@test.local'),
    (v_stu, 'student', 'EO Student', 'eo-stu-' || v_stu || '@test.local'),
    (v_ver, 'educator', 'EO Verified', 'eo-ver-' || v_ver || '@test.local');
  insert into public.adm_admin_users (user_id) values (v_admin);
  insert into public.educator_profiles (user_id, full_name, phone, location, verification_status)
  values (v_ver, 'EO Verified', '9999999999', 'Pune', 'verified');
  -- verified before review states existed: approved the way 20261029090000 backfills it
  perform public.adm_backfill_educator_approvals();

  insert into storage.buckets (id, name) values ('educator-verification-docs', 'educator-verification-docs') on conflict do nothing;
  insert into storage.objects (bucket_id, name) values
    ('educator-verification-docs', v_edu || '/government_id-front-1.jpg'),
    ('educator-verification-docs', v_edu || '/government_id-front-2.jpg'),
    ('educator-verification-docs', v_edu || '/government_id-back-1.jpg'),
    ('educator-verification-docs', v_edu || '/other-selfie-1.jpg'),
    ('educator-verification-docs', v_stu || '/government_id-front-1.jpg');
  insert into storage.objects (bucket_id, name, metadata) values
    ('educator-verification-docs', v_edu || '/government_id-front-big.jpg', '{"size": 6000000, "mimetype": "image/jpeg"}'),
    ('educator-verification-docs', v_edu || '/government_id-front-doc.pdf', '{"size": 1000, "mimetype": "application/pdf"}'),
    ('educator-verification-docs', v_edu || '/degree_certificate-bsc-1.pdf', '{"size": 1000, "mimetype": "application/pdf"}');

  perform set_config('test.admin', v_admin::text, true);
  perform set_config('test.edu', v_edu::text, true);
  perform set_config('test.stu', v_stu::text, true);
  perform set_config('test.pend', v_pend::text, true);
  perform set_config('test.ver', v_ver::text, true);
end $fx$;

-- ------------------------------------------------------------- start
do $$
declare
  e uuid := pg_temp.uid('edu');
  v jsonb;
begin
  perform pg_temp.act_as(e);
  v := public.educator_start_onboarding('  Asha Rao ', '+91 98765 43210');
  perform pg_temp.ok(v ->> 'status' = 'draft' and (v ->> 'can_edit')::boolean and not (v ->> 'profile_complete')::boolean,
                     'start: status draft, editable, incomplete');
  perform pg_temp.ok((select role = 'educator' and full_name = 'Asha Rao' and email = lower('EO-Edu-' || e || '@Test.local')
                        from public.profiles where id = e), 'start: profile created with role educator, email from auth.users');
  perform pg_temp.ok((select verification_status = 'pending' and location = 'Not provided' and phone = '+91 98765 43210'
                        from public.educator_profiles where user_id = e), 'start: educator_profiles pending, location placeholder');
  perform pg_temp.ok((select review_state = 'draft' and onboarded_via = 'self' from public.educator_admin_state where user_id = e),
                     'start: review_state draft');
  v := public.educator_start_onboarding('Someone Else', null);
  perform pg_temp.ok(v ->> 'status' = 'draft' and (select full_name from public.profiles where id = e) = 'Asha Rao',
                     'start: idempotent, changes nothing');

  perform pg_temp.act_as(pg_temp.uid('stu'));
  perform pg_temp.expect_error('select public.educator_start_onboarding(''Stu'', null)', '42501', 'registered as student');
  perform pg_temp.ok((select role from public.profiles where id = pg_temp.uid('stu')) = 'student', 'start: a student keeps the student role');

  perform pg_temp.act_as(pg_temp.uid('admin'));
  perform pg_temp.ok(not exists (select 1 from public.list_educators(p_verification => 'pending', p_size => 100) r
                                  where (r.row_data ->> 'id')::uuid = e)
                     and exists (select 1 from public.list_educators(p_verification => 'draft', p_size => 100) r
                                  where (r.row_data ->> 'id')::uuid = e),
                     'admin: a draft is not in the pending queue (listed under draft)');
end $$;

-- ------------------------------------------------------------- steps
do $$
declare
  e uuid := pg_temp.uid('edu');
  errs jsonb;
  v jsonb;
begin
  perform pg_temp.act_as(e);
  errs := pg_temp.field_errors('select public.educator_save_onboarding_step(1, ''{"full_name":"A","phone":"12","location":""}'')');
  perform pg_temp.ok(errs ?& array['full_name', 'phone', 'location'], 'step 1: field errors for name, phone, location');
  errs := pg_temp.field_errors('select public.educator_save_onboarding_step(2, ''{"qualifications":"MSc","experience_years":61}'')');
  perform pg_temp.ok(errs ? 'experience_years' and not errs ? 'qualifications', 'step 2: experience 0..60');
  errs := pg_temp.field_errors('select public.educator_save_onboarding_step(3, ''{"subjects":[],"languages":["English"],"bio":"short"}'')');
  perform pg_temp.ok(errs ?& array['subjects', 'bio'] and not errs ? 'languages', 'step 3: subjects required, bio length');
  perform pg_temp.expect_error('select public.educator_save_onboarding_step(9, ''{}'')', '22023');

  perform public.educator_save_onboarding_step(1, '{"full_name":" Asha  Rao ","phone":"+91 98765 43210","location":"Pune","role":"admin"}');
  perform public.educator_save_onboarding_step(2, '{"qualifications":"MSc Physics","experience_years":"7"}');
  v := public.educator_save_onboarding_step(3, jsonb_build_object('subjects', jsonb_build_array('Physics', ' Physics', 'Maths'),
          'languages', jsonb_build_array('English', 'Hindi'), 'bio', repeat('I teach physics. ', 4)));
  perform pg_temp.ok(v -> 'data' ->> 'location' = 'Pune' and v -> 'data' -> 'experience_years' = '7'
                     and v -> 'data' -> 'subjects' = '["Physics","Maths"]' and not (v -> 'data') ? 'role' and v ->> 'step' = '3',
                     'steps: saved, trimmed, de-duplicated, unknown keys dropped, step 3');
  perform pg_temp.ok((select verification_status from public.educator_profiles where user_id = e) = 'pending'
                     and (select location from public.educator_profiles where user_id = e) = 'Not provided',
                     'steps: drafts do not touch educator_profiles');
end $$;

-- --------------------------------------------------------- documents, submit
do $$
declare
  e uuid := pg_temp.uid('edu');
  d jsonb;
  errs jsonb;
  v jsonb;
begin
  perform pg_temp.act_as(e);
  perform pg_temp.expect_error(format('select public.educator_register_document(''government_id'', %L, ''front'')',
                                      pg_temp.uid('stu') || '/government_id-front-1.jpg'), '42501', 'your own folder');
  perform pg_temp.expect_error(format('select public.educator_register_document(''government_id'', %L, ''front'')',
                                      e || '/../x.jpg'), '42501');
  perform pg_temp.expect_error(format('select public.educator_register_document(''government_id'', %L, ''front'')',
                                      e || '/missing.jpg'), 'P0002');
  perform pg_temp.expect_error(format('select public.educator_register_document(''government_id'', %L, ''side'')',
                                      e || '/government_id-front-1.jpg'), '22023');
  perform pg_temp.expect_error(format('select public.educator_register_document(''passport'', %L, ''front'')',
                                      e || '/government_id-front-1.jpg'), '22023');

  perform pg_temp.expect_error(format('select public.educator_register_document(''government_id'', %L, ''front'')',
                                      e || '/government_id-front-big.jpg'), '22023', 'larger than 5 MB');
  perform pg_temp.expect_error(format('select public.educator_register_document(''government_id'', %L, ''front'')',
                                      e || '/government_id-front-doc.pdf'), '22023', 'not allowed');
  d := public.educator_register_document('degree_certificate', e || '/degree_certificate-bsc-1.pdf', 'BSc degree');
  perform pg_temp.ok(d ->> 'doc_name' = 'BSc degree', 'documents: a PDF certificate under 5 MB is accepted');
  d := public.educator_register_document('government_id', e || '/government_id-front-1.jpg', 'FRONT');
  perform pg_temp.ok(d ->> 'doc_name' = 'front' and d ->> 'status' = 'pending' and d ->> 'path' = e || '/government_id-front-1.jpg',
                     'documents: front registered with the storage path as doc_url');
  perform public.educator_register_document('other', e || '/other-selfie-1.jpg', 'Selfie');

  errs := pg_temp.field_errors('select public.educator_submit_onboarding()');
  perform pg_temp.ok(errs ? 'documents' and not errs ? 'bio', 'submit: refused without the back of the ID');

  d := public.educator_register_document('government_id', e || '/government_id-front-2.jpg', 'front');
  perform pg_temp.ok((select count(*) from public.educator_verification_docs where educator_id = e and doc_type = 'government_id'
                        and doc_name = 'front') = 1
                     and (select doc_url from public.educator_verification_docs where id = (d ->> 'id')::uuid) = e || '/government_id-front-2.jpg',
                     'documents: uploading again replaces the row');
  perform public.educator_register_document('government_id', e || '/government_id-back-1.jpg', 'back');

  v := public.educator_submit_onboarding();
  perform pg_temp.ok(v ->> 'status' = 'pending' and not (v ->> 'can_edit')::boolean and (v ->> 'profile_complete')::boolean
                     and v ->> 'submitted_at' is not null, 'submit: pending, locked, complete, submitted_at');
  perform pg_temp.ok((select full_name = 'Asha  Rao' and location = 'Pune' and experience_years = 7 and qualifications = 'MSc Physics'
                             and subjects::text[] = array['Physics', 'Maths'] and verification_status = 'pending'
                        from public.educator_profiles where user_id = e), 'submit: final values written to educator_profiles');
  perform pg_temp.ok((select review_state from public.educator_admin_state where user_id = e) = 'submitted', 'submit: review_state submitted');
  perform pg_temp.ok(exists (select 1 from public.audit_logs where actor_id = e and action = 'educator.onboarding_submit'), 'submit: audited');

  perform pg_temp.expect_error('select public.educator_save_onboarding_step(1, ''{"full_name":"X Y","phone":"9999999","location":"Goa"}'')', '42501');
  perform pg_temp.expect_error(format('select public.educator_register_document(''government_id'', %L, ''back'')',
                                      e || '/government_id-back-1.jpg'), '42501');
  perform pg_temp.expect_error('select public.educator_submit_onboarding()', '22023');
  perform pg_temp.ok((public.educator_get_onboarding() -> 'documents') @> '[{"doc_name":"selfie","doc_type":"other"}]',
                     'get_onboarding: documents listed (no signed URLs)');
end $$;

-- ------------------------------------------------------------- admin review
do $$
declare
  e uuid := pg_temp.uid('edu');
  v jsonb;
begin
  perform pg_temp.act_as(pg_temp.uid('admin'));
  v := (select r.row_data from public.list_educators(p_verification => 'pending', p_size => 100) r where (r.row_data ->> 'id')::uuid = e);
  perform pg_temp.ok(v ->> 'verification_status' = 'pending' and v ->> 'location' = 'Pune' and v ->> 'bio' like 'I teach%'
                     and v -> 'subjects' = '["Physics","Maths"]', 'admin: submitted educator in the pending queue with their fields');
  v := public.get_educator_detail(e);
  perform pg_temp.ok(jsonb_array_length(v -> 'documents') = 4 and v -> 'educator' ->> 'review_state' = 'submitted'
                     and v -> 'educator' ->> 'submitted_at' is not null, 'admin: detail has documents and submission');

  perform public.set_educator_verification(e, 'changes_requested', 'Upload a clearer ID back.');
  perform pg_temp.act_as(e);
  v := public.educator_get_status();
  perform pg_temp.ok(v ->> 'status' = 'changes_requested' and v ->> 'note' = 'Upload a clearer ID back.' and (v ->> 'can_edit')::boolean,
                     'changes requested: note shown, editable');
  perform pg_temp.ok(public.educator_submit_onboarding() ->> 'status' = 'pending', 'changes requested: resubmitted');

  perform pg_temp.act_as(pg_temp.uid('admin'));
  perform pg_temp.expect_error(format('select public.set_educator_verification(%L, ''rejected'', null)', e), '22023');
  perform public.set_educator_verification(e, 'rejected', 'ID does not match the name.');
  perform pg_temp.ok((select verification_status = 'rejected' and rejected_reason = 'ID does not match the name.'
                        from public.educator_profiles where user_id = e)
                     and (select review_state from public.educator_admin_state where user_id = e) = 'rejected',
                     'reject: lead rejected with the reason, review_state rejected');
  perform pg_temp.act_as(e);
  v := public.educator_get_status();
  perform pg_temp.ok(v ->> 'status' = 'rejected' and v ->> 'note' = 'ID does not match the name.' and (v ->> 'can_edit')::boolean,
                     'reject: reason shown, resubmission allowed');
  perform pg_temp.ok(public.educator_submit_onboarding() ->> 'status' = 'pending', 'reject: resubmitted, pending again');
  perform pg_temp.ok(not public.adm_is_verified_educator(), 'pending educator is not verified');

  perform pg_temp.act_as(pg_temp.uid('admin'));
  perform public.set_educator_verification(e, 'approved', null);
  perform pg_temp.ok((select verification_status = 'verified' and verified_by = pg_temp.uid('admin') and verified_at is not null
                             and rejected_reason is null from public.educator_profiles where user_id = e)
                     and (select review_state from public.educator_admin_state where user_id = e) = 'approved',
                     'approve: verified, verified_by / verified_at, review_state approved');
  perform pg_temp.ok((select count(*) from public.notifications where user_id = e and category = 'verification'
                        and reference_type = 'educator_verification') = 3, 'notifications: one per decision (3)');
  perform pg_temp.act_as(e);
  perform pg_temp.ok(public.educator_get_status() ->> 'status' = 'verified' and public.adm_is_verified_educator(),
                     'approve: educator sees verified');

  -- in_app = false skips the notice, the decision still applies
  insert into public.notification_preferences (user_id, category, in_app) values (e, 'verification', false);
  perform pg_temp.act_as(pg_temp.uid('admin'));
  perform public.set_educator_verification(e, 'changes_requested', 'Add a selfie.');
  perform pg_temp.ok((select count(*) from public.notifications where user_id = e and category = 'verification') = 3
                     and (select review_state from public.educator_admin_state where user_id = e) = 'changes_requested',
                     'notifications: preference in_app off skips the notice only');
  perform public.set_educator_verification(e, 'verified', null);

  -- suspended
  update public.educator_admin_state set account_status = 'suspended', status_reason = 'Policy review' where user_id = e;
  perform pg_temp.act_as(e);
  v := public.educator_get_status();
  perform pg_temp.ok(v ->> 'status' = 'suspended' and v ->> 'note' = 'Policy review' and not public.adm_is_verified_educator(),
                     'suspended: status suspended, not verified');
  update public.educator_admin_state set account_status = 'active', status_reason = null where user_id = e;
end $$;

-- --------------------------------------------------------------- enforcement
do $$
declare
  f      record;
  v_args text;
  n      int := 0;
begin
  -- a pending educator
  perform pg_temp.act_as(pg_temp.uid('pend'));
  perform public.educator_start_onboarding('Pending Person', null);
  perform pg_temp.ok(not public.adm_is_verified_educator(), 'enforcement: fixture educator is not verified');

  for f in
    select p.oid, p.proname, p.pronargs, p.prosrc
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname like 'educator\_%' and p.proname <> all (pg_temp.onboarding_rpcs())
  loop
    n := n + 1;
    if position('adm_require_verified_educator()' in left(regexp_replace(f.prosrc, '^\s*(declare[\s\S]*?)?begin', '', 'i'), 200)) = 0 then
      raise exception 'FAILED: % does not start with adm_require_verified_educator()', f.proname;
    end if;
    select string_agg('null', ', ') into v_args from generate_series(1, f.pronargs);
    perform pg_temp.expect_error(format('select public.%I(%s)', f.proname, coalesce(v_args, '')), '42501');
  end loop;
  perform pg_temp.ok(true, format('enforcement: %s verified-only educator_* function(s) refuse a pending educator', n));

  -- a student can call none of the educator_* functions
  perform pg_temp.act_as(pg_temp.uid('stu'));
  n := 0;
  for f in
    select p.proname, p.pronargs from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname like 'educator\_%'
  loop
    n := n + 1;
    select string_agg(case when f.proname = 'educator_start_onboarding' then '''Stu Dent''' else 'null' end, ', ')
      into v_args from generate_series(1, f.pronargs);
    perform pg_temp.expect_error(format('select public.%I(%s)', f.proname, coalesce(v_args, '')), '42501');
  end loop;
  perform pg_temp.ok(n >= 7, format('enforcement: a student is refused by all %s educator_* functions', n));
end $$;

-- ------------------------------------------------------ upload rate limit
do $$
declare
  v jsonb;
  i int;
begin
  perform pg_temp.act_as(pg_temp.uid('pend'));
  for i in 1..20 loop
    v := public.adm_claim_educator_upload_slot('government_id', 20);
  end loop;
  perform pg_temp.ok((v ->> 'allowed')::boolean and (v ->> 'remaining')::int = 0, 'upload limit: 20 claims allowed');
  v := public.adm_claim_educator_upload_slot('government_id', 20);
  perform pg_temp.ok(not (v ->> 'allowed')::boolean and (v ->> 'retry_after_seconds')::int between 1 and 3600,
                     'upload limit: the 21st in an hour is refused with a retry time');
  perform pg_temp.act_as(pg_temp.uid('stu'));
  perform pg_temp.expect_error('select public.adm_claim_educator_upload_slot(''other'')', '42501', 'Educators only');
end $$;

-- ---------------------------------------------------------------- grants
do $$
begin
  perform pg_temp.ok(not has_function_privilege('anon', 'public.educator_get_status()', 'execute')
                     and not has_function_privilege('anon', 'public.educator_start_onboarding(text,text)', 'execute')
                     and has_function_privilege('authenticated', 'public.educator_submit_onboarding()', 'execute'),
                     'grants: educator RPCs for authenticated only');
  perform pg_temp.ok(not has_function_privilege('authenticated', 'public.adm_require_verified_educator()', 'execute')
                     and not has_function_privilege('authenticated', 'public.adm_educator_status_json(uuid)', 'execute')
                     and not has_function_privilege('authenticated', 'public.adm_notify_educator_verification(uuid,text,text)', 'execute')
                     and not has_table_privilege('authenticated', 'public.educator_onboarding', 'select'),
                     'grants: internal helpers and the draft table are not exposed');
end $$;

set local role authenticated;
do $$
begin
  perform pg_temp.act_as(pg_temp.uid('ver'));
  perform pg_temp.ok(public.educator_get_status() ->> 'status' = 'verified' and public.adm_is_verified_educator(),
                     'authenticated role: a verified educator reads their status');
end $$;
reset role;

do $$ begin raise notice 'ok: all educator onboarding checks passed'; end $$;
rollback;
