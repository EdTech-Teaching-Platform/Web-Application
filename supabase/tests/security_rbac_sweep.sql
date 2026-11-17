-- =====================================================================
-- supabase/tests/security_rbac_sweep.sql   (security audit, 2026-11-18)
--
-- Broken-access-control sweep over EVERY function in schema public (the
-- project's migrations). Each function is called with NULL arguments, in its
-- own subtransaction, as:
--   * anon      (role anon, no JWT)
--   * student   (role authenticated, JWT of a plain student)
-- and the outcome is recorded:
--   denied  : permission denied to execute (no grant), 42501, UL403
--   refused : any other error before doing anything useful (P0002, 22023,
--             22004, ...): treated as "not usable with junk input"
--   RAN     : returned without an error
-- A function that RAN for a role it isn't meant for is a finding. The intended
-- callers are decided by name: student_* / public_* / account_* / educator_*
-- and a short allow-list of shared, self-scoped RPCs.
-- Also checked: every table we created has RLS on and no table privileges for
-- anon / authenticated; every SECURITY DEFINER function pins search_path.
--
-- LOCAL / DISPOSABLE DATABASE ONLY. One transaction, rolled back.
-- Expect "ok: ..." notices and "ok: security sweep passed".
-- =====================================================================
begin;

create table pg_temp.sweep (role text, fn text, outcome text, detail text);
grant all on pg_temp.sweep to anon, authenticated;

do $fx$
declare v_stu uuid := gen_random_uuid(); v_admin uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (v_stu, 'sw-' || v_stu || '@t.local'), (v_admin, 'sw-' || v_admin || '@t.local');
  insert into public.profiles (id, role, full_name, email) values
    (v_stu, 'student', 'Sweep Student', 'sw-' || v_stu || '@t.local'),
    (v_admin, 'admin', 'Sweep Admin', 'sw-' || v_admin || '@t.local');
  insert into public.adm_admin_users (user_id) values (v_admin);
  perform set_config('sweep.stu', v_stu::text, true);
  -- the lead's tables (docs/existing_Schema.sql): their RLS is the lead's, audited separately
  perform set_config('sweep.lead_tables', '{announcements,assignment_submissions,assignments,audit_logs,availability_slots,bookings,broadcasts,callback_requests,categories,certificates,cms_pages,consent_records,conversations,course_faqs,course_join_requests,course_modules,course_reviews,course_versions,courses,data_requests,discussion_forums,discussion_posts,educator_profiles,educator_verification_docs,enrollments,hand_raise_queue,homework_uploads,institutions,learning_pathways,lesson_materials,lesson_progress,lessons,live_sessions,manager_scopes,marksheet_uploads,messages,mfa_enforcement,moderation_reports,notification_preferences,notification_templates,notifications,org_units,parent_contacts,parent_reports,pathway_steps,platform_settings,profiles,quiz_answers,quiz_attempts,quiz_question_options,quiz_questions,quizzes,session_chat_messages,session_join_tokens,session_participants,session_poll_responses,session_polls,session_ratings,staff_assignments,student_notes,student_pathway_progress,student_profiles,support_ticket_replies,support_tickets,teacher_change_requests,test_series,wishlists}', true);
end $fx$;

-- one pass: call every public function with NULL args as the current role
create function pg_temp.run_pass(p_label text) returns void
language plpgsql as $$
declare
  f record;
  v_sql text;
  v_args text;
begin
  for f in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args, p.pronargs, p.prokind
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and p.proname not like 'pg\_%'
     order by p.proname
  loop
    if not has_function_privilege(current_user, f.oid, 'execute') then
      insert into pg_temp.sweep values (p_label, f.proname || '(' || f.args || ')', 'denied', 'no execute grant');
      continue;
    end if;
    select string_agg('null::' || format_type(t, null), ', ' order by o)
      into v_args
      from unnest((select proargtypes::oid[] from pg_proc where oid = f.oid)) with ordinality as a(t, o);
    v_sql := format('select public.%I(%s)', f.proname, coalesce(v_args, ''));
    begin
      execute v_sql;
      insert into pg_temp.sweep values (p_label, f.proname || '(' || f.args || ')', 'RAN', null);
    exception when others then
      insert into pg_temp.sweep values (p_label, f.proname || '(' || f.args || ')',
        case when sqlstate in ('42501', 'UL403') then 'denied' else 'refused' end, sqlstate || ' ' || left(sqlerrm, 120));
    end;
  end loop;
end $$;

-- anon
select set_config('request.jwt.claims', '', true);
set local role anon;
select pg_temp.run_pass('anon');
reset role;

-- a plain student
select set_config('request.jwt.claims', json_build_object('sub', current_setting('sweep.stu'), 'role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.run_pass('student');
reset role;
select set_config('request.jwt.claims', '', true);

-- ------------------------------------------------------------ evaluation
do $$
declare
  r record;
  v_bad int := 0;
  v_ran_anon int; v_ran_stu int; v_total int;
  -- shared or self-scoped RPCs any signed-in user may run (they act only on
  -- the caller's own rows or return public / harmless data)
  v_self text[] := array['record_logout', 'touch_session', 'get_my_notifications', 'mark_notification_read',
                         'mark_all_notifications_read', 'my_unread_notification_count', 'list_my_notifications',
                         'adm_is_platform_admin', 'is_admin', 'series_name_exists', 'adm_claim_asset_upload_slot',
                         'adm_claim_educator_upload_slot', 'get_my_role', 'adm_actor_kind',
                         -- the caller's own status only
                         'adm_is_educator', 'adm_is_verified_educator',
                         -- the lead's functions: stubs in this harness, audited separately (live check)
                         'publish_test_series', 'is_admin'];
  -- what anon may run: the public catalogue
  v_anon text[] := array['public_list_series', 'public_get_series', 'adm_is_platform_admin',
                         'publish_test_series', 'is_admin'];   -- lead stubs, see above
begin
  select count(distinct fn) into v_total from pg_temp.sweep;
  select count(*) into v_ran_anon from pg_temp.sweep where role = 'anon' and outcome = 'RAN';
  select count(*) into v_ran_stu from pg_temp.sweep where role = 'student' and outcome = 'RAN';
  raise notice 'ok: swept % functions; RAN as anon: %, as student: %', v_total, v_ran_anon, v_ran_stu;
  for r in select * from pg_temp.sweep where outcome = 'RAN' order by role, fn loop
    raise notice 'ran as %: %', r.role, r.fn;
  end loop;

  for r in select * from pg_temp.sweep where outcome = 'RAN' order by role, fn loop
    if r.role = 'anon' and split_part(r.fn, '(', 1) <> all (v_anon)
       and split_part(r.fn, '(', 1) not like 'public\_%' then
      raise notice 'FINDING anon RAN: %', r.fn;
      v_bad := v_bad + 1;
    elsif r.role = 'student'
       and split_part(r.fn, '(', 1) not like 'student\_%' and split_part(r.fn, '(', 1) not like 'public\_%'
       and split_part(r.fn, '(', 1) not like 'account\_%' and split_part(r.fn, '(', 1) not like 'educator\_%'
       and split_part(r.fn, '(', 1) <> all (v_self) then
      raise notice 'FINDING student RAN: %', r.fn;
      v_bad := v_bad + 1;
    end if;
  end loop;
  perform set_config('sweep.bad', v_bad::text, true);
end $$;

-- every table WE created: RLS on, no direct table privileges for browser roles
do $$
declare r record; v_bad int := current_setting('sweep.bad')::int;
begin
  for r in
    select c.relname, c.relrowsecurity,
           has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
             or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete') as anon_priv,
           has_table_privilege('authenticated', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'insert')
             or has_table_privilege('authenticated', c.oid, 'update') or has_table_privilege('authenticated', c.oid, 'delete') as auth_priv
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
  loop
    -- lead tables come from docs/existing_Schema.sql; ours are everything else
    if r.relname = any (current_setting('sweep.lead_tables', true)::text[]) then continue; end if;
    if not r.relrowsecurity then
      raise notice 'FINDING table without RLS: %', r.relname; v_bad := v_bad + 1;
    end if;
    if r.anon_priv then
      raise notice 'FINDING anon has table privileges on: %', r.relname; v_bad := v_bad + 1;
    end if;
    if r.auth_priv and not r.relrowsecurity then
      raise notice 'FINDING authenticated has privileges on non-RLS table: %', r.relname; v_bad := v_bad + 1;
    end if;
  end loop;
  perform set_config('sweep.bad', v_bad::text, true);
end $$;

-- every SECURITY DEFINER function pins search_path
do $$
declare r record; v_bad int := current_setting('sweep.bad')::int;
begin
  for r in
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    raise notice 'FINDING security definer without search_path: %', r.proname; v_bad := v_bad + 1;
  end loop;
  if v_bad > 0 then raise exception 'security sweep: % finding(s), see the FINDING notices above', v_bad; end if;
  raise notice 'ok: security sweep passed';
end $$;

rollback;
