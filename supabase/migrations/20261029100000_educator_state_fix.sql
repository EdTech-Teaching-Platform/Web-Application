-- =====================================================================
-- 20261029100000_educator_state_fix.sql   (assembled by gen_state_fix.cjs; see PORT_PROGRESS)
--
-- Purpose
--   ONE educator state machine and ONE writer.
--
--   States (adm_educator_effective_state):
--     draft | pending | under_review | changes_requested | approved | rejected | suspended
--   Derived from OUR educator_admin_state:
--     account_status inactive / suspended / deleted  -> suspended
--     no educator_profiles row or review_state draft -> draft
--     review_state submitted (or null)               -> pending
--     review_state under_review / changes_requested / approved / rejected -> itself
--   The lead's educator_profiles.verification_status is only a fallback for an
--   educator without an educator_admin_state row: 'rejected' -> rejected,
--   anything else -> pending (a self-editable 'verified' alone never approves;
--   see 20261029090000). The backfill below gives every existing educator a
--   row, mapping a lead 'verified' to approved and 'rejected' to rejected, so
--   educators that predate our table keep their state.
--   adm_educator_review_state = the same without the account override (the
--   admin list's verification column; the account is its own column).
--
--   Writer: adm_set_educator_state(p_educator_id, p_state, p_note, p_actor)
--     review states  pending | under_review | changes_requested | approved | rejected
--       -> educator_admin_state.review_state ('pending' is stored as 'submitted'),
--          review_note, submitted_at (when the educator submits), and the lead's
--          verification_status / verified_at / verified_by / rejected_reason
--          (approved -> 'verified'; rejected -> 'rejected' + reason; others -> 'pending');
--     account states active | inactive | suspended
--       -> account_status, status_reason, suspended_at, app sessions ended;
--     audit_logs (educator.verification / educator.account_status) when an
--     admin acts; the verification notification on approved / rejected /
--     changes_requested.
--   Callers: set_educator_verification, set_educator_account_status,
--   educator_submit_onboarding, register_educator.
--
--   Readers now on the state machine: educator_get_status (via
--   adm_educator_status_json; status 'approved' replaces 'verified'),
--   adm_is_verified_educator / adm_educator_verified (approved, not
--   suspended) and through it adm_eligible_educators / list_eligible_educators,
--   adm_educator_base (list_educators, get_educator_stats, get_educator_detail,
--   the educators report), list_educators (status filter), get_educator_stats
--   (+ by_state), new list_assignable_educators.
--
-- Root causes this fixes (details in docs/PORT_PROGRESS.md, 2026-11-01)
--   * EducatorProfile.jsx built all six admin actions eagerly, so one click ran
--     approve + reject + request-changes + deactivate + suspend + DELETE
--     (frontend fix; this file makes the server side consistent).
--   * The UI's "request info" sent 'under_review'; changes requested is its own
--     state now (frontend sends 'changes_requested').
--
-- Lead objects written: educator_profiles (verification fields, through
-- adm_set_educator_state only), notifications, audit_logs.
--
-- ROLLBACK
--   Run scripts/rollback_20261029100000_educator_state_fix.sql (generated):
--   restores every replaced function verbatim from its previous file and
--   drops the new ones. Backfilled educator_admin_state rows stay.
-- =====================================================================
set search_path = public, extensions;

do $pre$
declare
  v_problems text[] := '{}';
  v_list     text[];
begin
  select coalesce(array_agg(x.sig order by x.sig), '{}') into v_list
    from unnest(array[
      'public.set_educator_verification(uuid,text,text)', 'public.set_educator_account_status(uuid,text,text)',
      'public.register_educator(uuid,jsonb)', 'public.educator_submit_onboarding()', 'public.adm_educator_base()',
      'public.list_educators(text,text,text,text,text,text,integer,integer)', 'public.get_educator_stats()',
      'public.adm_educator_status_json(uuid)', 'public.adm_is_verified_educator()', 'public.adm_educator_verified(uuid)',
      'public.adm_educator_verification_key(text,text)', 'public.adm_notify_educator_verification(uuid,text,text)',
      'public.adm_ensure_educator_state(uuid)', 'public.adm_end_user_sessions(uuid,text,uuid)',
      'public.adm_open_assignment_count(uuid,text[])', 'public.adm_audit(text,text,uuid,jsonb,jsonb,text)',
      'public.adm_initials(text)', 'public.adm_like(text)', 'public.adm_require_admin()',
      'public.adm_educator_validate(jsonb,integer)', 'public.adm_educator_form(uuid)'
    ]) as x(sig)
   where to_regprocedure(x.sig) is null;
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('missing functions (20261028* / 20261029090000 not applied?): ' || array_to_string(v_list, ', '));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'educator_admin_state_review_state_check'
                    and pg_get_constraintdef(oid) like '%submitted%' and pg_get_constraintdef(oid) like '%approved%') then
    v_problems := v_problems || 'educator_admin_state.review_state CHECK lacks submitted / approved'::text;
  end if;
  select coalesce(array_agg(p.proname order by p.proname), '{}') into v_list
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('adm_educator_review_state', 'adm_educator_effective_state', 'adm_set_educator_state',
                       'adm_educator_decision_state', 'adm_backfill_educator_state', 'list_assignable_educators');
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('functions already exist: ' || array_to_string(v_list, ', '));
  end if;
  if cardinality(v_problems) > 0 then
    raise exception 'Educator state fix preflight: %', array_to_string(v_problems, '; ');
  end if;
