# Security Audit Report — Universal Learning LMS

**Date:** 18 November 2026
**Scope:** this repository (React frontend, Supabase migrations / RPCs, Edge Functions, deployment config)
**Method:** code inspection, automated tests against a local disposable database (PGlite), dependency and secret scans
**Assessment:** **NOT READY: high-risk issues remain**. One high-risk item (SEC-03) can't be verified from the repository; it needs a read-only check on the live database. See §12.

This report doesn't claim the application is secure. It records what was tested, what was fixed and verified, and what's still open.

---

## 1. Executive summary

The application's own server code is in good shape:
- **Admin functions:** an automated sweep called all **372** project database functions as an anonymous visitor and as a plain student. No admin function could be used by either.
- **IDOR:** a separate test with real IDs confirmed that students can't touch other students' attempts or reports, and educators can't touch other educators' tests or assignments (25 checks).

The audit found and fixed:
- **SEC-01 (HIGH): stored XSS.** 17 places rendered stored HTML without sanitizing it (question text, model answers, explanations, announcements, mentorship text, lesson content). All of them now go through one allow-list sanitizer, and a test fails the build if a new unsanitized render is added.
- **SEC-02 (MEDIUM): missing HTTP security headers.** Added clickjacking, MIME-sniffing, HSTS, referrer and permissions headers; a full CSP runs in report-only mode.
- **SEC-08 (HIGH advisory): vulnerable dependencies on the production path** (`follow-redirects` via axios, `vite`, `source-map-js`). Upgraded with non-breaking fixes.
- **SEC-06 / SEC-07 (LOW):** Edge Function secrets are now compared in constant time, and CORS can be restricted to known origins.

The main open risk is outside this repository:
- **SEC-03.** The lead's own tables (`profiles`, `quiz_attempts`, `quiz_answers`, `notifications` and others) are protected only by the lead's RLS policies. Those aren't in the repo and couldn't be tested.
- The frontend writes the user's own `profiles` row directly. If those policies let a user change their own `role`, or read other users' rows, that would be a privilege-escalation or data-exposure path for the lead's features.
- This project's admin checks don't trust `profiles.role` (they use an allowlist), so our own functions are safe either way.

## 2. Architecture overview

