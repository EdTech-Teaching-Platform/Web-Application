-- =====================================================================
-- scripts/admin_indexes_concurrently.sql
--
-- Indexes the admin port wants on LEAD tables. Never part of a migration:
-- `create index concurrently` cannot run inside the transaction that
-- `supabase db push` wraps around each file, and a plain `create index`
-- would block writes on live tables.
--
-- RUN EACH STATEMENT SEPARATELY, after the migrations, with the lead's approval.
--   * Supabase SQL editor: select ONE `create index concurrently ...` statement
--     (both of its lines) and run just that selection; repeat for the next one.
--     Running the whole file (or several statements at once) sends them as one
--     multi-statement request, which Postgres runs as a single transaction, and
--     every statement fails with "CREATE INDEX CONCURRENTLY cannot run inside a
--     transaction block".
--   * psql works too (each statement autocommits on its own):
--       psql "$DATABASE_URL" -f scripts/admin_indexes_concurrently.sql
--   Never wrap these in begin / commit.
-- Every statement is `if not exists`, so re-running one that already
-- succeeded is a no-op. If one fails it can leave an INVALID index: drop it with
-- the matching ROLLBACK line below (also one at a time) and run it again.
--
-- The trigram index uses the operator class schema-qualified as
-- extensions.gin_trgm_ops (pg_trgm lives in the `extensions` schema on Supabase).
-- If pg_trgm was installed into another schema, change that prefix to match:
--   select extnamespace::regnamespace from pg_extension where extname = 'pg_trgm';
--
-- ROLLBACK
--   drop index concurrently if exists public.adm_callback_requests_code_idx;
--   drop index concurrently if exists public.adm_callback_requests_status_idx;
--   drop index concurrently if exists public.adm_institutions_state_code_idx;
--   drop index concurrently if exists public.adm_audit_logs_target_idx;
--   drop index concurrently if exists public.adm_profiles_role_created_idx;
-- =====================================================================

-- Batch 1 ------------------------------------------------------------------
create index concurrently if not exists adm_callback_requests_code_idx
  on public.callback_requests (code) where code is not null;
create index concurrently if not exists adm_callback_requests_status_idx
  on public.callback_requests (status, created_at desc);
create index concurrently if not exists adm_institutions_state_code_idx
  on public.institutions (state_code) where state_code is not null;
create index concurrently if not exists adm_audit_logs_target_idx
  on public.audit_logs (target_type, target_id, created_at desc);
create index concurrently if not exists adm_profiles_role_created_idx
  on public.profiles (role, created_at);

-- Batch 2 ------------------------------------------------------------------
-- ROLLBACK
--   drop index concurrently if exists public.adm_quizzes_series_idx;
--   drop index concurrently if exists public.adm_quiz_questions_quiz_idx;
--   drop index concurrently if exists public.adm_quiz_questions_norm_trgm;
--   drop index concurrently if exists public.adm_quiz_attempts_quiz_status_idx;
--   drop index concurrently if exists public.adm_quiz_answers_question_idx;
--   drop index concurrently if exists public.adm_test_series_course_idx;
create index concurrently if not exists adm_quizzes_series_idx
  on public.quizzes (series_id, series_sort_order) where series_id is not null;
create index concurrently if not exists adm_quiz_questions_quiz_idx
  on public.quiz_questions (quiz_id, sort_order);
-- needs pg_trgm; speeds up detect_repeated_questions()
create index concurrently if not exists adm_quiz_questions_norm_trgm
  on public.quiz_questions using gin (public.adm_norm_text(question_text) extensions.gin_trgm_ops);
create index concurrently if not exists adm_quiz_attempts_quiz_status_idx
  on public.quiz_attempts (quiz_id, status, submitted_at);
create index concurrently if not exists adm_quiz_answers_question_idx
  on public.quiz_answers (question_id);
create index concurrently if not exists adm_test_series_course_idx
  on public.test_series (course_id);

-- Batch 3 ------------------------------------------------------------------
-- ROLLBACK
--   drop index concurrently if exists public.adm_notifications_campaign_idx;
--   drop index concurrently if exists public.adm_notifications_campaign_unread_idx;
--   drop index concurrently if exists public.adm_support_tickets_status_idx;
--   drop index concurrently if exists public.adm_support_ticket_replies_ticket_idx;
-- opened counts per campaign (list_notifications, get_notification_stats)
create index concurrently if not exists adm_notifications_campaign_idx
  on public.notifications (reference_id) where reference_type = 'notification_campaign';
-- admin bell unread count
create index concurrently if not exists adm_notifications_campaign_unread_idx
  on public.notifications (user_id) where reference_type = 'notification_campaign' and not is_read;
create index concurrently if not exists adm_support_tickets_status_idx
  on public.support_tickets (status, created_at desc);
create index concurrently if not exists adm_support_ticket_replies_ticket_idx
  on public.support_ticket_replies (ticket_id, created_at);