end $pre$;

-- --------------------------------------------------------- state machine
create or replace function public.adm_educator_review_state(p_educator_id uuid) returns text
language sql stable security definer set search_path = public, extensions as $$
  select case
           when ep.user_id is null then 'draft'
           when st.user_id is null then case when ep.verification_status = 'rejected' then 'rejected' else 'pending' end
           when st.review_state is null or st.review_state = 'submitted' then 'pending'
           else st.review_state end
    from public.profiles p
    left join public.educator_profiles ep on ep.user_id = p.id
    left join public.educator_admin_state st on st.user_id = p.id
   where p.id = p_educator_id and p.role = 'educator';
$$;

-- null for anyone who is not an educator.
create or replace function public.adm_educator_effective_state(p_educator_id uuid) returns text
language sql stable security definer set search_path = public, extensions as $$
  select case
           when coalesce(st.account_status, 'active') in ('inactive', 'suspended', 'deleted') then 'suspended'
           else public.adm_educator_review_state(p.id) end
    from public.profiles p
    left join public.educator_admin_state st on st.user_id = p.id
   where p.id = p_educator_id and p.role = 'educator';
$$;

create or replace function public.adm_educator_verified(p_user uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(public.adm_educator_effective_state(p_user) = 'approved', false);
$$;

create or replace function public.adm_is_verified_educator() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select public.adm_educator_verified(auth.uid());
$$;

-- Kept for any caller left: the same vocabulary from (lead value, review_state).
create or replace function public.adm_educator_verification_key(p_lead text, p_review text) returns text
language sql immutable set search_path = public, extensions as $$
  select case
    when p_review in ('draft', 'under_review', 'changes_requested', 'approved', 'rejected') then p_review
    when p_review = 'submitted' then 'pending'
    when p_review is null and p_lead = 'rejected' then 'rejected'
    else 'pending' end;
$$;

-- Admin decision values (any spelling the UI ever sent) -> a state.
create or replace function public.adm_educator_decision_state(p_decision text) returns text
language sql immutable set search_path = public, extensions as $$
  select case lower(btrim(coalesce(p_decision, '')))
    when 'approved' then 'approved' when 'approve' then 'approved' when 'verified' then 'approved' when 'verify' then 'approved'
    when 'rejected' then 'rejected' when 'reject' then 'rejected'
    when 'changes_requested' then 'changes_requested' when 'request_changes' then 'changes_requested'
    when 'request_info' then 'changes_requested'
    when 'under_review' then 'under_review' when 'start_review' then 'under_review'
    when 'pending' then 'pending' when 'reset' then 'pending'
  end;
$$;

-- ---------------------------------------------------------------- writer
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

-- ------------------------------------------------------------ admin RPCs
-- p_decision: approved (verified / approve) | rejected | changes_requested
-- (request_changes / request_info) | under_review | pending. Reason required
-- for rejected and changes_requested.
create or replace function public.set_educator_verification(p_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_state text := public.adm_educator_decision_state(p_decision);
begin
  perform public.adm_require_admin();
  if v_state is null then
    raise exception 'Unknown verification decision: %', p_decision using errcode = '22023';
  end if;
  perform public.adm_set_educator_state(p_id, v_state, p_note, auth.uid());
end $$;

-- p_status: active | inactive | suspended. Returns the educator's open
-- assignment count.
create or replace function public.set_educator_account_status(p_id uuid, p_status text, p_reason text default null)
returns int
language plpgsql security definer set search_path = public, extensions as $$
declare v_old text;
begin
  perform public.adm_require_admin();
  if p_status not in ('active', 'inactive', 'suspended') then
    raise exception 'Unknown account status: %', p_status using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_id and role = 'educator') then
    raise exception 'Educator not found.' using errcode = 'P0002';
  end if;
  perform public.adm_ensure_educator_state(p_id);
  select account_status into v_old from public.educator_admin_state where user_id = p_id for update;
  if v_old = 'deleted' then
    raise exception 'This educator has been deleted.' using errcode = '22023';
  end if;
  if v_old = p_status then
    raise exception 'Educator is already %.', p_status using errcode = '22023';
  end if;
  perform public.adm_set_educator_state(p_id, p_status, p_reason, auth.uid());
  return public.adm_open_assignment_count(p_id, array['assigned', 'in_progress', 'revision_requested']);
end $$;

-- The portal gate (educator_get_status / start / submit). status is the
-- state machine's value ('approved' replaces 'verified').
create or replace function public.adm_educator_status_json(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  r        record;
  v_status text := coalesce(public.adm_educator_effective_state(p_user), 'draft');
  v_note   text;
  v_ids    int;
begin
  select ep.rejected_reason, st.review_note, st.status_reason, st.submitted_at
    into r
    from public.profiles p
    left join public.educator_profiles ep on ep.user_id = p.id
    left join public.educator_admin_state st on st.user_id = p.id
   where p.id = p_user;
  v_note := case v_status
    when 'rejected' then coalesce(r.rejected_reason, r.review_note)
    when 'changes_requested' then r.review_note
    when 'suspended' then r.status_reason end;
  select count(distinct d.doc_name) into v_ids
    from public.educator_verification_docs d
   where d.educator_id = p_user and d.doc_type = 'government_id' and d.doc_name in ('front', 'back');
  return jsonb_build_object(
    'status', v_status,
    'note', v_note,
    'submitted_at', r.submitted_at,
    'can_edit', v_status in ('draft', 'changes_requested', 'rejected'),
    'profile_complete', public.adm_educator_validate(public.adm_educator_form(p_user), 0) = '{}'::jsonb and v_ids = 2);
end $$;

-- p_account: active | inactive | suspended.
-- p_verification: draft | pending (pending + under_review: waiting for an
-- admin) | under_review | changes_requested | approved (or verified) |
-- rejected | suspended (account suspended / inactive).
-- p_experience: 0-3 | 4-7 | 8-12 | 13+.  p_sort: newest | oldest | rating | students
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

-- Assign Educators: every approved, active educator (no filter on fields a
-- self-registered educator may not have; subject is an optional filter).
create or replace function public.list_assignable_educators(
  p_search text default null, p_subject text default null, p_page int default 1, p_size int default 50
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 50), 1), 200);
  v_page int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with e as (
    select p.id, coalesce(ep.full_name, p.full_name) as name, p.email,
           coalesce(ep.subjects::text[], '{}'::text[]) as subjects,
           coalesce(ep.languages::text[], '{}'::text[]) as languages,
           round(ep.rating_avg, 1) as rating,
           (select count(*) from public.test_assignments a
             where a.educator_id = p.id and a.status in ('assigned', 'in_progress', 'submitted', 'under_review', 'revision_requested'))::int
             as open_assignments
      from public.profiles p
      join public.educator_profiles ep on ep.user_id = p.id
     where p.role = 'educator'
       and public.adm_educator_verified(p.id)
  ), f as (
    select e.* from e
     where (v_like is null or e.name ilike v_like or e.email ilike v_like)
       and (p_subject is null or p_subject in ('', 'all')
            or exists (select 1 from unnest(e.subjects) s where lower(btrim(s)) = lower(btrim(p_subject))))
  )
  select to_jsonb(f) || jsonb_build_object('initials', public.adm_initials(f.name)), count(*) over ()
    from f
   order by f.name, f.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

