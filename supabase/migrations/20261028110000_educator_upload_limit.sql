-- =====================================================================
-- 20261028110000_educator_upload_limit.sql
--
-- Purpose
--   Rate limit for the educator-upload-url Edge Function: each call claims one
--   upload slot for the caller (auth.uid(), never a parameter). At most
--   p_limit slots per rolling hour (default 20).
--     adm_claim_educator_upload_slot(p_doc_type text, p_limit int default 20)
--       -> {allowed, remaining, retry_after_seconds}
--   Refuses (42501) anyone who is not an educator (any verification status).
--   Rows older than a day are removed on the caller's next claim.
--
-- Our objects
--   educator_upload_requests (user_id -> profiles ON DELETE CASCADE, indexed;
--   RLS on, no policies, no grants).
--
-- Preflight (in this file): adm_is_educator() exists; the new names are free.
--
-- ROLLBACK
--   drop function if exists public.adm_claim_educator_upload_slot(text, int);
--   drop table if exists public.educator_upload_requests;
-- =====================================================================
set search_path = public, extensions;

do $pre$
declare v_problems text[] := '{}';
begin
  if to_regprocedure('public.adm_is_educator()') is null then
    v_problems := v_problems || 'missing public.adm_is_educator() (apply 20261028090100 first)'::text;
  end if;
  if to_regclass('public.educator_upload_requests') is not null then
    v_problems := v_problems || 'table public.educator_upload_requests already exists'::text;
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'adm_claim_educator_upload_slot') then
    v_problems := v_problems || 'function adm_claim_educator_upload_slot already exists'::text;
  end if;
  if cardinality(v_problems) > 0 then
    raise exception 'Educator upload limit preflight: %', array_to_string(v_problems, '; ');
  end if;
end $pre$;

create table if not exists public.educator_upload_requests (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  doc_type    text,
  created_at  timestamptz not null default now()
);
create index if not exists educator_upload_requests_user_idx on public.educator_upload_requests (user_id, created_at);
alter table public.educator_upload_requests enable row level security;
revoke all on table public.educator_upload_requests from public, anon, authenticated;
revoke all on sequence public.educator_upload_requests_id_seq from public, anon, authenticated;

create or replace function public.adm_claim_educator_upload_slot(p_doc_type text, p_limit int default 20) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid    uuid := auth.uid();
  v_limit  int := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_used   int;
  v_oldest timestamptz;
begin
  if not public.adm_is_educator() then
    raise exception 'Educators only.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('educator_upload:' || v_uid, 0));
  delete from public.educator_upload_requests where user_id = v_uid and created_at < now() - interval '1 day';
  select count(*), min(created_at) into v_used, v_oldest
    from public.educator_upload_requests
   where user_id = v_uid and created_at > now() - interval '1 hour';
  if v_used >= v_limit then
    return jsonb_build_object('allowed', false, 'remaining', 0,
                              'retry_after_seconds', greatest(ceil(extract(epoch from (v_oldest + interval '1 hour' - now())))::int, 1));
  end if;
  insert into public.educator_upload_requests (user_id, doc_type) values (v_uid, left(p_doc_type, 40));
  return jsonb_build_object('allowed', true, 'remaining', v_limit - v_used - 1, 'retry_after_seconds', 0);
end $$;

-- Called by the Edge Function with the caller's JWT; it only counts and
-- records the caller's own uploads.
revoke all on function public.adm_claim_educator_upload_slot(text, int) from public, anon;
grant execute on function public.adm_claim_educator_upload_slot(text, int) to authenticated;
