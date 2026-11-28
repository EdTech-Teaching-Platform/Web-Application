-- =====================================================================
-- rollback_20261129090000_admin_qa_nov28_fixes.sql
-- Undoes supabase/migrations/20261129090000_admin_qa_nov28_fixes.sql:
-- restores the replaced functions verbatim and drops the two new ones.
-- Deletions already made by admins stay recorded (account_deletion_requests,
-- audit_logs); those students are blocked and show in Students again.
-- Deploy the frontend without the Delete button / Students tab first, and
-- remove the admin-delete-student Edge Function.
-- Run only with "approved:"; take a backup first.
-- =====================================================================
set search_path = public, extensions;
begin;

drop function if exists public.adm_educator_students(uuid);
drop function if exists public.adm_account_delete_by_admin(uuid, uuid, text);

-- list_students: verbatim from 20261025100700_admin_rpc_students.sql
create or replace function public.list_students(
  p_search text default null, p_status text default null, p_grade text default null,
  p_sort text default 'registered_desc', p_page int default 1, p_size int default 8
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 8), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with base as (
    select p.id, s.student_code, p.full_name, p.email, p.phone, p.location as city, sp.grade,
           p.created_at as registered_at, coalesce(s.account_status, 'active') as account_status,
           s.blocked_reason, s.blocked_at, s.last_active_at, s.onboarded_via
      from public.profiles p
      left join public.student_profiles sp on sp.user_id = p.id
      left join public.students s on s.id = p.id
     where p.role = 'student'
  ), f as (
    select b.* from base b
     where (v_like is null or b.full_name ilike v_like or b.email ilike v_like
            or coalesce(b.student_code, '') ilike v_like)
       and (p_status is null or p_status in ('', 'all') or b.account_status = p_status)
       and public.adm_grade_matches(b.grade, p_grade)
  )
  select jsonb_build_object(
           'id', f.id, 'student_code', f.student_code, 'full_name', f.full_name, 'email', f.email,
           'initials', public.adm_initials(f.full_name), 'grade', f.grade, 'registered_at', f.registered_at,
           'status', f.account_status, 'phone', f.phone, 'city', f.city, 'state', null::text,
           'last_active_at', f.last_active_at, 'blocked_reason', f.blocked_reason, 'blocked_at', f.blocked_at,
           'onboarded_via', f.onboarded_via),
         count(*) over ()
    from f
   order by case when p_sort = 'name_asc'       then f.full_name end asc,
            case when p_sort = 'registered_asc' then f.registered_at end asc,
            f.registered_at desc, f.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

-- get_student_stats: verbatim from 20261025100700_admin_rpc_students.sql
create or replace function public.get_student_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_total bigint; v_blocked bigint;
begin
  perform public.adm_require_admin();
  select count(*) into v_total from public.profiles where role = 'student';
  select count(*) into v_blocked
    from public.students s join public.profiles p on p.id = s.id and p.role = 'student'
   where s.account_status = 'blocked';
  return jsonb_build_object('total', v_total, 'active', v_total - v_blocked, 'blocked', v_blocked);
end $$;

-- adm_educator_validate: verbatim from 20261028090100_educator_onboarding.sql
create or replace function public.adm_educator_validate(p jsonb, p_step int) returns jsonb
language plpgsql immutable set search_path = public, extensions as $$
declare
  e   jsonb := '{}'::jsonb;
  v   text;
  arr jsonb;
  n   int;
  total int;
begin
  p := coalesce(p, '{}'::jsonb);
  if p_step in (0, 1) then
    v := btrim(coalesce(p ->> 'full_name', ''));
    if char_length(v) < 2 or char_length(v) > 120 or v !~ '[[:alpha:]]' then
      e := e || jsonb_build_object('full_name', 'Enter your full name (2 to 120 characters).');
    end if;
    v := btrim(coalesce(p ->> 'phone', ''));
    if v !~ '^\+?[0-9 ()-]{7,20}$' or char_length(regexp_replace(v, '[^0-9]', '', 'g')) not between 7 and 15 then
      e := e || jsonb_build_object('phone', 'Enter a valid phone number (7 to 15 digits).');
    end if;
    v := btrim(coalesce(p ->> 'location', ''));
    if char_length(v) < 2 or char_length(v) > 120 or lower(v) = 'not provided' then
      e := e || jsonb_build_object('location', 'Enter your city or location (2 to 120 characters).');
    end if;
  end if;
  if p_step in (0, 2) then
    v := btrim(coalesce(p ->> 'qualifications', ''));
    if char_length(v) < 2 or char_length(v) > 500 then
      e := e || jsonb_build_object('qualifications', 'Enter your qualifications (2 to 500 characters).');
    end if;
    v := btrim(coalesce(p ->> 'experience_years', ''));
    if v !~ '^\d{1,2}$' or v::int > 60 then
      e := e || jsonb_build_object('experience_years', 'Years of experience must be a whole number from 0 to 60.');
    end if;
  end if;
  if p_step in (0, 3) then
    arr := case when jsonb_typeof(p -> 'subjects') = 'array' then p -> 'subjects' end;
    select count(*) filter (where btrim(x) <> '' and char_length(btrim(x)) <= 60), count(*) into n, total
      from jsonb_array_elements_text(coalesce(arr, '[]'::jsonb)) x;
    if arr is null or n = 0 or n > 20 or n <> total then
      e := e || jsonb_build_object('subjects', 'Add 1 to 20 subjects (each up to 60 characters).');
    end if;
    arr := case when jsonb_typeof(p -> 'languages') = 'array' then p -> 'languages' end;
    select count(*) filter (where btrim(x) <> '' and char_length(btrim(x)) <= 40), count(*) into n, total
      from jsonb_array_elements_text(coalesce(arr, '[]'::jsonb)) x;
    if arr is null or n = 0 or n > 10 or n <> total then
      e := e || jsonb_build_object('languages', 'Add 1 to 10 teaching languages (each up to 40 characters).');
    end if;
    v := btrim(coalesce(p ->> 'bio', ''));
    if char_length(v) < 50 or char_length(v) > 1000 then
      e := e || jsonb_build_object('bio', 'Write a short bio of 50 to 1000 characters.');
    end if;
  end if;
  return e;
