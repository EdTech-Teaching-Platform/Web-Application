-- =====================================================================
-- 20261118090000_admin_qa_nov18.sql
--
-- QA reports of 18 Nov, our objects only. Needs 20261111090000
-- (test_assignments.test_count, account_deletion_requests).
--
-- Delete account without admin approval
--   * account_deletion_requests (ours) gains self_service: true when the user
--     deleted the account themselves (status 'approved', decided_by = the user).
--   * adm_account_delete_self(p_user, p_reason): SERVICE ROLE ONLY. Called by
--     the delete-account Edge Function after it has re-checked the password
--     (or the typed DELETE for Google-only accounts). Students and educators
--     only, never admins. It records the deletion, closes any pending request,
--     blocks a student / suspends an educator (so every RPC refuses at once)
--     and ends their sessions. The Edge Function then soft-deletes the user in
--     Supabase Auth (they can't sign in again; the email is released). Rows in
--     the lead's tables are kept and anonymised by the retention job, not here.
--   * The old request RPCs stay (an admin can still see / decide older
--     pending requests); the frontend no longer sends new requests.
--
-- Number of tests in an assignment, for the educator
--   * assignment_tests (ours): which tests were built for which assignment.
--     Backfilled from test_assignments.test_id. FKs cascade (a deleted test
--     or assignment drops its link) and are indexed.
--   * adm_assignment_test_progress(p_id) -> {test_count, tests_created,
--     tests_published, tests_remaining, tests: [{id, title, status,
--     questions_count, position}]}.
--   * educator_list_assignments / adm_educator_assignment_json (educator_get_assignment)
--     return those numbers, so the educator sees "2 tests: 1 created, 1 to go".
--   * educator_start_assignment links the first test; with several tests it is
--     named "<name> - Test 1" and gets its share of the questions and marks.
--   * educator_add_assignment_test(p_assignment_id) (new): creates and links the
--     next test ("<name> - Test 2"), up to test_count.
--
-- Replaced (each edit marked "-- 20261118090000", the rest verbatim from the
-- file named above it): adm_account_deletion_json, adm_educator_assignment_json, educator_list_assignments,
-- educator_start_assignment.
--
-- Lead objects: quizzes (read; FK from assignment_tests, ON DELETE CASCADE,
-- indexed), students / educator_admin_state / audit_logs (writes through our
-- existing helpers). No lead table, column, constraint, trigger, RLS or policy
-- change.
--
-- ROLLBACK
--   scripts/rollback_20261118090000_admin_qa_nov18.sql
-- =====================================================================
set search_path = public, extensions;

-- --------------------------------------------------------------- preflight
do $pre$
declare
  v_problems text[] := '{}';
  v_sig      text;
begin
  foreach v_sig in array array[
    'public.adm_assignment_rows()', 'public.adm_require_verified_educator()', 'public.create_test(uuid,jsonb)',
    'public.adm_asg_log(uuid,text,text)', 'public.adm_audit(text,text,uuid,jsonb,jsonb,text)', 'public.adm_test_json(uuid)',
    'public.adm_educator_assignment_json(uuid)', 'public.educator_list_assignments(text)',
    'public.educator_start_assignment(uuid)', 'public.adm_ensure_student(uuid)',
    'public.adm_end_user_sessions(uuid,text,uuid)', 'public.adm_set_educator_state(uuid,text,text,uuid)',
    'public.adm_account_deletion_json(uuid)']
  loop
    if to_regprocedure(v_sig) is null then
      v_problems := v_problems || format('missing %s (apply the earlier migrations first)', v_sig);
    end if;
  end loop;
  foreach v_sig in array array['adm_account_delete_self', 'adm_assignment_test_progress', 'adm_assignment_test_payload',
                               'educator_add_assignment_test'] loop
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = v_sig) then
      v_problems := v_problems || format('function public.%s already exists', v_sig);
    end if;
  end loop;
  if to_regclass('public.assignment_tests') is not null then
    v_problems := v_problems || 'table public.assignment_tests already exists'::text;
  end if;
  if to_regclass('public.account_deletion_requests') is null then
    v_problems := v_problems || 'missing public.account_deletion_requests (apply 20261111090000 first)'::text;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'test_assignments' and column_name = 'test_count') then
    v_problems := v_problems || 'test_assignments.test_count is missing (apply 20261111090000 first)'::text;
  end if;
  if cardinality(v_problems) > 0 then
    raise exception 'QA 18 Nov preflight: %', array_to_string(v_problems, '; ');
  end if;
