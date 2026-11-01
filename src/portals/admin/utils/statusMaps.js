// Educator status vocabulary: the ONE place the admin UI maps the database's
// educator states (adm_educator_effective_state, 20261029100000) to its own
// keys, labels, badges and decision values.
//
//   DB state            UI key              label
//   draft               draft               Not submitted
//   pending             pending             Pending review
//   under_review        under_review        Under review
//   changes_requested   changes_requested   Changes requested
//   approved            verified            Approved   (UI screens compare with "verified")
//   rejected            rejected            Rejected
//   suspended           suspended           Suspended
export const EDUCATOR_DB_STATES = Object.freeze([
  "draft", "pending", "under_review", "changes_requested", "approved", "rejected", "suspended",
]);

const DB_TO_UI = Object.freeze({ approved: "verified" });
const UI_TO_DB = Object.freeze({ verified: "approved" });

export const EDUCATOR_STATUS_LABELS = Object.freeze({
  draft: "Not submitted",   // self-registered, still filling in the onboarding form
  pending: "Pending review",
  under_review: "Under review",
  changes_requested: "Changes requested",
  verified: "Approved",
  approved: "Approved",     // the DB value, if one reaches a label unmapped
  rejected: "Rejected",
  suspended: "Suspended",
});

export const EDUCATOR_STATUS_BADGE = Object.freeze({
  draft: "is-pending", pending: "is-pending", under_review: "is-pending", changes_requested: "is-pending",
  verified: "is-verified", approved: "is-verified", rejected: "is-rejected", suspended: "is-rejected",
});

// Admin decisions -> the value set_educator_verification expects.
export const EDUCATOR_DECISION = Object.freeze({
  approve: "approved",
  reject: "rejected",
  request_changes: "changes_requested",
  start_review: "under_review",
  reset: "pending",
});

// The Educators list's status filter (UI key -> list_educators p_verification).
export const EDUCATOR_STATUS_FILTERS = Object.freeze([
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending review" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "verified", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "draft", label: "Not submitted" },
  { value: "suspended", label: "Suspended" },
]);

export function toUiEducatorStatus(dbState) {
  return DB_TO_UI[dbState] ?? dbState ?? null;
}

export function toDbEducatorStatus(uiKey) {
  return UI_TO_DB[uiKey] ?? uiKey ?? null;
}

export function mapEducatorStatus(status) {
  return EDUCATOR_STATUS_LABELS[status] ?? status;
}

export function educatorStatusBadge(status) {
  return EDUCATOR_STATUS_BADGE[status] ?? "is-pending";
}
