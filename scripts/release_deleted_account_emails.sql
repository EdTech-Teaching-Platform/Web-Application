-- =====================================================================
-- release_deleted_account_emails.sql  (QA 22 Nov: "can't re-register with
-- the email of a deleted account")
--
-- Accounts deleted BEFORE the delete-account fix kept their email in Supabase
-- Auth (soft delete), so the same address can't sign up again. This replaces
-- that email with deleted+<id>@deleted.invalid for those accounts only.
-- New deletions do this automatically (delete-account Edge Function).
--
-- Run in the Supabase SQL editor ONLY with "approved:". It changes rows in
-- the auth schema. Step 1 is read-only: check the list first.
-- =====================================================================

-- 1. Preview (read-only): accounts deleted through "Delete account" that still hold a real email
select u.id, u.email, u.deleted_at, r.decided_at as deleted_in_app_at
  from auth.users u
  join public.account_deletion_requests r on r.user_id = u.id and r.status = 'approved' and r.self_service
 where u.email is not null and u.email not like 'deleted+%@deleted.invalid'
 order by r.decided_at;

-- 2. Release the emails (run after checking step 1)
begin;
update auth.identities i
   set identity_data = i.identity_data || jsonb_build_object('email', 'deleted+' || i.user_id || '@deleted.invalid')
 where i.provider = 'email'
   and i.user_id in (select r.user_id from public.account_deletion_requests r where r.status = 'approved' and r.self_service);
update auth.users u
   set email = 'deleted+' || u.id || '@deleted.invalid', phone = null
  from public.account_deletion_requests r
 where r.user_id = u.id and r.status = 'approved' and r.self_service
   and u.email is not null and u.email not like 'deleted+%@deleted.invalid';
commit;