| Area | What it is |
|---|---|
| Frontend | React 19 SPA (Vite 8, react-router 7, Tailwind 4), hosted on Vercel (`vercel.json`). Three portals, `/student/*`, `/teacher/*` and `/admin/*`, plus public pages. |
| Backend | No custom server. Supabase: Postgres plus **SECURITY DEFINER RPC functions** (60 migrations, ~470 functions), Supabase Auth, Storage, and **11 Edge Functions** (Deno). |
| Database access | The browser calls RPCs with the public anon key and the user's JWT. A few direct table calls (own `profiles` / `student_profiles` row) rely on the lead's RLS. |
| Auth | Supabase Auth (email + password, Google OAuth). Sessions are kept by supabase-js in localStorage. |
| Authorization | Admin: `adm_is_platform_admin()`, which requires the `adm_admin_users` allowlist **and** an admin role. Educator: `adm_is_verified_educator()`, from our review state (an educator can't approve themselves). Student: `adm_student_uid()` (signed in, not blocked). Series ownership: `adm_require_series_access()`. |
| Storage | `test-assets` (public: banners and question images; uploads only through signed upload URLs), `question-images` (private; admin write), the lead's educator documents bucket (private; read through 10-minute signed URLs). |
| Third parties | OpenAI (AI grading, server-side only, `OPENAI_API_KEY` secret), Resend (email), Google OAuth. Payments: placeholder only (no live gateway). |
| Secrets | Only the Supabase URL and anon key reach the browser (public by design). Service-role, OpenAI, Resend and webhook secrets are Edge Function secrets. |

## 3. Scope

**In scope:** every file in `src/`, `supabase/migrations/`, `supabase/functions/`, `vercel.json`, `package.json`, git history.

**Not fully assessed:**
- the lead's database objects (tables' RLS, the lead's own functions, storage policies);
- Supabase dashboard settings (Auth, rate limits);
- the live deployment (headers as actually served, TLS);
- runtime behaviour under load.

These are listed in `PENDING_ISSUES.md` with the checks to run.

## 4. Authentication findings

| Check | Result |
|---|---|
| Auth enforced on the backend | ✅ **Verified.** Every RPC derives the user from the JWT (`auth.uid()`). The sweep shows no admin RPC usable by anon or a student. Frontend route guards are UX only. |
| Password storage | ✅ Supabase Auth (hashed by Supabase); the app never sees passwords. |
| JWT validation | ✅ Edge Functions use `verify_jwt = true` (except the HMAC-signed payment webhook) and re-check the user with `auth.getUser()`. |
| Role manipulation from the frontend | ✅ **For our functions:** admin needs the allowlist; educator rights need our review state. ⚠️ **For lead features:** depends on the lead's RLS on `profiles` (SEC-03). |
| Account enumeration | ✅ Login gives one message for an unknown email and a wrong password. ⚠️ Sign-up and educator onboarding say "an account with this email already exists" (SEC-12, low). |
| Open redirects after login | ✅ **Verified.** `safeRedirect` allows only same-site paths (unit-tested against `//`, `https://`, `\\` and `javascript:`). |
| Blocked accounts | ✅ **Verified** in earlier suites: the RPCs refuse, the login check refuses, Auth-level ban, and the open session is cut off within 30 s. |
| Password policy, brute force, email confirmation, MFA | ⚠️ Not verifiable from the repo: Supabase dashboard settings (SEC-05). The client enforces a strong-password checklist, but the server minimum is the dashboard's. |
| Logout / session invalidation | ✅ `signOut` plus clearing per-user caches. Admin session revocation exists (`revoke-user-sessions`). |
| Password reset | ✅ Supabase flow; the redirect is pinned to this site's `/reset-password`. |

## 5. Role-based access control findings

See `ROLE_ACCESS_CONTROL_MATRIX.md`.

- **Admin functions:** every one tested as anon and as a student was denied (42501).
- **Educators:** only their own series, tests, questions and assignments. A pending or unverified educator gets only the onboarding RPCs, and a series waiting for approval is read-only for its author.
- **Students:** only their own attempts, reports, feedback, notifications, AI evaluations and deletion requests. They can't enrol in or start an unpublished series.
- **IDOR:** 25 real-ID checks pass (`supabase/tests/security_idor.sql`).
- **Teachers and student data:** no educator RPC returns another user's personal data; educators see aggregates only.
- **Observation (SEC-14, informational):** `adm_student_uid()` doesn't require role = student, so any signed-in user can use student RPCs on their own data. This doesn't let anyone reach someone else's data.

## 6. Database findings

| Check | Result |
|---|---|
| RLS on our tables | ✅ **Verified** by the sweep: every table we created has RLS on, and anon has no privileges on them. |
| SECURITY DEFINER functions pin `search_path` | ✅ **Verified** for all of them (sweep + static check: 467 functions). |
| Service-role key exposure | ✅ None in `src/` or git history (scan + regression test). |
| Lead tables' RLS and policies | ⚠️ **Unknown.** Not in the schema dump; the policies can't be changed by this project (SEC-03). |
| Lead's own functions (`is_admin`, `publish_test_series`, …) | ⚠️ **Unknown.** Stubbed locally; the stubs ran for anon, so the real ones must be checked live (SEC-04). |
| anon EXECUTE on admin RPCs | ℹ️ Supabase grants it by default; every admin RPC refuses inside (verified). Revoking it is defence in depth (SEC-13). |
| SQL injection | ✅ No dynamic SQL built from user input in RPCs (the few `execute` statements use fixed text or `format(%L/%I)`). Edge Functions use the supabase-js query builder or RPCs. |
| Mass assignment | ✅ RPCs read named keys from a jsonb payload; role, status and owner fields are never taken from the client. |

## 7. API (Edge Function) findings

| Function | Auth | Notes |
|---|---|---|
| create-educator-invites, revoke-user-sessions, set-user-ban, process-refund, ai-generate-test | Admin (`requireAdmin` → allowlist RPC) | ✅ |
| sign-educator-document | User; the RPC authorises (admin or the owning educator) and audits | ✅ (existing tests) |
| educator-upload-url, asset-upload-url | User; RPC slot claim (role + rate limit); type and size validated; server-chosen path | ✅ |
| evaluate-subjective | The student owning the attempt; service-role steps never exposed; marks clamped | ✅ (tests) |
| send-notification-emails | Service-role bearer or cron secret | ✅ Now constant-time (SEC-06). |
| payment-webhook | HMAC signature (`verify_jwt` false) | ✅ Now constant-time (SEC-06). Placeholder; payments aren't live. |

- **CORS:** wildcard. Configurable now (SEC-07).
- **Error responses:** pass server error messages through (SEC-17, low).
- **Rate limiting:** uploads have per-user limits and AI grading has 3 tries per attempt. Other RPCs rely on Supabase platform limits.

## 8. Frontend findings

| Check | Result |
|---|---|
| Hardcoded secrets | ✅ None (scan + test). Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, which are public by design. |
| Unsafe HTML rendering (XSS) | ❌→✅ **SEC-01 fixed and verified.** 17 render sites plus the rich-text editor now go through `sanitizeRichHtml`, and a guard test fails on any new unsanitized render. |
| Tokens in localStorage | ℹ️ The supabase-js default (SEC-16). Mitigated by SEC-01 and the planned CSP. |
| Debug output / source maps | ✅ No `console.log` in `src/`; Vite doesn't emit source maps by default. |
| Route protection | ✅ UI guards on each portal plus server enforcement. |

## 9. File upload and storage findings

- **Uploads:** they go through Edge Functions that check the type (JPEG/PNG/WebP), size (2–3 MB for images) and role, rate-limit per user, and generate the storage path server-side. The browser never chooses the folder.
- **Saving image paths:** the database refuses an image path from another user's folder (existing test).
- **Educator documents:** served only through 10-minute signed URLs after an ownership check, and audited.
- ⚠️ **Lead's documents bucket:** whether it's private, and its storage policies, can't be seen in the repo (SEC-15). `question-images` can be read by any signed-in user (low sensitivity).

## 10. Environment and deployment findings

- `.env` is git-ignored. One early commit (`38cfef2`, 24 Oct) contained a `.env` with an **old** project's URL and **anon** key only. Both are public by design and the project is no longer used; no secret was exposed (SEC-11).
- Security headers were missing; they're now added (SEC-02). The live headers must be checked after deploy.
- HTTPS is enforced by Vercel; HSTS is now set too.
- No default credentials or debug flags were found. `seed_dev.sql` must never run on production (already a project rule).

## 11. Dependency findings

`npm audit` before the audit showed 9 advisories (2 critical, 6 high, 1 moderate).

- **Fixed (non-breaking):** `follow-redirects` 1.16.3 (axios; credential leak on redirects), `vite` 8.3.8 (dev-server command injection on Windows), `source-map-js` 1.2.2.
- **Pending:** `vitest`, `tinypool` and `@vitest/mocker` (the 2 critical advisories). They're **dev / test only** and never shipped; vitest 5 breaks the test suite, so the upgrade is deferred (SEC-09).
- **Pending:** `picomatch` ReDoS in the vite **build** chain. Upstream has no fix and npm's suggestion is a downgrade (SEC-10). This is build-time only; nothing reaches users.

## 12. Production recommendation

**NOT READY: high-risk issues remain**, specifically SEC-03, which is unverified rather than confirmed. Once the read-only checks in `PENDING_ISSUES.md` show:
- users can't change their own `profiles.role`, or read other users' rows in the lead's tables;
- the lead's functions check the caller (SEC-04);
- the Supabase Auth settings are right (SEC-05);

the assessment becomes **CONDITIONALLY READY**. The remaining items are low or informational, and the CSP should be enforced after a preview check.

The full list is in `VULNERABILITY_REGISTER.md`. What was changed is in `FIXES_APPLIED.md`; the tests are in `SECURITY_TEST_RESULTS.md`.
