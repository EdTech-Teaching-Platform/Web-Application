-- =====================================================================
-- 20261028090100_educator_onboarding.sql
--
-- Purpose
--   Self-registration and onboarding for educators (teacher portal):
--     educator_start_onboarding(p_full_name, p_phone)      -> status json
--     educator_save_onboarding_step(p_step, p_data)        -> onboarding json
--     educator_register_document(p_doc_type, p_path, p_doc_name) -> document json
--     educator_remove_document(p_document_id)              -> onboarding json
--     educator_submit_onboarding()                         -> status json
--     educator_get_status()                                -> status json
--     educator_get_onboarding()                            -> onboarding json
--   Contract: docs/EDUCATOR_RPC_CONTRACT.md.
--
--   Helpers (ours): adm_is_educator(), adm_is_verified_educator(),
--   adm_require_educator(), adm_require_verified_educator() and internal
--   adm_educator_* builders. Every check reads the tables (SECURITY DEFINER);
--   the user is always auth.uid(), never a parameter.
--
--   ENFORCEMENT RULE: every educator_* RPC except the seven above must start
--   with `perform public.adm_require_verified_educator();`
--   (supabase/tests/educator_onboarding.sql checks this for every function).
--
-- Our objects
--   educator_onboarding (new; RLS on, no policies, no browser grants)
--   educator_admin_state: + submitted_at; review_state CHECK widened to
--     draft | submitted | under_review | changes_requested | approved | rejected
--     (our own table; existing values stay valid).
--
-- Lead objects written (through these RPCs only)
--   profiles: one row (role 'educator') only when the caller has none;
--     full_name / phone / location of the caller's own row on submit.
--   educator_profiles: the caller's row; verification_status is only ever
--     set to 'pending' here (verified / rejected are admin decisions).
--   educator_verification_docs: the caller's own rows (doc_url = storage path
--     '<user id>/<file>', the form sign-educator-document signs in
--     EDUCATOR_DOCS_BUCKET).
--   audit_logs via adm_audit.
--
-- Status (educator_get_status.status)
--   suspended          educator_admin_state.account_status inactive / suspended / deleted
--   verified           educator_profiles.verification_status = 'verified'
--   rejected           educator_profiles.verification_status = 'rejected'
--   changes_requested  review_state 'changes_requested'
--   under_review       review_state 'under_review'
--   draft              no educator_profiles row, or review_state 'draft'
--   pending            otherwise (submitted, or invited by an admin)
--
-- ROLLBACK (run as a whole: scripts/rollback_20261028_educator_onboarding.sql, which first restores 090200)
--   drop function if exists public.educator_get_onboarding();
--   drop function if exists public.educator_get_status();
--   drop function if exists public.educator_submit_onboarding();
--   drop function if exists public.educator_remove_document(uuid);
--   drop function if exists public.educator_register_document(text, text, text);
--   drop function if exists public.educator_save_onboarding_step(int, jsonb);
--   drop function if exists public.educator_start_onboarding(text, text);
--   drop function if exists public.adm_educator_documents_json(uuid);
--   drop function if exists public.adm_educator_status_json(uuid);
--   drop function if exists public.adm_educator_form(uuid);
--   drop function if exists public.adm_educator_clean(jsonb, int);
--   drop function if exists public.adm_educator_validate(jsonb, int);
--   drop function if exists public.adm_require_verified_educator();
--   drop function if exists public.adm_require_educator();
--   drop function if exists public.adm_is_verified_educator();
--   drop function if exists public.adm_is_educator();
--   drop table if exists public.educator_onboarding;
--   update public.educator_admin_state set review_state = null
--    where review_state not in ('under_review', 'changes_requested');
--   alter table public.educator_admin_state drop constraint if exists educator_admin_state_review_state_check;
--   alter table public.educator_admin_state add constraint educator_admin_state_review_state_check
--     check (review_state in ('under_review', 'changes_requested'));
--   alter table public.educator_admin_state drop column if exists submitted_at;
-- =====================================================================
set search_path = public, extensions;

