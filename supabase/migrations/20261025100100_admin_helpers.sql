-- =====================================================================
-- 20261025100100_admin_helpers.sql
--
-- Purpose
--   Internal adm_* helper functions and code sequences used by every admin
--   RPC. None of these names exist in the lead's database (proved by the
--   preflight). The lead's is_admin() is neither replaced nor called (D5).
--
-- Lead objects read
--   public.profiles (id, role, full_name), public.audit_logs (insert only,
--   through adm_audit).
--
-- Assumptions
--   * auth.uid() and auth.jwt() exist (standard Supabase).
--   * The PostgREST JWT role is readable from request.jwt.claims.
--
-- ROLLBACK
--   drop function if exists public.adm_resolve_date_range(text, date, date);
--   drop function if exists public.adm_phone_display(text);
--   drop function if exists public.adm_normalize_phone(text);
--   drop function if exists public.adm_current_session_id();
--   drop function if exists public.adm_like(text);
--   drop function if exists public.adm_initials(text);
--   drop function if exists public.adm_educator_verification_key(text, text);
--   drop function if exists public.adm_touch_updated_at();
--   drop function if exists public.adm_audit(text, text, uuid, jsonb, jsonb, text);
--   drop function if exists public.adm_actor_role();
--   drop function if exists public.adm_is_service_role();
--   drop function if exists public.adm_require_admin();
--   drop function if exists public.adm_is_platform_admin();
--   drop sequence if exists public.adm_callback_code_seq;
--   drop sequence if exists public.adm_educator_code_seq;
--   drop sequence if exists public.adm_student_code_seq;
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------- sequences
create sequence if not exists public.adm_student_code_seq start 2001;    -- STU-2001
create sequence if not exists public.adm_educator_code_seq start 1001;   -- EDU-1001
create sequence if not exists public.adm_callback_code_seq start 1001;   -- CB-1001

-- ------------------------------------------------------------ access checks
-- D5: platform admin = admin or super_admin. Own function; the lead's
-- is_admin() is never replaced or relied on.
create or replace function public.adm_is_platform_admin() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'));
$$;

create or replace function public.adm_require_admin() returns void
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.adm_is_platform_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
end $$;

-- True when the request was made with the service-role key (Edge Functions).
create or replace function public.adm_is_service_role() returns boolean
language sql stable set search_path = public, extensions as $$
  select coalesce(
    coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
             nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role') = 'service_role',
    false);
$$;

create or replace function public.adm_actor_role() returns text
language sql stable security definer set search_path = public, extensions as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ------------------------------------------------------------- audit trail
-- Business actions go to the lead's audit_logs (D9). actor_id and actor_role
-- are NOT NULL there, so calls without a signed-in profile (service role)
-- are skipped rather than failing the action.
create or replace function public.adm_audit(
  p_action text, p_target_type text, p_target_id uuid,
  p_before jsonb default null, p_after jsonb default null, p_reason text default null
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  if auth.uid() is null then return; end if;
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null then return; end if;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, before_state, after_state, reason)
  values (auth.uid(), v_role, p_action, p_target_type, p_target_id, p_before, p_after, p_reason);
end $$;

-- ------------------------------------------------------------ small helpers
create or replace function public.adm_touch_updated_at() returns trigger
language plpgsql set search_path = public, extensions as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- D7: the lead stores only pending / verified / rejected; finer states live
-- in educator_admin_state.review_state. Returns the key the UI expects
-- (src/portals/admin/utils/statusMaps.js). Unknown lead values pass through.
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

-- "Dr. Asha Rao" -> "AR"
create or replace function public.adm_initials(p_name text) returns text
language sql immutable set search_path = public, extensions as $$
  with n as (
    select regexp_split_to_array(btrim(regexp_replace(coalesce(p_name, ''), '^(dr|mr|mrs|ms|prof)\.?\s+', '', 'i')), '\s+') as a
  )
  select upper(left(a[1], 1) || case when array_length(a, 1) > 1 then left(a[array_length(a, 1)], 1) else '' end) from n;
