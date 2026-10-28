-- Trial for supabase/migrations/20261029090000_educator_gate_hardening.sql ONLY.
-- Paste all of it into the SQL editor and run: expect "Success. No rows returned"
-- (a NOTICE lists educators left for review, if any). Everything is rolled
-- back, including the backfill (the last line of this file is "rollback;").
begin;

-- =====================================================================
-- 20261029090000_educator_gate_hardening.sql
--
-- Purpose
--   Security fix. The lead's RLS lets an educator update their own
--   educator_profiles row, so educator_profiles.verification_status alone
--   must never grant anything. "Verified" now needs ALL of:
--     profiles.role = 'educator'
--     educator_admin_state.review_state = 'approved'   (our table, RPC-only)
--     educator_profiles.verification_status = 'verified'
--     educator_admin_state.account_status = 'active'   (row required)
--   New helper adm_educator_verified(p_user) holds that rule; replaced (ours,
--   same signatures, grants kept):
--     adm_is_verified_educator()        every verified-only educator RPC and
--                                       every shared series guard goes through it
--     adm_educator_status_json(uuid)    the portal gate: 'verified' / 'rejected'
--                                       come from our review_state, so a self-
--                                       edited lead value shows as 'pending'
--     adm_educator_verification_key(text, text)   the admin lists: same rule
--     adm_eligible_educators()          who can receive assignments
--   Backfill (idempotent, adm_backfill_educator_approvals(), run below):
--   educators already verified in educator_profiles get review_state
--   'approved' (and an educator_admin_state row if they have none) when their
--   review_state is null, i.e. they were verified before review states
--   existed. Rows in an onboarding state (draft / submitted / under_review /
--   changes_requested / rejected) are NOT approved: a verified lead value
--   there was not set by an admin; they are counted in a NOTICE.
--
-- Audit of every writer (no change needed)
--   * set_educator_verification (20261028090200) is the only function that
--     writes verification_status = 'verified'; it sets review_state =
--     'approved' in the same transaction.
--   * register_educator writes only 'pending'; create_educator_invites never
--     writes verification fields; no import path writes them.
--   * Educator-callable functions write review_state only as 'draft'
--     (educator_start_onboarding, when no educator profile exists) and
--     'submitted' (educator_submit_onboarding, only while editable); none
--     writes account_status. educator_admin_state has RLS on, no policies and
--     no grants, so it is RPC-only.
--   * Lead-side verifications (the lead's own app writing 'verified'
--     directly) no longer grant access here until an admin approves through
--     set_educator_verification (or the backfill is run again).
--
-- Preflight (in this file): the replaced functions exist, the review_state
-- CHECK allows 'approved', set_educator_verification writes 'approved', and
-- the new names are free.
--
-- ROLLBACK
--   Run scripts/rollback_20261029090000_educator_gate_hardening.sql: restores
--   the four functions verbatim from 20261028090100 / 20261028090200 /
--   20261025110400 and drops adm_educator_verified and
--   adm_backfill_educator_approvals. The backfilled review_state values stay
--   (they are what set_educator_verification writes anyway).
-- =====================================================================
set search_path = public, extensions;

do $pre$
declare
  v_problems text[] := '{}';
  v_list     text[];
begin
  select coalesce(array_agg(x.sig order by x.sig), '{}') into v_list
    from unnest(array['public.adm_is_verified_educator()', 'public.adm_educator_status_json(uuid)',
                      'public.adm_educator_verification_key(text,text)', 'public.adm_eligible_educators()',
                      'public.set_educator_verification(uuid,text,text)', 'public.adm_educator_validate(jsonb,integer)',
                      'public.adm_educator_form(uuid)']) as x(sig)
   where to_regprocedure(x.sig) is null;
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('missing functions (20261028* not applied?): ' || array_to_string(v_list, ', '));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'educator_admin_state_review_state_check'
                    and pg_get_constraintdef(oid) like '%approved%') then
    v_problems := v_problems || 'educator_admin_state.review_state CHECK does not allow approved'::text;
  end if;
  if to_regprocedure('public.set_educator_verification(uuid,text,text)') is not null
     and pg_get_functiondef('public.set_educator_verification(uuid,text,text)'::regprocedure) not like '%review_state = ''approved''%' then
    v_problems := v_problems || 'set_educator_verification does not write review_state approved (20261028090200 missing?)'::text;
  end if;
  select coalesce(array_agg(p.proname order by p.proname), '{}') into v_list
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('adm_educator_verified', 'adm_backfill_educator_approvals');
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('functions already exist: ' || array_to_string(v_list, ', '));
  end if;
  if cardinality(v_problems) > 0 then
    raise exception 'Educator gate hardening preflight: %', array_to_string(v_problems, '; ');
  end if;
