import { useMemo, useState } from "react";
import { IconSearch } from "../components/icons";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./ContentModeration.css";

const initialReports = [
  {
    id: "CM-1042",
    type: "User Report",
    priority: "High",
    severity: "high",
    title: "Inappropriate course review left on a public lesson",
    summary:
      "A learner reported a review containing abusive language and personal attacks. The post is publicly visible and linked to a course page.",
    reporter: "Ana Perez",
    content: "Course Review · Graphic Design Foundations",
    status: "Under review",
    created: "2 hours ago",
    note: "Escalate to trust and notify the course owner. Review the platform policy timeline before action.",
  },
  {
    id: "CM-1039",
    type: "Flagged Content",
    priority: "Medium",
    severity: "medium",
    title: "Misleading title on featured program card",
    summary:
      "The featured card uses a discounted label that is not visible on the actual course page, which may be misleading to learners.",
    reporter: "System",
    content: "Homepage · Featured Programs",
    status: "Pending",
    created: "6 hours ago",
    note: "Need copy approval before publishing the updated headline and pricing text.",
  },
  {
    id: "CM-1034",
    type: "User Report",
    priority: "Critical",
    severity: "critical",
    title: "Harassment complaint involving direct messages",
    summary:
      "Two users reported repeated harassment and threats in a private message thread. One message contains a direct threat.",
    reporter: "Maya Nelson",
    content: "DM Thread · Instructor / Student",
    status: "Resolved",
    created: "Yesterday",
    note: "Resolved after message archive collection and user notification. Case closed by moderator review.",
  },
  {
    id: "CM-1028",
    type: "Flagged Content",
    priority: "Low",
    severity: "low",
    title: "Homepage banner uses outdated discount date",
    summary:
      "The Summer Launch banner still lists a date that expired last week. Content is still live and visible on mobile.",
    reporter: "Marketing Ops",
    content: "Homepage · Banner A",
    status: "Dismissed",
    created: "2 days ago",
    note: "Marketing confirmed the banner is intentionally kept active for a rolling campaign window.",
  },
];


const severityMap = {
  low: "ul-cm-tag ul-cm-tag--neutral",
  medium: "ul-cm-tag ul-cm-tag--warning",
  high: "ul-cm-tag ul-cm-tag--warning",
  critical: "ul-cm-tag ul-cm-tag--danger",
};

const priorityMap = {
  Low: "ul-cm-priority ul-cm-priority--low",
  Medium: "ul-cm-priority ul-cm-priority--medium",
  High: "ul-cm-priority ul-cm-priority--high",
  Critical: "ul-cm-priority ul-cm-priority--critical",
};

const statusMap = {
  Pending: "ul-status-badge is-pending",
  "Under review": "ul-status-badge is-pending",
  Resolved: "ul-status-badge is-approved",
  Dismissed: "ul-status-badge is-account-inactive",
  Escalated: "ul-status-badge is-rejected",
  Scheduled: "ul-status-badge is-verified",
};

