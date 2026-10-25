set search_path = public, extensions;

-- Keep the two student status columns consistent. The account_status column is
-- text in 0004, while status is the student_status enum.
create or replace function sync_student_block_status()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'blocked' then
      new.account_status := 'blocked';
      new.blocked_at := coalesce(new.blocked_at, now());
      new.blocked_by := coalesce(new.blocked_by, auth.uid());
    else
      new.account_status := 'active';
      new.blocked_at := null;
      new.blocked_by := null;
      new.blocked_reason := null;
    end if;
  elsif new.account_status is distinct from old.account_status then
    if new.account_status = 'blocked' then
      new.status := 'blocked';
      new.blocked_at := coalesce(new.blocked_at, now());
      new.blocked_by := coalesce(new.blocked_by, auth.uid());
    elsif new.account_status = 'active' then
      new.status := 'active';
      new.blocked_at := null;
      new.blocked_by := null;
      new.blocked_reason := null;
    end if;
  end if;

  if new.status = 'blocked' and nullif(btrim(new.blocked_reason), '') is null then
    raise exception 'A blocked student requires a reason.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_student_block_status on students;
create trigger trg_sync_student_block_status
before update of status, account_status, blocked_reason, blocked_at, blocked_by on students
for each row execute function sync_student_block_status();

alter table students enable row level security;
drop policy if exists students_admin on students;
create policy students_admin on students for all using (is_admin()) with check (is_admin());
drop policy if exists students_self_read on students;
create policy students_self_read on students for select using (id = auth.uid());

alter table student_block_history enable row level security;
drop policy if exists block_history_admin on student_block_history;
create policy block_history_admin on student_block_history for all using (is_admin()) with check (is_admin());

-- Protect every non-lookup public table that does not already have a policy.
do $$
declare
  r record;
  policy_name text;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname not in (
        'students', 'student_block_history',
        'regions', 'report_types', 'app_settings', 'admin_nav_items'
      )
      and not exists (
        select 1
        from pg_policy p
        where p.polrelid = c.oid
      )
  loop
    execute format('alter table public.%I enable row level security', r.relname);
    policy_name := left(r.relname || '_admin', 63);
    execute format(
      'create policy %I on public.%I for all using (is_admin()) with check (is_admin())',
      policy_name, r.relname
    );
  end loop;

  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname in ('regions', 'report_types', 'app_settings', 'admin_nav_items')
  loop
    execute format('alter table public.%I enable row level security', r.relname);
    policy_name := left(r.relname || '_authenticated_read', 63);
    if not exists (
      select 1
      from pg_policy p
      join pg_class pc on pc.oid = p.polrelid
      join pg_namespace pn on pn.oid = pc.relnamespace
      where pn.nspname = 'public' and pc.relname = r.relname
        and p.polname = policy_name
    ) then
      execute format(
        'create policy %I on public.%I for select using (auth.uid() is not null)',
        policy_name, r.relname
      );
    end if;
    policy_name := left(r.relname || '_admin_write', 63);
    if not exists (
      select 1
      from pg_policy p
      join pg_class pc on pc.oid = p.polrelid
      join pg_namespace pn on pn.oid = pc.relnamespace
      where pn.nspname = 'public' and pc.relname = r.relname
        and p.polname = policy_name
    ) then
      execute format(
        'create policy %I on public.%I for all using (is_admin()) with check (is_admin())',
        policy_name, r.relname
      );
    end if;
  end loop;
end;
$$;

-- Admin RPCs must not be callable by anonymous or PUBLIC callers. Callback
-- submission is intentionally excluded because it is the public contact form.
do $$
declare
  r record;
begin
  for r in
    select p.oid, n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) as identity_args,
           lower(pg_get_functiondef(p.oid)) as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname <> 'submit_callback_request'
      and (
        lower(pg_get_functiondef(p.oid)) like '%is_admin(%'
        or lower(pg_get_functiondef(p.oid)) like '%auth.uid(%'
      )
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from anon, public',
      r.nspname, r.proname, r.identity_args
    );
    execute format(
      'grant execute on function %I.%I(%s) to authenticated',
      r.nspname, r.proname, r.identity_args
    );
  end loop;
end;
$$;
