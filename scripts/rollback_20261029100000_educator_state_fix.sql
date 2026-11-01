-- =====================================================================
-- scripts/rollback_20261029100000_educator_state_fix.sql   (GENERATED)
--
-- Undoes 20261029100000_educator_state_fix.sql: restores the 11 replaced
-- functions verbatim from the files named above them, then drops the new
-- ones. Backfilled educator_admin_state rows / review states stay.
-- One transaction. Run only with "approved: rollback 20261029100000".
-- =====================================================================
begin;
set local search_path = public, extensions;

-- adm_educator_verified (from 20261029090000_educator_gate_hardening.sql)
create or replace function public.adm_educator_verified(p_user uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1
      from public.profiles p
      join public.educator_profiles ep on ep.user_id = p.id
      join public.educator_admin_state st on st.user_id = p.id
     where p.id = p_user
       and p.role = 'educator'
       and st.review_state = 'approved'
       and ep.verification_status = 'verified'
       and st.account_status = 'active');
$$;

-- adm_is_verified_educator (from 20261029090000_educator_gate_hardening.sql)
create or replace function public.adm_is_verified_educator() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select public.adm_educator_verified(auth.uid());
$$;

-- adm_educator_verification_key (from 20261029090000_educator_gate_hardening.sql)
create or replace function public.adm_educator_verification_key(p_lead text, p_review text) returns text
language sql immutable set search_path = public, extensions as $$
  select case
    when p_lead = 'verified' and p_review = 'approved' then 'verified'
    when p_review = 'rejected' or (p_lead = 'rejected' and p_review is null) then 'rejected'
    when p_review in ('under_review', 'changes_requested') then p_review
    when p_review = 'draft' then 'draft'
    when p_lead is null or p_lead in ('pending', 'verified', 'rejected') then 'pending'
    else p_lead
  end;
$$;

