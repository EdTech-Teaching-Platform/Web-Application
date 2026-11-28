// Validators for delete-account. No imports, so they can be unit-tested
// outside Deno (tests/qa-nov18.test.jsx).

export const CONFIRM_WORD = "DELETE";
export const BAN_DURATION = "876000h";   // fallback when the Auth delete fails

export class DeleteRequestError extends Error {
  status: number;
  field?: string;
  constructor(message: string, status = 400, field?: string) {
    super(message);
    this.name = "DeleteRequestError";
    this.status = status;
    this.field = field;
  }
}

export interface DeleteRequest { password: string | null; reason: string | null }

// Body: { confirm: "DELETE", password?: string, reason?: string }
export function validateDeleteRequest(body: unknown): DeleteRequest {
  if (!body || typeof body !== "object") throw new DeleteRequestError("Send a JSON body.", 400, "body");
  const b = body as Record<string, unknown>;
  if (String(b.confirm ?? "").trim().toUpperCase() !== CONFIRM_WORD) {
    throw new DeleteRequestError(`Type ${CONFIRM_WORD} to confirm.`, 400, "confirm");
  }
  const password = typeof b.password === "string" && b.password.length > 0 ? b.password.slice(0, 200) : null;
  const reason = b.reason == null ? null : String(b.reason).trim().slice(0, 1000) || null;
  return { password, reason };
}

// The account signs in with a password (an "email" identity): deleting it
// needs that password. Google-only accounts confirm with DELETE alone.
export function hasPasswordIdentity(user: { identities?: { provider?: string }[] | null; app_metadata?: { providers?: string[]; provider?: string } } | null) {
  const identities = user?.identities || [];
  const providers = user?.app_metadata?.providers || [];
  return identities.some((i) => i?.provider === "email") || providers.includes("email") || user?.app_metadata?.provider === "email";
}

// The address a deleted account keeps in Supabase Auth, so the real email is free
// to sign up again (QA 22 Nov). .invalid never receives mail (RFC 2606).
export function tombstoneEmail(userId: string): string {
  return `deleted+${String(userId).toLowerCase()}@deleted.invalid`;
}
