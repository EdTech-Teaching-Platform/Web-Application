set search_path = public, extensions;
set check_function_bodies = off;
create or replace view v_series_educators with (security_invoker = true) as
select distinct a.series_id, a.educator_id, p.full_name as educator_name
from test_assignments a
join profiles p on p.id = a.educator_id
where a.status not in ('cancelled', 'rejected');
-- =====================================================================
-- UNIVERSAL LEARNING - STUDENT MANAGEMENT & DETAILS PAGE (Admin) - Supabase SQL
-- Depends on: Test Series SQL (profiles, test_series, tests, series_enrollments, test_attempts, is_admin)
-- =====================================================================
do $$ begin create type student_status as enum ('active','blocked'); exception when duplicate_object then null; end $$;
create sequence if not exists student_code_seq start 2001;                    -- STU-2001
-- ====================================================================
-- 1. STUDENTS (one row per student; name and email live in profiles)
-- ====================================================================
create table if not exists students (
  id uuid primary key references profiles(id) on delete cascade
);
alter table students
  add column if not exists student_code   text unique default ('STU-' || nextval('student_code_seq')),   -- searchable ID
  add column if not exists phone          text,
  add column if not exists grade          text check (grade in ('Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12')),
  add column if not exists city           text,                                  -- location = city + profiles.state
  add column if not exists registered_at  timestamptz not null default now(),    -- "Registered" column
  add column if not exists last_active_at timestamptz,                           -- "Last active"
  add column if not exists status         student_status not null default 'active',
  add column if not exists blocked_reason text,
  add column if not exists blocked_at     timestamptz,
  add column if not exists blocked_by     uuid references profiles(id),
  add column if not exists onboarded_via  text,                                  -- "Onboarded by" (acquisition channel / partner)
  add column if not exists acquisition_id uuid;                                  -- link to your Student Acquisition table, if any
update students set student_code = 'STU-' || nextval('student_code_seq') where student_code is null;
alter table students
  add column if not exists account_status text not null default 'active'
  check (account_status in ('active','blocked','suspended'));
do $$ begin
  alter table students add constraint chk_blocked_reason check (status <> 'blocked' or nullif(btrim(blocked_reason),'') is not null);
exception when duplicate_object then null; end $$;
create index if not exists idx_students_status     on students(status);
create index if not exists idx_students_grade      on students(grade);
create index if not exists idx_students_registered on students(registered_at desc);
create index if not exists idx_profiles_name_trgm  on profiles using gin ((full_name || ' ' || email) gin_trgm_ops);
create index if not exists idx_students_code_trgm  on students using gin (student_code gin_trgm_ops);
-- Block / unblock history (reason, who, when)
create table if not exists student_block_history (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  action     text not null check (action in ('blocked','unblocked')),
  reason     text,
  by_admin   uuid references profiles(id),
  at         timestamptz not null default now()
);
create index if not exists idx_block_hist on student_block_history(student_id, at desc);
-- ====================================================================
-- 2. LIST VIEW + SEARCH / FILTERS / PAGINATION
-- ====================================================================
create or replace view v_students_list with (security_invoker = true) as
select
  s.id, s.student_code, p.full_name, p.email,
  upper(left(split_part(btrim(p.full_name), ' ', 1), 1) || left(split_part(btrim(p.full_name), ' ', 2), 1)) as initials,   -- avatar chip
  s.grade, s.registered_at, s.status,
  s.phone, s.city, p.state, s.last_active_at,
  s.blocked_reason, s.blocked_at, s.onboarded_via
