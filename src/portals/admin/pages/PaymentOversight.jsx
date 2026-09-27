// Payment / Revenue Oversight + Commission & Refund Management
// Jira: Day 8 — Payment/revenue oversight + commission & refunds
// Payment/revenue overview, transaction details, commission tracking,
// and refund management, all within Admin permissions. Logging a refund request
// (e.g. from a support ticket) and approving/rejecting/changing the
// commission rate are all normal Admin actions — there's a single Admin
// role, so nothing here is permission-gated.
//
// The transaction ledger below is NOT invented mock data — it's built by
// flattening the SAME per-educator payout history every educator already
// has (educatorsMock.js's payments.history, the exact records
// EducatorProfile.jsx's "Payments" tab renders) into one platform-wide
// view. Only the refund *requests* are new (see paymentsMock.js header
// for why), seeded against real ledger transactions.
//
// Chrome (sidebar/topbar) comes from src/layouts/AdminLayout.jsx. This
// page reuses the shared .ul-card / .ul-stats / .ul-bento / .ul-btn /
// .ul-status-badge / .ul-avatar-chip / .ul-edu-table / .ul-edu-toolbar /
// .ul-approval-list / .ul-checklist / .ul-confirm-backdrop primitives
// already established by AdminDashboard.jsx, EducatorVerification.jsx,
// CourseApproval.jsx and ConfirmModal.jsx, plus the scope-note/detail-modal
// primitives ManagementDashboards.css already added (.ul-mgmt-scope-note,
// .ul-mgmt-detail-stats/-list, .ul-mgmt-empty, .ul-mgmt-type-tag) — reused
// here rather than duplicated. Layout specific to this screen lives in
// PaymentOversight.css.
//
// Also adds: a Recent Transactions glance card (reuses the same
// .ul-mgmt-activity-list markup ManagementDashboards' Recent Activity
// uses), a Refund History table split out from the actionable Refund
// Management queue (pending-only there now), and a real client-side CSV
// export ("Export Report") built from the same in-memory ledger/refund
// data the page already renders — not a mock download.

import { useEffect, useMemo, useState } from "react";
import {
  useTransactions,
  useRefundRequests,
  createRefundRequest,
  approveRefund,
  rejectRefund,
  getRevenueOverview,
  getMethodBreakdown,
  getCommissionByEducator,
  TRANSACTION_STATUS,
  TRANSACTION_STATUS_LABEL,
  TRANSACTION_STATUS_BADGE_CLASS,
  REFUND_STATUS,
  REFUND_STATUS_LABEL,
  REFUND_STATUS_BADGE_CLASS,
  REFUND_REASON_OPTIONS,
  REQUEST_FOR_LABEL,
} from "../data/paymentsMock";
import { revenueTrend } from "../data/dashboardMock";
import ConfirmModal from "../components/ConfirmModal";
import { IconWallet, IconSearch, IconClose, IconLock, IconCheck, IconDownload, IconHistory, IconGraduationCap } from "../components/icons";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./UserManagement.css";
import "../components/ConfirmModal.css";
import "./ManagementDashboards.css";
import "./PaymentOversight.css";

const PAGE_SIZE = 8;
const METHOD_COLORS = {
  "Bank Transfer": "var(--color-primary)",
  UPI: "var(--color-financial-cyan)",
  PayPal: "var(--color-analytics-orange)",
  "Wire Transfer": "var(--color-regional-purple)",
};

