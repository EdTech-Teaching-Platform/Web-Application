export const EDUCATOR_STATUS_LABELS = Object.freeze({
  draft: "Not submitted",   // self-registered, still filling in the onboarding form
  pending: "Pending",
  approved: "Approved",
  changes_requested: "Changes requested",
  rejected: "Rejected",
  under_review: "Under review",
  verified: "Approved",
});

export function mapEducatorStatus(status) {
  return EDUCATOR_STATUS_LABELS[status] ?? status;
}
