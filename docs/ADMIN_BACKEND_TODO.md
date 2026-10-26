# Admin backend follow-up

## Current status on the lead's database (2026-10-25)

The admin backend now runs on the **lead's live database**, through the 29
`supabase/migrations/20261025*_admin_*.sql` files, applied on 2026-10-25. The
"Phase 3/4/6" sections further down describe the earlier standalone schema
(`0001`–`0013`, now in `supabase/migrations_archive/`). Their migration names are
historical, but the screen lists still apply unless noted here. Full detail is in
`docs/PORT_PROGRESS.md` → "Live status".

**Live (real data through RPCs):**
- dashboard, students, educators (verification, invites, documents);
- test series, the wizard and the test question editor (`TestDetail.jsx`, with
  a model-answer field);
- assignments and series requests, the series tracker, test performance
  analytics;
- reports builder, notification campaigns and the bell (honouring
  `notification_preferences`);
- callback requests, support tickets;
- security center, audit / auth events.

**Edge Functions:** not deployed yet. `create-educator-invites`,
`revoke-user-sessions`, `send-notification-emails` and `sign-educator-document`
are waiting for approval, one at a time. Until they're deployed, educator
invites, real session revocation, campaign email and document links fail with
a function-not-found error.

**Stubbed: money (F4).** There is no payments model in the lead's database. So:
- Discounts, Transactions, Refunds and Financial analytics return zeros or
  empty lists.
- Their writes raise `0A000` "not available yet".
- Revenue is 0 on the dashboard, regional and report screens.
- The `payment-webhook` / `process-refund` Edge placeholders have nothing real
  to call.

**Still open:**
1. **Payments model (F4).** The lead owns or agrees the tables. Then replace
   the D1 stubs in new migrations.
2. **Student-side access to admin series.** They sit on the hidden draft house
   course, so students can't see or enrol in them yet.
3. **Manual grading in the lead's scorer.** Subjective answers are stored as
   `short_answer` with a model answer or `Manual grading: see rubric` as the
   "correct" option. The lead's scorer may auto-mark against it. Confirm with
   the lead.
4. **`quizzes` has no draft status.** Per-test drafts exist only in our
   `quiz_admin`, so the lead's student app sees every quiz on a published
   series.
5. **Regional Head portal.** It's mounted (`/regionalhead/*`) but still on
   mock data, with no `regional_heads` contract in the lead's database.

## Student portal: hidden screens (2026-10-26)

The student portal is now test series only. Every screen below had no backend
contract and showed mock data, so it's hidden. Its route shows a "coming soon"
page (`src/portals/student/pages/ComingSoon.jsx`), or redirects to the
test-series list or history, and the screen is out of the nav. The page files
are kept, unmounted.