end $$;

-- adm_educator_clean: verbatim from 20261028090100_educator_onboarding.sql
create or replace function public.adm_educator_clean(p jsonb, p_step int) returns jsonb
language sql immutable set search_path = public, extensions as $$
  select case p_step
    when 1 then jsonb_build_object('full_name', btrim(p ->> 'full_name'), 'phone', btrim(p ->> 'phone'),
                                   'location', btrim(p ->> 'location'))
    when 2 then jsonb_build_object('qualifications', btrim(p ->> 'qualifications'),
                                   'experience_years', (btrim(p ->> 'experience_years'))::int)
    when 3 then jsonb_build_object(
                  'subjects', (select coalesce(jsonb_agg(s order by o), '[]'::jsonb)
                                 from (select btrim(x) as s, min(i) as o
                                         from jsonb_array_elements_text(p -> 'subjects') with ordinality as t(x, i)
                                        group by btrim(x)) d),
                  'languages', (select coalesce(jsonb_agg(s order by o), '[]'::jsonb)
                                  from (select btrim(x) as s, min(i) as o
                                          from jsonb_array_elements_text(p -> 'languages') with ordinality as t(x, i)
                                         group by btrim(x)) d),
                  'bio', btrim(p ->> 'bio'))
    else '{}'::jsonb end;
$$;

-- educator_submit_onboarding: verbatim from 20261029100000_educator_state_fix.sql
create or replace function public.educator_submit_onboarding() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid    uuid := auth.uid();
  v_status jsonb;
  v_form   jsonb;
  v_errors jsonb;
  v_ids    int;
begin
  perform public.adm_require_educator();
  v_status := public.adm_educator_status_json(v_uid);
  if not (v_status ->> 'can_edit')::boolean then
    raise exception 'This application can''t be submitted now (status: %).', v_status ->> 'status' using errcode = '22023';
  end if;
  v_form := public.adm_educator_form(v_uid);
  v_errors := public.adm_educator_validate(v_form, 0);
  select count(distinct d.doc_name) into v_ids from public.educator_verification_docs d
   where d.educator_id = v_uid and d.doc_type = 'government_id' and d.doc_name in ('front', 'back');
  if v_ids < 2 then
    v_errors := v_errors || jsonb_build_object('documents', 'Upload the front and the back of your ID.');
  end if;
  if v_errors <> '{}'::jsonb then
    raise exception 'Complete every step before you submit.' using errcode = '22023', detail = v_errors::text;
  end if;

  update public.educator_profiles
     set full_name = v_form ->> 'full_name',
         phone = v_form ->> 'phone',
         location = v_form ->> 'location',
         qualifications = v_form ->> 'qualifications',
         experience_years = (v_form ->> 'experience_years')::int,
         subjects = (select array_agg(x) from jsonb_array_elements_text(v_form -> 'subjects') x),
         languages = (select array_agg(x) from jsonb_array_elements_text(v_form -> 'languages') x),
         bio = v_form ->> 'bio'
   where user_id = v_uid;
  update public.profiles
     set full_name = v_form ->> 'full_name', phone = v_form ->> 'phone', location = v_form ->> 'location'
   where id = v_uid;
  -- 20261029100000: the one state writer (review_state submitted, submitted_at, lead 'pending')
  perform public.adm_set_educator_state(v_uid, 'pending', null, v_uid);
  update public.educator_onboarding set step = 5 where user_id = v_uid;

  perform public.adm_audit('educator.onboarding_submit', 'educator', v_uid,
                           jsonb_build_object('value', v_status ->> 'status'), jsonb_build_object('value', 'pending'), null);
  return public.adm_educator_status_json(v_uid);
end $$;

revoke all on function public.list_students(text, text, text, text, int, int) from public, anon;
grant execute on function public.list_students(text, text, text, text, int, int) to authenticated;
revoke all on function public.get_student_stats() from public, anon;
grant execute on function public.get_student_stats() to authenticated;
revoke all on function public.adm_educator_validate(jsonb, int) from public, anon, authenticated;
revoke all on function public.adm_educator_clean(jsonb, int) from public, anon, authenticated;
revoke all on function public.educator_submit_onboarding() from public, anon;
grant execute on function public.educator_submit_onboarding() to authenticated;

commit;
