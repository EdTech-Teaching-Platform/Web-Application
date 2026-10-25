-- =====================================================================
-- 20261025110500_admin_rpc_test_series.sql
--
-- Purpose
--   Test series RPCs used by testSeriesApi.js (D3 / D4). Every read and write
--   of series goes through these SECURITY DEFINER functions (F9: the lead's
--   RLS gives admins read-only access to test_series).
--     get_test_series_stats()                 -> {total_series, total_enrolled, total_attempts, avg_performance}
--     list_test_series(p_search, p_status, p_pricing, p_timeline, p_page, p_size)
--     get_test_series(p_id)                   -> series + tests + sections + questions + options (one call)
--     create_test_series(p) / update_test_series(p_id, p) / delete_test_series(p_id)
--     adm_publish_test_series(p_id, p_publish default true)
--                                             -> {series_id, is_published, tests, status}
--     release_scheduled_series()              -> int (cron only: postgres / service_role)
--     duplicate_test_series(p_id)             -> new id
--     save_wizard_draft(p_id, p_state) / discard_wizard_draft(p_id)
--     series_name_exists(p_name, p_exclude)
--     upsert_test_series_full(p, p_publish)   -> wizard save / publish
--
-- Lead objects read / written
--   test_series (insert on the house course; title, description, flags, dates),
--   quizzes / quiz_questions / quiz_question_options (wizard replace mode),
--   quiz_attempts, courses, categories, enrollments; audit_logs via adm_audit.
--
-- Assumptions
--   * New series are always attached to the house course (D2).
--   * The wizard's replace mode only runs on house-course series without
--     attempts; series that live on a real course are edited test by test.
--   * The lead owns publish_test_series(uuid, boolean); it is never created or
--     replaced here. Our publish is adm_publish_test_series and applies the
--     lead's checks and messages (closing after opening, every test has a
--     question, every question has a correct option, at least one test). The
--     archived extra rules (audience / grade / exam / level / language, two
--     options per objective question) are dropped.
--   * Lead columns are the source of truth: about / description ->
--     test_series.description, instructions -> test_series.instructions,
--     access window -> test_series.available_from / available_until (only the
--     window; go-live is test_series_admin.go_live_at and is never written
--     into available_from).
--   * Scheduled go-live depends on cron: Batch 3's cron file must schedule
--     release_scheduled_series() every 5 minutes. Without it, scheduled series
--     stay unpublished.
--   * Soft delete sets test_series_admin.deleted_at and, through the sync, the
--     lead's test_series.is_active = false and is_published = false
--     (Batch 1 contract).
--   * get_test_series_stats returns an object (the archived one returned a
--     one-row table that TestSeries.jsx could not read).
--
-- ROLLBACK
--   drop function if exists public.upsert_test_series_full(jsonb, boolean);
--   drop function if exists public.series_name_exists(text, uuid);
--   drop function if exists public.discard_wizard_draft(uuid);
--   drop function if exists public.save_wizard_draft(uuid, jsonb);
--   drop function if exists public.duplicate_test_series(uuid);
--   drop function if exists public.release_scheduled_series();   -- unschedule the Batch 3 cron job first
--   drop function if exists public.adm_publish_test_series(uuid, boolean);   -- never the lead's publish_test_series(uuid, boolean)
--   drop function if exists public.delete_test_series(uuid);
--   drop function if exists public.update_test_series(uuid, jsonb);
--   drop function if exists public.create_test_series(jsonb);
--   drop function if exists public.get_test_series(uuid);
--   drop function if exists public.list_test_series(text, text, text, text, int, int);
--   drop function if exists public.get_test_series_stats();
-- =====================================================================
set search_path = public, extensions;

-- ------------------------------------------------------------------- reads
create or replace function public.get_test_series_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    with r as (select x.id from public.adm_series_rows() x),
         att as (select q.series_id, a.percentage
                   from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
                   join r on r.id = q.series_id
                  where a.status in ('submitted', 'timed_out'))
    select jsonb_build_object(
      'total_series',    (select count(*) from r),
      'total_enrolled',  (select count(*) from (select distinct st.series_id, st.student_id
                                                  from public.adm_series_students() st join r on r.id = st.series_id) e),
      'total_attempts',  (select count(*) from att),
      'avg_performance', coalesce((select round(avg(sa)) from (select avg(att.percentage) as sa from att group by att.series_id) z), 0)));
