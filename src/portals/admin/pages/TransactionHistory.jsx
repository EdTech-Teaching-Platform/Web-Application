// Transaction History — a full, searchable/filterable ledger of every
// platform transaction (the same flattened payout ledger PaymentOversight.jsx
// reads via paymentsMock.js's useTransactions()), broken out into its own
// sidebar page so admins have one place to look up any transaction by id,
// educator, course or student, independent of the Refund Management queue.
//
// Reuses established Admin primitives rather than inventing new ones:
// .ul-edu-toolbar / .ul-edu-select / .ul-edu-table / .ul-edu-pagination
// (EducatorVerification.css), .ul-card / .ul-status-badge (AdminDashboard.css),
// .ul-confirm-backdrop / .ul-confirm-modal (ConfirmModal.css), and the same
// CSV export + "log a refund from the detail modal" functionality already
// built for PaymentOversight.jsx.

import { useEffect, useMemo, useState } from "react";
import {
  useTransactions,
  useRefundRequests,
  createRefundRequest,
  TRANSACTION_STATUS,
  TRANSACTION_STATUS_LABEL,
  TRANSACTION_STATUS_BADGE_CLASS,
  REFUND_STATUS,
  REFUND_REASON_OPTIONS,
} from "../data/paymentsMock";
import { IconSearch, IconClose, IconDownload, IconWallet } from "../components/icons";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "../components/ConfirmModal.css";
import "./PaymentOversight.css";
import "./TransactionHistory.css";

const PAGE_SIZE = 10;
const money = (n) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function TransactionBadge({ status }) {
  return <span className={`ul-status-badge ${TRANSACTION_STATUS_BADGE_CLASS[status] || "is-pending"}`}>{TRANSACTION_STATUS_LABEL[status] || status}</span>;
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
  a.click();
  URL.revokeObjectURL(url);
}

export default function TransactionHistory() {
  const allTransactions = useTransactions();
  // This page only ever shows the Paid section of the ledger — pending,
  // processing, failed and refunded transactions live elsewhere (Refund
  // Management handles refunded/refund-in-progress ones).
  const transactions = useMemo(() => allTransactions.filter((t) => t.status === TRANSACTION_STATUS.PAID), [allTransactions]);
  const refundRequests = useRefundRequests();

  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date_desc");
  const [page, setPage] = useState(1);
  const [detailTxnId, setDetailTxnId] = useState(null);
  const [refundReasonDraft, setRefundReasonDraft] = useState(REFUND_REASON_OPTIONS[0]);
  const [refundActionError, setRefundActionError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const methodOptions = useMemo(() => ["all", ...new Set(transactions.map((t) => t.method))], [transactions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = transactions.filter((t) => {
      if (q && !`${t.id} ${t.educatorName} ${t.courseTitle} ${t.studentName}`.toLowerCase().includes(q)) return false;
      if (methodFilter !== "all" && t.method !== methodFilter) return false;
      return true;
    });
    const sorted = [...rows];
    if (sortBy === "date_desc") sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
    else if (sortBy === "date_asc") sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
    else if (sortBy === "amount_desc") sorted.sort((a, b) => b.amount - a.amount);
    else if (sortBy === "amount_asc") sorted.sort((a, b) => a.amount - b.amount);
    return sorted;
  }, [transactions, search, methodFilter, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const totalAmount = useMemo(() => filtered.reduce((sum, t) => sum + (t.amount || 0), 0), [filtered]);

  const detailTxn = transactions.find((t) => t.id === detailTxnId) || null;
  const detailHasPendingRefund = detailTxn
    ? refundRequests.some((r) => r.transactionId === detailTxn.id && r.status === REFUND_STATUS.PENDING)
    : false;

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
    setToast("Refund request logged.");
  };

  const exportCSV = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const lines = [
      csvRow(["Transaction History", new Date().toLocaleString()]),
      csvRow(["Matching transactions", filtered.length, "Total amount", totalAmount]),
      "",
      csvRow(["Transaction", "Date", "Educator", "Course", "Student", "Amount", "Commission", "Net", "Method"]),
      ...filtered.map((t) => csvRow([t.id, t.date, t.educatorName, t.courseTitle, t.studentName, t.amount, t.commission, t.net, t.method])),
    ];
    downloadCSV(`transaction-history-${stamp}.csv`, lines.join("\n"));
    setToast(`Exported ${filtered.length} transaction${filtered.length === 1 ? "" : "s"} to CSV.`);
  };

  return (
    <>
      {toast && <div className="ul-pay-toast">{toast}</div>}

      <div className="ul-dash-welcome ul-pay-welcome">
        <div>
          <h2 className="ul-dash-welcome__title">Transaction History</h2>
          <p className="ul-dash-welcome__subtitle">
            Paid transactions only — search, filter and review, and click any row for full detail.
          </p>
        </div>
        <button type="button" className="ul-btn ul-btn--ghost ul-pay-export-btn" onClick={exportCSV}>
          <IconDownload size={14} /> Export CSV
        </button>
      </div>

      <div className="ul-txn-stats">
        <div className="ul-txn-stats__item"><span>Matching transactions</span><strong>{filtered.length}</strong></div>
        <div className="ul-txn-stats__item"><span>Total amount</span><strong>{money(totalAmount)}</strong></div>
      </div>

      <div className="ul-edu-toolbar">
        <label className="ul-edu-search">
          <IconSearch size={14} color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder="Search by transaction ID, educator, course or student…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button type="button" className="ul-edu-search__clear" onClick={() => setSearch("")} aria-label="Clear search">
              <IconClose size={12} />
            </button>
          )}
        </label>

        <select className="ul-edu-select" value={methodFilter} onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}>
          <option value="all">Method: All</option>
          {methodOptions.filter((m) => m !== "all").map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <select className="ul-edu-select ul-edu-select--sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
          <option value="amount_desc">Amount: High to low</option>
          <option value="amount_asc">Amount: Low to high</option>
        </select>
      </div>

      <div className="ul-card ul-edu-table-card">
        {pageItems.length === 0 ? (
          <div className="ul-edu-empty">No transactions match your filters.</div>
        ) : (
          <div className="ul-edu-table-scroll">
            <table className="ul-edu-table ul-txn-table">
              <colgroup>
                <col style={{ width: "14%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "19%" }} />
                <col style={{ width: "26%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "12%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Date</th>
                  <th>Educator</th>
                  <th>Course</th>
                  <th>Student</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((t) => (
                  <tr key={t.id} className="ul-edu-row--clickable" onClick={() => openDetail(t.id)}>
                    <td>{t.id}</td>
                    <td>{t.date}</td>
                    <td>{t.educatorName}</td>
                    <td>{t.courseTitle}</td>
                    <td>{t.studentName}</td>
                    <td>{money(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pageItems.length > 0 && (
          <div className="ul-edu-pagination">
            <span className="ul-edu-pagination__info">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="ul-edu-pagination__controls">
              <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                Previous
              </button>
              <span>{currentPage} / {pageCount}</span>
              <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ---- transaction detail modal (same pattern/fields as PaymentOversight.jsx) ---- */}
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
    </>
  );
}