| Route(s) under `/student/` | Screen | Now |
|---|---|---|
| `messages` | Messages | Coming soon |
| `notifications` | Notifications (and the navbar bell) | Coming soon; bell removed |
| `certificates` | Certificates | Coming soon |
| `orders` | Payments / orders | Coming soon (payments are F4) |
| `help-complaints`, `help-complaints/:ticketId` | Help & complaints | Coming soon (the lead's `support_tickets` could back it later) |
| `calendar` | Calendar | Coming soon |
| `booksession`, `managebooking` | Session bookings | Coming soon |
| `liveclassjoin`, `live-course`, `liveclassrating`, `recordings`, `live-recording`, `attendance` | Live classes / recordings / attendance | Coming soon |
| `quiz`, `assignmentsubmit`, `notes`, `reviews` | Course quiz, assignments, notes, reviews | Coming soon |
| `explore`, `live-classes`, `recorded-classes`, `course/:courseId`, `coursedetails`, `my-learning`, `recommended`, `searchresults`, `educatorprofile`, `landing`, `wishlist`, `checkout`, `paymentresult`, `courseplayer`, `resourceviewer`, `assessments/*` (except results) | Course discovery, course player, wishlist, old assessments | Redirect to `/student/test-series` (a `?q=` search is kept) |
| `learninghistory`, `progresstracking`, `assessments/my-results`, `assessments/results/:id` | Old progress / results | Redirect to `/student/history` |
| `profile` | Old mock profile | Redirect to `/student/account` |
| `/student/onboarding/*` | Demo sign-up wizard | Redirect to `/register` (or `/student/account` when signed in) |

**Public routes** `/explore`, `/course/:id`, `/live-classes`, `/instructors` and
`/educator` (mock courses and educators) redirect to `/test-series`.

**Removed:**
- **Wishlist, everywhere:** `src/hooks/useWishlist.js`,
  `src/portals/student/pages/Wishlist.jsx`, the nav and route entries, the
  wishlist props in `CourseCarousel` and the course pages, and the `ul_wishlist*`
  keys, which are cleared on logout.

**Unmounted, no longer bundled:**
- **Student mock data:** `src/data/catalogMock.js`,
  `portals/student/data/*` (`assessmentCatalog`, `testSeriesCatalog`,
  `recommendedMock`, `sessionMock`, `studentLocalState`, …).
- **Old student pages:** the old student `Profile.jsx`, `TestSeries*.jsx`,
  `Assessment*.jsx` and course pages.

**Still in the bundle:** `TestSeriesContext` remains in `App.jsx`, used only by
the teacher portal.

**What each hidden screen needs before it can come back:** a backend contract
in the lead's database, or an agreed RPC, then a page wired to it like the test
series screens (`docs/STUDENT_RPC_CONTRACT.md`).

## Phase 6 status

The admin service layer, RPC error normalization, role/status mappers, CSV
export helper, and route guard now have focused Vitest coverage. Database RPC
contract smoke tests live in `supabase/tests/admin_rpcs.sql` and are
transactional.

The following screens remain mock-backed because the supplied schema has no
complete contract for them:

- Course approval
- Regional heads
- Escalations
- Content moderation: wired on 2026-10-27 to test feedback (`moderationApi.js`, `20261027100*_feedback_*`); the Regional Head content-issue mock (`contentIssuesMock.js`) is no longer shown there
- Settings and permissions
- Audit logs (except auth-event data where available)
- Institution management
- Region/branch hierarchy
- Management dashboards
- AI test builder

Phase 3 wiring is now complete for Regional Analytics, Reports Builder, and
Notifications (including the admin topbar bell). These pages use the exact
RPC contracts in migrations `0007_analytics_regional_reports.sql` and
`0008_notifications.sql`; report CSV data is generated by
`export_report_csv`, and regional/report list filters are server-side.

Known follow-up gaps:

- Notification create/edit UI still needs a dedicated form for the write RPCs;
  the service surface is available in `notificationsApi.js`.
- Scheduled notification dispatch requires the server/cron invocation of
  `dispatch_due_notifications`; it is intentionally not called by the browser.
- Report snapshots expire after seven days by design; users should regenerate
  expired runs.

## Phase 4 wiring

- Callback Requests use `callbacksApi.js` and the read/action RPCs from
  `0009_callbacks.sql`; search, source/status filters, pagination, and export
  remain server-side.
- Security Center, Change Password, and Audit Logs use `securityApi.js` and
  the session/auth RPCs from `0010_sessions_auth.sql`. The browser never writes
  `user_sessions` or `auth_events` directly.
- Institution reads are supported through the RLS-protected `institutions`
  table. There is no `regional_heads` table or read RPC in the supplied
  migrations; Regional Heads therefore remains mock-backed until that contract
  is added. No client-side substitute or invented endpoint is used.
- Individual session revocation is not represented by a migration contract;
  the available admin action revokes all sessions for the selected user.

The Supabase client, session-backed authentication, admin RPC normalization,
dashboard service surface, and the auth-user trigger are implemented. Remaining
schema-backed page wiring should use the RPC service conventions in
`src/portals/admin/services/adminApi.js` and `src/portals/admin/hooks/useRpc.js`.

## Known data gaps

- Several legacy educator profile tabs require fields not returned by the current
  educator RPCs or views.
- Auth-user creation and email delivery require Edge Functions.
- Discount audience targeting, combo products, bulk-code generation, and
  redemption reversal are not represented by the supplied discount RPC
  contracts; the create/edit screen intentionally submits only supported fields.
- Transaction list RPCs return the summary ledger fields only; gateway metadata,
  commissions, and refund actions require the detail/refund RPCs.
- Payment oversight has no single combined dashboard RPC, so transaction and
  pending-refund panels are loaded independently.

## Safe to delete after migration

- Existing admin mock data modules after all imports are removed and the pages
  have been regression-tested.

Mock modules are intentionally retained for screens whose backend contract is
not present yet. Remove each file only after its screen is migrated and its
imports and tests are removed.

## Admin port on the lead's database: Batch 3 follow-ups

- **Support tickets tab (D11): done.** `/admin/supporttickets` now has a
  "Support Tickets" tab next to "Callback Requests". It uses
  `services/supportTicketsApi.js` over the lead's `support_tickets` /
  `support_ticket_replies`.
- **Commerce pages are D1 stubs.** Discounts, Transactions, Refunds, Financial
  and Regional analytics return zeros and empty lists, and their write actions
  raise "not available yet" (SQLSTATE `0A000`) until a payments model exists
  (F4).
- **Notification create/edit UI.** `Notifications.jsx` renders
  `NotificationsPanel` (the RPC-backed campaign list and bell), but has no form
  for creating or editing campaigns. The campaign RPCs (D10) and
  `notificationsApi.create` / `publish` are ready. Campaigns fan out into the
  lead's `notifications` inbox and honour `notification_preferences`.
- **Remaining mock-backed admin screens.** Data is still read from or written to
  `src/portals/admin/data/*Mock.js` here:
  - User Management: the "onboarded by" column (`useOnboardedBy`).
  - Discount Overview / History: `useDiscountState` (commerce is a D1 stub
    anyway).
  - `BulkImportTeachers`: `addEducator`, so a bulk import writes to the mock and
    not to `educatorsApi.createInvites`.
  - `AdminTopbar`: `startRegionalHeadSync`.
- **Ticket notifications.** Status changes and replies on support tickets don't
  notify the submitter from the admin RPCs.