-- ------------------------------------------------------------ our tables
alter table public.educator_admin_state add column if not exists submitted_at timestamptz;
alter table public.educator_admin_state drop constraint if exists educator_admin_state_review_state_check;
alter table public.educator_admin_state add constraint educator_admin_state_review_state_check
  check (review_state in ('draft', 'submitted', 'under_review', 'changes_requested', 'approved', 'rejected'));

-- The multi-step form's draft. data keys: full_name, phone, location,
-- qualifications, experience_years, subjects, languages, bio.
create table if not exists public.educator_onboarding (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  step        int not null default 0 check (step between 0 and 5),
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.educator_onboarding enable row level security;
revoke all on table public.educator_onboarding from public, anon, authenticated;

drop trigger if exists trg_educator_onboarding_touch on public.educator_onboarding;
create trigger trg_educator_onboarding_touch before update on public.educator_onboarding
  for each row execute function public.adm_touch_updated_at();

-- --------------------------------------------------------------- guards
create or replace function public.adm_is_educator() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'educator');
$$;

-- Educator role, verified by an admin, and the account is active.
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

create or replace function public.adm_require_educator() returns void
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.adm_is_educator() then
    raise exception 'An educator account is required.' using errcode = '42501';
  end if;
end $$;

create or replace function public.adm_require_verified_educator() returns void
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.adm_is_verified_educator() then
    raise exception 'Your educator account must be verified and active to do this.' using errcode = '42501';
  end if;
end $$;

-- ------------------------------------------------------- form validation
-- Field errors {field: message} for one step (1 personal, 2 qualifications,
-- 3 subjects / languages / bio) or all of them (0). 4 (documents) and
-- 5 (review) have no form fields.
create or replace function public.adm_educator_validate(p jsonb, p_step int) returns jsonb
language plpgsql immutable set search_path = public, extensions as $$
declare
  e   jsonb := '{}'::jsonb;
  v   text;
  arr jsonb;
  n   int;
  total int;
begin
  p := coalesce(p, '{}'::jsonb);
  if p_step in (0, 1) then
    v := btrim(coalesce(p ->> 'full_name', ''));
    if char_length(v) < 2 or char_length(v) > 120 or v !~ '[[:alpha:]]' then
      e := e || jsonb_build_object('full_name', 'Enter your full name (2 to 120 characters).');
    end if;
    v := btrim(coalesce(p ->> 'phone', ''));
    if v !~ '^\+?[0-9 ()-]{7,20}$' or char_length(regexp_replace(v, '[^0-9]', '', 'g')) not between 7 and 15 then
      e := e || jsonb_build_object('phone', 'Enter a valid phone number (7 to 15 digits).');
    end if;
    v := btrim(coalesce(p ->> 'location', ''));
    if char_length(v) < 2 or char_length(v) > 120 or lower(v) = 'not provided' then
      e := e || jsonb_build_object('location', 'Enter your city or location (2 to 120 characters).');
    end if;
  end if;
  if p_step in (0, 2) then
    v := btrim(coalesce(p ->> 'qualifications', ''));
    if char_length(v) < 2 or char_length(v) > 500 then
      e := e || jsonb_build_object('qualifications', 'Enter your qualifications (2 to 500 characters).');
    end if;
    v := btrim(coalesce(p ->> 'experience_years', ''));
    if v !~ '^\d{1,2}$' or v::int > 60 then
      e := e || jsonb_build_object('experience_years', 'Years of experience must be a whole number from 0 to 60.');
    end if;
  end if;
  if p_step in (0, 3) then
    arr := case when jsonb_typeof(p -> 'subjects') = 'array' then p -> 'subjects' end;
    select count(*) filter (where btrim(x) <> '' and char_length(btrim(x)) <= 60), count(*) into n, total
      from jsonb_array_elements_text(coalesce(arr, '[]'::jsonb)) x;
    if arr is null or n = 0 or n > 20 or n <> total then
      e := e || jsonb_build_object('subjects', 'Add 1 to 20 subjects (each up to 60 characters).');
    end if;
    arr := case when jsonb_typeof(p -> 'languages') = 'array' then p -> 'languages' end;
    select count(*) filter (where btrim(x) <> '' and char_length(btrim(x)) <= 40), count(*) into n, total
      from jsonb_array_elements_text(coalesce(arr, '[]'::jsonb)) x;
    if arr is null or n = 0 or n > 10 or n <> total then
      e := e || jsonb_build_object('languages', 'Add 1 to 10 teaching languages (each up to 40 characters).');
    end if;
    v := btrim(coalesce(p ->> 'bio', ''));
    if char_length(v) < 50 or char_length(v) > 1000 then
      e := e || jsonb_build_object('bio', 'Write a short bio of 50 to 1000 characters.');
    end if;
  end if;
  return e;
