# Admin Portal — Frontend

Owner: **Admin Dev** (per Jira import)

Everything for this portal lives under this folder. Please don't edit files
inside `src/portals/student`, `src/portals/teacher`, or `src/portals/admin`
unless it's the portal you own — shared UI belongs in `src/components`.

## Structure

- `pages/` — one file per screen/flow (mapped to Jira stories below)
- `components/` — components used only within this portal
- `hooks/` — hooks used only within this portal
- `services/` — API calls for this portal (`adminApi.js`)
- `routes.jsx` — this portal's routes, mounted once in `src/routes/AppRoutes.jsx`

## Screens (from Jira sprint import)

- **Day 1** — Admin login (MFA) + dashboard  
  File: `src/portals/admin/pages/LoginDashboard.jsx`
- **Day 2** — Educator management & verification queue  
  File: `src/portals/admin/pages/EducatorVerification.jsx`
- **Day 3** — Course management & approval queue  
  File: `src/portals/admin/pages/CourseApproval.jsx`
- **Day 4** — User management & student details  
  File: `src/portals/admin/pages/UserManagement.jsx`
- **Day 5** — Institution management + details view  
  File: `src/portals/admin/pages/InstitutionManagement.jsx`
- **Day 6** — Region/branch hierarchy + staff assignment  
  File: `src/portals/admin/pages/RegionBranchHierarchy.jsx`
- **Day 7** — Head Teacher/Regional Head dashboards  
  File: `src/portals/admin/pages/ManagementDashboards.jsx`
- **Day 8** — Payment/revenue oversight + commission & refunds  
  File: `src/portals/admin/pages/PaymentOversight.jsx`
- **Day 9** — Detailed financial analytics  
  File: `src/portals/admin/pages/FinancialAnalytics.jsx`
- **Day 10** — Reports & analytics + custom report builder  
  File: `src/portals/admin/pages/ReportsBuilder.jsx`
- **Day 11** — Content moderation + CMS  
  File: `src/portals/admin/pages/ContentModeration.jsx`
- **Day 12** — Notifications management + audit logs  
  File: `src/portals/admin/pages/AuditLogs.jsx`
- **Day 13** — Settings & permissions + certificate mgmt  
  File: `src/portals/admin/pages/SettingsPermissions.jsx`
- **Day 14** — Regional growth analytics + compliance reports  
  File: `src/portals/admin/pages/RegionalAnalytics.jsx`
- **Day 15** — Help desk / support tickets + callback requests  
  File: `src/portals/admin/pages/SupportTickets.jsx`

## Working here

1. Build your screen inside `pages/<Name>.jsx`.
2. If a screen needs its own small pieces, put them in `components/` here,
   not in the shared folder.
3. Wire real API calls in `services/adminApi.js` using the shared
   `src/services/apiClient.js` (axios instance with base URL + auth header
   already configured).
4. Add/adjust the route in `routes.jsx` — you do not need to touch any other
   portal's files or the root router.
