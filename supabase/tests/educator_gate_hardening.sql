-- =====================================================================
-- supabase/tests/educator_gate_hardening.sql
--
-- Smoke tests for 20261029090000_educator_gate_hardening.sql.
-- LOCAL / DISPOSABLE DATABASE ONLY (fixtures in auth.users and lead tables).
-- One transaction, rolled back.
--
--   * a pending educator who sets their own educator_profiles.verification_status
--     to 'verified' (the lead's RLS allows that) is still refused by EVERY
--     verified-only educator_* function and by the shared series RPCs, sees
--     'pending' at the gate, is not "verified" in the admin list and can't
--     receive assignments;
--   * approving through set_educator_verification gives access;
--   * an educator verified before review states existed keeps access after the
--     backfill (row missing, or review_state null); an onboarding row with a
--     self-set verified value is not approved by the backfill;
--   * suspended educators are refused.
--
-- Expect "ok: ..." notices and "ok: all gate hardening checks passed".
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

create function pg_temp.uid(p_key text) returns uuid
language sql as $$ select current_setting('test.' || p_key)::uuid $$;

-- Calls every verified-only educator_* function (all except the onboarding
-- ones) with null arguments, plus shared series RPCs; each must raise 42501.
create function pg_temp.refused_everywhere() returns int
language plpgsql as $$
declare
  f      record;
  v_args text;
  n      int := 0;
begin
  for f in
    select p.proname, p.pronargs from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname like 'educator\_%'
       and p.proname <> all (array['educator_start_onboarding', 'educator_save_onboarding_step', 'educator_register_document',
                                   'educator_remove_document', 'educator_submit_onboarding', 'educator_get_status', 'educator_get_onboarding'])
  loop
    select string_agg('null', ', ') into v_args from generate_series(1, f.pronargs);
    perform pg_temp.expect_error(format('select public.%I(%s)', f.proname, coalesce(v_args, '')), '42501');
    n := n + 1;
  end loop;
  perform pg_temp.expect_error('select * from public.list_test_series()', '42501');
  perform pg_temp.expect_error('select public.upsert_test_series_full(''{"name":"Sneaky series"}'')', '42501');
  perform pg_temp.expect_error('select public.series_name_exists(''x'')', '42501');
  return n;
end $$;

do $fx$
declare
  v_admin   uuid := gen_random_uuid();
  v_tamper  uuid := gen_random_uuid();
  v_legacy  uuid := gen_random_uuid();
  v_legacy2 uuid := gen_random_uuid();
  v_onb     uuid := gen_random_uuid();
  u         uuid;
begin
  foreach u in array array[v_admin, v_tamper, v_legacy, v_legacy2, v_onb] loop
    insert into auth.users (id, email) values (u, 'gh-' || u || '@test.local');
  end loop;
  insert into public.profiles (id, role, full_name, email) values
    (v_admin, 'admin', 'GH Admin', 'gh-' || v_admin || '@test.local'),
    (v_legacy, 'educator', 'Legacy One', 'gh-' || v_legacy || '@test.local'),
    (v_legacy2, 'educator', 'Legacy Two', 'gh-' || v_legacy2 || '@test.local'),
    (v_onb, 'educator', 'Onboarding Person', 'gh-' || v_onb || '@test.local');
  insert into public.adm_admin_users (user_id) values (v_admin);
  -- verified before review states existed: one without a state row, one with review_state null
  insert into public.educator_profiles (user_id, full_name, phone, location, verification_status) values
    (v_legacy, 'Legacy One', '9000000011', 'Pune', 'verified'),
    (v_legacy2, 'Legacy Two', '9000000012', 'Goa', 'verified'),
    (v_onb, 'Onboarding Person', '9000000013', 'Agra', 'verified');   -- self-set while submitted
  insert into public.educator_admin_state (user_id, review_state) values (v_legacy2, null), (v_onb, 'submitted');

  perform set_config('test.admin', v_admin::text, true);
  perform set_config('test.tamper', v_tamper::text, true);
  perform set_config('test.legacy', v_legacy::text, true);
  perform set_config('test.legacy2', v_legacy2::text, true);
  perform set_config('test.onb', v_onb::text, true);
end $fx$;

-- -------------------------------------------------- tampering is not enough
do $$
declare
  t uuid := pg_temp.uid('tamper');
  n int;
begin
  -- a self-registered educator who submitted their application
  perform pg_temp.act_as(t);
  perform public.educator_start_onboarding('Tamper Tester', '+91 90000 00099');
  update public.educator_admin_state set review_state = 'submitted', submitted_at = now() where user_id = t;
  perform pg_temp.ok(public.educator_get_status() ->> 'status' = 'pending', 'baseline: a submitted educator is pending');
end $$;

-- as the browser role: the lead's RLS lets an educator update their own row
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.tamper'), 'role', 'authenticated')::text, true);
set local role authenticated;
update public.educator_profiles set verification_status = 'verified', verified_at = now()
 where user_id = current_setting('test.tamper')::uuid;
reset role;

do $$
declare
  t uuid := pg_temp.uid('tamper');
  v jsonb;
  n int;
begin
  perform pg_temp.ok((select verification_status from public.educator_profiles where user_id = t) = 'verified',
                     'tamper: the lead value now says verified');
  perform pg_temp.act_as(t);
  perform pg_temp.ok(not public.adm_is_verified_educator(), 'tamper: adm_is_verified_educator() is still false');
  n := pg_temp.refused_everywhere();
  perform pg_temp.ok(n >= 9, format('tamper: all %s verified-only educator_* functions and the shared series RPCs refuse', n));
  v := public.educator_get_status();
  perform pg_temp.ok(v ->> 'status' = 'pending' and not (v ->> 'can_edit')::boolean, 'tamper: the gate still shows pending, not editable');

  perform pg_temp.act_as(pg_temp.uid('admin'));
  perform pg_temp.ok((select r.row_data ->> 'verification_status' from public.list_educators(p_size => 100) r
                       where (r.row_data ->> 'id')::uuid = t) = 'pending', 'tamper: the admin list shows pending');
  perform pg_temp.ok(not exists (select 1 from public.adm_eligible_educators() e where e.id = t), 'tamper: not eligible for assignments');
  perform pg_temp.expect_error(format('select public.create_assignments(%L)', jsonb_build_object(
    'seriesMode', 'new', 'newSeriesName', 'GH series', 'subject', 'Maths', 'testName', 'T',
    'educatorIds', jsonb_build_array(t), 'deadline', current_date + 3)), '22023');

  -- flipping the lead value to 'rejected' does not reopen editing either
  update public.educator_profiles set verification_status = 'rejected' where user_id = t;
  perform pg_temp.act_as(t);
  perform pg_temp.ok(public.educator_get_status() ->> 'status' = 'pending', 'tamper: a self-set rejected does not make it editable');
  update public.educator_profiles set verification_status = 'verified' where user_id = t;
end $$;

-- ------------------------------------------------ approval through the RPC
do $$
declare t uuid := pg_temp.uid('tamper');
begin
  perform pg_temp.act_as(pg_temp.uid('admin'));
  perform public.set_educator_verification(t, 'approved', null);
  perform pg_temp.ok((select review_state from public.educator_admin_state where user_id = t) = 'approved',
                     'approve: set_educator_verification writes review_state approved');
  perform pg_temp.act_as(t);
  perform pg_temp.ok(public.adm_is_verified_educator() and public.educator_get_status() ->> 'status' = 'verified',
                     'approve: access granted');
  perform pg_temp.ok(jsonb_typeof(public.educator_get_dashboard()) = 'object' and public.series_name_exists('nothing like it') = false,
                     'approve: verified-only and shared RPCs answer');

  -- suspended
  perform pg_temp.act_as(pg_temp.uid('admin'));
  perform public.set_educator_account_status(t, 'suspended', 'Policy review');
  perform pg_temp.act_as(t);
  perform pg_temp.ok(not public.adm_is_verified_educator() and public.educator_get_status() ->> 'status' = 'suspended',
                     'suspended: refused, gate shows suspended');
  perform pg_temp.ok(pg_temp.refused_everywhere() >= 9, 'suspended: every verified-only function refuses');
end $$;

-- ---------------------------------------------------------------- backfill
do $$
declare n int;
begin
  -- the fixtures were created after the migration ran: run the backfill again (idempotent)
  n := public.adm_backfill_educator_approvals();
  perform pg_temp.ok(n = 2, 'backfill: 2 legacy educators approved (missing row created, null review_state set)');
  perform pg_temp.ok(public.adm_backfill_educator_approvals() = 0, 'backfill: idempotent');
  perform pg_temp.ok((select review_state from public.educator_admin_state where user_id = pg_temp.uid('onb')) = 'submitted',
                     'backfill: a submitted educator with a self-set verified value is not approved');

  perform pg_temp.act_as(pg_temp.uid('legacy'));
  perform pg_temp.ok(public.adm_is_verified_educator() and public.educator_get_status() ->> 'status' = 'verified'
                     and jsonb_typeof(public.educator_get_stats()) = 'object', 'backfill: legacy educator (no state row) keeps access');
  perform pg_temp.act_as(pg_temp.uid('legacy2'));
  perform pg_temp.ok(public.adm_is_verified_educator(), 'backfill: legacy educator (null review_state) keeps access');
  perform pg_temp.act_as(pg_temp.uid('onb'));
  perform pg_temp.ok(not public.adm_is_verified_educator() and public.educator_get_status() ->> 'status' = 'pending',
                     'backfill: the submitted educator stays pending');
  perform pg_temp.act_as(pg_temp.uid('admin'));
  perform pg_temp.ok(exists (select 1 from public.adm_eligible_educators() e where e.id = pg_temp.uid('legacy')),
                     'backfill: legacy educator still eligible for assignments');
end $$;

-- ------------------------------------------------- nothing educator-writable
do $$
begin
  perform pg_temp.ok(not has_table_privilege('authenticated', 'public.educator_admin_state', 'update')
                     and not has_table_privilege('authenticated', 'public.educator_admin_state', 'insert')
                     and not has_function_privilege('authenticated', 'public.adm_backfill_educator_approvals()', 'execute')
                     and not has_function_privilege('authenticated', 'public.adm_educator_verified(uuid)', 'execute'),
                     'grants: educator_admin_state and the new helpers are not reachable from the browser');
end $$;

do $$ begin raise notice 'ok: all gate hardening checks passed'; end $$;
rollback;
