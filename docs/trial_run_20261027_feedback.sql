-- Trial for the FEEDBACK migrations only (20261027100000 .. 100300).
-- Needs the admin, allowlist and student migrations applied. Paste all of it into
-- the SQL editor and run: expect "Success. No rows returned". Everything is rolled back.
begin;

-- >>> 20261027100000_feedback_preflight.sql <<<
-- =====================================================================
-- 20261027100000_feedback_preflight.sql
--
-- Purpose
--   Read-only preflight for test feedback / moderation (20261027100100 ..
--   100300). Collects every problem, then raises once:
--     1. lead and port columns the feedback RPCs read or write;
--     2. helpers they call (Batch 1 + student port);
--     3. clashes: table test_feedback and every new function name (any overload).
--   The optional student notification needs notifications.category to allow
--   'support_ticket'; when it doesn't, the RPC simply skips the notification
--   (a NOTICE says so here), it is not an error.
--
-- ROLLBACK
--   Nothing to roll back: no DDL, no data changes.
-- =====================================================================
set search_path = public, extensions;

do $pre$
declare
  v_problems text[] := '{}';
  v_list     text[];
  v_def      text;
begin
  select coalesce(array_agg(t.tbl || '.' || t.col order by t.tbl, t.col), '{}') into v_list
    from (values
      ('profiles', 'id'), ('profiles', 'full_name'), ('profiles', 'email'), ('profiles', 'role'),
      ('test_series', 'id'), ('test_series', 'title'),
      ('quizzes', 'id'), ('quizzes', 'series_id'), ('quizzes', 'title'),
      ('quiz_questions', 'id'), ('quiz_questions', 'quiz_id'), ('quiz_questions', 'question_text'),
      ('quiz_attempts', 'id'), ('quiz_attempts', 'quiz_id'), ('quiz_attempts', 'student_id'),
      ('quiz_attempts', 'status'), ('quiz_attempts', 'score'), ('quiz_attempts', 'max_score'),
      ('quiz_attempts', 'percentage'), ('quiz_attempts', 'submitted_at'), ('quiz_attempts', 'attempt_number'),
      ('notifications', 'user_id'), ('notifications', 'category'), ('notifications', 'title'),
      ('notifications', 'body'), ('notifications', 'action_url'), ('notifications', 'reference_type'),
      ('notifications', 'reference_id'),
      ('audit_logs', 'actor_id'), ('audit_logs', 'action'), ('audit_logs', 'target_type'),
      ('audit_logs', 'target_id'), ('audit_logs', 'before_state'), ('audit_logs', 'after_state'),
      ('audit_logs', 'reason'), ('audit_logs', 'created_at')
    ) as t(tbl, col)
   where not exists (select 1 from information_schema.columns c
                      where c.table_schema = 'public' and c.table_name = t.tbl and c.column_name = t.col);
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('missing columns: ' || array_to_string(v_list, ', '));
  end if;

  select coalesce(array_agg(x.sig order by x.sig), '{}') into v_list
    from unnest(array['public.adm_require_admin()', 'public.adm_audit(text,text,uuid,jsonb,jsonb,text)',
                      'public.adm_like(text)', 'public.adm_student_uid()', 'public.adm_student_writer_uid()',
                      'public.adm_question_json(uuid)']) as x(sig)
   where to_regprocedure(x.sig) is null;
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('missing functions (admin or student port not applied?): ' || array_to_string(v_list, ', '));
  end if;

  if to_regclass('public.test_feedback') is not null then
    v_problems := v_problems || 'relation public.test_feedback already exists'::text;
  end if;
  select coalesce(array_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' order by p.proname), '{}')
    into v_list
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('student_submit_feedback', 'student_my_feedback', 'list_moderation_items', 'get_moderation_stats',
                       'get_moderation_item', 'set_moderation_status', 'get_moderation_filter_options',
                       'adm_feedback_row');
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('functions already exist: ' || array_to_string(v_list, ', '));
  end if;

  if cardinality(v_problems) > 0 then
    raise exception 'Feedback preflight: %', array_to_string(v_problems, '; ');
  end if;

  select string_agg(pg_get_constraintdef(co.oid), ' ') into v_def
    from pg_constraint co
   where co.conrelid = to_regclass('public.notifications') and co.contype = 'c'
     and pg_get_constraintdef(co.oid) ilike '%category%';
  if v_def is not null and position('''support_ticket''' in v_def) = 0 then
    raise notice 'Feedback preflight: notifications.category does not allow support_ticket; resolved feedback will not notify the student.';
  end if;
end $pre$;


-- >>> 20261027100100_feedback_tables.sql <<<
-- =====================================================================
-- 20261027100100_feedback_tables.sql
--
-- Purpose
--   test_feedback: feedback, queries and issue reports a student sends about
--   a submitted attempt. Reachable only through RPCs (RLS on, no policies, no
--   grants to anon / authenticated).
--
-- Lead tables referenced (FK targets only; nothing on them is altered)
--   profiles (student_id CASCADE, reviewed_by SET NULL), test_series (CASCADE),
--   quizzes (SET NULL), quiz_attempts (SET NULL), quiz_questions (SET NULL).
--   Every FK column is indexed.
--
-- ROLLBACK
--   drop table if exists public.test_feedback;   -- drops its indexes too
-- =====================================================================
set search_path = public, extensions;

create table if not exists public.test_feedback (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles (id) on delete cascade,
  series_id    uuid not null references public.test_series (id) on delete cascade,
  test_id      uuid references public.quizzes (id) on delete set null,
  attempt_id   uuid references public.quiz_attempts (id) on delete set null,
  kind         text not null check (kind in ('feedback', 'query', 'issue')),
  rating       int check (rating between 1 and 5),
  category     text check (category in ('wrong_answer', 'unclear_question', 'technical_problem', 'other')),
  question_id  uuid references public.quiz_questions (id) on delete set null,
  message      text not null check (char_length(message) between 5 and 2000),
  status       text not null default 'new' check (status in ('new', 'in_review', 'resolved', 'dismissed')),
  admin_note   text check (admin_note is null or char_length(admin_note) <= 2000),
  reviewed_by  uuid references public.profiles (id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint test_feedback_rating_required check (kind <> 'feedback' or rating is not null)
);
comment on table public.test_feedback is
  'Student feedback / queries / issue reports on submitted attempts (admin port). RPC access only.';

-- FK indexes (+ the daily limit lookup and the moderation list order).
create index if not exists test_feedback_student_series_idx on public.test_feedback (student_id, series_id, created_at desc);
create index if not exists test_feedback_series_idx        on public.test_feedback (series_id);
create index if not exists test_feedback_test_idx          on public.test_feedback (test_id) where test_id is not null;
create index if not exists test_feedback_attempt_idx       on public.test_feedback (attempt_id) where attempt_id is not null;
create index if not exists test_feedback_question_idx      on public.test_feedback (question_id) where question_id is not null;
create index if not exists test_feedback_reviewed_by_idx   on public.test_feedback (reviewed_by) where reviewed_by is not null;
create index if not exists test_feedback_status_idx        on public.test_feedback (status, created_at desc);

alter table public.test_feedback enable row level security;
revoke all on table public.test_feedback from anon, authenticated;


-- >>> 20261027100200_feedback_rpc_student.sql <<<
-- =====================================================================
-- 20261027100200_feedback_rpc_student.sql
--
-- Purpose
--   Student side of test feedback:
--     student_submit_feedback(uuid, text, int, text, uuid, text) -> uuid (new id)
--     student_my_feedback(uuid default null) -> jsonb array (caller's own items)
--
-- Rules (student_submit_feedback)
--   * The student is auth.uid() (adm_student_writer_uid: signed in, has a
--     profile, not blocked). The attempt must be the caller's and finished
--     (submitted / timed_out); the series and test come from the attempt.
--   * kind: feedback | query | issue. rating 1..5 is required for feedback and
--     ignored for the others. category (optional): wrong_answer,
--     unclear_question, technical_problem, other. question_id (optional) must
--     belong to the attempt's test. message: trimmed, 5..2000 characters.
--   * At most 5 submissions per student per series per calendar day
--     (Asia/Kolkata), serialized per student + series.
--   Errors: 42501 not signed in / blocked, P0002 attempt not found (or not
--   yours), P0001 attempt not finished / daily limit, 22023 bad input.
--
-- ROLLBACK
--   drop function if exists public.student_my_feedback(uuid);
--   drop function if exists public.student_submit_feedback(uuid, text, int, text, uuid, text);
-- =====================================================================
set search_path = public, extensions;

create or replace function public.student_submit_feedback(
  p_attempt_id  uuid,
  p_kind        text,
  p_rating      int default null,
  p_category    text default null,
  p_question_id uuid default null,
  p_message     text default null
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid      uuid := public.adm_student_writer_uid();
  v_kind     text := lower(btrim(coalesce(p_kind, '')));
  v_category text := nullif(lower(btrim(coalesce(p_category, ''))), '');
  v_message  text := btrim(coalesce(p_message, ''));
  v_att      record;
  v_day      timestamptz := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  v_count    int;
  v_id       uuid;
begin
  select a.id, a.student_id, a.status, a.quiz_id, q.series_id
    into v_att
    from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
   where a.id = p_attempt_id;
  if v_att.id is null or v_att.student_id <> v_uid or v_att.series_id is null then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;
  if v_att.status not in ('submitted', 'timed_out') then
    raise exception 'Submit the test before sending feedback.' using errcode = 'P0001';
  end if;

  if v_kind not in ('feedback', 'query', 'issue') then
    raise exception 'Choose feedback, a query or an issue.' using errcode = '22023';
  end if;
  if v_kind = 'feedback' and (p_rating is null or p_rating not between 1 and 5) then
    raise exception 'Give a rating from 1 to 5 stars.' using errcode = '22023';
  end if;
  if v_category is not null and v_category not in ('wrong_answer', 'unclear_question', 'technical_problem', 'other') then
    raise exception 'Unknown category: %', left(p_category, 40) using errcode = '22023';
  end if;
  if p_question_id is not null
     and not exists (select 1 from public.quiz_questions where id = p_question_id and quiz_id = v_att.quiz_id) then
    raise exception 'That question is not part of this test.' using errcode = '22023';
  end if;
  if char_length(v_message) < 5 then
    raise exception 'Write at least 5 characters.' using errcode = '22023';
  end if;
  if char_length(v_message) > 2000 then
    raise exception 'Keep the message under 2000 characters.' using errcode = '22023';
  end if;

  -- 5 per student per series per day; concurrent submits wait for each other.
  perform pg_advisory_xact_lock(hashtextextended('test_feedback:' || v_uid::text || ':' || v_att.series_id::text, 0));
  select count(*) into v_count
    from public.test_feedback
   where student_id = v_uid and series_id = v_att.series_id and created_at >= v_day;
  if v_count >= 5 then
    raise exception 'You can send up to 5 messages per test series each day. Try again tomorrow.' using errcode = 'P0001';
  end if;

  insert into public.test_feedback (student_id, series_id, test_id, attempt_id, kind, rating, category, question_id, message)
  values (v_uid, v_att.series_id, v_att.quiz_id, v_att.id, v_kind,
          case when v_kind = 'feedback' then p_rating end, v_category, p_question_id, v_message)
  returning id into v_id;
  return v_id;
end $$;

-- The caller's own items, newest first (at most 100). p_series_id null = all series.
create or replace function public.student_my_feedback(p_series_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := public.adm_student_uid();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', f.id, 'kind', f.kind, 'rating', f.rating, 'category', f.category,
             'message', f.message, 'status', f.status, 'admin_note', f.admin_note,
             'series_id', f.series_id, 'series_title', s.title,
             'test_id', f.test_id, 'test_title', q.title, 'attempt_id', f.attempt_id,
             'question_id', f.question_id,
             'question_position', (select o.n from (select qq.id, row_number() over (order by qq.sort_order, qq.created_at, qq.id) as n
                                                      from public.quiz_questions qq where qq.quiz_id = f.test_id) o
                                    where o.id = f.question_id),
             'created_at', f.created_at, 'reviewed_at', f.reviewed_at)
           order by f.created_at desc, f.id)
      from (select * from public.test_feedback
             where student_id = v_uid and (p_series_id is null or series_id = p_series_id)
             order by created_at desc, id limit 100) f
      left join public.test_series s on s.id = f.series_id
      left join public.quizzes q on q.id = f.test_id), '[]'::jsonb);
end $$;

revoke all on function public.student_submit_feedback(uuid, text, int, text, uuid, text) from public, anon;
grant execute on function public.student_submit_feedback(uuid, text, int, text, uuid, text) to authenticated;
revoke all on function public.student_my_feedback(uuid) from public, anon;
grant execute on function public.student_my_feedback(uuid) to authenticated;


-- >>> 20261027100300_feedback_rpc_admin.sql <<<
-- =====================================================================
-- 20261027100300_feedback_rpc_admin.sql
--
-- Purpose
--   Admin moderation of test feedback (Content Moderation page). Every RPC
--   checks adm_require_admin() (adm_is_platform_admin) first.
--     list_moderation_items(text, text, text, uuid, int, int) -> table(row_data jsonb, total_count bigint)
--     get_moderation_stats() -> jsonb {new, in_review, resolved, dismissed, total, avg_rating, by_kind}
--     get_moderation_item(uuid) -> jsonb (row + question, attempt, history)
--     set_moderation_status(uuid, text, text) -> jsonb (updated row)
--     get_moderation_filter_options() -> jsonb {kinds, statuses, categories, series}
--   Internal: adm_feedback_row(uuid) -> jsonb (the list / detail row shape).
--
--   p_status filters accept a status, 'open' (new + in_review), 'closed'
--   (resolved + dismissed), or null / '' / 'all'.
--   set_moderation_status: in_review | resolved | dismissed (never back to
--   'new'); resolved / dismissed need a note (shown to the student). Writes
--   audit_logs through adm_audit (actor_id, actor_role, action
--   'moderation.status', target_type 'test_feedback', target_id, before_state,
--   after_state, reason = the note). On 'resolved' it notifies the student in
--   the lead's notifications (category 'support_ticket', reference_type
--   'test_feedback'); if the lead's CHECK refuses that, the notification is
--   skipped and the status change still succeeds.
--
-- Lead objects written
--   audit_logs (insert via adm_audit), notifications (insert, resolved only).
--
-- ROLLBACK
--   drop function if exists public.get_moderation_filter_options();
--   drop function if exists public.set_moderation_status(uuid, text, text);
--   drop function if exists public.get_moderation_item(uuid);
--   drop function if exists public.get_moderation_stats();
--   drop function if exists public.list_moderation_items(text, text, text, uuid, int, int);
--   drop function if exists public.adm_feedback_row(uuid);
--   delete from public.notifications where reference_type = 'test_feedback';   -- data in a lead table: confirm with the lead
-- =====================================================================
set search_path = public, extensions;

