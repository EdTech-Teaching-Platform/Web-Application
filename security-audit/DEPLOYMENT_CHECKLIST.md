# Production Deployment Checklist

✅ done and verified in this audit · ⬜ to do before launch · ⚠️ verify

## Authentication
- ✅ Every RPC derives the user from the JWT; admin RPCs refuse students and anon (sweep).
- ✅ Login error doesn't reveal whether an email exists; redirects after login are same-site only.
- ✅ Blocked users: RPCs refuse, login refuses, sessions cut off.
- ⬜ Supabase Auth: email confirmation on, password minimum 8 or more, leaked-password protection, rate limits, redirect URL allow-list, JWT expiry 1 h (SEC-05).
- ⬜ Consider MFA for admin accounts.
- ⬜ Remove test users and development seed data; never run `supabase/seed_dev.sql` on production.

## Authorization
- ✅ Role matrix verified by automated tests (`ROLE_ACCESS_CONTROL_MATRIX.md`).
- ✅ IDOR tests pass (25 checks).
- ⚠️ The lead's own functions check the caller (SEC-04).

## Database and RLS
- ✅ RLS on, with no browser grants, for every table this project created.
- ✅ SECURITY DEFINER functions pin `search_path`.
- ⚠️ **The lead's tables: RLS on, with no self role change and no cross-user reads (SEC-03). Blocker.**
- ⬜ Apply the pending migrations through the usual gate: trial, backup, `migration list`, dry run, push.

## Environment variables and secrets
- ✅ Only the Supabase URL and anon key are in the frontend; `.env` is git-ignored; no secrets in git history.
- ⬜ Edge Function secrets set in the dashboard, never in code: `OPENAI_API_KEY`, `RESEND_API_KEY`, `EDUCATOR_DOCS_BUCKET`, `ALLOWED_ORIGINS`, `EMAIL_CRON_SECRET` (optional), payment secrets (when payments exist).
- ⬜ Rotate any key that was ever shared in chat or email.

## HTTPS and headers
- ✅ HSTS, nosniff, frame-deny, referrer and permissions headers configured (`vercel.json`).
- ⬜ After deploy: `curl -I https://<site>` shows them.
- ⬜ Watch the browser console for CSP report-only violations on the preview. When it's clean, rename the header to `Content-Security-Policy` to enforce it.

## CORS
- ⬜ Set `ALLOWED_ORIGINS` for Edge Functions to the real domain(s) and redeploy (SEC-07).
- ⬜ Supabase dashboard → API settings: allowed origins, if used.

## API security
- ✅ Edge Functions verify the JWT (except the HMAC-signed webhook); secrets are compared in constant time.
- ✅ Uploads: type and size checked, rate-limited, server-chosen paths.
- ⬜ Redeploy changed functions: `send-notification-emails` and every function that uses `_shared/auth.ts` (all of them), with approval.

## Dependencies
- ✅ Runtime advisories fixed (`follow-redirects`, `vite`, `source-map-js`).
- ⬜ Track the dev-only vitest advisories (SEC-09) and the vite / picomatch build advisory (SEC-10).
- ⬜ Run `npm audit --omit=dev` in CI.

## Storage
- ✅ `test-assets` public by design (images only, signed uploads); `question-images` private.
- ⚠️ The educator documents bucket is private, with no cross-user policies (SEC-15).

## Logging and monitoring
- ✅ Audit log for admin actions, document access, bans and deletion requests.
- ⬜ Alerts on Edge Function errors, failed logins and AI-grading failures (SEC-18).

## Backup and recovery
- ⬜ Point-in-Time Recovery or daily backups on; **one test restore done**.
- ✅ Every migration has a rollback script and a trial file.

## Production configuration
- ⬜ Payments stay disabled until a gateway is integrated and reviewed.
- ⬜ An independent penetration test before a public launch is recommended.

**Readiness today: NOT READY (high-risk item SEC-03 unverified).** It becomes CONDITIONALLY READY once the three ⚠️ checks under Authorization, Database and Storage pass and SEC-05 is done.
