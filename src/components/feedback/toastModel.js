// Shared toast model (no React): tones, their colours (mirrors
// src/styles/feedback.css), WCAG contrast, and turning whatever a page passes
// (a string, an Error, a Supabase error object, {message, tone}) into a
// readable message, never "" or "[object Object]".

export const TOAST_TONES = {
  success: { bg: "#166534", fg: "#ffffff" },
  error: { bg: "#b42318", fg: "#ffffff" },
  warning: { bg: "#fef0c7", fg: "#7a2e0e" },
  info: { bg: "#1f2937", fg: "#ffffff" },
};

export const FALLBACK_ERROR = "Something went wrong. Please try again.";

// Errors stay up longer: they usually need reading.
export const TOAST_DURATION = { success: 4500, info: 4500, warning: 7000, error: 8000 };

function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
export function luminance(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const isErrorLike = (v) =>
  v instanceof Error || (v && typeof v === "object" && ("code" in v || "status" in v || "error" in v || "error_description" in v || "details" in v));

// A readable message from anything a page hands the toast.
export function toMessage(value) {
  if (value == null || value === false) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const candidates = [value.message, value.error_description, typeof value.error === "string" ? value.error : value.error?.message, value.details, value.msg];
    const text = candidates.find((c) => typeof c === "string" && c.trim() && c.trim() !== "[object Object]");
    if (text) return text.trim();
    return isErrorLike(value) ? FALLBACK_ERROR : "";
  }
  return "";
}

// {message, tone} for a toast. An Error / error object is an error toast even
// when its message is empty (it then reads FALLBACK_ERROR).
export function normalizeToast(value, tone) {
  if (value && typeof value === "object" && !(value instanceof Error) && "tone" in value) {
    return { message: toMessage(value.message ?? value.text), tone: TOAST_TONES[value.tone] ? value.tone : tone || "info" };
  }
  const message = toMessage(value);
  const resolved = TOAST_TONES[tone] ? tone : isErrorLike(value) ? "error" : "info";
  return { message: message || (resolved === "error" && value ? FALLBACK_ERROR : ""), tone: resolved };
}