create or replace function public.adm_feedback_row(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
           'id', f.id, 'kind', f.kind, 'rating', f.rating, 'category', f.category,
           'message', f.message, 'status', f.status, 'admin_note', f.admin_note,
           'created_at', f.created_at, 'updated_at', f.updated_at, 'reviewed_at', f.reviewed_at,
           'student_id', f.student_id, 'student_name', st.full_name, 'student_email', st.email,
           'series_id', f.series_id, 'series_title', s.title,
           'test_id', f.test_id, 'test_title', q.title,
           'attempt_id', f.attempt_id, 'question_id', f.question_id,
           'reviewed_by', f.reviewed_by, 'reviewed_by_name', rb.full_name)
    from public.test_feedback f
    left join public.profiles st on st.id = f.student_id
    left join public.profiles rb on rb.id = f.reviewed_by
    left join public.test_series s on s.id = f.series_id
    left join public.quizzes q on q.id = f.test_id
   where f.id = p_id;
$$;

create or replace function public.list_moderation_items(
  p_search text default null, p_kind text default null, p_status text default null,
  p_series uuid default null, p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 10), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
  v_stat text := nullif(lower(btrim(coalesce(p_status, ''))), '');
  v_kind text := nullif(lower(btrim(coalesce(p_kind, ''))), '');
