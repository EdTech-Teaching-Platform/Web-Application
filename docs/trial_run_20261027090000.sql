-- Trial for supabase/migrations/20261027090000_admin_block_subjective.sql ONLY.
-- Paste all of it into the SQL editor and run: expect "Success. No rows returned".
-- Everything is rolled back.
begin;

-- =====================================================================
-- 20261027090000_admin_block_subjective.sql
--
-- Purpose
--   Short answer, long answer and subjective questions are "coming soon".
--   OUR question save functions refuse to create or edit them; existing
--   rows stay readable (and deletable), students keep seeing "pending review".
--     * adm_insert_question  (create_question, create_test, upsert_test_series_full)
--         - refuses short_answer / long_answer / subjective / descriptive
--           (any type that maps to the lead's short_answer);
--         - refuses a fill-in-the-blank question without an accepted answer
--           (it used to get "Manual grading: see rubric" as the accepted answer).
--     * adm_copy_quiz        (duplicate_test, duplicate_test_series)
--         - refuses to copy a test that contains a subjective question.
--     * update_question, create_question_option, update_question_option
--         - refuse to edit an existing subjective question or change a
--           question to a subjective type.
--   Error: SQLSTATE 22023 with a message the admin UI shows as is.
--   The bodies are the 20261025110400 / 110600 definitions verbatim plus the
--   marked 20261027090000 lines.
--
-- New helpers (internal, revoked from every browser role)
--   adm_is_subjective_type(text), adm_question_is_subjective(uuid),
--   adm_assert_question_type_allowed(text)
--
-- Lead objects touched
--   None (functions only; the lead's tables, publish_test_series and is_admin are untouched).
--
-- ROLLBACK
--   Run scripts/rollback_20261027090000_admin_block_subjective.sql (one
--   transaction): it restores the five functions exactly as defined in
--   20261025110400 / 20261025110600, then drops the three helpers.
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
      'public.adm_insert_question(uuid,integer,jsonb,uuid,text)', 'public.adm_copy_quiz(uuid,uuid,integer,text)',
      'public.update_question(uuid,jsonb)', 'public.create_question_option(uuid,jsonb)',
      'public.update_question_option(uuid,jsonb)', 'public.adm_map_question_type(text)', 'public.adm_text_answer(jsonb)',
      'public.adm_require_admin()', 'public.adm_require_quiz(uuid)', 'public.adm_question_json(uuid)',
      'public.adm_insert_options(uuid,text,jsonb)', 'public.adm_ui_question_type(text)', 'public.adm_audit(text,text,uuid,jsonb,jsonb,text)'
    ]) as x(sig)
   where to_regprocedure(x.sig) is null;
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('missing functions (Batch 2 not applied?): ' || array_to_string(v_list, ', '));
  end if;

  select coalesce(array_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' order by p.proname), '{}')
    into v_list
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('adm_is_subjective_type', 'adm_question_is_subjective', 'adm_assert_question_type_allowed');
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('functions already exist: ' || array_to_string(v_list, ', '));
  end if;

  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'quiz_question_admin' and column_name = 'needs_manual_grading') then
    v_problems := v_problems || 'missing column quiz_question_admin.needs_manual_grading'::text;
  end if;

  if cardinality(v_problems) > 0 then
    raise exception 'Block-subjective preflight: %', array_to_string(v_problems, '; ');
  end if;
end $pre$;

-- ------------------------------------------------------------------ helpers
-- True for every type the editor / imports call subjective, or that maps to
-- the lead's short_answer.
create or replace function public.adm_is_subjective_type(p_type text) returns boolean
language sql immutable set search_path = public, extensions as $$
  select lower(btrim(coalesce(p_type, ''))) in ('short_answer', 'long_answer', 'subjective', 'descriptive')
      or coalesce(public.adm_map_question_type(p_type) = 'short_answer', false);
$$;

-- An existing question is subjective when the lead stores it as short_answer,
-- our admin row says a subjective type, or it needs manual grading.
create or replace function public.adm_question_is_subjective(p_question uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1
      from public.quiz_questions qq
      left join public.quiz_question_admin qa on qa.question_id = qq.id
     where qq.id = p_question
       and (qq.question_type = 'short_answer'
            or public.adm_is_subjective_type(qa.admin_type)
            or coalesce(qa.needs_manual_grading, false)));
$$;

