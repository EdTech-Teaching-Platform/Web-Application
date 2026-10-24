create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
-- ---------------------------------------------------------------- ENUMS
do $$ begin create type user_role as enum ('admin','educator','student','regional_head'); exception when duplicate_object then null; end $$;
do $$ begin create type series_status as enum ('draft','scheduled','published','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type test_status as enum ('draft','published'); exception when duplicate_object then null; end $$;
do $$ begin create type start_method as enum ('scratch','duplicate','csv','ai'); exception when duplicate_object then null; end $$;
do $$ begin create type pricing_type as enum ('free','paid'); exception when duplicate_object then null; end $$;
do $$ begin create type question_type as enum ('mcq','multi_select','true_false','short_answer','long_answer'); exception when duplicate_object then null; end $$;
do $$ begin create type difficulty_lvl as enum ('easy','medium','hard'); exception when duplicate_object then null; end $$;
do $$ begin create type attempt_status as enum ('in_progress','submitted','expired'); exception when duplicate_object then null; end $$;
do $$ begin create type ai_job_status as enum ('queued','running','completed','failed','saved'); exception when duplicate_object then null; end $$;
do $$ begin create type ai_gen_mode as enum ('full','structure_only','questions_for_structure'); exception when duplicate_object then null; end $$;
do $$ begin create type ai_input_source as enum ('form','paste_paper'); exception when duplicate_object then null; end $$;
do $$ begin create type assignment_status as enum ('assigned','in_progress','submitted','under_review',
                                       'revision_requested','approved','rejected','completed','cancelled'); exception when duplicate_object then null; end $$;
-- --------------------------------------------------------------- HELPERS
create or replace function set_updated_at() returns trigger language plpgsql set search_path = public as
$$ begin new.updated_at = now(); return new; end $$;
-- -------------------------------------------------------------- PROFILES
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  email      text unique not null,
  role       user_role not null default 'student',
  state      text,
  created_at timestamptz default now()
);
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;
-- -------------------------------------------------------------- SUBJECTS
create table if not exists subjects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  icon_key   text,
  is_custom  boolean not null default false,       -- created via "Other..."
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create unique index if not exists uq_subjects_name on subjects (lower(name));


