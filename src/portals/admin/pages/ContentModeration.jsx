// Content Moderation — issues handled by Regional Heads.
//   • Resolved by Regional Heads — read-only view so the Admin can keep an eye
//     on what Regional Heads resolved or rejected.
//   • Escalated to Admin — issues Regional Heads escalated; the Admin resolves
//     them (with a comment) and the Regional Head is notified.
// Rows come from ../data/contentIssuesMock.js (one record per issue, with an
// audit history).

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { IconSearch, IconClose } from "../components/icons";
import { REGIONS } from "../data/regionalHeadsMock";
import {
  CONTENT_TYPES,
  ESCALATION_REASONS,
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_BADGE,
  isResolvedSection,
  isEscalatedSection,
  useContentIssues,
  adminResolve,
} from "../data/contentIssuesMock";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./RegionalHeads.css";
import "./ContentModeration.css";

const PAGE_SIZE = 8;

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

function StatusBadge({ status }) {
  return <span className={`ul-status-badge ${ISSUE_STATUS_BADGE[status]}`}>{ISSUE_STATUS_LABEL[status]}</span>;
}

const TABLES = {
  resolved: {
    statuses: ["resolved", "head_rejected"],
    columns: [
      { key: "id", label: "Issue ID", sort: (i) => i.id },
      { key: "title", label: "Content", sort: (i) => i.title.toLowerCase() },
      { key: "contentType", label: "Type", sort: (i) => i.contentType },
      { key: "flaggedBy", label: "Flagged by", sort: (i) => i.flaggedBy.toLowerCase() },
      { key: "headName", label: "Regional Head", sort: (i) => i.headName.toLowerCase() },
      { key: "region", label: "Region", sort: (i) => i.region },
      { key: "resolution", label: "Resolution", sort: null },
      { key: "flaggedAt", label: "Flagged", sort: (i) => i.flaggedAt },
      { key: "headResolvedAt", label: "Closed", sort: (i) => i.headResolvedAt || "" },
      { key: "status", label: "Status", sort: (i) => i.status },
    ],
  },
  escalated: {
    statuses: ["escalated", "admin_resolved"],
    columns: [
      { key: "id", label: "Issue ID", sort: (i) => i.id },
      { key: "title", label: "Content", sort: (i) => i.title.toLowerCase() },
      { key: "contentType", label: "Type", sort: (i) => i.contentType },
      { key: "flaggedBy", label: "Flagged by", sort: (i) => i.flaggedBy.toLowerCase() },
      { key: "headName", label: "Escalated by", sort: (i) => i.headName.toLowerCase() },
      { key: "region", label: "Region", sort: (i) => i.region },
      { key: "escalationReason", label: "Reason", sort: (i) => i.escalationReason },
      { key: "flaggedAt", label: "Flagged", sort: (i) => i.flaggedAt },
      { key: "escalatedAt", label: "Escalated", sort: (i) => i.escalatedAt || "" },
      { key: "resolution", label: "Resolution", sort: null },
      { key: "status", label: "Status", sort: (i) => i.status },
      { key: "action", label: "Action", sort: null },
    ],
  },
};

function cell(i, key, section) {
  switch (key) {
    case "id": return <span className="ul-rh-strong">{i.id}</span>;
    case "title":
      return (
        <div className="ul-cmi-title">
          <span className="ul-rh-strong">{i.title}</span>
          <span className="ul-rh-sub">{i.contentRef}</span>
        </div>
      );
    case "region": return <span className="ul-rh-region-chip">{i.region}</span>;
    case "resolution": return <span className="ul-cmi-clip" title={i.resolution}>{i.resolution || "—"}</span>;
    case "escalationReason": return <span className="ul-cmi-clip" title={i.escalationNote}>{i.escalationReason || "—"}</span>;
    case "flaggedAt": return fmtDate(i.flaggedAt);
    case "headResolvedAt": return fmtDate(i.headResolvedAt);
    case "escalatedAt": return fmtDate(i.escalatedAt);
    case "status": return <StatusBadge status={i.status} />;
    case "action":
      return (
        <button type="button" className="ul-btn ul-btn--ghost ul-rh-btn">
          {i.status === "escalated" ? "Resolve" : "View"}
        </button>
      );
    default: return i[key];
  }
}

