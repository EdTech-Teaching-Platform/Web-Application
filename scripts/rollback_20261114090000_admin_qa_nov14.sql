-- =====================================================================
-- rollback_20261114090000_admin_qa_nov14.sql
-- Undoes supabase/migrations/20261114090000_admin_qa_nov14.sql: drops the
-- educator notification RPCs and restores the four replaced functions.
-- Run only with "approved:"; take a backup first.
-- =====================================================================
set search_path = public, extensions;
begin;

drop function if exists public.educator_mark_all_assignment_notifications_read();
drop function if exists public.educator_mark_assignment_notification_read(uuid);
drop function if exists public.educator_list_assignment_notifications(boolean, int);

-- adm_validate_quiz_for_publish: verbatim from 20261025110400_admin_b2_authoring_helpers.sql
create or replace function public.adm_validate_quiz_for_publish(p_quiz uuid) returns text
language sql stable security definer set search_path = public, extensions as $$
  select case
    when m.total = 0 then format('"%s" has no questions.', q.title)
    when m.no_correct > 0 then format('"%s" has %s question(s) without a correct answer.', q.title, m.no_correct)
    else null end
    from public.quizzes q
    cross join lateral (
      select count(*) as total,
             count(*) filter (where not exists (select 1 from public.quiz_question_options o
                                                  where o.question_id = qq.id and o.is_correct)) as no_correct
        from public.quiz_questions qq where qq.quiz_id = q.id) m
   where q.id = p_quiz;
$$;

-- adm_series_publish_problem: verbatim from 20261027110000_admin_fast_publish.sql
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
    select qq.quiz_id, count(*) as total, count(*) filter (where a.question_id is null) as no_correct
      from public.quiz_questions qq
      join t on t.id = qq.quiz_id
      left join answered a on a.question_id = qq.id
     group by qq.quiz_id
  )
  select case when coalesce(m.total, 0) = 0 then format('"%s" has no questions.', t.title)
              else format('"%s" has %s question(s) without a correct answer.', t.title, m.no_correct) end
    from t
    left join m on m.quiz_id = t.id
   where coalesce(m.total, 0) = 0 or m.no_correct > 0
   order by t.series_sort_order, t.created_at, t.id
   limit 1;
$$;

-- get_admin_nav: verbatim from 20261025100600_admin_rpc_shell_dashboard.sql
create or replace function public.get_admin_nav() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_series int := 0;
  v_counts jsonb;
begin
  perform public.adm_require_admin();
  if to_regclass('public.test_assignments') is not null then
    execute $q$select count(*)::int from public.test_assignments
               where status not in ('approved', 'completed', 'cancelled', 'rejected')$q$ into v_series;
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

-- create_assignments: verbatim from 20261111090000_admin_qa_nov11.sql
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

commit;
