# Universal Learning LMS — Frontend

React + Vite + Tailwind CSS (JavaScript). Three portals — **Student**,
**Teacher (Educator)**, and **Admin** — live side by side in one app so
shared UI, auth, and API plumbing aren't duplicated three times, but each
dev only needs to work inside their own portal folder.

## Quick start

```bash
npm install
cp .env.example .env   # set VITE_API_BASE_URL to your backend
npm run dev
```

## Who works where

| Dev | Folder | Routes |
|---|---|---|
| Student Dev | `src/portals/student/` | `/student/*` |
| Teacher Dev | `src/portals/teacher/` | `/teacher/*` |
| Admin Dev | `src/portals/admin/` | `/admin/*` |

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
├── index.css             # Tailwind import — do not add global CSS here
│
├── routes/
│   └── AppRoutes.jsx      # mounts all 3 portals + auth. Rarely needs edits.
│
├── auth/                  # shared pre-login screens (login/register/OTP/etc.)
│   ├── pages/
│   └── routes.jsx
│
├── layouts/               # one layout shell per portal (navbar + sidebar)
│   ├── AuthLayout.jsx
│   ├── StudentLayout.jsx
│   ├── TeacherLayout.jsx
│   └── AdminLayout.jsx
│
├── components/            # SHARED components only — used by 2+ portals
│   ├── ui/                # Button, Card, Input — generic building blocks
│   └── common/            # Navbar, Sidebar, ProtectedRoute
│
├── context/
│   └── AuthContext.jsx     # logged-in user + role
├── hooks/
│   └── useAuth.js
├── services/
│   └── apiClient.js        # shared axios instance (base URL + auth header)
├── utils/
│   └── constants.js
│
└── portals/
    ├── student/
    │   ├── README.md        # screen-by-screen checklist for this portal
    │   ├── pages/            # one file per screen
    │   ├── components/       # student-only components
    │   ├── hooks/            # student-only hooks
    │   ├── services/
    │   │   └── studentApi.js
    │   └── routes.jsx
    ├── teacher/               # same shape as student/
    └── admin/                 # same shape as student/
```

## Conventions

- **Styling:** Tailwind utility classes only — no CSS modules, no styled-
  components. Keep one-off custom CSS out of `index.css`; if something
  needs a reusable style, make it a component in `components/ui/`.
- **Shared vs. portal-local:** promote a component/hook to `src/components`
  or `src/hooks` only once a second portal actually needs it. Until then,
  keep it local to your portal.
- **Routing:** add new screens to your own `src/portals/<portal>/routes.jsx`.
  You shouldn't need to edit `src/routes/AppRoutes.jsx` — that file only
  changes when a whole new portal or top-level layout is added.
- **API calls:** put portal-specific requests in
  `src/portals/<portal>/services/<portal>Api.js`, built on top of the
  shared `src/services/apiClient.js`.
- **Auth/role state:** read the logged-in user via `useAuth()`; wrap any
  route that needs a login with `components/common/ProtectedRoute`.

## Regenerating page stubs

`scripts/generate-portal-scaffold.mjs` is the script that generated the
`portals/*/pages/*.jsx` stubs and each portal's `README.md` from the Jira
sprint import. It's safe to re-run (`node scripts/generate-portal-scaffold.mjs
"$(pwd)"`) — it will overwrite the stub files it manages, so don't put your
real screen implementation only inside a file this script would regenerate
without also committing your work first.