end $pre$;

-- ============================================================ delete account
alter table public.account_deletion_requests add column if not exists self_service boolean not null default false;

-- Service role only (the delete-account Edge Function, after the password check).
-- adm_account_deletion_json: from 20261111090000_admin_qa_nov11.sql
create or replace function public.adm_account_deletion_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('id', r.id, 'role', r.role, 'reason', r.reason, 'status', r.status,
                            'created_at', r.created_at, 'decided_at', r.decided_at, 'decision_note', r.decision_note,
                            'self_service', r.self_service)   -- 20261118090000
    from public.account_deletion_requests r where r.id = p_id;
$$;

-- Returns {id, user_id, role, status, self_service}.
create or replace function public.adm_account_delete_self(p_user uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_role text;
  v_id   uuid;
  v_why  text := nullif(left(btrim(coalesce(p_reason, '')), 1000), '');
  v_note constant text := 'Account deleted by the user.';
  v_prev text;
begin
  if p_user is null then raise exception 'User is required.' using errcode = '22023'; end if;
  select case p.role when 'student' then 'student' when 'educator' then 'educator' end
    into v_role from public.profiles p where p.id = p_user;
  if v_role is null or exists (select 1 from public.adm_admin_users a where a.user_id = p_user) then
    raise exception 'Only student and educator accounts can be deleted here.' using errcode = '42501';
  end if;

  -- One record: close a pending request, or add a new one.
  update public.account_deletion_requests
     set status = 'approved', self_service = true, decided_at = now(), decided_by = p_user,
         decision_note = v_note, reason = coalesce(v_why, reason)
   where user_id = p_user and status = 'pending'
  returning id into v_id;
  if v_id is null then
    insert into public.account_deletion_requests (user_id, role, reason, status, self_service, decided_at, decided_by, decision_note)
    values (p_user, v_role, v_why, 'approved', true, now(), p_user, v_note)
    returning id into v_id;
  end if;

  -- Stop all access at once (the Auth soft delete follows in the Edge Function).
  if v_role = 'student' then
    perform public.adm_ensure_student(p_user);
    select account_status into v_prev from public.students where id = p_user for update;
    if v_prev is distinct from 'blocked' then
      update public.students
         set account_status = 'blocked', blocked_reason = v_note, blocked_at = now(), blocked_by = null
       where id = p_user;
      insert into public.student_block_history (student_id, action, reason, by_admin)
      values (p_user, 'blocked', v_note, null);
    end if;
    perform public.adm_end_user_sessions(p_user, 'account_deleted');
  else
    -- p_actor = the educator: not an admin write (no action-matrix check)
    perform public.adm_set_educator_state(p_user, 'suspended', v_note, p_user);
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, before_state, after_state, reason)
  values (p_user, v_role, 'account.deleted_by_user', 'user', p_user, null,
          jsonb_build_object('request_id', v_id, 'role', v_role), v_why);

  return public.adm_account_deletion_json(v_id)
         || jsonb_build_object('user_id', p_user, 'role', v_role, 'self_service', true);
end $$;