function money(n) {
  return `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function RequesterTag({ request }) {
  return (
    <span className="ul-pay-requester-tag">
      <span className="ul-pay-requester-tag__role">Student</span>
      {request.requestFor && (
        <span className="ul-pay-requester-tag__for">{REQUEST_FOR_LABEL[request.requestFor]}</span>
      )}
    </span>
  );
}

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRow(cells) {
  return cells.map(csvCell).join(",");
}
function downloadCSV(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function LineChart({ data, valueKeyA, valueKeyB, colorA, colorB }) {
  const width = 260;
  const height = 92;
  const max = Math.max(...data.map((d) => Math.max(d[valueKeyA], d[valueKeyB ?? valueKeyA]))) || 1;
  const stepX = width / (data.length - 1);
  const toPoints = (key) => data.map((d, i) => `${i * stepX},${height - (d[key] / max) * height}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="ul-linechart" preserveAspectRatio="none">
      <polyline points={toPoints(valueKeyA)} fill="none" stroke={colorA} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {valueKeyB && (
        <polyline points={toPoints(valueKeyB)} fill="none" stroke={colorB} strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function TransactionBadge({ status }) {
  return <span className={`ul-status-badge ${TRANSACTION_STATUS_BADGE_CLASS[status] || "is-pending"}`}>{TRANSACTION_STATUS_LABEL[status] || status}</span>;
}
function RefundBadge({ status }) {
  return <span className={`ul-status-badge ${REFUND_STATUS_BADGE_CLASS[status] || "is-pending"}`}>{REFUND_STATUS_LABEL[status] || status}</span>;
}

export default function PaymentOversight() {
  const transactions = useTransactions();
  const refundRequests = useRefundRequests();

  // ---- transaction table state ----
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [detailTxnId, setDetailTxnId] = useState(null);

  // ---- refund action state ----
  const [refundReasonDraft, setRefundReasonDraft] = useState(REFUND_REASON_OPTIONS[0]);
  const [refundActionError, setRefundActionError] = useState("");
  const [decisionTarget, setDecisionTarget] = useState(null); // { type: "approve" | "reject", request }
  const [decisionNote, setDecisionNote] = useState("");

  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const overview = useMemo(() => getRevenueOverview(transactions), [transactions]);
  const methodBreakdown = useMemo(() => getMethodBreakdown(transactions), [transactions]);
  const commissionByEducator = useMemo(() => getCommissionByEducator(transactions), [transactions]);
  const maxMethodAmount = Math.max(1, ...methodBreakdown.map((m) => m.amount));

  const statusCounts = useMemo(() => {
    const counts = { paid: 0, processing: 0, pending: 0, failed: 0, refunded: 0 };
    transactions.forEach((t) => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });
    return counts;
  }, [transactions]);

  const pendingRefunds = refundRequests.filter((r) => r.status === REFUND_STATUS.PENDING);
  const pendingRefundAmount = pendingRefunds.reduce((s, r) => s + r.amount, 0);
  const decidedRefunds = useMemo(
    () =>
      refundRequests
        .filter((r) => r.status !== REFUND_STATUS.PENDING)
        .slice()
        .sort((a, b) => new Date(b.decidedAt || b.requestedDate) - new Date(a.decidedAt || a.requestedDate)),
    [refundRequests]
  );

  // transactions are already ledger-sorted newest first (see paymentsMock.js)
  const recentTransactions = transactions.slice(0, 6);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (q && !`${t.id} ${t.educatorName} ${t.courseTitle}`.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (methodFilter !== "all" && t.method !== methodFilter) return false;
      return true;
    });
  }, [transactions, search, statusFilter, methodFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const detailTxn = transactions.find((t) => t.id === detailTxnId) || null;
  const detailHasPendingRefund = detailTxn
    ? refundRequests.some((r) => r.transactionId === detailTxn.id && r.status === REFUND_STATUS.PENDING)
    : false;

  const changePage = (delta) => setPage((p) => Math.min(pageCount, Math.max(1, p + delta)));

  const openDetail = (txnId) => {
    setDetailTxnId(txnId);
    setRefundActionError("");
    setRefundReasonDraft(REFUND_REASON_OPTIONS[0]);
  };

  const submitRefundRequest = () => {
    if (!detailTxn) return;
    const result = createRefundRequest({ transactionId: detailTxn.id, reason: refundReasonDraft, requestedBy: "Admin User" });
    if (!result.success) {
      setRefundActionError(result.error);
      return;
    }
    setDetailTxnId(null);
  };

  const openDecision = (type, request) => {
    setDecisionTarget({ type, request });
    setDecisionNote("");
  };
  const cancelDecision = () => {
    setDecisionTarget(null);
    setDecisionNote("");
  };
  const confirmDecision = () => {
    if (!decisionTarget) return;
    const { type, request } = decisionTarget;
    if (type === "approve") approveRefund(request.id, "Admin", decisionNote);
    else rejectRefund(request.id, "Admin", decisionNote);
    setDecisionTarget(null);
    setDecisionNote("");
  };

  // Real CSV export (not a mock) — built entirely from data already in
  // memory, matching the current Transaction Details filters so "what you
  // see is what you export".
  const exportReport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const lines = [
      csvRow(["Payments & Revenue Report", new Date().toLocaleString()]),
      "",
      csvRow(["Total Revenue", overview.totalRevenue]),
      csvRow(["Commission Earned", overview.totalCommission]),
      csvRow(["Net Educator Payouts", overview.totalNet]),
      csvRow(["Pending / Processing Payouts", overview.pendingAmount]),
      csvRow(["Refunded Amount", overview.refundedAmount]),
      csvRow(["Pending Refund Requests", pendingRefunds.length, pendingRefundAmount]),
      "",
      csvRow(["Transaction", "Educator", "Course", "Student", "Date", "Amount", "Commission", "Net", "Status", "Method"]),
      ...filtered.map((t) =>
        csvRow([t.id, t.educatorName, t.courseTitle, t.studentName, t.date, t.amount, t.commission, t.net, TRANSACTION_STATUS_LABEL[t.status], t.method])
      ),
      "",
      csvRow(["Refund ID", "Course / Test Series", "Requester Type", "Requested For", "Amount (INR)", "Requested", "Requested By", "Reason", "Status", "Decided By", "Decision Note"]),
      ...refundRequests.map((r) =>
        csvRow([
          r.id,
          r.courseTitle,
          "Student",
          REQUEST_FOR_LABEL[r.requestFor] || "",
          r.amount,
          r.requestedDate,
          r.requestedBy,
          r.reason,
          REFUND_STATUS_LABEL[r.status],
          r.decidedBy || "",
          r.decisionNote || "",
        ])
      ),
    ];
    downloadCSV(`payments-revenue-report-${stamp}.csv`, lines.join("\n"));
    setToast(`Exported ${filtered.length} transaction${filtered.length === 1 ? "" : "s"} and ${refundRequests.length} refund record${refundRequests.length === 1 ? "" : "s"} to CSV.`);
  };

  return (
    <>
      {toast && <div className="ul-pay-toast">{toast}</div>}

      <div className="ul-dash-welcome ul-pay-welcome">
        <div>
          <h2 className="ul-dash-welcome__title">Refund Management</h2>
          <p className="ul-dash-welcome__subtitle">
            Review and act on refund requests raised against paid transactions.
          </p>
          <p className="ul-pay-quote"><IconGraduationCap size={13} /> “Empowering educators. Enabling learners. Building brighter futures.”</p>
        </div>
        <button type="button" className="ul-btn ul-btn--ghost ul-pay-export-btn" onClick={exportReport}>
          <IconDownload size={14} /> Export Refunds
        </button>
      </div>

      <div className="ul-card ul-edu-table-card ul-pay-refund-card">
        {pendingRefunds.length === 0 ? (
          <div className="ul-edu-empty">No pending refund requests right now.</div>
        ) : (
          <div className="ul-edu-table-scroll">
            <table className="ul-edu-table ul-pay-refund-table">
              <colgroup>
                <col style={{ width: "13%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "32%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "22%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Type</th>
                  <th>Course / Test Series</th>
                  <th>Educator</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingRefunds.map((r) => (
                  <tr key={r.id}>
                    <td>{r.requestedBy}</td>
                    <td>{REQUEST_FOR_LABEL[r.requestFor] || "—"}</td>
                    <td>
                      <span className="ul-pay-refund-item">{r.courseTitle}</span>
                      <span className="ul-pay-refund-reason" title={r.reason}>Reason: {r.reason}</span>
                    </td>
                    <td>{r.educatorName}</td>
                    <td>{money(r.amount)}</td>
                    <td>
                      <div className="ul-pay-refund-actions">
                        <button
                          type="button"
                          className="ul-btn ul-btn--primary ul-pay-btn-sm"
                          onClick={() => openDecision("approve", r)}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="ul-btn ul-btn--danger ul-pay-btn-sm"
                          onClick={() => openDecision("reject", r)}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- refund history: everything already decided, most recent first ---- */}
      <div className="ul-pay-section-head">
        <h3><IconHistory size={14} color="var(--color-text-muted)" /> Refund History</h3>
        <p>Every refund request that's been approved or rejected.</p>
      </div>
      <div className="ul-card ul-edu-table-card ul-pay-history-card">
        {decidedRefunds.length === 0 ? (
          <div className="ul-edu-empty">No refund decisions yet.</div>
        ) : (
          <div className="ul-edu-table-scroll">
            <table className="ul-edu-table ul-pay-history-table">
              <colgroup>
                <col style={{ width: "20%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "20%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Course / Test Series</th>
                  <th>Requested By</th>
                  <th>Amount</th>
                  <th>Requested</th>
                  <th>Decided</th>
                  <th>Decided By</th>
                  <th>Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {decidedRefunds.map((r) => (
                  <tr key={r.id}>
                    <td>{r.courseTitle}</td>
                    <td><RequesterTag request={r} /></td>
                    <td>{money(r.amount)}</td>
                    <td>{r.requestedDate}</td>
                    <td>{r.decidedAt ? r.decidedAt.slice(0, 10) : "—"}</td>
                    <td>{r.decidedBy || "—"}</td>
                    <td><RefundBadge status={r.status} /></td>
                    <td className="ul-pay-history-note" title={r.decisionNote || ""}>{r.decisionNote || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- transaction detail modal ---- */}
      {detailTxn && (
        <div className="ul-confirm-backdrop" onClick={() => setDetailTxnId(null)}>
          <div className="ul-confirm-modal ul-pay-detail-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ul-confirm-modal__header">
              <span className="ul-confirm-modal__icon">
                <IconWallet size={16} color="var(--color-primary-dark)" />
              </span>
              <button type="button" className="ul-confirm-modal__close" onClick={() => setDetailTxnId(null)} aria-label="Close">
                <IconClose size={15} />
              </button>
            </div>
            <h3 className="ul-confirm-modal__title">{detailTxn.id}</h3>
            <p className="ul-confirm-modal__desc">
              {detailTxn.courseTitle} · by {detailTxn.educatorName} · {detailTxn.date}
            </p>

            <div className="ul-mgmt-detail-stats">
              <div><span>{money(detailTxn.amount)}</span>Amount</div>
              <div><span>{money(detailTxn.commission)}</span>Commission</div>
              <div><span>{money(detailTxn.net)}</span>Net payout</div>
              <div><span>{detailTxn.commissionRate}%</span>Rate</div>
            </div>

            <div className="ul-mgmt-detail-list">
              <div className="ul-mgmt-detail-list__row"><span>Student</span><span>{detailTxn.studentName}</span></div>
              <div className="ul-mgmt-detail-list__row"><span>Method</span><span>{detailTxn.method}</span></div>
              <div className="ul-mgmt-detail-list__row"><span>Status</span><TransactionBadge status={detailTxn.status} /></div>
            </div>

            {detailTxn.status === TRANSACTION_STATUS.PAID && !detailHasPendingRefund && (
              <>
                <span className="ul-mgmt-detail-subhead">Log a refund request</span>
                <select
                  className="ul-usr-select ul-pay-detail-select"
                  value={refundReasonDraft}
                  onChange={(e) => setRefundReasonDraft(e.target.value)}
                >
                  {REFUND_REASON_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {refundActionError && <p className="ul-pay-detail-error">{refundActionError}</p>}
              </>
            )}
            {detailHasPendingRefund && (
              <p className="ul-mgmt-empty">A refund request for this transaction is already pending review.</p>
            )}

            <div className="ul-confirm-modal__actions">
              <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setDetailTxnId(null)}>
                Close
              </button>
              {detailTxn.status === TRANSACTION_STATUS.PAID && !detailHasPendingRefund && (
                <button type="button" className="ul-btn ul-btn--primary" onClick={submitRefundRequest}>
                  Request Refund
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---- approve / reject confirmation ---- */}
      <ConfirmModal
        open={!!decisionTarget}
        title={decisionTarget?.type === "approve" ? "Approve this refund?" : "Reject this refund?"}
        description={
          decisionTarget
            ? `${money(decisionTarget.request.amount)} for "${decisionTarget.request.courseTitle}" (${decisionTarget.request.transactionId}). ${
                decisionTarget.type === "approve"
                  ? "The underlying transaction will be marked Refunded."
                  : "The transaction stays as-is; the requester should be notified why."
              }`
            : ""
        }
        confirmLabel={decisionTarget?.type === "approve" ? "Approve Refund" : "Reject Refund"}
        tone={decisionTarget?.type === "approve" ? "default" : "danger"}
        onConfirm={confirmDecision}
        onCancel={cancelDecision}
      >
        <textarea
          className="ul-pay-decision-note"
          placeholder={decisionTarget?.type === "approve" ? "Optional note (e.g. verification details)…" : "Reason for rejecting (shown in the log)…"}
          value={decisionNote}
          onChange={(e) => setDecisionNote(e.target.value)}
          rows={3}
        />
      </ConfirmModal>
    </>
  );
}
