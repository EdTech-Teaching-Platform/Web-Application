// Dates in the educator portal (en-IN).
export const formatDate = (value, withTime = false) => (value
  ? new Date(value).toLocaleString("en-IN", withTime
    ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" })
  : "—");
