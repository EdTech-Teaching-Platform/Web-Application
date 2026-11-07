-- =====================================================================
-- scripts/rollback_20261107090000_student_notifications.sql
--
-- Undoes 20261107090000_student_notifications.sql: drops the three new
-- student RPCs. Nothing was replaced, so nothing is restored. Read flags the
-- students set (notifications.is_read / read_at) stay as they are.
-- One transaction. Run only with "approved: rollback 20261107090000".
-- =====================================================================
begin;
drop function if exists public.student_mark_all_notifications_read();
drop function if exists public.student_mark_notification_read(uuid);
drop function if exists public.student_list_notifications(boolean, int);
commit;
