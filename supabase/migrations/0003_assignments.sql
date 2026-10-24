set search_path = public, extensions;
set check_function_bodies = off;
-- =====================================================================
-- ---------------------------------------------------------------- ENUMS
do $$ begin create type assignment_status as enum
  ('assigned','in_progress','submitted','under_review','revision_requested','approved','rejected','completed','cancelled');
exception when duplicate_object then null; end $$;
do $$ begin create type question_mix   as enum ('objective','subjective','mixed');   exception when duplicate_object then null; end $$;
do $$ begin create type request_status as enum ('pending','assigned','rejected');    exception when duplicate_object then null; end $$;
create sequence if not exists assignment_code_seq start 5001;     -- ASG-5001
create sequence if not exists request_code_seq    start 6001;     -- REQ-6001
-- --------------------------------------- INCOMING SERIES REQUESTS (review section)
create table if not exists series_requests (
  id                 uuid primary key default gen_random_uuid(),
  code               text unique default ('REQ-' || nextval('request_code_seq')),
  series_id          uuid references test_series(id) on delete set null,   -- null = brand-new series
  series_name        text not null,
  subject            text,
  topics             text[] default '{}',
  test_name          text not null,
  sent_by            text,                                 -- "Academic Content Team", partner name
  sent_date          date default current_date,
  question_count     int  check (question_count between 1 and 300),
  question_type_mix  question_mix default 'mixed',
  difficulty         text check (difficulty in ('Easy','Medium','Hard','Mixed')),
  total_marks        numeric(8,2),
  duration_minutes   int check (duration_minutes > 0),
  instructions       text,
  requested_deadline date,
  status             request_status not null default 'pending',
  decision_at        timestamptz,
  decision_reason    text,
  created_at         timestamptz default now()
);
-- -------------------------------------------------------- ASSIGNMENTS (the table rows)
create table if not exists test_assignments (
  id          uuid primary key default gen_random_uuid(),
  series_id   uuid not null references test_series(id) on delete cascade,
  educator_id uuid not null references profiles(id),
  test_name   text,
  deadline    date,
  status      assignment_status not null default 'assigned',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table test_assignments
  add column if not exists code              text unique,                        -- ASG-5001 (shown + searched)
  add column if not exists subject           text,
  add column if not exists topics            text[] default '{}',
  add column if not exists question_count    int  default 20 check (question_count between 1 and 300),
  add column if not exists question_type_mix question_mix default 'mixed',
  add column if not exists difficulty        text default 'Medium' check (difficulty in ('Easy','Medium','Hard','Mixed')),
  add column if not exists total_marks       numeric(8,2) default 100,
  add column if not exists duration_minutes  int default 60 check (duration_minutes > 0),
  add column if not exists instructions      text,
  add column if not exists assigned_date     date default current_date,
  add column if not exists request_id        uuid references series_requests(id) on delete set null,
  add column if not exists test_id           uuid references tests(id) on delete set null,   -- test the educator built
  add column if not exists cancel_reason     text,
  add column if not exists submitted_at      timestamptz,
  add column if not exists overall_feedback  text,
  add column if not exists decision          text check (decision in ('approved','revision_requested','rejected')),
  add column if not exists decision_at       timestamptz,
  add column if not exists decision_reason   text,
  add column if not exists created_by        uuid references profiles(id);
update test_assignments set code = 'ASG-' || nextval('assignment_code_seq') where code is null;
create or replace function gen_assignment_code() returns trigger language plpgsql as
$$ begin if new.code is null then new.code := 'ASG-' || nextval('assignment_code_seq'); end if; return new; end $$;
drop trigger if exists trg_assign_code on test_assignments;
create trigger trg_assign_code before insert on test_assignments for each row execute function gen_assignment_code();
drop trigger if exists trg_assign_updated on test_assignments;
create trigger trg_assign_updated before update on test_assignments for each row execute function set_updated_at();
-- Progress bar % per status (match these to STATUS_PROGRESS in testAssignmentsMock.js)
create table if not exists assignment_status_progress (
  status   assignment_status primary key,
  progress int not null check (progress between 0 and 100)
);
insert into assignment_status_progress values
  ('assigned',5),('in_progress',40),('submitted',75),('under_review',75),('revision_requested',55),
  ('approved',95),('completed',100),('rejected',0),('cancelled',0)
on conflict (status) do update set progress = excluded.progress;
-- Review comments on specific questions
create table if not exists assignment_comments (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references test_assignments(id) on delete cascade,
  question_id   uuid references questions(id) on delete set null,
  question_ref  text,                       -- free text such as "Q5"
  comment       text not null,
  author_id     uuid references profiles(id),
  created_at    timestamptz default now()
);
-- Timeline in the View Details modal
create table if not exists assignment_history (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references test_assignments(id) on delete cascade,
  action        text not null,              -- Assigned, Requirements updated, Reassigned, Deadline extended, Review started, Approved ...
  by_user       uuid references profiles(id),
  note          text,
  at            timestamptz default now()
);
-- Educator notifications (replaces the mock log)
create table if not exists assignment_notifications (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references test_assignments(id) on delete cascade,
  educator_id   uuid not null references profiles(id) on delete cascade,
  type          text not null check (type in ('assigned','updated','deadline_changed','revision_requested','approved','rejected','cancelled')),
  title         text not null,
  message       text,
  is_read       boolean not null default false,
  created_at    timestamptz default now()
);
-- ---------------------------------------------------------------- INDEXES
create index if not exists idx_assign_series      on test_assignments(series_id);
create index if not exists idx_assign_edu         on test_assignments(educator_id, status);
create index if not exists idx_assign_deadline    on test_assignments(deadline);
create index if not exists idx_assign_assigned    on test_assignments(assigned_date desc);
create index if not exists idx_assign_status      on test_assignments(status);
create index if not exists idx_assign_search      on test_assignments using gin ((coalesce(code,'') || ' ' || coalesce(test_name,'')) gin_trgm_ops);
create index if not exists idx_asg_hist           on assignment_history(assignment_id, at);
create index if not exists idx_asg_comments       on assignment_comments(assignment_id);
create index if not exists idx_asg_notif          on assignment_notifications(educator_id, is_read, created_at desc);
create index if not exists idx_requests_status    on series_requests(status, sent_date desc);
-- ====================================================================
-- VIEWS + LIST FUNCTION (search, sort, filters, pagination)
-- ====================================================================
create or replace view v_assignments_list with (security_invoker = true) as
select
  a.id, a.code, a.series_id, s.title as series_name, a.subject, a.topics,
  a.educator_id, p.full_name as educator_name,
  a.test_name, a.question_count, a.question_type_mix, a.difficulty, a.total_marks, a.duration_minutes,
  a.instructions, a.assigned_date, a.deadline, a.status,
  case when a.status not in ('approved','completed','cancelled','rejected')
        and a.deadline is not null and a.deadline < current_date
       then 'overdue' else a.status::text end as display_status,           -- "Overdue" is display-only
  pr.progress,
  a.submitted_at, a.overall_feedback, a.decision, a.decision_at, a.decision_reason,
  a.cancel_reason, a.request_id, a.test_id, a.created_at
from test_assignments a
join test_series s on s.id = a.series_id
left join profiles p on p.id = a.educator_id
left join assignment_status_progress pr on pr.status = a.status;
create or replace function list_assignments(
  p_search text default null,
  p_sort text default 'deadline_asc',        -- deadline_asc | deadline_desc | assigned_desc | progress_desc
  p_subject text default null,
  p_educator uuid default null,
  p_status text default null,                -- any assignment status or 'overdue'
  p_deadline_before date default null,
  p_page int default 1, p_size int default 8
) returns table (row_data jsonb, total_count bigint)
language sql stable security invoker as $$
  with f as (
    select * from v_assignments_list v
    where (p_search is null or (v.code || ' ' || coalesce(v.test_name,'') || ' ' || v.series_name || ' ' || coalesce(v.educator_name,'')) ilike '%' || p_search || '%')
      and (p_subject  is null or v.subject = p_subject)
      and (p_educator is null or v.educator_id = p_educator)
      and (p_status   is null or case when p_status = 'overdue' then v.display_status = 'overdue' else v.status::text = p_status end)
      and (p_deadline_before is null or v.deadline <= p_deadline_before)
  )
  select to_jsonb(f), count(*) over () from f
  order by
    case when p_sort = 'deadline_asc'  then deadline end asc  nulls last,
    case when p_sort = 'deadline_desc' then deadline end desc nulls last,
    case when p_sort = 'assigned_desc' then assigned_date end desc,
    case when p_sort = 'progress_desc' then progress end desc,
    code
  limit p_size offset (greatest(p_page,1) - 1) * p_size;
$$;
-- View Details modal: assignment + timeline + comments + notifications in one call
create or replace function get_assignment_detail(p_id uuid) returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'assignment',    to_jsonb(v),
    'history',       (select coalesce(jsonb_agg(to_jsonb(h) order by h.at), '[]') from assignment_history h where h.assignment_id = p_id),
    'comments',      (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at), '[]') from assignment_comments c where c.assignment_id = p_id),
    'notifications', (select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc), '[]') from assignment_notifications n where n.assignment_id = p_id))
  from v_assignments_list v where v.id = p_id;
