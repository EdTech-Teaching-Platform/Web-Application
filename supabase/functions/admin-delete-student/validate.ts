// Validators for admin-delete-student. No imports, so they can be unit-tested
// outside Deno (tests/qa-nov28.test.jsx).

export const CONFIRM_WORD = "DELETE";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AdminDeleteError extends Error {
  status: number;
  field?: string;
  constructor(message: string, status = 400, field?: string) {
    super(message);
    this.name = "AdminDeleteError";
    this.status = status;
    this.field = field;
  }
}

export interface AdminDeleteRequest { userId: string; reason: string | null }

// Body: { userId: uuid, confirm: "DELETE", reason?: string }
export function validateAdminDeleteRequest(body: unknown): AdminDeleteRequest {
  if (!body || typeof body !== "object") throw new AdminDeleteError("Send a JSON body.", 400, "body");
  const b = body as Record<string, unknown>;
  const userId = String(b.userId ?? "").trim().toLowerCase();
  if (!UUID.test(userId)) throw new AdminDeleteError("userId must be a user id.", 400, "userId");
  if (String(b.confirm ?? "").trim().toUpperCase() !== CONFIRM_WORD) {
    throw new AdminDeleteError(`Type ${CONFIRM_WORD} to confirm.`, 400, "confirm");
  }
  const reason = b.reason == null ? null : String(b.reason).trim().slice(0, 1000) || null;
  return { userId, reason };
}

// SQLSTATE from adm_account_delete_by_admin -> HTTP status.
export function statusForCode(code: string | undefined): number {
  if (code === "42501") return 403;
  if (code === "P0002") return 404;
  if (code === "22023") return 400;
  return 500;
}