end $$;

-- The step's fields, trimmed (arrays de-duplicated, years as a number).
create or replace function public.adm_educator_clean(p jsonb, p_step int) returns jsonb
language sql immutable set search_path = public, extensions as $$
  select case p_step
    when 1 then jsonb_build_object('full_name', btrim(p ->> 'full_name'), 'phone', btrim(p ->> 'phone'),
                                   'location', btrim(p ->> 'location'))
    when 2 then jsonb_build_object('qualifications', btrim(p ->> 'qualifications'),
                                   'experience_years', (btrim(p ->> 'experience_years'))::int)
    when 3 then jsonb_build_object(
                  'subjects', (select coalesce(jsonb_agg(s order by o), '[]'::jsonb)
                                 from (select btrim(x) as s, min(i) as o
                                         from jsonb_array_elements_text(p -> 'subjects') with ordinality as t(x, i)
                                        group by btrim(x)) d),
                  'languages', (select coalesce(jsonb_agg(s order by o), '[]'::jsonb)
                                  from (select btrim(x) as s, min(i) as o
                                          from jsonb_array_elements_text(p -> 'languages') with ordinality as t(x, i)
                                         group by btrim(x)) d),
                  'bio', btrim(p ->> 'bio'))
    else '{}'::jsonb end;
$$;

-- The form as the educator last saved it: the draft over the profile.
create or replace function public.adm_educator_form(p_user uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_strip_nulls(jsonb_build_object(
           'full_name', coalesce(ep.full_name, p.full_name),
           'phone', nullif(coalesce(nullif(ep.phone, ''), p.phone), ''),
           'location', nullif(coalesce(ep.location, p.location), 'Not provided'),
           'qualifications', ep.qualifications,
           'experience_years', ep.experience_years,
           'subjects', to_jsonb(ep.subjects::text[]),
           'languages', to_jsonb(ep.languages::text[]),
           'bio', ep.bio))
         || coalesce(o.data, '{}'::jsonb)
    from public.profiles p
    left join public.educator_profiles ep on ep.user_id = p.id
    left join public.educator_onboarding o on o.user_id = p.id
   where p.id = p_user;
$$;

-- The educator's own documents, without signed URLs.
create or replace function public.adm_educator_documents_json(p_user uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'doc_type', d.doc_type, 'doc_name', d.doc_name, 'path', d.doc_url,
           'file_name', regexp_replace(d.doc_url, '^.*/', ''),
           'status', case d.is_verified when true then 'approved' when false then 'rejected' else 'pending' end,
           'note', d.review_note, 'uploaded_at', d.created_at)
         order by d.doc_type, d.doc_name, d.created_at), '[]'::jsonb)
    from public.educator_verification_docs d
   where d.educator_id = p_user;
$$;

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

