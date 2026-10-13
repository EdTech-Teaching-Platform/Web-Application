// Which /teacher/* sections are currently reachable.
//
// The educator portal is in "Test Series-only" mode: most sections are
// commented out in routes.jsx / TeacherLayout.jsx (tagged TEMP-HIDDEN) and any
// URL for them redirects to Test Series. Header menus and notifications link
// to real screens, so they consult this list to avoid sending someone into
// that redirect: an unavailable target is shown disabled / not navigated.
//
// RESTORING a section later: delete its prefix from HIDDEN_PREFIXES (the same
// time you uncomment its TEMP-HIDDEN route) and every menu item and
// notification that points at it starts working again with no other change.
export const HIDDEN_PREFIXES = [
  "/teacher/dashboard",
  "/teacher/mycourses",
  "/teacher/coursebuilder",
  "/teacher/contentupload",
  "/teacher/coursepreview",
  "/teacher/publishflow",
  "/teacher/coursemanagement",
  "/teacher/reviews",
  "/teacher/reviewsavailability",
  "/teacher/liveclasses",
  "/teacher/studentmanagement",
  "/teacher/mentorshiphub",
  "/teacher/requests",
  "/teacher/messaging",
  "/teacher/earnings",
  "/teacher/analytics",
  "/teacher/grading",
  "/teacher/bookingmanage",
];

export function isPortalPathAvailable(to) {
  if (!to) return false;
  const path = String(to).split(/[?#]/)[0];
  return !HIDDEN_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}
