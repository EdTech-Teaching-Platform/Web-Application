-- =====================================================================
-- scripts/admin_snapshot_lead_editor.sql
--
-- Supabase SQL editor version of scripts/admin_snapshot_lead.sql. Read-only.
-- ONE statement, one row per object: kind, name, hash (md5 of the object's
-- definition). Same coverage as the psql version: public functions, columns,
-- constraints, RLS flags, policies (public + storage), non-internal triggers
-- (public + auth), table grants, all cron jobs; plus one 'lead_function_def'
-- row holding md5(pg_get_functiondef) of the lead's
-- publish_test_series(uuid, boolean), the value check 9 of
-- admin_verify_push_editor.sql prints.
--
-- Run it BEFORE and AFTER the push, export each result as CSV
-- (snapshot_before.csv / snapshot_after.csv), then:
--   diff snapshot_before.csv snapshot_after.csv | grep '^<'    # must print NOTHING
--
-- Rows are ordered by kind, name, so the two files diff line by line. A changed
-- object shows as one '<' line (old hash) plus one '>' line (new hash). The
-- push may only ADD rows. Expected '>' rows: the port's own objects, the 14
-- columns added in 20261025100300 (callback_requests, institutions.state_code,
-- educator_verification_docs.review_note / verified_by), the two
-- question-images storage policies and the 5 adm_ cron jobs. Internal FK
-- triggers are excluded.
-- =====================================================================
select kind, name, hash
  from (
    -- functions (definition, owner, ACL)
    select 'function' as kind, p.oid::regprocedure::text as name,
           md5(concat_ws('|', pg_get_functiondef(p.oid), pg_get_userbyid(p.proowner),
                         coalesce(p.proacl::text, '<default>'))) as hash
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind in ('f', 'p')

    union all
    -- the lead function the port must not touch (definition only)
    select 'lead_function_def', 'public.publish_test_series(uuid,boolean)', md5(pg_get_functiondef(f.oid))
      from (select to_regprocedure('public.publish_test_series(uuid,boolean)')::oid as oid) f
     where f.oid is not null

    union all
    -- columns (type, nullability, default)
    select 'column', c.table_name || '.' || c.column_name,
           md5(concat_ws('|', c.data_type, c.udt_name, c.is_nullable, coalesce(c.column_default, '<null>')))
      from information_schema.columns c
     where c.table_schema = 'public'

    union all
    -- constraints
    select 'constraint', cl.relname || '.' || co.conname, md5(pg_get_constraintdef(co.oid))
      from pg_constraint co join pg_class cl on cl.oid = co.conrelid join pg_namespace n on n.oid = cl.relnamespace
     where n.nspname = 'public'

    union all
    -- RLS flags
    select 'rls', c.relname, md5(c.relrowsecurity::text || '|' || c.relforcerowsecurity::text)
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p')

    union all
    -- policies (public and storage)
    select 'policy', schemaname || '.' || tablename || '.' || policyname,
           md5(concat_ws('|', permissive, cmd, array_to_string(roles, ','),
                         coalesce(qual, '<null>'), coalesce(with_check, '<null>')))
      from pg_policies
     where schemaname in ('public', 'storage')

    union all
    -- user triggers (internal FK triggers excluded)
    select 'trigger', t.tgrelid::regclass::text || '.' || t.tgname, md5(pg_get_triggerdef(t.oid))
      from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ('public', 'auth') and not t.tgisinternal

    union all
    -- table grants, one row per table and grantee
    select 'grant', table_name || ' to ' || grantee,
           md5(string_agg(privilege_type, ',' order by privilege_type))
      from information_schema.role_table_grants
     where table_schema = 'public'
     group by table_name, grantee

    union all
    -- cron jobs (all of them: the push must not touch the lead's jobs)
    select 'cron', coalesce(jobname, 'jobid:' || jobid),
           md5(concat_ws('|', schedule, command, active::text, database, username))
      from cron.job
  ) s
 order by kind, name;