-- ------------------------------------------------------------ educator RPCs
-- First call after sign-up (email or Google). Creates the caller's profile
-- (role 'educator') only when they have none; never changes an existing role.
-- Idempotent: later calls change nothing and return the status.
create or replace function public.educator_start_onboarding(p_full_name text, p_phone text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_role  text;
  v_name  text := btrim(coalesce(p_full_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_new   boolean := false;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  select p.role into v_role from public.profiles p where p.id = v_uid;
  if v_role is not null and v_role <> 'educator' then
    raise exception 'This email is registered as %. Use a different email to register as an educator.', v_role
      using errcode = '42501';
  end if;
  if v_role is null then
    if char_length(v_name) < 2 or char_length(v_name) > 120 then
      raise exception 'Enter your full name (2 to 120 characters).' using errcode = '22023';
    end if;
    if v_phone is not null and public.adm_educator_validate(jsonb_build_object('phone', v_phone, 'full_name', v_name, 'location', 'x x'), 1) ? 'phone' then
      raise exception 'Enter a valid phone number (7 to 15 digits).' using errcode = '22023';
    end if;
    if coalesce(v_email, '') = '' then
      raise exception 'Your account has no email address.' using errcode = '22023';
    end if;
    if exists (select 1 from public.profiles where lower(email) = v_email and id <> v_uid) then
      raise exception 'An account with this email already exists.' using errcode = '23505';
    end if;
    insert into public.profiles (id, role, full_name, email, phone)
    values (v_uid, 'educator', v_name, v_email, v_phone)
    on conflict (id) do nothing;
    select p.role into v_role from public.profiles p where p.id = v_uid;
    if v_role <> 'educator' then   -- another request created a different profile first
      raise exception 'This email is registered as %. Use a different email to register as an educator.', v_role
        using errcode = '42501';
    end if;
    v_new := true;
  end if;

  if not exists (select 1 from public.educator_profiles where user_id = v_uid) then
    insert into public.educator_profiles (user_id, full_name, phone, location, verification_status, total_students, total_courses)
    select v_uid, coalesce(nullif(v_name, ''), p.full_name), coalesce(v_phone, p.phone, ''), 'Not provided', 'pending', 0, 0
      from public.profiles p where p.id = v_uid
    on conflict (user_id) do nothing;
    insert into public.educator_admin_state (user_id, review_state, onboarded_via)
    values (v_uid, 'draft', 'self')
    on conflict (user_id) do update set review_state = coalesce(educator_admin_state.review_state, 'draft');
    v_new := true;
  else
    insert into public.educator_admin_state (user_id) values (v_uid) on conflict (user_id) do nothing;
  end if;

  insert into public.educator_onboarding (user_id, data)
  values (v_uid, jsonb_strip_nulls(jsonb_build_object('full_name', nullif(v_name, ''), 'phone', v_phone)))
  on conflict (user_id) do nothing;

  if v_new then
    perform public.adm_audit('educator.onboarding_start', 'educator', v_uid, null,
                             jsonb_build_object('email', v_email), null);
  end if;
  return public.adm_educator_status_json(v_uid);
end $$;

-- Saves one step of the form. Raises 22023 "Check the highlighted fields."
-- with DETAIL = {field: message} when a field is invalid; nothing is saved then.
create or replace function public.educator_save_onboarding_step(p_step int, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid    uuid := auth.uid();
  v_errors jsonb;
begin
  perform public.adm_require_educator();
  if p_step is null or p_step not between 1 and 5 then
    raise exception 'Unknown onboarding step: %', p_step using errcode = '22023';
  end if;
  if not (public.adm_educator_status_json(v_uid) ->> 'can_edit')::boolean then
    raise exception 'Your application is with our team; you can''t change it right now.' using errcode = '42501';
  end if;
  v_errors := public.adm_educator_validate(p_data, case when p_step <= 3 then p_step else -1 end);
  if v_errors <> '{}'::jsonb then
    raise exception 'Check the highlighted fields.' using errcode = '22023', detail = v_errors::text;
  end if;

  insert into public.educator_onboarding (user_id, step, data)
  values (v_uid, p_step, public.adm_educator_clean(p_data, p_step))
  on conflict (user_id) do update
    set step = greatest(educator_onboarding.step, excluded.step),
        data = educator_onboarding.data || excluded.data;
  return public.educator_get_onboarding();
end $$;

-- Registers a file the educator uploaded (educator-upload-url) as one of
-- their verification documents. One row per (doc_type, doc_name): uploading
-- again replaces the row's file and resets its review.
--   government_id: doc_name 'front' or 'back' (the ID pictures)
--   other: doc_name 'selfie', or a label for another document
--   degree_certificate, teaching_license, experience_letter, subject_certificate: a label
create or replace function public.educator_register_document(p_doc_type text, p_path text, p_doc_name text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid  uuid := auth.uid();
  v_type text := lower(btrim(coalesce(p_doc_type, '')));
  v_name text := btrim(coalesce(p_doc_name, ''));
  v_path text := btrim(coalesce(p_path, ''));
  v_id   uuid;
  v_size bigint;
  v_mime text;
begin
  perform public.adm_require_educator();
  if not (public.adm_educator_status_json(v_uid) ->> 'can_edit')::boolean then
    raise exception 'Your application is with our team; you can''t change it right now.' using errcode = '42501';
  end if;
  if v_type not in ('government_id', 'degree_certificate', 'teaching_license', 'experience_letter', 'subject_certificate', 'other') then
    raise exception 'Unknown document type: %', p_doc_type using errcode = '22023';
  end if;
  if v_type = 'government_id' then
    v_name := lower(v_name);
    if v_name not in ('front', 'back') then
      raise exception 'An ID picture must be the front or the back.' using errcode = '22023';
    end if;
  elsif v_type = 'other' and lower(v_name) = 'selfie' then
    v_name := 'selfie';
  elsif v_name !~ '^[A-Za-z0-9][A-Za-z0-9 ._()-]{0,119}$' then
    raise exception 'Give the document a name (letters, numbers, spaces, . _ ( ) -; up to 120 characters).' using errcode = '22023';
  end if;
  if position(v_uid::text || '/' in v_path) <> 1 or v_path !~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,200}$' or v_path like '%..%' then
    raise exception 'The file must be uploaded to your own folder.' using errcode = '42501';
  end if;
  select (o.metadata ->> 'size')::bigint, lower(o.metadata ->> 'mimetype') into v_size, v_mime
    from storage.objects o where o.name = v_path
   order by o.created_at desc limit 1;
  if not found then
    raise exception 'The uploaded file was not found. Upload it again.' using errcode = 'P0002';
  end if;
  -- The signed upload URL cannot enforce these, so the stored object is checked.
  if v_size > 5242880 then
    raise exception 'The file is larger than 5 MB.' using errcode = '22023';
  end if;
  if v_mime is not null and v_mime not in ('image/jpeg', 'image/png', 'image/webp')
     and not (v_mime = 'application/pdf'
              and v_type in ('degree_certificate', 'teaching_license', 'experience_letter', 'subject_certificate')) then
    raise exception 'This file type is not allowed for this document (JPEG, PNG or WebP; PDF for certificates).' using errcode = '22023';
  end if;
  if (select count(*) from public.educator_verification_docs where educator_id = v_uid) >= 20 then
    raise exception 'You can keep up to 20 documents. Remove one first.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('educator_doc:' || v_uid || ':' || v_type || ':' || lower(v_name), 0));
  select d.id into v_id from public.educator_verification_docs d
   where d.educator_id = v_uid and d.doc_type = v_type and lower(coalesce(d.doc_name, '')) = lower(v_name)
   order by d.created_at desc limit 1;
  if v_id is null then
    insert into public.educator_verification_docs (educator_id, doc_type, doc_url, doc_name)
    values (v_uid, v_type, v_path, v_name)
    returning id into v_id;
  else
    update public.educator_verification_docs
       set doc_url = v_path, doc_name = v_name, created_at = now(),
           is_verified = null, verified_at = null, verified_by = null, review_note = null
     where id = v_id;
    delete from public.educator_verification_docs d
     where d.educator_id = v_uid and d.doc_type = v_type and lower(coalesce(d.doc_name, '')) = lower(v_name) and d.id <> v_id;
  end if;
  perform public.adm_audit('educator.document_upload', 'educator_document', v_id, null,
                           jsonb_build_object('doc_type', v_type, 'doc_name', v_name), null);
  return (select x from jsonb_array_elements(public.adm_educator_documents_json(v_uid)) x where (x ->> 'id')::uuid = v_id);
end $$;

-- Removes one of the caller's documents (the storage file stays; the
-- bucket's lifecycle or an admin cleans it up).
create or replace function public.educator_remove_document(p_document_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid();
begin
  perform public.adm_require_educator();
  if not (public.adm_educator_status_json(v_uid) ->> 'can_edit')::boolean then
    raise exception 'Your application is with our team; you can''t change it right now.' using errcode = '42501';
  end if;
  delete from public.educator_verification_docs where id = p_document_id and educator_id = v_uid;
  if not found then
    raise exception 'Document not found.' using errcode = 'P0002';
  end if;
  perform public.adm_audit('educator.document_remove', 'educator_document', p_document_id, null, null, null);
  return public.educator_get_onboarding();
end $$;

-- Sends the application for review (again after changes_requested / rejected).
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

-- Powers the teacher portal gate and the pending screen.
create or replace function public.educator_get_status() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_educator();
  return public.adm_educator_status_json(auth.uid());
end $$;

create or replace function public.educator_get_onboarding() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid();
begin
  perform public.adm_require_educator();
  return jsonb_build_object(
    'step', coalesce((select o.step from public.educator_onboarding o where o.user_id = v_uid), 0),
    'data', public.adm_educator_form(v_uid),
    'documents', public.adm_educator_documents_json(v_uid),
    'status', public.adm_educator_status_json(v_uid));
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_require_educator() from public, anon, authenticated;
revoke all on function public.adm_require_verified_educator() from public, anon, authenticated;
revoke all on function public.adm_educator_validate(jsonb, int) from public, anon, authenticated;
revoke all on function public.adm_educator_clean(jsonb, int) from public, anon, authenticated;
revoke all on function public.adm_educator_form(uuid) from public, anon, authenticated;
revoke all on function public.adm_educator_documents_json(uuid) from public, anon, authenticated;
revoke all on function public.adm_educator_status_json(uuid) from public, anon, authenticated;
-- The two checks are callable by signed-in users (Edge Functions call them
-- with the caller's JWT, like adm_is_platform_admin); they only describe the caller.
revoke all on function public.adm_is_educator() from public, anon;
revoke all on function public.adm_is_verified_educator() from public, anon;
grant execute on function public.adm_is_educator() to authenticated;
grant execute on function public.adm_is_verified_educator() to authenticated;

revoke all on function public.educator_start_onboarding(text, text) from public, anon;
revoke all on function public.educator_save_onboarding_step(int, jsonb) from public, anon;
revoke all on function public.educator_register_document(text, text, text) from public, anon;
revoke all on function public.educator_remove_document(uuid) from public, anon;
revoke all on function public.educator_submit_onboarding() from public, anon;
revoke all on function public.educator_get_status() from public, anon;
revoke all on function public.educator_get_onboarding() from public, anon;
grant execute on function public.educator_start_onboarding(text, text) to authenticated;
grant execute on function public.educator_save_onboarding_step(int, jsonb) to authenticated;
grant execute on function public.educator_register_document(text, text, text) to authenticated;
grant execute on function public.educator_remove_document(uuid) to authenticated;
grant execute on function public.educator_submit_onboarding() to authenticated;
grant execute on function public.educator_get_status() to authenticated;
grant execute on function public.educator_get_onboarding() to authenticated;
