# Pending Issues

| ID | Severity | Blocks production? | Needs a person? |
|---|---|---|---|
| SEC-03 | HIGH | **Yes** (until verified) | Yes: the lead, or you with read-only SQL |
| SEC-04 | MEDIUM | **Yes** (until verified) | Yes |
| SEC-05 | MEDIUM | **Yes** (until verified) | Yes: Supabase dashboard |
| SEC-15 | LOW | No (verify before launch) | Yes |
| SEC-18 | INFO | Recommended before launch | Yes |
| SEC-07 | LOW | No | Yes: set a secret and redeploy |
| SEC-09, SEC-10 | LOW | No | No (upgrade later) |
| SEC-12, SEC-13, SEC-17 | LOW / INFO | No | Decision needed |
| SEC-11, SEC-14, SEC-16 | LOW / INFO | No | Accepted |

---

## SEC-03: lead tables' RLS (HIGH, blocks production)

- **Why it's unresolved:** the lead's RLS policies aren't in the repository. Project rules forbid running SQL against the live database without approval, and forbid changing RLS or policies on the lead's tables.
- **What to do:** run these **read-only** queries in the Supabase SQL editor and share the output with your lead.

```sql
-- 1. RLS switched on for every table?
select c.relname as table_name, c.relrowsecurity as rls_on, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by 1;

-- 2. Every policy
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' order by 1, 2;

-- 3. Can signed-in users update profiles.role? (column privileges)
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles' and grantee in ('anon', 'authenticated')
order by 1, 3;
```

**Then test on a staging copy with a student account** (in the browser console of the app):

```js
// must FAIL or change nothing
await supabase.from('profiles').update({ role: 'admin' }).eq('id', (await supabase.auth.getUser()).data.user.id)
// must return ONLY this student's own rows
await supabase.from('quiz_attempts').select('id, student_id')
await supabase.from('quiz_answers').select('id').limit(5)
await supabase.from('profiles').select('id, email').limit(5)
```

**The answers that pass:**
- every lead table has RLS on;
- no policy lets a user change their own `role`;
- reads of exam and profile tables are limited to the user's own rows, or to admins.

**If something fails:** the lead must add a policy or column privilege, for example "users can update only `full_name`, `phone` and `location` on their own row".

## SEC-04: the lead's own functions (MEDIUM, blocks until verified)

```sql
select p.proname, p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'execute') as users_can_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname not like 'adm\_%' and p.proname not like 'student\_%' and p.proname not like 'educator\_%'
order by 1;
```

- **What to check:** for each lead function anon or users can execute (for example `publish_test_series`), the lead confirms it checks the caller (an admin check, or ownership).
- **Why:** the local copy only has stand-ins for these functions, and the stand-ins ran for anon.

## SEC-05: Supabase Auth settings (MEDIUM, blocks until verified)

In **Supabase dashboard → Authentication**:
- **Email confirmation:** on (also on `docs/PROD_SECURITY_TODO.md`).
- **Minimum password length:** 8 or more, with "leaked password protection" on.
- **Rate limits:** sign-in, sign-up, OTP and password-reset limits at their defaults or stricter.
- **Redirect URLs:** only the real site URL(s), including `/auth/callback` and `/reset-password`.
- **MFA:** consider requiring it for admin accounts.
- **JWT expiry:** 1 hour (the default).
- **Remove test users** and the development seed data.

## SEC-15: storage (LOW)

```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets order by 1;
select policyname, cmd, roles, qual from pg_policies where schemaname = 'storage' order by 1;
```

- **What passes:** the educator documents bucket (the `EDUCATOR_DOCS_BUCKET` secret) is **not public**, and has no policy letting users read other users' files.

## SEC-18: monitoring and backups (INFO)

- Turn on Point-in-Time Recovery or daily backups, and do one **test restore**.
- Set alerts on Edge Function errors and failed logins (Supabase logs or log drains).

## SEC-07: CORS (LOW)

- Set the Edge Function secret `ALLOWED_ORIGINS=https://<your-domain>` (comma-separate several), then redeploy the functions. Needs approval.
- **Known limit:** the allowed origin is held per function instance. Two allowed origins calling the same instance at once could, rarely, get a CORS error, but never a security bypass.

## SEC-09: test-runner advisories (LOW, dev only)

- `vitest` 3, `tinypool` and `@vitest/mocker` advisories affect only the local test runner, never the shipped site.
- vitest 5 broke the suite, so upgrade it later together with the test setup.

## SEC-10: picomatch ReDoS (LOW, build only)

- It's in Vite's file globbing at build time and doesn't affect users.
- Upgrade `vite` when a patched `picomatch` is released. Don't downgrade, which is npm's suggestion.

## SEC-12: account enumeration on sign-up (LOW, UX decision)

- Sign-up says "An account with this email already exists", and educator onboarding has a similar message.
- With email confirmation on (SEC-05), Supabase no longer reveals existing emails on sign-up. Optionally, make the message neutral.

## SEC-13: anon EXECUTE on admin RPCs (INFO)

- Every admin RPC refuses anon inside (verified by the sweep), so this is defence in depth only.
- **Optional clean-up:** a migration revoking EXECUTE from `anon` on our admin RPCs. It must first list the RPCs public pages need without login (catalogue, callback form and similar).

## SEC-17: error messages from Edge Functions (LOW)

- Unexpected errors return the raw message.
- **Optional:** log the detail server-side and return a generic message for anything other than validation errors.

## Accepted

- **SEC-11:** an old project's public anon key in history. Optional: delete that old Supabase project.
- **SEC-14:** any signed-in user can use student RPCs on their own data.
- **SEC-16:** tokens in localStorage. **Addressed (21 Nov), effective once `VITE_AUTH_MODE=cookie` is on:** the server layer (`api/auth.js`, `api/sb.js`) keeps the tokens in HttpOnly cookies, so JavaScript can't read them. Until the switch is on, the old behaviour stays.
