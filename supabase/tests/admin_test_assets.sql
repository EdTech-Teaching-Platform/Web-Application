-- =====================================================================
-- supabase/tests/admin_test_assets.sql
--
-- Smoke tests for 20261029110000_admin_test_assets.sql (series banners and
-- question figures in the test-assets bucket). LOCAL / DISPOSABLE DATABASE
-- ONLY (fixtures in auth.users and lead tables). One transaction, rolled back.
-- Expect "ok: ..." notices and "ok: all test asset checks passed".
-- =====================================================================
begin;

create function pg_temp.expect_error(p_sql text, p_code text, p_msg text default null) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate <> p_code then
      raise exception 'expected SQLSTATE % but got % (%) for: %', p_code, sqlstate, sqlerrm, p_sql;
    end if;
    if p_msg is not null and position(p_msg in sqlerrm) = 0 then
      raise exception 'expected message "%" but got "%"', p_msg, sqlerrm;
    end if;
    return;
  end;
  raise exception 'expected SQLSTATE % but the call succeeded: %', p_code, p_sql;
end $$;

create function pg_temp.ok(p_cond boolean, p_what text) returns void
language plpgsql as $$
begin
  if not coalesce(p_cond, false) then raise exception 'FAILED: %', p_what; end if;
  raise notice 'ok: %', p_what;
end $$;

create function pg_temp.act_as(p_user uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.id(p_key text) returns uuid
language sql as $$ select nullif(current_setting('test.' || p_key, true), '')::uuid $$;

create function pg_temp.remember(p_key text, p_id uuid) returns uuid
language sql as $$ select set_config('test.' || p_key, p_id::text, true)::uuid $$;

create function pg_temp.txt(p_key text) returns text
language sql as $$ select nullif(current_setting('test.' || p_key, true), '') $$;

create function pg_temp.keep(p_key text, p_val text) returns text
language sql as $$ select set_config('test.' || p_key, p_val, true) $$;

-- '<uid>/<kind>/<uuid>.webp', as asset-upload-url builds it
create function pg_temp.asset(p_owner uuid, p_kind text) returns text
language sql as $$ select p_owner || '/' || p_kind || '/' || gen_random_uuid() || '.webp' $$;

-- One test with two single-answer questions; the first has a figure.
create function pg_temp.payload(p_id uuid, p_name text, p_cover text, p_image text, p_alt text default 'A labelled triangle') returns jsonb
language sql as $$
  select jsonb_build_object(
    'id', p_id, 'name', p_name, 'pricing', 'free', 'startMethod', 'scratch', 'coverPath', p_cover,
    'availability', jsonb_build_object('goLive', 'now', 'mode', 'always'),
    'tests', jsonb_build_array(jsonb_build_object('name', 'Unit 1', 'duration', '20', 'passingPercent', '50',
      'questions', jsonb_build_array(
        jsonb_build_object('type', 'mcq_single', 'text', 'Which angle is largest?', 'marks', '4', 'image', p_image, 'imageAlt', p_alt,
          'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', 'A'), jsonb_build_object('key', 'B', 'text', 'B')),
          'correctAnswers', jsonb_build_array('B')),
        jsonb_build_object('type', 'mcq_single', 'text', 'Capital of India?', 'marks', '4', 'image', '',
          'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', 'Delhi'), jsonb_build_object('key', 'B', 'text', 'Agra')),
          'correctAnswers', jsonb_build_array('A'))))));
$$;

do $fx$
declare
  v_admin uuid := gen_random_uuid(); v_e1 uuid := gen_random_uuid(); v_e2 uuid := gen_random_uuid(); v_stu uuid := gen_random_uuid();
  u uuid;
begin
  foreach u in array array[v_admin, v_e1, v_e2, v_stu] loop
    insert into auth.users (id, email) values (u, 'ta-' || u || '@test.local');
  end loop;
  insert into public.profiles (id, role, full_name, email) values
    (v_admin, 'admin', 'TA Admin', 'ta-' || v_admin || '@test.local'),
    (v_e1, 'educator', 'TA Educator One', 'ta-' || v_e1 || '@test.local'),
    (v_e2, 'educator', 'TA Educator Two', 'ta-' || v_e2 || '@test.local'),
    (v_stu, 'student', 'TA Student', 'ta-' || v_stu || '@test.local');
  insert into public.adm_admin_users (user_id) values (v_admin);
  insert into public.educator_profiles (user_id, full_name, phone, location, verification_status) values
    (v_e1, 'TA Educator One', '9000000011', 'Pune', 'verified'),
    (v_e2, 'TA Educator Two', '9000000012', 'Goa', 'verified');
  perform public.adm_set_educator_state(v_e1, 'approved', null, v_admin);
  perform public.adm_set_educator_state(v_e2, 'approved', null, v_admin);
  perform pg_temp.remember('admin', v_admin); perform pg_temp.remember('e1', v_e1);
  perform pg_temp.remember('e2', v_e2); perform pg_temp.remember('stu', v_stu);
