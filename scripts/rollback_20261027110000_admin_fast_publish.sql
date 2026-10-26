-- =====================================================================
-- scripts/rollback_20261027110000_admin_fast_publish.sql
--
-- Undoes supabase/migrations/20261027110000_admin_fast_publish.sql:
-- restores adm_ensure_series_admin, series_name_exists, adm_publish_test_series
-- and upsert_test_series_full exactly as defined in 20261025110400 /
-- 20261025110500 (copied verbatim, generated), then drops the six helpers.
-- Run it as one transaction (SQL editor: paste all of it and run), and only
-- with "approved: rollback 20261027110000".
-- The 20261027090000 guards on adm_insert_question stay in force (the old
-- upsert calls adm_insert_question again).
-- =====================================================================
begin;
set local search_path = public, extensions;

-- from 20261025110400
create or replace function public.adm_ensure_series_admin(p_id uuid) returns void
language sql security definer set search_path = public, extensions as $$
  insert into public.test_series_admin
    (series_id, status, pricing, price_inr, go_live_mode, go_live_at, start_method)
  select r.id, r.status, r.pricing, r.price_inr, 'now', null::timestamptz, 'manual'
    from public.adm_series_rows() r
   where r.id = p_id
  on conflict (series_id) do nothing;
$$;

-- from 20261025110500
create or replace function public.series_name_exists(p_name text, p_exclude uuid default null) returns boolean
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return exists (select 1 from public.adm_series_rows() r
                  where lower(btrim(r.title)) = lower(btrim(coalesce(p_name, '')))
                    and (p_exclude is null or r.id <> p_exclude));
end $$;

-- from 20261025110500
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

-- from 20261025110500
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

drop function if exists public.adm_complete_assignments_for_series(uuid);
drop function if exists public.adm_series_publish_problem(uuid);
drop function if exists public.adm_delete_series_quizzes(uuid);
drop function if exists public.adm_insert_questions_bulk(uuid, jsonb, text);
drop function if exists public.adm_question_options(text, jsonb);
drop function if exists public.adm_series_name_taken(text, uuid);

revoke all on function public.adm_ensure_series_admin(uuid) from public, anon, authenticated;
revoke all on function public.series_name_exists(text, uuid) from public, anon;
revoke all on function public.adm_publish_test_series(uuid, boolean) from public, anon;
revoke all on function public.upsert_test_series_full(jsonb, boolean) from public, anon;
grant execute on function public.series_name_exists(text, uuid) to authenticated;
grant execute on function public.adm_publish_test_series(uuid, boolean) to authenticated;
grant execute on function public.upsert_test_series_full(jsonb, boolean) to authenticated;

commit;
