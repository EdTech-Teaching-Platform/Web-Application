-- =====================================================================
-- scripts/rollback_20261028_educator_series.sql   (GENERATED)
--
-- Undoes 20261028100400, 100300, 100200 and 100100 (educators on the shared
-- test series RPCs):
--   1. restores the 27 functions 20261028100200 replaced, verbatim from the
--      file named above each one (their previous definitions);
--   2. drops the portal, approval and guard functions, adm_publish_series_core
--      and adm_quiz_series;
--   3. sets pending_approval / rejected series back to draft, restores the
--      original status CHECK and drops the new test_series_admin columns.
-- Rows written through the RPCs stay (series, tests, regraded scores, notifications).
-- Run the educator onboarding rollback (scripts/rollback_20261028_educator_onboarding.sql) after this one, if needed.
-- One transaction. Run only with "approved: rollback 20261028 educator series".
-- =====================================================================
begin;
set local search_path = public, extensions;

-- 1. previous definitions
-- get_test_series_stats (from 20261025110500_admin_rpc_test_series.sql)
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

-- list_test_series (from 20261025110500_admin_rpc_test_series.sql)
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

-- get_test_series (from 20261025110500_admin_rpc_test_series.sql)
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

-- series_name_exists (from 20261027110000_admin_fast_publish.sql)
create or replace function public.series_name_exists(p_name text, p_exclude uuid default null) returns boolean
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return public.adm_series_name_taken(p_name, p_exclude);
end $$;

-- create_test_series (from 20261025110500_admin_rpc_test_series.sql)
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

-- update_test_series (from 20261025110500_admin_rpc_test_series.sql)
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

-- delete_test_series (from 20261025110500_admin_rpc_test_series.sql)
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

-- duplicate_test_series (from 20261025110500_admin_rpc_test_series.sql)
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

-- save_wizard_draft (from 20261025110500_admin_rpc_test_series.sql)
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

-- discard_wizard_draft (from 20261025110500_admin_rpc_test_series.sql)
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

-- upsert_test_series_full (from 20261027110000_admin_fast_publish.sql)
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
  t         jsonb;
  tpos      int;
  v_tests   int := 0;
begin
  perform public.adm_require_admin();
  if v_name is null then raise exception 'Series name is required.' using errcode = '22023'; end if;
  if v_method not in ('scratch', 'duplicate', 'csv', 'ai', 'manual') then v_method := null; end if;
  v_source := case v_method when 'csv' then 'csv' when 'ai' then 'ai' when 'duplicate' then 'duplicate' else 'manual' end;
  v_price := case when v_pricing = 'paid' then coalesce(nullif(p ->> 'price', '')::numeric, 0) else 0 end;
  if v_pricing = 'paid' and v_price <= 0 then
    raise exception 'Enter a price for a paid series.' using errcode = '22023';
  end if;
  -- Two saves with the same name (a double click on a new series) wait for
  -- each other, so the second one sees the first one's series.
  perform pg_advisory_xact_lock(hashtextextended('adm_series_name:' || lower(v_name), 0));
  if public.adm_series_name_taken(v_name, sid) then
    raise exception 'A test series with this name already exists.' using errcode = '23505';
  end if;
  select coalesce(array_agg(btrim(x)) filter (where btrim(x) <> ''), '{}') into v_langs
    from jsonb_array_elements_text(case when jsonb_typeof(c -> 'languages') = 'array' then c -> 'languages' else '[]'::jsonb end) x;

  if sid is null then
    sid := public.adm_new_house_series(v_name, p ->> 'about', v_method);
  else
    perform public.adm_require_series(sid);
    -- The row lock makes concurrent saves of this series run one after the other.
    select course_id into v_course from public.test_series where id = sid for update;
    if v_course is distinct from public.adm_house_course_id() then
      raise exception 'This series belongs to a course; edit its tests individually instead of replacing them.' using errcode = '22023';
    end if;
    if exists (select 1 from public.quiz_attempts qat join public.quizzes qz on qz.id = qat.quiz_id where qz.series_id = sid) then
      raise exception 'This series already has attempts; edit tests and questions individually instead of replacing them.' using errcode = '22023';
    end if;
    perform public.adm_ensure_series_admin(sid);
    update public.test_series set title = left(v_name, 150), description = nullif(p ->> 'about', ''), updated_at = now()
     where id = sid;
    perform public.adm_delete_series_quizzes(sid);
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
  for t, tpos in
    select e.t, e.ord
      from jsonb_array_elements(case when jsonb_typeof(p -> 'tests') = 'array' then p -> 'tests' else '[]'::jsonb end)
           with ordinality as e(t, ord)
  loop
    v_tests := tpos;
    insert into public.quizzes (course_id, series_id, series_sort_order, title)
    values (v_course, sid, tpos, left(coalesce(nullif(btrim(coalesce(t ->> 'name', '')), ''), 'Test ' || tpos), 200))
    returning id into v_quiz;
    perform public.adm_apply_test_fields(v_quiz, t - 'name');

    insert into public.test_sections (quiz_id, position, name, instructions, planned_questions, planned_marks)
    select v_quiz, e.ord, coalesce(nullif(btrim(coalesce(e.s ->> 'name', '')), ''), 'Section ' || e.ord), e.s ->> 'instructions',
           nullif(e.s ->> 'questionCount', '')::int, nullif(e.s ->> 'marks', '')::numeric
      from jsonb_array_elements(case when jsonb_typeof(t -> 'sections') = 'array' then t -> 'sections' else '[]'::jsonb end)
           with ordinality as e(s, ord);

    perform public.adm_insert_questions_bulk(v_quiz, t -> 'questions', v_source);
  end loop;

  perform public.adm_sync_series_to_lead(sid);
  perform public.adm_audit('test_series.wizard_save', 'test_series', sid, null,
                           jsonb_build_object('tests', v_tests, 'publish', coalesce(p_publish, false)), null);
  if coalesce(p_publish, false) then
    perform public.adm_publish_test_series(sid, true);
  end if;
  return sid;
