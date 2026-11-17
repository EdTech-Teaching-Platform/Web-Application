# Fixes Applied

All fixes preserve existing behaviour and UI. Each one was verified after the change, and the full regression run then passed:
- `npm test`: 25 files, 327 tests;
- `npm run build`;
- all 18 SQL suites on a local disposable database, plus the 41-step editor flow.

## SEC-01: stored XSS (HIGH)

- **Original:** 17 `dangerouslySetInnerHTML` renders of stored HTML without sanitizing, plus `RichTextEditor` setting `innerHTML` from its value.
- **Files modified:**
  - `src/utils/richText.js`: the shared sanitizer. Wider formatting allow-list (s, sub, sup, hr, span, h2, blockquote, code, pre, a). Links keep only an `http`, `https` or `mailto` address; links without one are unwrapped (the text stays).
  - `src/components/testseries/TestResults.jsx`, `TestRunner.jsx`;
  - `src/portals/teacher/components/AnnouncementComposerPanel.jsx`, `BroadcastComposerPanel.jsx`, `BroadcastSentTab.jsx`, `GradingPanel.jsx`, `MentorshipApplicationDetail.jsx`, `MentorshipProgramView.jsx`, `MentorshipSettingsPanel.jsx`, `TestSeriesPreview.jsx`, `TestSeriesQuestionPreview.jsx`;
  - `src/portals/teacher/pages/CoursePreview.jsx`;
  - `src/components/ui/RichTextEditor.jsx`.
- **Change:** each render is now `__html: sanitizeRichHtml(<same expression>)`.
- **Improvement:** scripts, event handlers, `javascript:` / `data:` links, iframes, forms and styles can't be stored and executed.
- **Verification:** `tests/security.test.jsx` (payload tests and a guard over every file in `src/`); `tests/qa-nov11.test.jsx` (sanitizer behaviour unchanged for normal content); full suite.

## SEC-02: security headers (MEDIUM)

- **Original:** `vercel.json` had only the SPA rewrite.
- **File modified:** `vercel.json`.
- **Change:** on every page:
  - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`;
  - `Strict-Transport-Security` (2 years, subdomains);
  - `Permissions-Policy` (camera, microphone, location, payment and USB off; fullscreen allowed for proctoring);
  - `Cross-Origin-Opener-Policy`;
  - an enforced CSP limited to `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`, which can't break scripts;
  - a full `Content-Security-Policy-Report-Only` policy;
  - long-cache headers for hashed assets.
- **Improvement:** clickjacking, MIME sniffing and downgrade protection.
- **Verification:** `tests/security.test.jsx` checks the config. **Still to do:** confirm the served headers on a Vercel preview (`curl -I`).

## SEC-06: constant-time secret comparison (LOW)

- **Original:** HMAC signature, service-role bearer and cron secret compared with `===`.
- **Files modified:** `supabase/functions/_shared/security.ts` (new, import-free), `_shared/auth.ts`, `send-notification-emails/index.ts`.
- **Change:** a `safeEqual()` helper, used for all three.
- **Verification:** unit tests in `tests/security.test.jsx`. The functions aren't redeployed yet; that needs approval.

## SEC-07: configurable CORS (LOW, partial)

- **Original:** `Access-Control-Allow-Origin: *` on every Edge Function.
- **Files modified:** `_shared/security.ts` (`allowedOriginFor`), `_shared/auth.ts`.
- **Change:** if the secret `ALLOWED_ORIGINS` is set, only those origins are answered. If it isn't set, behaviour is unchanged.
- **Verification:** unit tests. **Still to do:** set `ALLOWED_ORIGINS` and redeploy the functions.

## SEC-08: dependency upgrades (HIGH advisories)

- **Original:** `follow-redirects` 1.16.0, `vite` 8.3.0, `source-map-js` 1.2.1.
- **File modified:** `package-lock.json`, via `npm audit fix` (non-breaking only).
- **Change:** `follow-redirects` 1.16.3, `vite` 8.3.8, `source-map-js` 1.2.2.
- **Verification:** `npm audit` re-run, build and full test suite.
- **Also tried:** vitest 5 broke the test runner, so it was reverted (SEC-09).

## New automated security tests (added, all passing)

- `supabase/tests/security_rbac_sweep.sql` calls all 372 project functions as anon and as a student, and checks RLS and grants on our tables and `search_path` on SECURITY DEFINER functions.
- `supabase/tests/security_idor.sql` runs 25 cross-user checks with real IDs (attempts, reports, proctoring events, feedback, AI evaluation, unpublished series, assignments, tests, questions, admin actions).
- `tests/security.test.jsx` has 21 tests: sanitizer payloads, the unsafe-render guard, open redirects, secrets in `src/`, `.env` ignored, the headers, and `safeEqual` / CORS.
