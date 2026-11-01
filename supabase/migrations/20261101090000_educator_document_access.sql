-- =====================================================================
-- 20261101090000_educator_document_access.sql
--
-- Purpose
--   Who may open an educator verification document, decided and audited in
--   the database (the sign-educator-document Edge Function calls this with
--   the caller's JWT, then signs the file with the service role):
--     adm_authorize_document_access(p_document_id uuid, p_path text, p_purpose text)
--       -> {id, educator_id, doc_url, doc_type, doc_name, access}
--   * admin (adm_is_platform_admin()): any document of any educator -> access 'admin'
--   * the educator who owns it (educator_id = auth.uid()) -> access 'owner'
--   * anyone else: 42501. Unknown document: P0002.
--   Looked up by id, or (old admin UI) by doc_url. Every granted access writes
--   audit_logs: action 'educator.document_access', target educator_document /
--   the document id, after_state {educator_id, doc_type, doc_name, access, purpose}.
--   p_purpose: 'view' | 'download'.
--
-- Preflight (in this file): adm_is_platform_admin / adm_audit exist, the name is free.
--
-- ROLLBACK
--   drop function if exists public.adm_authorize_document_access(uuid, text, text);
-- =====================================================================
set search_path = public, extensions;

do $pre$
declare v_problems text[] := '{}';
begin
  if to_regprocedure('public.adm_is_platform_admin()') is null or to_regprocedure('public.adm_audit(text,text,uuid,jsonb,jsonb,text)') is null then
    v_problems := v_problems || 'missing adm_is_platform_admin() / adm_audit(...)'::text;
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'adm_authorize_document_access') then
    v_problems := v_problems || 'function adm_authorize_document_access already exists'::text;
  end if;
  if cardinality(v_problems) > 0 then
    raise exception 'Educator document access preflight: %', array_to_string(v_problems, '; ');
  end if;
end $pre$;

create or replace function public.adm_authorize_document_access(
  p_document_id uuid default null, p_path text default null, p_purpose text default 'view'
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  d        public.educator_verification_docs;
  v_access text;
  v_purpose text := case when p_purpose = 'download' then 'download' else 'view' end;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if p_document_id is not null then
    select * into d from public.educator_verification_docs where id = p_document_id;
  elsif nullif(btrim(coalesce(p_path, '')), '') is not null then
    select * into d from public.educator_verification_docs where doc_url = btrim(p_path)
     order by created_at desc limit 1;
  else
    raise exception 'A document id or path is required.' using errcode = '22023';
  end if;
  if d.id is null then
    raise exception 'Document not found.' using errcode = 'P0002';
  end if;

  v_access := case when public.adm_is_platform_admin() then 'admin'
                   when d.educator_id = auth.uid() then 'owner' end;
  if v_access is null then
    raise exception 'You can''t open this document.' using errcode = '42501';
  end if;

  perform public.adm_audit('educator.document_access', 'educator_document', d.id, null,
                           jsonb_build_object('educator_id', d.educator_id, 'doc_type', d.doc_type, 'doc_name', d.doc_name,
                                              'access', v_access, 'purpose', v_purpose), null);
  return jsonb_build_object('id', d.id, 'educator_id', d.educator_id, 'doc_url', d.doc_url,
                            'doc_type', d.doc_type, 'doc_name', d.doc_name, 'access', v_access);
end $$;

-- Called by the Edge Function with the caller's JWT; it only answers for the caller.
revoke all on function public.adm_authorize_document_access(uuid, text, text) from public, anon;
grant execute on function public.adm_authorize_document_access(uuid, text, text) to authenticated;
