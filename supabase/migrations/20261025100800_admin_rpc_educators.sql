-- =====================================================================
-- 20261025100800_admin_rpc_educators.sql
--
-- Purpose
--   Educator Management RPCs (D4, D7, D8). Names and parameters match
--   src/portals/admin/services/educatorsApi.js:
--     list_educators(p_search, p_account, p_verification, p_subject, p_experience, p_sort, p_page, p_size)
--     get_educator_stats()                -> {total_educators, active_educators, pending_verification, suspended_educators}
--     get_educator_detail(p_id)           -> {educator, documents, history, courses}
--     set_educator_verification(p_id, p_decision, p_note)
--     set_educator_account_status(p_id, p_status, p_reason) -> open assignment count
--     delete_educator(p_id)               -> soft delete (account_status 'deleted')
--     create_educator_invites(p_rows)     -> {created, skipped}
--     register_educator(p_user_id, p)     -> service role only (Edge Function)
--     list_educator_documents(p_educator_id)
--     review_educator_document(p_educator_id, p_document_id, p_status, p_note)
--
-- Lead objects read
--   profiles, educator_profiles, educator_verification_docs, courses,
--   course_reviews, enrollments, audit_logs.
-- Lead objects written (runtime, through these RPCs only)
--   educator_profiles.verification_status / verified_at / verified_by / rejected_reason;
--   educator_verification_docs.is_verified / verified_at / verified_by / review_note;
--   register_educator inserts one profiles row (role 'educator') and one
--   educator_profiles row (D8); audit_logs via adm_audit.
--
-- Assumptions
--   * educator_profiles.verification_status has no CHECK (F2). Only pending /
--     verified / rejected are written; under_review / changes_requested live in
--     educator_admin_state.review_state (D7).
--   * educator_profiles.subjects / languages are text-compatible arrays
--     (the dump shows only "ARRAY"); they are read as text[].
--   * Educators are never hard-deleted: lead rows reference profiles.
--   * Document file paths are returned as stored (doc_url); signed URLs come
--     from an Edge Function in Batch 4.
--
-- ROLLBACK
--   drop function if exists public.review_educator_document(uuid, uuid, text, text);
--   drop function if exists public.list_educator_documents(uuid);
--   drop function if exists public.register_educator(uuid, jsonb);
--   drop function if exists public.create_educator_invites(jsonb);
--   drop function if exists public.delete_educator(uuid);
--   drop function if exists public.set_educator_account_status(uuid, text, text);
--   drop function if exists public.set_educator_verification(uuid, text, text);
--   drop function if exists public.get_educator_detail(uuid);
--   drop function if exists public.get_educator_stats();
--   drop function if exists public.list_educators(text, text, text, text, text, text, int, int);
--   drop function if exists public.adm_educator_base();
-- =====================================================================
set search_path = public, extensions;

-- One row per (non-deleted) educator profile. Missing side rows read as
-- active / pending.
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

-- ------------------------------------------------------------------- list
-- p_account: active | inactive | suspended.  p_verification: pending (covers
-- under_review / changes_requested) | under_review | verified | rejected.
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

-- ------------------------------------------------------------------ stats
-- Returns an object (the archived version returned a one-row table, which
-- EducatorVerification.jsx could not read).
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

-- ---------------------------------------------------------------- documents
create or replace function public.list_educator_documents(p_educator_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', d.id, 'educator_id', d.educator_id, 'doc_type', d.doc_type, 'doc_name', d.doc_name,
             'file_path', d.doc_url,
             'status', case d.is_verified when true then 'approved' when false then 'rejected' else 'pending' end,
             'note', d.review_note, 'uploaded_at', d.created_at,
             'reviewed_by', d.verified_by, 'reviewed_at', d.verified_at)
           order by d.created_at)
      from public.educator_verification_docs d where d.educator_id = p_educator_id), '[]'::jsonb);
end $$;

