// profiles.role values that count as admin roles (D5, D13). NOT an
// authorization check: users can edit their own profiles.role. Edge Functions
// authorize with requireAdmin() in auth.ts (the adm_is_platform_admin RPC).
// Kept free of imports so it can be unit-tested outside Deno.
export const ADMIN_ROLES = ["admin", "super_admin"] as const;

export function isAdminRole(role: unknown): boolean {
  return typeof role === "string" && (ADMIN_ROLES as readonly string[]).includes(role);
}
