// profiles.role values allowed to call admin Edge Functions (D5, D13).
// Kept free of imports so it can be unit-tested outside Deno.
export const ADMIN_ROLES = ["admin", "super_admin"] as const;

export function isAdminRole(role: unknown): boolean {
  return typeof role === "string" && (ADMIN_ROLES as readonly string[]).includes(role);
}
