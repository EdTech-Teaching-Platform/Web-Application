-- =====================================================================
-- 20261025120500_admin_rpc_callbacks.sql
--
-- Purpose
--   Callback Requests (callbacksApi.js, page /admin/supporttickets) over the
--   lead's callback_requests, extended in Batch 1 (20261025100300):
--     get_callback_stats, get_callback_filter_options, list_callback_requests,
--     get_callback_request, export_callback_report, set_callback_status,
--     add_callback_note
--   and the public website form:
--     submit_callback_request(...)   -> anon + authenticated, no admin check
--
-- Lead objects read / written
--   callback_requests: read; runtime insert (public form) and update of status /
--   contact / close columns and code (admin actions). profiles (names).
--   callback_activity (our table) holds the timeline.
--
-- Assumptions
--   * Status values are the lead's CHECK (F7): new, contacted, closed.
--   * source is free text in the lead's table; the four archived keys
--     (website_visitor, prospective_institution, prospective_educator, other)
--     are recognised and anything else reads as 'other'.
--   * Rows the lead's own site inserts get code = null. They show the fallback
--     'CB-NEW-xxxx' until the first admin action assigns a real CB-<n> code
--     (Batch 1 contract). The public form assigns a code immediately.
--   * The lead's phone column is free text: phone search compares digits, and
--     display formatting only applies to +91 numbers.
--
-- ROLLBACK
--   drop function if exists public.submit_callback_request(text, text, text, text, text, text, text, text),
--     public.add_callback_note(uuid, text), public.set_callback_status(uuid, text, text),
--     public.export_callback_report(text, text, text, date, date), public.get_callback_request(uuid),
--     public.list_callback_requests(text, text, text, text, int, int), public.get_callback_filter_options(),
--     public.get_callback_stats(), public.adm_callback_rows(), public.adm_callback_assign_code(uuid),
--     public.adm_callback_source_key(text);
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------- helpers
create or replace function public.adm_callback_source_key(p_source text) returns text
language sql immutable set search_path = public, extensions as $$
  select case when p_source in ('website_visitor', 'prospective_institution', 'prospective_educator', 'other')
              then p_source else 'other' end;
$$;

-- Assigns CB-<n> to a lead-inserted row on its first admin action.
create or replace function public.adm_callback_assign_code(p_id uuid) returns void
language sql security definer set search_path = public, extensions as $$
  update public.callback_requests
     set code = 'CB-' || nextval('public.adm_callback_code_seq')
   where id = p_id and code is null;
$$;

-- Same columns as the archived v_callback_requests.
create or replace function public.adm_callback_rows()
returns table (
  id uuid, code text, name text, phone text, phone_display text, phone_digits text, email text,
  organization text, source text, source_label text, message text, status text, status_label text,
  assigned_to uuid, assigned_to_name text, contacted_at timestamptz, closed_at timestamptz,
  submitted_from text, created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select r.id,
         coalesce(r.code, 'CB-NEW-' || upper(left(r.id::text, 4))),
         r.name, r.phone, public.adm_phone_display(r.phone), regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'),
         r.email, r.organization, public.adm_callback_source_key(r.source),
         case public.adm_callback_source_key(r.source)
           when 'website_visitor' then 'Website Visitor' when 'prospective_institution' then 'Prospective Institution'
           when 'prospective_educator' then 'Prospective Educator' else 'Other' end,
         r.message, r.status, initcap(r.status),
         r.assigned_to, ap.full_name, r.contacted_at, r.closed_at, r.submitted_from,
         r.created_at, coalesce(r.updated_at, r.created_at)
    from public.callback_requests r
    left join public.profiles ap on ap.id = r.assigned_to;
$$;

-- ------------------------------------------------------------------ reads
create or replace function public.get_callback_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    select jsonb_build_object(
      'total',     count(*),
      'new',       count(*) filter (where r.status = 'new'),
      'contacted', count(*) filter (where r.status = 'contacted'),
      'closed',    count(*) filter (where r.status = 'closed'),
      'avg_first_response_hours',
        round((extract(epoch from avg(r.contacted_at - r.created_at) filter (where r.contacted_at is not null)) / 3600)::numeric, 1))
      from public.callback_requests r);
end $$;