from students s join profiles p on p.id = s.id;
-- p_status: 'active' | 'blocked' | null (All);  p_grade: 'Grade 10' | null (All)
-- p_sort: registered_desc | registered_asc | name_asc
-- =====================================================================
-- UNIVERSAL LEARNING - EDUCATOR MANAGEMENT PAGE (Admin) - Supabase SQL
-- Depends on: Test Series SQL, Assign Educators SQL (educators, v_series_educators, test_assignments)
-- =====================================================================
do $$ begin create type educator_account      as enum ('active','inactive','suspended');                    exception when duplicate_object then null; end $$;
do $$ begin create type educator_verification as enum ('pending','under_review','verified','rejected');     exception when duplicate_object then null; end $$;
do $$ begin create type doc_status            as enum ('pending','approved','rejected');                    exception when duplicate_object then null; end $$;
create sequence if not exists educator_code_seq start 1001;                                                 -- EDU-1001
-- ====================================================================
-- 1. EDUCATORS (extends the table from the earlier schemas)
-- ====================================================================
create table if not exists educators (
  id uuid primary key references profiles(id) on delete cascade,
  educator_code text unique default ('EDU-' || nextval('educator_code_seq')),
  phone text,
  gender text,
  dob date,
  qualification text,
  years_experience int default 0 check (years_experience between 0 and 60),
  subjects text[] not null default '{}',
  account_status educator_account not null default 'active',
  verification_status educator_verification not null default 'pending',
  status_reason text,
  suspended_at timestamptz,
  submitted_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  last_active_at timestamptz,
  onboarded_via text default 'admin'
);
update educators set educator_code = 'EDU-' || nextval('educator_code_seq') where educator_code is null;
alter table educators enable row level security;
drop policy if exists educators_admin on educators;
drop policy if exists educators_own on educators;
create policy educators_admin on educators for all using (is_admin()) with check (is_admin());
create policy educators_own on educators for select using (id = auth.uid());
create index if not exists idx_edu_account      on educators(account_status);
create index if not exists idx_edu_verification on educators(verification_status);
create index if not exists idx_edu_joined       on educators(joined_at desc);
create index if not exists idx_edu_years        on educators(years_experience);
create index if not exists idx_edu_subjects     on educators using gin (subjects);
create index if not exists idx_edu_code_trgm    on educators using gin (educator_code gin_trgm_ops);
-- Verification documents (the "Verification Details" menu item opens the documents tab)
create table if not exists educator_documents (
  id          uuid primary key default gen_random_uuid(),
  educator_id uuid not null references educators(id) on delete cascade,
  doc_type    text not null,                       -- ID proof, Degree certificate, Experience letter ...
  file_path   text,                                -- Storage path in a private 'educator-documents' bucket
  status      doc_status not null default 'pending',
  note        text,
  uploaded_at timestamptz default now(),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz
);
create index if not exists idx_edu_docs on educator_documents(educator_id);
-- Student ratings (Rating column shows the average, or a dash when there are none)
create table if not exists educator_ratings (
  id          uuid primary key default gen_random_uuid(),
  educator_id uuid not null references educators(id) on delete cascade,
  student_id  uuid not null references profiles(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz default now(),
  unique (educator_id, student_id)
);
create index if not exists idx_edu_ratings on educator_ratings(educator_id);
-- Status history: who suspended, activated, verified, rejected, and why
create table if not exists educator_status_history (
  id          uuid primary key default gen_random_uuid(),
  educator_id uuid not null references educators(id) on delete cascade,
  kind        text not null check (kind in ('account','verification')),
  from_value  text,
  to_value    text not null,
  reason      text,
  by_admin    uuid references profiles(id),
  at          timestamptz default now()
);
create index if not exists idx_edu_hist on educator_status_history(educator_id, at desc);
-- Bulk import: rows from the CSV/Excel upload, then "Send Invites"
create table if not exists educator_invites (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  email       text not null,
  status      text not null default 'pending' check (status in ('pending','sent','accepted','expired','failed')),
  user_id     uuid references profiles(id),
  invited_by  uuid references profiles(id),
  invited_at  timestamptz default now(),
  sent_at     timestamptz,
  accepted_at timestamptz,
  error       text
);
create unique index if not exists uq_invite_email on educator_invites (lower(email)) where status in ('pending','sent');
-- ====================================================================
-- 2. LIST VIEW + SEARCH / FILTERS / SORT / PAGINATION
-- ====================================================================
create or replace view v_educators_list with (security_invoker = true) as
select
  e.id, e.educator_code, p.full_name, p.email, e.phone,
  upper(left(split_part(btrim(p.full_name), ' ', 1), 1) || left(split_part(btrim(p.full_name), ' ', 2), 1)) as initials,
  e.subjects, e.qualification, e.years_experience,
  (select round(avg(r.rating)::numeric, 1) from educator_ratings r where r.educator_id = e.id)  as rating,         -- null shows "â€”"
  (select count(*) from educator_ratings r where r.educator_id = e.id)                           as ratings_count,
  (select count(distinct en.student_id) from series_enrollments en
     join v_series_educators se on se.series_id = en.series_id and se.educator_id = e.id)        as students_count,   -- "Most students" sort
  e.verification_status,
  case when e.verification_status = 'under_review' then 'pending' else e.verification_status::text end as verification_label,  -- both show as "Pending"
  e.account_status, e.joined_at, e.last_active_at, e.status_reason, e.onboarded_via
from educators e join profiles p on p.id = e.id;
-- p_account: active|inactive|suspended | null;  p_verification: pending|verified|rejected | null ('pending' covers under_review)
-- p_experience: '0-3' | '4-7' | '8-12' | '13+' | null;  p_sort: newest | oldest | rating | students
create or replace function list_educators(
  p_search text default null, p_account text default null, p_verification text default null,
  p_subject text default null, p_experience text default null, p_sort text default 'newest',
  p_page int default 1, p_size int default 8
) returns table (row_data jsonb, total_count bigint)
language sql stable security invoker as $$
  with f as (
    select * from v_educators_list v
    where (p_search is null or (v.full_name || ' ' || v.email || ' ' || coalesce(v.educator_code,'')) ilike '%' || p_search || '%')
      and (p_account      is null or v.account_status::text = p_account)
      and (p_verification is null or (p_verification = 'pending' and v.verification_status in ('pending','under_review'))
                                  or v.verification_status::text = p_verification)
      and (p_subject      is null or p_subject = any (v.subjects))
      and (p_experience   is null
           or (p_experience = '0-3'   and v.years_experience <= 3)
           or (p_experience = '4-7'   and v.years_experience between 4 and 7)
           or (p_experience = '8-12'  and v.years_experience between 8 and 12)
           or (p_experience = '13+'   and v.years_experience >= 13))
  )
  select to_jsonb(f), count(*) over () from f
  order by
    case when p_sort = 'newest'   then joined_at end desc,
    case when p_sort = 'oldest'   then joined_at end asc,
    case when p_sort = 'rating'   then rating end desc nulls last,
    case when p_sort = 'students' then students_count end desc,
    full_name
  limit p_size offset (greatest(p_page, 1) - 1) * p_size;
$$;
-- Subject dropdown options
create or replace view v_educator_subject_options with (security_invoker = true) as
select distinct unnest(subjects) as subject from educators order by 1;
-- ====================================================================
-- 3. STAT CARDS (Total / Active / Pending Verification / Suspended)
-- ====================================================================
create or replace function get_educator_stats()
returns table (total_educators bigint, active_educators bigint, pending_verification bigint, suspended_educators bigint)
language sql stable security invoker as $$
  select count(*),
         count(*) filter (where account_status = 'active'),
         count(*) filter (where verification_status in ('pending','under_review')),
         count(*) filter (where account_status = 'suspended')
  from educators;
$$;
-- Re-created dependants (dashboard "Educator Verifications" and Assign Educators dropdown)
create or replace view v_pending_educators with (security_invoker = true) as
select e.id, p.full_name, e.submitted_at
from educators e join profiles p on p.id = e.id
where e.verification_status in ('pending','under_review') order by e.submitted_at desc;
create or replace view v_eligible_educators with (security_invoker = true) as
select e.id, p.full_name as name, e.subjects
from educators e join profiles p on p.id = e.id
where e.verification_status = 'verified' and e.account_status = 'active';
-- ====================================================================
-- 4. ROW ACTIONS
-- ====================================================================
-- Click row / View Details / Verification Details: one call for the educator page header + documents + history
create or replace function get_educator_detail(p_id uuid) returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'educator',  to_jsonb(v),
    'documents', (select coalesce(jsonb_agg(to_jsonb(d) order by d.uploaded_at), '[]') from educator_documents d where d.educator_id = p_id),
    'history',   (select coalesce(jsonb_agg(to_jsonb(h) order by h.at desc), '[]') from educator_status_history h where h.educator_id = p_id))
  from v_educators_list v where v.id = p_id;