create or replace function public.adm_assert_question_type_allowed(p_type text) returns void
language plpgsql immutable set search_path = public, extensions as $$
begin
  if public.adm_is_subjective_type(p_type) then
    raise exception 'Short answer, long answer and subjective questions are coming soon and can''t be created yet (type "%"). Use MCQ, true / false or fill in the blank.', p_type
      using errcode = '22023';
  end if;
end $$;

-- ------------------------------------------------- guarded save functions
create or replace function public.adm_insert_question(
  p_quiz uuid, p_pos int, q jsonb, p_section uuid default null, p_source text default 'manual'
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_text   text := coalesce(nullif(btrim(coalesce(q ->> 'text', '')), ''), nullif(btrim(coalesce(q ->> 'body', '')), ''));
  v_type   text := lower(coalesce(nullif(btrim(coalesce(q ->> 'type', '')), ''), 'objective'));
  v_diff   text := lower(coalesce(nullif(btrim(coalesce(q ->> 'difficulty', '')), ''), 'medium'));
  v_source text := coalesce(nullif(q ->> 'source', ''), p_source, 'manual');
  v_lead   text;
  v_qid    uuid;
begin
  if v_text is null then return null; end if;
  v_lead := public.adm_map_question_type(v_type);
  if v_lead is null then
    raise exception 'Unsupported question type: %', v_type using errcode = '22023';
  end if;
  -- 20261027090000: subjective types are coming soon; fill-in-the-blank needs a real accepted answer.
  perform public.adm_assert_question_type_allowed(v_type);
  if v_lead = 'fill_in_blank' and public.adm_text_answer(q) = 'Manual grading: see rubric' then
    raise exception 'Fill-in-the-blank questions need an accepted answer.' using errcode = '22023';
  end if;
  if v_diff not in ('easy', 'medium', 'hard') then v_diff := 'medium'; end if;
  if v_source not in ('manual', 'ai', 'csv', 'duplicate', 'paste') then v_source := 'manual'; end if;

  insert into public.quiz_questions (quiz_id, question_text, question_type, points, explanation, sort_order)
  values (p_quiz, v_text, v_lead, coalesce(nullif(q ->> 'marks', '')::numeric, 4),
          nullif(btrim(coalesce(q ->> 'explanation', '')), ''), coalesce(p_pos, 0))
  returning id into v_qid;

  insert into public.quiz_question_admin
    (question_id, admin_type, needs_manual_grading, section_id, negative_marks, difficulty, subject, topic,
     image_path, answer_instructions, source, ai_job_id)
  values
    (v_qid, v_type, v_type in ('subjective', 'long_answer', 'descriptive'), p_section,
     greatest(coalesce(nullif(q ->> 'negativeMarks', '')::numeric, nullif(q ->> 'negative_marks', '')::numeric, 0), 0),
     v_diff, nullif(btrim(coalesce(q ->> 'subject', '')), ''), nullif(btrim(coalesce(q ->> 'topic', '')), ''),
     nullif(coalesce(q ->> 'image', q ->> 'image_path', ''), ''),
     coalesce(nullif(q ->> 'answerInstructions', ''), nullif(q ->> 'rubric', ''), nullif(q ->> 'answer_instructions', '')),
     v_source, nullif(q ->> 'aiJobId', '')::uuid);

  perform public.adm_insert_options(v_qid, v_lead, q);
  return v_qid;
end $$;

create or replace function public.adm_copy_quiz(p_src uuid, p_series uuid, p_pos int, p_title text default null) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_new    uuid;
  v_course uuid;
  v_map    jsonb := '{}'::jsonb;
  v_ns     uuid;
  v_nq     uuid;
  sec      record;
  qq       record;
begin
  -- 20261027090000: copying would create new subjective questions.
  if exists (select 1 from public.quiz_questions x where x.quiz_id = p_src and public.adm_question_is_subjective(x.id)) then
    raise exception 'This test has short answer, long answer or subjective questions, which are coming soon. Delete them from the test before duplicating it.'
      using errcode = '22023';
  end if;
  select course_id into v_course from public.test_series where id = p_series;
  insert into public.quizzes (course_id, series_id, series_sort_order, title, description, time_limit_mins,
                              max_attempts, passing_score, shuffle_questions, is_required, show_answers_after, is_proctored)
  select v_course, p_series, p_pos, left(coalesce(p_title, q.title), 200), q.description, q.time_limit_mins,
         q.max_attempts, q.passing_score, q.shuffle_questions, q.is_required, q.show_answers_after, q.is_proctored
    from public.quizzes q where q.id = p_src
  returning id into v_new;
  if v_new is null then raise exception 'Test not found.' using errcode = 'P0002'; end if;

  insert into public.quiz_admin (quiz_id, status, total_marks_planned, passing_marks, shuffle_options, window_mode,
                                 open_at, close_at, scheduled_at, planned_questions, topics)
  select v_new, 'draft', total_marks_planned, passing_marks, shuffle_options, window_mode,
         open_at, close_at, scheduled_at, planned_questions, topics
    from public.quiz_admin where quiz_id = p_src;
  insert into public.quiz_admin (quiz_id) values (v_new) on conflict (quiz_id) do nothing;

  for sec in select * from public.test_sections where quiz_id = p_src order by position loop
    insert into public.test_sections (quiz_id, position, name, instructions, planned_questions, planned_marks)
    values (v_new, sec.position, sec.name, sec.instructions, sec.planned_questions, sec.planned_marks)
    returning id into v_ns;
    v_map := v_map || jsonb_build_object(sec.id::text, v_ns);
  end loop;

  for qq in
    select x.id, x.question_text, x.question_type, x.points, x.explanation, x.sort_order,
           qa.admin_type, qa.needs_manual_grading, qa.section_id, qa.negative_marks, qa.difficulty,
           qa.subject, qa.topic, qa.image_path, qa.answer_instructions
      from public.quiz_questions x
      left join public.quiz_question_admin qa on qa.question_id = x.id
     where x.quiz_id = p_src
     order by x.sort_order, x.created_at
  loop
    insert into public.quiz_questions (quiz_id, question_text, question_type, points, explanation, sort_order)
    values (v_new, qq.question_text, qq.question_type, qq.points, qq.explanation, qq.sort_order)
    returning id into v_nq;
    insert into public.quiz_question_admin (question_id, admin_type, needs_manual_grading, section_id, negative_marks,
                                            difficulty, subject, topic, image_path, answer_instructions, source)
    values (v_nq, coalesce(qq.admin_type, public.adm_ui_question_type(qq.question_type)),
            coalesce(qq.needs_manual_grading, false),
            case when qq.section_id is not null then nullif(v_map ->> qq.section_id::text, '')::uuid end,
            coalesce(qq.negative_marks, 0), coalesce(qq.difficulty, 'medium'), qq.subject, qq.topic,
            qq.image_path, qq.answer_instructions, 'duplicate');
    insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
    select v_nq, o.option_text, o.is_correct, o.sort_order
      from public.quiz_question_options o where o.question_id = qq.id;
    -- A text-answer source without a correct option (e.g. one written by the
    -- lead's app) gets the placeholder, so the copy stays publishable.
    if qq.question_type in ('fill_in_blank', 'short_answer')
       and not exists (select 1 from public.quiz_question_options o where o.question_id = v_nq and o.is_correct) then
      insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
      values (v_nq, public.adm_text_answer('{}'::jsonb), true,
              coalesce((select max(o.sort_order) from public.quiz_question_options o where o.question_id = v_nq), 0) + 1);
    end if;
  end loop;
  return v_new;
end $$;

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

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_is_subjective_type(text) from public, anon, authenticated;
revoke all on function public.adm_question_is_subjective(uuid) from public, anon, authenticated;
revoke all on function public.adm_assert_question_type_allowed(text) from public, anon, authenticated;
-- Unchanged grants of the replaced functions (create or replace keeps them; restated for clarity).
revoke all on function public.adm_insert_question(uuid, int, jsonb, uuid, text) from public, anon, authenticated;
revoke all on function public.adm_copy_quiz(uuid, uuid, int, text) from public, anon, authenticated;
revoke all on function public.update_question(uuid, jsonb) from public, anon;
grant execute on function public.update_question(uuid, jsonb) to authenticated;
revoke all on function public.create_question_option(uuid, jsonb) from public, anon;
grant execute on function public.create_question_option(uuid, jsonb) to authenticated;
revoke all on function public.update_question_option(uuid, jsonb) from public, anon;
grant execute on function public.update_question_option(uuid, jsonb) to authenticated;

rollback;