function initialsOf(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function ContentModeration() {
  const [reports, setReports] = useState(initialReports);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((item) => {
      const matchesSearch =
        !q ||
        [
          item.title,
          item.summary,
          item.type,
          item.content,
          item.reporter,
          item.status,
          item.priority,
          item.note,
        ].some((value) => String(value).toLowerCase().includes(q));

      const matchesStatus = statusFilter === "All" || item.status === statusFilter;
      const matchesPriority =
        priorityFilter === "All" ||
        item.priority === priorityFilter ||
        (priorityFilter === "High+" && ["High", "Critical"].includes(item.priority));

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [reports, search, statusFilter, priorityFilter]);

  const stats = useMemo(() => {
    const pending = reports.filter((r) => r.status === "Pending").length;
    const underReview = reports.filter((r) => r.status === "Under review").length;
    const resolved = reports.filter((r) => ["Resolved", "Dismissed"].includes(r.status)).length;
    const highPriority = reports.filter((r) => ["High", "Critical"].includes(r.priority)).length;

    return [
      { key: "pending", label: "Pending", value: pending },
      { key: "underReview", label: "Pending", value: underReview },
      { key: "resolved", label: "Resolved", value: resolved },
      { key: "highPriority", label: "High Priority", value: highPriority },
    ];
  }, [reports]);

  const updateReport = (id, nextFields) => {
    setReports((current) => current.map((item) => (item.id === id ? { ...item, ...nextFields } : item)));
  };

  const applyQuickStatFilter = (key) => {
    if (key === "pending") {
      setStatusFilter("Pending");
      setPriorityFilter("All");
      return;
    }

    if (key === "underReview") {
      setStatusFilter("Under review");
      setPriorityFilter("All");
      return;
    }

    if (key === "resolved") {
      setStatusFilter("Resolved");
      setPriorityFilter("All");
      return;
    }

    if (key === "highPriority") {
      setPriorityFilter("High+");
      setStatusFilter("All");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setPriorityFilter("All");
  };

  return (
    <>
      <div className="ul-dash-welcome ul-cm-layout">
        <div>
          <h2 className="ul-dash-welcome__title">Content Moderation</h2>
          <p className="ul-dash-welcome__subtitle">
            Review flagged content and moderate user reports.
          </p>
        </div>
      </div>

      <div className="ul-cm-quickstats">
        {stats.map((item) => (
          <button
            key={item.key}
            type="button"
            className="ul-stat-card ul-cm-stat-card ul-cm-quickstat-button"
            onClick={() => applyQuickStatFilter(item.key)}
          >
            <span className="ul-stat-card__label">{item.label.toUpperCase()}</span>
            <span className="ul-stat-card__value">{item.value}</span>
            <span className="ul-stat-card__trend is-up">
              {item.key === "highPriority" ? "Priority filter" : "Live queue"}
            </span>
          </button>
        ))}
      </div>

      <div className="ul-cm-filterbar">
        <label className="ul-cm-filter-control">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="All">All</option>
            <option value="Pending">Pending</option>
            <option value="Under review">Pending</option>
            <option value="Resolved">Resolved</option>
            <option value="Dismissed">Dismissed</option>
          </select>
        </label>

        <label className="ul-cm-filter-control">
          <span>Priority</span>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            <option value="All">All</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
            <option value="High+">High and Critical</option>
          </select>
        </label>

        <button type="button" className="ul-btn ul-btn--ghost" onClick={clearFilters}>
          Clear filters
        </button>
      </div>

      <div className="ul-edu-toolbar" style={{ marginBottom: 18 }}>
        <label className="ul-edu-search">
          <IconSearch size={14} color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder="Search reports or content…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      <div className="ul-card ul-cm-list-card">
          <div className="ul-cm-list">
            {filteredReports.length === 0 ? (
              <p className="ul-cm-empty">No matching reports found.</p>
            ) : (
              filteredReports.map((report) => (
                <div className={`ul-cm-report${report.disabled ? " ul-cm-report--disabled" : ""}`} key={report.id}>
                  <div className="ul-cm-report__header">
                    <div className="ul-cm-report__meta">
                      <span className="ul-cm-tag ul-cm-tag--neutral">{report.type}</span>
                      <span className={severityMap[report.severity]}>{report.severity}</span>
                      <label className="ul-cm-priority-select">
                        <span>Priority</span>
                        <select
                          value={report.priority}
                          disabled={report.disabled}
                          onChange={(event) => updateReport(report.id, { priority: event.target.value })}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Critical">Critical</option>
                        </select>
                      </label>
                      <span className={priorityMap[report.priority]}>{report.priority} priority</span>
                    </div>
                    <span className={statusMap[report.status]}>{report.status === "Under review" ? "Pending" : report.status}</span>
                  </div>

                  <div>
                    <div className="ul-cm-report__title">{report.title}</div>
                    <p className="ul-cm-report__summary">{report.summary}</p>
                  </div>

                  <div className="ul-cm-notes">
                    <label className="ul-cm-notes__label">Moderation notes</label>
                    <textarea
                      rows={2}
                      value={report.note}
                      disabled={report.disabled}
                      onChange={(event) => updateReport(report.id, { note: event.target.value })}
                      placeholder="Add moderator notes…"
                    />
                  </div>

                  <div className="ul-cm-report__foot">
                    <div className="ul-cm-report__info">
                      <span className="ul-approval-row__name">{report.content}</span>
                      <span>·</span>
                      <span>Reported by {report.reporter}</span>
                      <span>·</span>
                      <span>{report.created}</span>
                    </div>
                    <div className="ul-cm-actions">
                      <button type="button" className="ul-btn ul-btn--primary" disabled={report.disabled} onClick={() => updateReport(report.id, { status: "Resolved" })}>
                        Resolve
                      </button>
                      <button type="button" className="ul-btn ul-btn--ghost" disabled={report.disabled} onClick={() => updateReport(report.id, { status: "Dismissed", disabled: true })}>
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
    </>
  );
}
