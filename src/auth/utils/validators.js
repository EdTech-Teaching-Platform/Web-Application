// Shared validation/formatting helpers for the auth screens.
// Every field here follows the LMS doc Sec 5.1 rule: identifier can be
// email OR phone, accepted in the same single field.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;

export function isEmail(value = "") {
  return EMAIL_RE.test(value.trim());
}

export function isPhone(value = "") {
  return PHONE_RE.test(value.trim().replace(/[\s-()]/g, ""));
}

export function isEmailOrPhone(value = "") {
  return isEmail(value) || isPhone(value);
}

// "email" | "phone" | null — used to decide OTP delivery channel and to
// mask the destination on the Verify screen (Section 6, open question 4:
// assumed to switch on input type since the doc doesn't say explicitly).
export function identifierKind(value = "") {
  if (isEmail(value)) return "email";
  if (isPhone(value)) return "phone";
  return null;
}

// Registration/Reset password rule: min 8 chars, at least 1 letter + 1 number.
export function isStrongPassword(value = "") {
  return value.length >= 8 && /[A-Za-z]/.test(value) && /[0-9]/.test(value);
}

export function maskDestination(value = "") {
  const kind = identifierKind(value);
  if (kind === "email") {
    const [user, domain] = value.split("@");
    const visible = user.slice(0, 1);
    return `${visible}${"•".repeat(Math.max(user.length - 1, 3))}@${domain}`;
  }
  if (kind === "phone") {
    const digits = value.replace(/\D/g, "");
    return `+•• •••• ${digits.slice(-4)}`;
  }
  return value;
}