function IssueTable({ section, issues, onOpen, setToast }) {
  const cfg = TABLES[section];
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("all");
  const [head, setHead] = useState("all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [reason, setReason] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState({ key: section === "escalated" ? "escalatedAt" : "headResolvedAt", dir: "desc" });
  const [page, setPage] = useState(1);

  const heads = useMemo(() => [...new Set(issues.map((i) => i.headName))].sort(), [issues]);
  const hasFilters = search || region !== "all" || head !== "all" || type !== "all" || status !== "all" || reason !== "all" || from || to;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromMs = from ? new Date(from).getTime() : null;
    const toMs = to ? new Date(to).getTime() + 86399999 : null;
    const col = cfg.columns.find((c) => c.key === sort.key);
    const list = issues.filter((i) => {
      if (q && !`${i.id} ${i.title} ${i.contentRef} ${i.flaggedBy} ${i.headName} ${i.region} ${i.resolution} ${i.escalationReason} ${i.flagReason}`.toLowerCase().includes(q)) return false;
      if (region !== "all" && i.region !== region) return false;
      if (head !== "all" && i.headName !== head) return false;
      if (type !== "all" && i.contentType !== type) return false;
      if (status !== "all" && i.status !== status) return false;
      if (reason !== "all" && i.escalationReason !== reason) return false;
      const t = new Date(i.flaggedAt).getTime();
      if (fromMs !== null && t < fromMs) return false;
      if (toMs !== null && t > toMs) return false;
      return true;
    });
    if (col && col.sort) {
      list.sort((a, b) => {
        const x = col.sort(a), y = col.sort(b);
        return (x < y ? -1 : x > y ? 1 : 0) * (sort.dir === "asc" ? 1 : -1);
      });
    }
    return list;
  }, [issues, search, region, head, type, status, reason, from, to, sort, cfg]);

  useEffect(() => { setPage(1); }, [search, region, head, type, status, reason, from, to]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const clear = () => { setSearch(""); setRegion("all"); setHead("all"); setType("all"); setStatus("all"); setReason("all"); setFrom(""); setTo(""); };
  const toggleSort = (c) => {
    if (!c.sort) return;
    setSort((s) => (s.key === c.key ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: "asc" }));
  };

  return (
    <>
      <div className="ul-edu-toolbar ul-cmi-toolbar">
        <label className="ul-edu-search">
          <IconSearch size={14} color="var(--color-text-muted)" />
          <input type="text" placeholder="Search by ID, content, person or region…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && (
            <button type="button" className="ul-edu-search__clear" onClick={() => setSearch("")} aria-label="Clear search"><IconClose size={12} /></button>
          )}
        </label>
        <select className="ul-edu-select" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="all">Region: All</option>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="ul-edu-select" value={head} onChange={(e) => setHead(e.target.value)}>
          <option value="all">Regional Head: All</option>
          {heads.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <select className="ul-edu-select" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">Type: All</option>
          {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {(
          <select className="ul-edu-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Status: All</option>
            {cfg.statuses.map((s) => <option key={s} value={s}>{ISSUE_STATUS_LABEL[s]}</option>)}
          </select>
        )}
        {section === "escalated" && (
          <select className="ul-edu-select" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="all">Reason: All</option>
            {ESCALATION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        <label className="ul-cmi-date"><span>Flagged from</span><input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="ul-cmi-date"><span>to</span><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
        {hasFilters && <button type="button" className="ul-btn ul-btn--ghost ul-rh-btn" onClick={clear}>Clear</button>}
      </div>

      <div className="ul-card ul-edu-table-card">
        {rows.length === 0 ? (
          <div className="ul-edu-empty">
            {issues.length === 0
              ? section === "resolved" ? "No issues have been resolved or rejected by Regional Heads yet." : "No issues have been escalated to Admin."
              : "No issues match these filters."}
          </div>
        ) : (
          <div className="ul-edu-table-scroll ul-cmi-scroll">
            <table className="ul-edu-table ul-cmi-table">
              <thead>
                <tr>
                  {cfg.columns.map((c) => (
                    <th key={c.key} className={c.sort ? "is-sortable" : ""} aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((i) => (
                  <tr key={i.id} className="ul-edu-row--clickable" onClick={() => onOpen(i.id)}>
                    {cfg.columns.map((c) => <td key={c.key}>{cell(i, c.key, section)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 0 && (
          <div className="ul-edu-pagination">
            <span className="ul-edu-pagination__info">Showing {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, rows.length)} of {rows.length}</span>
            <div className="ul-edu-pagination__controls">
              <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)}>Prev</button>
              <span>{current} / {pageCount}</span>
              <button type="button" disabled={current === pageCount} onClick={() => setPage(current + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------------- detail modal ---------------- */
function Fact({ label, children }) {
  return (<><dt>{label}</dt><dd>{children}</dd></>);
}

function IssueDetail({ issue, onClose, setToast }) {
  const bodyRef = useRef(null);
  const [resolving, setResolving] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { setResolving(false); setComment(""); setError(""); }, [issue.id, issue.status]);

  const canResolve = issue.status === "escalated";

  const submit = () => {
    const res = adminResolve(issue.id, comment);
    if (!res.ok) { setError(res.error); return; }
    setToast(`${issue.id} resolved — ${issue.headName} has been notified.`);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    setResolving(false); setComment(""); setError("");
  };

  return (
    <div className="ul-cmi-backdrop" onClick={onClose}>
      <div className="ul-cmi-modal" role="dialog" aria-modal="true" aria-label={`Issue ${issue.id}`} onClick={(e) => e.stopPropagation()}>
        <div className="ul-cmi-modal__head">
          <div>
            <div className="ul-cmi-modal__id">{issue.id} · {issue.contentType}</div>
            <h3 className="ul-cmi-modal__title">{issue.title}</h3>
          </div>
          <div className="ul-cmi-modal__headright">
            <StatusBadge status={issue.status} />
            <button type="button" className="ul-cmi-x" onClick={onClose} aria-label="Close"><IconClose size={14} /></button>
          </div>
        </div>

        <div className="ul-cmi-modal__body" ref={bodyRef}>
          <dl className="ul-cmi-facts">
            <Fact label="Content">{issue.contentRef || "—"}</Fact>
            <Fact label="Region">{issue.region}</Fact>
            <Fact label="Flagged by">{issue.flaggedBy}</Fact>
            <Fact label="Regional Head">{issue.headName}</Fact>
            <Fact label="Date flagged">{fmtDateTime(issue.flaggedAt)}</Fact>
            {issue.status !== "escalated" && issue.status !== "admin_resolved" && <Fact label="Closed by head">{fmtDateTime(issue.headResolvedAt)}</Fact>}
            {issue.escalatedAt && <Fact label="Date escalated">{fmtDateTime(issue.escalatedAt)}</Fact>}
            {issue.closedAt && <Fact label="Resolved by Admin">{fmtDateTime(issue.closedAt)}</Fact>}
          </dl>

          {issue.resolution && (
            <div className="ul-cmi-resolution">
              <h4 className="ul-cmi-h">{issue.status === "head_rejected" ? "Rejection reason" : issue.status === "admin_resolved" ? "Resolution (by Admin)" : "Resolution"}</h4>
              <p className="ul-cmi-p">{issue.resolution}</p>
            </div>
          )}
          <h4 className="ul-cmi-h">Original flag reason</h4>
          <p className="ul-cmi-p"><strong>{issue.flagReason}</strong>{issue.description ? ` — ${issue.description}` : ""}</p>

          {issue.escalationReason && (
            <>
              <h4 className="ul-cmi-h">Escalation reason</h4>
              <p className="ul-cmi-p"><strong>{issue.escalationReason}</strong>{issue.escalationNote ? ` — ${issue.escalationNote}` : ""}</p>
            </>
          )}

          <h4 className="ul-cmi-h">History</h4>
          <ol className="ul-cmi-history">
            {[...issue.history].reverse().map((h) => (
              <li key={h.id}>
                <span className="ul-cmi-history__dot" />
                <div>
                  <div className="ul-cmi-history__top"><strong>{h.action}</strong><span>{h.actor} · {h.role}</span></div>
                  {h.note && <div className="ul-cmi-history__note">{h.note}</div>}
                  <small>{fmtDateTime(h.at)}</small>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {canResolve && (
        <div className="ul-cmi-modal__foot">
          {resolving ? (
            <div className="ul-cmi-actionbox">
              <div className="ul-cmi-actionbox__title">Resolve this issue</div>
              <p className="ul-cmi-muted">{issue.headName} is notified with your comment.</p>
              <label className="ul-cmi-label">Resolution comment *</label>
              <textarea rows={3} value={comment} onChange={(e) => { setComment(e.target.value); setError(""); }} />
              {error && <p className="ul-rh-error">{error}</p>}
              <div className="ul-cmi-btnrow">
                <button type="button" className="ul-btn ul-btn--ghost" onClick={() => { setResolving(false); setError(""); }}>Cancel</button>
                <button type="button" className="ul-btn ul-btn--primary" onClick={submit}>Resolve</button>
              </div>
            </div>
          ) : (
            <div className="ul-cmi-btnrow">
              <button type="button" className="ul-btn ul-btn--primary" onClick={() => setResolving(true)}>Resolve</button>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */
export default function ContentModeration() {
  const issues = useContentIssues();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(["resolved", "escalated"].includes(params.get("tab")) ? params.get("tab") : "resolved");
  const [openId, setOpenId] = useState(params.get("issue"));
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const resolvedIssues = useMemo(() => issues.filter(isResolvedSection), [issues]);
  const escalatedIssues = useMemo(() => issues.filter(isEscalatedSection), [issues]);
  const stats = useMemo(() => ({
    resolved: issues.filter((i) => i.status === "resolved").length,
    rejected: issues.filter((i) => i.status === "head_rejected").length,
    escalated: escalatedIssues.length,
    awaiting: issues.filter((i) => i.status === "escalated").length,
  }), [issues, escalatedIssues]);

  const selected = openId ? issues.find((i) => i.id === openId) : null;
  const close = () => {
    setOpenId(null);
    if (params.get("issue")) { const p = new URLSearchParams(params); p.delete("issue"); setParams(p, { replace: true }); }
  };

  const cards = [
    { key: "resolved", label: "Resolved by Regional Heads", value: stats.resolved, note: "View", go: "resolved" },
    { key: "rejected", label: "Rejected by Regional Heads", value: stats.rejected, note: "View", go: "resolved" },
    { key: "escalated", label: "Escalated to Admin", value: stats.escalated, note: "View", go: "escalated" },
    { key: "awaiting", label: "Awaiting Admin Review", value: stats.awaiting, note: "Needs your action", go: "escalated" },
  ];

  return (
    <div>
      <div className="ul-edu-header">
        <div>
          <h2 className="ul-edu-header__title">Content Moderation</h2>
          <p className="ul-edu-header__subtitle">Keep an eye on what Regional Heads resolved or rejected, and resolve the issues they escalated to you.</p>
        </div>
      </div>

      <div className="ul-cm-quickstats">
        {cards.map((c) => (
          <button key={c.key} type="button" className="ul-stat-card ul-cm-stat-card ul-cm-quickstat-button" onClick={() => setTab(c.go)}>
            <span className="ul-stat-card__label">{c.label.toUpperCase()}</span>
            <span className="ul-stat-card__value">{c.value}</span>
            <span className="ul-stat-card__trend is-up">{c.note}</span>
          </button>
        ))}
      </div>

      <div className="ul-edp-tabs" role="tablist">
        <button type="button" role="tab" className={`ul-edp-tab${tab === "resolved" ? " is-active" : ""}`} onClick={() => setTab("resolved")}>Resolved by Regional Heads</button>
        <button type="button" role="tab" className={`ul-edp-tab${tab === "escalated" ? " is-active" : ""}`} onClick={() => setTab("escalated")}>
          Escalated to Admin{stats.awaiting > 0 && <span className="ul-edp-tab__dot" />}
        </button>
      </div>

      {tab === "resolved" && <IssueTable key="resolved" section="resolved" issues={resolvedIssues} onOpen={setOpenId} setToast={setToast} />}
      {tab === "escalated" && <IssueTable key="escalated" section="escalated" issues={escalatedIssues} onOpen={setOpenId} setToast={setToast} />}

      {selected && <IssueDetail issue={selected} onClose={close} setToast={setToast} />}
      {toast && <div className="ul-usr-toast">{toast}</div>}
    </div>
  );
}
