-- =====================================================================
-- 20261111090000_admin_qa_nov11.sql
--
-- QA reports #17-#25 and #21 (02 Nov), our objects only.
--
-- Assignments (#23, #24, #25)
--   * test_assignments (our table) gains test_count, grade, exam, audience.
--     The Assign Educators form always sent them, but create_assignments
--     dropped them, so "Edit Requirements" showed 1 test instead of 5 (#23).
--   * create_assignments / update_assignment_requirements write them.
--   * list_assignments / get_assignment_detail return them (test_count
--     defaults to 1 for older rows). "Recently assigned" sorts by created_at
--     (a timestamp), newest first, whatever the status (#25). It used
--     assigned_date (a date), so same-day rows came back in code order.
--   * get_assignment_detail: each history row also has `by` (the actor's
--     name, or "System") for the details modal (#24).
--
-- Test marks (#18, #20)
--   * adm_test_json also returns total_marks_planned (the total the admin or
--     educator set, e.g. the assignment's 15) and marks_sum (the questions'
--     marks so far). total_marks is unchanged (the questions' sum when there
--     are questions), so nothing that reads it changes. The edit form now
--     shows and saves the planned total, and the read-back no longer looks
--     unsaved.
--
-- Delete account (#21): a request flow (decision 3 in QA_BUG_TRIAGE_AND_FIXES)
--   * account_deletion_requests (new, ours): one pending request per user.
--   * account_request_deletion(p_reason) / account_get_deletion_request() /
--     account_cancel_deletion_request(): the caller's own request (students
--     and educators only).
--   * list_account_deletion_requests(p_status, p_search, p_page, p_size) and
--     resolve_account_deletion_request(p_id, p_decision, p_note): admin only.
--     Approving blocks the account (block_student for a student; the
--     educator's account becomes suspended through adm_set_educator_state as
--     a system write). The admin UI then calls set-user-ban. Rejecting sends
--     the user a notification. The data deletion itself stays a manual step.
--
-- Replaced (each edit marked "-- 20261111090000", the rest verbatim from the
-- file named above it): create_assignments, update_assignment_requirements,
-- list_assignments, get_assignment_detail, adm_test_json.
--
-- Lead objects: profiles (read), notifications (insert, on a rejected
-- request). No lead table, column, constraint, trigger, RLS or policy change.
--
-- ROLLBACK
--   scripts/rollback_20261111090000_admin_qa_nov11.sql
-- =====================================================================
set search_path = public, extensions;

-- --------------------------------------------------------------- preflight
do $pre$
declare
  v_problems text[] := '{}';
  v_sig      text;
begin
  foreach v_sig in array array[
    'public.adm_require_admin()', 'public.adm_assignment_rows()', 'public.adm_audit(text,text,uuid,jsonb,jsonb,text)',
    'public.list_assignments(text,text,text,uuid,text,date,integer,integer)', 'public.get_assignment_detail(uuid)',
    'public.create_assignments(jsonb)', 'public.update_assignment_requirements(uuid,jsonb)', 'public.adm_test_json(uuid)',
    'public.block_student(uuid,text)', 'public.adm_set_educator_state(uuid,text,text,uuid)',
    'public.adm_is_account_blocked(uuid)', 'public.adm_asg_log(uuid,text,text)', 'public.adm_asg_notify(uuid,text,text,text)']
  loop
    if to_regprocedure(v_sig) is null then
      v_problems := v_problems || format('missing %s (apply the earlier migrations first)', v_sig);
    end if;
  end loop;
  foreach v_sig in array array['account_request_deletion', 'account_get_deletion_request', 'account_cancel_deletion_request',
                               'list_account_deletion_requests', 'resolve_account_deletion_request', 'adm_account_deletion_json'] loop
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = v_sig) then
      v_problems := v_problems || format('function public.%s already exists', v_sig);
    end if;
  end loop;
  if to_regclass('public.account_deletion_requests') is not null then
    v_problems := v_problems || 'table public.account_deletion_requests already exists'::text;
  end if;
  if to_regclass('public.test_assignments') is null then
    v_problems := v_problems || 'missing public.test_assignments'::text;
  end if;
  if cardinality(v_problems) > 0 then
    raise exception 'QA 11 Nov preflight: %', array_to_string(v_problems, '; ');
  end if;
end $pre$;

-- ------------------------------------------------- assignments: new columns
alter table public.test_assignments add column if not exists test_count int check (test_count between 1 and 100);
alter table public.test_assignments add column if not exists grade text;
alter table public.test_assignments add column if not exists exam text;
alter table public.test_assignments add column if not exists audience text;

-- create_assignments: from 20261025110700_admin_rpc_assignments.sql
create or replace function public.create_assignments(p jsonb) returns uuid[]
language plpgsql security definer set search_path = public, extensions as $$
declare
  sid    uuid;
  ids    uuid[] := '{}';
  eid    uuid;
  aid    uuid;
  sname  text;
  subj   text := nullif(btrim(coalesce(p ->> 'subject', '')), '');
  tname  text := nullif(btrim(coalesce(p ->> 'testName', '')), '');
  mix    text := coalesce(nullif(p ->> 'questionTypeMix', ''), 'mixed');
  diff   text := coalesce(nullif(p ->> 'difficulty', ''), 'Medium');
  tcount int  := coalesce(round(nullif(p ->> 'testCount', '')::numeric)::int, 1);   -- 20261111090000
begin
  perform public.adm_require_admin();
  if tname is null then raise exception 'Test / question paper name is required.' using errcode = '22023'; end if;
  if subj is null then raise exception 'Subject is required.' using errcode = '22023'; end if;
  if nullif(p ->> 'deadline', '') is null or (p ->> 'deadline')::date < current_date then
    raise exception 'Deadline must be today or later.' using errcode = '22023';
  end if;
  if jsonb_typeof(p -> 'educatorIds') <> 'array' or jsonb_array_length(p -> 'educatorIds') = 0 then
    raise exception 'Select at least one educator.' using errcode = '22023';
  end if;
  if mix not in ('objective', 'subjective', 'mixed') then raise exception 'Unknown question type mix: %', mix using errcode = '22023'; end if;
  if diff not in ('Easy', 'Medium', 'Hard', 'Mixed') then raise exception 'Unknown difficulty: %', diff using errcode = '22023'; end if;
  if tcount not between 1 and 100 then   -- 20261111090000
    raise exception 'Number of tests must be between 1 and 100.' using errcode = '22023';
  end if;

  if p ->> 'seriesMode' = 'new' then
    sname := nullif(btrim(coalesce(p ->> 'newSeriesName', '')), '');
    if sname is null or char_length(sname) < 3 then raise exception 'Enter a name for the new series.' using errcode = '22023'; end if;
    if exists (select 1 from public.adm_series_rows() r where lower(btrim(r.title)) = lower(sname)) then
      raise exception 'A test series with this name already exists.' using errcode = '23505';
    end if;
    sid := public.adm_new_house_series(sname, null, 'scratch');
  else
    sid := nullif(p ->> 'seriesId', '')::uuid;
    if sid is null then raise exception 'Select a test series.' using errcode = '22023'; end if;
    perform public.adm_require_series(sid);
  end if;

  for eid in select x::uuid from jsonb_array_elements_text(p -> 'educatorIds') x loop
    if not exists (select 1 from public.adm_eligible_educators() e where e.id = eid) then
      raise exception 'Educator is not verified or not active.' using errcode = '22023';
    end if;
    insert into public.test_assignments (series_id, educator_id, subject, topics, test_name, question_count,
                                         question_type_mix, difficulty, total_marks, duration_minutes,
                                         instructions, deadline, created_by,
                                         test_count, grade, exam, audience)   -- 20261111090000
    values (sid, eid, subj,
            coalesce((select array_agg(btrim(x)) from jsonb_array_elements_text(
                        case when jsonb_typeof(p -> 'topics') = 'array' then p -> 'topics' else '[]'::jsonb end) x
                       where btrim(x) <> ''), '{}'),
            tname, coalesce(nullif(p ->> 'questionCount', '')::int, 20), mix, diff,
            coalesce(nullif(p ->> 'totalMarks', '')::numeric, 100), coalesce(nullif(p ->> 'duration', '')::int, 60),
            nullif(p ->> 'instructions', ''), (p ->> 'deadline')::date, auth.uid(),
            tcount, nullif(btrim(coalesce(p ->> 'grade', '')), ''), nullif(btrim(coalesce(p ->> 'exam', '')), ''),   -- 20261111090000
            nullif(btrim(coalesce(p ->> 'audience', '')), ''))
    returning id into aid;
    ids := ids || aid;
    perform public.adm_asg_log(aid, 'Assigned', 'Assignment created.');
    perform public.adm_asg_notify(aid, 'assigned', 'New test assignment',
      format('You''ve been assigned "%s" (%s). Deadline: %s.', tname, subj, p ->> 'deadline'));
  end loop;
  perform public.adm_audit('assignment.create', 'test_series', sid, null,
                           jsonb_build_object('assignments', to_jsonb(ids), 'test_name', tname), null);
  return ids;
end $$;

-- update_assignment_requirements: from 20261025110700_admin_rpc_assignments.sql
create or replace function public.update_assignment_requirements(p_id uuid, patch jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_series uuid := nullif(patch ->> 'seriesId', '')::uuid;
  v_count  int  := round(nullif(patch ->> 'testCount', '')::numeric)::int;   -- 20261111090000
begin
  perform public.adm_require_admin();
  if v_series is not null then perform public.adm_require_series(v_series); end if;
  if patch ? 'questionTypeMix' and patch ->> 'questionTypeMix' not in ('objective', 'subjective', 'mixed') then
    raise exception 'Unknown question type mix.' using errcode = '22023';
  end if;
  if patch ? 'difficulty' and patch ->> 'difficulty' not in ('Easy', 'Medium', 'Hard', 'Mixed') then
    raise exception 'Unknown difficulty.' using errcode = '22023';
  end if;
  if v_count is not null and v_count not between 1 and 100 then   -- 20261111090000
    raise exception 'Number of tests must be between 1 and 100.' using errcode = '22023';
  end if;
  update public.test_assignments set
    series_id         = coalesce(v_series, series_id),
    test_name         = coalesce(nullif(btrim(coalesce(patch ->> 'testName', '')), ''), test_name),
    subject           = coalesce(nullif(btrim(coalesce(patch ->> 'subject', '')), ''), subject),
    topics            = case when jsonb_typeof(patch -> 'topics') = 'array'
                             then coalesce((select array_agg(btrim(x)) from jsonb_array_elements_text(patch -> 'topics') x where btrim(x) <> ''), '{}')
                             else topics end,
    question_count    = coalesce(nullif(patch ->> 'questionCount', '')::int, question_count),
    question_type_mix = coalesce(nullif(patch ->> 'questionTypeMix', ''), question_type_mix),
    difficulty        = coalesce(nullif(patch ->> 'difficulty', ''), difficulty),
    total_marks       = coalesce(nullif(patch ->> 'totalMarks', '')::numeric, total_marks),
    duration_minutes  = coalesce(nullif(patch ->> 'duration', '')::int, duration_minutes),
    deadline          = coalesce(nullif(patch ->> 'deadline', '')::date, deadline),
    instructions      = case when patch ? 'instructions' then nullif(patch ->> 'instructions', '') else instructions end,
    test_count        = coalesce(v_count, test_count),                                                            -- 20261111090000
    grade             = case when patch ? 'grade' then nullif(btrim(coalesce(patch ->> 'grade', '')), '') else grade end,
    exam              = case when patch ? 'exam' then nullif(btrim(coalesce(patch ->> 'exam', '')), '') else exam end,
    audience          = case when patch ? 'audience' then nullif(btrim(coalesce(patch ->> 'audience', '')), '') else audience end
  where id = p_id and status not in ('completed', 'cancelled');
  if not found then raise exception 'Assignment not found or already closed.' using errcode = 'P0002'; end if;
  perform public.adm_asg_log(p_id, 'Requirements updated', 'Test requirements were edited.');
  perform public.adm_asg_notify(p_id, 'updated', 'Assignment requirements updated',
                                'Requirements for your assignment were updated. Please review the changes.');
end $$;

-- list_assignments: from 20261025110700_admin_rpc_assignments.sql
create or replace function public.list_assignments(
  p_search text default null, p_sort text default 'deadline_asc', p_subject text default null,
  p_educator uuid default null, p_status text default null, p_deadline_before date default null,
  p_page int default 1, p_size int default 8
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 8), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with f as (
    select v.* from public.adm_assignment_rows() v
     where (v_like is null or (v.code || ' ' || coalesce(v.test_name, '') || ' ' || v.series_name || ' '
                               || coalesce(v.educator_name, '')) ilike v_like)
       and (p_subject is null or p_subject in ('', 'all') or v.subject = p_subject)
       and (p_educator is null or v.educator_id = p_educator)
       and (p_status is null or p_status in ('', 'all')
            or case when p_status = 'overdue' then v.display_status = 'overdue' else v.status = p_status end)
       and (p_deadline_before is null or v.deadline <= p_deadline_before)
  )
  select to_jsonb(f) || jsonb_build_object('test_count', coalesce(ta.test_count, 1), 'grade', ta.grade,   -- 20261111090000
                                           'exam', ta.exam, 'audience', ta.audience),
         count(*) over ()
    from f
    left join public.test_assignments ta on ta.id = f.id                                                   -- 20261111090000
   order by case when p_sort = 'deadline_asc'  then f.deadline end asc nulls last,
            case when p_sort = 'deadline_desc' then f.deadline end desc nulls last,
            case when p_sort = 'assigned_desc' then f.created_at end desc nulls last,                     -- 20261111090000
            case when p_sort = 'progress_desc' then f.progress end desc,
            f.code
   limit v_size offset (v_page - 1) * v_size;
end $$;

-- get_assignment_detail: from 20261025110700_admin_rpc_assignments.sql
create or replace function public.get_assignment_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    select jsonb_build_object(
      'assignment',    to_jsonb(v) || jsonb_build_object('test_count', coalesce(ta.test_count, 1), 'grade', ta.grade,   -- 20261111090000
                                                         'exam', ta.exam, 'audience', ta.audience),
      'history',       (select coalesce(jsonb_agg(to_jsonb(h) || jsonb_build_object('by', coalesce(hp.full_name, 'System'))   -- 20261111090000
                                                  order by h.at), '[]'::jsonb)
                          from public.assignment_history h
                          left join public.profiles hp on hp.id = h.by_user
                         where h.assignment_id = p_id),
      'comments',      (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at), '[]'::jsonb)
                          from public.assignment_comments c where c.assignment_id = p_id),
      'notifications', (select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc), '[]'::jsonb)
                          from public.assignment_notifications n where n.assignment_id = p_id))
      from public.adm_assignment_rows() v
      left join public.test_assignments ta on ta.id = v.id                                                -- 20261111090000
     where v.id = p_id);
