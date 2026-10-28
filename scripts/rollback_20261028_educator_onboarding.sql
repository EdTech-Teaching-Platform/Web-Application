-- =====================================================================
-- scripts/rollback_20261028_educator_onboarding.sql
--
-- Undoes 20261028090200_educator_admin_review.sql and
-- 20261028090100_educator_onboarding.sql (GENERATED from the migration files).
--   1. restores adm_educator_verification_key, set_educator_verification and
--      get_educator_detail verbatim from 20261025100100 / 20261025100800 and
--      drops adm_notify_educator_verification;
--   2. drops the educator RPCs, helpers and educator_onboarding, resets the
--      review_state values Batch 1 does not know, restores the original
--      review_state CHECK and drops educator_admin_state.submitted_at.
-- Rows the RPCs wrote to lead tables stay (profiles, educator_profiles,
-- educator_verification_docs, notifications, audit_logs).
-- One transaction. Run only with "approved: rollback 20261028 educator".
-- =====================================================================
begin;
set local search_path = public, extensions;

-- 1. 20261028090200
-- from 20261025100100
create or replace function public.adm_educator_verification_key(p_lead text, p_review text) returns text
language sql immutable set search_path = public, extensions as $$
  select case
    when p_lead = 'verified' then 'verified'
    when p_lead = 'rejected' then 'rejected'
    when p_review in ('under_review', 'changes_requested') then p_review
    when p_lead is null or p_lead = 'pending' then 'pending'
    else p_lead
  end;
$$;

-- from 20261025100800
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
    update public.educator_admin_state set review_state = null, review_note = v_note where user_id = p_id;
  elsif v_decision = 'rejected' then
    update public.educator_profiles set verification_status = 'rejected', rejected_reason = v_note where user_id = p_id;
    update public.educator_admin_state set review_state = null, review_note = v_note where user_id = p_id;
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
end $$;

-- from 20261025100800
create or replace function public.get_educator_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_educator jsonb;
begin
  perform public.adm_require_admin();
  select to_jsonb(b) || jsonb_build_object('initials', public.adm_initials(b.full_name))
    into v_educator
    from public.adm_educator_base() b where b.id = p_id;
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
         and a.action in ('educator.account_status', 'educator.verification')), '[]'::jsonb),
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

drop function if exists public.adm_notify_educator_verification(uuid, text, text);
revoke all on function public.set_educator_verification(uuid, text, text) from public, anon;
revoke all on function public.get_educator_detail(uuid) from public, anon;
grant execute on function public.set_educator_verification(uuid, text, text) to authenticated;
grant execute on function public.get_educator_detail(uuid) to authenticated;

-- 2. 20261028090100
drop function if exists public.educator_get_onboarding();
drop function if exists public.educator_get_status();
drop function if exists public.educator_submit_onboarding();
drop function if exists public.educator_remove_document(uuid);
drop function if exists public.educator_register_document(text, text, text);
drop function if exists public.educator_save_onboarding_step(int, jsonb);
drop function if exists public.educator_start_onboarding(text, text);
drop function if exists public.adm_educator_documents_json(uuid);
drop function if exists public.adm_educator_status_json(uuid);
drop function if exists public.adm_educator_form(uuid);
drop function if exists public.adm_educator_clean(jsonb, int);
drop function if exists public.adm_educator_validate(jsonb, int);
drop function if exists public.adm_require_verified_educator();
drop function if exists public.adm_require_educator();
drop function if exists public.adm_is_verified_educator();
drop function if exists public.adm_is_educator();
drop table if exists public.educator_onboarding;
update public.educator_admin_state set review_state = null
 where review_state not in ('under_review', 'changes_requested');
alter table public.educator_admin_state drop constraint if exists educator_admin_state_review_state_check;
alter table public.educator_admin_state add constraint educator_admin_state_review_state_check
  check (review_state in ('under_review', 'changes_requested'));
alter table public.educator_admin_state drop column if exists submitted_at;

commit;
