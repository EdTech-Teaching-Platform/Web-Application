-- =====================================================================
-- rollback_20261118090000_admin_qa_nov18.sql
-- Undoes supabase/migrations/20261118090000_admin_qa_nov18.sql: drops the
-- self-delete and assignment-test objects and restores the four replaced
-- functions. Run only with "approved:"; take a backup first.
-- Deletions already made stay made (the Auth users stay soft-deleted).
-- =====================================================================
set search_path = public, extensions;
begin;

drop function if exists public.educator_add_assignment_test(uuid);
drop function if exists public.adm_account_delete_self(uuid, text);

-- adm_account_deletion_json: verbatim from 20261111090000_admin_qa_nov11.sql
create or replace function public.adm_account_deletion_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('id', r.id, 'role', r.role, 'reason', r.reason, 'status', r.status,
                            'created_at', r.created_at, 'decided_at', r.decided_at, 'decision_note', r.decision_note)
    from public.account_deletion_requests r where r.id = p_id;
$$;

-- adm_educator_assignment_json: verbatim from 20261028100400_educator_series_portal.sql
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

-- educator_list_assignments: verbatim from 20261028100400_educator_series_portal.sql
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

-- educator_start_assignment: verbatim from 20261028100400_educator_series_portal.sql
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

drop function if exists public.adm_assignment_test_payload(public.test_assignments, int);
drop function if exists public.adm_assignment_test_progress(uuid);
drop table if exists public.assignment_tests;
alter table public.account_deletion_requests drop column if exists self_service;

revoke all on function public.adm_account_deletion_json(uuid) from public, anon, authenticated;
revoke all on function public.adm_educator_assignment_json(uuid) from public, anon, authenticated;
revoke all on function public.educator_list_assignments(text) from public, anon;
revoke all on function public.educator_start_assignment(uuid) from public, anon;
grant execute on function public.educator_list_assignments(text) to authenticated;
grant execute on function public.educator_start_assignment(uuid) to authenticated;

commit;