end $$;

-- set_test_status (from 20261025110600_admin_rpc_tests_questions.sql)
create or replace function public.set_test_status(p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_msg text;
  v_old text;
begin
  perform public.adm_require_admin();
  perform public.adm_require_quiz(p_id);
  if p_status not in ('draft', 'published') then
    raise exception 'Unknown test status: %', p_status using errcode = '22023';
  end if;
  if p_status = 'published' then
    v_msg := public.adm_validate_quiz_for_publish(p_id);
    if v_msg is not null then raise exception '%', v_msg using errcode = '22023'; end if;
  end if;
  insert into public.quiz_admin (quiz_id) values (p_id) on conflict (quiz_id) do nothing;
  select status into v_old from public.quiz_admin where quiz_id = p_id for update;
  update public.quiz_admin set status = p_status where quiz_id = p_id;
  if p_status = 'published' then
    perform public.adm_complete_assignments_for_quiz(p_id);
  end if;
  perform public.adm_audit('test.' || case when p_status = 'published' then 'publish' else 'unpublish' end,
                           'quiz', p_id, jsonb_build_object('status', v_old), jsonb_build_object('status', p_status), null);
  return public.adm_test_json(p_id);
end $$;

-- create_test (from 20261025110600_admin_rpc_tests_questions.sql)
create or replace function public.create_test(p_series_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_course uuid;
  v_pos    int;
  v_quiz   uuid;
  q        jsonb;
  qpos     int := 0;
begin
  perform public.adm_require_admin();
  perform public.adm_require_series(p_series_id);
  if nullif(btrim(coalesce(p ->> 'name', '')), '') is null then
    raise exception 'Test name is required.' using errcode = '22023';
  end if;
  select course_id into v_course from public.test_series where id = p_series_id;
  select coalesce(max(series_sort_order), 0) + 1 into v_pos from public.quizzes where series_id = p_series_id;

  insert into public.quizzes (course_id, series_id, series_sort_order, title)
  values (v_course, p_series_id, v_pos, left(btrim(p ->> 'name'), 200))
  returning id into v_quiz;
  perform public.adm_apply_test_fields(v_quiz, p - 'status' - 'questions');

  for q in select * from jsonb_array_elements(case when jsonb_typeof(p -> 'questions') = 'array' then p -> 'questions' else '[]'::jsonb end) loop
    if public.adm_insert_question(v_quiz, qpos + 1, q - 'id', null, 'manual') is not null then
      qpos := qpos + 1;
    end if;
  end loop;

  perform public.adm_audit('test.create', 'quiz', v_quiz, null, jsonb_build_object('series_id', p_series_id, 'title', p ->> 'name'), null);
  if p ->> 'status' = 'published' then
    return public.set_test_status(v_quiz, 'published');
  end if;
  return public.adm_test_json(v_quiz);
end $$;

-- update_test (from 20261025110600_admin_rpc_tests_questions.sql)
create or replace function public.update_test(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_old text;
begin
  perform public.adm_require_admin();
  perform public.adm_require_quiz(p_id);
  perform public.adm_apply_test_fields(p_id, p - 'status' - 'questions');
  select coalesce(qa.status, 'draft') into v_old from public.quiz_admin qa where qa.quiz_id = p_id;
  perform public.adm_audit('test.update', 'quiz', p_id, null, p - 'questions', null);
  if p ->> 'status' in ('draft', 'published') and p ->> 'status' is distinct from v_old then
    return public.set_test_status(p_id, p ->> 'status');
  end if;
  return public.adm_test_json(p_id);
end $$;

-- delete_test (from 20261025110600_admin_rpc_tests_questions.sql)
create or replace function public.delete_test(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_series uuid;
begin
  perform public.adm_require_admin();
  v_series := public.adm_require_quiz(p_id);
  perform public.adm_delete_quiz(p_id);
  perform public.adm_audit('test.delete', 'quiz', p_id, jsonb_build_object('series_id', v_series), null, null);
end $$;

-- duplicate_test (from 20261025110600_admin_rpc_tests_questions.sql)
create or replace function public.duplicate_test(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_series uuid;
  v_pos    int;
  v_title  text;
  v_new    uuid;
begin
  perform public.adm_require_admin();
  v_series := public.adm_require_quiz(p_id);
  select coalesce(max(series_sort_order), 0) + 1 into v_pos from public.quizzes where series_id = v_series;
  select title || ' (Copy)' into v_title from public.quizzes where id = p_id;
  v_new := public.adm_copy_quiz(p_id, v_series, v_pos, v_title);
  perform public.adm_audit('test.duplicate', 'quiz', v_new, null, jsonb_build_object('source', p_id), null);
  return public.adm_test_json(v_new);
end $$;

-- create_test_section (from 20261025110600_admin_rpc_tests_questions.sql)
create or replace function public.create_test_section(p_test_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_pos int;
  r     public.test_sections;
begin
  perform public.adm_require_admin();
  perform public.adm_require_quiz(p_test_id);
  if nullif(btrim(coalesce(p ->> 'name', '')), '') is null then
    raise exception 'Section name is required.' using errcode = '22023';
  end if;
  v_pos := coalesce(nullif(p ->> 'position', '')::int,
                    (select coalesce(max(position), 0) + 1 from public.test_sections where quiz_id = p_test_id));
  insert into public.test_sections (quiz_id, position, name, instructions, planned_questions, planned_marks)
  values (p_test_id, v_pos, btrim(p ->> 'name'), nullif(p ->> 'instructions', ''),
          coalesce(nullif(p ->> 'planned_questions', ''), nullif(p ->> 'plannedQuestions', ''))::int,
          coalesce(nullif(p ->> 'planned_marks', ''), nullif(p ->> 'plannedMarks', ''))::numeric)
  returning * into r;
  return to_jsonb(r);
end $$;

-- update_test_section (from 20261025110600_admin_rpc_tests_questions.sql)
create or replace function public.update_test_section(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r public.test_sections;
begin
  perform public.adm_require_admin();
  perform public.adm_require_quiz((select quiz_id from public.test_sections where id = p_id));
  if p ? 'name' and nullif(btrim(coalesce(p ->> 'name', '')), '') is null then
    raise exception 'Section name is required.' using errcode = '22023';
  end if;
  update public.test_sections set
    name              = case when p ? 'name' then btrim(p ->> 'name') else name end,
    instructions      = case when p ? 'instructions' then nullif(p ->> 'instructions', '') else instructions end,
    position          = case when p ? 'position' then coalesce(nullif(p ->> 'position', '')::int, position) else position end,
    planned_questions = case when p ? 'planned_questions' then nullif(p ->> 'planned_questions', '')::int
                             when p ? 'plannedQuestions' then nullif(p ->> 'plannedQuestions', '')::int else planned_questions end,
    planned_marks     = case when p ? 'planned_marks' then nullif(p ->> 'planned_marks', '')::numeric
                             when p ? 'plannedMarks' then nullif(p ->> 'plannedMarks', '')::numeric else planned_marks end
  where id = p_id
  returning * into r;
  return to_jsonb(r);
end $$;

-- delete_test_section (from 20261025110600_admin_rpc_tests_questions.sql)
create or replace function public.delete_test_section(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  perform public.adm_require_quiz((select quiz_id from public.test_sections where id = p_id));
  delete from public.test_sections where id = p_id;   -- questions keep their rows; section_id becomes null
end $$;

-- create_question (from 20261025110600_admin_rpc_tests_questions.sql)
create or replace function public.create_question(p_test_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_pos     int;
  v_section uuid := coalesce(nullif(p ->> 'section_id', ''), nullif(p ->> 'sectionId', ''))::uuid;
  v_id      uuid;
begin
  perform public.adm_require_admin();
  perform public.adm_require_quiz(p_test_id);
  if v_section is not null and not exists (select 1 from public.test_sections where id = v_section and quiz_id = p_test_id) then
    raise exception 'Section does not belong to this test.' using errcode = '22023';
  end if;
  v_pos := coalesce(nullif(p ->> 'position', '')::int,
                    (select coalesce(max(sort_order), 0) + 1 from public.quiz_questions where quiz_id = p_test_id));
  v_id := public.adm_insert_question(p_test_id, v_pos, p, v_section, 'manual');
  if v_id is null then raise exception 'Question text is required.' using errcode = '22023'; end if;
  perform public.adm_audit('question.create', 'quiz_question', v_id, null, jsonb_build_object('test_id', p_test_id), null);
  return public.adm_question_json(v_id);
end $$;

-- update_question (from 20261027090000_admin_block_subjective.sql)
create or replace function public.update_question(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_quiz        uuid;
  v_cur_lead    text;
  v_type        text;
  v_lead        text;
  v_answered    boolean;
  v_text        text;
  v_has_options boolean := jsonb_typeof(p -> 'options') = 'array' or p ? 'optionA' or p ? 'optionB';
  v_before      jsonb;
begin
  perform public.adm_require_admin();
  select quiz_id, question_type into v_quiz, v_cur_lead from public.quiz_questions where id = p_id for update;
  if v_quiz is null then raise exception 'Question not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz(v_quiz);
  v_answered := exists (select 1 from public.quiz_answers where question_id = p_id);
  -- 20261027090000: existing subjective questions are read-only.
  if public.adm_question_is_subjective(p_id) then
    raise exception 'Short answer, long answer and subjective questions are coming soon and can''t be edited yet. Existing ones stay as they are; you can delete them.'
      using errcode = '22023';
  end if;
  v_before := public.adm_question_json(p_id);

  if p ? 'type' then
    v_type := lower(btrim(coalesce(p ->> 'type', '')));
    v_lead := public.adm_map_question_type(v_type);
    if v_lead is null then raise exception 'Unsupported question type: %', v_type using errcode = '22023'; end if;
    perform public.adm_assert_question_type_allowed(v_type);
    if v_answered and v_lead <> v_cur_lead then
      raise exception 'Students have answered this question; its type cannot change.' using errcode = '22023';
    end if;
  end if;
  if p ? 'text' or p ? 'body' then
    v_text := nullif(btrim(coalesce(p ->> 'text', p ->> 'body', '')), '');
    if v_text is null then raise exception 'Question text is required.' using errcode = '22023'; end if;
  end if;

  update public.quiz_questions set
    question_text = coalesce(v_text, question_text),
    question_type = coalesce(v_lead, question_type),
    points        = case when p ? 'marks' then coalesce(nullif(p ->> 'marks', '')::numeric, points) else points end,
    explanation   = case when p ? 'explanation' then nullif(btrim(coalesce(p ->> 'explanation', '')), '') else explanation end,
    sort_order    = case when p ? 'position' then coalesce(nullif(p ->> 'position', '')::int, sort_order) else sort_order end
  where id = p_id;

  insert into public.quiz_question_admin (question_id, admin_type)
  values (p_id, public.adm_ui_question_type(v_cur_lead)) on conflict (question_id) do nothing;
  update public.quiz_question_admin set
    admin_type           = coalesce(v_type, admin_type),
    needs_manual_grading = case when v_type is not null then v_type in ('subjective', 'long_answer', 'descriptive') else needs_manual_grading end,
    negative_marks       = case when p ? 'negativeMarks' then greatest(coalesce(nullif(p ->> 'negativeMarks', '')::numeric, 0), 0)
                                when p ? 'negative_marks' then greatest(coalesce(nullif(p ->> 'negative_marks', '')::numeric, 0), 0)
                                else negative_marks end,
    difficulty           = case when lower(coalesce(p ->> 'difficulty', '')) in ('easy', 'medium', 'hard') then lower(p ->> 'difficulty') else difficulty end,
    subject              = case when p ? 'subject' then nullif(btrim(coalesce(p ->> 'subject', '')), '') else subject end,
    topic                = case when p ? 'topic' then nullif(btrim(coalesce(p ->> 'topic', '')), '') else topic end,
    image_path           = case when p ? 'image' then nullif(p ->> 'image', '')
                                when p ? 'image_path' then nullif(p ->> 'image_path', '') else image_path end,
    answer_instructions  = case when p ? 'answerInstructions' then nullif(p ->> 'answerInstructions', '')
                                when p ? 'rubric' then nullif(p ->> 'rubric', '')
                                when p ? 'answer_instructions' then nullif(p ->> 'answer_instructions', '') else answer_instructions end,
    section_id           = case when p ? 'section_id' then nullif(p ->> 'section_id', '')::uuid
                                when p ? 'sectionId' then nullif(p ->> 'sectionId', '')::uuid else section_id end
  where question_id = p_id;

  -- Options are replaced only when the payload carries option texts, when the
  -- question is (or became) a text-answer type, or when its accepted / model
  -- answer changed. Text-answer questions always get exactly one correct
  -- option (accepted answer, model answer or the manual-grading placeholder;
  -- see adm_insert_options), so they stay publishable under the lead's rule.
  if v_has_options or (v_lead is not null and v_lead not in ('multiple_choice', 'true_false'))
     or ((p ? 'correctAnswer' or p ? 'answer' or p ? 'modelAnswer' or p ? 'model_answer')
         and coalesce(v_lead, v_cur_lead) in ('fill_in_blank', 'short_answer')) then
    if v_answered then
      raise exception 'Students have answered this question; edit its options one by one instead.' using errcode = '22023';
    end if;
    delete from public.quiz_question_options where question_id = p_id;
    perform public.adm_insert_options(p_id, (select question_type from public.quiz_questions where id = p_id),
                                      p || jsonb_build_object('type', (select admin_type from public.quiz_question_admin
                                                                        where question_id = p_id)));
  end if;

  perform public.adm_audit('question.update', 'quiz_question', p_id, v_before, public.adm_question_json(p_id), null);
  return public.adm_question_json(p_id);
end $$;

-- delete_question (from 20261025110600_admin_rpc_tests_questions.sql)
create or replace function public.delete_question(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_quiz uuid;
begin
  perform public.adm_require_admin();
  select quiz_id into v_quiz from public.quiz_questions where id = p_id;
  if v_quiz is null then raise exception 'Question not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz(v_quiz);
  if exists (select 1 from public.quiz_answers where question_id = p_id) then
    raise exception 'Students have answered this question; it cannot be deleted.' using errcode = '23503';
  end if;
  delete from public.quiz_question_options where question_id = p_id;
  delete from public.quiz_questions where id = p_id;
  perform public.adm_audit('question.delete', 'quiz_question', p_id, jsonb_build_object('test_id', v_quiz), null, null);
end $$;

-- create_question_option (from 20261027090000_admin_block_subjective.sql)
create or replace function public.create_question_option(p_question_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_quiz  uuid;
  v_label text := nullif(btrim(coalesce(p ->> 'label', p ->> 'text', p ->> 'option_text', '')), '');
  v_pos   int;
  v_id    uuid;
begin
  perform public.adm_require_admin();
  select quiz_id into v_quiz from public.quiz_questions where id = p_question_id;
  if v_quiz is null then raise exception 'Question not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz(v_quiz);
  -- 20261027090000: existing subjective questions are read-only.
  if public.adm_question_is_subjective(p_question_id) then
    raise exception 'Short answer, long answer and subjective questions are coming soon and can''t be edited yet. Existing ones stay as they are; you can delete them.'
      using errcode = '22023';
  end if;
  if v_label is null then raise exception 'Option text is required.' using errcode = '22023'; end if;
  if exists (select 1 from public.quiz_answers where question_id = p_question_id) then
    raise exception 'Students have answered this question; options cannot be added.' using errcode = '22023';
  end if;
  v_pos := coalesce(nullif(p ->> 'position', '')::int,
                    (select coalesce(max(sort_order), 0) + 1 from public.quiz_question_options where question_id = p_question_id));
  insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
  values (p_question_id, v_label, coalesce((p ->> 'is_correct')::boolean, (p ->> 'isCorrect')::boolean, false), v_pos)
  returning id into v_id;
  return (select o.v from jsonb_array_elements(public.adm_question_json(p_question_id) -> 'options') as o(v)
           where o.v ->> 'id' = v_id::text);
end $$;

-- update_question_option (from 20261027090000_admin_block_subjective.sql)
create or replace function public.update_question_option(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_question uuid;
  v_correct  boolean;
  v_new      boolean := coalesce((p ->> 'is_correct')::boolean, (p ->> 'isCorrect')::boolean);
begin
  perform public.adm_require_admin();
  select question_id, is_correct into v_question, v_correct from public.quiz_question_options where id = p_id for update;
  if v_question is null then raise exception 'Option not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz((select quiz_id from public.quiz_questions where id = v_question));
  if public.adm_question_is_subjective(v_question) then
    raise exception 'Short answer, long answer and subjective questions are coming soon and can''t be edited yet. Existing ones stay as they are; you can delete them.'
      using errcode = '22023';
  end if;
  if v_new is not null and v_new is distinct from v_correct
     and exists (select 1 from public.quiz_answers where question_id = v_question) then
    raise exception 'Students have answered this question; the correct answer cannot change.' using errcode = '22023';
  end if;
  if (p ? 'label' or p ? 'text') and nullif(btrim(coalesce(p ->> 'label', p ->> 'text', '')), '') is null then
    raise exception 'Option text is required.' using errcode = '22023';
  end if;
  if v_new is false and (select question_type from public.quiz_questions where id = v_question) in ('fill_in_blank', 'short_answer') then
    raise exception 'A text-answer question keeps its answer option marked correct; edit its text instead.' using errcode = '22023';
  end if;
  update public.quiz_question_options set
    option_text = coalesce(nullif(btrim(coalesce(p ->> 'label', p ->> 'text', '')), ''), option_text),
    is_correct  = coalesce(v_new, is_correct),
    sort_order  = case when p ? 'position' then coalesce(nullif(p ->> 'position', '')::int, sort_order) else sort_order end
  where id = p_id;
  return (select o.v from jsonb_array_elements(public.adm_question_json(v_question) -> 'options') as o(v)
           where o.v ->> 'id' = p_id::text);
end $$;

-- delete_question_option (from 20261025110600_admin_rpc_tests_questions.sql)
create or replace function public.delete_question_option(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_question uuid;
begin
  perform public.adm_require_admin();
  select question_id into v_question from public.quiz_question_options where id = p_id;
  if v_question is null then raise exception 'Option not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz((select quiz_id from public.quiz_questions where id = v_question));
  if exists (select 1 from public.quiz_answers where question_id = v_question) then
    raise exception 'Students have answered this question; options cannot be removed.' using errcode = '23503';
  end if;
  if (select question_type from public.quiz_questions where id = v_question) in ('fill_in_blank', 'short_answer')
     and (select count(*) from public.quiz_question_options where question_id = v_question and is_correct and id <> p_id) = 0 then
    raise exception 'A text-answer question needs its answer option; edit it instead of deleting it.' using errcode = '22023';
  end if;
  delete from public.quiz_question_options where id = p_id;
end $$;

-- adm_new_house_series (from 20261025110400_admin_b2_authoring_helpers.sql)
create or replace function public.adm_new_house_series(p_title text, p_about text, p_start_method text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_house uuid := public.adm_house_course_id();
  v_id    uuid;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
begin
  if v_house is null then
    raise exception 'The admin house course is not configured (platform_settings admin_house_course_id).' using errcode = 'P0001';
  end if;
  if v_title is null then
    raise exception 'Series name is required.' using errcode = '22023';
  end if;
  insert into public.test_series (course_id, title, description, is_active, is_published)
  values (v_house, left(v_title, 150), nullif(p_about, ''), true, false)
  returning id into v_id;
  insert into public.test_series_admin (series_id, status, start_method, created_by)
  values (v_id, 'draft',
          case when p_start_method in ('scratch', 'duplicate', 'csv', 'ai', 'manual') then p_start_method end,
          auth.uid());
  return v_id;
end $$;

-- adm_publish_test_series (from 20261027110000_admin_fast_publish.sql)
create or replace function public.adm_publish_test_series(p_id uuid, p_publish boolean default true) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  s         public.test_series;
  v_publish boolean;
  v_live    boolean;
  v_status  text;
  v_msg     text;
  v_tests   int;
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
    v_msg := public.adm_series_publish_problem(p_id);
    if v_msg is not null then raise exception '%', v_msg using errcode = '22023'; end if;
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
    insert into public.quiz_admin (quiz_id, status)
    select q.id, 'published' from public.quizzes q where q.series_id = p_id
    on conflict (quiz_id) do update set status = 'published';
  end if;
  if v_live then
    perform public.adm_complete_assignments_for_series(p_id);
  end if;

  perform public.adm_audit(case when v_status = 'scheduled' then 'test_series.schedule'
                                when v_publish then 'test_series.publish' else 'test_series.unpublish' end,
                           'test_series', p_id, jsonb_build_object('is_published', s.is_published),
                           jsonb_build_object('is_published', v_live, 'status', v_status), null);
  return jsonb_build_object('series_id', p_id, 'is_published', v_live, 'tests', v_tests, 'status', v_status);
end $$;

-- 2. new functions
drop function if exists public.adm_publish_series_core(uuid, boolean);
drop function if exists public.adm_quiz_series(uuid);
drop function if exists public.educator_get_dashboard();
drop function if exists public.educator_get_stats();
drop function if exists public.educator_update_profile(jsonb);
drop function if exists public.educator_get_profile();
drop function if exists public.educator_add_assignment_comment(uuid, text, uuid);
drop function if exists public.educator_start_assignment(uuid);
drop function if exists public.educator_get_assignment(uuid);
drop function if exists public.educator_list_assignments(text);
drop function if exists public.adm_educator_assignment_json(uuid);
drop function if exists public.reject_educator_series(uuid, text);
drop function if exists public.approve_educator_series(uuid);
drop function if exists public.list_pending_series_approvals(text, int, int);
drop function if exists public.educator_submit_series_for_approval(uuid);
drop function if exists public.adm_notify_series_decision(uuid, text, text);
drop function if exists public.adm_series_content_problem(uuid);

-- 3. 20261028100100 (functions, then our table)
drop function if exists public.adm_update_options_in_place(uuid, text, jsonb);
drop function if exists public.adm_question_grading_key(uuid);
drop function if exists public.adm_regrade_quiz(uuid);
drop function if exists public.adm_rebuild_attempt_report(jsonb, uuid);
drop function if exists public.adm_attempt_latest_answers(uuid);
drop function if exists public.adm_series_is_independent_educator(uuid);
drop function if exists public.adm_require_series_owner(uuid);
drop function if exists public.adm_require_series_access_or_new(uuid);
drop function if exists public.adm_require_series_access(uuid, boolean);
drop function if exists public.adm_require_author();
drop function if exists public.adm_can_manage_series(uuid);
drop function if exists public.adm_can_create_series();
drop function if exists public.adm_educator_series_ids();
drop function if exists public.adm_actor_kind();
drop function if exists public.adm_series_review_json(uuid);
update public.test_series_admin set status = 'draft' where status in ('pending_approval', 'rejected');
alter table public.test_series_admin drop constraint if exists test_series_admin_status_check;
alter table public.test_series_admin add constraint test_series_admin_status_check
  check (status in ('draft', 'scheduled', 'published', 'archived'));
drop index if exists public.test_series_admin_approved_by_idx;
drop index if exists public.test_series_admin_origin_status_idx;
alter table public.test_series_admin drop column if exists approved_at, drop column if exists approved_by,
  drop column if exists submitted_at, drop column if exists rejection_reason, drop column if exists origin;

-- grants of the restored browser RPCs are unchanged by create or replace
commit;
