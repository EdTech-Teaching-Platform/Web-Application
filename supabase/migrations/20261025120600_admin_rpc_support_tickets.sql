-- =====================================================================
-- 20261025120600_admin_rpc_support_tickets.sql
--
-- Purpose
--   D11: admin RPCs over the lead's support_tickets / support_ticket_replies,
--   exposed through the new service src/portals/admin/services/supportTicketsApi.js:
--     get_support_ticket_stats()
--     list_support_tickets(p_search, p_status, p_category, p_priority, p_assigned_to, p_sort, p_page, p_size)
--     get_support_ticket(p_id)                     -> ticket + thread (internal notes included)
--     set_support_ticket_status(p_id, p_status, p_note)
--     set_support_ticket_priority(p_id, p_priority)
--     assign_support_ticket(p_id, p_admin_id)      -> null unassigns
--     reply_support_ticket(p_id, p_content, p_internal)
--
-- Lead objects read / written
--   support_tickets: read; runtime update of status, priority, assigned_to,
--   resolved_at, updated_at. support_ticket_replies: read; runtime insert.
--   profiles: names / roles.
--
-- Assumptions
--   * Status values are the lead's CHECK (F7): open, in_progress,
--     waiting_on_user, resolved, closed. Category and priority use the lead's
--     CHECK values (technical .. other; low, medium, high, urgent).
--   * resolved_at is set when a ticket moves to resolved or closed and cleared
--     when it is reopened.
--   * No ticket UI changes: /admin/supporttickets keeps showing callback
--     requests. A second "Support tickets" tab needs a page change and is listed
--     in docs/ADMIN_BACKEND_TODO.md (D11).
--   * Submitters are not notified from here (the lead's app owns ticket
--     notifications, if any); listed as a follow-up.
--
-- ROLLBACK
--   drop function if exists public.reply_support_ticket(uuid, text, boolean),
--     public.assign_support_ticket(uuid, uuid), public.set_support_ticket_priority(uuid, text),
--     public.set_support_ticket_status(uuid, text, text), public.get_support_ticket(uuid),
--     public.list_support_tickets(text, text, text, text, uuid, text, int, int),
--     public.get_support_ticket_stats(), public.adm_ticket_rows();
-- =====================================================================
set search_path = public, extensions;

create or replace function public.adm_ticket_rows()
returns table (
  id uuid, subject text, category text, priority text, status text,
  submitted_by uuid, submitter_name text, submitter_email text, submitter_role text,
  assigned_to uuid, assigned_to_name text, reference_type text, reference_id uuid,
  reply_count bigint, last_reply_at timestamptz, created_at timestamptz, updated_at timestamptz,
  resolved_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select t.id, t.subject, t.category, t.priority, t.status,
         t.submitted_by, sp.full_name, sp.email, sp.role,
         t.assigned_to, ap.full_name, t.reference_type, t.reference_id,
         (select count(*) from public.support_ticket_replies r where r.ticket_id = t.id),
         (select max(r.created_at) from public.support_ticket_replies r where r.ticket_id = t.id),
         t.created_at, t.updated_at, t.resolved_at
    from public.support_tickets t
    left join public.profiles sp on sp.id = t.submitted_by
    left join public.profiles ap on ap.id = t.assigned_to;
$$;

create or replace function public.get_support_ticket_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    select jsonb_build_object(
      'total',           count(*),
      'open',            count(*) filter (where t.status = 'open'),
      'in_progress',     count(*) filter (where t.status = 'in_progress'),
      'waiting_on_user', count(*) filter (where t.status = 'waiting_on_user'),
      'resolved',        count(*) filter (where t.status = 'resolved'),
      'closed',          count(*) filter (where t.status = 'closed'),
      'urgent_open',     count(*) filter (where t.priority = 'urgent' and t.status in ('open', 'in_progress', 'waiting_on_user')),
      'unassigned',      count(*) filter (where t.assigned_to is null and t.status in ('open', 'in_progress', 'waiting_on_user')))
      from public.support_tickets t);
end $$;

-- p_sort: newest | oldest | priority | updated
create or replace function public.list_support_tickets(
  p_search text default null, p_status text default null, p_category text default null,
  p_priority text default null, p_assigned_to uuid default null, p_sort text default 'newest',
  p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 10), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with f as (
    select v.* from public.adm_ticket_rows() v
     where (v_like is null or v.subject ilike v_like or v.submitter_name ilike v_like or v.submitter_email ilike v_like
            or exists (select 1 from public.support_tickets t where t.id = v.id and t.description ilike v_like))
       and (p_status is null or p_status in ('', 'all') or v.status = p_status)
       and (p_category is null or p_category in ('', 'all') or v.category = p_category)
       and (p_priority is null or p_priority in ('', 'all') or v.priority = p_priority)
       and (p_assigned_to is null or v.assigned_to = p_assigned_to)
  )
  select to_jsonb(f), count(*) over ()
    from f
   order by case when p_sort = 'oldest' then f.created_at end asc,
            case when p_sort = 'priority' then case f.priority when 'urgent' then 1 when 'high' then 2
                                                               when 'medium' then 3 else 4 end end asc,
            case when p_sort = 'updated' then f.updated_at end desc,
            f.created_at desc, f.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

