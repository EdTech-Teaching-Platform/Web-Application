-- =====================================================================
-- 20261028100300_educator_series_approval.sql
--
-- Purpose
--   Approval workflow for series an educator creates on their own
--   (origin 'educator', no active assignment):
--     educator_submit_series_for_approval(p_series_id)          educator -> jsonb
--     list_pending_series_approvals(p_search, p_page, p_size)    admin -> (row_data, total_count)
--     approve_educator_series(p_series_id)                       admin -> jsonb (publish result)
--     reject_educator_series(p_series_id, p_reason)              admin -> jsonb
--   States (test_series_admin.status): draft | rejected -> pending_approval
--   -> published / scheduled (approve) | rejected (reject). While pending, the
--   educator can read but not change the series (adm_require_series_access).
--   Approve publishes through adm_publish_series_core, the same path as
--   adm_publish_test_series.
--   Decisions notify the educator in the lead's notifications (category
--   'moderation', reference_type 'educator_series'); skipped, never failing
--   the decision, if the lead's CHECK refuses it or the educator turned off
--   in-app 'moderation' notifications.
--
-- ROLLBACK (whole set: scripts/rollback_20261028_educator_series.sql)
--   drop function if exists public.reject_educator_series(uuid, text);
--   drop function if exists public.approve_educator_series(uuid);
--   drop function if exists public.list_pending_series_approvals(text, int, int);
--   drop function if exists public.educator_submit_series_for_approval(uuid);
--   drop function if exists public.adm_notify_series_decision(uuid, text, text);
--   drop function if exists public.adm_series_content_problem(uuid);
-- =====================================================================
set search_path = public, extensions;

-- The publish checks without publishing: window, every test has questions,
-- every question has a correct answer, at least one test, no subjective
-- question (20261027090000). Null when the series can be published.
create or replace function public.adm_series_content_problem(p_series uuid) returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  s     public.test_series;
  v_msg text;
begin
  select * into s from public.test_series where id = p_series;
  if s.available_from is not null and s.available_until is not null and s.available_until <= s.available_from then
    return 'The closing time must be after the opening time.';
  end if;
  v_msg := public.adm_series_publish_problem(p_series);
  if v_msg is not null then return v_msg; end if;
  if not exists (select 1 from public.quizzes where series_id = p_series) then
    return 'Add at least one test before publishing.';
  end if;
  select format('"%s" has a short answer, long answer or subjective question. They are coming soon; remove it first.', q.title)
    into v_msg
    from public.quizzes q join public.quiz_questions qq on qq.quiz_id = q.id
   where q.series_id = p_series and public.adm_question_is_subjective(qq.id)
   order by q.series_sort_order, q.created_at
   limit 1;
  return v_msg;
end $$;

