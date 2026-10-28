-- =====================================================================
-- 20261028090000_educator_preflight.sql
--
-- Purpose
--   Read-only checks before the educator onboarding files
--   (20261028090100_educator_onboarding.sql, 20261028090200_educator_admin_review.sql).
--   Collects EVERY problem and raises once, so one run lists all clashes.
--   Writes nothing.
--
-- Checks
--   * lead tables / columns the RPCs read and write exist (profiles,
--     educator_profiles, educator_verification_docs, notifications, audit_logs,
--     storage.objects);
--   * educator_verification_docs.doc_type allows government_id and other;
--   * our Batch 1 objects exist (educator_admin_state + its review_state CHECK,
--     adm_audit, adm_require_admin, adm_ensure_educator_state, the three
--     functions 20261028090200 replaces);
--   * none of the NEW names exist yet (table, column, functions).
--
-- ROLLBACK
--   Nothing to roll back (no objects are created).
-- =====================================================================
set search_path = public, extensions;

do $pre$
declare
  v_problems text[] := '{}';
  v_list     text[];
begin
  -- lead columns
  select coalesce(array_agg(x.t || '.' || x.c order by x.t, x.c), '{}') into v_list
    from (values
      ('profiles', 'id'), ('profiles', 'role'), ('profiles', 'full_name'), ('profiles', 'email'), ('profiles', 'phone'),
      ('profiles', 'location'),
      ('educator_profiles', 'user_id'), ('educator_profiles', 'full_name'), ('educator_profiles', 'phone'),
      ('educator_profiles', 'location'), ('educator_profiles', 'verification_status'), ('educator_profiles', 'bio'),
      ('educator_profiles', 'qualifications'), ('educator_profiles', 'experience_years'), ('educator_profiles', 'subjects'),
      ('educator_profiles', 'languages'), ('educator_profiles', 'rejected_reason'), ('educator_profiles', 'verified_at'),
      ('educator_profiles', 'verified_by'), ('educator_profiles', 'photo_url'),
      ('educator_verification_docs', 'id'), ('educator_verification_docs', 'educator_id'),
      ('educator_verification_docs', 'doc_type'), ('educator_verification_docs', 'doc_url'),
      ('educator_verification_docs', 'doc_name'), ('educator_verification_docs', 'is_verified'),
      ('educator_verification_docs', 'verified_at'), ('educator_verification_docs', 'review_note'),
      ('educator_verification_docs', 'verified_by'), ('educator_verification_docs', 'created_at'),
      ('notifications', 'user_id'), ('notifications', 'category'), ('notifications', 'title'), ('notifications', 'body'),
      ('notifications', 'action_url'), ('notifications', 'reference_type'), ('notifications', 'reference_id'),
      ('notification_preferences', 'in_app'),
      ('educator_admin_state', 'review_state'), ('educator_admin_state', 'review_note'),
      ('educator_admin_state', 'account_status'), ('educator_admin_state', 'status_reason'),
      ('educator_admin_state', 'onboarded_via')) as x(t, c)
   where not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = x.t and column_name = x.c);
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('missing columns: ' || array_to_string(v_list, ', '));
  end if;

  if to_regclass('storage.objects') is null then
    v_problems := v_problems || 'missing table storage.objects'::text;
  end if;

  -- the lead's doc_type CHECK must allow the two types the onboarding uses
  if not exists (select 1 from pg_constraint c
                  where c.conrelid = 'public.educator_verification_docs'::regclass and c.contype = 'c'
                    and pg_get_constraintdef(c.oid) like '%government_id%' and pg_get_constraintdef(c.oid) like '%''other''%') then
    v_problems := v_problems || 'educator_verification_docs.doc_type CHECK does not list government_id and other'::text;
  end if;

  -- our review_state CHECK (20261025100400), widened by 20261028090100
  if not exists (select 1 from pg_constraint
                  where conrelid = to_regclass('public.educator_admin_state')
                    and conname = 'educator_admin_state_review_state_check') then
    v_problems := v_problems || 'missing constraint educator_admin_state_review_state_check'::text;
  end if;

  -- functions we call or replace
  select coalesce(array_agg(x.sig order by x.sig), '{}') into v_list
    from unnest(array[
      'public.adm_audit(text,text,uuid,jsonb,jsonb,text)', 'public.adm_require_admin()', 'public.adm_is_platform_admin()',
      'public.adm_ensure_educator_state(uuid)', 'public.adm_educator_base()', 'public.adm_initials(text)',
      'public.adm_educator_verification_key(text,text)', 'public.set_educator_verification(uuid,text,text)',
      'public.get_educator_detail(uuid)', 'public.list_educator_documents(uuid)'
    ]) as x(sig)
   where to_regprocedure(x.sig) is null;
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('missing functions (Batch 1 not applied?): ' || array_to_string(v_list, ', '));
  end if;

  -- new names must be free
  if to_regclass('public.educator_onboarding') is not null then
    v_problems := v_problems || 'table public.educator_onboarding already exists'::text;
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'educator_admin_state' and column_name = 'submitted_at') then
    v_problems := v_problems || 'column educator_admin_state.submitted_at already exists'::text;
  end if;
  select coalesce(array_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' order by p.proname), '{}')
    into v_list
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('adm_is_educator', 'adm_is_verified_educator', 'adm_require_educator', 'adm_require_verified_educator',
                       'adm_educator_status_json', 'adm_educator_form', 'adm_educator_validate', 'adm_educator_clean',
                       'adm_educator_documents_json', 'adm_notify_educator_verification',
                       'educator_start_onboarding', 'educator_save_onboarding_step', 'educator_register_document',
                       'educator_remove_document', 'educator_submit_onboarding', 'educator_get_status',
                       'educator_get_onboarding');
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('functions already exist: ' || array_to_string(v_list, ', '));
  end if;

  if cardinality(v_problems) > 0 then
    raise exception 'Educator onboarding preflight: %', array_to_string(v_problems, '; ');
  end if;
end $pre$;