end $$;

-- p_status: draft | scheduled | published | archived. p_pricing: free | paid.
-- p_timeline: unscheduled | upcoming | ongoing | ended.
create or replace function public.list_test_series(
  p_search text default null, p_status text default null, p_pricing text default null,
  p_timeline text default null, p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 10), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with base as (select b.* from public.adm_series_rows() b),
       cnt as (select q.series_id, count(*) as n from public.quizzes q where q.series_id is not null group by q.series_id),
       enr as (select st.series_id, count(distinct st.student_id) as n from public.adm_series_students() st group by st.series_id),
       att as (select q.series_id, count(*) as n, round(avg(a.percentage)) as av
                 from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
                where a.status in ('submitted', 'timed_out') group by q.series_id),
       f as (
         select b.*, coalesce(cnt.n, 0) as test_count, coalesce(enr.n, 0) as enrollments,
                coalesce(att.n, 0) as attempts, coalesce(att.av, 0) as avg_score
           from base b
           left join cnt on cnt.series_id = b.id
           left join enr on enr.series_id = b.id
           left join att on att.series_id = b.id
          where (v_like is null
                 or (b.title || ' ' || coalesce(b.subject_name, '') || ' ' || coalesce(b.audience, '') || ' ' || coalesce(b.code, '')) ilike v_like)
            and (p_status is null or p_status in ('', 'all') or b.status = p_status)
            and (p_pricing is null or p_pricing in ('', 'all')
                 or (p_pricing = 'free' and b.is_free) or (p_pricing = 'paid' and not b.is_free))
            and (p_timeline is null or p_timeline in ('', 'all') or b.timeline = p_timeline)
       )
  select (to_jsonb(f) - 'wizard_state') || jsonb_build_object('icon_key', null::text),
         count(*) over ()
    from f
   order by f.created_at desc, f.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

