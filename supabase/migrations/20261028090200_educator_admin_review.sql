-- =====================================================================
-- 20261028090200_educator_admin_review.sql
--
-- Purpose
--   Make the EXISTING admin educator RPCs handle self-registered educators
--   (20261028090100). Replaced (ours, same signatures, grants kept):
--     adm_educator_verification_key(text, text)
--         review_state 'draft' -> 'draft' (not in the pending queue until the
--         educator submits); 'submitted' / 'approved' / 'rejected' read as
--         before through the lead value.
--     set_educator_verification(uuid, text, text)
--         approve  -> verification_status 'verified', verified_at, verified_by,
--                     rejected_reason cleared, review_state 'approved'
--         reject   -> verification_status 'rejected', rejected_reason = note,
--                     review_state 'rejected'
--         changes_requested / under_review -> lead 'pending', review_state set
--         pending  -> lead 'pending', review_state null
--         approve / reject / changes requested insert an in-app notification
--         for the educator (category 'verification', reference_type
--         'educator_verification'); skipped when the lead's CHECK or the
--         educator's notification_preferences (in_app = false) refuse it, never
--         failing the decision.
--     get_educator_detail(uuid)
--         educator also carries review_state, submitted_at and
--         onboarding_step.
--   New helper: adm_notify_educator_verification(uuid, text, text).
--
--   Unchanged and already correct for self-registered educators:
--   list_educators (pending filter = pending / under_review /
--   changes_requested; drafts have their own 'draft' key), get_educator_stats,
--   list_educator_documents, review_educator_document.
--
-- Lead objects written
--   educator_profiles (verification fields, as before), notifications (insert),
--   audit_logs via adm_audit.
--
-- ROLLBACK
--   Run scripts/rollback_20261028_educator_onboarding.sql: restores the
--   three functions verbatim from 20261025100100 / 20261025100800 and drops
--   adm_notify_educator_verification.
-- =====================================================================
set search_path = public, extensions;

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

-- In-app notice for a verification decision. Never raises.
create or replace function public.adm_notify_educator_verification(p_user uuid, p_decision text, p_note text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_title text;
  v_body  text;
begin
  if p_decision not in ('verified', 'rejected', 'changes_requested') then return; end if;
  if exists (select 1 from public.notification_preferences np
              where np.user_id = p_user and np.category = 'verification' and not np.in_app) then
    return;
  end if;
  v_title := case p_decision
    when 'verified' then 'Your educator profile is approved'
    when 'rejected' then 'Your educator application was not approved'
    else 'Changes requested on your educator application' end;
  v_body := case p_decision
    when 'verified' then 'You can now create and publish test series in the teacher portal.'
    when 'rejected' then coalesce('Reason: ' || p_note, 'Contact support for details.') || ' You can update your details and apply again.'
    else coalesce(p_note, 'Please review your application.') || ' Update your details and resubmit.' end;
  begin
    insert into public.notifications (user_id, category, title, body, action_url, reference_type, reference_id)
    values (p_user, 'verification', v_title, left(v_body, 2000), '/teacher', 'educator_verification', p_user);
  exception when check_violation or foreign_key_violation or not_null_violation then
    raise notice 'educator verification notification skipped: %', sqlerrm;
  end;
end $$;

-- p_decision: verified (or approved) | rejected | pending | under_review | changes_requested
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

revoke all on function public.adm_notify_educator_verification(uuid, text, text) from public, anon, authenticated;
revoke all on function public.set_educator_verification(uuid, text, text) from public, anon;
revoke all on function public.get_educator_detail(uuid) from public, anon;
grant execute on function public.set_educator_verification(uuid, text, text) to authenticated;
grant execute on function public.get_educator_detail(uuid) to authenticated;
