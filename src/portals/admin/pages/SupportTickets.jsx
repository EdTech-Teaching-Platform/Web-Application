// Callback Requests
// Jira: Day 15 — Help desk / support tickets + callback requests
// (Support Tickets removed per later product decision — Admin only
// handles direct Callback Requests now.)
// Callback Request / Founder Note Capture: a simple contact-capture
// form routed to the team" (⚠ not detailed in the Technical Design
// Document — kept intentionally lightweight: capture + status + a
// follow-up note, no ticket thread or SLA/priority fields).
//
// Search/filter by status/source, a details drawer with the captured
// message, contact info, and a follow-up note + status update.
//
// Reuses .ul-card/.ul-stats/.ul-stat-card/.ul-status-badge from
// AdminDashboard.css & EducatorVerification.css, the
// .ul-set-search/.ul-set-select/.ul-set-filters/.ul-set-table*/
// .ul-set-drawer*/.ul-set-toast classes from SettingsPermissions.css,
// and .ul-usr-pagination from UserManagement.css — page-specific layout
// only lives in SupportTickets.css (.ul-sup-*).

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CALLBACK_STATUS,
  CALLBACK_STATUS_LABEL,
  CALLBACK_STATUS_BADGE_CLASS,
  CALLBACK_SOURCE_LABEL,
  useCallbackRequests,
  updateCallbackStatus,
  updateCallbackSchedule,
  completeCallback,
} from "../data/supportMock";
import { IconSearch, IconClose, IconMail, IconPhone, IconDownload } from "../components/icons";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./SettingsPermissions.css";
import "./UserManagement.css";
import "./SupportTickets.css";

const CALLBACK_PAGE_SIZE = 8;

function CallbackStatusBadge({ status }) {
  return <span className={`ul-status-badge ${CALLBACK_STATUS_BADGE_CLASS[status]}`}>{CALLBACK_STATUS_LABEL[status]}</span>;
}