-- ---------------------------------------------------------------- backfill
-- Every educator gets an educator_admin_state row; rows without a review
-- state take it from the lead's value (verified -> approved, rejected ->
-- rejected, a filled-in profile -> submitted). Idempotent; returns rows changed.
create or replace function public.adm_backfill_educator_state() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_new int;
  v_upd int;
begin
  insert into public.educator_admin_state (user_id, review_state)
  select p.id, case ep.verification_status when 'verified' then 'approved' when 'rejected' then 'rejected'
                    else case when ep.user_id is not null then 'submitted' end end
    from public.profiles p
    left join public.educator_profiles ep on ep.user_id = p.id
   where p.role = 'educator'
     and not exists (select 1 from public.educator_admin_state st where st.user_id = p.id)
  on conflict (user_id) do nothing;
  get diagnostics v_new = row_count;

  update public.educator_admin_state st
     set review_state = case ep.verification_status when 'verified' then 'approved' when 'rejected' then 'rejected' else 'submitted' end
    from public.educator_profiles ep
   where ep.user_id = st.user_id and st.review_state is null;
  get diagnostics v_upd = row_count;
  return v_new + v_upd;
end $$;

select public.adm_backfill_educator_state();

-- adm_educator_base: from 20261025100800_admin_rpc_educators.sql, with the marked 20261029100000 edits
create or replace function public.adm_educator_base()
returns table (
  id uuid, educator_code text, full_name text, email text, phone text, subjects text[],
  qualification text, years_experience int, rating numeric, ratings_count bigint, students_count int,
  courses_count int, verification_status text, account_status text, joined_at timestamptz,
  last_active_at timestamptz, status_reason text, onboarded_via text, location text, bio text,
  photo_url text, languages text[], gender text, dob date, review_note text, verified_at timestamptz,
  rejected_reason text, has_profile boolean
)
language sql stable security definer set search_path = public, extensions as $$
  select p.id, st.educator_code,
         coalesce(ep.full_name, p.full_name), p.email, coalesce(nullif(ep.phone, ''), p.phone),
         coalesce(ep.subjects::text[], '{}'::text[]), ep.qualifications, coalesce(ep.experience_years, 0),
         round(ep.rating_avg, 1),
         (select count(*) from public.course_reviews r join public.courses c on c.id = r.course_id
           where c.educator_id = p.id and r.is_visible),
         coalesce(ep.total_students, 0), coalesce(ep.total_courses, 0),
         public.adm_educator_review_state(p.id),   -- 20261029100000: the one state machine
         coalesce(st.account_status, 'active'),
         coalesce(ep.created_at, p.created_at), st.last_active_at, st.status_reason,
         coalesce(st.onboarded_via, 'self'), coalesce(ep.location, p.location), ep.bio, ep.photo_url,
         coalesce(ep.languages::text[], '{}'::text[]), st.gender, st.dob, st.review_note, ep.verified_at,
         ep.rejected_reason, ep.user_id is not null
    from public.profiles p
    left join public.educator_profiles ep on ep.user_id = p.id
    left join public.educator_admin_state st on st.user_id = p.id
   where p.role = 'educator'
     and coalesce(st.account_status, 'active') <> 'deleted';
