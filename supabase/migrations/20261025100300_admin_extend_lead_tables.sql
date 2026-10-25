-- =====================================================================
-- 20261025100300_admin_extend_lead_tables.sql
--
-- Purpose
--   The only DDL this port runs on lead tables (doc sections 2.3, 2.5, 2.15):
--   nullable columns with no default (no table rewrite), plus two documented
--   backfills. No constraints, defaults, foreign keys, indexes or triggers are
--   added to lead tables; integrity is enforced inside the RPCs. Indexes on
--   these columns are in scripts/admin_indexes_concurrently.sql.
--
-- Lead objects touched
--   public.callback_requests       + code, organization, assigned_to, contacted_at,
--                                    contacted_by, closed_at, closed_by, submitted_from,
--                                    ip_hash, user_agent, updated_at
--                                    backfill: code = 'CB-<n>' in created_at order
--   public.institutions            + state_code
--                                    backfill: matched to regions by name or code
--   public.educator_verification_docs + review_note, verified_by
--
-- Assumptions
--   * The preflight proved none of these columns existed.
--   * Each ADD COLUMN takes a brief ACCESS EXCLUSIVE lock; the tables are small.
--   * Rows inserted later by the lead's own code get code = NULL; the callback
--     RPCs (Batch 3) display a fallback and assign a code on first admin action.
--
-- ROLLBACK (removes the columns and their data; take a backup first)
--   alter table public.educator_verification_docs drop column if exists verified_by;
--   alter table public.educator_verification_docs drop column if exists review_note;
--   alter table public.institutions drop column if exists state_code;
--   alter table public.callback_requests
--     drop column if exists updated_at, drop column if exists user_agent, drop column if exists ip_hash,
--     drop column if exists submitted_from, drop column if exists closed_by, drop column if exists closed_at,
--     drop column if exists contacted_by, drop column if exists contacted_at, drop column if exists assigned_to,
--     drop column if exists organization, drop column if exists code;
-- =====================================================================
set search_path = public, extensions;

-- ------------------------------------------------- callback_requests (2.5)
alter table public.callback_requests add column if not exists code           text;
alter table public.callback_requests add column if not exists organization   text;
alter table public.callback_requests add column if not exists assigned_to    uuid;   -- profiles.id, checked in RPCs
alter table public.callback_requests add column if not exists contacted_at   timestamptz;
alter table public.callback_requests add column if not exists contacted_by   uuid;   -- profiles.id
alter table public.callback_requests add column if not exists closed_at      timestamptz;
alter table public.callback_requests add column if not exists closed_by      uuid;   -- profiles.id
alter table public.callback_requests add column if not exists submitted_from text;
alter table public.callback_requests add column if not exists ip_hash        text;
alter table public.callback_requests add column if not exists user_agent     text;
alter table public.callback_requests add column if not exists updated_at     timestamptz;

-- Backfill human codes CB-1001, CB-1002 ... in submission order, then move the
-- sequence past the highest code so new codes never collide.
do $$
begin
  update public.callback_requests c
     set code = 'CB-' || (1000 + o.rn)::text
    from (select id, row_number() over (order by created_at, id) as rn
            from public.callback_requests where code is null) o
   where c.id = o.id;
  perform setval('public.adm_callback_code_seq',
                 greatest(1000, coalesce((select max(substring(code from 4)::bigint)
                                            from public.callback_requests where code ~ '^CB-[0-9]+$'), 1000)),
                 true);
end $$;

-- ------------------------------------------------------ institutions (2.3)
alter table public.institutions add column if not exists state_code text;   -- regions.code, checked in RPCs

update public.institutions i
   set state_code = r.code
  from public.regions r
 where i.state_code is null
   and i.state is not null
   and (lower(btrim(i.state)) = lower(r.name) or upper(btrim(i.state)) = r.code);

-- ---------------------------------------- educator_verification_docs (2.15)
alter table public.educator_verification_docs add column if not exists review_note text;
alter table public.educator_verification_docs add column if not exists verified_by uuid;   -- profiles.id of the reviewer
