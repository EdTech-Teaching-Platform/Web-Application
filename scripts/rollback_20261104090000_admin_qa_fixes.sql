-- =====================================================================
-- scripts/rollback_20261104090000_admin_qa_fixes.sql   (GENERATED)
--
-- Undoes 20261104090000_admin_qa_fixes.sql: restores the 8 replaced
-- functions verbatim from the files named above them, then drops the new
-- ones. The backfill (rejected educators set inactive) is NOT undone: with the
-- old effective-state rule those educators would read "suspended"; to revert
-- it too, run:
--   update public.educator_admin_state set account_status = 'active'
--    where account_status = 'inactive' and review_state = 'rejected';
-- One transaction. Run only with "approved: rollback 20261104090000".
-- =====================================================================
begin;
set local search_path = public, extensions;

-- adm_educator_effective_state (from 20261029100000_educator_state_fix.sql)
create or replace function public.adm_educator_effective_state(p_educator_id uuid) returns text
language sql stable security definer set search_path = public, extensions as $$
  select case
           when coalesce(st.account_status, 'active') in ('inactive', 'suspended', 'deleted') then 'suspended'
           else public.adm_educator_review_state(p.id) end
    from public.profiles p
    left join public.educator_admin_state st on st.user_id = p.id
   where p.id = p_educator_id and p.role = 'educator';
$$;

-- adm_set_educator_state (from 20261029100000_educator_state_fix.sql)
create or replace function public.adm_set_educator_state(p_educator_id uuid, p_state text, p_note text, p_actor uuid)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_state  text := lower(btrim(coalesce(p_state, '')));
  v_note   text := nullif(btrim(coalesce(p_note, '')), '');
  v_by_admin boolean := p_actor is distinct from p_educator_id;
  v_before text;
  v_after  text;
  v_old    text;
begin
  if not exists (select 1 from public.profiles where id = p_educator_id and role = 'educator') then
    raise exception 'Educator not found.' using errcode = 'P0002';
  end if;
  if v_state not in ('pending', 'under_review', 'changes_requested', 'approved', 'rejected', 'active', 'inactive', 'suspended') then
    raise exception 'Unknown educator state: %', p_state using errcode = '22023';
  end if;
  perform public.adm_ensure_educator_state(p_educator_id);
  select account_status into v_old from public.educator_admin_state where user_id = p_educator_id for update;

  -- account
  if v_state in ('active', 'inactive', 'suspended') then
    update public.educator_admin_state
       set account_status = v_state,
           status_reason  = case when v_state = 'active' then null else v_note end,
           suspended_at   = case when v_state = 'suspended' then now() end
     where user_id = p_educator_id;
    if v_state <> 'active' then
      perform public.adm_end_user_sessions(p_educator_id, 'account_' || v_state);
    end if;
    if v_by_admin then
      perform public.adm_audit('educator.account_status', 'educator', p_educator_id,
                               jsonb_build_object('value', v_old), jsonb_build_object('value', v_state), v_note);
    end if;
    return public.adm_educator_effective_state(p_educator_id);
  end if;

  -- review
  if v_state in ('rejected', 'changes_requested') and v_note is null then
    raise exception 'A reason is required.' using errcode = '22023';
  end if;
  perform 1 from public.educator_profiles where user_id = p_educator_id for update;
  if not found then
    raise exception 'This educator has not completed their profile yet.' using errcode = 'P0002';
  end if;
  v_before := public.adm_educator_review_state(p_educator_id);

  update public.educator_admin_state
     set review_state = case v_state when 'pending' then 'submitted' else v_state end,
         review_note  = v_note,
         submitted_at = case when v_state = 'pending' and not v_by_admin then now() else submitted_at end
   where user_id = p_educator_id;
  update public.educator_profiles
     set verification_status = case v_state when 'approved' then 'verified' when 'rejected' then 'rejected' else 'pending' end,
         verified_at     = case when v_state = 'approved' then now() end,
         verified_by     = case when v_state = 'approved' then p_actor end,
         rejected_reason = case when v_state = 'rejected' then v_note end
   where user_id = p_educator_id;

  v_after := public.adm_educator_review_state(p_educator_id);
  if v_by_admin then
    perform public.adm_audit('educator.verification', 'educator', p_educator_id,
                             jsonb_build_object('value', v_before), jsonb_build_object('value', v_after), v_note);
  end if;
  if v_after is distinct from v_before then
    perform public.adm_notify_educator_verification(p_educator_id,
      case v_after when 'approved' then 'verified' else v_after end, v_note);
  end if;
  return public.adm_educator_effective_state(p_educator_id);
end $$;

-- list_educators (from 20261029100000_educator_state_fix.sql)
create or replace function public.list_educators(
  p_search text default null, p_account text default null, p_verification text default null,
  p_subject text default null, p_experience text default null, p_sort text default 'newest',
  p_page int default 1, p_size int default 8
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 8), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
  v_ver  text := case lower(coalesce(p_verification, '')) when 'verified' then 'approved' else lower(coalesce(p_verification, '')) end;
