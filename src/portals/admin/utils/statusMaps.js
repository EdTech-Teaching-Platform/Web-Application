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

// ---------------------------------------------------------------------------
// Educator actions (QA triage P3). The server decides which ones apply:
// list_educators / get_educator_detail return `actions` from
// adm_educator_actions (the one matrix, 20261104090000), and
// adm_set_educator_state refuses anything else. The UI only labels them.
export const EDUCATOR_ACTIONS = Object.freeze({
  approve: { label: "Approve", kind: "review", confirm: "approve", done: "Educator approved." },
  request_changes: { label: "Request changes", kind: "review", confirm: "request_info", done: "Changes requested. The educator has been notified." },
  reject: { label: "Reject", kind: "review", danger: true, confirm: "reject", done: "Application rejected. The account is now inactive." },
  reconsider: { label: "Review and reconsider", kind: "review", confirm: "reconsider", done: "The application is under review again." },
  deactivate: { label: "Deactivate", kind: "account", confirm: "deactivate", done: "Educator deactivated." },
  activate: { label: "Activate", kind: "account", confirm: "activate", done: "Educator activated." },
  suspend: { label: "Suspend", kind: "account", danger: true, confirm: "suspend", done: "Educator suspended." },
  reactivate: { label: "Reactivate", kind: "account", confirm: "reactivate", done: "Educator reactivated." },
  delete: { label: "Delete", kind: "delete", danger: true, confirm: "delete", done: "Educator deleted." },
});

// The actions to show, in matrix order (unknown / internal ones such as start_review are skipped).
export function educatorActions(educator, kinds) {
  return (educator?.actions || []).filter((a) => EDUCATOR_ACTIONS[a] && (!kinds || kinds.includes(EDUCATOR_ACTIONS[a].kind)));
}

const ACCOUNT_BADGE = Object.freeze({
  active: { label: "Account: Active", badge: "is-account-active" },
  inactive: { label: "Account: Inactive", badge: "is-account-inactive" },
  suspended: { label: "Account: Suspended", badge: "is-account-suspended" },
});

// ONE primary badge (the effective state) and, only for an approved
// educator, a secondary account badge. Never "Active" next to "Rejected".
//   verificationStatus: the UI review key (verified, rejected, pending, …)
export function educatorDisplay({ verificationStatus, accountStatus }) {
  const account = accountStatus || "active";
  const approved = verificationStatus === "verified";
  let primary;
  if (account === "deleted") primary = { key: "deleted", label: "Deleted", badge: "is-rejected" };
  else if (account === "suspended") primary = { key: "suspended", label: "Suspended", badge: "is-rejected" };
  else if (approved && account === "inactive") primary = { key: "inactive", label: "Deactivated", badge: "is-pending" };
  else primary = { key: verificationStatus, label: mapEducatorStatus(verificationStatus), badge: educatorStatusBadge(verificationStatus) };
  return { primary, account: approved && ACCOUNT_BADGE[account] ? { key: account, ...ACCOUNT_BADGE[account] } : null };
}
