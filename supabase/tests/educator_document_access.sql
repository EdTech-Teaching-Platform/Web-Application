-- =====================================================================
-- supabase/tests/educator_document_access.sql
--
-- Smoke tests for 20261101090000_educator_document_access.sql
-- (adm_authorize_document_access). LOCAL / DISPOSABLE DATABASE ONLY.
-- One transaction, rolled back.
-- Expect "ok: ..." notices and "ok: all document access checks passed".
-- =====================================================================
begin;

create function pg_temp.expect_error(p_sql text, p_code text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate <> p_code then
      raise exception 'expected SQLSTATE % but got % (%) for: %', p_code, sqlstate, sqlerrm, p_sql;
    end if;
    return;
  end;
  raise exception 'expected SQLSTATE % but the call succeeded: %', p_code, p_sql;
end $$;

create function pg_temp.ok(p_cond boolean, p_what text) returns void
language plpgsql as $$
begin
  if not coalesce(p_cond, false) then raise exception 'FAILED: %', p_what; end if;
  raise notice 'ok: %', p_what;
end $$;

create function pg_temp.act_as(p_user uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.id(p_key text) returns uuid
language sql as $$ select current_setting('test.' || p_key)::uuid $$;

do $fx$
declare
  v_admin uuid := gen_random_uuid(); v_owner uuid := gen_random_uuid(); v_other uuid := gen_random_uuid();
  v_stu uuid := gen_random_uuid(); v_doc uuid; v_old uuid; u uuid;
begin
  foreach u in array array[v_admin, v_owner, v_other, v_stu] loop
    insert into auth.users (id, email) values (u, 'da-' || u || '@test.local');
  end loop;
  insert into public.profiles (id, role, full_name, email) values
    (v_admin, 'admin', 'DA Admin', 'da-' || v_admin || '@test.local'),
    (v_owner, 'educator', 'DA Owner', 'da-' || v_owner || '@test.local'),
    (v_other, 'educator', 'DA Other', 'da-' || v_other || '@test.local'),
    (v_stu, 'student', 'DA Student', 'da-' || v_stu || '@test.local');
  insert into public.adm_admin_users (user_id) values (v_admin);
  insert into public.educator_verification_docs (educator_id, doc_type, doc_url, doc_name)
  values (v_owner, 'government_id', v_owner || '/government_id-front-1730000000.jpg', 'front') returning id into v_doc;
  -- an older row: full storage URL
  insert into public.educator_verification_docs (educator_id, doc_type, doc_url, doc_name)
  values (v_owner, 'degree_certificate', 'https://x.supabase.co/storage/v1/object/public/legacy/bsc.pdf', 'BSc') returning id into v_old;
  perform set_config('test.admin', v_admin::text, true); perform set_config('test.owner', v_owner::text, true);
  perform set_config('test.other', v_other::text, true); perform set_config('test.stu', v_stu::text, true);
  perform set_config('test.doc', v_doc::text, true); perform set_config('test.old', v_old::text, true);
end $fx$;

set local role authenticated;
do $$
declare v jsonb;
begin
  -- admin: any document, by id or by doc_url, audited
  perform pg_temp.act_as(pg_temp.id('admin'));
  v := public.adm_authorize_document_access(pg_temp.id('doc'), null, 'view');
  perform pg_temp.ok(v ->> 'access' = 'admin' and v ->> 'doc_url' like pg_temp.id('owner') || '/government_id-front-%',
                     'admin: gets the new-format document');
  v := public.adm_authorize_document_access(null, 'https://x.supabase.co/storage/v1/object/public/legacy/bsc.pdf', 'download');
  perform pg_temp.ok(v ->> 'id' = pg_temp.id('old')::text, 'admin: old full-URL document found by path');

  -- owner: own documents only
  perform pg_temp.act_as(pg_temp.id('owner'));
  perform pg_temp.ok(public.adm_authorize_document_access(pg_temp.id('doc')) ->> 'access' = 'owner', 'owner: opens their own document');

  -- nobody else
  perform pg_temp.act_as(pg_temp.id('other'));
  perform pg_temp.expect_error(format('select public.adm_authorize_document_access(%L)', pg_temp.id('doc')), '42501');
  perform pg_temp.act_as(pg_temp.id('stu'));
  perform pg_temp.expect_error(format('select public.adm_authorize_document_access(%L)', pg_temp.id('doc')), '42501');
  perform pg_temp.expect_error(format('select public.adm_authorize_document_access(null, %L)', pg_temp.id('owner') || '/government_id-front-1730000000.jpg'), '42501');
  perform pg_temp.ok(true, 'other educator and student: refused (by id and by path)');

  perform pg_temp.act_as(pg_temp.id('admin'));
  perform pg_temp.expect_error(format('select public.adm_authorize_document_access(%L)', gen_random_uuid()), 'P0002');
  perform pg_temp.expect_error('select public.adm_authorize_document_access()', '22023');
  perform pg_temp.ok(true, 'unknown document: P0002; no id or path: 22023');

  perform set_config('request.jwt.claims', '', true);
  perform pg_temp.expect_error(format('select public.adm_authorize_document_access(%L)', pg_temp.id('doc')), '42501');
  perform pg_temp.ok(true, 'signed out: refused');
end $$;
reset role;

do $$
begin
  perform pg_temp.ok((select count(*) from public.audit_logs where action = 'educator.document_access'
                        and target_id in (pg_temp.id('doc'), pg_temp.id('old'))) = 3,
                     'audit: one row per granted access (admin view, admin download, owner view), none for refusals');
  perform pg_temp.ok(exists (select 1 from public.audit_logs where action = 'educator.document_access' and actor_id = pg_temp.id('admin')
                               and after_state ->> 'purpose' = 'download' and after_state ->> 'access' = 'admin'),
                     'audit: who, which document, view or download');
  perform pg_temp.ok(not has_function_privilege('anon', 'public.adm_authorize_document_access(uuid,text,text)', 'execute'),
                     'grants: not callable by anon');
end $$;

do $$ begin raise notice 'ok: all document access checks passed'; end $$;
rollback;
