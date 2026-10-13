// Transaction History — a full, searchable ledger of every Paid platform
// transaction (the same flattened payout ledger PaymentOversight.jsx reads
// via paymentsMock.js's useTransactions()), broken out into its own
// sidebar page so admins have one place to look up any transaction by id,
// educator, course or student, independent of the Refund Management queue.
//
// Summary analytics (total revenue, failed/pending counts, refunded count,
// average transaction value) are computed over the WHOLE ledger regardless
// of what's filtered here, since this page only ever shows the Paid slice
// — Status isn't a useful row filter here (everything on this page already
// is Paid).
//
// Reuses established Admin primitives rather than inventing new ones:
// .ul-edu-header / .ul-edu-toolbar / .ul-edu-select / .ul-edu-table /
// .ul-edu-pagination (EducatorVerification.css), .ul-card / .ul-status-badge
// (AdminDashboard.css), .ul-confirm-backdrop / .ul-confirm-modal /
// .ul-mgmt-detail-* (ConfirmModal.css / ManagementDashboards.css), and the
// same CSV export + "log a refund from the detail modal" functionality
// already built here.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useTransactions,
  useRefundRequests,
  createRefundRequest,
  TRANSACTION_STATUS,
  TRANSACTION_STATUS_LABEL,
  TRANSACTION_STATUS_BADGE_CLASS,
  REFUND_STATUS,
  REFUND_STATUS_LABEL,
  REFUND_STATUS_BADGE_CLASS,
  REFUND_REASON_OPTIONS,
  getTransactionAnalytics,
} from "../data/paymentsMock";
import { IconSearch, IconClose, IconDownload, IconWallet, IconChevronDown, IconHistory, IconCheck } from "../components/icons";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "../components/ConfirmModal.css";
import "./ManagementDashboards.css";
import "./ReportsBuilder.css";
import "./PaymentOversight.css";
import "./TransactionHistory.css";

const PAGE_SIZE = 10;
const money = (n) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const STATUS_HISTORY_LABEL = {
  initiated: "Payment Initiated",
  processing: "Processing",
  paid: "Payment Successful",
  pending: "Pending Confirmation",
  failed: "Payment Failed",
  refunded: "Refunded",
};

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
function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function downloadCSV(filename, text) {
  downloadBlob(filename, text, "text/csv;charset=utf-8;");
}

function exportRowsFor(transactionsList) {
  return transactionsList.map((t) => ({
    Transaction: t.id,
    Date: t.date,
    Educator: t.educatorName,
    "Test Series": t.seriesTitle,
    Student: t.studentName,
    Amount: t.amount,
    Commission: t.commission,
    Net: t.net,
    Method: t.method,
    Gateway: t.gatewayName,
    "Gateway Reference": t.gatewayRef,
    Status: TRANSACTION_STATUS_LABEL[t.status] || t.status,
  }));
}
function toCSV(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [csvRow(headers), ...rows.map((r) => csvRow(headers.map((h) => r[h])))].join("\n");
}

const uniqueSorted = (arr) => ["all", ...Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b))];

