// Display helpers for the test-series screens.

export function formatPercent(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "–";
  return `${Number(value).toFixed(digits).replace(/\.0+$/, "")}%`;
}

export function formatScore(score, max) {
  if (score === null || score === undefined) return "–";
  const fmt = (n) => String(Math.round(Number(n) * 100) / 100);
  return max === null || max === undefined ? fmt(score) : `${fmt(score)} / ${fmt(max)}`;
}

// 75 -> "1h 15m", 30 -> "30 min", null -> "Untimed"
export function formatMinutes(mins) {
  const m = Number(mins) || 0;
  if (m <= 0) return "Untimed";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`;
}

// 3725 -> "1h 2m 5s", 65 -> "1m 5s"
export function formatSeconds(secs) {
  const s = Math.max(0, Math.round(Number(secs) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h}h ${m}m${r ? ` ${r}s` : ""}`;
  if (m) return `${m}m${r ? ` ${r}s` : ""}`;
  return `${r}s`;
}

// Countdown display: 3725 -> "1:02:05", 65 -> "01:05"
export function formatClock(secs) {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDate(value, withTime = false) {
  if (!value) return "–";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleString("en-IN", withTime
    ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", year: "numeric" });
}

export function priceLabel(series) {
  if (!series) return "";
  return series.is_free || Number(series.price_inr) === 0 ? "Free" : `₹${Number(series.price_inr)}`;
}

export const ATTEMPT_STATUS = {
  in_progress: { label: "In progress", tone: "warning" },
  submitted: { label: "Submitted", tone: "success" },
  timed_out: { label: "Timed out", tone: "danger" },
  abandoned: { label: "Abandoned", tone: "neutral" },
};

export function attemptStatus(item) {
  if (item?.status === "in_progress" && item?.is_expired) return { label: "Time over", tone: "danger" };
  return ATTEMPT_STATUS[item?.status] ?? { label: item?.status ?? "–", tone: "neutral" };
}