function exportSupportReport(callbacks) {
  const rows = [
    ["ID", "Name", "Contact", "Status", "Source", "Scheduled", "Updated"],
    ...callbacks.map((callback) => [callback.id, callback.name, callback.phone, CALLBACK_STATUS_LABEL[callback.status], CALLBACK_SOURCE_LABEL[callback.source], callback.scheduledAt || "Not scheduled", callback.completedAt || callback.submittedDate]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell || "").replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `callback-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function SupportTickets() {
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const callbacks = useCallbackRequests();

  useEffect(() => {
    if (!toast) return undefined;
    toastTimer.current = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  return (
    <div className="ul-sup-page">
      <div className="ul-dash-welcome">
        <div>
          <h2 className="ul-dash-welcome__title">Callback Requests</h2>
          <p className="ul-dash-welcome__subtitle">
            Follow up on direct callback requests captured from the site.
          </p>
        </div>
      </div>

      <CallbacksTab onToast={setToast} />

      <div className="ul-sup-export-row">
        <button type="button" className="ul-btn ul-btn--ghost" onClick={() => { exportSupportReport(callbacks); setToast("Callback report exported."); }}>
          <IconDownload size={13} /> Export Callback Report
        </button>
      </div>

      {toast && <div className="ul-set-toast">{toast}</div>}
    </div>
  );
}

/* ============================== Tab 2 ============================== */

function CallbacksTab({ onToast }) {
  const callbacks = useCallbackRequests();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [detailsCallback, setDetailsCallback] = useState(null);
  const [note, setNote] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  useEffect(() => setPage(1), [search, statusFilter, sourceFilter]);

  useEffect(() => {
    if (!detailsCallback) return;
    const fresh = callbacks.find((c) => c.id === detailsCallback.id);
    if (fresh && fresh !== detailsCallback) {
      setDetailsCallback(fresh);
    }
  }, [callbacks, detailsCallback]);

  const counts = useMemo(
    () => ({
      total: callbacks.length,
      new: callbacks.filter((c) => c.status === CALLBACK_STATUS.NEW).length,
      contacted: callbacks.filter((c) => c.status === CALLBACK_STATUS.CONTACTED).length,
      closed: callbacks.filter((c) => c.status === CALLBACK_STATUS.CLOSED).length,
    }),
    [callbacks]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return callbacks.filter((c) => {
      if (q && !`${c.name} ${c.phone} ${c.email} ${c.message}`.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (sourceFilter !== "all" && c.source !== sourceFilter) return false;
      return true;
    });
  }, [callbacks, search, statusFilter, sourceFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / CALLBACK_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * CALLBACK_PAGE_SIZE, currentPage * CALLBACK_PAGE_SIZE);

  const openDetails = (callback) => {
    setDetailsCallback(callback);
    setNote(callback.followUpNote || "");
    setScheduledAt(callback.scheduledAt || "");
  };

  const saveNote = () => {
    if (!detailsCallback) return;
    updateCallbackStatus(detailsCallback.id, detailsCallback.status, note.trim());
    onToast(`Follow-up note saved for ${detailsCallback.name}.`);
  };

  const setStatus = (status) => {
    if (!detailsCallback) return;
    updateCallbackStatus(detailsCallback.id, status, note.trim());
    onToast(`${detailsCallback.name} marked ${CALLBACK_STATUS_LABEL[status]}.`);
  };

  const saveSchedule = () => {
    if (!detailsCallback) return;
    updateCallbackSchedule(detailsCallback.id, scheduledAt || null);
    onToast(scheduledAt ? `Callback scheduled for ${detailsCallback.name}.` : "Callback schedule cleared.");
  };

  const markComplete = () => {
    if (!detailsCallback) return;
    completeCallback(detailsCallback.id);
    onToast(`Callback completed for ${detailsCallback.name}.`);
  };

  return (
    <div>
      <div className="ul-stats ul-sup-stats">
        <div className="ul-stat-card"><span className="ul-stat-card__label">TOTAL REQUESTS</span><span className="ul-stat-card__value">{counts.total}</span><span className="ul-stat-card__trend">Captured from the site</span></div>
        <div className="ul-stat-card"><span className="ul-stat-card__label">NEW</span><span className="ul-stat-card__value">{counts.new}</span><span className="ul-stat-card__trend">Not yet contacted</span></div>
        <div className="ul-stat-card"><span className="ul-stat-card__label">CONTACTED</span><span className="ul-stat-card__value">{counts.contacted}</span><span className="ul-stat-card__trend">Follow-up in progress</span></div>
        <div className="ul-stat-card"><span className="ul-stat-card__label">CLOSED</span><span className="ul-stat-card__value">{counts.closed}</span><span className="ul-stat-card__trend is-up">Resolved leads</span></div>
      </div>

      <div className="ul-set-filters">
        <label className="ul-set-search">
          <IconSearch size={14} color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder="Search by name, phone, email or message…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="ul-usr-search__clear" onClick={() => setSearch("")} aria-label="Clear search">
              <IconClose size={12} />
            </button>
          )}
        </label>

        <select className="ul-set-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Status: All</option>
          {Object.values(CALLBACK_STATUS).map((s) => (
            <option key={s} value={s}>{CALLBACK_STATUS_LABEL[s]}</option>
          ))}
        </select>

        <select className="ul-set-select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="all">Source: All</option>
          {Object.keys(CALLBACK_SOURCE_LABEL).map((s) => (
            <option key={s} value={s}>{CALLBACK_SOURCE_LABEL[s]}</option>
          ))}
        </select>
      </div>

      <div className="ul-card ul-set-table-card">
        {pageItems.length === 0 ? (
          <div className="ul-set-empty">No callback requests match these filters.</div>
        ) : (
          <div className="ul-set-table-scroll">
            <table className="ul-set-table ul-sup-callback-table">
              <colgroup>
                <col style={{ width: "17%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "28%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "8%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Source</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <button type="button" className="ul-set-cert-link" onClick={() => openDetails(c)}>
                        {c.name}
                      </button>
                    </td>
                    <td>{c.phone}</td>
                    <td>{CALLBACK_SOURCE_LABEL[c.source]}</td>
                    <td><span className="ul-sup-message-preview">{c.message}</span></td>
                    <td><CallbackStatusBadge status={c.status} /></td>
                    <td>
                      <div className="ul-set-actions-cell">
                        <button type="button" className="ul-btn ul-btn--ghost ul-set-btn-sm" onClick={() => openDetails(c)}>
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="ul-usr-pagination">
            <span className="ul-usr-pagination__info">
              Showing {(currentPage - 1) * CALLBACK_PAGE_SIZE + 1}–{Math.min(currentPage * CALLBACK_PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="ul-usr-pagination__controls">
              <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Prev</button>
              <span>{currentPage} / {pageCount}</span>
              <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      {/* ---------- callback details drawer ---------- */}
      {detailsCallback && (
        <div className="ul-set-drawer-backdrop" onClick={() => setDetailsCallback(null)}>
          <div className="ul-set-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ul-set-drawer__head">
              <div>
                <h3 className="ul-set-drawer__title">{detailsCallback.name}</h3>
                <p className="ul-set-drawer__sub">{detailsCallback.id} · {CALLBACK_SOURCE_LABEL[detailsCallback.source]}</p>
              </div>
              <button type="button" className="ul-set-drawer__close" onClick={() => setDetailsCallback(null)} aria-label="Close">
                <IconClose size={15} />
              </button>
            </div>

            <div className="ul-set-drawer__body">
              <div className="ul-sup-contact-line"><IconPhone size={12} color="var(--color-text-muted)" /> {detailsCallback.phone}</div>
              <div className="ul-sup-contact-line"><IconMail size={12} color="var(--color-text-muted)" /> {detailsCallback.email}</div>

              <p className="ul-set-section-title" style={{ marginTop: 16 }}>Message</p>
              <div className="ul-sup-quote-box">{detailsCallback.message}</div>

              <p className="ul-set-section-title">Status</p>
              <p className="ul-set-section-desc">Submitted {detailsCallback.submittedDate}.</p>
              <div className="ul-sup-status-actions">
                <button type="button" className="ul-btn ul-btn--ghost ul-set-btn-sm" disabled={detailsCallback.status === CALLBACK_STATUS.NEW} onClick={() => setStatus(CALLBACK_STATUS.NEW)}>Mark New</button>
                <button type="button" className="ul-btn ul-btn--primary ul-set-btn-sm" disabled={detailsCallback.status === CALLBACK_STATUS.CONTACTED} onClick={() => setStatus(CALLBACK_STATUS.CONTACTED)}>Mark Contacted</button>
                <button type="button" className="ul-btn ul-btn--ghost ul-set-btn-sm" disabled={detailsCallback.status === CALLBACK_STATUS.CLOSED} onClick={() => setStatus(CALLBACK_STATUS.CLOSED)}>Mark Closed</button>
              </div>

              <p className="ul-set-section-title" style={{ marginTop: 16 }}>Callback Schedule</p>
              <div className="ul-sup-schedule-row">
                <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} aria-label="Callback date and time" />
                <button type="button" className="ul-btn ul-btn--ghost ul-set-btn-sm" onClick={saveSchedule}>Save Schedule</button>
                <button type="button" className="ul-btn ul-btn--primary ul-set-btn-sm" disabled={detailsCallback.status === CALLBACK_STATUS.CLOSED} onClick={markComplete}>Complete Callback</button>
              </div>
              {detailsCallback.completedAt && <p className="ul-set-section-desc">Completed {detailsCallback.completedAt}.</p>}

              <p className="ul-set-section-title" style={{ marginTop: 16 }}>Follow-up Note</p>
              <textarea
                className="ul-sup-followup"
                placeholder="e.g. Called back, offered a trial class, awaiting reply…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />

              <p className="ul-set-section-title" style={{ marginTop: 16 }}>Activity History</p>
              <div className="ul-sup-activity">{detailsCallback.activity.map((item, index) => <div key={`${detailsCallback.id}-activity-${index}`}><span>{item.text}</span><small>{item.timestamp}</small></div>)}</div>
            </div>

            <div className="ul-set-drawer__actions">
              <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setDetailsCallback(null)}>
                Close
              </button>
              <button type="button" className="ul-btn ul-btn--primary" onClick={saveNote}>
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