-- set_educator_verification (from 20261028090200_educator_admin_review.sql)
create or replace function public.set_educator_verification(p_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
  v_lead     text;
  v_review   text;
  v_old      text;
  v_new      text;
begin
  perform public.adm_require_admin();
  if v_decision = 'approved' then v_decision := 'verified'; end if;
  if v_decision not in ('verified', 'rejected', 'pending', 'under_review', 'changes_requested') then
    raise exception 'Unknown verification decision: %', p_decision using errcode = '22023';
  end if;
  if v_decision in ('rejected', 'changes_requested') and v_note is null then
    raise exception 'A reason is required.' using errcode = '22023';
  end if;

  select ep.verification_status into v_lead
    from public.educator_profiles ep where ep.user_id = p_id for update;
  if not found then
    raise exception 'This educator has not completed their profile yet.' using errcode = 'P0002';
  end if;
  perform public.adm_ensure_educator_state(p_id);
  select st.review_state into v_review from public.educator_admin_state st where st.user_id = p_id for update;
  v_old := public.adm_educator_verification_key(v_lead, v_review);

  if v_decision = 'verified' then
    update public.educator_profiles
       set verification_status = 'verified', verified_at = now(), verified_by = auth.uid(), rejected_reason = null
     where user_id = p_id;
    update public.educator_admin_state set review_state = 'approved', review_note = v_note where user_id = p_id;
  elsif v_decision = 'rejected' then
    update public.educator_profiles set verification_status = 'rejected', rejected_reason = v_note where user_id = p_id;
    update public.educator_admin_state set review_state = 'rejected', review_note = v_note where user_id = p_id;
  elsif v_decision = 'pending' then
    update public.educator_profiles set verification_status = 'pending' where user_id = p_id;
    update public.educator_admin_state set review_state = null, review_note = v_note where user_id = p_id;
  else  -- under_review | changes_requested: lead value stays 'pending' (D7)
    update public.educator_profiles set verification_status = 'pending' where user_id = p_id;
    update public.educator_admin_state set review_state = v_decision, review_note = v_note where user_id = p_id;
  end if;

  v_new := v_decision;   -- equals adm_educator_verification_key() of the row just written
  perform public.adm_audit('educator.verification', 'educator', p_id,
                           jsonb_build_object('value', v_old), jsonb_build_object('value', v_new), v_note);
  if v_new <> v_old then
    perform public.adm_notify_educator_verification(p_id, v_new, v_note);
  end if;
end $$;

-- set_educator_account_status (from 20261025100800_admin_rpc_educators.sql)
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

  update public.educator_admin_state
     set account_status = p_status,
         status_reason  = case when p_status = 'active' then null else nullif(btrim(coalesce(p_reason, '')), '') end,
         suspended_at   = case when p_status = 'suspended' then now() else null end
   where user_id = p_id;
  if p_status <> 'active' then
    perform public.adm_end_user_sessions(p_id, 'account_' || p_status);
  end if;
  perform public.adm_audit('educator.account_status', 'educator', p_id,
                           jsonb_build_object('value', v_old), jsonb_build_object('value', p_status), p_reason);
  return public.adm_open_assignment_count(p_id, array['assigned', 'in_progress', 'revision_requested']);
end $$;

-- adm_educator_status_json (from 20261029090000_educator_gate_hardening.sql)
create or replace function public.adm_educator_status_json(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  r        record;
  v_status text;
  v_note   text;
  v_ids    int;
begin
  select ep.user_id is not null as has_profile, ep.verification_status, ep.rejected_reason,
         st.review_state, st.review_note, st.status_reason, st.submitted_at,
         coalesce(st.account_status, 'active') as account_status
    into r
    from public.profiles p
    left join public.educator_profiles ep on ep.user_id = p.id
    left join public.educator_admin_state st on st.user_id = p.id
   where p.id = p_user;

  -- 20261029090000: verified / rejected follow our review_state, never the
  -- educator-editable lead value alone.
  v_status := case
    when r.account_status in ('inactive', 'suspended', 'deleted') then 'suspended'
    when public.adm_educator_verified(p_user) then 'verified'
    when r.review_state = 'rejected' or (r.verification_status = 'rejected' and r.review_state is null) then 'rejected'
    when r.review_state = 'changes_requested' then 'changes_requested'
    when r.review_state = 'under_review' then 'under_review'
    when not coalesce(r.has_profile, false) or r.review_state = 'draft' then 'draft'
    else 'pending' end;
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

-- list_educators (from 20261025100800_admin_rpc_educators.sql)
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
begin
  perform public.adm_require_admin();
  return query
  with f as (
    select b.* from public.adm_educator_base() b
     where (v_like is null or b.full_name ilike v_like or b.email ilike v_like
            or coalesce(b.educator_code, '') ilike v_like)
       and (p_account is null or p_account in ('', 'all') or b.account_status = p_account)
       and (p_verification is null or p_verification in ('', 'all')
            or (p_verification in ('pending', 'under_review')
                and b.verification_status in ('pending', 'under_review', 'changes_requested'))
            or b.verification_status = p_verification)
       and (p_subject is null or p_subject in ('', 'all') or p_subject = any (b.subjects))
       and (p_experience is null or p_experience in ('', 'all')
            or (p_experience = '0-3'  and b.years_experience <= 3)
            or (p_experience = '4-7'  and b.years_experience between 4 and 7)
            or (p_experience = '8-12' and b.years_experience between 8 and 12)
            or (p_experience = '13+'  and b.years_experience >= 13))
  )
  select to_jsonb(f) || jsonb_build_object(
           'initials', public.adm_initials(f.full_name),
           'verification_label', case when f.verification_status in ('under_review', 'changes_requested')
                                      then 'pending' else f.verification_status end),
         count(*) over ()
    from f
   order by case when p_sort = 'oldest'   then f.joined_at end asc,
            case when p_sort = 'rating'   then f.rating end desc nulls last,
            case when p_sort = 'students' then f.students_count end desc,
            case when coalesce(p_sort, 'newest') = 'newest' then f.joined_at end desc,
            f.full_name, f.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

-- get_educator_stats (from 20261025100800_admin_rpc_educators.sql)
create or replace function public.get_educator_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (select jsonb_build_object(
            'total_educators',      count(*),
            'active_educators',     count(*) filter (where b.account_status = 'active'),
            'pending_verification', count(*) filter (where b.verification_status in ('pending', 'under_review', 'changes_requested')),
            'suspended_educators',  count(*) filter (where b.account_status = 'suspended'))
            from public.adm_educator_base() b);
end $$;

-- adm_educator_base (from 20261025100800_admin_rpc_educators.sql)
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
         public.adm_educator_verification_key(ep.verification_status, st.review_state),
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

-- educator_submit_onboarding (from 20261028090100_educator_onboarding.sql)
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
         bio = v_form ->> 'bio',
         verification_status = 'pending'
   where user_id = v_uid;
  update public.profiles
     set full_name = v_form ->> 'full_name', phone = v_form ->> 'phone', location = v_form ->> 'location'
   where id = v_uid;
  insert into public.educator_admin_state (user_id) values (v_uid) on conflict (user_id) do nothing;
  update public.educator_admin_state set review_state = 'submitted', submitted_at = now() where user_id = v_uid;
  update public.educator_onboarding set step = 5 where user_id = v_uid;

  perform public.adm_audit('educator.onboarding_submit', 'educator', v_uid,
                           jsonb_build_object('value', v_status ->> 'status'), jsonb_build_object('value', 'pending'), null);
  return public.adm_educator_status_json(v_uid);
end $$;

-- register_educator (from 20261025100800_admin_rpc_educators.sql)
create or replace function public.register_educator(p_user_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_email    text := lower(btrim(coalesce(p ->> 'email', '')));
  v_bulk     boolean := coalesce((p ->> 'bulk')::boolean, false);
  v_name     text;
  v_existing text;
  v_subjects text[];
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

  insert into public.educator_admin_state (user_id, gender, dob, onboarded_via)
  values (p_user_id, nullif(btrim(coalesce(p ->> 'gender', '')), ''),
          case when coalesce(p ->> 'dob', '') ~ '^\d{4}-\d{2}-\d{2}$' then (p ->> 'dob')::date end,
          case when v_bulk then 'bulk_import' else 'admin_invite' end)
  on conflict (user_id) do nothing;

  update public.educator_invites set user_id = p_user_id
   where lower(email) = v_email and user_id is null and status in ('pending', 'sent');

  perform public.adm_audit('educator.register', 'educator', p_user_id, null,
                           jsonb_build_object('email', v_email, 'bulk', v_bulk), null);
  return p_user_id;
end $$;

drop function if exists public.list_assignable_educators(text, text, int, int);
drop function if exists public.adm_backfill_educator_state();
drop function if exists public.adm_set_educator_state(uuid, text, text, uuid);
drop function if exists public.adm_educator_decision_state(text);
drop function if exists public.adm_educator_effective_state(uuid);
drop function if exists public.adm_educator_review_state(uuid);

commit;