begin
  perform public.adm_require_admin();
  return query
  with f as (
    select b.*,
           case when b.account_status in ('inactive', 'suspended') then 'suspended' else b.verification_status end as effective_state
      from public.adm_educator_base() b
     where (v_like is null or b.full_name ilike v_like or b.email ilike v_like
            or coalesce(b.educator_code, '') ilike v_like)
       and (p_account is null or p_account in ('', 'all') or b.account_status = p_account)
       and (v_ver in ('', 'all')
            or (v_ver = 'pending' and b.verification_status in ('pending', 'under_review'))
            or (v_ver = 'suspended' and b.account_status in ('inactive', 'suspended'))
            or b.verification_status = v_ver)
       and (p_subject is null or p_subject in ('', 'all') or p_subject = any (b.subjects))
       and (p_experience is null or p_experience in ('', 'all')
            or (p_experience = '0-3'  and b.years_experience <= 3)
            or (p_experience = '4-7'  and b.years_experience between 4 and 7)
            or (p_experience = '8-12' and b.years_experience between 8 and 12)
            or (p_experience = '13+'  and b.years_experience >= 13))
  )
  select to_jsonb(f) || jsonb_build_object('initials', public.adm_initials(f.full_name),
                                           'verification_label', f.verification_status),
         count(*) over ()
    from f
   order by case when p_sort = 'oldest'   then f.joined_at end asc,
            case when p_sort = 'rating'   then f.rating end desc nulls last,
            case when p_sort = 'students' then f.students_count end desc,
            case when coalesce(p_sort, 'newest') = 'newest' then f.joined_at end desc,
            f.full_name, f.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

-- get_educator_stats (from 20261029100000_educator_state_fix.sql)
create or replace function public.get_educator_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    with b as (
      select x.*, case when x.account_status in ('inactive', 'suspended') then 'suspended' else x.verification_status end as eff
        from public.adm_educator_base() x
    )
    select jsonb_build_object(
             'total_educators',      count(*),
             'active_educators',     count(*) filter (where b.account_status = 'active'),
             'pending_verification', count(*) filter (where b.eff in ('pending', 'under_review')),
             'suspended_educators',  count(*) filter (where b.account_status = 'suspended'),
             'by_state', jsonb_build_object(
               'draft', count(*) filter (where b.eff = 'draft'),
               'pending', count(*) filter (where b.eff = 'pending'),
               'under_review', count(*) filter (where b.eff = 'under_review'),
               'changes_requested', count(*) filter (where b.eff = 'changes_requested'),
               'approved', count(*) filter (where b.eff = 'approved'),
               'rejected', count(*) filter (where b.eff = 'rejected'),
               'suspended', count(*) filter (where b.eff = 'suspended')))
      from b);
end $$;

-- get_educator_detail (from 20261028090200_educator_admin_review.sql)
create or replace function public.get_educator_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_educator jsonb;
begin
  perform public.adm_require_admin();
  select to_jsonb(b) || jsonb_build_object('initials', public.adm_initials(b.full_name))
         -- 20261028090200: self-registration progress
         || jsonb_build_object('review_state', st.review_state, 'submitted_at', st.submitted_at,
                               'onboarding_step', o.step)
    into v_educator
    from public.adm_educator_base() b
    left join public.educator_admin_state st on st.user_id = b.id
    left join public.educator_onboarding o on o.user_id = b.id
   where b.id = p_id;
  if v_educator is null then return null; end if;

  return jsonb_build_object(
    'educator', v_educator,
    'documents', public.list_educator_documents(p_id),
    -- Same shape as the archived educator_status_history rows; now read from audit_logs (D9).
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id,
               'kind', case a.action when 'educator.account_status' then 'account' else 'verification' end,
               'from_value', a.before_state ->> 'value', 'to_value', a.after_state ->> 'value',
               'reason', a.reason, 'by_admin', a.actor_id, 'at', a.created_at)
             order by a.created_at desc)
        from public.audit_logs a
       where a.target_type = 'educator' and a.target_id = p_id
         and a.action in ('educator.account_status', 'educator.verification', 'educator.onboarding_submit')), '[]'::jsonb),
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'title', c.title, 'status', c.status,
               'students', (select count(*) from public.enrollments e where e.course_id = c.id and e.is_active),
               'completion_rate', coalesce((select round(100.0 * count(*) filter (where e.completed_at is not null)
                                                         / nullif(count(*), 0))
                                              from public.enrollments e where e.course_id = c.id), 0),
               'rating', coalesce((select round(avg(r.rating), 1) from public.course_reviews r
                                    where r.course_id = c.id and r.is_visible), 0))
             order by c.created_at desc)
        from public.courses c where c.educator_id = p_id), '[]'::jsonb));
end $$;

