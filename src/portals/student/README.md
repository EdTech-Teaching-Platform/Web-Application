# Student Portal — Frontend

Owner: **Student Dev** (per Jira import)

Everything for this portal lives under this folder. Please don't edit files
inside `src/portals/student`, `src/portals/teacher`, or `src/portals/admin`
unless it's the portal you own — shared UI belongs in `src/components`.

## Structure

- `pages/` — one file per screen/flow (mapped to Jira stories below)
- `components/` — components used only within this portal
- `hooks/` — hooks used only within this portal
- `services/` — API calls for this portal (`studentApi.js`)
- `routes.jsx` — this portal's routes, mounted once in `src/routes/AppRoutes.jsx`

## Screens (from Jira sprint import)

- **Day 2** — Onboarding  
  Doc ref: Sec 5.1, 6.1  
  File: `src/portals/student/pages/Onboarding.jsx`
- **Day 3** — Student Dashboard (home)  
  Doc ref: Sec 15  
  File: `src/portals/student/pages/Dashboard.jsx`
- **Day 4** — Public landing page  
  Doc ref: Sec 5.3  
  File: `src/portals/student/pages/Landing.jsx`
- **Day 4** — Search & category browsing  
  Doc ref: Sec 5.3  
  File: `src/portals/student/pages/SearchResults.jsx`
- **Day 5** — Educator public profile  
  Doc ref: Sec 5.3  
  File: `src/portals/student/pages/EducatorProfile.jsx`
- **Day 5** — Course details page  
  Doc ref: Sec 5.3  
  File: `src/portals/student/pages/CourseDetails.jsx`
- **Day 5** — Wishlist  
  Doc ref: Sec 5.3  
  File: `src/portals/student/pages/Wishlist.jsx`
- **Day 6** — Checkout & payment UI  
  Doc ref: Sec 5.10  
  File: `src/portals/student/pages/Checkout.jsx`
- **Day 6** — Payment success / failure  
  Doc ref: Sec 5.10  
  File: `src/portals/student/pages/PaymentResult.jsx`
- **Day 7** — Course player shell + video  
  Doc ref: Sec 5.5, 10.1  
  File: `src/portals/student/pages/CoursePlayer.jsx`
- **Day 7** — PDF / resource viewer  
  Doc ref: Sec 5.5, 10.1  
  File: `src/portals/student/pages/ResourceViewer.jsx`
- **Day 8** — Notes panel  
  Doc ref: Sec 5.5  
  File: `src/portals/student/pages/Notes.jsx`
- **Day 8** — Learning history  
  Doc ref: Sec 12  
  File: `src/portals/student/pages/LearningHistory.jsx`
- **Day 8** — Progress tracking UI  
  Doc ref: Sec 12  
  File: `src/portals/student/pages/ProgressTracking.jsx`
- **Day 9** — Book a session / availability  
  Doc ref: Sec 5.6  
  File: `src/portals/student/pages/BookSession.jsx`
- **Day 9** — Reschedule / cancel booking  
  Doc ref: Sec 5.6  
  File: `src/portals/student/pages/ManageBooking.jsx`
- **Day 10** — Join live class experience  
  Doc ref: Sec 5.7  
  File: `src/portals/student/pages/LiveClassJoin.jsx`
- **Day 11** — Post-session rating modal  
  Doc ref: Sec 5.7  
  File: `src/portals/student/pages/LiveClassRating.jsx`
- **Day 11** — Lecture recordings (view-only)  
  Doc ref: Sec 5.7  
  File: `src/portals/student/pages/Recordings.jsx`
- **Day 11** — Attendance display  
  Doc ref: Sec 5.7  
  File: `src/portals/student/pages/Attendance.jsx`
- **Day 12** — Quiz-taking UI  
  Doc ref: Sec 5.8, 11.1-11.2  
  File: `src/portals/student/pages/Quiz.jsx`
- **Day 12** — Assignment submission UI  
  Doc ref: Sec 5.8, 11.1-11.2  
  File: `src/portals/student/pages/AssignmentSubmit.jsx`
- **Day 13** — Certificate view/download  
  Doc ref: Sec 5.9, 5.10  
  File: `src/portals/student/pages/Certificates.jsx`
- **Day 13** — Orders / wallet / coupons / refunds  
  Doc ref: Sec 5.9, 5.10  
  File: `src/portals/student/pages/Orders.jsx`
- **Day 14** — Student to educator chat  
  Doc ref: Sec 5.12  
  File: `src/portals/student/pages/Messages.jsx`
- **Day 14** — Notification center & prefs  
  Doc ref: Sec 5.12  
  File: `src/portals/student/pages/Notifications.jsx`
- **Day 15** — Course reviews & ratings  
  Doc ref: Sec 5.9  
  File: `src/portals/student/pages/Reviews.jsx`

## Working here

1. Build your screen inside `pages/<Name>.jsx`.
2. If a screen needs its own small pieces, put them in `components/` here,
   not in the shared folder.
3. Wire real API calls in `services/studentApi.js` using the shared
   `src/services/apiClient.js` (axios instance with base URL + auth header
   already configured).
4. Add/adjust the route in `routes.jsx` — you do not need to touch any other
   portal's files or the root router.