-- ============================================== assignment tests (progress)
create table public.assignment_tests (
  assignment_id uuid not null references public.test_assignments(id) on delete cascade,
  quiz_id       uuid not null references public.quizzes(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (assignment_id, quiz_id)
);
create index assignment_tests_quiz_idx on public.assignment_tests (quiz_id);
alter table public.assignment_tests enable row level security;   -- no policies: RPCs only
revoke all on table public.assignment_tests from public, anon, authenticated;

insert into public.assignment_tests (assignment_id, quiz_id)
select a.id, a.test_id from public.test_assignments a
 where a.test_id is not null and exists (select 1 from public.quizzes q where q.id = a.test_id)
on conflict do nothing;

create or replace function public.adm_assignment_test_progress(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
           'test_count', coalesce(a.test_count, 1),
           'tests_created', coalesce(t.created, 0),
           'tests_published', coalesce(t.published, 0),
           'tests_remaining', greatest(coalesce(a.test_count, 1) - coalesce(t.created, 0), 0),
           'tests', coalesce(t.list, '[]'::jsonb))
    from public.test_assignments a
    left join lateral (
      select count(*)::int as created,
             (count(*) filter (where coalesce(qa.status, 'draft') = 'published'))::int as published,
             jsonb_agg(jsonb_build_object('id', q.id, 'title', q.title, 'status', coalesce(qa.status, 'draft'),
                                          'questions_count', (select count(*) from public.quiz_questions qq where qq.quiz_id = q.id),
                                          'position', q.series_sort_order)
                       order by at.created_at, q.series_sort_order) as list
        from public.assignment_tests at
        join public.quizzes q on q.id = at.quiz_id
        left join public.quiz_admin qa on qa.quiz_id = q.id
       where at.assignment_id = a.id) t on true
   where a.id = p_id;
$$;

-- Name and share of the k-th test of an assignment.
create or replace function public.adm_assignment_test_payload(a public.test_assignments, k int) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'name', left(coalesce(nullif(btrim(a.test_name), ''), 'Test')
                 || case when coalesce(a.test_count, 1) > 1 then ' - Test ' || k else '' end, 200),
    'instructions', coalesce(a.instructions, ''),
    'duration', a.duration_minutes,
    'totalMarks', case when coalesce(a.test_count, 1) > 1 then round(a.total_marks / a.test_count, 2) else a.total_marks end,
    'plannedQuestions', case when coalesce(a.test_count, 1) > 1 then ceil(a.question_count::numeric / a.test_count)::int
                             else a.question_count end,
    'topics', to_jsonb(a.topics));
$$;

-- adm_educator_assignment_json: from 20261028100400_educator_series_portal.sql
create or replace function public.adm_educator_assignment_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
           'assignment', (to_jsonb(v) - 'educator_name') || public.adm_assignment_test_progress(v.id),   -- 20261118090000
           'series', (select jsonb_build_object('id', s.id, 'title', s.title, 'status', sa.status, 'code', sa.code)
                        from public.test_series s left join public.test_series_admin sa on sa.series_id = s.id
                       where s.id = v.series_id),
           'test', case when v.test_id is not null then public.adm_test_json(v.test_id) end,
           'history', (select coalesce(jsonb_agg(jsonb_build_object('action', h.action, 'note', h.note, 'at', h.at,
                                                                    'by_me', h.by_user = auth.uid()) order by h.at), '[]'::jsonb)
                         from public.assignment_history h where h.assignment_id = v.id),
           'comments', (select coalesce(jsonb_agg(jsonb_build_object(
                                          'id', c.id, 'comment', c.comment, 'question_id', c.question_id,
                                          'question_ref', c.question_ref, 'created_at', c.created_at,
                                          'from', case when c.author_id = auth.uid() then 'me' else 'admin' end)
                                        order by c.created_at), '[]'::jsonb)
                          from public.assignment_comments c where c.assignment_id = v.id))
    from public.adm_assignment_rows() v
   where v.id = p_id and v.educator_id = auth.uid();
$$;

-- educator_list_assignments: from 20261028100400_educator_series_portal.sql
create or replace function public.educator_list_assignments(p_status text default null) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_verified_educator();
  return coalesce((
    select jsonb_agg((to_jsonb(v) - 'educator_name')
                     || jsonb_build_object('series_status', sa.status,
                                           'comment_count', (select count(*) from public.assignment_comments c where c.assignment_id = v.id))
                     || (public.adm_assignment_test_progress(v.id) - 'tests')   -- 20261118090000
                     order by v.deadline nulls last, v.code)
      from public.adm_assignment_rows() v
      left join public.test_series_admin sa on sa.series_id = v.series_id
     where v.educator_id = auth.uid()
       and (p_status is null or p_status in ('', 'all')
            or (p_status = 'open' and v.status not in ('completed', 'cancelled', 'rejected'))
            or (p_status = 'overdue' and v.display_status = 'overdue')
            or v.status = p_status)), '[]'::jsonb);
