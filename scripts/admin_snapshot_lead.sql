-- =====================================================================
-- scripts/admin_snapshot_lead.sql
--
-- Read-only fingerprint of the lead's public schema, cron jobs and storage
-- policies. Run it BEFORE and AFTER `supabase db push` and diff the outputs:
--
--   psql "$DATABASE_URL" -At -F '|' -f scripts/admin_snapshot_lead.sql > snapshot_before.txt
--   ... push ...
--   psql "$DATABASE_URL" -At -F '|' -f scripts/admin_snapshot_lead.sql > snapshot_after.txt
--   diff snapshot_before.txt snapshot_after.txt | grep '^<'
--
-- Rule: the push may only ADD lines. Any line starting with '<' (present before,
-- missing / changed after) means a lead object changed and must be explained.
-- The ONLY expected '<' lines are none; the expected '>' (added) lines are the
-- port's own objects plus these lead-table additions from 20261025100300:
--   callback_requests.(code, organization, assigned_to, contacted_at, contacted_by,
--   closed_at, closed_by, submitted_from, ip_hash, user_agent, updated_at),
--   institutions.state_code, educator_verification_docs.(review_note, verified_by),
-- internal FK triggers (RI_ConstraintTrigger_*) on lead tables our tables reference
-- (they are excluded below), and rows: one courses row, platform_settings keys
-- (not fingerprinted here).
-- =====================================================================

-- functions (definition hash, owner, ACL)
select 'function', p.oid::regprocedure::text, md5(pg_get_functiondef(p.oid)), pg_get_userbyid(p.proowner), coalesce(p.proacl::text, '')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prokind in ('f', 'p')
 order by 2;

-- columns (type, nullability, default)
select 'column', c.table_name || '.' || c.column_name, c.data_type, c.is_nullable, coalesce(c.column_default, '')
  from information_schema.columns c
 where c.table_schema = 'public'
 order by 2;

-- constraints
select 'constraint', cl.relname || '.' || co.conname, pg_get_constraintdef(co.oid)
  from pg_constraint co join pg_class cl on cl.oid = co.conrelid join pg_namespace n on n.oid = cl.relnamespace
 where n.nspname = 'public'
 order by 2;

-- RLS flags
select 'rls', c.relname, c.relrowsecurity::text, c.relforcerowsecurity::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r', 'p')
 order by 2;

-- policies (public and storage)
select 'policy', schemaname || '.' || tablename || '.' || policyname, cmd, array_to_string(roles, ','),
       coalesce(qual, ''), coalesce(with_check, '')
  from pg_policies
 where schemaname in ('public', 'storage')
 order by 2;

-- user triggers (internal FK triggers excluded)
select 'trigger', t.tgrelid::regclass::text || '.' || t.tgname, pg_get_triggerdef(t.oid)
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
 where n.nspname in ('public', 'auth') and not t.tgisinternal
 order by 2;

-- table grants
select 'grant', table_name, grantee, string_agg(privilege_type, ',' order by privilege_type)
  from information_schema.role_table_grants
 where table_schema = 'public'
 group by table_name, grantee
 order by 2, 3;

-- cron jobs (all of them: the push must not touch the lead's jobs)
select 'cron', jobname, schedule, command, active::text from cron.job order by 2;