create or replace function public.adm_notify_series_decision(p_series uuid, p_decision text, p_reason text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user  uuid;
  v_title text;
begin
  select sa.created_by, s.title into v_user, v_title
    from public.test_series_admin sa join public.test_series s on s.id = sa.series_id
   where sa.series_id = p_series;
  if v_user is null then return; end if;
  if exists (select 1 from public.notification_preferences np
              where np.user_id = v_user and np.category = 'moderation' and not np.in_app) then
    return;
  end if;
  begin
    insert into public.notifications (user_id, category, title, body, action_url, reference_type, reference_id)
    values (v_user, 'moderation',
            case when p_decision = 'approved' then 'Your test series is approved' else 'Your test series needs changes' end,
            left(case when p_decision = 'approved' then format('"%s" is now live for students.', v_title)
                      else format('"%s" was not approved. Reason: %s Edit it and submit it again.', v_title, coalesce(p_reason, '—')) end, 2000),
            '/teacher/test-series', 'educator_series', p_series);
  exception when check_violation or foreign_key_violation or not_null_violation then
    raise notice 'series decision notification skipped: %', sqlerrm;
  end;
end $$;

-- ------------------------------------------------------------ educator
create or replace function public.educator_submit_series_for_approval(p_series_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_status text;
  v_msg    text;
begin
  perform public.adm_require_verified_educator();
  perform public.adm_require_series_owner(p_series_id);   -- also refuses while pending
  if not public.adm_series_is_independent_educator(p_series_id) then
    raise exception 'This series is assigned to you by an admin: publish it directly instead.' using errcode = '22023';
  end if;
  select sa.status into v_status from public.test_series_admin sa where sa.series_id = p_series_id for update;
  if v_status not in ('draft', 'rejected') then
    raise exception 'Only a draft or a rejected series can be submitted (this one is %).', v_status using errcode = '22023';
  end if;
  v_msg := public.adm_series_content_problem(p_series_id);
  if v_msg is not null then raise exception '%', v_msg using errcode = '22023'; end if;

  update public.test_series_admin
     set status = 'pending_approval', submitted_at = now(), rejection_reason = null
   where series_id = p_series_id;
  perform public.adm_sync_series_to_lead(p_series_id);
  perform public.adm_audit('test_series.submit_for_approval', 'test_series', p_series_id,
                           jsonb_build_object('status', v_status), jsonb_build_object('status', 'pending_approval'), null);
  return jsonb_build_object('series_id', p_series_id, 'status', 'pending_approval', 'submitted_at', now());
end $$;

-- --------------------------------------------------------------- admin
create or replace function public.list_pending_series_approvals(
  p_search text default null, p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 10), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with f as (
    select s.id, s.title, sa.code, sa.submitted_at, sa.created_by as educator_id,
           coalesce(ep.full_name, p.full_name) as educator_name, p.email as educator_email,
           coalesce(cat.name, sa.subject_label) as subject_name, sa.audience, sa.pricing, sa.price_inr,
           (select count(*) from public.quizzes q where q.series_id = s.id) as test_count,
           (select count(*) from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id where q.series_id = s.id) as question_count,
           s.created_at
      from public.test_series_admin sa
      join public.test_series s on s.id = sa.series_id
      left join public.profiles p on p.id = sa.created_by
      left join public.educator_profiles ep on ep.user_id = sa.created_by
      left join public.categories cat on cat.id = sa.subject_category_id
     where sa.status = 'pending_approval' and sa.deleted_at is null
       and (v_like is null or (s.title || ' ' || coalesce(sa.code, '') || ' ' || coalesce(ep.full_name, p.full_name, '')
                               || ' ' || coalesce(p.email, '')) ilike v_like)
  )
  select to_jsonb(f), count(*) over ()
    from f
   order by f.submitted_at nulls last, f.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

create or replace function public.approve_educator_series(p_series_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_status text;
  v        jsonb;
begin
  perform public.adm_require_admin();
  select sa.status into v_status from public.test_series_admin sa
   where sa.series_id = p_series_id and sa.deleted_at is null for update;
  if v_status is null then raise exception 'Test series not found.' using errcode = 'P0002'; end if;
  if v_status <> 'pending_approval' then
    raise exception 'Only a series waiting for approval can be approved (this one is %).', v_status using errcode = '22023';
  end if;
  update public.test_series_admin set approved_by = auth.uid(), approved_at = now(), rejection_reason = null
   where series_id = p_series_id;
  v := public.adm_publish_series_core(p_series_id, true);   -- same path as adm_publish_test_series
  perform public.adm_audit('test_series.approve', 'test_series', p_series_id,
                           jsonb_build_object('status', v_status), jsonb_build_object('status', v ->> 'status'), null);
  perform public.adm_notify_series_decision(p_series_id, 'approved', null);
  return v;
end $$;

create or replace function public.reject_educator_series(p_series_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_status text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform public.adm_require_admin();
  if v_reason is null then raise exception 'A reason is required.' using errcode = '22023'; end if;
  select sa.status into v_status from public.test_series_admin sa
   where sa.series_id = p_series_id and sa.deleted_at is null for update;
  if v_status is null then raise exception 'Test series not found.' using errcode = 'P0002'; end if;
  if v_status <> 'pending_approval' then
    raise exception 'Only a series waiting for approval can be rejected (this one is %).', v_status using errcode = '22023';
  end if;
  update public.test_series_admin set status = 'rejected', rejection_reason = left(v_reason, 2000)
   where series_id = p_series_id;
  perform public.adm_sync_series_to_lead(p_series_id);
  perform public.adm_audit('test_series.reject', 'test_series', p_series_id,
                           jsonb_build_object('status', v_status), jsonb_build_object('status', 'rejected'), v_reason);
  perform public.adm_notify_series_decision(p_series_id, 'rejected', v_reason);
  return jsonb_build_object('series_id', p_series_id, 'status', 'rejected', 'rejection_reason', v_reason);
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_series_content_problem(uuid) from public, anon, authenticated;
revoke all on function public.adm_notify_series_decision(uuid, text, text) from public, anon, authenticated;
revoke all on function public.educator_submit_series_for_approval(uuid) from public, anon;
revoke all on function public.list_pending_series_approvals(text, int, int) from public, anon;
revoke all on function public.approve_educator_series(uuid) from public, anon;
revoke all on function public.reject_educator_series(uuid, text) from public, anon;
grant execute on function public.educator_submit_series_for_approval(uuid) to authenticated;
grant execute on function public.list_pending_series_approvals(text, int, int) to authenticated;
grant execute on function public.approve_educator_series(uuid) to authenticated;
grant execute on function public.reject_educator_series(uuid, text) to authenticated;