begin
  perform public.adm_require_admin();
  return query
  with f as (
    select t.id, t.created_at
      from public.test_feedback t
      left join public.profiles st on st.id = t.student_id
      left join public.test_series s on s.id = t.series_id
      left join public.quizzes q on q.id = t.test_id
     where (v_like is null or t.message ilike v_like or st.full_name ilike v_like or st.email ilike v_like
            or s.title ilike v_like or q.title ilike v_like)
       and (v_kind is null or v_kind = 'all' or t.kind = v_kind)
       and (v_stat is null or v_stat = 'all'
            or (v_stat = 'open' and t.status in ('new', 'in_review'))
            or (v_stat = 'closed' and t.status in ('resolved', 'dismissed'))
            or t.status = v_stat)
       and (p_series is null or t.series_id = p_series)
  )
  select public.adm_feedback_row(f.id), count(*) over ()
    from f
   order by f.created_at desc, f.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

create or replace function public.get_moderation_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    select jsonb_build_object(
             'new', count(*) filter (where status = 'new'),
             'in_review', count(*) filter (where status = 'in_review'),
             'resolved', count(*) filter (where status = 'resolved'),
             'dismissed', count(*) filter (where status = 'dismissed'),
             'total', count(*),
             'avg_rating', round(avg(rating) filter (where kind = 'feedback'), 2),
             'by_kind', jsonb_build_object(
               'feedback', count(*) filter (where kind = 'feedback'),
               'query', count(*) filter (where kind = 'query'),
               'issue', count(*) filter (where kind = 'issue')))
      from public.test_feedback);