end $fx$;

-- ------------------------------------------------------ the path rules
do $$
declare
  e1 uuid := pg_temp.id('e1');
  p  text := pg_temp.asset(pg_temp.id('e1'), 'banner');
begin
  perform pg_temp.ok((select public = true and 'image/webp' = any (allowed_mime_types) from storage.buckets where id = 'test-assets'),
                     'bucket: test-assets is public, images only');
  perform pg_temp.act_as(e1);
  perform pg_temp.ok(public.adm_test_asset_path(null, 'banner') is null and public.adm_test_asset_path('  ', 'banner') is null,
                     'rules: empty removes the image');
  perform pg_temp.ok(public.adm_test_asset_path('test-assets/' || p, 'banner') = p and public.adm_test_asset_path(p, 'banner') = p,
                     'rules: own path accepted; a leading test-assets/ is dropped');
  perform pg_temp.expect_error(format('select public.adm_test_asset_path(%L, %L)', e1 || '/banner/../x.webp', 'banner'), '22023');
  perform pg_temp.expect_error(format('select public.adm_test_asset_path(%L, %L)', e1 || '/../' || pg_temp.id('e2') || '/banner/x.webp', 'banner'), '22023');
  perform pg_temp.expect_error(format('select public.adm_test_asset_path(%L, %L)', 'data:image/png;base64,iVBOR', 'question_image'), '22023', 'never uploaded');
  perform pg_temp.expect_error(format('select public.adm_test_asset_path(%L, %L)', 'blob:http://x/1', 'question_image'), '22023', 'never uploaded');
  perform pg_temp.expect_error(format('select public.adm_test_asset_path(%L, %L)', p, 'question_image'), '22023');   -- wrong kind
  perform pg_temp.expect_error(format('select public.adm_test_asset_path(%L, %L)', replace(p, '.webp', '.gif'), 'banner'), '22023');
  perform pg_temp.expect_error(format('select public.adm_test_asset_path(%L, %L)', 'https://evil.example/x.webp', 'banner'), '22023');
  perform pg_temp.expect_error(format('select public.adm_test_asset_path(%L, %L)', '/' || p, 'banner'), '22023');
  perform pg_temp.expect_error(format('select public.adm_test_asset_path(%L, %L)', p, 'avatar'), '22023');
  perform pg_temp.ok(true, 'rules: "..", data: / blob: URLs, wrong kind or extension, URLs, leading slash, unknown kind refused');
  perform pg_temp.expect_error(format('select public.adm_test_asset_path(%L, %L)', pg_temp.asset(pg_temp.id('e2'), 'banner'), 'banner'), '42501', 'someone else');
  perform pg_temp.ok(true, 'rules: another uploader''s folder refused for an educator');
end $$;

do $$
declare other text := pg_temp.asset(pg_temp.id('e2'), 'banner');
begin
  perform pg_temp.act_as(pg_temp.id('e1'));
  perform pg_temp.ok(public.adm_test_asset_path(other, 'banner', array[other]) = other, 'rules: a path already on the row may be kept');
  perform pg_temp.act_as(pg_temp.id('admin'));
  perform pg_temp.ok(public.adm_test_asset_path(other, 'banner') = other, 'rules: an admin may set any uploader''s path');
end $$;

