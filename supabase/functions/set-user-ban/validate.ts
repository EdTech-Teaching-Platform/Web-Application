// Validators and the decision for set-user-ban. No imports, so they can be
// unit-tested outside Deno (tests/student-block.test.jsx).

export const BAN_DURATION = "876000h";   // ~100 years: until an admin lifts it
export const UNBAN_DURATION = "none";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class BanRequestError extends Error {
  status: number;
  field?: string;
  constructor(message: string, status = 400, field?: string) {
    super(message);
    this.name = "BanRequestError";
    this.status = status;
    this.field = field;
  }
}

export interface BanRequest { userId: string; ban: boolean; reason: string | null }

// Body: { userId: uuid, ban: boolean, reason?: string }
export function validateBanRequest(body: unknown): BanRequest {
  if (!body || typeof body !== "object") throw new BanRequestError("Send a JSON body.", 400, "body");
  const b = body as Record<string, unknown>;
  const userId = String(b.userId ?? "").trim().toLowerCase();
  if (!UUID.test(userId)) throw new BanRequestError("userId must be a user id.", 400, "userId");
  if (typeof b.ban !== "boolean") throw new BanRequestError("ban must be true or false.", 400, "ban");
  const reason = b.reason == null ? null : String(b.reason).trim().slice(0, 500) || null;
  return { userId, ban: b.ban, reason };
}

// target: adm_user_ban_check(uuid) -> {exists, role, is_self, is_admin, blocked}
// Ban only a non-admin, non-self user who is already blocked in SQL (the
// admin block action ran first); lift a ban only once the SQL block is gone.
export function decideBan(req: BanRequest, target: { exists?: boolean; is_self?: boolean; is_admin?: boolean; blocked?: boolean } | null) {
  if (!target?.exists) throw new BanRequestError("User not found.", 404);
  if (req.ban && target.is_self) throw new BanRequestError("You can't ban your own account.", 400);
  if (req.ban && target.is_admin) throw new BanRequestError("Admin accounts are never banned.", 403);
  if (req.ban && !target.blocked) throw new BanRequestError("Block the account first; the ban follows the block.", 409);
  if (!req.ban && target.blocked) throw new BanRequestError("Unblock the account first; the ban is lifted after the unblock.", 409);
  return { ban_duration: req.ban ? BAN_DURATION : UNBAN_DURATION };
}