end $$;

-- adm_test_json: from 20261025110400_admin_b2_authoring_helpers.sql
create or replace function public.adm_test_json(p_quiz uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
           'id', q.id, 'series_id', q.series_id, 'position', q.series_sort_order, 'title', q.title,
           'instructions', q.description, 'duration_minutes', coalesce(q.time_limit_mins, 60),
           'total_marks', coalesce(nullif(m.marks_sum, 0), qa.total_marks_planned, 0),
           'total_marks_planned', qa.total_marks_planned, 'marks_sum', m.marks_sum,   -- 20261111090000
           'passing_percent', q.passing_score, 'passing_marks', qa.passing_marks,
           'attempt_limit', q.max_attempts, 'scheduled_at', qa.scheduled_at,
           'shuffle_questions', q.shuffle_questions, 'shuffle_options', coalesce(qa.shuffle_options, false),
           'show_answers_after', q.show_answers_after,
           'window_mode', coalesce(qa.window_mode, 'inherit'), 'open_at', qa.open_at, 'close_at', qa.close_at,
           'planned_questions', coalesce(qa.planned_questions, 0), 'topics', to_jsonb(coalesce(qa.topics, '{}'::text[])),
           'status', coalesce(qa.status, case when s.is_published then 'published' else 'draft' end),
           'question_count', m.n,
           'attempts', (select count(*) from public.quiz_attempts a where a.quiz_id = q.id),
           'created_at', q.created_at,
           'sections', coalesce((select jsonb_agg(to_jsonb(ts) order by ts.position)
                                   from public.test_sections ts where ts.quiz_id = q.id), '[]'::jsonb),
           'questions', coalesce((select jsonb_agg(public.adm_question_json(qq.id) order by qq.sort_order, qq.created_at)
                                    from public.quiz_questions qq where qq.quiz_id = q.id), '[]'::jsonb))
    from public.quizzes q
    left join public.quiz_admin qa on qa.quiz_id = q.id
    left join public.test_series s on s.id = q.series_id
    cross join lateral (select count(*) as n, coalesce(sum(x.points), 0) as marks_sum
                          from public.quiz_questions x where x.quiz_id = q.id) m
   where q.id = p_quiz;
