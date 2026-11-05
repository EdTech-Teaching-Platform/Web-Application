// Test Series -> Approvals: series educators built on their own and
// submitted for review (list_pending_series_approvals). Approve publishes the
// series (approve_educator_series); Reject needs a reason the educator sees
// (reject_educator_series). Both notify the educator.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useRpc } from "../hooks/useRpc";
import { useRefetchOnChange } from "../../../services/dataSync";
import { testSeriesApi } from "../services/testSeriesApi";
import ConfirmModal from "../components/ConfirmModal";
import AssetImage from "../../../components/common/AssetImage";

const PAGE_SIZE = 10;
const formatDate = (value) => (value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

export default function SeriesApprovals({ api = testSeriesApi, onChanged, setToast }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const reasonRef = useRef(null);

  // Focus the reason box as soon as the Reject dialog opens (after the click that opened it settles).
  useEffect(() => {
    if (!rejectTarget) return undefined;
    const t = setTimeout(() => reasonRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [rejectTarget]);

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const request = useCallback(() => api.listPendingApprovals({ search: query, page, size: PAGE_SIZE }), [api, query, page]);
  const state = useRpc(request);
  useRefetchOnChange(state.refetch, "test-series");
  const rows = state.data?.rows || [];
  const total = Number(state.data?.total || 0);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const closeModals = () => { setApproveTarget(null); setRejectTarget(null); setReason(""); setActionError(""); };
  const act = async (fn, message) => {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      await fn();
      closeModals();
      setToast?.(message);
      state.refetch().catch(() => {});
      onChanged?.();
    } catch (error) {
      setActionError(error.message || "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ul-card ul-set-table-card">
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "14px 16px 0" }}>
        <label htmlFor="approvals-search" className="ul-card__eyebrow" style={{ margin: 0 }}>Waiting for approval ({total})</label>
        <input
          id="approvals-search"
          className="ul-tsw-input"
          type="search"
          placeholder="Search series, code or educator"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginLeft: "auto" }}
        />
      </div>

      {state.loading && <div className="ul-set-empty">Loading approvals…</div>}
      {state.error && (
        <div className="ul-set-empty" role="alert">
          <p>{state.error.message}</p>
          <button type="button" className="ul-btn ul-btn--ghost" onClick={() => state.refetch()}>Retry</button>
        </div>
      )}
      {!state.loading && !state.error && rows.length === 0 && (
        <div className="ul-set-empty">No series are waiting for approval{query ? " that match your search" : ""}.</div>
      )}

      {rows.length > 0 && (
        <div className="ul-set-table-scroll">
          <table className="ul-set-table" style={{ minWidth: 860 }}>
            <thead>
              <tr><th>Series</th><th>Educator</th><th>Tests</th><th>Questions</th><th>Submitted</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td data-label="Series">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {row.cover_path && <AssetImage path={row.cover_path} alt="" fallback={null} style={{ width: 64, height: 36, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />}
                      <div><strong>{row.title}</strong><div className="ul-tsw-hint">{row.code} · {row.subject_name || "No subject"}</div></div>
                    </div>
                  </td>
                  <td data-label="Educator">{row.educator_name || "—"}<div className="ul-tsw-hint">{row.educator_email}</div></td>
                  <td data-label="Tests">{row.test_count}</td>
                  <td data-label="Questions">{row.question_count}</td>
                  <td data-label="Submitted">{formatDate(row.submitted_at)}</td>
                  <td data-label="Actions">
                    <div className="ul-ts-actions-cell">
                      <button type="button" className="ul-btn ul-btn--ghost ul-set-btn-sm" onClick={() => navigate(`/admin/testseries/${row.id}`)}>Review</button>
                      <button type="button" className="ul-btn ul-btn--primary ul-set-btn-sm" onClick={() => setApproveTarget(row)}>Approve</button>
                      <button type="button" className="ul-btn ul-btn--danger ul-set-btn-sm" onClick={() => setRejectTarget(row)}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="ul-ts-pagination" style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: 12 }}>
          <button type="button" className="ul-btn ul-btn--ghost ul-set-btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="ul-tsw-hint">Page {page} of {pageCount}</span>
          <button type="button" className="ul-btn ul-btn--ghost ul-set-btn-sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      {/* Portaled to <body>: the card above has overflow:hidden and a hover
          transform, which trap/clip a position:fixed overlay inside it. */}
      {createPortal(
      <>
      <ConfirmModal
        open={!!approveTarget}
        title={`Approve "${approveTarget?.title || ""}"?`}
        description="It is published for students right away (or at its scheduled go-live), and the educator is notified."
        confirmLabel={busy ? "Approving…" : "Approve and publish"}
        confirmDisabled={busy}
        onCancel={closeModals}
        onConfirm={() => act(() => api.approveSeries(approveTarget.id), `"${approveTarget.title}" approved and published.`)}
      >
        {actionError && <p className="ul-tsw-note" role="alert">{actionError}</p>}
      </ConfirmModal>

      <ConfirmModal
        open={!!rejectTarget}
        tone="danger"
        title={`Reject "${rejectTarget?.title || ""}"?`}
        description="The educator sees your reason, can edit the series and submit it again."
        confirmLabel={busy ? "Rejecting…" : "Reject"}
        confirmDisabled={busy || !reason.trim()}
        onCancel={closeModals}
        onConfirm={() => act(() => api.rejectSeries(rejectTarget.id, reason.trim()), `"${rejectTarget.title}" rejected. The educator has been notified.`)}
      >
        <label htmlFor="reject-reason" style={{ display: "block", marginTop: 12, fontSize: 11.5, fontWeight: 700, color: "var(--color-text-muted, #6b7280)" }}>Reason (required)</label>
        <textarea
          id="reject-reason"
          className="ul-confirm-modal__reason"
          rows={3}
          maxLength={2000}
          ref={reasonRef}
          placeholder="Tell the educator what to fix…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          style={{ marginTop: 6, boxSizing: "border-box" }}
        />
        {actionError && <p className="ul-tsw-note" role="alert">{actionError}</p>}
      </ConfirmModal>
      </>,
      document.body)}
    </div>
  );
}