end $$;

create or replace function public.get_moderation_item(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_row jsonb;
  v_f   public.test_feedback;
begin
  perform public.adm_require_admin();
  select * into v_f from public.test_feedback where id = p_id;
  if v_f.id is null then
    raise exception 'Item not found.' using errcode = 'P0002';
  end if;
  v_row := public.adm_feedback_row(p_id);
  return v_row || jsonb_build_object(
    'question', (select jsonb_build_object('id', qq.id, 'text', qq.question_text, 'type', qq.question_type,
                                           'position', (select count(*) from public.quiz_questions x
                                                         where x.quiz_id = qq.quiz_id
                                                           and (x.sort_order, x.created_at, x.id) <= (qq.sort_order, qq.created_at, qq.id)))
                   from public.quiz_questions qq where qq.id = v_f.question_id),
    'attempt', (select jsonb_build_object('id', a.id, 'attempt_number', a.attempt_number, 'status', a.status,
                                          'score', a.score, 'max_score', a.max_score, 'percentage', a.percentage,
                                          'submitted_at', a.submitted_at)
                  from public.quiz_attempts a where a.id = v_f.attempt_id),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('action', l.action, 'actor_name', p.full_name, 'actor_role', l.actor_role,
                                          'before', l.before_state ->> 'status', 'after', l.after_state ->> 'status',
                                          'note', l.reason, 'at', l.created_at)
                       order by l.created_at)
        from public.audit_logs l left join public.profiles p on p.id = l.actor_id
       where l.target_type = 'test_feedback' and l.target_id = p_id), '[]'::jsonb));
