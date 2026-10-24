# Admin backend progress

## Phase 1: Development seed data

- Files changed: `supabase/seed_dev.sql`, `docs/PROGRESS.md`
- Tables used: `auth.users`, `auth.identities`, `profiles`, `educators`, `students`,
  `subjects`, `test_series`, `tests`, `questions`, `question_options`,
  `series_enrollments`, `discounts`
- RPCs used: none
- Gaps: The seed is intentionally not executed by the agent; payment, refund,
  institution, callback, notification, and attempt fixtures remain to be expanded
  after their final contracts are wired.
- Build result: `npm run build` was not required for this SQL-only phase.

## Phase 2: Money pages

- Files changed: discount, transaction, refund, and financial admin pages and
  `discountsApi.js`, `transactionsApi.js`, `refundsApi.js`, `financialApi.js`.
- RPCs used: discount, transaction, refund, and financial analytics RPCs from
  migrations 0005–0007.
- Gaps: Gateway refund processing requires the process-refund Edge Function.
- Build result: passed.

## Phase 3: Regional, reports, and notifications

- Files changed: regional analytics, reports builder, notifications, top-bar
  notification components, and the corresponding service modules.
- RPCs used: regional, report, notification, and user-notification RPCs from
  migrations 0007–0008.
- Gaps: Email notification delivery requires the send-notification-emails
  Edge Function.
- Build result: passed.

## Phase 4: Support, security, and audit

- Files changed: support tickets, security center, change password, audit logs,
  and callback/security service modules.
- RPCs used: callback RPCs from 0009 and auth/session RPCs from 0010.
- Gaps: Audit logs are limited to auth-event data supported by the schema.
- Build result: passed.

## Phase 5: Edge Functions

- Files changed: `supabase/functions/`, `supabase/config.toml`, and
  `docs/EDGE_FUNCTIONS.md`.
- Functions added: educator invites, session revocation, notification email
  delivery, payment webhook, refund processing, and AI generation placeholder.
- Gaps: Payment and email provider payload/signature adapters require production
  provider configuration.
- Build result: passed. Functions were not deployed.

## Phase 6: Cleanup, tests, and documentation

- Files changed: README, focused Vitest tests, CSV utility, SQL RPC smoke tests,
  and backend/security TODO documents.
- Tests: `npm test` passed with 7 tests.
- SQL smoke tests: added but not executed against a live database.
- Build result: passed.