create or replace function public.get_support_ticket(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v jsonb;
begin
  perform public.adm_require_admin();
  select to_jsonb(x) || jsonb_build_object(
           'description', (select t.description from public.support_tickets t where t.id = x.id),
           'replies', coalesce((
             select jsonb_agg(jsonb_build_object('id', r.id, 'author_id', r.author_id, 'author_name', p.full_name,
                                                 'author_role', p.role, 'content', r.content, 'is_internal', r.is_internal,
                                                 'attachment_url', r.attachment_url, 'created_at', r.created_at)
                              order by r.created_at)
               from public.support_ticket_replies r left join public.profiles p on p.id = r.author_id
              where r.ticket_id = x.id), '[]'::jsonb))
    into v
    from public.adm_ticket_rows() x where x.id = p_id;
  if v is null then raise exception 'Support ticket not found.' using errcode = 'P0002'; end if;
  return v;
end $$;

create or replace function public.set_support_ticket_status(p_id uuid, p_status text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_old text;
begin
  perform public.adm_require_admin();
  if p_status is null or p_status not in ('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed') then
    raise exception 'Unknown ticket status: %', p_status using errcode = '22023';
  end if;
  select status into v_old from public.support_tickets where id = p_id for update;
  if not found then raise exception 'Support ticket not found.' using errcode = 'P0002'; end if;
  update public.support_tickets
     set status      = p_status,
         resolved_at = case when p_status in ('resolved', 'closed') then coalesce(resolved_at, now()) end,
         updated_at  = now()
   where id = p_id;
  if nullif(btrim(coalesce(p_note, '')), '') is not null then
    insert into public.support_ticket_replies (ticket_id, author_id, content, is_internal)
    values (p_id, auth.uid(), btrim(p_note), true);
  end if;
  perform public.adm_audit('support_ticket.status', 'support_ticket', p_id,
                           jsonb_build_object('status', v_old), jsonb_build_object('status', p_status), p_note);
  return public.get_support_ticket(p_id);
end $$;

create or replace function public.set_support_ticket_priority(p_id uuid, p_priority text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_old text;
begin
  perform public.adm_require_admin();
  if p_priority is null or p_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception 'Unknown priority: %', p_priority using errcode = '22023';
  end if;
  select priority into v_old from public.support_tickets where id = p_id for update;
  if not found then raise exception 'Support ticket not found.' using errcode = 'P0002'; end if;
  update public.support_tickets set priority = p_priority, updated_at = now() where id = p_id;
  perform public.adm_audit('support_ticket.priority', 'support_ticket', p_id,
                           jsonb_build_object('priority', v_old), jsonb_build_object('priority', p_priority), null);
end $$;

create or replace function public.assign_support_ticket(p_id uuid, p_admin_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_old uuid;
begin
  perform public.adm_require_admin();
  if p_admin_id is not null
     and not exists (select 1 from public.profiles where id = p_admin_id and role in ('admin', 'super_admin')) then
    raise exception 'Assignee must be an admin.' using errcode = '22023';
  end if;
  select assigned_to into v_old from public.support_tickets where id = p_id for update;
  if not found then raise exception 'Support ticket not found.' using errcode = 'P0002'; end if;
  update public.support_tickets set assigned_to = p_admin_id, updated_at = now() where id = p_id;
  perform public.adm_audit('support_ticket.assign', 'support_ticket', p_id,
                           jsonb_build_object('assigned_to', v_old), jsonb_build_object('assigned_to', p_admin_id), null);
end $$;

-- p_internal = true writes an internal note (hidden from the submitter by the lead's is_internal flag).
create or replace function public.reply_support_ticket(p_id uuid, p_content text, p_internal boolean default false) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_reply uuid;
begin
  perform public.adm_require_admin();
  if nullif(btrim(coalesce(p_content, '')), '') is null then
    raise exception 'Reply is empty.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.support_tickets where id = p_id) then
    raise exception 'Support ticket not found.' using errcode = 'P0002';
  end if;
  insert into public.support_ticket_replies (ticket_id, author_id, content, is_internal)
  values (p_id, auth.uid(), left(btrim(p_content), 10000), coalesce(p_internal, false))
  returning id into v_reply;
  update public.support_tickets set updated_at = now() where id = p_id;
  perform public.adm_audit(case when coalesce(p_internal, false) then 'support_ticket.note' else 'support_ticket.reply' end,
                           'support_ticket', p_id, null, jsonb_build_object('reply_id', v_reply), null);
  return public.get_support_ticket(p_id);
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_ticket_rows() from public, anon, authenticated;

revoke all on function public.get_support_ticket_stats() from public, anon;
revoke all on function public.list_support_tickets(text, text, text, text, uuid, text, int, int) from public, anon;
revoke all on function public.get_support_ticket(uuid) from public, anon;
revoke all on function public.set_support_ticket_status(uuid, text, text) from public, anon;
revoke all on function public.set_support_ticket_priority(uuid, text) from public, anon;
revoke all on function public.assign_support_ticket(uuid, uuid) from public, anon;
revoke all on function public.reply_support_ticket(uuid, text, boolean) from public, anon;

grant execute on function public.get_support_ticket_stats() to authenticated;
grant execute on function public.list_support_tickets(text, text, text, text, uuid, text, int, int) to authenticated;
grant execute on function public.get_support_ticket(uuid) to authenticated;
grant execute on function public.set_support_ticket_status(uuid, text, text) to authenticated;
grant execute on function public.set_support_ticket_priority(uuid, text) to authenticated;
grant execute on function public.assign_support_ticket(uuid, uuid) to authenticated;
grant execute on function public.reply_support_ticket(uuid, text, boolean) to authenticated;
