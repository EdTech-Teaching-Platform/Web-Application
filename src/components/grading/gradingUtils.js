// Helpers for the marking screens (GradingQueue, GradingWorkspace).

export function formatWhen(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Why a mark can't be saved (0..max), or null; "" means not marked yet.
export function markProblem(value, max) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return "Enter a number.";
  if (n < 0 || n > Number(max)) return `Between 0 and ${max}.`;
  return null;
}