end $$;

-- educator_start_assignment: from 20261028100400_educator_series_portal.sql
-- assigned -> in_progress; creates the test shell (create_test) the first time.
create or replace function public.educator_start_assignment(p_assignment_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  a      public.test_assignments;
  v_test jsonb;
begin
  perform public.adm_require_verified_educator();
  select * into a from public.test_assignments
   where id = p_assignment_id and educator_id = auth.uid() for update;
  if a.id is null then raise exception 'Assignment not found.' using errcode = 'P0002'; end if;
  if a.status in ('completed', 'cancelled', 'rejected') then
    raise exception 'This assignment is closed (%).', a.status using errcode = '22023';
  end if;
  if a.test_id is null then
    v_test := public.create_test(a.series_id, public.adm_assignment_test_payload(a, 1));   -- 20261118090000: test 1 of n, its share
    update public.test_assignments set test_id = (v_test ->> 'id')::uuid where id = a.id;
    insert into public.assignment_tests (assignment_id, quiz_id) values (a.id, (v_test ->> 'id')::uuid)   -- 20261118090000
    on conflict do nothing;
  end if;
  if a.status = 'assigned' then
    update public.test_assignments set status = 'in_progress' where id = a.id;
    perform public.adm_asg_log(a.id, 'Started', 'The educator started building the test.');
    perform public.adm_audit('assignment.start', 'test_assignment', a.id,
                             jsonb_build_object('status', a.status), jsonb_build_object('status', 'in_progress'), null);
  end if;
  return public.adm_educator_assignment_json(a.id);
end $$;

-- New: the next test of a multi-test assignment ("<name> - Test k"), up to test_count.
create or replace function public.educator_add_assignment_test(p_assignment_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  a      public.test_assignments;
  v_n    int;
  v_test jsonb;
begin
  perform public.adm_require_verified_educator();
  select * into a from public.test_assignments
   where id = p_assignment_id and educator_id = auth.uid() for update;
  if a.id is null then raise exception 'Assignment not found.' using errcode = 'P0002'; end if;
  if a.status not in ('assigned', 'in_progress', 'revision_requested') then
    raise exception 'Tests can''t be added while the assignment is %.', replace(a.status, '_', ' ') using errcode = '22023';
  end if;
  if a.test_id is null or a.status = 'assigned' then
    return public.educator_start_assignment(a.id);   -- the first test (and the start)
  end if;
  select count(*) into v_n from public.assignment_tests where assignment_id = a.id;
  if v_n >= coalesce(a.test_count, 1) then
    raise exception 'All % test(s) for this assignment are already created.', coalesce(a.test_count, 1) using errcode = '22023';
  end if;
  v_test := public.create_test(a.series_id, public.adm_assignment_test_payload(a, v_n + 1));
  insert into public.assignment_tests (assignment_id, quiz_id) values (a.id, (v_test ->> 'id')::uuid);
  perform public.adm_asg_log(a.id, 'Test added', format('Test %s of %s created.', v_n + 1, coalesce(a.test_count, 1)));
  return public.adm_educator_assignment_json(a.id);
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_account_delete_self(uuid, text) from public, anon, authenticated;
grant execute on function public.adm_account_delete_self(uuid, text) to service_role;
revoke all on function public.adm_assignment_test_progress(uuid) from public, anon, authenticated;
revoke all on function public.adm_assignment_test_payload(public.test_assignments, int) from public, anon, authenticated;
revoke all on function public.adm_educator_assignment_json(uuid) from public, anon, authenticated;
revoke all on function public.educator_list_assignments(text) from public, anon;
revoke all on function public.educator_start_assignment(uuid) from public, anon;
revoke all on function public.educator_add_assignment_test(uuid) from public, anon;
grant execute on function public.educator_list_assignments(text) to authenticated;
grant execute on function public.educator_start_assignment(uuid) to authenticated;
grant execute on function public.educator_add_assignment_test(uuid) to authenticated;