$$;
-- Suspend (confirm popup), Activate, Deactivate. Returns how many open assignments the educator still holds.
create or replace function set_educator_account_status(p_id uuid, p_status educator_account, p_reason text default null)
returns int language plpgsql security definer set search_path = public as $$
declare old educator_account;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select account_status into old from educators where id = p_id for update;
  if not found then raise exception 'Educator not found'; end if;
  if old = p_status then raise exception 'Educator is already %', p_status; end if;
  update educators set account_status = p_status,
         status_reason = case when p_status = 'active' then null else p_reason end,
         suspended_at  = case when p_status = 'suspended' then now() else null end
   where id = p_id;
  insert into educator_status_history (educator_id, kind, from_value, to_value, reason, by_admin)
  values (p_id, 'account', old::text, p_status::text, p_reason, auth.uid());
  return (select count(*) from test_assignments where educator_id = p_id and status in ('assigned','in_progress','revision_requested'));
end $$;
-- Verification decision (used from the Verification Details tab)
create or replace function set_educator_verification(p_id uuid, p_decision educator_verification, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare old educator_verification;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if p_decision = 'rejected' and nullif(btrim(coalesce(p_note,'')),'') is null then raise exception 'A reason is required to reject'; end if;
  select verification_status into old from educators where id = p_id for update;
  if not found then raise exception 'Educator not found'; end if;
  update educators set verification_status = p_decision where id = p_id;
  insert into educator_status_history (educator_id, kind, from_value, to_value, reason, by_admin)
  values (p_id, 'verification', old::text, p_decision::text, p_note, auth.uid());
end $$;
-- Delete educator (confirm popup). Refuses if they still own assignments.
create or replace function delete_educator(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if exists (select 1 from test_assignments where educator_id = p_id) then
    raise exception 'This educator has assignments. Reassign or cancel them first.';
  end if;
  delete from profiles where id = p_id and role = 'educator';
  -- remove the login too via an Edge Function: supabase.auth.admin.deleteUser(id)
end $$;
-- Inactive and suspended educators cannot sign in (same enforcement as blocked students)
create or replace function sync_educator_auth_ban() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  if new.account_status is distinct from old.account_status then
    update auth.users set banned_until = case when new.account_status in ('inactive','suspended') then 'infinity'::timestamptz else null end
     where id = new.id;
    if new.account_status in ('inactive','suspended') then delete from auth.sessions where user_id = new.id; end if;
  end if;
  return null;
end $$;
drop trigger if exists trg_edu_auth_ban on educators;
create trigger trg_edu_auth_ban after update of account_status on educators for each row execute function sync_educator_auth_ban();
-- If SQL writes to the auth schema are not allowed in your project, do this in an Edge Function with updateUserById({ ban_duration }).
-- Belt and braces: extend the blocked-account check to educators and apply it to educator-facing tables
create or replace function is_account_active() returns boolean
language sql stable security definer set search_path = public as
$$ select not exists (select 1 from students  where id = auth.uid() and status = 'blocked')
      and not exists (select 1 from educators where id = auth.uid() and account_status <> 'active') $$;
do $$ declare t text; begin
  foreach t in array array['test_assignments','assignment_comments','assignment_history','assignment_notifications'] loop
    execute format('drop policy if exists blocked_deny on %I', t);
    execute format('create policy blocked_deny on %I as restrictive for all to authenticated using (is_account_active())', t);
  end loop;
end $$;
-- ====================================================================
-- 5. ADD TEACHER (modal)  - Individual and Bulk
-- ====================================================================
-- Individual: Edge Function first creates the login (auth.admin.createUser / inviteUserByEmail) and passes its id here.
-- p = {firstName,lastName,email,phone,qualification,yearsExperience,subjects:[],gender,dob,bulk:false}
-- Individual add starts active + verified; bulk (p.bulk = true) starts inactive + pending until the invite is accepted.
create or replace function register_educator(p_user_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare em text := lower(btrim(coalesce(p->>'email',''))); bulk boolean := coalesce((p->>'bulk')::boolean, false); subs text[];
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if em = '' then raise exception 'Email is required.'; end if;
  if nullif(btrim(p->>'firstName'),'') is null or nullif(btrim(p->>'lastName'),'') is null then raise exception 'First and last name are required.'; end if;
  if nullif(btrim(p->>'qualification'),'') is null and not bulk then raise exception 'Qualification is required.'; end if;
  if exists (select 1 from profiles where lower(email) = em) then raise exception 'An educator with this email already exists.'; end if;
  select coalesce(array_agg(x), '{}') into subs from jsonb_array_elements_text(coalesce(p->'subjects','[]'::jsonb)) x;
  insert into profiles (id, full_name, email, role) values (p_user_id, btrim(p->>'firstName') || ' ' || btrim(p->>'lastName'), em, 'educator');
  insert into educators (id, phone, gender, dob, qualification, years_experience, subjects, account_status, verification_status, onboarded_via)
  values (p_user_id, nullif(p->>'phone',''), nullif(p->>'gender',''), nullif(p->>'dob','')::date, nullif(btrim(p->>'qualification'),''),
          coalesce(nullif(p->>'yearsExperience','')::int, 0), subs,
          case when bulk then 'inactive' else 'active' end::educator_account,
          case when bulk then 'pending'  else 'verified' end::educator_verification,
          case when bulk then 'bulk_import' else 'admin' end);
  return p_user_id;
end $$;
-- Bulk mode: rows from the uploaded file {name, phone, email}; duplicates are skipped and reported.
create or replace function create_educator_invites(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb; em text; ok int := 0; skipped jsonb := '[]'::jsonb;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    em := lower(btrim(coalesce(r->>'email','')));
    if em = '' or nullif(btrim(r->>'name'),'') is null then
      skipped := skipped || jsonb_build_object('email', em, 'reason', 'Name and email are required');
    elsif exists (select 1 from profiles where lower(email) = em) or exists (select 1 from educator_invites where lower(email) = em and status in ('pending','sent')) then
      skipped := skipped || jsonb_build_object('email', em, 'reason', 'Already exists');
    else
      insert into educator_invites (name, phone, email, invited_by) values (btrim(r->>'name'), nullif(r->>'phone',''), em, auth.uid());
      ok := ok + 1;
    end if;
  end loop;
  return jsonb_build_object('created', ok, 'skipped', skipped);
end $$;
-- "Send Invites": the Edge Function reads status = 'pending' rows, calls auth.admin.inviteUserByEmail, then marks them 'sent'
-- and calls register_educator(user_id, row || {"bulk": true}). When the educator accepts, set status = 'accepted'.
-- Educator side
create or replace function touch_educator_last_active() returns void
language sql security definer set search_path = public as $$ update educators set last_active_at = now() where id = auth.uid() $$;
-- ====================================================================
-- 6. ROW LEVEL SECURITY
-- ====================================================================
alter table educator_documents      enable row level security;
alter table educator_ratings        enable row level security;
alter table educator_status_history enable row level security;
alter table educator_invites        enable row level security;
drop policy if exists edu_docs_admin   on educator_documents;
drop policy if exists edu_docs_own     on educator_documents;
drop policy if exists edu_docs_ins     on educator_documents;
drop policy if exists edu_rate_admin   on educator_ratings;
drop policy if exists edu_rate_own     on educator_ratings;
drop policy if exists edu_hist_admin   on educator_status_history;
drop policy if exists edu_inv_admin    on educator_invites;
create policy edu_docs_admin on educator_documents for all using (is_admin()) with check (is_admin());
create policy edu_docs_own   on educator_documents for select using (educator_id = auth.uid());
create policy edu_docs_ins   on educator_documents for insert with check (educator_id = auth.uid());
create policy edu_rate_admin on educator_ratings for all using (is_admin()) with check (is_admin());
create policy edu_rate_own   on educator_ratings for all
  using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy edu_hist_admin on educator_status_history for all using (is_admin()) with check (is_admin());
create policy edu_inv_admin  on educator_invites for all using (is_admin()) with check (is_admin());