$$;
-- Incoming requests list (pending count badge = count where status = 'pending')
create or replace view v_series_requests with (security_invoker = true) as
select r.*, a.id as assignment_id, a.code as assignment_code
from series_requests r left join test_assignments a on a.request_id = r.id;
-- Dashboard "Test Series Approvals" card reads the same table
drop view if exists v_series_approvals;
create view v_series_approvals with (security_invoker = true) as
select id, code, series_name as title, educator_name, status, display_status,
       (display_status = 'overdue') as is_overdue, deadline, created_at
from v_assignments_list;
-- ====================================================================
-- ACTION FUNCTIONS (one per button)
-- ====================================================================
create or replace function _asg_log(p_id uuid, p_action text, p_note text) returns void
language sql security definer set search_path = public as
$$ insert into assignment_history (assignment_id, action, by_user, note) values (p_id, p_action, auth.uid(), p_note) $$;
create or replace function _asg_notify(p_id uuid, p_type text, p_title text, p_msg text) returns void
language sql security definer set search_path = public as
$$ insert into assignment_notifications (assignment_id, educator_id, type, title, message)
   select id, educator_id, p_type, p_title, p_msg from test_assignments where id = p_id $$;
-- [+ New Assignment] > Create / Assign. One assignment per selected educator.
-- p = {seriesMode:'existing'|'new', seriesId, newSeriesName, subject, topics:[], testName, educatorIds:[],
--      questionCount, questionTypeMix, difficulty, totalMarks, duration, deadline, instructions}
create or replace function create_assignments(p jsonb) returns uuid[]
language plpgsql security definer set search_path = public as $$
declare sid uuid; ids uuid[] := '{}'; eid uuid; aid uuid; sname text; subj text := nullif(btrim(p->>'subject'),'');
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if nullif(btrim(p->>'testName'),'') is null then raise exception 'Test / question paper name is required'; end if;
  if subj is null then raise exception 'Subject is required'; end if;
  if nullif(p->>'deadline','') is null or (p->>'deadline')::date < current_date then raise exception 'Deadline must be today or later'; end if;
  if jsonb_array_length(coalesce(p->'educatorIds','[]'::jsonb)) = 0 then raise exception 'Select at least one educator'; end if;
  if p->>'seriesMode' = 'new' then
    sname := btrim(p->>'newSeriesName');
    if sname is null or char_length(sname) < 3 then raise exception 'Enter a name for the new series'; end if;
    insert into test_series (title, status, start_method, created_by) values (sname, 'draft', 'scratch', auth.uid()) returning id into sid;
  else
    sid := nullif(p->>'seriesId','')::uuid;
    if sid is null then raise exception 'Select a test series'; end if;
  end if;
  insert into subjects (name, is_custom, created_by) values (subj, true, auth.uid()) on conflict (lower(name)) do nothing;
  for eid in select x::uuid from jsonb_array_elements_text(p->'educatorIds') x loop
    if not exists (select 1 from v_eligible_educators where id = eid) then raise exception 'Educator is not verified'; end if;
    insert into test_assignments (series_id, educator_id, subject, topics, test_name, question_count, question_type_mix,
                                  difficulty, total_marks, duration_minutes, instructions, deadline, created_by)
    values (sid, eid, subj,
            coalesce((select array_agg(btrim(x)) from jsonb_array_elements_text(coalesce(p->'topics','[]'::jsonb)) x where btrim(x) <> ''), '{}'),
            btrim(p->>'testName'), coalesce(nullif(p->>'questionCount','')::int, 20),
            coalesce(nullif(p->>'questionTypeMix','')::question_mix, 'mixed'), coalesce(nullif(p->>'difficulty',''), 'Medium'),
            coalesce(nullif(p->>'totalMarks','')::numeric, 100), coalesce(nullif(p->>'duration','')::int, 60),
            p->>'instructions', (p->>'deadline')::date, auth.uid())
    returning id into aid;
    ids := ids || aid;
    perform _asg_log(aid, 'Assigned', 'Assignment created.');
    perform _asg_notify(aid, 'assigned', 'New test assignment',
      format('You''ve been assigned "%s" (%s). Deadline: %s.', btrim(p->>'testName'), subj, p->>'deadline'));
  end loop;
  return ids;