$$;

-- ------------------------------------------------ delete account requests
create table public.account_deletion_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  role          text not null check (role in ('student', 'educator')),
  reason        text check (char_length(reason) <= 1000),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid references public.profiles(id) on delete set null,
  decision_note text check (char_length(decision_note) <= 1000)
);
create index account_deletion_requests_user_idx on public.account_deletion_requests (user_id);
create index account_deletion_requests_decided_by_idx on public.account_deletion_requests (decided_by);
create index account_deletion_requests_status_idx on public.account_deletion_requests (status, created_at desc);
create unique index account_deletion_requests_one_pending on public.account_deletion_requests (user_id) where status = 'pending';
alter table public.account_deletion_requests enable row level security;   -- no policies: RPCs only
revoke all on table public.account_deletion_requests from public, anon, authenticated;

create or replace function public.adm_account_deletion_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('id', r.id, 'role', r.role, 'reason', r.reason, 'status', r.status,
                            'created_at', r.created_at, 'decided_at', r.decided_at, 'decision_note', r.decision_note)
    from public.account_deletion_requests r where r.id = p_id;
$$;

-- The caller's own request (idempotent: an existing pending request is returned).
create or replace function public.account_request_deletion(p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid  uuid := auth.uid();
  v_role text;
  v_id   uuid;
  v_why  text := nullif(left(btrim(coalesce(p_reason, '')), 1000), '');
begin
  if v_uid is null then raise exception 'Not signed in.' using errcode = '42501'; end if;
  select case p.role when 'student' then 'student' when 'educator' then 'educator' end
    into v_role from public.profiles p where p.id = v_uid;
  if v_role is null then
    raise exception 'Only student and educator accounts can request deletion here.' using errcode = '42501';
  end if;
  select id into v_id from public.account_deletion_requests where user_id = v_uid and status = 'pending';
  if v_id is null then
    insert into public.account_deletion_requests (user_id, role, reason) values (v_uid, v_role, v_why)
    returning id into v_id;
    perform public.adm_audit('account.deletion_requested', 'user', v_uid, null, jsonb_build_object('role', v_role), v_why);
  end if;
  return public.adm_account_deletion_json(v_id);
end $$;

-- The caller's latest request, or null.
create or replace function public.account_get_deletion_request() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in.' using errcode = '42501'; end if;
  select id into v_id from public.account_deletion_requests
   where user_id = auth.uid()
   order by created_at desc,
            case status when 'pending' then 0 when 'approved' then 1 when 'rejected' then 2 else 3 end
   limit 1;
  return case when v_id is null then null else public.adm_account_deletion_json(v_id) end;
end $$;

-- Withdraws the caller's pending request; null when there was none.
create or replace function public.account_cancel_deletion_request() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in.' using errcode = '42501'; end if;
  update public.account_deletion_requests set status = 'cancelled', decided_at = now()
   where user_id = auth.uid() and status = 'pending'
  returning id into v_id;
  if v_id is null then return null; end if;
  perform public.adm_audit('account.deletion_cancelled', 'user', auth.uid(), null, null, null);
  return public.adm_account_deletion_json(v_id);
end $$;

-- Admin list. p_status: pending (default) | approved | rejected | cancelled | all.
create or replace function public.list_account_deletion_requests(
  p_status text default 'pending', p_search text default null, p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 10), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  select public.adm_account_deletion_json(r.id)
           || jsonb_build_object('user_id', r.user_id, 'name', p.full_name, 'email', p.email,
                                 'decided_by_name', dp.full_name),
         count(*) over ()
    from public.account_deletion_requests r
    join public.profiles p on p.id = r.user_id
    left join public.profiles dp on dp.id = r.decided_by
   where (coalesce(p_status, '') in ('', 'all') or r.status = p_status)
     and (v_like is null or (coalesce(p.full_name, '') || ' ' || coalesce(p.email, '')) ilike v_like)
   order by (r.status = 'pending') desc, r.created_at desc
   limit v_size offset (v_page - 1) * v_size;
end $$;

-- Admin decision. Approving blocks the account (the admin UI then calls
-- set-user-ban); rejecting notifies the user. Returns the request plus
-- user_id and role.
create or replace function public.resolve_account_deletion_request(p_id uuid, p_decision text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  r      public.account_deletion_requests%rowtype;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 1000), '');
  v_why  text;
