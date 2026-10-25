// Shared validation/formatting helpers for the auth screens.
// Sign-in is email + password (Supabase Auth). isPhone / isEmailOrPhone stay
// for the teacher registration and student profile forms.

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

export function identifierKind(value = "") {
  if (isEmail(value)) return "email";
  if (isPhone(value)) return "phone";
  return null;
}

// Password rule for sign up and reset: min 8 chars, at least 1 letter + 1 number.
export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { id: "letter", label: "A letter", test: (v) => /[A-Za-z]/.test(v) },
  { id: "number", label: "A number", test: (v) => /[0-9]/.test(v) },
];

// [{id, label, ok}] for the live checklist under password fields.
export function passwordChecks(value = "") {
  return PASSWORD_RULES.map((rule) => ({ id: rule.id, label: rule.label, ok: rule.test(value) }));
}

export function isStrongPassword(value = "") {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

// "weak" | "fair" | "strong": fair meets the rule; strong is also 12+ chars
// with mixed case or a symbol.
export function passwordStrength(value = "") {
  if (!isStrongPassword(value)) return "weak";
  const extra = value.length >= 12 && (/[a-z]/.test(value) && /[A-Z]/.test(value) || /[^A-Za-z0-9]/.test(value));
  return extra ? "strong" : "fair";
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

// Only same-site paths ("/student/x"), never "//evil.com" or "\\evil".
export function safeRedirect(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "";
}
