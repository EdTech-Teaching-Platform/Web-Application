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