-- p_status: approved | rejected | pending (pending = "request a replacement")
create or replace function public.review_educator_document(
  p_educator_id uuid, p_document_id uuid, p_status text, p_note text default null
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_before jsonb;
begin
  perform public.adm_require_admin();
  if p_status not in ('approved', 'rejected', 'pending') then
    raise exception 'Unknown document status: %', p_status using errcode = '22023';
  end if;
  if p_status = 'rejected' and nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'A reason is required to reject a document.' using errcode = '22023';
  end if;
  select jsonb_build_object('is_verified', d.is_verified, 'review_note', d.review_note)
    into v_before
    from public.educator_verification_docs d
   where d.id = p_document_id and d.educator_id = p_educator_id
   for update;
  if v_before is null then
    raise exception 'Document not found for this educator.' using errcode = 'P0002';
  end if;

  update public.educator_verification_docs
     set is_verified = case p_status when 'approved' then true when 'rejected' then false else null end,
         verified_at = case when p_status = 'pending' then null else now() end,
         verified_by = case when p_status = 'pending' then null else auth.uid() end,
         review_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_document_id;
  perform public.adm_audit('educator.document_review', 'educator_document', p_document_id, v_before,
                           jsonb_build_object('status', p_status, 'educator_id', p_educator_id), p_note);
end $$;

-- ----------------------------------------------------------------- detail
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

-- ----------------------------------------------------------- verification
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

-- ---------------------------------------------------------- account status
-- p_status: active | inactive | suspended. Returns the educator's open
-- assignment count (0 until Batch 2 creates test_assignments).
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

-- Soft delete: lead tables reference profiles, so nothing is removed.
create or replace function public.delete_educator(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_old text;
begin
  perform public.adm_require_admin();
  if not exists (select 1 from public.profiles where id = p_id and role = 'educator') then
    raise exception 'Educator not found.' using errcode = 'P0002';
  end if;
  if public.adm_open_assignment_count(p_id, array['assigned', 'in_progress', 'submitted', 'under_review', 'revision_requested', 'approved']) > 0 then
    raise exception 'This educator has assignments. Reassign or cancel them first.' using errcode = '23503';
  end if;
  perform public.adm_ensure_educator_state(p_id);
  select account_status into v_old from public.educator_admin_state where user_id = p_id for update;
  if v_old = 'deleted' then return; end if;

  update public.educator_admin_state
     set account_status = 'deleted', deleted_at = now(), status_reason = 'Deleted by admin'
   where user_id = p_id;
  perform public.adm_end_user_sessions(p_id, 'account_deleted');
  perform public.adm_audit('educator.account_status', 'educator', p_id,
                           jsonb_build_object('value', v_old), jsonb_build_object('value', 'deleted'), 'Deleted by admin');
end $$;

-- ------------------------------------------------------------------ invites
-- DB part of "Add teacher" (individual and bulk). The create-educator-invites
-- Edge Function calls this with the admin's JWT, then creates the auth users
-- and calls register_educator with the service role (D8).
-- p_rows: [{name, email, phone?, qualification?, yearsExperience?, subjects?}]
create or replace function public.create_educator_invites(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  r jsonb; v_email text; v_name text; v_years int;
  v_ok int := 0; v_skipped jsonb := '[]'::jsonb;
begin
  perform public.adm_require_admin();
  if jsonb_typeof(coalesce(p_rows, 'null'::jsonb)) <> 'array' then
    raise exception 'Expected an array of invite rows.' using errcode = '22023';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_email := lower(btrim(coalesce(r ->> 'email', '')));
    v_name  := btrim(coalesce(r ->> 'name', ''));
    v_years := case when coalesce(r ->> 'yearsExperience', '') ~ '^\d{1,2}$' then (r ->> 'yearsExperience')::int end;
    if v_email = '' or v_name = '' then
      v_skipped := v_skipped || jsonb_build_object('email', v_email, 'reason', 'Name and email are required');
    elsif v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      v_skipped := v_skipped || jsonb_build_object('email', v_email, 'reason', 'Invalid email');
    elsif exists (select 1 from public.profiles where lower(email) = v_email)
       or exists (select 1 from public.educator_invites where lower(email) = v_email and status in ('pending', 'sent')) then
      v_skipped := v_skipped || jsonb_build_object('email', v_email, 'reason', 'Already exists');
    else
      insert into public.educator_invites (name, phone, email, qualification, years_experience, subjects, invited_by)
      values (v_name, nullif(btrim(coalesce(r ->> 'phone', '')), ''), v_email,
              nullif(btrim(coalesce(r ->> 'qualification', '')), ''), v_years,
              coalesce((select array_agg(btrim(x)) from jsonb_array_elements_text(
                          case when jsonb_typeof(r -> 'subjects') = 'array' then r -> 'subjects' else '[]'::jsonb end) x
                         where btrim(x) <> ''), '{}'),
              auth.uid());
      v_ok := v_ok + 1;
    end if;
  end loop;
  perform public.adm_audit('educator.invites_created', 'educator_invite', null, null,
                           jsonb_build_object('created', v_ok, 'skipped', jsonb_array_length(v_skipped)), null);
  return jsonb_build_object('created', v_ok, 'skipped', v_skipped);
end $$;

-- Service role only (Edge Function, after auth.admin.inviteUserByEmail).
-- Inserts the lead's profiles + educator_profiles rows and our side row (D8).
-- p: {firstName, lastName | name, email, phone, location, qualification,
--     yearsExperience, subjects[], gender, dob, bulk}
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

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_educator_base() from public, anon, authenticated;

revoke all on function public.list_educators(text, text, text, text, text, text, int, int) from public, anon;
revoke all on function public.get_educator_stats() from public, anon;
revoke all on function public.get_educator_detail(uuid) from public, anon;
revoke all on function public.set_educator_verification(uuid, text, text) from public, anon;
revoke all on function public.set_educator_account_status(uuid, text, text) from public, anon;
revoke all on function public.delete_educator(uuid) from public, anon;
revoke all on function public.create_educator_invites(jsonb) from public, anon;
revoke all on function public.list_educator_documents(uuid) from public, anon;
revoke all on function public.review_educator_document(uuid, uuid, text, text) from public, anon;
revoke all on function public.register_educator(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.list_educators(text, text, text, text, text, text, int, int) to authenticated;
grant execute on function public.get_educator_stats() to authenticated;
grant execute on function public.get_educator_detail(uuid) to authenticated;
grant execute on function public.set_educator_verification(uuid, text, text) to authenticated;
grant execute on function public.set_educator_account_status(uuid, text, text) to authenticated;
grant execute on function public.delete_educator(uuid) to authenticated;
grant execute on function public.create_educator_invites(jsonb) to authenticated;
grant execute on function public.list_educator_documents(uuid) to authenticated;
grant execute on function public.review_educator_document(uuid, uuid, text, text) to authenticated;
grant execute on function public.register_educator(uuid, jsonb) to service_role;
