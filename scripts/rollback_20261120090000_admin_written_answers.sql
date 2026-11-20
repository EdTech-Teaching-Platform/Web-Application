-- =====================================================================
-- rollback_20261120090000_admin_written_answers.sql
-- Undoes supabase/migrations/20261120090000_admin_written_answers.sql: drops
-- the trigger, the upload / marking functions and tables, and restores
-- adm_series_content_problem. Run only with "approved:"; take a backup first.
-- NOT undone: published marks already written into quiz_answers,
-- quiz_attempts and attempt_reports stay; the private bucket answer-uploads
-- and its files stay (Supabase doesn't allow deleting storage rows from SQL:
-- empty and delete the bucket in the dashboard if wanted).
-- =====================================================================
set search_path = public, extensions;
begin;

drop trigger if exists attempt_reports_written_answers on public.attempt_reports;
drop function if exists public.grading_save(uuid, jsonb, text, boolean);
drop function if exists public.grading_get_attempt(uuid);
drop function if exists public.grading_list_attempts(text, text, uuid, int, int);
drop function if exists public.adm_answer_upload_access(uuid);
drop function if exists public.adm_grading_candidate(uuid, uuid);
drop function if exists public.adm_require_attempt_grader(uuid);
drop function if exists public.student_list_answer_uploads(uuid);
drop function if exists public.student_remove_answer_upload(uuid);
drop function if exists public.student_register_answer_upload(uuid, uuid, text, text, text, bigint);
drop function if exists public.student_answer_upload_slot(uuid, uuid, text, bigint);
drop function if exists public.adm_answer_upload_json(uuid);
drop function if exists public.adm_written_report_trigger();
drop function if exists public.adm_written_sync_report(uuid);
drop function if exists public.adm_written_sync_rows(uuid, jsonb);
drop function if exists public.adm_written_recompute(uuid, jsonb, jsonb);
drop function if exists public.adm_answer_upload_problem(uuid, uuid, uuid);
drop function if exists public.adm_written_question(uuid, uuid);
drop function if exists public.adm_answer_upload_window(uuid);
drop function if exists public.adm_answer_upload_grace();
drop table if exists public.written_evaluations;
drop table if exists public.written_answer_grades;
drop table if exists public.answer_upload_requests;
drop table if exists public.answer_uploads;

-- adm_series_content_problem: verbatim from 20261028100300_educator_series_approval.sql
create or replace function public.adm_series_content_problem(p_series uuid) returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  s     public.test_series;
  v_msg text;
begin
  select * into s from public.test_series where id = p_series;
  if s.available_from is not null and s.available_until is not null and s.available_until <= s.available_from then
    return 'The closing time must be after the opening time.';
  end if;
  v_msg := public.adm_series_publish_problem(p_series);
  if v_msg is not null then return v_msg; end if;
  if not exists (select 1 from public.quizzes where series_id = p_series) then
    return 'Add at least one test before publishing.';
  end if;
  select format('"%s" has a short answer, long answer or subjective question. They are coming soon; remove it first.', q.title)
    into v_msg
    from public.quizzes q join public.quiz_questions qq on qq.quiz_id = q.id
   where q.series_id = p_series and public.adm_question_is_subjective(qq.id)
   order by q.series_sort_order, q.created_at
   limit 1;
  return v_msg;
end $$;
revoke all on function public.adm_series_content_problem(uuid) from public, anon, authenticated;

commit;