end $$;

create or replace function public.set_moderation_status(p_id uuid, p_status text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_note   text := nullif(btrim(coalesce(p_note, '')), '');
  v_before jsonb;
  v_f      public.test_feedback;
begin
  perform public.adm_require_admin();
  if v_status not in ('in_review', 'resolved', 'dismissed') then
    raise exception 'Choose in review, resolved or dismissed.' using errcode = '22023';
  end if;
  if v_status in ('resolved', 'dismissed') and v_note is null then
    raise exception 'Add a note for the student when you resolve or dismiss.' using errcode = '22023';
  end if;
  if char_length(coalesce(v_note, '')) > 2000 then
    raise exception 'Keep the note under 2000 characters.' using errcode = '22023';
  end if;

  select * into v_f from public.test_feedback where id = p_id for update;
  if v_f.id is null then
    raise exception 'Item not found.' using errcode = 'P0002';
  end if;
  v_before := jsonb_build_object('status', v_f.status, 'admin_note', v_f.admin_note);

  update public.test_feedback
     set status = v_status,
         admin_note = coalesce(v_note, admin_note),
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         updated_at = now()
   where id = p_id;

  perform public.adm_audit('moderation.status', 'test_feedback', p_id, v_before,
                           jsonb_build_object('status', v_status, 'admin_note', coalesce(v_note, v_f.admin_note)), v_note);

  -- Tell the student when it is resolved (only if the lead's category CHECK allows it).
  if v_status = 'resolved' and v_f.status <> 'resolved' then
    begin
      insert into public.notifications (user_id, category, title, body, action_url, reference_type, reference_id)
      values (v_f.student_id, 'support_ticket',
              case v_f.kind when 'issue' then 'Your reported issue was resolved'
                            when 'query' then 'Your question was answered'
                            else 'Thanks for your feedback' end,
              left(v_note, 500),
              '/student/test-series/' || v_f.series_id::text,
              'test_feedback', p_id);
    exception when check_violation then
      null;   -- category not allowed by the lead's CHECK: skip the notification
    end;
  end if;

  return public.adm_feedback_row(p_id);
end $$;

create or replace function public.get_moderation_filter_options() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return jsonb_build_object(
    'kinds', '[{"value":"feedback","label":"Feedback"},{"value":"query","label":"Query"},{"value":"issue","label":"Issue"}]'::jsonb,
    'statuses', '[{"value":"new","label":"New"},{"value":"in_review","label":"In review"},{"value":"resolved","label":"Resolved"},{"value":"dismissed","label":"Dismissed"}]'::jsonb,
    'categories', '[{"value":"wrong_answer","label":"Wrong answer"},{"value":"unclear_question","label":"Unclear question"},{"value":"technical_problem","label":"Technical problem"},{"value":"other","label":"Other"}]'::jsonb,
    'series', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title) order by s.title)
                          from public.test_series s
                         where exists (select 1 from public.test_feedback f where f.series_id = s.id)), '[]'::jsonb));
end $$;

revoke all on function public.adm_feedback_row(uuid) from public, anon, authenticated;
revoke all on function public.list_moderation_items(text, text, text, uuid, int, int) from public, anon;
grant execute on function public.list_moderation_items(text, text, text, uuid, int, int) to authenticated;
revoke all on function public.get_moderation_stats() from public, anon;
grant execute on function public.get_moderation_stats() to authenticated;
revoke all on function public.get_moderation_item(uuid) from public, anon;
grant execute on function public.get_moderation_item(uuid) to authenticated;
revoke all on function public.set_moderation_status(uuid, text, text) from public, anon;
grant execute on function public.set_moderation_status(uuid, text, text) to authenticated;
revoke all on function public.get_moderation_filter_options() from public, anon;
grant execute on function public.get_moderation_filter_options() to authenticated;

rollback;