-- p_status: new | contacted | closed | all. p_source: one of the four keys | all.
-- p_sort: newest | oldest | status
create or replace function public.list_callback_requests(
  p_search text default null, p_status text default null, p_source text default null,
  p_sort text default 'newest', p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like   text := public.adm_like(p_search);
  v_digits text := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');
  v_size   int  := least(greatest(coalesce(p_size, 10), 1), 100);
  v_page   int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with f as (
    select v.* from public.adm_callback_rows() v
     where (v_like is null or v.name ilike v_like or v.email ilike v_like or v.message ilike v_like
            or v.organization ilike v_like or v.code ilike v_like
            or (char_length(v_digits) >= 3 and v.phone_digits like '%' || v_digits || '%'))
       and (p_status is null or p_status in ('', 'all') or v.status = p_status)
       and (p_source is null or p_source in ('', 'all') or v.source = p_source)
  )
  select jsonb_build_object(
           'id', f.id, 'code', f.code, 'name', f.name, 'phone', f.phone, 'phone_display', f.phone_display,
           'email', f.email, 'source', f.source, 'source_label', f.source_label, 'message', f.message,
           'status', f.status, 'status_label', f.status_label, 'assigned_to_name', f.assigned_to_name,
           'created_at', f.created_at),
         count(*) over ()
    from f
   order by case when p_sort = 'oldest' then f.created_at end asc,
            case when p_sort = 'status' then case f.status when 'new' then 1 when 'contacted' then 2 else 3 end end asc,
            f.created_at desc, f.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

create or replace function public.get_callback_filter_options() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return jsonb_build_object(
    'statuses', (select jsonb_agg(jsonb_build_object('key', k, 'label', initcap(k),
                                  'count', (select count(*) from public.callback_requests r where r.status = k)) order by o)
                   from unnest(array['new', 'contacted', 'closed']) with ordinality as s(k, o)),
    'sources',  (select jsonb_agg(jsonb_build_object('key', k,
                                  'label', case k when 'website_visitor' then 'Website Visitor'
                                                  when 'prospective_institution' then 'Prospective Institution'
                                                  when 'prospective_educator' then 'Prospective Educator' else 'Other' end,
                                  'count', (select count(*) from public.callback_requests r
                                             where public.adm_callback_source_key(r.source) = k)) order by o)
                   from unnest(array['website_visitor', 'prospective_institution', 'prospective_educator', 'other'])
                        with ordinality as s(k, o)));
end $$;

create or replace function public.get_callback_request(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v jsonb;
begin
  perform public.adm_require_admin();
  select to_jsonb(x) || jsonb_build_object(
           'first_response_minutes', case when x.contacted_at is not null
                                          then round(extract(epoch from (x.contacted_at - x.created_at)) / 60) end,
           'activity', coalesce((
             select jsonb_agg(jsonb_build_object('id', a.id, 'type', a.type, 'from_status', a.from_status,
                                                 'to_status', a.to_status, 'note', a.note, 'actor', p.full_name,
                                                 'at', a.created_at) order by a.created_at desc)
               from public.callback_activity a left join public.profiles p on p.id = a.actor_id
              where a.request_id = x.id), '[]'::jsonb))
    into v
    from public.adm_callback_rows() x where x.id = p_id;
  if v is null then raise exception 'Callback request not found.' using errcode = 'P0002'; end if;
  return v;
end $$;

create or replace function public.export_callback_report(
  p_search text default null, p_status text default null, p_source text default null,
  p_from date default null, p_to date default null
) returns table (request_id text, name text, phone text, email text, organization text, source text, message text,
                 status text, assigned_to text, received_at timestamptz, contacted_at timestamptz, closed_at timestamptz,
                 first_response_hours numeric)
language plpgsql stable security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  v_like   text := public.adm_like(p_search);
  v_digits text := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');
  v_rows   int;
begin
  perform public.adm_require_admin();
  return query
  select v.code, v.name, v.phone_display, v.email, v.organization, v.source_label, v.message,
         v.status_label, v.assigned_to_name, v.created_at, v.contacted_at, v.closed_at,
         case when v.contacted_at is not null
              then round((extract(epoch from (v.contacted_at - v.created_at)) / 3600)::numeric, 1) end
    from public.adm_callback_rows() v
   where (v_like is null or v.name ilike v_like or v.email ilike v_like or v.message ilike v_like
          or (char_length(v_digits) >= 3 and v.phone_digits like '%' || v_digits || '%'))
     and (p_status is null or p_status in ('', 'all') or v.status = p_status)
     and (p_source is null or p_source in ('', 'all') or v.source = p_source)
     and (p_from is null or v.created_at >= p_from::timestamp at time zone 'Asia/Kolkata')
     and (p_to is null or v.created_at < (p_to + 1)::timestamp at time zone 'Asia/Kolkata')
   order by v.created_at desc;
  get diagnostics v_rows = row_count;
  perform public.log_export('callback_requests',
                            jsonb_build_object('search', p_search, 'status', p_status, 'source', p_source), v_rows);
end $$;

-- ----------------------------------------------------------------- writes
create or replace function public.set_callback_status(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_old text;
begin
  perform public.adm_require_admin();
  if p_status is null or p_status not in ('new', 'contacted', 'closed') then
    raise exception 'Unknown callback status: %', p_status using errcode = '22023';
  end if;
  select status into v_old from public.callback_requests where id = p_id for update;
  if not found then raise exception 'Callback request not found.' using errcode = 'P0002'; end if;
  perform public.adm_callback_assign_code(p_id);
  if v_old = p_status then
    if nullif(btrim(coalesce(p_note, '')), '') is not null then
      insert into public.callback_activity (request_id, type, note, actor_id) values (p_id, 'note', btrim(p_note), auth.uid());
    end if;
    return;
  end if;

  update public.callback_requests set
    status       = p_status,
    contacted_at = case when p_status in ('contacted', 'closed') then coalesce(contacted_at, now()) else contacted_at end,
    contacted_by = case when p_status in ('contacted', 'closed') then coalesce(contacted_by, auth.uid()) else contacted_by end,
    closed_at    = case when p_status = 'closed' then now() end,
    closed_by    = case when p_status = 'closed' then auth.uid() end,
    assigned_to  = coalesce(assigned_to, case when p_status <> 'new' then auth.uid() end),
    updated_at   = now()
  where id = p_id;
  insert into public.callback_activity (request_id, type, from_status, to_status, note, actor_id)
  values (p_id, 'status_changed', v_old, p_status, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
  perform public.adm_audit('callback.status', 'callback_request', p_id,
                           jsonb_build_object('status', v_old), jsonb_build_object('status', p_status), p_note);
end $$;

create or replace function public.add_callback_note(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  if nullif(btrim(coalesce(p_note, '')), '') is null then raise exception 'Note is empty.' using errcode = '22023'; end if;
  if not exists (select 1 from public.callback_requests where id = p_id) then
    raise exception 'Callback request not found.' using errcode = 'P0002';
  end if;
  perform public.adm_callback_assign_code(p_id);
  insert into public.callback_activity (request_id, type, note, actor_id) values (p_id, 'note', left(btrim(p_note), 2000), auth.uid());
  update public.callback_requests set updated_at = now() where id = p_id;
end $$;

-- --------------------------------------------------------- public form
-- Website callback form (anon). No admin check by design. Honeypot, phone
-- validation, duplicate merge (same phone still open within 7 days) and a
-- 3-per-24h throttle per phone.
create or replace function public.submit_callback_request(
  p_name text, p_phone text, p_source text, p_message text,
  p_email text default null, p_organization text default null,
  p_page_url text default null, p_honeypot text default null
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_phone  text := public.adm_normalize_phone(p_phone);
  v_email  text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_open   uuid;
  v_id     uuid;
begin
  if nullif(btrim(coalesce(p_honeypot, '')), '') is not null then
    return gen_random_uuid();   -- bot: pretend success, store nothing
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 120 then
    raise exception 'Please enter your name.' using errcode = '22023';
  end if;
  if v_phone is null then raise exception 'Please enter a valid phone number.' using errcode = '22023'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_message, ''))) not between 3 and 1000 then
    raise exception 'Please tell us how we can help (3 to 1000 characters).' using errcode = '22023';
  end if;

  select r.id into v_open
    from public.callback_requests r
   where (r.phone = v_phone or public.adm_normalize_phone(r.phone) = v_phone)
     and r.status in ('new', 'contacted') and r.created_at > now() - interval '7 days'
   order by r.created_at desc limit 1;
  if v_open is not null then
    insert into public.callback_activity (request_id, type, note) values (v_open, 'repeat_submission', left(btrim(p_message), 1000));
    return v_open;
  end if;
  if (select count(*) from public.callback_requests r
       where (r.phone = v_phone or public.adm_normalize_phone(r.phone) = v_phone)
         and r.created_at > now() - interval '24 hours') >= 3 then
    raise exception 'We already have your requests. Our team will call you soon.' using errcode = '54000';
  end if;

  insert into public.callback_requests (name, phone, email, organization, source, message, status, code,
                                        submitted_from, updated_at)
  values (btrim(p_name), v_phone, v_email, nullif(btrim(coalesce(p_organization, '')), ''),
          public.adm_callback_source_key(coalesce(nullif(btrim(p_source), ''), 'website_visitor')),
          btrim(p_message), 'new', 'CB-' || nextval('public.adm_callback_code_seq'), left(p_page_url, 500), now())
  returning id into v_id;
  insert into public.callback_activity (request_id, type, to_status) values (v_id, 'created', 'new');
  return v_id;
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_callback_source_key(text) from public, anon, authenticated;
revoke all on function public.adm_callback_assign_code(uuid) from public, anon, authenticated;
revoke all on function public.adm_callback_rows() from public, anon, authenticated;

revoke all on function public.get_callback_stats() from public, anon;
revoke all on function public.list_callback_requests(text, text, text, text, int, int) from public, anon;
revoke all on function public.get_callback_filter_options() from public, anon;
revoke all on function public.get_callback_request(uuid) from public, anon;
revoke all on function public.export_callback_report(text, text, text, date, date) from public, anon;
revoke all on function public.set_callback_status(uuid, text, text) from public, anon;
revoke all on function public.add_callback_note(uuid, text) from public, anon;

grant execute on function public.get_callback_stats() to authenticated;
grant execute on function public.list_callback_requests(text, text, text, text, int, int) to authenticated;
grant execute on function public.get_callback_filter_options() to authenticated;
grant execute on function public.get_callback_request(uuid) to authenticated;
grant execute on function public.export_callback_report(text, text, text, date, date) to authenticated;
grant execute on function public.set_callback_status(uuid, text, text) to authenticated;
grant execute on function public.add_callback_note(uuid, text) to authenticated;

-- The public form is the one anon-callable RPC.
revoke all on function public.submit_callback_request(text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_callback_request(text, text, text, text, text, text, text, text) to anon, authenticated;
