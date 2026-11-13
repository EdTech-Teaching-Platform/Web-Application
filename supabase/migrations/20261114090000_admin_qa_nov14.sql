-- =====================================================================
-- 20261114090000_admin_qa_nov14.sql
--
-- QA reports of 13 Nov, our objects only.
--
-- Publishing with the wrong marks (10 of 40 and 16 of 10 were published)
--   * adm_validate_quiz_for_publish (set_test_status) and
--     adm_series_publish_problem (wizard publish, educator series approval)
--     refuse a test whose questions' marks don't add up to its planned total
--     (quiz_admin.total_marks_planned), with the numbers in the message.
--     Tests without a planned total are unchanged. Already-published tests are
--     not touched (the admin / educator pages flag them).
--
-- Assign Educators sidebar badge
--   * get_admin_nav counts open assignments (assigned, in progress,
--     submitted, under review, revision requested) over adm_assignment_rows(),
--     the rows the list shows (a deleted series' assignments were counted).
--     The sidebar now explains the number and refreshes after changes.
--
-- Number of tests vs educators
--   * create_assignments accepts p.allocation = [{educatorId, tests}]: one
--     assignment per educator with their share of the tests, and the
--     questions / marks split in proportion (2 tests, 30 marks, 2 educators =
--     1 test and 15 marks each). The tests must add up to testCount. Without
--     an allocation it behaves as before.
--
-- Assignment notifications for educators
--   * assignment_notifications (ours) was only shown to admins ("mock, not
--     delivered"). New educator RPCs (verified educators, own rows only):
--       educator_list_assignment_notifications(p_unread_only, p_limit)
--         -> {rows: [{id, assignment_id, type, title, message, is_read, created_at}], unread}
--       educator_mark_assignment_notification_read(p_id) -> int
--       educator_mark_all_assignment_notifications_read() -> int
--
-- Replaced (each edit marked "-- 20261114090000", the rest verbatim from the
-- file named above it): adm_validate_quiz_for_publish, adm_series_publish_problem,
-- get_admin_nav, create_assignments.
--
-- Needs 20261111090000 (create_assignments' test_count columns).
-- No lead table, column, constraint, trigger, RLS or policy change.
--
-- ROLLBACK
--   scripts/rollback_20261114090000_admin_qa_nov14.sql
-- =====================================================================
set search_path = public, extensions;

-- --------------------------------------------------------------- preflight
do $pre$
declare
  v_problems text[] := '{}';
  v_sig      text;
begin
  foreach v_sig in array array[
    'public.adm_validate_quiz_for_publish(uuid)', 'public.adm_series_publish_problem(uuid)', 'public.get_admin_nav()',
    'public.create_assignments(jsonb)', 'public.adm_assignment_rows()', 'public.adm_require_verified_educator()',
    'public.account_request_deletion(text)']
  loop
    if to_regprocedure(v_sig) is null then
      v_problems := v_problems || format('missing %s (apply the earlier migrations first, incl. 20261111090000)', v_sig);
    end if;
  end loop;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'test_assignments' and column_name = 'test_count') then
    v_problems := v_problems || 'test_assignments.test_count is missing (apply 20261111090000 first)'::text;
  end if;
  foreach v_sig in array array['educator_list_assignment_notifications', 'educator_mark_assignment_notification_read',
                               'educator_mark_all_assignment_notifications_read'] loop
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = v_sig) then
      v_problems := v_problems || format('function public.%s already exists', v_sig);
    end if;
  end loop;
  if cardinality(v_problems) > 0 then
    raise exception 'QA 14 Nov preflight: %', array_to_string(v_problems, '; ');
  end if;
end $pre$;


-- adm_validate_quiz_for_publish: from 20261025110400_admin_b2_authoring_helpers.sql
create or replace function public.adm_validate_quiz_for_publish(p_quiz uuid) returns text
language sql stable security definer set search_path = public, extensions as $$
  select case
    when m.total = 0 then format('"%s" has no questions.', q.title)
    when m.no_correct > 0 then format('"%s" has %s question(s) without a correct answer.', q.title, m.no_correct)
    -- 20261114090000: the questions' marks must add up to the planned total
    when coalesce(qa.total_marks_planned, 0) > 0 and m.marks <> qa.total_marks_planned then
      format('"%s": the questions add up to %s marks but the test''s total is %s. Make them match before publishing.',
             q.title, trim_scale(m.marks), trim_scale(qa.total_marks_planned))
    else null end
    from public.quizzes q
    left join public.quiz_admin qa on qa.quiz_id = q.id   -- 20261114090000
    cross join lateral (
      select count(*) as total,
             count(*) filter (where not exists (select 1 from public.quiz_question_options o
                                                  where o.question_id = qq.id and o.is_correct)) as no_correct,
             coalesce(sum(qq.points), 0)::numeric as marks   -- 20261114090000
        from public.quiz_questions qq where qq.quiz_id = q.id) m
   where q.id = p_quiz;
$$;

-- adm_series_publish_problem: from 20261027110000_admin_fast_publish.sql
create or replace function public.adm_series_publish_problem(p_series uuid) returns text
language sql stable security definer set search_path = public, extensions as $$
  with t as (
    select q.id, q.title, q.series_sort_order, q.created_at from public.quizzes q where q.series_id = p_series
  ),
  answered as (
    select distinct o.question_id
      from public.quiz_question_options o
      join public.quiz_questions qq on qq.id = o.question_id
      join t on t.id = qq.quiz_id
     where o.is_correct
  ),
  m as (
    select qq.quiz_id, count(*) as total, count(*) filter (where a.question_id is null) as no_correct,
           coalesce(sum(qq.points), 0)::numeric as marks   -- 20261114090000
      from public.quiz_questions qq
      join t on t.id = qq.quiz_id
      left join answered a on a.question_id = qq.id
     group by qq.quiz_id
  )
  select case when coalesce(m.total, 0) = 0 then format('"%s" has no questions.', t.title)
              when m.no_correct > 0 then format('"%s" has %s question(s) without a correct answer.', t.title, m.no_correct)
              -- 20261114090000: marks must match the planned total
              else format('"%s": the questions add up to %s marks but the test''s total is %s. Make them match before publishing.',
                          t.title, trim_scale(m.marks), trim_scale(qa.total_marks_planned)) end
    from t
    left join m on m.quiz_id = t.id
    left join public.quiz_admin qa on qa.quiz_id = t.id   -- 20261114090000
   where coalesce(m.total, 0) = 0 or m.no_correct > 0
      or (coalesce(qa.total_marks_planned, 0) > 0 and m.marks <> qa.total_marks_planned)   -- 20261114090000
   order by t.series_sort_order, t.created_at, t.id
   limit 1;
$$;

-- get_admin_nav: from 20261025100600_admin_rpc_shell_dashboard.sql
create or replace function public.get_admin_nav() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_series int := 0;
  v_counts jsonb;
begin
  perform public.adm_require_admin();
  if to_regclass('public.test_assignments') is not null then
    -- 20261114090000: open = assigned, in progress, submitted, under review or
    -- revision requested; same rows as the Assign Educators list (a deleted
    -- series' assignments are not counted)
    select count(*)::int into v_series from public.adm_assignment_rows() v
     where v.status in ('assigned', 'in_progress', 'submitted', 'under_review', 'revision_requested');
  end if;
  v_counts := jsonb_build_object(
    'educator_verifications', (select count(*) from public.educator_profiles ep
                                 join public.profiles p on p.id = ep.user_id and p.role = 'educator'
                                 left join public.educator_admin_state st on st.user_id = ep.user_id
                                where ep.verification_status = 'pending'
                                  and coalesce(st.account_status, 'active') <> 'deleted'),
    'series_approvals', v_series,
    'refunds', 0,                                                                  -- STUB: needs payments model (F4)
    'callbacks', (select count(*) from public.callback_requests where status = 'new'),
    'moderation', (select count(*) from public.moderation_reports where status = 'pending'));
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'key', n.key, 'section', n.section, 'label', n.label, 'route', n.route, 'icon', n.icon,
             'badge', nullif((v_counts ->> n.badge_key)::int, 0)) order by n.sort_order)
      from public.admin_nav_items n where n.is_active), '[]'::jsonb);