-- Series + tests + sections + questions + options in one call.
create or replace function public.get_test_series(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v jsonb;
begin
  perform public.adm_require_admin();
  v := public.adm_series_json(p_id);
  if v is null then return null; end if;
  return v || jsonb_build_object('tests', coalesce((
    select jsonb_agg(public.adm_test_json(q.id) order by q.series_sort_order, q.created_at)
      from public.quizzes q where q.series_id = p_id), '[]'::jsonb));
end $$;

create or replace function public.series_name_exists(p_name text, p_exclude uuid default null) returns boolean
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return exists (select 1 from public.adm_series_rows() r
                  where lower(btrim(r.title)) = lower(btrim(coalesce(p_name, '')))
                    and (p_exclude is null or r.id <> p_exclude));
end $$;

-- --------------------------------------------------------------- publish
-- Named adm_publish_test_series because the lead already owns
-- publish_test_series(uuid, boolean); that function is never replaced. This
-- one applies the same checks with the same messages, in the same order:
--   series exists ('Test series not found.'), available_until > available_from,
--   every quiz has a question, every question has a correct option, at least
--   one quiz. It then sets the status in test_series_admin and
--   test_series.is_published: true for 'published'; false for 'draft' and for
--   'scheduled' (future go_live_at) until release_scheduled_series() runs.
--   Unlike the lead's version it inserts no 'course_update' notifications
--   (nobody is enrolled in the house course).
-- Returns the lead's shape {series_id, is_published, tests} plus status.
create or replace function public.adm_publish_test_series(p_id uuid, p_publish boolean default true) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  s         public.test_series;
  v_publish boolean;
  v_live    boolean;
  v_status  text;
  v_msg     text;
  v_tests   int;
  r         record;
begin
  perform public.adm_require_admin();
  perform public.adm_require_series(p_id);
  perform public.adm_ensure_series_admin(p_id);
  select * into s from public.test_series where id = p_id for update;
  v_publish := coalesce(p_publish, true);
  select count(*) into v_tests from public.quizzes where series_id = p_id;

  if v_publish then
    if s.available_from is not null and s.available_until is not null and s.available_until <= s.available_from then
      raise exception 'The closing time must be after the opening time.' using errcode = '22023';
    end if;
    for r in select q.id from public.quizzes q where q.series_id = p_id order by q.series_sort_order, q.created_at loop
      v_msg := public.adm_validate_quiz_for_publish(r.id);
      if v_msg is not null then raise exception '%', v_msg using errcode = '22023'; end if;
    end loop;
    if v_tests = 0 then
      raise exception 'Add at least one test before publishing.' using errcode = '22023';
    end if;
    select case when sa.go_live_mode = 'schedule' and sa.go_live_at > now() then 'scheduled' else 'published' end
      into v_status from public.test_series_admin sa where sa.series_id = p_id;
  else
    v_status := 'draft';
  end if;

  -- A future go-live keeps the lead's is_published = false ('scheduled');
  -- release_scheduled_series() flips it once go_live_at has passed.
  v_live := v_status = 'published';
  update public.test_series_admin
     set status = v_status,
         published_at = case when v_live then coalesce(published_at, now()) else published_at end
   where series_id = p_id;
  update public.test_series set is_published = v_live, updated_at = now() where id = p_id;

  if v_publish then
    insert into public.quiz_admin (quiz_id) select q.id from public.quizzes q where q.series_id = p_id
    on conflict (quiz_id) do nothing;
    update public.quiz_admin set status = 'published'
     where quiz_id in (select q.id from public.quizzes q where q.series_id = p_id);
  end if;
  if v_live then
    perform public.adm_complete_assignments_for_quiz(q.id) from public.quizzes q where q.series_id = p_id;
  end if;

  perform public.adm_audit(case when v_status = 'scheduled' then 'test_series.schedule'
                                when v_publish then 'test_series.publish' else 'test_series.unpublish' end,
                           'test_series', p_id, jsonb_build_object('is_published', s.is_published),
                           jsonb_build_object('is_published', v_live, 'status', v_status), null);
  return jsonb_build_object('series_id', p_id, 'is_published', v_live, 'tests', v_tests, 'status', v_status);
end $$;

-- Cron job (Batch 3 schedules it every 5 minutes): publishes every
-- 'scheduled' series whose go_live_at has passed. No admin check, because
-- cron runs without a user; execute is granted only to postgres and
-- service_role. Returns the number of series released.
create or replace function public.release_scheduled_series() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ids uuid[];
begin
  with u as (
    update public.test_series_admin
       set status = 'published', published_at = coalesce(published_at, go_live_at, now())
     where status = 'scheduled' and deleted_at is null
       and go_live_at is not null and go_live_at <= now()
    returning series_id
  )
  select coalesce(array_agg(series_id), '{}') into v_ids from u;
  if cardinality(v_ids) = 0 then return 0; end if;

  update public.test_series set is_published = true, updated_at = now() where id = any (v_ids);
  perform public.adm_complete_assignments_for_quiz(q.id) from public.quizzes q where q.series_id = any (v_ids);
  return cardinality(v_ids);
end $$;

-- ------------------------------------------------------ create / update
-- p: {name, description, instructions, subject, audience, pricing, price, startDate, endDate, status}
-- (status is ignored here: publishing goes through adm_publish_test_series).
-- description -> test_series.description, instructions -> test_series.instructions,
-- startDate / endDate -> test_series.available_from / available_until.
create or replace function public.create_test_series(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id      uuid;
  v_name    text := nullif(btrim(coalesce(p ->> 'name', '')), '');
  v_subject text := nullif(btrim(coalesce(p ->> 'subject', '')), '');
  v_pricing text := case when p ->> 'pricing' = 'paid' then 'paid' else 'free' end;
  v_price   numeric;
begin
  perform public.adm_require_admin();
  if v_name is null then raise exception 'Series name is required.' using errcode = '22023'; end if;
  if exists (select 1 from public.adm_series_rows() r where lower(btrim(r.title)) = lower(v_name)) then
    raise exception 'A test series with this name already exists.' using errcode = '23505';
  end if;
  v_price := case when v_pricing = 'paid' then coalesce(nullif(p ->> 'price', '')::numeric, 0) else 0 end;
  if v_pricing = 'paid' and v_price <= 0 then
    raise exception 'Enter a price for a paid series.' using errcode = '22023';
  end if;

  v_id := public.adm_new_house_series(v_name, p ->> 'description', 'manual');
  update public.test_series set instructions = nullif(p ->> 'instructions', '') where id = v_id;
  update public.test_series_admin
     set audience            = nullif(btrim(coalesce(p ->> 'audience', '')), ''),
         pricing             = v_pricing,
         price_inr           = v_price,
         subject_category_id = public.adm_subject_category(v_subject),
         subject_label       = v_subject
   where series_id = v_id;

  perform public.adm_set_series_availability(v_id, nullif(p ->> 'startDate', '')::date, nullif(p ->> 'endDate', '')::date);
  perform public.adm_sync_series_to_lead(v_id);
  perform public.adm_audit('test_series.create', 'test_series', v_id, null, jsonb_build_object('title', v_name), null);
  return public.adm_series_json(v_id);
end $$;

-- Patch semantics: only keys present in p change. status 'draft' on a
-- published / scheduled series unpublishes it.
create or replace function public.update_test_series(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  cur        public.test_series_admin;
  v_before   jsonb;
  v_name     text;
  v_subject  text;
  v_pricing  text;
  v_price    numeric;
  v_start    date;
  v_end      date;
  v_dates    boolean := p ? 'startDate' or p ? 'endDate';
begin
  perform public.adm_require_admin();
  perform public.adm_require_series(p_id);
  perform public.adm_ensure_series_admin(p_id);
  select * into cur from public.test_series_admin where series_id = p_id for update;
  v_before := public.adm_series_json(p_id);

  if p ? 'name' then
    v_name := nullif(btrim(coalesce(p ->> 'name', '')), '');
    if v_name is null then raise exception 'Series name is required.' using errcode = '22023'; end if;
    if exists (select 1 from public.adm_series_rows() r where lower(btrim(r.title)) = lower(v_name) and r.id <> p_id) then
      raise exception 'A test series with this name already exists.' using errcode = '23505';
    end if;
    update public.test_series set title = left(v_name, 150), updated_at = now() where id = p_id;
  end if;
  if p ? 'description' then
    update public.test_series set description = nullif(p ->> 'description', ''), updated_at = now() where id = p_id;
  end if;
  if p ? 'instructions' then
    update public.test_series set instructions = nullif(p ->> 'instructions', ''), updated_at = now() where id = p_id;
  end if;

  v_pricing := case when p ? 'pricing' then case when p ->> 'pricing' = 'paid' then 'paid' else 'free' end else cur.pricing end;
  v_price   := case when v_pricing = 'free' then 0
                    when p ? 'price' then coalesce(nullif(p ->> 'price', '')::numeric, 0)
                    else cur.price_inr end;
  if v_pricing = 'paid' and v_price <= 0 then
    raise exception 'Enter a price for a paid series.' using errcode = '22023';
  end if;
  select case when p ? 'startDate' then nullif(p ->> 'startDate', '')::date else r.start_date end,
         case when p ? 'endDate' then nullif(p ->> 'endDate', '')::date else r.end_date end
    into v_start, v_end
    from public.adm_series_rows() r where r.id = p_id;
  v_subject := nullif(btrim(coalesce(p ->> 'subject', '')), '');

  update public.test_series_admin
     set audience            = case when p ? 'audience' then nullif(btrim(coalesce(p ->> 'audience', '')), '') else audience end,
         subject_category_id = case when p ? 'subject' then public.adm_subject_category(v_subject) else subject_category_id end,
         subject_label       = case when p ? 'subject' then v_subject else subject_label end,
         pricing             = v_pricing,
         price_inr           = v_price,
         status              = case when p ->> 'status' = 'draft' and status in ('published', 'scheduled') then 'draft' else status end
   where series_id = p_id;

  if v_dates then
    perform public.adm_set_series_availability(p_id, v_start, v_end);
  end if;
  perform public.adm_sync_series_to_lead(p_id);
  perform public.adm_audit(case when p ->> 'status' = 'draft' and cur.status in ('published', 'scheduled')
                                then 'test_series.unpublish' else 'test_series.update' end,
                           'test_series', p_id, v_before, public.adm_series_json(p_id), null);
  return public.adm_series_json(p_id);
end $$;

create or replace function public.delete_test_series(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  perform public.adm_require_series(p_id);
  perform public.adm_ensure_series_admin(p_id);
  update public.test_series_admin set deleted_at = now() where series_id = p_id;
  perform public.adm_sync_series_to_lead(p_id);   -- is_active = false, is_published = false
  perform public.adm_audit('test_series.delete', 'test_series', p_id, null, null, null);
end $$;

create or replace function public.duplicate_test_series(p_id uuid) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  src   record;
  v_new uuid;
  q     record;
  v_n   int := 0;
begin
  perform public.adm_require_admin();
  perform public.adm_require_series(p_id);
  select r.* into src from public.adm_series_rows() r where r.id = p_id;

  v_new := public.adm_new_house_series(left(src.title || ' (Copy)', 150), src.about, 'duplicate');
  update public.test_series set instructions = src.instructions where id = v_new;
  update public.test_series_admin
     set who_for = src.who_for, audience = src.audience, syllabus = src.syllabus,
         pricing = src.pricing, price_inr = src.price_inr,
         subject_category_id = src.subject_category_id, subject_label = src.subject_name,
         grade = src.grade, exam = src.exam, level = src.level, languages = coalesce(src.languages, '{}'),
         monthly_limit = src.monthly_limit, access_days = src.access_days,
         late_allowed = coalesce(src.late_allowed, false) and src.late_grace_minutes is not null,
         late_grace_minutes = src.late_grace_minutes
   where series_id = v_new;

  for q in select x.id from public.quizzes x where x.series_id = p_id order by x.series_sort_order, x.created_at loop
    v_n := v_n + 1;
    perform public.adm_copy_quiz(q.id, v_new, v_n, null);
  end loop;

  -- Copy the source window unless it is invalid (then the copy is undated).
  update public.test_series n
     set available_from = o.available_from, available_until = o.available_until
    from public.test_series o
   where n.id = v_new and o.id = p_id
     and (o.available_from is null or o.available_until is null or o.available_until > o.available_from);
  perform public.adm_sync_series_to_lead(v_new);
  perform public.adm_audit('test_series.duplicate', 'test_series', v_new, null, jsonb_build_object('source', p_id), null);
  return v_new;
end $$;

-- --------------------------------------------------------------- wizard
create or replace function public.save_wizard_draft(p_id uuid, p_state jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id     uuid := p_id;
  v_name   text := nullif(btrim(coalesce(p_state ->> 'name', '')), '');
  v_method text := nullif(p_state ->> 'startMethod', '');
begin
  perform public.adm_require_admin();
  if v_method not in ('scratch', 'duplicate', 'csv', 'ai', 'manual') then v_method := null; end if;
  if v_id is null then
    v_id := public.adm_new_house_series(coalesce(v_name, 'Untitled series'), nullif(p_state ->> 'about', ''), v_method);
    update public.test_series_admin set wizard_state = p_state where series_id = v_id;
  else
    perform public.adm_require_series(v_id);
    perform public.adm_ensure_series_admin(v_id);
    update public.test_series_admin
       set wizard_state = p_state, start_method = coalesce(v_method, start_method)
     where series_id = v_id and status = 'draft';
    if found and v_name is not null then
      update public.test_series set title = left(v_name, 150), updated_at = now() where id = v_id;
    end if;
  end if;
  return v_id;
end $$;

create or replace function public.discard_wizard_draft(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  update public.test_series_admin set deleted_at = now()
   where series_id = p_id and status = 'draft' and deleted_at is null;
  if found then
    perform public.adm_sync_series_to_lead(p_id);
  end if;
end $$;

-- Wizard "Save as draft" (p_publish = false) and "Publish now / Schedule".
-- Replaces the tests of a house-course series; refuses when attempts exist.
create or replace function public.upsert_test_series_full(p jsonb, p_publish boolean default false) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  sid       uuid := nullif(p ->> 'id', '')::uuid;
  c         jsonb := coalesce(p -> 'classification', '{}'::jsonb);
  a         jsonb := coalesce(p -> 'availability', '{}'::jsonb);
  l         jsonb := coalesce(p -> 'lateSubmissions', '{}'::jsonb);
  v_name    text := nullif(btrim(coalesce(p ->> 'name', '')), '');
  v_subject text := nullif(btrim(coalesce(c ->> 'subject', '')), '');
  v_method  text := nullif(p ->> 'startMethod', '');
  v_pricing text := case when p ->> 'pricing' = 'paid' then 'paid' else 'free' end;
  v_price   numeric;
  v_mode    text := case when a ->> 'mode' = 'window' then 'window' else 'always' end;
  v_golive  text := case when a ->> 'goLive' = 'schedule' then 'schedule' else 'now' end;
  v_source  text;
  v_langs   text[];
  v_course  uuid;
  v_quiz    uuid;
  v_sec     uuid;
  t         jsonb;
  s         jsonb;
  q         jsonb;
  tpos      int := 0;
  spos      int;
  qpos      int;
begin
  perform public.adm_require_admin();
  if v_name is null then raise exception 'Series name is required.' using errcode = '22023'; end if;
  if v_method not in ('scratch', 'duplicate', 'csv', 'ai', 'manual') then v_method := null; end if;
  v_source := case v_method when 'csv' then 'csv' when 'ai' then 'ai' when 'duplicate' then 'duplicate' else 'manual' end;
  v_price := case when v_pricing = 'paid' then coalesce(nullif(p ->> 'price', '')::numeric, 0) else 0 end;
  if v_pricing = 'paid' and v_price <= 0 then
    raise exception 'Enter a price for a paid series.' using errcode = '22023';
  end if;
  if exists (select 1 from public.adm_series_rows() r
              where lower(btrim(r.title)) = lower(v_name) and (sid is null or r.id <> sid)) then
    raise exception 'A test series with this name already exists.' using errcode = '23505';
  end if;
  select coalesce(array_agg(btrim(x)) filter (where btrim(x) <> ''), '{}') into v_langs
    from jsonb_array_elements_text(case when jsonb_typeof(c -> 'languages') = 'array' then c -> 'languages' else '[]'::jsonb end) x;

  if sid is null then
    sid := public.adm_new_house_series(v_name, p ->> 'about', v_method);
  else
    perform public.adm_require_series(sid);
    select course_id into v_course from public.test_series where id = sid;
    if v_course is distinct from public.adm_house_course_id() then
      raise exception 'This series belongs to a course; edit its tests individually instead of replacing them.' using errcode = '22023';
    end if;
    if exists (select 1 from public.quiz_attempts qat join public.quizzes qz on qz.id = qat.quiz_id where qz.series_id = sid) then
      raise exception 'This series already has attempts; edit tests and questions individually instead of replacing them.' using errcode = '22023';
    end if;
    perform public.adm_ensure_series_admin(sid);
    update public.test_series set title = left(v_name, 150), description = nullif(p ->> 'about', ''), updated_at = now()
     where id = sid;
    perform public.adm_delete_quiz(qz.id) from public.quizzes qz where qz.series_id = sid;
  end if;
  if p ? 'instructions' then
    update public.test_series set instructions = nullif(p ->> 'instructions', '') where id = sid;
  end if;

  update public.test_series_admin set
    who_for             = nullif(p ->> 'whoFor', ''),
    audience            = nullif(btrim(coalesce(p ->> 'audience', '')), ''),
    syllabus            = nullif(p ->> 'syllabus', ''),
    start_method        = coalesce(v_method, start_method),
    pricing             = v_pricing,
    price_inr           = v_price,
    subject_category_id = public.adm_subject_category(v_subject),
    subject_label       = v_subject,
    grade               = nullif(c ->> 'grade', ''),
    exam                = nullif(c ->> 'exam', ''),
    level               = nullif(c ->> 'difficulty', ''),
    languages           = v_langs,
    go_live_mode        = v_golive,
    go_live_at          = case when v_golive = 'schedule' then nullif(a ->> 'goLiveAt', '')::timestamptz end,
    monthly_limit      = case when coalesce((a ->> 'monthlyLimited')::boolean, false) then nullif(a ->> 'monthlyLimit', '')::int end,
    access_days         = case when coalesce((a ->> 'accessLimited')::boolean, false) then nullif(a ->> 'accessDays', '')::int end,
    late_allowed        = coalesce((l ->> 'allowed')::boolean, false),
    late_grace_minutes  = case when coalesce((l ->> 'allowed')::boolean, false) then nullif(l ->> 'graceMinutes', '')::int end,
    build_deadline      = nullif(p ->> 'buildDeadline', '')::date,
    wizard_state        = p -> 'wizardState'
  where series_id = sid;
  -- Window dates go to test_series.available_from / available_until (after
  -- go_live_* is saved, which can push available_from later).
  perform public.adm_set_series_availability(sid,
    case when v_mode = 'window' then nullif(a ->> 'openAt', '')::date end,
    case when v_mode = 'window' then nullif(a ->> 'closeAt', '')::date end);

  select course_id into v_course from public.test_series where id = sid;
  for t in select * from jsonb_array_elements(case when jsonb_typeof(p -> 'tests') = 'array' then p -> 'tests' else '[]'::jsonb end) loop
    tpos := tpos + 1;
    insert into public.quizzes (course_id, series_id, series_sort_order, title)
    values (v_course, sid, tpos, left(coalesce(nullif(btrim(coalesce(t ->> 'name', '')), ''), 'Test ' || tpos), 200))
    returning id into v_quiz;
    perform public.adm_apply_test_fields(v_quiz, t - 'name');

    spos := 0;
    for s in select * from jsonb_array_elements(case when jsonb_typeof(t -> 'sections') = 'array' then t -> 'sections' else '[]'::jsonb end) loop
      spos := spos + 1;
      insert into public.test_sections (quiz_id, position, name, instructions, planned_questions, planned_marks)
      values (v_quiz, spos, coalesce(nullif(btrim(coalesce(s ->> 'name', '')), ''), 'Section ' || spos), s ->> 'instructions',
              nullif(s ->> 'questionCount', '')::int, nullif(s ->> 'marks', '')::numeric);
    end loop;

    qpos := 0;
    for q in select * from jsonb_array_elements(case when jsonb_typeof(t -> 'questions') = 'array' then t -> 'questions' else '[]'::jsonb end) loop
      v_sec := (select ts.id from public.test_sections ts
                 where ts.quiz_id = v_quiz and ts.position = nullif(q ->> 'sectionPosition', '')::int);
      if public.adm_insert_question(v_quiz, qpos + 1, q, v_sec, v_source) is not null then
        qpos := qpos + 1;
      end if;
    end loop;
  end loop;

  perform public.adm_sync_series_to_lead(sid);
  perform public.adm_audit('test_series.wizard_save', 'test_series', sid, null,
                           jsonb_build_object('tests', tpos, 'publish', coalesce(p_publish, false)), null);
  if coalesce(p_publish, false) then
    perform public.adm_publish_test_series(sid, true);
  end if;
  return sid;
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.get_test_series_stats() from public, anon;
revoke all on function public.list_test_series(text, text, text, text, int, int) from public, anon;
revoke all on function public.get_test_series(uuid) from public, anon;
revoke all on function public.series_name_exists(text, uuid) from public, anon;
revoke all on function public.adm_publish_test_series(uuid, boolean) from public, anon;
revoke all on function public.create_test_series(jsonb) from public, anon;
revoke all on function public.update_test_series(uuid, jsonb) from public, anon;
revoke all on function public.delete_test_series(uuid) from public, anon;
revoke all on function public.duplicate_test_series(uuid) from public, anon;
revoke all on function public.save_wizard_draft(uuid, jsonb) from public, anon;
revoke all on function public.discard_wizard_draft(uuid) from public, anon;
revoke all on function public.upsert_test_series_full(jsonb, boolean) from public, anon;

grant execute on function public.get_test_series_stats() to authenticated;
grant execute on function public.list_test_series(text, text, text, text, int, int) to authenticated;
grant execute on function public.get_test_series(uuid) to authenticated;
grant execute on function public.series_name_exists(text, uuid) to authenticated;
grant execute on function public.adm_publish_test_series(uuid, boolean) to authenticated;

revoke all on function public.release_scheduled_series() from public, anon, authenticated;
grant execute on function public.release_scheduled_series() to postgres, service_role;
grant execute on function public.create_test_series(jsonb) to authenticated;
grant execute on function public.update_test_series(uuid, jsonb) to authenticated;
grant execute on function public.delete_test_series(uuid) to authenticated;
grant execute on function public.duplicate_test_series(uuid) to authenticated;
grant execute on function public.save_wizard_draft(uuid, jsonb) to authenticated;
grant execute on function public.discard_wizard_draft(uuid) to authenticated;
grant execute on function public.upsert_test_series_full(jsonb, boolean) to authenticated;
