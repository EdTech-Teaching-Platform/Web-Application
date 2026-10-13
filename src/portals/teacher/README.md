# Teacher (Educator) Portal — Frontend

Owner: **Teacher (Educator) Dev** (per Jira import)

Everything for this portal lives under this folder. Please don't edit files
inside `src/portals/student`, `src/portals/teacher`, or `src/portals/admin`
unless it's the portal you own — shared UI belongs in `src/components`.

## Structure

- `pages/` — one file per screen/flow (mapped to Jira stories below)
- `components/` — components used only within this portal
- `hooks/` — hooks used only within this portal
- `services/` — API calls for this portal (`teacherApi.js`)
- `routes.jsx` — this portal's routes, mounted once in `src/routes/AppRoutes.jsx`

## Screens (from Jira sprint import)

- **Day 1 + Day 2 (merged)** — Unified educator registration (account + profile + verification docs, one upfront flow)  
  Doc ref: Sec 5.1  
  File: `src/portals/teacher/pages/Registration.jsx` (field lists/options in `data/educatorRegistrationData.js`)  
  Educators log in immediately after registering; the portal shell shows with content locked until an admin approves
  (`status` on the educator record in `data/educatorAccountStore.js`: pending / approved / changes_requested / rejected;
  lock + banner applied once in `src/layouts/TeacherLayout.jsx`, admin review in `admin/pages/EducatorVerification.jsx`).
- **Digital ID Card** (formerly "Profile setup")  
  Doc ref: Sec 5.1  
  File: `src/portals/teacher/pages/ProfileSetup.jsx` — provisional "Pending Verification" card until approved, then Verified
- **Day 3** — Educator dashboard (home)  
  Doc ref: Sec 15  
  File: `src/portals/teacher/pages/Dashboard.jsx`
- **Day 4** — Course builder + curriculum structure  
  Doc ref: Sec 5.4, 9  
  File: `src/portals/teacher/pages/CourseBuilder.jsx`
- **Day 5** — Content upload UI + course preview  
  Doc ref: Sec 5.4, 11.1  
  File: `src/portals/teacher/pages/ContentUpload.jsx`
- **Day 6** — Pricing + publish flow + lifecycle states  
  Doc ref: Sec 5.4  
  File: `src/portals/teacher/pages/PublishFlow.jsx`
- **Day 7** — My courses list + management overview  
  Doc ref: Sec 5.4  
  File: `src/portals/teacher/pages/MyCourses.jsx`
- **Day 8** — Reviews (read) + availability calendar  
  Doc ref: Sec 5.4, 5.6  
  File: `src/portals/teacher/pages/ReviewsAvailability.jsx`
- **Day 9** — Scheduled call booking + reschedule/cancel  
  Doc ref: Sec 5.6  
  File: `src/portals/teacher/pages/BookingManage.jsx`
- **Day 10-11** — Schedule live class (video calling and recording are handled by an external meeting provider; Join opens the meeting link)  
  Doc ref: Sec 5.7  
  File: `src/portals/teacher/pages/LiveClasses.jsx`
- **Day 12** — Grading UI + homework/marksheet upload  
  Doc ref: Sec 5.8  
  File: `src/portals/teacher/pages/Grading.jsx`
- **Day 13** — Earnings ledger, revenue, payout request  
  Doc ref: Sec 5.11  
  File: `src/portals/teacher/pages/Earnings.jsx`
- **Day 14** — Chat + announcements + broadcast  
  Doc ref: Sec 5.12  
  File: `src/portals/teacher/pages/Messaging.jsx`
- **Day 15** — Notification prefs  
  Doc ref: Sec 5.12  
  File: `src/portals/teacher/pages/NotificationPrefs.jsx`

## Working here

1. Build your screen inside `pages/<Name>.jsx`.
2. If a screen needs its own small pieces, put them in `components/` here,
   not in the shared folder.
3. Wire real API calls in `services/teacherApi.js` using the shared
   `src/services/apiClient.js` (axios instance with base URL + auth header
   already configured).
4. Add/adjust the route in `routes.jsx` — you do not need to touch any other
   portal's files or the root router.