$$;

-- educator_submit_onboarding: from 20261028090100_educator_onboarding.sql, with the marked 20261029100000 edits
create or replace function public.educator_submit_onboarding() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid    uuid := auth.uid();
  v_status jsonb;
  v_form   jsonb;
  v_errors jsonb;
  v_ids    int;
begin
  perform public.adm_require_educator();
  v_status := public.adm_educator_status_json(v_uid);
  if not (v_status ->> 'can_edit')::boolean then
    raise exception 'This application can''t be submitted now (status: %).', v_status ->> 'status' using errcode = '22023';
  end if;
  v_form := public.adm_educator_form(v_uid);
  v_errors := public.adm_educator_validate(v_form, 0);
  select count(distinct d.doc_name) into v_ids from public.educator_verification_docs d
   where d.educator_id = v_uid and d.doc_type = 'government_id' and d.doc_name in ('front', 'back');
  if v_ids < 2 then
    v_errors := v_errors || jsonb_build_object('documents', 'Upload the front and the back of your ID.');
  end if;
  if v_errors <> '{}'::jsonb then
    raise exception 'Complete every step before you submit.' using errcode = '22023', detail = v_errors::text;
  end if;

  update public.educator_profiles
     set full_name = v_form ->> 'full_name',
         phone = v_form ->> 'phone',
         location = v_form ->> 'location',
         qualifications = v_form ->> 'qualifications',
         experience_years = (v_form ->> 'experience_years')::int,
         subjects = (select array_agg(x) from jsonb_array_elements_text(v_form -> 'subjects') x),
         languages = (select array_agg(x) from jsonb_array_elements_text(v_form -> 'languages') x),
         bio = v_form ->> 'bio'
   where user_id = v_uid;
  update public.profiles
     set full_name = v_form ->> 'full_name', phone = v_form ->> 'phone', location = v_form ->> 'location'
   where id = v_uid;
  -- 20261029100000: the one state writer (review_state submitted, submitted_at, lead 'pending')
  perform public.adm_set_educator_state(v_uid, 'pending', null, v_uid);
  update public.educator_onboarding set step = 5 where user_id = v_uid;

  perform public.adm_audit('educator.onboarding_submit', 'educator', v_uid,
                           jsonb_build_object('value', v_status ->> 'status'), jsonb_build_object('value', 'pending'), null);
  return public.adm_educator_status_json(v_uid);
end $$;

