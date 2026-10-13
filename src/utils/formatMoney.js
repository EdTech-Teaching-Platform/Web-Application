// Shared money formatting for every portal. INR (₹) is the platform default
// and uses Indian digit grouping (₹1,49,900). Other currencies keep their
// own symbol and standard grouping.

export const DEFAULT_CURRENCY = "INR";

const SYMBOLS = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

export function currencySymbolFor(code = DEFAULT_CURRENCY) {
  return SYMBOLS[code] ?? SYMBOLS[DEFAULT_CURRENCY];
}

function localeFor(code) {
  return code === "INR" || !SYMBOLS[code] ? "en-IN" : "en-US";
}

// Locale-grouped number, no symbol. Whole amounts show no decimals;
// fractional amounts show exactly 2 (max 2).
export function formatAmount(amount, currency = DEFAULT_CURRENCY) {
  const n = Math.abs(Number(amount) || 0);
  const rounded = Math.round(n * 100) / 100;
  const whole = Number.isInteger(rounded);
  return rounded.toLocaleString(localeFor(currency), {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
}

// Sign-less (callers add − / + themselves, as before): "₹1,49,900".
export function formatMoney(amount, currency = DEFAULT_CURRENCY) {
  return `${currencySymbolFor(currency)}${formatAmount(amount, currency)}`;
}

export function formatSigned(amount, currency = DEFAULT_CURRENCY) {
  const sign = amount < 0 ? "−" : "+";
  return `${sign}${formatMoney(amount, currency)}`;
}

function trim1(n) {
  return String(Math.round(n * 10) / 10);
}

// Compact notation for chart axes / tight spaces, no symbol.
// INR: ≥1e7 → "1.2Cr", ≥1e5 → "3.4L", ≥1e3 → "12k". Others: k / M.
export function formatCompactAmount(amount, currency = DEFAULT_CURRENCY) {
  const n = Math.abs(Number(amount) || 0);
  if (currency === "INR" || !SYMBOLS[currency]) {
    if (n >= 1e7) return `${trim1(n / 1e7)}Cr`;
    if (n >= 1e5) return `${trim1(n / 1e5)}L`;
    if (n >= 1e3) return `${trim1(n / 1e3)}k`;
    return String(Math.round(n));
  }
  if (n >= 1e6) return `${trim1(n / 1e6)}M`;
  if (n >= 1e3) return `${trim1(n / 1e3)}k`;
  return String(Math.round(n));
}

export function formatCompactMoney(amount, currency = DEFAULT_CURRENCY) {
  return `${currencySymbolFor(currency)}${formatCompactAmount(amount, currency)}`;
}