export default function TransactionHistory() {
  const allTransactions = useTransactions();
  // This page only ever shows the Paid section of the ledger — pending,
  // processing, failed and refunded transactions live elsewhere (Refund
  // Management handles refunded/refund-in-progress ones).
  const transactions = useMemo(() => allTransactions.filter((t) => t.status === TRANSACTION_STATUS.PAID), [allTransactions]);
  const refundRequests = useRefundRequests();

  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterRef = useRef(null);
  const [methodFilter, setMethodFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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

  useEffect(() => {
    if (!filtersOpen) return undefined;
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFiltersOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [filtersOpen]);

  const methodOptions = useMemo(() => uniqueSorted(transactions.map((t) => t.method).filter((m) => m !== "Wire Transfer")), [transactions]);

  const activeFilterCount = [methodFilter !== "all", dateFrom !== "", dateTo !== ""].filter(Boolean).length;

  const clearAdvancedFilters = () => {
    setMethodFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTime = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTime = dateTo ? new Date(dateTo).getTime() + 86399999 : null;

    const rows = transactions.filter((t) => {
      if (q && !`${t.id} ${t.educatorName} ${t.seriesTitle} ${t.studentName}`.toLowerCase().includes(q)) return false;
      if (methodFilter !== "all" && t.method !== methodFilter) return false;
      const tTime = new Date(t.date).getTime();
      if (fromTime != null && tTime < fromTime) return false;
      if (toTime != null && tTime > toTime) return false;
      return true;
    });

    const sorted = [...rows];
    if (sortBy === "date_desc") sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
    else if (sortBy === "date_asc") sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
    else if (sortBy === "amount_desc") sorted.sort((a, b) => b.amount - a.amount);
    else if (sortBy === "amount_asc") sorted.sort((a, b) => a.amount - b.amount);
    return sorted;
  }, [transactions, search, methodFilter, dateFrom, dateTo, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const analytics = useMemo(() => getTransactionAnalytics(allTransactions), [allTransactions]);

  const detailTxn = transactions.find((t) => t.id === detailTxnId) || null;
  const detailHasPendingRefund = detailTxn
    ? refundRequests.some((r) => r.transactionId === detailTxn.id && r.status === REFUND_STATUS.PENDING)
    : false;
  const relatedRefund = useMemo(() => {
    if (!detailTxn) return null;
    const matches = refundRequests.filter((r) => r.transactionId === detailTxn.id);
    if (!matches.length) return null;
    return matches.slice().sort((a, b) => new Date(b.requestedDate) - new Date(a.requestedDate))[0];
  }, [detailTxn, refundRequests]);

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

  const runExport = () => {
    if (filtered.length === 0) {
      setToast("Nothing to export.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const exportRows = exportRowsFor(filtered);
    const lines = [
      csvRow(["Transaction History", new Date().toLocaleString()]),
      csvRow(["Matching transactions", filtered.length, "Total amount", filtered.reduce((s, t) => s + t.amount, 0)]),
      "",
      toCSV(exportRows),
    ];
    downloadCSV(`transaction-history-${stamp}.csv`, lines.join("\n"));
    setToast(`Exported ${filtered.length} transaction${filtered.length === 1 ? "" : "s"} to CSV.`);
  };

  return (
    <div className="ul-txn-page">
      {toast && <div className="ul-pay-toast">{toast}</div>}

      <div className="ul-edu-header">
        <div>
          <h2 className="ul-dash-welcome__title">Transaction History</h2>
          <p className="ul-dash-welcome__subtitle">
            Paid transactions only — search, filter and review, and click any row for full detail.
          </p>
        </div>
        <button type="button" className="ul-btn ul-btn--primary ul-edu-add-btn" onClick={runExport}>
          <IconDownload size={13} />
          <span>Export CSV</span>
        </button>
      </div>

      {/* ---- summary cards (ledger-wide, independent of the filters below) ---- */}
      <div className="ul-card ul-txn-analytics-card">
        <div className="ul-txn-analytics-grid">
          <div className="ul-txn-analytics-tile ul-txn-analytics-tile--revenue">
            <span className="ul-txn-analytics-tile__icon"><IconWallet size={14} /></span>
            <span>Total Revenue</span>
            <strong>{money(analytics.totalRevenue)}</strong>
            <small>from {analytics.paidCount} paid transactions</small>
          </div>
          <div className="ul-txn-analytics-tile ul-txn-analytics-tile--method">
            <span className="ul-txn-analytics-tile__icon"><IconHistory size={14} /></span>
            <span>Total Transactions</span>
            <strong>{analytics.paidCount}</strong>
            <small>paid transactions on record</small>
          </div>
          <div className="ul-txn-analytics-tile ul-txn-analytics-tile--avg">
            <span className="ul-txn-analytics-tile__icon"><IconCheck size={14} /></span>
            <span>Avg. Transaction Value</span>
            <strong>{money(analytics.avgTransactionValue)}</strong>
            <small>paid transactions only</small>
          </div>
        </div>
      </div>

      <div className="ul-edu-toolbar">
        <label className="ul-edu-search">
          <IconSearch size={14} color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder="Search by transaction ID, educator, test series or student…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button type="button" className="ul-edu-search__clear" onClick={() => setSearch("")} aria-label="Clear search">
              <IconClose size={12} />
            </button>
          )}
        </label>

        <select className="ul-edu-select ul-edu-select--sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
          <option value="amount_desc">Amount: High to low</option>
          <option value="amount_asc">Amount: Low to high</option>
        </select>

        <div className="ul-txn-filter-popover-wrap" ref={filterRef}>
          <button type="button" className={`ul-btn ul-btn--ghost ul-txn-filters-toggle${filtersOpen ? " is-open" : ""}`} onClick={() => setFiltersOpen((v) => !v)}>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""} <IconChevronDown size={13} />
          </button>
          {filtersOpen && (
            <div className="ul-txn-filter-popover">
              <label className="ul-txn-filter-field">
                <span>Payment Method</span>
                <select value={methodFilter} onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}>
                  {methodOptions.map((m) => <option key={m} value={m}>{m === "all" ? "All methods" : m}</option>)}
                </select>
              </label>
              <label className="ul-txn-filter-field">
                <span>Date From</span>
                <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
              </label>
              <label className="ul-txn-filter-field">
                <span>Date To</span>
                <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
              </label>
              <button type="button" className="ul-btn ul-btn--ghost ul-txn-filter-popover__clear" onClick={clearAdvancedFilters} disabled={activeFilterCount === 0}>
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="ul-card ul-edu-table-card">
        {pageItems.length === 0 ? (
          <div className="ul-edu-empty">No transactions match your filters.</div>
        ) : (
          <div className="ul-edu-table-scroll">
            <table className="ul-edu-table ul-txn-table">
              <colgroup>
                <col style={{ width: "15%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "32%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Test Series</th>
                  <th>Educator</th>
                  <th className="ul-txn-table__amount-head">Amount</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((t) => (
                  <tr key={t.id} className="ul-edu-row--clickable" onClick={() => openDetail(t.id)}>
                    <td><span className="ul-txn-id-chip">{t.id}</span></td>
                    <td className="ul-txn-table__date">{t.date}</td>
                    <td className="ul-txn-table__name">{t.studentName}</td>
                    <td className="ul-txn-table__course">{t.seriesTitle}</td>
                    <td className="ul-txn-table__name">{t.educatorName}</td>
                    <td className="ul-txn-table__amount"><span className="ul-txn-amount">{money(t.amount)}</span></td>
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

      {/* ---- transaction detail modal ---- */}
      {detailTxn && (
        <div className="ul-confirm-backdrop" onClick={() => setDetailTxnId(null)}>
          <div className="ul-confirm-modal ul-pay-detail-modal ul-mgmt-detail-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
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
              {detailTxn.seriesTitle} · by {detailTxn.educatorName} · {detailTxn.date}
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
              <div className="ul-mgmt-detail-list__row"><span>Gateway</span><span>{detailTxn.gatewayName}</span></div>
              <div className="ul-mgmt-detail-list__row"><span>Gateway Reference</span><span>{detailTxn.gatewayRef}</span></div>
            </div>

            <span className="ul-mgmt-detail-subhead">Status History</span>
            <div className="ul-txn-status-history">
              {(detailTxn.statusHistory || []).map((h, i) => (
                <div key={i} className="ul-txn-status-history__row">
                  <span className="ul-txn-status-history__dot" />
                  <span className="ul-txn-status-history__label">{STATUS_HISTORY_LABEL[h.status] || h.status}</span>
                  <span className="ul-txn-status-history__time">
                    {new Date(h.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>

            {relatedRefund && (
              <>
                <span className="ul-mgmt-detail-subhead">Related Refund</span>
                <div className="ul-mgmt-detail-list">
                  <div className="ul-mgmt-detail-list__row"><span>Refund ID</span><span>{relatedRefund.id}</span></div>
                  <div className="ul-mgmt-detail-list__row">
                    <span>Status</span>
                    <span className={`ul-status-badge ${REFUND_STATUS_BADGE_CLASS[relatedRefund.status]}`}>{REFUND_STATUS_LABEL[relatedRefund.status]}</span>
                  </div>
                  <div className="ul-mgmt-detail-list__row"><span>Amount</span><span>{money(relatedRefund.amount)}</span></div>
                  <div className="ul-mgmt-detail-list__row"><span>Reason</span><span>{relatedRefund.reason}</span></div>
                  {relatedRefund.decisionNote && (
                    <div className="ul-mgmt-detail-list__row"><span>Note</span><span>{relatedRefund.decisionNote}</span></div>
                  )}
                </div>
              </>
            )}

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
    </div>
  );
}