end $$;
-- Row menu > Edit Requirements
create or replace function update_assignment_requirements(p_id uuid, patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update test_assignments set
    test_name         = coalesce(nullif(btrim(patch->>'testName'),''), test_name),
    subject           = coalesce(nullif(btrim(patch->>'subject'),''), subject),
    topics            = coalesce((select array_agg(btrim(x)) from jsonb_array_elements_text(patch->'topics') x where btrim(x) <> ''), topics),
    question_count    = coalesce(nullif(patch->>'questionCount','')::int, question_count),
    question_type_mix = coalesce(nullif(patch->>'questionTypeMix','')::question_mix, question_type_mix),
    difficulty        = coalesce(nullif(patch->>'difficulty',''), difficulty),
    total_marks       = coalesce(nullif(patch->>'totalMarks','')::numeric, total_marks),
    duration_minutes  = coalesce(nullif(patch->>'duration','')::int, duration_minutes),
    deadline          = coalesce(nullif(patch->>'deadline','')::date, deadline),
    instructions      = coalesce(patch->>'instructions', instructions)
  where id = p_id and status not in ('completed','cancelled');
  if not found then raise exception 'Assignment not found or already closed'; end if;
  perform _asg_log(p_id, 'Requirements updated', 'Test requirements were edited.');
  perform _asg_notify(p_id, 'updated', 'Assignment requirements updated', 'Requirements for your assignment were updated. Please review the changes.');
end $$;
-- Row menu > Reassign Educator
create or replace function reassign_educator(p_id uuid, p_educator uuid) returns void
language plpgsql security definer set search_path = public as $$
declare old_name text; new_name text;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if not exists (select 1 from v_eligible_educators where id = p_educator) then raise exception 'Educator is not verified'; end if;
  select p.full_name into old_name from test_assignments a join profiles p on p.id = a.educator_id where a.id = p_id;
  select full_name into new_name from profiles where id = p_educator;
  update test_assignments set educator_id = p_educator where id = p_id and status not in ('completed','cancelled');
  if not found then raise exception 'Assignment not found or already closed'; end if;
  perform _asg_log(p_id, 'Reassigned', format('Reassigned from %s to %s.', old_name, new_name));
  perform _asg_notify(p_id, 'assigned', 'New test assignment', 'You have been assigned a test to build. Check the deadline and requirements.');
end $$;
-- Row menu > Extend Deadline
create or replace function extend_deadline(p_id uuid, p_date date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if p_date is null or p_date < current_date then raise exception 'Pick a date that is today or later'; end if;
  update test_assignments set deadline = p_date where id = p_id and status not in ('completed','cancelled');
  if not found then raise exception 'Assignment not found or already closed'; end if;
  perform _asg_log(p_id, 'Deadline extended', 'New deadline: ' || p_date);
  perform _asg_notify(p_id, 'deadline_changed', 'Deadline updated', 'The deadline for your assignment is now ' || p_date || '.');
end $$;
-- Row menu > Cancel Assignment (reason optional)
create or replace function cancel_assignment(p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update test_assignments set status = 'cancelled', cancel_reason = p_reason where id = p_id and status not in ('completed','cancelled');
  if not found then raise exception 'Assignment not found or already closed'; end if;
  perform _asg_log(p_id, 'Cancelled', coalesce(nullif(p_reason,''), 'Assignment cancelled.'));
  perform _asg_notify(p_id, 'cancelled', 'Assignment cancelled', 'Your assignment has been cancelled. ' || coalesce(p_reason,''));
end $$;
-- Row menu > Review Submission (opens the modal: submitted -> under_review)
create or replace function start_review(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update test_assignments set status = 'under_review' where id = p_id and status = 'submitted';
  if found then perform _asg_log(p_id, 'Review started', 'Admin opened this submission for review.'); end if;
end $$;
-- Review modal > Approve / Request Revision / Reject
-- p_decision: 'approved' | 'revision' | 'rejected'; p_comments: [{questionRef, comment}]
create or replace function review_submission(p_id uuid, p_decision text, p_feedback text, p_comments jsonb, p_reason text)
returns assignment_status language plpgsql security definer set search_path = public as $$
declare a test_assignments; ns assignment_status; c jsonb;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select * into a from test_assignments where id = p_id for update;
  if not found or a.status not in ('submitted','under_review') then raise exception 'Only submitted assignments can be reviewed'; end if;
  if p_decision not in ('approved','revision','rejected') then raise exception 'Invalid decision'; end if;
  if p_decision in ('revision','rejected') and btrim(coalesce(p_reason,'')) = '' then raise exception 'A reason is required'; end if;
  ns := (case p_decision when 'approved' then 'approved' when 'revision' then 'revision_requested' else 'rejected' end)::assignment_status;
  update test_assignments set status = ns, overall_feedback = p_feedback,
         decision = case p_decision when 'revision' then 'revision_requested' else p_decision end,
         decision_at = now(), decision_reason = p_reason
   where id = p_id;
  for c in select * from jsonb_array_elements(coalesce(p_comments,'[]'::jsonb)) loop
    insert into assignment_comments (assignment_id, question_ref, comment, author_id)
    values (p_id, c->>'questionRef', c->>'comment', auth.uid());
  end loop;
  perform _asg_log(p_id, case p_decision when 'approved' then 'Approved' when 'revision' then 'Revision requested' else 'Rejected' end,
                   coalesce(nullif(p_reason,''), p_feedback));
  perform _asg_notify(p_id,
    case p_decision when 'approved' then 'approved' when 'revision' then 'revision_requested' else 'rejected' end,
    case p_decision when 'approved' then 'Submission approved' when 'revision' then 'Revision requested' else 'Submission rejected' end,
    coalesce(nullif(p_feedback,''), p_reason));
  return ns;
end $$;
-- Incoming request > Assign educator
create or replace function assign_request(p_request uuid, p_educator uuid, p_deadline date, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare r series_requests; sid uuid; aid uuid;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select * into r from series_requests where id = p_request and status = 'pending' for update;
  if not found then raise exception 'Request is not pending'; end if;
  if not exists (select 1 from v_eligible_educators where id = p_educator) then raise exception 'Educator is not verified'; end if;
  if p_deadline is null or p_deadline < current_date then raise exception 'Pick a deadline that is today or later'; end if;
  sid := r.series_id;
  if sid is null then
    insert into test_series (title, status, start_method, created_by) values (r.series_name, 'draft', 'scratch', auth.uid()) returning id into sid;
  end if;
  insert into test_assignments (series_id, educator_id, subject, topics, test_name, question_count, question_type_mix, difficulty,
                                total_marks, duration_minutes, instructions, deadline, request_id, created_by)
  values (sid, p_educator, r.subject, r.topics, r.test_name, r.question_count, r.question_type_mix, r.difficulty,
          r.total_marks, r.duration_minutes, concat_ws(E'\n\n', r.instructions, p_note), p_deadline, r.id, auth.uid())
  returning id into aid;
  update series_requests set status = 'assigned', decision_at = now(), series_id = sid where id = p_request;
  perform _asg_log(aid, 'Assigned', 'Created from request ' || r.code);
  perform _asg_notify(aid, 'assigned', 'New test assignment', format('You''ve been assigned "%s". Deadline: %s.', r.test_name, p_deadline));
  return aid;
end $$;
-- Incoming request > Reject
create or replace function reject_request(p_request uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update series_requests set status = 'rejected', decision_at = now(), decision_reason = p_reason
   where id = p_request and status = 'pending';
  if not found then raise exception 'Request is not pending'; end if;
end $$;
-- Educator side (their own assignments only)
create or replace function educator_start_assignment(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update test_assignments set status = 'in_progress' where id = p_id and educator_id = auth.uid() and status in ('assigned','revision_requested');
  if found then perform _asg_log(p_id, 'In progress', 'Educator started work.'); end if;
end $$;
create or replace function educator_submit_assignment(p_id uuid, p_test uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  update test_assignments set status = 'submitted', submitted_at = now(), test_id = coalesce(p_test, test_id)
   where id = p_id and educator_id = auth.uid() and status in ('assigned','in_progress','revision_requested');
  if not found then raise exception 'Cannot submit this assignment'; end if;
  perform _asg_log(p_id, 'Submitted', 'Educator submitted the test for review.');
end $$;
create or replace function mark_notification_read(p_id uuid) returns void
language sql security invoker as $$ update assignment_notifications set is_read = true where id = p_id and educator_id = auth.uid() $$;
-- When the approved test is published in Test Series, the assignment becomes Completed
create or replace function complete_assignment_on_publish() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    with u as (update test_assignments set status = 'completed' where test_id = new.id and status = 'approved' returning id)
    insert into assignment_history (assignment_id, action, note) select id, 'Completed', 'Linked test was published.' from u;
  end if;
  return null;
end $$;
drop trigger if exists trg_assign_complete on tests;
create trigger trg_assign_complete after update of status on tests for each row execute function complete_assignment_on_publish();
-- ====================================================================
-- ROW LEVEL SECURITY
-- ====================================================================
alter table series_requests           enable row level security;
alter table test_assignments          enable row level security;
alter table assignment_status_progress enable row level security;
alter table assignment_comments       enable row level security;
alter table assignment_history        enable row level security;
alter table assignment_notifications  enable row level security;
drop policy if exists requests_admin      on series_requests;
drop policy if exists assign_admin        on test_assignments;
drop policy if exists assign_edu_r        on test_assignments;
drop policy if exists progress_read       on assignment_status_progress;
drop policy if exists acomm_admin         on assignment_comments;
drop policy if exists acomm_edu           on assignment_comments;
drop policy if exists ahist_admin         on assignment_history;
drop policy if exists ahist_edu           on assignment_history;
drop policy if exists anotif_admin        on assignment_notifications;
drop policy if exists anotif_own          on assignment_notifications;
create policy requests_admin  on series_requests for all using (is_admin()) with check (is_admin());
create policy assign_admin on test_assignments for all using (is_admin()) with check (is_admin());
create policy assign_edu_r on test_assignments for select using (educator_id = auth.uid());   -- educators change status only via the functions above
create policy progress_read on assignment_status_progress for select using (auth.uid() is not null);
create policy acomm_admin on assignment_comments for all using (is_admin()) with check (is_admin());
create policy acomm_edu   on assignment_comments for select
  using (exists (select 1 from test_assignments a where a.id = assignment_id and a.educator_id = auth.uid()));
create policy ahist_admin on assignment_history for all using (is_admin()) with check (is_admin());
create policy ahist_edu   on assignment_history for select
  using (exists (select 1 from test_assignments a where a.id = assignment_id and a.educator_id = auth.uid()));
create policy anotif_admin on assignment_notifications for all using (is_admin()) with check (is_admin());
create policy anotif_own   on assignment_notifications for select using (educator_id = auth.uid());