-- register_educator: from 20261025100800_admin_rpc_educators.sql, with the marked 20261029100000 edits
create or replace function public.register_educator(p_user_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_email    text := lower(btrim(coalesce(p ->> 'email', '')));
  v_bulk     boolean := coalesce((p ->> 'bulk')::boolean, false);
  v_name     text;
  v_existing text;
  v_subjects text[];
  v_created  int := 0;   -- 20261029100000
begin
  if not (public.adm_is_service_role() or public.adm_is_platform_admin()) then
    raise exception 'Service role or admin access required.' using errcode = '42501';
  end if;
  if p_user_id is null then raise exception 'A user id is required.' using errcode = '22023'; end if;
  if v_email = '' then raise exception 'Email is required.' using errcode = '22023'; end if;

  v_name := coalesce(nullif(btrim(concat_ws(' ', nullif(btrim(p ->> 'firstName'), ''), nullif(btrim(p ->> 'lastName'), ''))), ''),
                     nullif(btrim(p ->> 'name'), ''),
                     split_part(v_email, '@', 1));

  select role into v_existing from public.profiles where id = p_user_id;
  if v_existing is not null and v_existing <> 'educator' then
    raise exception 'This user already exists with role %.', v_existing using errcode = '23505';
  end if;
  if v_existing is null then
    if exists (select 1 from public.profiles where lower(email) = v_email and id <> p_user_id) then
      raise exception 'An account with this email already exists.' using errcode = '23505';
    end if;
    insert into public.profiles (id, role, full_name, email, phone)
    values (p_user_id, 'educator', v_name, v_email, nullif(btrim(coalesce(p ->> 'phone', '')), ''));
  end if;

  select coalesce(array_agg(btrim(x)) filter (where btrim(x) <> ''), '{}') into v_subjects
    from jsonb_array_elements_text(case when jsonb_typeof(p -> 'subjects') = 'array' then p -> 'subjects' else '[]'::jsonb end) x;

  insert into public.educator_profiles
    (user_id, full_name, phone, location, verification_status, qualifications, experience_years,
     subjects, total_students, total_courses)
  values
    (p_user_id, v_name, coalesce(nullif(btrim(coalesce(p ->> 'phone', '')), ''), ''),
     coalesce(nullif(btrim(coalesce(p ->> 'location', '')), ''), 'Not provided'), 'pending',
     nullif(btrim(coalesce(p ->> 'qualification', '')), ''),
     case when coalesce(p ->> 'yearsExperience', '') ~ '^\d{1,2}$' then (p ->> 'yearsExperience')::int end,
     v_subjects, 0, 0)
  on conflict (user_id) do nothing;
  get diagnostics v_created = row_count;   -- 20261029100000

  insert into public.educator_admin_state (user_id, gender, dob, onboarded_via)
  values (p_user_id, nullif(btrim(coalesce(p ->> 'gender', '')), ''),
          case when coalesce(p ->> 'dob', '') ~ '^\d{4}-\d{2}-\d{2}$' then (p ->> 'dob')::date end,
          case when v_bulk then 'bulk_import' else 'admin_invite' end)
  on conflict (user_id) do nothing;

  -- 20261029100000: a new invited educator starts as pending, through the one state writer
  if v_created > 0 then
    perform public.adm_set_educator_state(p_user_id, 'pending', null, auth.uid());
  end if;

  update public.educator_invites set user_id = p_user_id
   where lower(email) = v_email and user_id is null and status in ('pending', 'sent');

  perform public.adm_audit('educator.register', 'educator', p_user_id, null,
                           jsonb_build_object('email', v_email, 'bulk', v_bulk), null);
  return p_user_id;
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_educator_review_state(uuid) from public, anon, authenticated;
revoke all on function public.adm_educator_effective_state(uuid) from public, anon, authenticated;
revoke all on function public.adm_educator_decision_state(text) from public, anon, authenticated;
revoke all on function public.adm_set_educator_state(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.adm_backfill_educator_state() from public, anon, authenticated;
revoke all on function public.list_assignable_educators(text, text, int, int) from public, anon;
grant execute on function public.list_assignable_educators(text, text, int, int) to authenticated;
-- replaced functions keep their grants; restated
revoke all on function public.adm_educator_verified(uuid) from public, anon, authenticated;
revoke all on function public.adm_is_verified_educator() from public, anon;
grant execute on function public.adm_is_verified_educator() to authenticated;
revoke all on function public.adm_educator_status_json(uuid) from public, anon, authenticated;
revoke all on function public.adm_educator_base() from public, anon, authenticated;
revoke all on function public.register_educator(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.register_educator(uuid, jsonb) to service_role;