-- ------------------------------------------- wizard save (create + update)
do $$
declare
  cover text := pg_temp.asset(pg_temp.id('e1'), 'banner');
  img   text := pg_temp.asset(pg_temp.id('e1'), 'question_image');
  sid   uuid;
  v     jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('e1'));
  sid := pg_temp.remember('e1_series', public.upsert_test_series_full(pg_temp.payload(null, 'TA Geometry', 'test-assets/' || cover, img), false));
  perform pg_temp.keep('e1_cover', cover); perform pg_temp.keep('e1_img', img);
  v := public.get_test_series(sid);
  perform pg_temp.ok(v ->> 'cover_path' = cover, 'wizard: banner path stored bucket-relative and returned by get_test_series');
  perform pg_temp.ok(v #>> '{tests,0,questions,0,image_path}' = img and v #>> '{tests,0,questions,0,image_alt}' = 'A labelled triangle'
                     and v #> '{tests,0,questions,1,image_path}' = 'null'::jsonb,
                     'wizard: question figure and alt text stored; no figure stays null');
  perform pg_temp.ok((select r.row_data ->> 'cover_path' from public.list_test_series(p_size => 100) r where (r.row_data ->> 'id')::uuid = sid) = cover,
                     'list: rows carry cover_path');

  -- re-save of the same series keeps the same paths
  perform public.upsert_test_series_full(pg_temp.payload(sid, 'TA Geometry', cover, img, 'Triangle ABC'), false);
  v := public.get_test_series(sid);
  perform pg_temp.ok(v ->> 'cover_path' = cover and v #>> '{tests,0,questions,0,image_path}' = img
                     and v #>> '{tests,0,questions,0,image_alt}' = 'Triangle ABC', 'wizard: re-save keeps the paths, alt text updated');
  perform pg_temp.remember('e1_q1', (v #>> '{tests,0,questions,0,id}')::uuid);
end $$;

do $$
declare sid uuid := pg_temp.id('e1_series'); v jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('e1'));
  perform pg_temp.expect_error(format('select public.upsert_test_series_full(%L::jsonb, false)',
    pg_temp.payload(sid, 'TA Geometry', pg_temp.txt('e1_cover'), pg_temp.asset(pg_temp.id('e2'), 'question_image'))), '42501');
  perform pg_temp.expect_error(format('select public.upsert_test_series_full(%L::jsonb, false)',
    pg_temp.payload(sid, 'TA Geometry', pg_temp.asset(pg_temp.id('e2'), 'banner'), pg_temp.txt('e1_img'))), '42501');
  perform pg_temp.expect_error(format('select public.upsert_test_series_full(%L::jsonb, false)',
    pg_temp.payload(sid, 'TA Geometry', pg_temp.txt('e1_cover'), 'data:image/png;base64,AAAA')), '22023', 'never uploaded');
  perform pg_temp.ok((select cover_path from public.test_series_admin where series_id = sid) = pg_temp.txt('e1_cover'),
                     'wizard: someone else''s or a never-uploaded image is refused; nothing changed');

  -- remove both: the paths are cleared
  perform public.upsert_test_series_full(pg_temp.payload(sid, 'TA Geometry', null, ''), false);
  v := public.get_test_series(sid);
  perform pg_temp.ok(v -> 'cover_path' = 'null'::jsonb and v #> '{tests,0,questions,0,image_path}' = 'null'::jsonb,
                     'wizard: removing the banner and the figure clears the paths');
  perform public.upsert_test_series_full(pg_temp.payload(sid, 'TA Geometry', pg_temp.txt('e1_cover'), pg_temp.txt('e1_img')), false);
  perform pg_temp.remember('e1_q1', ((public.get_test_series(sid)) #>> '{tests,0,questions,0,id}')::uuid);
end $$;

-- -------------------------------------- series settings and question editor
do $$
declare
  sid  uuid := pg_temp.id('e1_series');
  qid  uuid := pg_temp.id('e1_q1');
  img2 text := pg_temp.asset(pg_temp.id('e1'), 'question_image');
  ban2 text := pg_temp.asset(pg_temp.id('e1'), 'banner');
  adm_img text := pg_temp.asset(pg_temp.id('admin'), 'question_image');
  v    jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('e1'));
  v := public.update_test_series(sid, jsonb_build_object('coverPath', ban2));
  perform pg_temp.ok(v ->> 'cover_path' = ban2, 'settings: banner replaced');
  v := public.update_test_series(sid, jsonb_build_object('description', 'No banner change'));
  perform pg_temp.ok(v ->> 'cover_path' = ban2, 'settings: a save without coverPath keeps the banner');
  v := public.update_test_series(sid, jsonb_build_object('coverPath', ''));
  perform pg_temp.ok(v -> 'cover_path' = 'null'::jsonb, 'settings: banner removed');
  perform pg_temp.expect_error(format('select public.update_test_series(%L, %L::jsonb)', sid,
    jsonb_build_object('coverPath', pg_temp.asset(pg_temp.id('e2'), 'banner'))), '42501');
  perform public.update_test_series(sid, jsonb_build_object('coverPath', pg_temp.txt('e1_cover')));

  v := public.update_question(qid, jsonb_build_object('image', img2, 'imageAlt', '  Graph of y = x  '));
  perform pg_temp.ok(v ->> 'image_path' = img2 and v ->> 'image_alt' = 'Graph of y = x', 'editor: figure replaced, alt text trimmed');
  v := public.update_question(qid, jsonb_build_object('marks', '5'));
  perform pg_temp.ok(v ->> 'image_path' = img2, 'editor: a save without image keeps the figure');
  v := public.update_question(qid, jsonb_build_object('image', '', 'imageAlt', ''));
  perform pg_temp.ok(v -> 'image_path' = 'null'::jsonb and v -> 'image_alt' = 'null'::jsonb, 'editor: figure removed');
  perform pg_temp.expect_error(format('select public.update_question(%L, %L::jsonb)', qid,
    jsonb_build_object('image', pg_temp.asset(pg_temp.id('e2'), 'question_image'))), '42501');

  -- an admin sets their own figure on the educator's question; the educator keeps it on a later edit
  perform pg_temp.act_as(pg_temp.id('admin'));
  perform public.update_question(qid, jsonb_build_object('image', adm_img));
  perform pg_temp.act_as(pg_temp.id('e1'));
  v := public.update_question(qid, jsonb_build_object('image', adm_img, 'text', 'Which angle is the largest?'));
  perform pg_temp.ok(v ->> 'image_path' = adm_img, 'editor: an educator keeps an image an admin put on the question');

  v := public.create_question(((public.get_test_series(sid)) #>> '{tests,0,id}')::uuid,
         jsonb_build_object('type', 'mcq_single', 'text', 'New one?', 'marks', '2', 'image', img2, 'imageAlt', 'Fig 2',
           'options', jsonb_build_array(jsonb_build_object('key', 'A', 'text', 'x'), jsonb_build_object('key', 'B', 'text', 'y')),
           'correctAnswers', jsonb_build_array('A')));
  perform pg_temp.ok(v ->> 'image_path' = img2 and v ->> 'image_alt' = 'Fig 2', 'editor: create_question stores the figure and alt text');
end $$;

-- ------------------------------------------------------------ duplication
do $$
declare
  sid  uuid := pg_temp.id('e1_series');
  dup  uuid;
  v    jsonb;
  src  jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('e1'));
  perform public.update_question(pg_temp.id('e1_q1'), jsonb_build_object('image', pg_temp.txt('e1_img'), 'imageAlt', 'Original alt'));
  src := public.get_test_series(sid);
  dup := public.duplicate_test_series(sid);
  v := public.get_test_series(dup);
  perform pg_temp.ok(v ->> 'cover_path' = pg_temp.txt('e1_cover'), 'duplicate series: the copy keeps the banner path');
  perform pg_temp.ok(v #>> '{tests,0,questions,0,image_path}' = pg_temp.txt('e1_img')
                     and v #>> '{tests,0,questions,0,image_alt}' = 'Original alt', 'duplicate series: questions keep figure and alt text');
  v := public.duplicate_test((src #>> '{tests,0,id}')::uuid);
  perform pg_temp.ok(v #>> '{questions,0,image_path}' = pg_temp.txt('e1_img'), 'duplicate test: questions keep the figure');

  -- an admin duplicates the educator's series: kept although the folder is e1's
  perform pg_temp.act_as(pg_temp.id('admin'));
  dup := public.duplicate_test_series(sid);
  perform pg_temp.ok((public.get_test_series(dup)) ->> 'cover_path' = pg_temp.txt('e1_cover'), 'duplicate by an admin keeps the paths');
end $$;

-- ---------------------------------------------- student intro, runner, report
do $$
declare
  cover text := pg_temp.asset(pg_temp.id('admin'), 'banner');
  img   text := pg_temp.asset(pg_temp.id('admin'), 'question_image');
  sid   uuid;
  tid   uuid;
  v     jsonb;
  q     jsonb;
  att   uuid;
begin
  perform pg_temp.act_as(pg_temp.id('admin'));
  sid := public.upsert_test_series_full(pg_temp.payload(null, 'TA Live Series', cover, img, 'Figure for Q1'), true);
  tid := ((public.get_test_series(sid)) #>> '{tests,0,id}')::uuid;
  perform pg_temp.keep('live_cover', cover); perform pg_temp.keep('live_img', img);

  perform pg_temp.act_as(pg_temp.id('stu'));
  perform pg_temp.ok(public.student_get_series(sid) ->> 'cover_path' = cover, 'student: series detail carries cover_path');
  perform public.student_enroll(sid);
  v := public.student_get_test_intro(tid);
  perform pg_temp.ok(v ->> 'series_cover_path' = cover, 'student intro: series_cover_path');
  v := public.student_start_attempt(tid);
  att := (v ->> 'attempt_id')::uuid;
  perform pg_temp.ok(v ->> 'series_cover_path' = cover, 'student runner: series_cover_path');
  select x into q from jsonb_array_elements(v -> 'questions') x where x ->> 'text' = 'Which angle is largest?';
  perform pg_temp.ok(q ->> 'image_path' = img and q ->> 'image_alt' = 'Figure for Q1', 'student runner: question image_path and image_alt');
  perform pg_temp.ok(not exists (select 1 from jsonb_array_elements(v -> 'questions') x, jsonb_array_elements(x -> 'options') o
                                  where o ? 'is_correct')
                     and position('is_correct' in (v -> 'questions')::text) = 0
                     and position('correct_answer' in (v -> 'questions')::text) = 0,
                     'student runner: still no answers in the questions');

  v := public.student_submit_attempt(att);
  select x into q from jsonb_array_elements(v -> 'questions') x where x ->> 'text' = 'Which angle is largest?';
  perform pg_temp.ok(q ->> 'image_path' = img and q ->> 'image_alt' = 'Figure for Q1' and v ->> 'series_cover_path' = cover,
                     'student report (submit): figure, alt text and banner');
  v := public.student_get_report(att);
  select x into q from jsonb_array_elements(v -> 'questions') x where x ->> 'text' = 'Which angle is largest?';
  perform pg_temp.ok(q ->> 'image_path' = img and v ->> 'series_cover_path' = cover, 'student report (stored): figure and banner');
  perform pg_temp.ok(not (public.student_get_report(att) ? 'is_correct'), 'student report: nothing else added');
  perform pg_temp.remember('live_att', att);
end $$;

-- the stored report itself is unchanged (enriched only when read)
do $$
begin
  perform pg_temp.ok(not exists (select 1 from public.attempt_reports r, jsonb_array_elements(r.report -> 'questions') x
                                  where r.attempt_id = pg_temp.id('live_att') and x ? 'image_path'),
                     'report: stored snapshot not rewritten');
end $$;

-- -------------------------------------------------- upload slot (Edge Function)
do $$
declare v jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('e1'));
  v := public.adm_claim_asset_upload_slot('banner', 2);
  perform pg_temp.ok((v ->> 'allowed')::boolean and v ->> 'actor' = 'educator' and (v ->> 'remaining')::int = 1, 'slot: verified educator allowed');
  perform public.adm_claim_asset_upload_slot('question_image', 2);
  v := public.adm_claim_asset_upload_slot('banner', 2);
  perform pg_temp.ok(not (v ->> 'allowed')::boolean and (v ->> 'retry_after_seconds')::int > 0, 'slot: limit per rolling hour');
  perform pg_temp.expect_error('select public.adm_claim_asset_upload_slot(''avatar'')', '22023');
  perform pg_temp.act_as(pg_temp.id('admin'));
  perform pg_temp.ok(public.adm_claim_asset_upload_slot('banner') ->> 'actor' = 'admin', 'slot: admin allowed');
  perform pg_temp.act_as(pg_temp.id('stu'));
  perform pg_temp.expect_error('select public.adm_claim_asset_upload_slot(''banner'')', '42501');
  perform set_config('request.jwt.claims', '', true);
  perform pg_temp.expect_error('select public.adm_claim_asset_upload_slot(''banner'')', '42501');
  perform pg_temp.ok(true, 'slot: students and signed-out callers refused');

  perform pg_temp.ok(has_function_privilege('authenticated', 'public.adm_claim_asset_upload_slot(text,integer)', 'execute')
                     and not has_function_privilege('anon', 'public.adm_claim_asset_upload_slot(text,integer)', 'execute')
                     and not has_function_privilege('authenticated', 'public.adm_test_asset_path(text,text,text[])', 'execute')
                     and not has_function_privilege('authenticated', 'public.adm_report_with_images(jsonb,uuid)', 'execute'),
                     'grants: only the slot claim is callable, by authenticated');
end $$;

do $$ begin raise notice 'ok: all test asset checks passed'; end $$;
rollback;
