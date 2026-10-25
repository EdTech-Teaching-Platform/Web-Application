// profiles.role values that may use the admin portal (D5, D13). Both map to
// the app role "admin"; the original value is kept on the user as dbRole.
export const ADMIN_DB_ROLES = Object.freeze(["admin", "super_admin"]);

export const DB_TO_APP_ROLE = Object.freeze({
  admin: "admin",
  super_admin: "admin",
  educator: "teacher",
  student: "student",
  regional_head: "regionalhead",
});

export function mapDbRole(role) {
  return DB_TO_APP_ROLE[role] ?? null;
}

export function isAdminDbRole(role) {
  return ADMIN_DB_ROLES.includes(role);
}

// Admin portal access: the mapped app role, or (defensively) the raw db role.
export function canUseAdminPortal(user) {
  return Boolean(user) && (user.role === "admin" || isAdminDbRole(user.dbRole));
}

// Where a signed-in user lands after login (routing only; the server decides access).
export function homePathForUser(user) {
  if (!user) return "/login";
  if (canUseAdminPortal(user)) return "/admin/logindashboard";   // /admin has no index route
  if (user.role === "teacher") return "/teacher/dashboard";
  if (user.role === "regionalhead") return "/regionalhead";
  return "/student/dashboard";
}
