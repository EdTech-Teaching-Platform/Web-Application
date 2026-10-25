-- =====================================================================
-- 20261025110700_admin_rpc_assignments.sql
--
-- Purpose
--   Assign Educators RPCs (assignmentsApi.js). Names and parameters match the
--   archived contract; three new read RPCs replace direct view / table reads
--   (D4): list_series_requests (was v_series_requests), list_eligible_educators
--   (was v_eligible_educators), list_series_options (was test_series select).
--     list_assignments(p_search, p_sort, p_subject, p_educator, p_status, p_deadline_before, p_page, p_size)
--     get_assignment_detail(p_id)
--     create_assignments(p) -> uuid[]
--     update_assignment_requirements(p_id, patch) / reassign_educator(p_id, p_educator)
--     extend_deadline(p_id, p_date) / cancel_assignment(p_id, p_reason)
--     start_review(p_id) / review_submission(p_id, p_decision, p_feedback, p_comments, p_reason) -> text
--     assign_request(p_request, p_educator, p_deadline, p_note) -> uuid / reject_request(p_request, p_reason)
--
-- Lead objects read
--   test_series, profiles, educator_profiles (verified = eligible).
--   "New series" from the form is created on the house course (D2).
--
-- Assumptions
--   * Subjects are free text on assignments (categories are read-only, D9).
--   * Business decisions (create, reassign, cancel, review) are also written to
--     audit_logs (D9).
--
-- ROLLBACK
--   drop function if exists public.reject_request(uuid, text), public.assign_request(uuid, uuid, date, text),
--     public.review_submission(uuid, text, text, jsonb, text), public.start_review(uuid),
--     public.cancel_assignment(uuid, text), public.extend_deadline(uuid, date), public.reassign_educator(uuid, uuid),
--     public.update_assignment_requirements(uuid, jsonb), public.create_assignments(jsonb),
--     public.list_series_options(), public.list_eligible_educators(), public.list_series_requests(),
--     public.get_assignment_detail(uuid),
--     public.list_assignments(text, text, text, uuid, text, date, int, int);
-- =====================================================================
set search_path = public, extensions;

-- ------------------------------------------------------------------ reads
-- p_sort: deadline_asc | deadline_desc | assigned_desc | progress_desc
-- p_status: any assignment status or 'overdue'
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

-- Same keys as the archived v_series_requests (r.* + assignment_id, assignment_code).
create or replace function public.list_series_requests() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return coalesce((
    select jsonb_agg(to_jsonb(r) || jsonb_build_object('assignment_id', a.id, 'assignment_code', a.code)
                     order by r.sent_date desc, r.created_at desc)
      from public.series_requests r
      left join public.test_assignments a on a.request_id = r.id), '[]'::jsonb);
end $$;

-- [{id, name, subjects}] ordered by name (was v_eligible_educators).
create or replace function public.list_eligible_educators() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return coalesce((select jsonb_agg(to_jsonb(e) order by e.name) from public.adm_eligible_educators() e), '[]'::jsonb);
end $$;

-- [{id, title}] of non-deleted series (was test_series select ... deleted_at is null).
create or replace function public.list_series_options() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'status', r.status) order by r.title)
                     from public.adm_series_rows() r), '[]'::jsonb);
end $$;

-- ----------------------------------------------------------------- writes
-- p = {seriesMode:'existing'|'new', seriesId, newSeriesName, subject, topics:[], testName,
--      educatorIds:[], questionCount, questionTypeMix, difficulty, totalMarks, duration,
--      deadline, instructions}. One assignment per educator.
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

-- Row menu > Edit Requirements (patch keys are the create keys; seriesId may change).
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

