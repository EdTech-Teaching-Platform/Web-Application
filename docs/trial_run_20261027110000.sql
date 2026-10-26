-- Trial for supabase/migrations/20261027110000_admin_fast_publish.sql ONLY.
-- Paste all of it into the SQL editor and run: expect "Success. No rows returned".
-- Everything is rolled back. Apply after 20261027090000 (block subjective).
begin;

-- =====================================================================
-- 20261027110000_admin_fast_publish.sql
--
-- Purpose
--   Make the wizard's "Save as draft" / "Publish now" (one RPC:
--   upsert_test_series_full) fast for large series. Same inputs, same rows
--   written, same errors; the per-row work becomes set-based:
--     * adm_series_rows() full scans (every series + courses + categories, not
--       inlinable because it is SECURITY DEFINER) are gone from the save path:
--         - the duplicate-name check  -> adm_series_name_taken(text, uuid)
--         - adm_ensure_series_admin   -> reads only the one series
--       (series_name_exists, used by the wizard's live name check, too).
--     * Replacing a series' tests: one delete per table for the whole series
--       (adm_delete_series_quizzes) instead of adm_delete_quiz per test.
--     * Questions: one INSERT ... SELECT per test for quiz_questions,
--       quiz_question_admin and quiz_question_options together
--       (adm_insert_questions_bulk + adm_question_options) instead of
--       adm_insert_question + an option-by-option loop per question, and the
--       section lookup is a join instead of a subquery per question.
--       The 20261027090000 guards are kept (subjective types refused,
--       fill-in-the-blank needs an accepted answer, same messages, SQLSTATE 22023).
--     * Sections: one INSERT ... SELECT per test.
--     * Publish: one query finds the first test that is not ready
--       (adm_series_publish_problem) instead of adm_validate_quiz_for_publish
--       per test, and approved assignments are completed for the whole series
--       at once (adm_complete_assignments_for_series).
--     * Double submits: the save locks the series row (existing series) or an
--       advisory lock on the name (new series), so two concurrent saves run
--       one after the other instead of both inserting tests / series.
--   No similarity / repeated-question detection runs on save or publish
--   (detect_repeated_questions is only the cron job / the tracker's button).
--
-- Replaced (ours, same signatures, same grants)
--   adm_ensure_series_admin(uuid), series_name_exists(text, uuid),
--   adm_publish_test_series(uuid, boolean), upsert_test_series_full(jsonb, boolean)
-- New helpers (internal, revoked from every browser role)
--   adm_series_name_taken(text, uuid), adm_question_options(text, jsonb),
--   adm_insert_questions_bulk(uuid, jsonb, text), adm_delete_series_quizzes(uuid),
--   adm_series_publish_problem(uuid), adm_complete_assignments_for_series(uuid)
--
-- Lead objects touched
--   None structurally (functions only). Rows written are the same as before:
--   test_series, quizzes, quiz_questions, quiz_question_options.
--
-- Differences callers can notice
--   * When a payload has several problems, the reported one can differ: each
--     test's questions are checked before any of that test's questions are
--     written (before, the first bad question was reported after the earlier
--     ones were inserted). The whole call is still all-or-nothing.
--   * Concurrent saves of the same series wait for each other (see above).
--
-- Not in this file (needs the lead's approval, see scripts/admin_indexes_concurrently.sql)
--   An index on quiz_question_options (question_id): without it every delete
--   of quiz_questions and every "has a correct option" check scans the whole
--   options table.
--
-- ROLLBACK
--   Run scripts/rollback_20261027110000_admin_fast_publish.sql (one
--   transaction): it restores the four functions exactly as defined in
--   20261025110400 / 20261025110500, then drops the six helpers.
-- =====================================================================
set search_path = public, extensions;

-- --------------------------------------------------------------- preflight
do $pre$
declare
  v_problems text[] := '{}';
  v_list     text[];
begin
  select coalesce(array_agg(x.sig order by x.sig), '{}') into v_list
    from unnest(array[
      'public.adm_ensure_series_admin(uuid)', 'public.series_name_exists(text,uuid)',
      'public.adm_publish_test_series(uuid,boolean)', 'public.upsert_test_series_full(jsonb,boolean)',
      'public.adm_require_admin()', 'public.adm_require_series(uuid)', 'public.adm_house_course_id()',
      'public.adm_new_house_series(text,text,text)', 'public.adm_subject_category(text)',
      'public.adm_set_series_availability(uuid,date,date)', 'public.adm_apply_test_fields(uuid,jsonb)',
      'public.adm_sync_series_to_lead(uuid)', 'public.adm_audit(text,text,uuid,jsonb,jsonb,text)',
      'public.adm_map_question_type(text)', 'public.adm_text_answer(jsonb)',
      'public.adm_is_subjective_type(text)', 'public.adm_assert_question_type_allowed(text)'
    ]) as x(sig)
   where to_regprocedure(x.sig) is null;
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('missing functions (Batch 2 or 20261027090000 not applied?): ' || array_to_string(v_list, ', '));
  end if;

  select coalesce(array_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' order by p.proname), '{}')
    into v_list
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('adm_series_name_taken', 'adm_question_options', 'adm_insert_questions_bulk',
                       'adm_delete_series_quizzes', 'adm_series_publish_problem', 'adm_complete_assignments_for_series');
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('functions already exist: ' || array_to_string(v_list, ', '));
  end if;

  select coalesce(array_agg(x.t || '.' || x.c order by x.t, x.c), '{}') into v_list
    from (values ('test_sections', 'quiz_id'), ('test_sections', 'position'),
                 ('quiz_question_admin', 'section_id'), ('quiz_question_admin', 'needs_manual_grading'),
                 ('test_assignments', 'test_id'), ('assignment_history', 'assignment_id')) as x(t, c)
   where not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = x.t and column_name = x.c);
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('missing columns: ' || array_to_string(v_list, ', '));
  end if;

  if cardinality(v_problems) > 0 then
    raise exception 'Fast-publish preflight: %', array_to_string(v_problems, '; ');
  end if;
end $pre$;

-- ------------------------------------------------------- series lookups
-- Same rows as adm_series_rows() (every series without a soft-deleted admin
-- row), read straight from test_series.
create or replace function public.adm_series_name_taken(p_name text, p_exclude uuid default null) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1
      from public.test_series s
      left join public.test_series_admin sa on sa.series_id = s.id
     where sa.deleted_at is null
       and lower(btrim(s.title)) = lower(btrim(coalesce(p_name, '')))
       and (p_exclude is null or s.id <> p_exclude));
$$;

-- Lazily creates the admin row for a series the lead's app created, seeded
-- from its current state (the status / pricing adm_series_rows() derives for
-- a series without an admin row). Reads only that series.
create or replace function public.adm_ensure_series_admin(p_id uuid) returns void
language sql security definer set search_path = public, extensions as $$
  insert into public.test_series_admin
    (series_id, status, pricing, price_inr, go_live_mode, go_live_at, start_method)
  select s.id,
         case when not s.is_active then 'archived' when s.is_published then 'published' else 'draft' end,
         case when s.course_id is distinct from public.adm_house_course_id() and coalesce(c.price, 0) > 0 then 'paid' else 'free' end,
         case when s.course_id is distinct from public.adm_house_course_id() then coalesce(c.price, 0) else 0 end::numeric,
         'now', null::timestamptz, 'manual'
    from public.test_series s
    left join public.courses c on c.id = s.course_id
   where s.id = p_id
     and not exists (select 1 from public.test_series_admin sa where sa.series_id = s.id)
  on conflict (series_id) do nothing;
$$;

create or replace function public.series_name_exists(p_name text, p_exclude uuid default null) returns boolean
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return public.adm_series_name_taken(p_name, p_exclude);
end $$;

-- ---------------------------------------------------- question writers
-- The options adm_insert_options writes for one question, as rows (same
-- shapes, keys, correct flags and order).
create or replace function public.adm_question_options(p_lead text, q jsonb)
returns table (option_text text, is_correct boolean, sort_order int)
language sql immutable set search_path = public, extensions as $$
  with keys as (
    select coalesce(array_agg(upper(btrim(x))), '{}') as k
      from jsonb_array_elements_text(
             case when jsonb_typeof(q -> 'correctAnswers') = 'array' then q -> 'correctAnswers'
                  when nullif(btrim(coalesce(q ->> 'correctAnswer', '')), '') is not null then jsonb_build_array(q ->> 'correctAnswer')
                  else '[]'::jsonb end) x
  ),
  given as (
    select case when jsonb_typeof(q -> 'options') = 'array' then q -> 'options'
                else (select coalesce(jsonb_agg(jsonb_build_object('key', k, 'text', q ->> ('option' || k)) order by k), '[]'::jsonb)
                        from unnest(array['A', 'B', 'C', 'D', 'E', 'F']) as k
                       where q ? ('option' || k)) end as opts
  ),
  opts as (
    select case when p_lead = 'true_false' and jsonb_array_length(g.opts) = 0
                then '[{"key":"A","text":"True"},{"key":"B","text":"False"}]'::jsonb else g.opts end as opts
      from given g
  ),
  kept as (
    select e.o, row_number() over (order by e.ord)::int as i, e.t
      from (select o.o, o.ord, nullif(btrim(coalesce(o.o ->> 'text', o.o ->> 'label', '')), '') as t
              from opts, jsonb_array_elements(opts.opts) with ordinality as o(o, ord)) e
     where e.t is not null
  )
  select public.adm_text_answer(q), true, 1
   where p_lead in ('fill_in_blank', 'short_answer')
  union all
  select kept.t,
         upper(coalesce(nullif(kept.o ->> 'key', ''), nullif(kept.o ->> 'option_key', ''), chr(64 + kept.i))) = any (keys.k)
           or upper(kept.t) = any (keys.k)
           or coalesce((kept.o ->> 'is_correct')::boolean, (kept.o ->> 'isCorrect')::boolean, false),
         kept.i
    from kept, keys
   where p_lead in ('multiple_choice', 'true_false');
$$;

-- Writes a test's questions (the wizard's question array) in one statement:
-- quiz_questions, quiz_question_admin and quiz_question_options. Same rules
-- as adm_insert_question: blank questions are skipped (positions count only
-- the written ones), unknown / subjective types and fill-in-the-blank
-- without an accepted answer are refused before anything is written.
-- sectionPosition picks the test's section with that position.
-- Returns the number of questions written.
create or replace function public.adm_insert_questions_bulk(p_quiz uuid, p_questions jsonb, p_source text default 'manual')
returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_bad record;
  v_n   int;
begin
  if jsonb_typeof(p_questions) is distinct from 'array' then return 0; end if;

  select x.v_type, public.adm_map_question_type(x.v_type) as v_lead into v_bad
    from (select e.ord, e.q,
                 lower(coalesce(nullif(btrim(coalesce(e.q ->> 'type', '')), ''), 'objective')) as v_type,
                 coalesce(nullif(btrim(coalesce(e.q ->> 'text', '')), ''), nullif(btrim(coalesce(e.q ->> 'body', '')), '')) as v_text
            from jsonb_array_elements(p_questions) with ordinality as e(q, ord)) x
   where x.v_text is not null
     and (public.adm_map_question_type(x.v_type) is null
          or public.adm_is_subjective_type(x.v_type)
          or (public.adm_map_question_type(x.v_type) = 'fill_in_blank' and public.adm_text_answer(x.q) = 'Manual grading: see rubric'))
   order by x.ord
   limit 1;
  if found then
    if v_bad.v_lead is null then
      raise exception 'Unsupported question type: %', v_bad.v_type using errcode = '22023';
    end if;
    perform public.adm_assert_question_type_allowed(v_bad.v_type);
    raise exception 'Fill-in-the-blank questions need an accepted answer.' using errcode = '22023';
  end if;

  with src as materialized (
    select gen_random_uuid() as id, x.q, x.v_text, x.v_type, public.adm_map_question_type(x.v_type) as v_lead,
           case when x.v_diff in ('easy', 'medium', 'hard') then x.v_diff else 'medium' end as v_diff,
           case when x.v_source in ('manual', 'ai', 'csv', 'duplicate', 'paste') then x.v_source else 'manual' end as v_source,
           ts.id as section_id,
           row_number() over (order by x.ord)::int as pos
      from (select e.ord, e.q,
                   coalesce(nullif(btrim(coalesce(e.q ->> 'text', '')), ''), nullif(btrim(coalesce(e.q ->> 'body', '')), '')) as v_text,
                   lower(coalesce(nullif(btrim(coalesce(e.q ->> 'type', '')), ''), 'objective')) as v_type,
                   lower(coalesce(nullif(btrim(coalesce(e.q ->> 'difficulty', '')), ''), 'medium')) as v_diff,
                   coalesce(nullif(e.q ->> 'source', ''), p_source, 'manual') as v_source
              from jsonb_array_elements(p_questions) with ordinality as e(q, ord)) x
      left join public.test_sections ts
        on ts.quiz_id = p_quiz and ts.position = nullif(x.q ->> 'sectionPosition', '')::int
     where x.v_text is not null
  ),
  ins_q as (
    insert into public.quiz_questions (id, quiz_id, question_text, question_type, points, explanation, sort_order)
    select src.id, p_quiz, src.v_text, src.v_lead, coalesce(nullif(src.q ->> 'marks', '')::numeric, 4),
           nullif(btrim(coalesce(src.q ->> 'explanation', '')), ''), src.pos
      from src
    returning 1
  ),
  ins_a as (
    insert into public.quiz_question_admin
      (question_id, admin_type, needs_manual_grading, section_id, negative_marks, difficulty, subject, topic,
       image_path, answer_instructions, source, ai_job_id)
    select src.id, src.v_type, src.v_type in ('subjective', 'long_answer', 'descriptive'), src.section_id,
           greatest(coalesce(nullif(src.q ->> 'negativeMarks', '')::numeric, nullif(src.q ->> 'negative_marks', '')::numeric, 0), 0),
           src.v_diff, nullif(btrim(coalesce(src.q ->> 'subject', '')), ''), nullif(btrim(coalesce(src.q ->> 'topic', '')), ''),
           nullif(coalesce(src.q ->> 'image', src.q ->> 'image_path', ''), ''),
           coalesce(nullif(src.q ->> 'answerInstructions', ''), nullif(src.q ->> 'rubric', ''), nullif(src.q ->> 'answer_instructions', '')),
           src.v_source, nullif(src.q ->> 'aiJobId', '')::uuid
      from src
  ),
  ins_o as (
    insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
    select src.id, o.option_text, o.is_correct, o.sort_order
      from src cross join lateral public.adm_question_options(src.v_lead, src.q) o
  )
  select count(*) into v_n from ins_q;
  return v_n;
end $$;

-- Deletes every test of a series (options -> questions -> tests, the lead's
-- FKs do not cascade); our quiz_admin / test_sections / quiz_question_admin
-- rows cascade. Same guard as adm_delete_quiz.
create or replace function public.adm_delete_series_quizzes(p_series uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if exists (select 1 from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id where q.series_id = p_series) then
    raise exception 'This test already has student attempts and cannot be deleted or replaced.' using errcode = '23503';
  end if;
  delete from public.quiz_question_options o
   using public.quiz_questions qq, public.quizzes q
   where o.question_id = qq.id and qq.quiz_id = q.id and q.series_id = p_series;
  delete from public.quiz_questions qq
   using public.quizzes q
   where qq.quiz_id = q.id and q.series_id = p_series;
  delete from public.quizzes where series_id = p_series;
end $$;

-- ----------------------------------------------------------- publish
-- The first test (in series order) that cannot be published, with the
-- message adm_validate_quiz_for_publish gives; null when every test is ready.
create or replace function public.adm_series_publish_problem(p_series uuid) returns text
language sql stable security definer set search_path = public, extensions as $$
  with t as (
    select q.id, q.title, q.series_sort_order, q.created_at from public.quizzes q where q.series_id = p_series
  ),
  answered as (
    select distinct o.question_id
      from public.quiz_question_options o
      join public.quiz_questions qq on qq.id = o.question_id
      join t on t.id = qq.quiz_id
     where o.is_correct
  ),
  m as (
    select qq.quiz_id, count(*) as total, count(*) filter (where a.question_id is null) as no_correct
      from public.quiz_questions qq
      join t on t.id = qq.quiz_id
      left join answered a on a.question_id = qq.id
     group by qq.quiz_id
  )
  select case when coalesce(m.total, 0) = 0 then format('"%s" has no questions.', t.title)
              else format('"%s" has %s question(s) without a correct answer.', t.title, m.no_correct) end
    from t
    left join m on m.quiz_id = t.id
   where coalesce(m.total, 0) = 0 or m.no_correct > 0
   order by t.series_sort_order, t.created_at, t.id
   limit 1;
$$;

-- An approved assignment whose test is published becomes completed (every
-- test of the series at once).
create or replace function public.adm_complete_assignments_for_series(p_series uuid) returns void
language sql security definer set search_path = public, extensions as $$
  with u as (
    update public.test_assignments ta set status = 'completed'
      from public.quizzes q
     where q.id = ta.test_id and q.series_id = p_series and ta.status = 'approved'
    returning ta.id
  )
  insert into public.assignment_history (assignment_id, action, by_user, note)
  select id, 'Completed', auth.uid(), 'Linked test was published.' from u;
$$;

-- Same checks, messages, order and result as the 20261025110500 version.
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

-- ------------------------------------------------------------- wizard
-- Wizard "Save as draft" (p_publish = false) and "Publish now / Schedule":
-- save + validate + publish in one call and one transaction. Replaces the
-- tests of a house-course series; refuses when attempts exist.
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

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_series_name_taken(text, uuid) from public, anon, authenticated;
revoke all on function public.adm_question_options(text, jsonb) from public, anon, authenticated;
revoke all on function public.adm_insert_questions_bulk(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.adm_delete_series_quizzes(uuid) from public, anon, authenticated;
revoke all on function public.adm_series_publish_problem(uuid) from public, anon, authenticated;
revoke all on function public.adm_complete_assignments_for_series(uuid) from public, anon, authenticated;

-- Replaced functions keep their grants; restated so the file stands alone.
revoke all on function public.adm_ensure_series_admin(uuid) from public, anon, authenticated;
revoke all on function public.series_name_exists(text, uuid) from public, anon;
revoke all on function public.adm_publish_test_series(uuid, boolean) from public, anon;
revoke all on function public.upsert_test_series_full(jsonb, boolean) from public, anon;
grant execute on function public.series_name_exists(text, uuid) to authenticated;
grant execute on function public.adm_publish_test_series(uuid, boolean) to authenticated;
grant execute on function public.upsert_test_series_full(jsonb, boolean) to authenticated;

-- smoke checks on the new definitions (no rows are written)
do $chk$
begin
  if public.adm_series_name_taken(md5(random()::text), null) then
    raise exception 'trial: adm_series_name_taken found a random name';
  end if;
  if (select count(*) from public.adm_question_options('multiple_choice',
        '{"options":[{"key":"A","text":"x"},{"key":"B","text":"y"}],"correctAnswers":["B"]}')
       where is_correct) <> 1 then
    raise exception 'trial: adm_question_options did not mark exactly one correct option';
  end if;
  if public.adm_series_publish_problem(gen_random_uuid()) is not null then
    raise exception 'trial: adm_series_publish_problem reported a problem for a missing series';
  end if;
end $chk$;

rollback;
