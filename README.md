# Universal Learning LMS — Frontend

React + Vite (JavaScript). Four portals — **Student**, **Teacher (Educator)**,
**Admin** and **Regional Head** — live side by side in one app so shared UI,
auth, and API plumbing aren't duplicated, but each dev only needs to work inside
their own portal folder.

> **The linked Supabase project is the lead's live, shared production
> database.** Read `CLAUDE.md` before running any Supabase CLI command. Never run
> `supabase db reset`, `db push`, `db seed`, or `supabase/seed_dev.sql` against
> it without the lead's explicit approval.

## Quick start

```bash
npm install
# On Windows, copy .env.example to .env manually or use Copy-Item.
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for the Supabase project.
npm run dev
```

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-anon-key>
```

The browser only ever receives the anon key. Never put a service-role key, or
any other secret, in `src/` or in a `VITE_` variable.

Run the unit tests and the production build with:

```bash
npm test
npm run build
```

## How the admin port works

The admin portal was built against its own schema first and later **ported onto
the lead's existing database**. The port only adds to the lead's schema:

- **Migrations:** `supabase/migrations/20261025*_admin_*.sql`, 29 files in 3
  batches, applied to the lead's project on 2026-10-25. Each batch starts with a
  read-only preflight that aborts if a lead object it relies on is missing, or if
  one of our names would clash with a lead object.
- **Rules:** nothing is dropped, renamed or retyped on lead tables. The port adds
  no new CHECK / NOT NULL constraints, triggers, RLS changes or policy changes on
  lead tables, and never replaces a lead function (for example `is_admin()` or
  `publish_test_series(uuid, boolean)`). Every foreign key from our tables to
  lead tables is ON DELETE CASCADE / SET NULL and indexed. Indexes on lead tables
  are built by hand with `scripts/admin_indexes_concurrently.sql`.
- **Objects:** our tables and helpers are prefixed `adm_` (or named in
  `docs/ADMIN_ON_EXISTING_DB.md` §4). Admin data is reached only through
  `SECURITY DEFINER` RPCs that check for an admin first (`admin` or
  `super_admin`). The tables themselves have RLS on and grant nothing to anon or
  authenticated users.
- **Frontend:** pages call the RPCs through the service modules in
  `src/portals/admin/services/*Api.js`. Work that needs secrets (inviting
  educators, ending sessions, sending email, signing document URLs) runs in
  Supabase Edge Functions under `supabase/functions/`.
- **Fixes after the push:** they go in **new** timestamped migration files. Never
  edit an applied migration.

More detail:

| Doc | What's in it |
|---|---|
| `docs/ADMIN_ON_EXISTING_DB.md` | The analysis: lead schema, gaps, decisions |
| `docs/PORT_PROGRESS.md` | Every file and object, assumptions, open items, what's live |
| `docs/ADMIN_BACKEND_TODO.md` | What's still mock or stubbed |
| `docs/PUSH_RUNBOOK.md` | How the migrations were pushed and verified; rollback order |
| `docs/EDGE_FUNCTIONS.md` | Edge Function secrets and deploy commands |

Read-only checks for the SQL editor: `scripts/admin_verify_push_editor.sql`
and `scripts/admin_snapshot_lead_editor.sql`.

**Creating an admin.** An admin is a `profiles` row whose `role` is `admin` or
`super_admin`. Changing a role on the shared database needs the lead's approval.

**Money is stubbed.** The lead's database has no payments model yet (F4), so
discount, transaction and refund screens return stub responses.

## Who works where

| Dev | Folder | Routes |
|---|---|---|
| Student Dev | `src/portals/student/` | `/student/*` |
| Teacher Dev | `src/portals/teacher/` | `/teacher/*` |
| Admin Dev | `src/portals/admin/` | `/admin/*`, `/admin/login` |
| Regional Head | `src/portals/regionalhead/` | `/regionalhead/*`, `/regionalhead/login`, `/invite/regional-head/:token` |

The Regional Head portal still runs on mock data
(`src/portals/admin/data/regionalPortalMock.js`, `regionalHeadsMock.js`).

Each portal folder has its own `README.md` listing every screen mapped to
its Jira story (day, title, doc section reference).

**Rule of thumb:** if you're building a screen that only your portal needs,
everything for it — the page, its small sub-components, its hooks, its API
calls — stays inside your `src/portals/<yours>/` folder. You should almost
never need to touch another portal's folder or the shared folders below.

## Folder structure

```
src/
├── main.jsx              # app entry point
├── App.jsx               # wraps the app in Router + AuthProvider
├── index.css             # Tailwind import + design tokens
│
├── routes/
│   └── AppRoutes.jsx      # mounts every portal + auth. Rarely needs edits.
│
├── auth/                  # shared pre-login screens (login/register/OTP/etc.)
├── layouts/               # one layout shell per portal
│   ├── AuthLayout.jsx, PublicLayout.jsx
│   ├── StudentLayout.jsx, TeacherLayout.jsx
│   └── AdminLayout.jsx, RegionalHeadLayout.jsx
│
├── components/            # SHARED components only — used by 2+ portals
│   ├── ui/                # Button, Card, Input — generic building blocks
│   └── common/            # Navbar, Sidebar, ProtectedRoute
│
├── context/AuthContext.jsx # logged-in user + role
├── hooks/                 # useAuth, useToast, …
├── services/              # supabaseClient.js (anon key only), apiClient.js
├── utils/roles.js         # DB role ↔ app role mapping
│
└── portals/
    ├── student/           # pages/, components/, hooks/, services/, routes.jsx
    ├── teacher/           # same shape
    ├── admin/             # same shape, plus services/*Api.js (RPC calls),
    │                      #   data/*Mock.js and per-page .css files
    └── regionalhead/      # pages/, components/, hooks/, routes.jsx, regionalhead.css

supabase/
├── migrations/            # 20261025*_admin_*.sql (applied; never edit)
├── functions/             # Edge Functions (+ _shared/)
└── tests/admin_rpcs.sql   # SQL RPC smoke tests (transaction + rollback)
```

## Conventions

- **Styling:** it depends on the portal.
  - The **Student**, **Teacher**, auth and public screens use Tailwind utility
    classes, with the design tokens in `src/index.css`.
  - The **Admin** portal uses plain CSS files: `adminTheme.css`,
    `components/AdminChrome.css` and one `.css` file per page next to the page.
    Class names are prefixed `ul-`.
  - The **Regional Head** portal reuses the admin theme, plus
    `regionalhead.css`.
  - Follow whatever the portal you're in already does. Keep one-off CSS out of
    `index.css`.
- **Shared vs. portal-local:** promote a component/hook to `src/components`
  or `src/hooks` only once a second portal actually needs it. Until then,
  keep it local to your portal.
- **Routing:** add new screens to your own `src/portals/<portal>/routes.jsx`.
  You shouldn't need to edit `src/routes/AppRoutes.jsx` — that file only
  changes when a whole new portal or top-level layout is added.
- **API calls:** admin pages call Supabase RPCs through
  `src/portals/admin/services/*Api.js`. Other portals put their requests in
  `src/portals/<portal>/services/`.
- **Auth/role state:** read the logged-in user via `useAuth()`; wrap any
  route that needs a login with `components/common/ProtectedRoute`.

## Regenerating page stubs (don't, on this branch)

`scripts/generate-portal-scaffold.mjs` generated the original
`portals/*/pages/*.jsx` stubs and each portal's `README.md` from the Jira sprint
import. **It is not safe to re-run.**

It writes, with no check for existing files:
- every page it manages;
- each portal's `routes.jsx`;
- each portal's `services/<portal>Api.js`;
- each portal's `README.md`.

All of those files now hold real screens and wiring, which the script would
overwrite with stubs. If you ever need it, run it on a clean checkout, then
review `git diff` and keep only the new files.