end $$;

-- create_assignments: from 20261111090000_admin_qa_nov11.sql
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
  v_total numeric := coalesce(nullif(p ->> 'totalMarks', '')::numeric, 100);         -- 20261114090000
  v_qcount int    := coalesce(nullif(p ->> 'questionCount', '')::int, 20);
  v_alloc  jsonb;
  v_n      int;
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

  -- 20261114090000: p.allocation = [{educatorId, tests}] splits the tests
  -- (one assignment per educator, with their share of the tests, questions
  -- and marks). Without it every educator gets all the tests (as before).
  if jsonb_typeof(p -> 'allocation') = 'array' and jsonb_array_length(p -> 'allocation') > 0 then
    v_alloc := p -> 'allocation';
    if (select count(*) from jsonb_array_elements(v_alloc) e) <> (select count(distinct e ->> 'educatorId') from jsonb_array_elements(v_alloc) e) then
      raise exception 'An educator appears twice in the test allocation.' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_array_elements(v_alloc) e
                where coalesce(round(nullif(e ->> 'tests', '')::numeric)::int, 0) < 1) then
      raise exception 'Every educator in the allocation needs at least one test.' using errcode = '22023';
    end if;
    if (select sum(round((e ->> 'tests')::numeric)::int) from jsonb_array_elements(v_alloc) e) <> tcount then
      raise exception 'The tests allocated to educators must add up to the number of tests (%).', tcount using errcode = '22023';
    end if;
  else
    v_alloc := (select jsonb_agg(jsonb_build_object('educatorId', x, 'tests', tcount))
                  from jsonb_array_elements_text(p -> 'educatorIds') x);
  end if;

  for eid, v_n in select (e ->> 'educatorId')::uuid, round((e ->> 'tests')::numeric)::int from jsonb_array_elements(v_alloc) e loop
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
            tname, least(greatest(round(v_qcount * v_n::numeric / tcount)::int, 1), 300), mix, diff,   -- 20261114090000: their share
            round(v_total * v_n / tcount, 2), coalesce(nullif(p ->> 'duration', '')::int, 60),
            nullif(p ->> 'instructions', ''), (p ->> 'deadline')::date, auth.uid(),
            v_n, nullif(btrim(coalesce(p ->> 'grade', '')), ''), nullif(btrim(coalesce(p ->> 'exam', '')), ''),   -- 20261111090000
            nullif(btrim(coalesce(p ->> 'audience', '')), ''))
    returning id into aid;
    ids := ids || aid;
    perform public.adm_asg_log(aid, 'Assigned', 'Assignment created.');
    perform public.adm_asg_notify(aid, 'assigned', 'New test assignment',
      format('You''ve been assigned "%s" (%s): %s test%s. Deadline: %s.', tname, subj, v_n,
             case when v_n = 1 then '' else 's' end, p ->> 'deadline'));   -- 20261114090000
  end loop;
  perform public.adm_audit('assignment.create', 'test_series', sid, null,
                           jsonb_build_object('assignments', to_jsonb(ids), 'test_name', tname), null);
  return ids;