create or replace function public.reassign_educator(p_id uuid, p_educator uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_old uuid; v_old_name text; v_new_name text;
begin
  perform public.adm_require_admin();
  if not exists (select 1 from public.adm_eligible_educators() e where e.id = p_educator) then
    raise exception 'Educator is not verified or not active.' using errcode = '22023';
  end if;
  select a.educator_id, p.full_name into v_old, v_old_name
    from public.test_assignments a left join public.profiles p on p.id = a.educator_id where a.id = p_id;
  select full_name into v_new_name from public.profiles where id = p_educator;
  update public.test_assignments set educator_id = p_educator
   where id = p_id and status not in ('completed', 'cancelled');
  if not found then raise exception 'Assignment not found or already closed.' using errcode = 'P0002'; end if;
  perform public.adm_asg_log(p_id, 'Reassigned', format('Reassigned from %s to %s.', coalesce(v_old_name, '—'), coalesce(v_new_name, '—')));
  perform public.adm_asg_notify(p_id, 'assigned', 'New test assignment',
                                'You have been assigned a test to build. Check the deadline and requirements.');
  perform public.adm_audit('assignment.reassign', 'test_assignment', p_id,
                           jsonb_build_object('educator_id', v_old), jsonb_build_object('educator_id', p_educator), null);
end $$;

create or replace function public.extend_deadline(p_id uuid, p_date date) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  if p_date is null or p_date < current_date then
    raise exception 'Pick a date that is today or later.' using errcode = '22023';
  end if;
  update public.test_assignments set deadline = p_date where id = p_id and status not in ('completed', 'cancelled');
  if not found then raise exception 'Assignment not found or already closed.' using errcode = 'P0002'; end if;
  perform public.adm_asg_log(p_id, 'Deadline extended', 'New deadline: ' || p_date);
  perform public.adm_asg_notify(p_id, 'deadline_changed', 'Deadline updated',
                                'The deadline for your assignment is now ' || p_date || '.');
end $$;

create or replace function public.cancel_assignment(p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_old text;
begin
  perform public.adm_require_admin();
  select status into v_old from public.test_assignments where id = p_id for update;
  update public.test_assignments set status = 'cancelled', cancel_reason = nullif(btrim(coalesce(p_reason, '')), '')
   where id = p_id and status not in ('completed', 'cancelled');
  if not found then raise exception 'Assignment not found or already closed.' using errcode = 'P0002'; end if;
  perform public.adm_asg_log(p_id, 'Cancelled', coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Assignment cancelled.'));
  perform public.adm_asg_notify(p_id, 'cancelled', 'Assignment cancelled',
                                'Your assignment has been cancelled. ' || coalesce(p_reason, ''));
  perform public.adm_audit('assignment.cancel', 'test_assignment', p_id,
                           jsonb_build_object('status', v_old), jsonb_build_object('status', 'cancelled'), p_reason);
end $$;

-- Review modal open: submitted -> under_review (no-op otherwise).
create or replace function public.start_review(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  update public.test_assignments set status = 'under_review' where id = p_id and status = 'submitted';
  if found then perform public.adm_asg_log(p_id, 'Review started', 'Admin opened this submission for review.'); end if;
end $$;

-- p_decision: approved | revision | rejected; p_comments: [{questionRef, comment}]
create or replace function public.review_submission(
  p_id uuid, p_decision text, p_feedback text, p_comments jsonb, p_reason text
) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_old text;
  v_new text;
  c     jsonb;
begin
  perform public.adm_require_admin();
  select status into v_old from public.test_assignments where id = p_id for update;
  if v_old is null or v_old not in ('submitted', 'under_review') then
    raise exception 'Only submitted assignments can be reviewed.' using errcode = '22023';
  end if;
  if p_decision not in ('approved', 'revision', 'rejected') then
    raise exception 'Invalid decision.' using errcode = '22023';
  end if;
  if p_decision in ('revision', 'rejected') and btrim(coalesce(p_reason, '')) = '' then
    raise exception 'A reason is required.' using errcode = '22023';
  end if;
  v_new := case p_decision when 'approved' then 'approved' when 'revision' then 'revision_requested' else 'rejected' end;

  update public.test_assignments
     set status = v_new, overall_feedback = p_feedback, decision = v_new, decision_at = now(), decision_reason = p_reason
   where id = p_id;
  for c in select * from jsonb_array_elements(case when jsonb_typeof(p_comments) = 'array' then p_comments else '[]'::jsonb end) loop
    continue when nullif(btrim(coalesce(c ->> 'comment', '')), '') is null;
    insert into public.assignment_comments (assignment_id, question_ref, comment, author_id)
    values (p_id, c ->> 'questionRef', btrim(c ->> 'comment'), auth.uid());
  end loop;

  perform public.adm_asg_log(p_id, case p_decision when 'approved' then 'Approved' when 'revision' then 'Revision requested' else 'Rejected' end,
                             coalesce(nullif(p_reason, ''), p_feedback));
  perform public.adm_asg_notify(p_id, v_new,
    case p_decision when 'approved' then 'Submission approved' when 'revision' then 'Revision requested' else 'Submission rejected' end,
    coalesce(nullif(p_feedback, ''), p_reason));
  perform public.adm_audit('assignment.review', 'test_assignment', p_id,
                           jsonb_build_object('status', v_old), jsonb_build_object('status', v_new), p_reason);
  return v_new;
end $$;

-- Incoming request > Assign educator.
create or replace function public.assign_request(p_request uuid, p_educator uuid, p_deadline date, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  r   public.series_requests;
  sid uuid;
  aid uuid;
begin
  perform public.adm_require_admin();
  select * into r from public.series_requests where id = p_request and status = 'pending' for update;
  if not found then raise exception 'Request is not pending.' using errcode = '22023'; end if;
  if not exists (select 1 from public.adm_eligible_educators() e where e.id = p_educator) then
    raise exception 'Educator is not verified or not active.' using errcode = '22023';
  end if;
  if p_deadline is null or p_deadline < current_date then
    raise exception 'Pick a deadline that is today or later.' using errcode = '22023';
  end if;

  sid := r.series_id;
  if sid is not null and not exists (select 1 from public.adm_series_rows() x where x.id = sid) then
    sid := null;   -- the series was deleted since the request arrived
  end if;
  if sid is null then
    sid := public.adm_new_house_series(r.series_name, null, 'scratch');
  end if;

  insert into public.test_assignments (series_id, educator_id, subject, topics, test_name, question_count,
                                       question_type_mix, difficulty, total_marks, duration_minutes,
                                       instructions, deadline, request_id, created_by)
  values (sid, p_educator, r.subject, r.topics, r.test_name, coalesce(r.question_count, 20), r.question_type_mix,
          coalesce(r.difficulty, 'Medium'), coalesce(r.total_marks, 100), coalesce(r.duration_minutes, 60),
          concat_ws(E'\n\n', r.instructions, nullif(p_note, '')), p_deadline, r.id, auth.uid())
  returning id into aid;
  update public.series_requests set status = 'assigned', decision_at = now(), series_id = sid where id = p_request;
  perform public.adm_asg_log(aid, 'Assigned', 'Created from request ' || r.code);
  perform public.adm_asg_notify(aid, 'assigned', 'New test assignment',
                                format('You''ve been assigned "%s". Deadline: %s.', r.test_name, p_deadline));
  perform public.adm_audit('assignment.create_from_request', 'series_request', p_request, null,
                           jsonb_build_object('assignment_id', aid), null);
  return aid;
end $$;

create or replace function public.reject_request(p_request uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  update public.series_requests set status = 'rejected', decision_at = now(), decision_reason = p_reason
   where id = p_request and status = 'pending';
  if not found then raise exception 'Request is not pending.' using errcode = '22023'; end if;
  perform public.adm_audit('series_request.reject', 'series_request', p_request, null, null, p_reason);
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.list_assignments(text, text, text, uuid, text, date, int, int) from public, anon;
revoke all on function public.get_assignment_detail(uuid) from public, anon;
revoke all on function public.list_series_requests() from public, anon;
revoke all on function public.list_eligible_educators() from public, anon;
revoke all on function public.list_series_options() from public, anon;
revoke all on function public.create_assignments(jsonb) from public, anon;
revoke all on function public.update_assignment_requirements(uuid, jsonb) from public, anon;
revoke all on function public.reassign_educator(uuid, uuid) from public, anon;
revoke all on function public.extend_deadline(uuid, date) from public, anon;
revoke all on function public.cancel_assignment(uuid, text) from public, anon;
revoke all on function public.start_review(uuid) from public, anon;
revoke all on function public.review_submission(uuid, text, text, jsonb, text) from public, anon;
revoke all on function public.assign_request(uuid, uuid, date, text) from public, anon;
revoke all on function public.reject_request(uuid, text) from public, anon;

grant execute on function public.list_assignments(text, text, text, uuid, text, date, int, int) to authenticated;
grant execute on function public.get_assignment_detail(uuid) to authenticated;
grant execute on function public.list_series_requests() to authenticated;
grant execute on function public.list_eligible_educators() to authenticated;
grant execute on function public.list_series_options() to authenticated;
grant execute on function public.create_assignments(jsonb) to authenticated;
grant execute on function public.update_assignment_requirements(uuid, jsonb) to authenticated;
grant execute on function public.reassign_educator(uuid, uuid) to authenticated;
grant execute on function public.extend_deadline(uuid, date) to authenticated;
grant execute on function public.cancel_assignment(uuid, text) to authenticated;
grant execute on function public.start_review(uuid) to authenticated;
grant execute on function public.review_submission(uuid, text, text, jsonb, text) to authenticated;
grant execute on function public.assign_request(uuid, uuid, date, text) to authenticated;
grant execute on function public.reject_request(uuid, text) to authenticated;
