export const DB_TO_APP_ROLE = Object.freeze({
  admin: "admin",
  educator: "teacher",
  student: "student",
  regional_head: "regionalhead",
});

export function mapDbRole(role) {
  return DB_TO_APP_ROLE[role] ?? null;
}
