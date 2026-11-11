-- =====================================================================
-- rollback_20261111090000_admin_qa_nov11.sql
-- Undoes supabase/migrations/20261111090000_admin_qa_nov11.sql: drops the
-- delete-account objects, restores the six replaced functions to their
-- previous definitions and drops the four new test_assignments columns
-- (their values are lost).
-- Run only with "approved:"; take a backup first.
-- =====================================================================
set search_path = public, extensions;
begin;

drop function if exists public.resolve_account_deletion_request(uuid, text, text);
drop function if exists public.list_account_deletion_requests(text, text, int, int);
drop function if exists public.account_cancel_deletion_request();
drop function if exists public.account_get_deletion_request();
drop function if exists public.account_request_deletion(text);
drop function if exists public.adm_account_deletion_json(uuid);
drop table if exists public.account_deletion_requests;

-- create_assignments: verbatim from 20261025110700_admin_rpc_assignments.sql
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
                                         instructions, deadline, created_by)
    values (sid, eid, subj,
            coalesce((select array_agg(btrim(x)) from jsonb_array_elements_text(
                        case when jsonb_typeof(p -> 'topics') = 'array' then p -> 'topics' else '[]'::jsonb end) x
                       where btrim(x) <> ''), '{}'),
            tname, coalesce(nullif(p ->> 'questionCount', '')::int, 20), mix, diff,
            coalesce(nullif(p ->> 'totalMarks', '')::numeric, 100), coalesce(nullif(p ->> 'duration', '')::int, 60),
            nullif(p ->> 'instructions', ''), (p ->> 'deadline')::date, auth.uid())
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

-- update_assignment_requirements: verbatim from 20261025110700_admin_rpc_assignments.sql
create or replace function public.update_assignment_requirements(p_id uuid, patch jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_series uuid := nullif(patch ->> 'seriesId', '')::uuid;
begin
  perform public.adm_require_admin();
  if v_series is not null then perform public.adm_require_series(v_series); end if;
  if patch ? 'questionTypeMix' and patch ->> 'questionTypeMix' not in ('objective', 'subjective', 'mixed') then
    raise exception 'Unknown question type mix.' using errcode = '22023';
  end if;
  if patch ? 'difficulty' and patch ->> 'difficulty' not in ('Easy', 'Medium', 'Hard', 'Mixed') then
    raise exception 'Unknown difficulty.' using errcode = '22023';
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
    instructions      = case when patch ? 'instructions' then nullif(patch ->> 'instructions', '') else instructions end
  where id = p_id and status not in ('completed', 'cancelled');
  if not found then raise exception 'Assignment not found or already closed.' using errcode = 'P0002'; end if;
  perform public.adm_asg_log(p_id, 'Requirements updated', 'Test requirements were edited.');
  perform public.adm_asg_notify(p_id, 'updated', 'Assignment requirements updated',
                                'Requirements for your assignment were updated. Please review the changes.');
end $$;

-- list_assignments: verbatim from 20261025110700_admin_rpc_assignments.sql
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
  select to_jsonb(f), count(*) over ()
    from f
   order by case when p_sort = 'deadline_asc'  then f.deadline end asc nulls last,
            case when p_sort = 'deadline_desc' then f.deadline end desc nulls last,
            case when p_sort = 'assigned_desc' then f.assigned_date end desc,
            case when p_sort = 'progress_desc' then f.progress end desc,
            f.code
   limit v_size offset (v_page - 1) * v_size;
end $$;

-- get_assignment_detail: verbatim from 20261025110700_admin_rpc_assignments.sql
create or replace function public.get_assignment_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    select jsonb_build_object(
      'assignment',    to_jsonb(v),
      'history',       (select coalesce(jsonb_agg(to_jsonb(h) order by h.at), '[]'::jsonb)
                          from public.assignment_history h where h.assignment_id = p_id),
      'comments',      (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at), '[]'::jsonb)
                          from public.assignment_comments c where c.assignment_id = p_id),
      'notifications', (select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc), '[]'::jsonb)
                          from public.assignment_notifications n where n.assignment_id = p_id))
      from public.adm_assignment_rows() v where v.id = p_id);
end $$;

-- adm_test_json: verbatim from 20261025110400_admin_b2_authoring_helpers.sql
create or replace function public.adm_test_json(p_quiz uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
           'id', q.id, 'series_id', q.series_id, 'position', q.series_sort_order, 'title', q.title,
           'instructions', q.description, 'duration_minutes', coalesce(q.time_limit_mins, 60),
           'total_marks', coalesce(nullif(m.marks_sum, 0), qa.total_marks_planned, 0),
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

-- adm_series_card: verbatim from 20261026100200_student_rpc_series.sql
create or replace function public.adm_series_card(p_series_id uuid, p_student uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
           'id', s.id,
           'title', s.title,
           'description', s.description,
           'subject', coalesce(cat.name, sa.subject_label),
           'category_id', cat.id,
           'level', sa.level,
           'exam', sa.exam,
           'pricing', coalesce(sa.pricing, 'free'),
           'price_inr', coalesce(sa.price_inr, 0),
           'is_free', coalesce(sa.pricing, 'free') = 'free' or coalesce(sa.price_inr, 0) = 0,
           'cover_path', sa.cover_path,
           'available_from', s.available_from,
           'available_until', s.available_until,
           'access_days', sa.access_days,
           'tests_count', coalesce(t.cnt, 0),
           'questions_count', coalesce(t.questions, 0),
           'total_duration_mins', coalesce(t.mins, 0))
         || case when p_student is null then '{}'::jsonb else jsonb_build_object(
           'is_enrolled', public.adm_student_is_enrolled(s.id, p_student),
           'attempts_count', (select count(*) from public.quiz_attempts a
                                join public.quizzes q on q.id = a.quiz_id
                               where q.series_id = s.id and a.student_id = p_student)) end
    from public.test_series s
    left join public.test_series_admin sa on sa.series_id = s.id
    left join public.courses c on c.id = s.course_id
    left join public.categories cat on cat.id = coalesce(sa.subject_category_id, c.category_id)
    left join lateral (
      select count(*) as cnt, sum(q.time_limit_mins) as mins, sum(qc.n) as questions
        from public.quizzes q
        left join public.quiz_admin qa on qa.quiz_id = q.id
        left join lateral (select count(*) as n from public.quiz_questions qq where qq.quiz_id = q.id) qc on true
       where q.series_id = s.id and coalesce(qa.status, 'published') = 'published'
    ) t on true
   where s.id = p_series_id;
$$;

alter table public.test_assignments drop column if exists test_count;
alter table public.test_assignments drop column if exists grade;
alter table public.test_assignments drop column if exists exam;
alter table public.test_assignments drop column if exists audience;

commit;
