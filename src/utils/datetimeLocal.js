// <input type="datetime-local"> speaks "YYYY-MM-DDTHH:mm" in the browser's
// local time; the database returns timestamptz as ISO with an offset
// ("2026-11-08T04:30:00+00:00"), which the input can't show (it went blank,
// so an edit looked unsaved: QA #18).

const pad = (n) => String(n).padStart(2, "0");

// ISO / timestamptz -> "YYYY-MM-DDTHH:mm" (local); "" when empty or invalid.
export function toDateTimeLocal(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "YYYY-MM-DDTHH:mm" (local) -> ISO in UTC, so the server stores the moment
// the user picked; "" stays "" (clears the schedule).
export function fromDateTimeLocal(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}
