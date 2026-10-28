import { useState } from "react";
import { testSeriesApi } from "../services/testSeriesApi";
import { isLockedForReview, needsApproval } from "../context/authoringPortal";

// Approval state of an educator's own series, on the shared manage screens
// (TestSeriesDetail, TestDetail).
//   educator: "waiting for approval" (read-only), the admin's rejection reason,
//             and "Submit for approval" for a draft / rejected series;
//   admin:    a pointer to the Approvals tab for a series waiting for review.
export default function SeriesReviewBanner({ portal, series, onSubmitted, setToast }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!series) return null;

  if (portal.kind === "admin") {
    if (series.status !== "pending_approval") return null;
    return (
      <div className="ul-tsw-note" role="status" style={{ marginBottom: 14 }}>
        An educator submitted this series for approval. Approve or reject it from <strong>Test Series → Approvals</strong>.
      </div>
    );
  }

  if (isLockedForReview(portal, series)) {
    return (
      <div className="ul-tsw-note" role="status" style={{ marginBottom: 14 }}>
        <strong>Waiting for admin approval.</strong> You can read this series but not change it until the review is done.
      </div>
    );
  }
  if (!needsApproval(portal, series) || !["draft", "rejected"].includes(series.status)) return null;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await testSeriesApi.submitForApproval(series.id);
      setToast?.("Submitted for approval. An admin will review it before it goes live.");
      onSubmitted?.();
    } catch (err) {
      setError(err.message || "We couldn't submit this series.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ul-tsw-note" style={{ marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ flex: "1 1 280px" }}>
        {series.status === "rejected" ? (
          <><strong>Not approved.</strong> {series.rejection_reason ? `Reason: ${series.rejection_reason}` : ""} Edit the series, then submit it again.</>
        ) : (
          <>Your series goes live after an admin approves it. Submit it when every test is ready.</>
        )}
        {error && <span role="alert" style={{ display: "block", marginTop: 6, color: "#8a1f1f" }}>{error}</span>}
      </span>
      <button type="button" className="ul-btn ul-btn--primary" onClick={submit} disabled={busy} aria-busy={busy}>
        {busy ? "Submitting…" : series.status === "rejected" ? "Resubmit for approval" : "Submit for approval"}
      </button>
    </div>
  );
}