begin
  perform public.adm_require_admin();
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected.' using errcode = '22023';
  end if;
  select * into r from public.account_deletion_requests where id = p_id for update;
  if not found then raise exception 'Request not found.' using errcode = 'P0002'; end if;
  if r.status <> 'pending' then raise exception 'This request was already handled.' using errcode = '22023'; end if;

  if p_decision = 'approved' and not public.adm_is_account_blocked(r.user_id) then
    v_why := left('Account deletion approved' || coalesce(': ' || v_note, '.'), 500);
    if r.role = 'student' then
      perform public.block_student(r.user_id, v_why);
    else
      -- a system write (p_actor null): suspension follows the user's own request
      perform public.adm_set_educator_state(r.user_id, 'suspended', v_why, null);
    end if;
  end if;

  update public.account_deletion_requests
     set status = p_decision, decided_at = now(), decided_by = auth.uid(), decision_note = v_note
   where id = p_id;

  if p_decision = 'rejected' then
    insert into public.notifications (user_id, category, title, body, reference_type, reference_id)
    values (r.user_id, 'system', 'Account deletion request',
            'Your account deletion request was not approved.' || coalesce(' ' || v_note, ''),
            'account_deletion', p_id);
  end if;
  perform public.adm_audit('account.deletion_' || p_decision, 'user', r.user_id,
                           jsonb_build_object('status', 'pending'), jsonb_build_object('status', p_decision), v_note);
  return public.adm_account_deletion_json(p_id) || jsonb_build_object('user_id', r.user_id, 'role', r.role);
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_account_deletion_json(uuid) from public, anon, authenticated;
revoke all on function public.account_request_deletion(text) from public, anon;
revoke all on function public.account_get_deletion_request() from public, anon;
revoke all on function public.account_cancel_deletion_request() from public, anon;
revoke all on function public.list_account_deletion_requests(text, text, int, int) from public, anon;
revoke all on function public.resolve_account_deletion_request(uuid, text, text) from public, anon;
grant execute on function public.account_request_deletion(text) to authenticated;
grant execute on function public.account_get_deletion_request() to authenticated;
grant execute on function public.account_cancel_deletion_request() to authenticated;
grant execute on function public.list_account_deletion_requests(text, text, int, int) to authenticated;
grant execute on function public.resolve_account_deletion_request(uuid, text, text) to authenticated;
