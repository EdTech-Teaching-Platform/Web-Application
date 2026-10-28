-- =====================================================================
-- 20261028100400_educator_series_portal.sql
--
-- Purpose
--   Teacher-portal RPCs for VERIFIED educators. Every function starts with
--   `perform public.adm_require_verified_educator();` (enforcement rule,
--   checked by supabase/tests/educator_onboarding.sql):
--     educator_list_assignments(p_status)                     -> jsonb array
--     educator_get_assignment(p_assignment_id)                -> jsonb
--     educator_start_assignment(p_assignment_id)              -> jsonb (assignment)
--     educator_add_assignment_comment(p_assignment_id, p_comment, p_question_id)
--     educator_get_profile() / educator_update_profile(p_fields)
--     educator_get_stats() / educator_get_dashboard()
--   Contract: docs/EDUCATOR_RPC_CONTRACT.md.
--
--   Assignments use the real test_assignments columns and statuses; history
--   rows are written with adm_asg_log as the admin RPCs do. Starting an
--   assignment creates its test through create_test (the admin's function),
--   which the assignee may call through adm_require_series_access.
--   No student identity is returned: stats are counts and averages only.
--   Earnings are not returned (payments are on hold, F4).
--
-- ROLLBACK (whole set: scripts/rollback_20261028_educator_series.sql)
--   drop function if exists public.educator_get_dashboard();
--   drop function if exists public.educator_get_stats();
--   drop function if exists public.educator_update_profile(jsonb);
--   drop function if exists public.educator_get_profile();
--   drop function if exists public.educator_add_assignment_comment(uuid, text, uuid);
--   drop function if exists public.educator_start_assignment(uuid);
--   drop function if exists public.educator_get_assignment(uuid);
--   drop function if exists public.educator_list_assignments(text);
--   drop function if exists public.adm_educator_assignment_json(uuid);
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------- assignments
-- The caller's assignment: requirements, history, comments, and the test
-- built for it (if any). Null when it isn't theirs.
create or replace function public.adm_educator_assignment_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
           'assignment', to_jsonb(v) - 'educator_name',
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

-- p_status: null / 'all' | 'open' (not completed / cancelled / rejected) | 'overdue' | any status
create or replace function public.educator_list_assignments(p_status text default null) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_verified_educator();
  return coalesce((
    select jsonb_agg((to_jsonb(v) - 'educator_name')
                     || jsonb_build_object('series_status', sa.status,
                                           'comment_count', (select count(*) from public.assignment_comments c where c.assignment_id = v.id))
                     order by v.deadline nulls last, v.code)
      from public.adm_assignment_rows() v
      left join public.test_series_admin sa on sa.series_id = v.series_id
     where v.educator_id = auth.uid()
       and (p_status is null or p_status in ('', 'all')
            or (p_status = 'open' and v.status not in ('completed', 'cancelled', 'rejected'))
            or (p_status = 'overdue' and v.display_status = 'overdue')
            or v.status = p_status)), '[]'::jsonb);
end $$;

create or replace function public.educator_get_assignment(p_assignment_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v jsonb;
begin
  perform public.adm_require_verified_educator();
  v := public.adm_educator_assignment_json(p_assignment_id);
  if v is null then raise exception 'Assignment not found.' using errcode = 'P0002'; end if;
  return v;
end $$;

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
    v_test := public.create_test(a.series_id, jsonb_build_object(
      'name', coalesce(nullif(btrim(a.test_name), ''), 'Test'),
      'instructions', coalesce(a.instructions, ''),
      'duration', a.duration_minutes,
      'totalMarks', a.total_marks,
      'plannedQuestions', a.question_count,
      'topics', to_jsonb(a.topics)));
    update public.test_assignments set test_id = (v_test ->> 'id')::uuid where id = a.id;
  end if;
  if a.status = 'assigned' then
    update public.test_assignments set status = 'in_progress' where id = a.id;
    perform public.adm_asg_log(a.id, 'Started', 'The educator started building the test.');
    perform public.adm_audit('assignment.start', 'test_assignment', a.id,
                             jsonb_build_object('status', a.status), jsonb_build_object('status', 'in_progress'), null);
  end if;
  return public.adm_educator_assignment_json(a.id);
end $$;

create or replace function public.educator_add_assignment_comment(
  p_assignment_id uuid, p_comment text, p_question_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_text text := btrim(coalesce(p_comment, ''));
  v_id   uuid;
  a      public.test_assignments;
begin
  perform public.adm_require_verified_educator();
  select * into a from public.test_assignments where id = p_assignment_id and educator_id = auth.uid();
  if a.id is null then raise exception 'Assignment not found.' using errcode = 'P0002'; end if;
  if char_length(v_text) < 1 or char_length(v_text) > 2000 then
    raise exception 'Write a comment of up to 2000 characters.' using errcode = '22023';
  end if;
  if p_question_id is not null and not exists (
       select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
        where qq.id = p_question_id and q.series_id = a.series_id) then
    raise exception 'That question is not in this assignment''s series.' using errcode = '22023';
  end if;
  insert into public.assignment_comments (assignment_id, question_id, comment, author_id)
  values (a.id, p_question_id, v_text, auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'comment', v_text, 'question_id', p_question_id, 'from', 'me', 'created_at', now());
end $$;

-- -------------------------------------------------------------- profile
create or replace function public.educator_get_profile() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid();
begin
  perform public.adm_require_verified_educator();
  return (
    select jsonb_build_object(
             'id', p.id, 'email', p.email, 'educator_code', st.educator_code,
             'full_name', coalesce(ep.full_name, p.full_name), 'phone', nullif(coalesce(nullif(ep.phone, ''), p.phone), ''),
             'location', nullif(ep.location, 'Not provided'), 'bio', ep.bio, 'photo_url', ep.photo_url,
             'qualifications', ep.qualifications, 'experience_years', ep.experience_years,
             'subjects', to_jsonb(coalesce(ep.subjects::text[], '{}'::text[])),
             'languages', to_jsonb(coalesce(ep.languages::text[], '{}'::text[])),
             'verification_status', ep.verification_status, 'verified_at', ep.verified_at,
             'rating_avg', ep.rating_avg, 'joined_at', coalesce(ep.created_at, p.created_at),
             'documents', (select coalesce(jsonb_agg(jsonb_build_object(
                                     'doc_type', d.doc_type, 'doc_name', d.doc_name,
                                     'status', case d.is_verified when true then 'approved' when false then 'rejected' else 'pending' end,
                                     'uploaded_at', d.created_at) order by d.doc_type, d.doc_name), '[]'::jsonb)
                             from public.educator_verification_docs d where d.educator_id = p.id))
      from public.profiles p
      join public.educator_profiles ep on ep.user_id = p.id
      left join public.educator_admin_state st on st.user_id = p.id
     where p.id = v_uid);
end $$;

-- p_fields: any of bio, qualifications, experience_years, subjects, languages,
-- phone, location, photo_url. Other keys are refused. Field errors: 22023
-- "Check the highlighted fields." with DETAIL {field: message}.
create or replace function public.educator_update_profile(p_fields jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid     uuid := auth.uid();
  v_allowed text[] := array['bio', 'qualifications', 'experience_years', 'subjects', 'languages', 'phone', 'location', 'photo_url'];
  v_bad     text[];
  v_errors  jsonb;
  v_form    jsonb;
  v_photo   text;
  v_before  jsonb;
  v_clean   jsonb := '{}'::jsonb;
begin
  perform public.adm_require_verified_educator();
  if jsonb_typeof(p_fields) is distinct from 'object' or p_fields = '{}'::jsonb then
    raise exception 'Nothing to update.' using errcode = '22023';
  end if;
  select array_agg(k) into v_bad from jsonb_object_keys(p_fields) k where k <> all (v_allowed);
  if v_bad is not null then
    raise exception 'These fields can''t be changed here: %', array_to_string(v_bad, ', ') using errcode = '42501';
  end if;

  v_before := public.educator_get_profile();
  -- validate the changed fields with the onboarding rules
  v_form := jsonb_build_object('full_name', v_before ->> 'full_name', 'phone', v_before ->> 'phone',
                               'location', v_before ->> 'location', 'qualifications', v_before ->> 'qualifications',
                               'experience_years', v_before -> 'experience_years', 'subjects', v_before -> 'subjects',
                               'languages', v_before -> 'languages', 'bio', v_before ->> 'bio') || (p_fields - 'photo_url');
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_errors
    from jsonb_each(public.adm_educator_validate(v_form, 0)) e
   where p_fields ? e.key;
  if p_fields ? 'photo_url' then
    v_photo := nullif(btrim(coalesce(p_fields ->> 'photo_url', '')), '');
    if v_photo is not null and (position(v_uid::text || '/' in v_photo) <> 1 or v_photo !~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,200}$') then
      v_errors := v_errors || jsonb_build_object('photo_url', 'Upload the photo through the portal.');
    end if;
  end if;
  if v_errors <> '{}'::jsonb then
    raise exception 'Check the highlighted fields.' using errcode = '22023', detail = v_errors::text;
  end if;

  if p_fields ? 'phone' or p_fields ? 'location' then
    v_clean := v_clean || public.adm_educator_clean(v_form, 1) - 'full_name';
  end if;
  if p_fields ? 'qualifications' or p_fields ? 'experience_years' then
    v_clean := v_clean || public.adm_educator_clean(v_form, 2);
  end if;
  if p_fields ? 'subjects' or p_fields ? 'languages' or p_fields ? 'bio' then
    v_clean := v_clean || public.adm_educator_clean(v_form, 3);
  end if;

  update public.educator_profiles set
    phone            = case when p_fields ? 'phone' then v_clean ->> 'phone' else phone end,
    location         = case when p_fields ? 'location' then v_clean ->> 'location' else location end,
    qualifications   = case when p_fields ? 'qualifications' then v_clean ->> 'qualifications' else qualifications end,
    experience_years = case when p_fields ? 'experience_years' then (v_clean ->> 'experience_years')::int else experience_years end,
    subjects         = case when p_fields ? 'subjects' then (select array_agg(x) from jsonb_array_elements_text(v_clean -> 'subjects') x) else subjects end,
    languages        = case when p_fields ? 'languages' then (select array_agg(x) from jsonb_array_elements_text(v_clean -> 'languages') x) else languages end,
    bio              = case when p_fields ? 'bio' then v_clean ->> 'bio' else bio end,
    photo_url        = case when p_fields ? 'photo_url' then v_photo else photo_url end
  where user_id = v_uid;
  if p_fields ? 'phone' or p_fields ? 'location' then
    update public.profiles set
      phone    = case when p_fields ? 'phone' then v_clean ->> 'phone' else phone end,
      location = case when p_fields ? 'location' then v_clean ->> 'location' else location end
    where id = v_uid;
  end if;
  perform public.adm_audit('educator.profile_update', 'educator', v_uid, v_before - 'documents',
                           public.educator_get_profile() - 'documents', null);
  return public.educator_get_profile();
end $$;

-- ---------------------------------------------------------------- stats
create or replace function public.educator_get_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_verified_educator();
  return (
    with mine as (select x as id from public.adm_educator_series_ids() x),
         ser as (select s.id, s.title, coalesce(sa.status, 'draft') as status
                   from mine join public.test_series s on s.id = mine.id
                   left join public.test_series_admin sa on sa.series_id = s.id
                  where sa.deleted_at is null),
         qz  as (select q.id, q.series_id from public.quizzes q join ser on ser.id = q.series_id),
         att as (select a.quiz_id, qz.series_id, a.student_id, a.percentage, a.passed, a.submitted_at
                   from public.quiz_attempts a join qz on qz.id = a.quiz_id
                  where a.status in ('submitted', 'timed_out')),
         asg as (select a.status, a.deadline from public.test_assignments a where a.educator_id = auth.uid()),
         fb  as (select f.rating from public.test_feedback f join ser on ser.id = f.series_id
                  where f.kind = 'feedback' and f.rating is not null)
    select jsonb_build_object(
      'series', jsonb_build_object(
        'total', (select count(*) from ser),
        'by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                        from (select status, count(*) as n from ser group by status) x)),
      'tests', (select count(*) from qz),
      'questions', (select count(*) from public.quiz_questions qq join qz on qz.id = qq.quiz_id),
      'learners', (select count(*) from (select student_id from att
                                         union
                                         select st.student_id from public.adm_series_students() st join ser on ser.id = st.series_id) l),
      'attempts', (select count(*) from att),
      'average_score', coalesce((select round(avg(percentage), 1) from att), 0),
      'pass_rate', coalesce((select round(100.0 * count(*) filter (where passed) / nullif(count(*), 0), 1) from att), 0),
      'per_series', (select coalesce(jsonb_agg(jsonb_build_object(
                                       'series_id', ser.id, 'title', ser.title, 'status', ser.status,
                                       'attempts', coalesce(m.n, 0), 'average_score', coalesce(m.avg_pct, 0),
                                       'pass_rate', coalesce(m.pass_rate, 0))
                                     order by coalesce(m.n, 0) desc, ser.title), '[]'::jsonb)
                       from ser
                       left join (select series_id, count(*) as n, round(avg(percentage), 1) as avg_pct,
                                         round(100.0 * count(*) filter (where passed) / nullif(count(*), 0), 1) as pass_rate
                                    from att group by series_id) m on m.series_id = ser.id),
      'trend', (select coalesce(jsonb_agg(jsonb_build_object('week', w.week, 'attempts', coalesce(t.n, 0),
                                                             'average_score', coalesce(t.avg_pct, 0)) order by w.week), '[]'::jsonb)
                  from (select (date_trunc('week', now()) - make_interval(weeks => g))::date as week
                          from generate_series(0, 11) g) w
                  left join (select date_trunc('week', submitted_at)::date as week, count(*) as n,
                                    round(avg(percentage), 1) as avg_pct
                               from att where submitted_at >= date_trunc('week', now()) - interval '11 weeks'
                              group by 1) t on t.week = w.week),
      'assignments', jsonb_build_object(
        'open', (select count(*) from asg where status not in ('completed', 'cancelled', 'rejected')),
        'due_soon', (select count(*) from asg where status not in ('completed', 'cancelled', 'rejected', 'approved')
                       and deadline between current_date and current_date + 7),
        'overdue', (select count(*) from asg where status not in ('completed', 'cancelled', 'rejected', 'approved')
                      and deadline < current_date),
        'completed', (select count(*) from asg where status = 'completed')),
      'ratings', jsonb_build_object(
        'count', (select count(*) from fb),
        'average', coalesce((select round(avg(rating), 2) from fb), 0),
        'distribution', (select jsonb_build_object('1', count(*) filter (where rating = 1), '2', count(*) filter (where rating = 2),
                                                   '3', count(*) filter (where rating = 3), '4', count(*) filter (where rating = 4),
                                                   '5', count(*) filter (where rating = 5)) from fb))));
end $$;

create or replace function public.educator_get_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_stats jsonb;
begin
  perform public.adm_require_verified_educator();
  v_stats := public.educator_get_stats();
  return jsonb_build_object(
    'assigned', (select coalesce(jsonb_agg(jsonb_build_object(
                                   'id', v.id, 'code', v.code, 'test_name', v.test_name, 'series_id', v.series_id,
                                   'series_name', v.series_name, 'deadline', v.deadline, 'status', v.status,
                                   'display_status', v.display_status, 'progress', v.progress)
                                 order by v.deadline nulls last, v.code), '[]'::jsonb)
                   from (select * from public.adm_assignment_rows() x
                          where x.educator_id = auth.uid() and x.status not in ('completed', 'cancelled', 'rejected')
                          order by x.deadline nulls last limit 5) v),
    'drafts', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'status', sa.status,
                                                            'rejection_reason', sa.rejection_reason, 'updated_at', s.updated_at)
                                         order by s.updated_at desc), '[]'::jsonb)
                 from (select * from public.test_series_admin x
                        where x.created_by = auth.uid() and x.deleted_at is null and x.status in ('draft', 'rejected')
                        order by x.updated_at desc limit 5) sa
                 join public.test_series s on s.id = sa.series_id),
    'pending_approval', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'submitted_at', sa.submitted_at)
                                                   order by sa.submitted_at), '[]'::jsonb)
                           from public.test_series_admin sa join public.test_series s on s.id = sa.series_id
                          where sa.created_by = auth.uid() and sa.deleted_at is null and sa.status = 'pending_approval'),
    'published_count', coalesce((v_stats #>> '{series,by_status,published}')::int, 0),
    'recent_activity', (select coalesce(jsonb_agg(jsonb_build_object('action', l.action, 'target_type', l.target_type,
                                                                     'target_id', l.target_id, 'at', l.created_at)
                                                  order by l.created_at desc), '[]'::jsonb)
                          from (select * from public.audit_logs x where x.actor_id = auth.uid()
                                 order by x.created_at desc limit 10) l),
    'stats', jsonb_build_object('learners', v_stats -> 'learners', 'attempts', v_stats -> 'attempts',
                                'average_score', v_stats -> 'average_score', 'pass_rate', v_stats -> 'pass_rate',
                                'series', v_stats #> '{series,total}', 'assignments', v_stats -> 'assignments',
                                'rating', v_stats #> '{ratings,average}'));
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_educator_assignment_json(uuid) from public, anon, authenticated;
revoke all on function public.educator_list_assignments(text) from public, anon;
revoke all on function public.educator_get_assignment(uuid) from public, anon;
revoke all on function public.educator_start_assignment(uuid) from public, anon;
revoke all on function public.educator_add_assignment_comment(uuid, text, uuid) from public, anon;
revoke all on function public.educator_get_profile() from public, anon;
revoke all on function public.educator_update_profile(jsonb) from public, anon;
revoke all on function public.educator_get_stats() from public, anon;
revoke all on function public.educator_get_dashboard() from public, anon;
grant execute on function public.educator_list_assignments(text) to authenticated;
grant execute on function public.educator_get_assignment(uuid) to authenticated;
grant execute on function public.educator_start_assignment(uuid) to authenticated;
grant execute on function public.educator_add_assignment_comment(uuid, text, uuid) to authenticated;
grant execute on function public.educator_get_profile() to authenticated;
grant execute on function public.educator_update_profile(jsonb) to authenticated;
grant execute on function public.educator_get_stats() to authenticated;
grant execute on function public.educator_get_dashboard() to authenticated;
