// Content Moderation — student feedback, queries and issue reports on tests.
//   • Needs attention: new and in-review items.
//   • Closed: resolved and dismissed items.
// Data: services/moderationApi.js (list_moderation_items, get_moderation_stats,
// get_moderation_item, set_moderation_status, get_moderation_filter_options).
// Resolving or dismissing needs a note; the student sees it, and a resolved
// item also sends the student a notification.

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { IconSearch, IconClose } from "../components/icons";
import { useRpc } from "../hooks/useRpc";
import { KIND_LABEL, STATUS_ACTIONS, STATUS_LABEL, moderationApi } from "../services/moderationApi";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./RegionalHeads.css";
import "./ContentModeration.css";

const PAGE_SIZE = 10;
const TAB_STATUSES = { open: ["new", "in_review"], closed: ["resolved", "dismissed"] };

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const stars = (n) => (n ? `${"★".repeat(n)}${"☆".repeat(5 - n)}` : "—");

function StatusBadge({ item }) {
  return <span className={`ul-status-badge ${item.statusBadge}`}>{item.statusLabel}</span>;
}

/* ---------------- list ---------------- */
function ItemTable({ tab, onOpen, reloadKey }) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [series, setSeries] = useState("all");
  const [page, setPage] = useState(1);

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const options = useRpc(useCallback(() => moderationApi.filterOptions(), []));
  const request = useCallback(
    () => moderationApi.list({ search, kind, status: status === "all" ? tab : status, series, page, size: PAGE_SIZE }),
    // reloadKey re-runs the list after a status change in the detail modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, kind, status, series, page, tab, reloadKey],
  );
  const list = useRpc(request);

  const setFilter = (setter) => (e) => { setter(e.target.value); setPage(1); };
  const hasFilters = searchInput || kind !== "all" || status !== "all" || series !== "all";
  const clear = () => { setSearchInput(""); setSearch(""); setKind("all"); setStatus("all"); setSeries("all"); setPage(1); };

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="ul-edu-toolbar ul-cmi-toolbar">
        <label className="ul-edu-search">
          <IconSearch size={14} color="var(--color-text-muted)" />
          <input type="text" placeholder="Search message, student, series or test…" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)} aria-label="Search" />
          {searchInput && (
            <button type="button" className="ul-edu-search__clear" onClick={() => setSearchInput("")} aria-label="Clear search"><IconClose size={12} /></button>
          )}
        </label>
        <select className="ul-edu-select" value={kind} onChange={setFilter(setKind)} aria-label="Kind">
          <option value="all">Kind: All</option>
          {Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="ul-edu-select" value={status} onChange={setFilter(setStatus)} aria-label="Status">
          <option value="all">Status: All</option>
          {TAB_STATUSES[tab].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select className="ul-edu-select" value={series} onChange={setFilter(setSeries)} aria-label="Series">
          <option value="all">Series: All</option>
          {(options.data?.series ?? []).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        {hasFilters && <button type="button" className="ul-btn ul-btn--ghost ul-rh-btn" onClick={clear}>Clear</button>}
      </div>

      <div className="ul-card ul-edu-table-card">
        {list.loading && !list.data ? (
          <div className="ul-edu-empty" role="status">Loading…</div>
        ) : list.error ? (
          <div className="ul-edu-empty" role="alert">
            Couldn't load items: {list.error.message}{" "}
            <button type="button" className="ul-btn ul-btn--ghost ul-rh-btn" onClick={() => list.refetch().catch(() => {})}>Retry</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="ul-edu-empty">
            {hasFilters ? "No items match these filters."
              : tab === "open" ? "Nothing needs attention. New feedback and reports from students appear here."
              : "No resolved or dismissed items yet."}
          </div>
        ) : (
          <div className="ul-edu-table-scroll ul-cmi-scroll">
            <table className="ul-edu-table ul-cmi-table">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Student</th>
                  <th>Series / Test</th>
                  <th>Kind</th>
                  <th>Rating</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id} className="ul-edu-row--clickable" onClick={() => onOpen(i.id)}>
                    <td>{fmtDateTime(i.createdAt)}</td>
                    <td><div className="ul-cmi-title"><span className="ul-rh-strong">{i.student.name}</span><span className="ul-rh-sub">{i.student.email}</span></div></td>
                    <td><div className="ul-cmi-title"><span className="ul-rh-strong">{i.series.title}</span><span className="ul-rh-sub">{i.test.title || "—"}</span></div></td>
                    <td>{i.kindLabel}{i.categoryLabel && <span className="ul-rh-sub"> · {i.categoryLabel}</span>}</td>
                    <td aria-label={i.rating ? `${i.rating} of 5` : "No rating"}>{stars(i.rating)}</td>
                    <td><span className="ul-cmi-clip" title={i.message}>{i.message}</span></td>
                    <td><StatusBadge item={i} /></td>
                    <td>
                      <button type="button" className="ul-btn ul-btn--ghost ul-rh-btn" onClick={(e) => { e.stopPropagation(); onOpen(i.id); }}>
                        {tab === "open" ? "Review" : "View"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > 0 && (
          <div className="ul-edu-pagination">
            <span className="ul-edu-pagination__info">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
            <div className="ul-edu-pagination__controls">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
              <span>{page} / {pageCount}</span>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------------- detail ---------------- */
function Fact({ label, children }) {
  return (<><dt>{label}</dt><dd>{children}</dd></>);
}

export function ItemDetail({ id, onClose, onChanged, setToast, api = moderationApi }) {
  const detail = useRpc(useCallback(() => api.get(id), [api, id]));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const item = detail.data;

  const act = async (action) => {
    if (action.needsNote && !note.trim()) { setError("Add a note for the student before you resolve or dismiss."); return; }
    setSaving(action.status);
    setError("");
    try {
      await api.setStatus(id, action.status, note);
      setToast(`Marked ${STATUS_LABEL[action.status].toLowerCase()}.${action.status === "resolved" ? " The student has been notified." : ""}`);
      setNote("");
      await detail.refetch().catch(() => {});
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving("");
    }
  };

  return (
    <div className="ul-cmi-backdrop" onClick={onClose}>
      <div className="ul-cmi-modal" role="dialog" aria-modal="true" aria-label="Moderation item" onClick={(e) => e.stopPropagation()}>
        <div className="ul-cmi-modal__head">
          <div>
            <div className="ul-cmi-modal__id">{item ? `${item.kindLabel}${item.categoryLabel ? ` · ${item.categoryLabel}` : ""}` : "Loading…"}</div>
            <h3 className="ul-cmi-modal__title">{item ? `${item.series.title}${item.test.title ? ` — ${item.test.title}` : ""}` : ""}</h3>
          </div>
          <div className="ul-cmi-modal__headright">
            {item && <StatusBadge item={item} />}
            <button type="button" className="ul-cmi-x" onClick={onClose} aria-label="Close"><IconClose size={14} /></button>
          </div>
        </div>

        <div className="ul-cmi-modal__body">
          {detail.loading && !item ? (
            <p className="ul-cmi-p" role="status">Loading…</p>
          ) : detail.error ? (
            <p className="ul-rh-error" role="alert">Couldn't load this item: {detail.error.message}</p>
          ) : item && (
            <>
              <dl className="ul-cmi-facts">
                <Fact label="Student">{item.student.name}{item.student.email ? ` (${item.student.email})` : ""}</Fact>
                <Fact label="Received">{fmtDateTime(item.createdAt)}</Fact>
                {item.rating && <Fact label="Rating">{stars(item.rating)} ({item.rating}/5)</Fact>}
                {item.attempt && (
                  <Fact label="Attempt">
                    #{item.attempt.number} · {item.attempt.percentage ?? "—"}% · submitted {fmtDateTime(item.attempt.submittedAt)}
                  </Fact>
                )}
                {item.reviewedAt && <Fact label="Last reviewed">{fmtDateTime(item.reviewedAt)}{item.reviewedByName ? ` by ${item.reviewedByName}` : ""}</Fact>}
              </dl>

              <h4 className="ul-cmi-h">Message</h4>
              <p className="ul-cmi-p" style={{ whiteSpace: "pre-line" }}>{item.message}</p>

              {item.question && (
                <>
                  <h4 className="ul-cmi-h">Question {item.question.position}</h4>
                  <p className="ul-cmi-p">{item.question.text}</p>
                </>
              )}

              {item.adminNote && (
                <div className="ul-cmi-resolution">
                  <h4 className="ul-cmi-h">Note to the student</h4>
                  <p className="ul-cmi-p">{item.adminNote}</p>
                </div>
              )}

              <h4 className="ul-cmi-h">History</h4>
              {item.history.length === 0 ? (
                <p className="ul-cmi-muted">No actions yet.</p>
              ) : (
                <ol className="ul-cmi-history">
                  {[...item.history].reverse().map((h, i) => (
                    <li key={i}>
                      <span className="ul-cmi-history__dot" />
                      <div>
                        <div className="ul-cmi-history__top"><strong>{h.from} → {h.to}</strong><span>{h.actorName}</span></div>
                        {h.note && <div className="ul-cmi-history__note">{h.note}</div>}
                        <small>{fmtDateTime(h.at)}</small>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>

        {item && (
          <div className="ul-cmi-modal__foot">
            <div className="ul-cmi-actionbox">
              <label className="ul-cmi-label" htmlFor="mod-note">Note to the student (required to resolve or dismiss)</label>
              <textarea id="mod-note" rows={3} maxLength={2000} value={note} onChange={(e) => { setNote(e.target.value); setError(""); }} />
              {error && <p className="ul-rh-error" role="alert">{error}</p>}
              <div className="ul-cmi-btnrow">
                {STATUS_ACTIONS.filter((a) => a.status !== item.status).map((a) => (
                  <button key={a.status} type="button"
                    className={`ul-btn ${a.status === "resolved" ? "ul-btn--primary" : "ul-btn--ghost"}`}
                    disabled={!!saving} onClick={() => act(a)}>
                    {saving === a.status ? "Saving…" : a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */
export default function ContentModeration() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "closed" ? "closed" : "open");
  const [openId, setOpenId] = useState(params.get("item"));
  const [toast, setToast] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const stats = useRpc(useCallback(() => moderationApi.stats(), []));

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const close = () => {
    setOpenId(null);
    if (params.get("item")) { const p = new URLSearchParams(params); p.delete("item"); setParams(p, { replace: true }); }
  };
  const changed = () => { setReloadKey((k) => k + 1); stats.refetch().catch(() => {}); };

  const s = stats.data;
  const cards = [
    { key: "new", label: "New", value: s?.new, note: "Needs your action", go: "open" },
    { key: "in_review", label: "In review", value: s?.in_review, note: "View", go: "open" },
    { key: "resolved", label: "Resolved", value: s?.resolved, note: "View", go: "closed" },
    { key: "dismissed", label: "Dismissed", value: s?.dismissed, note: "View", go: "closed" },
    { key: "rating", label: "Average rating", value: s?.avg_rating != null ? `${Number(s.avg_rating).toFixed(1)} / 5` : "—",
      note: s ? `${s.by_kind?.feedback ?? 0} feedback · ${s.by_kind?.query ?? 0} queries · ${s.by_kind?.issue ?? 0} issues` : "", go: null },
  ];

  return (
    <div>
      <div className="ul-edu-header">
        <div>
          <h2 className="ul-edu-header__title">Content Moderation</h2>
          <p className="ul-edu-header__subtitle">Feedback, questions and issue reports that students sent about their tests. Review them, reply and close them.</p>
        </div>
      </div>

      <div className="ul-cm-quickstats">
        {cards.map((c) => (
          <button key={c.key} type="button" className="ul-stat-card ul-cm-stat-card ul-cm-quickstat-button"
            onClick={() => c.go && setTab(c.go)} disabled={!c.go}>
            <span className="ul-stat-card__label">{c.label.toUpperCase()}</span>
            <span className="ul-stat-card__value">{stats.loading && !s ? "…" : stats.error ? "—" : c.value ?? 0}</span>
            <span className="ul-stat-card__trend is-up">{c.note}</span>
          </button>
        ))}
      </div>
      {stats.error && <p className="ul-rh-error" role="alert">Couldn't load the counts: {stats.error.message}</p>}

      <div className="ul-edp-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "open"} className={`ul-edp-tab${tab === "open" ? " is-active" : ""}`} onClick={() => setTab("open")}>Needs attention</button>
        <button type="button" role="tab" aria-selected={tab === "closed"} className={`ul-edp-tab${tab === "closed" ? " is-active" : ""}`} onClick={() => setTab("closed")}>Closed</button>
      </div>

      <ItemTable key={tab} tab={tab} onOpen={setOpenId} reloadKey={reloadKey} />

      {openId && <ItemDetail id={openId} onClose={close} onChanged={changed} setToast={setToast} />}
      {toast && <div className="ul-set-toast" role="status">{toast}</div>}
    </div>
  );
}