end $$;

-- ------------------------------------- assignment notifications (educators)
create or replace function public.educator_list_assignment_notifications(
  p_unread_only boolean default false, p_limit int default 20
) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 100);
begin
  perform public.adm_require_verified_educator();
  return jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'assignment_id', n.assignment_id, 'type', n.type, 'title', n.title,
                                          'message', n.message, 'is_read', n.is_read, 'created_at', n.created_at)
                       order by n.created_at desc, n.id)
        from (select * from public.assignment_notifications
               where educator_id = auth.uid() and (not coalesce(p_unread_only, false) or not is_read)
               order by created_at desc, id limit v_limit) n), '[]'::jsonb),
    'unread', (select count(*) from public.assignment_notifications where educator_id = auth.uid() and not is_read));
end $$;

create or replace function public.educator_mark_assignment_notification_read(p_id uuid) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare v_n int;
begin
  perform public.adm_require_verified_educator();
  update public.assignment_notifications set is_read = true
   where id = p_id and educator_id = auth.uid() and not is_read;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.educator_mark_all_assignment_notifications_read() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare v_n int;
begin
  perform public.adm_require_verified_educator();
  update public.assignment_notifications set is_read = true where educator_id = auth.uid() and not is_read;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.educator_list_assignment_notifications(boolean, int) from public, anon;
revoke all on function public.educator_mark_assignment_notification_read(uuid) from public, anon;
revoke all on function public.educator_mark_all_assignment_notifications_read() from public, anon;
grant execute on function public.educator_list_assignment_notifications(boolean, int) to authenticated;
grant execute on function public.educator_mark_assignment_notification_read(uuid) to authenticated;
grant execute on function public.educator_mark_all_assignment_notifications_read() to authenticated;
