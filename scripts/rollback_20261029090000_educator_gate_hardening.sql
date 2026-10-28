-- =====================================================================
-- scripts/rollback_20261029090000_educator_gate_hardening.sql   (GENERATED)
--
-- Undoes 20261029090000_educator_gate_hardening.sql: restores the four
-- functions verbatim from the files named above them, then drops
-- adm_educator_verified and adm_backfill_educator_approvals.
-- WARNING: this re-opens the hole (verification_status alone grants access).
-- The backfilled review_state = 'approved' values stay.
-- One transaction. Run only with "approved: rollback 20261029090000".
-- =====================================================================
begin;
set local search_path = public, extensions;

-- from 20261028090100_educator_onboarding.sql
create or replace function public.adm_is_verified_educator() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1
      from public.profiles p
      join public.educator_profiles ep on ep.user_id = p.id
      left join public.educator_admin_state st on st.user_id = p.id
     where p.id = auth.uid()
       and p.role = 'educator'
       and ep.verification_status = 'verified'
       and coalesce(st.account_status, 'active') = 'active');
$$;

-- from 20261028090100_educator_onboarding.sql
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

  v_status := case
    when r.account_status in ('inactive', 'suspended', 'deleted') then 'suspended'
    when r.verification_status = 'verified' then 'verified'
    when r.verification_status = 'rejected' then 'rejected'
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

-- from 20261028090200_educator_admin_review.sql
create or replace function public.adm_educator_verification_key(p_lead text, p_review text) returns text
language sql immutable set search_path = public, extensions as $$
  select case
    when p_lead = 'verified' then 'verified'
    when p_lead = 'rejected' then 'rejected'
    when p_review in ('under_review', 'changes_requested') then p_review
    when p_review = 'draft' then 'draft'      -- 20261028090200: not submitted yet
    when p_lead is null or p_lead = 'pending' then 'pending'
    else p_lead
  end;
$$;

-- from 20261025110400_admin_b2_authoring_helpers.sql
create or replace function public.adm_eligible_educators()
returns table (id uuid, name text, subjects text[])
language sql stable security definer set search_path = public, extensions as $$
  select p.id, coalesce(ep.full_name, p.full_name), coalesce(ep.subjects::text[], '{}'::text[])
    from public.profiles p
    join public.educator_profiles ep on ep.user_id = p.id
    left join public.educator_admin_state st on st.user_id = p.id
   where p.role = 'educator' and ep.verification_status = 'verified'
     and coalesce(st.account_status, 'active') = 'active';
$$;

drop function if exists public.adm_backfill_educator_approvals();
drop function if exists public.adm_educator_verified(uuid);

commit;