$$;

-- Search text -> ILIKE pattern with %, _ and \ escaped; null when blank.
create or replace function public.adm_like(p_search text) returns text
language sql immutable set search_path = public, extensions as $$
  select case when nullif(btrim(coalesce(p_search, '')), '') is null then null
              else '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
$$;

-- session_id claim of the Supabase JWT (one per signed-in browser).
create or replace function public.adm_current_session_id() returns uuid
language sql stable set search_path = public, extensions as $$
  select nullif(auth.jwt() ->> 'session_id', '')::uuid;
$$;

-- "98450 12233" / "+91 98450 12233" / "09845012233" -> "+919845012233"
create or replace function public.adm_normalize_phone(p text) returns text
language sql immutable set search_path = public, extensions as $$
  with d as (select regexp_replace(coalesce(p, ''), '[^0-9+]', '', 'g') as s)
  select case
    when s ~ '^\+[1-9][0-9]{7,14}$'      then s
    when s ~ '^(\+?91)?0?[6-9][0-9]{9}$' then '+91' || right(regexp_replace(s, '\D', '', 'g'), 10)
    else null end
  from d;
$$;

create or replace function public.adm_phone_display(p text) returns text
language sql immutable set search_path = public, extensions as $$
  select case when p ~ '^\+91[6-9][0-9]{9}$'
              then '+91 ' || substr(p, 4, 5) || ' ' || substr(p, 9, 5) else p end;
$$;

-- Date-range dropdown keys -> [from, to] in Asia/Kolkata.
create or replace function public.adm_resolve_date_range(
  p_range text default 'last_30_days', p_from date default null, p_to date default null
) returns table (d_from date, d_to date)
language sql stable set search_path = public, extensions as $$
  with today as (select (now() at time zone 'Asia/Kolkata')::date as d)
  select
    case p_range
      when 'last_7_days'  then d - 6
      when 'last_30_days' then d - 29
      when 'last_90_days' then d - 89
      when 'this_month'   then date_trunc('month', d)::date
      when 'last_month'   then (date_trunc('month', d) - interval '1 month')::date
      when 'this_year'    then date_trunc('year', d)::date
      when 'all_time'     then date '2000-01-01'
      when 'custom'       then coalesce(p_from, d - 29)
      else d - 29 end,
    case p_range
      when 'last_month'   then (date_trunc('month', d) - interval '1 day')::date
      when 'custom'       then coalesce(p_to, d)
      else d end
  from today;
$$;

-- ------------------------------------------------------------------ grants
-- Internal helpers are not callable from the browser. adm_is_platform_admin
-- stays callable by signed-in users (harmless, and usable in RLS policies on
-- this port's own tables).
revoke all on function public.adm_is_platform_admin() from public, anon;
grant execute on function public.adm_is_platform_admin() to authenticated;
revoke all on function public.adm_require_admin() from public, anon, authenticated;
revoke all on function public.adm_is_service_role() from public, anon, authenticated;
revoke all on function public.adm_actor_role() from public, anon, authenticated;
revoke all on function public.adm_audit(text, text, uuid, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.adm_touch_updated_at() from public, anon, authenticated;
revoke all on function public.adm_educator_verification_key(text, text) from public, anon, authenticated;
revoke all on function public.adm_initials(text) from public, anon, authenticated;
revoke all on function public.adm_like(text) from public, anon, authenticated;
revoke all on function public.adm_current_session_id() from public, anon, authenticated;
revoke all on function public.adm_normalize_phone(text) from public, anon, authenticated;
revoke all on function public.adm_phone_display(text) from public, anon, authenticated;
revoke all on function public.adm_resolve_date_range(text, date, date) from public, anon, authenticated;
revoke all on sequence public.adm_student_code_seq, public.adm_educator_code_seq, public.adm_callback_code_seq
  from public, anon, authenticated;