-- get_student_detail (from 20261102090000_student_block_enforcement.sql)
create or replace function public.get_student_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  r        jsonb;
  v_series jsonb := '[]'::jsonb;
begin
  perform public.adm_require_admin();

  select jsonb_build_object(
           'id', p.id, 'student_code', s.student_code, 'full_name', p.full_name, 'email', p.email,
           'initials', public.adm_initials(p.full_name), 'grade', sp.grade, 'school_name', sp.school_name,
           'registered_at', p.created_at, 'status', coalesce(s.account_status, 'active'),
           'phone', p.phone, 'city', p.location, 'state', g.state_code,
           'last_active_at', s.last_active_at, 'blocked_reason', s.blocked_reason, 'blocked_at', s.blocked_at,
           'onboarded_via', s.onboarded_via,
           -- 20261102090000: who blocked the student, and the block / unblock trail
           'blocked_by', s.blocked_by, 'blocked_by_name', bp.full_name,
           'block_history', coalesce((
             select jsonb_agg(jsonb_build_object('action', h.action, 'reason', h.reason, 'at', h.at,
                                                 'by', h.by_admin, 'by_name', hp.full_name) order by h.at desc)
               from (select * from public.student_block_history x where x.student_id = p.id order by x.at desc limit 10) h
               left join public.profiles hp on hp.id = h.by_admin), '[]'::jsonb))
    into r
    from public.profiles p
    left join public.student_profiles sp on sp.user_id = p.id
    left join public.students s on s.id = p.id
    left join public.profiles bp on bp.id = s.blocked_by   -- 20261102090000
    left join public.user_geo g on g.user_id = p.id
   where p.id = p_id and p.role = 'student';
  if r is null then return null; end if;

  -- Course enrolments (the lead's model) with lesson completion %.
  r := r || jsonb_build_object('enrolled_courses', coalesce((
    select jsonb_agg(jsonb_build_object(
             'course_id', c.id, 'title', c.title, 'enrolled_at', e.enrolled_at, 'is_active', e.is_active,
             'progress', coalesce((
               select round(100.0 * count(*) filter (where lp.status = 'completed')
                            / nullif((select count(*) from public.lessons l where l.course_id = c.id), 0))
                 from public.lesson_progress lp
                where lp.student_id = p_id and lp.course_id = c.id), 0))
           order by e.enrolled_at desc)
      from public.enrollments e
      join public.courses c on c.id = e.course_id
     where e.student_id = p_id), '[]'::jsonb));

  -- Admin-sold test series enrolments (Batch 2 table), when present.
  if to_regclass('public.admin_series_enrollments') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('series_id', ase.series_id, 'title', ts.title,
                                                   'enrolled_at', ase.enrolled_at, 'progress', 0)
                                order by ase.enrolled_at desc), '[]'::jsonb)
        from public.admin_series_enrollments ase
        join public.test_series ts on ts.id = ase.series_id
       where ase.student_id = $1
    $q$ into v_series using p_id;
  end if;
  return r || jsonb_build_object('enrolled_series', v_series);
end $$;

-- list_series_tracker (from 20261025110800_admin_rpc_tracker.sql)
create or replace function public.list_series_tracker(
  p_search text default null, p_sort text default 'deadline_asc', p_subject text default null,
  p_educator text default null, p_status text default null, p_page int default 1, p_size int default 8
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
    select t.* from public.adm_series_tracker_rows() t
     where (v_like is null or (t.series_name || ' ' || coalesce(t.subject, '')) ilike v_like)
       and (p_subject is null or p_subject in ('', 'all') or t.subject = p_subject)
       and (p_educator is null or p_educator in ('', 'all') or p_educator = any (t.educators))
       and (p_status is null or p_status in ('', 'all') or t.overall_status = p_status)
  )
  select to_jsonb(f) || jsonb_build_object('seriesId', f.series_id), count(*) over ()
    from f
   order by case when p_sort = 'deadline_asc'    then f.deadline end asc nulls last,
            case when p_sort = 'completion_desc' then f.completion_pct end desc,
            case when p_sort = 'name_asc'        then f.series_name end asc,
            f.series_name, f.series_id
   limit v_size offset (v_page - 1) * v_size;
end $$;

-- get_series_tracker_detail (from 20261025110800_admin_rpc_tracker.sql)
create or replace function public.get_series_tracker_detail(p_series uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    select jsonb_build_object(
      'series', to_jsonb(t) || jsonb_build_object('seriesId', t.series_id),
      'assignments', (select coalesce(jsonb_agg(to_jsonb(a) order by a.deadline nulls last, a.code), '[]'::jsonb)
                        from public.adm_assignment_rows() a where a.series_id = p_series))
      from public.adm_series_tracker_rows() t where t.series_id = p_series);
end $$;

drop function if exists public.adm_series_tracker_rows_ext();
drop function if exists public.adm_backfill_rejected_inactive();
drop function if exists public.adm_educator_action_for(uuid, text);
drop function if exists public.adm_educator_actions(uuid);

commit;