end $pre$;

-- ------------------------------------------------------------- the rule
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

create or replace function public.adm_is_verified_educator() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select public.adm_educator_verified(auth.uid());
$$;

-- Who can receive assignments: the same rule.
create or replace function public.adm_eligible_educators()
returns table (id uuid, name text, subjects text[])
language sql stable security definer set search_path = public, extensions as $$
  select p.id, coalesce(ep.full_name, p.full_name), coalesce(ep.subjects::text[], '{}'::text[])
    from public.profiles p
    join public.educator_profiles ep on ep.user_id = p.id
   where p.role = 'educator' and public.adm_educator_verified(p.id);
$$;

-- Admin key: 'verified' / 'rejected' only when our review state agrees.
-- (A null review state with a lead 'rejected' is a pre-20261028 rejection.)
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

-- The portal gate's status (same keys as before).
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

-- ------------------------------------------------------------- backfill
-- Educators verified before review states existed (review_state null, or no
-- educator_admin_state row) become 'approved'. Returns the number of rows
-- created or updated; idempotent.
create or replace function public.adm_backfill_educator_approvals() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_new     int;
  v_updated int;
  v_skipped int;
begin
  insert into public.educator_admin_state (user_id, review_state)
  select ep.user_id, 'approved'
    from public.educator_profiles ep
    join public.profiles p on p.id = ep.user_id and p.role = 'educator'
   where ep.verification_status = 'verified'
     and not exists (select 1 from public.educator_admin_state st where st.user_id = ep.user_id)
  on conflict (user_id) do nothing;
  get diagnostics v_new = row_count;

  update public.educator_admin_state st
     set review_state = 'approved'
    from public.educator_profiles ep
    join public.profiles p on p.id = ep.user_id and p.role = 'educator'
   where st.user_id = ep.user_id and ep.verification_status = 'verified' and st.review_state is null;
  get diagnostics v_updated = row_count;

  select count(*) into v_skipped
    from public.educator_profiles ep
    join public.educator_admin_state st on st.user_id = ep.user_id
   where ep.verification_status = 'verified' and st.review_state <> 'approved';
  if v_skipped > 0 then
    raise notice 'educator approvals: % educator(s) have a verified lead value but an onboarding review state; left for an admin to review', v_skipped;
  end if;
  return v_new + v_updated;
end $$;

select public.adm_backfill_educator_approvals();

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_educator_verified(uuid) from public, anon, authenticated;
revoke all on function public.adm_backfill_educator_approvals() from public, anon, authenticated;
-- unchanged grants of the replaced functions, restated
revoke all on function public.adm_is_verified_educator() from public, anon;
grant execute on function public.adm_is_verified_educator() to authenticated;
revoke all on function public.adm_educator_status_json(uuid) from public, anon, authenticated;
revoke all on function public.adm_eligible_educators() from public, anon, authenticated;

-- smoke checks on the new definitions
do $chk$
begin
  if public.adm_educator_verification_key('verified', null) <> 'pending'
     or public.adm_educator_verification_key('verified', 'approved') <> 'verified'
     or public.adm_educator_verification_key('rejected', null) <> 'rejected' then
    raise exception 'trial: adm_educator_verification_key mapping';
  end if;
  if public.adm_is_verified_educator() then
    raise exception 'trial: the SQL editor user must not be a verified educator';
  end if;
  if exists (select 1 from public.educator_profiles ep join public.profiles p on p.id = ep.user_id and p.role = 'educator'
              left join public.educator_admin_state st on st.user_id = ep.user_id
              where ep.verification_status = 'verified' and (st.user_id is null or st.review_state is null)) then
    raise exception 'trial: the backfill left a legacy verified educator without approval';
  end if;
end $chk$;

rollback;
