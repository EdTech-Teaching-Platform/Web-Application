import { useMemo, useState } from "react";
import {
  IconBell,
  IconCheck,
  IconEdit,
  IconPlus,
  IconSearch,
} from "../components/icons";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./AuditLogs.css";

const notificationSeeds = [
  {
    id: "NT-204",
    title: "Scheduled platform maintenance",
    message: "The learning platform will be unavailable Sunday from 01:00 to 02:00 UTC.",
    type: "System",
    audience: "All users",
    channel: "In-app",
    status: "Published",
    scheduled: "Sep 21, 2026 · 01:00 UTC",
    createdBy: "Aisha Khan",
    delivery: { sent: 1842, delivered: 1811, opened: 1236, failed: 31 },
  },
  {
    id: "NT-203",
    title: "New educator verification policy",
    message: "Please review the updated verification checklist before approving new educators.",
    type: "Policy",
    audience: "Educators",
    channel: "Email + In-app",
    status: "Draft",
    scheduled: "Not scheduled",
    createdBy: "Marcus Lee",
    delivery: { sent: 0, delivered: 0, opened: 0, failed: 0 },
  },
  {
    id: "NT-202",
    title: "Refund review reminder",
    message: "There are three refund requests waiting for an Admin decision.",
    type: "Alert",
    audience: "Admins",
    channel: "In-app",
    status: "Published",
    scheduled: "Sent Sep 18, 2026",
    createdBy: "Aisha Khan",
    delivery: { sent: 14, delivered: 14, opened: 11, failed: 0 },
  },
  {
    id: "NT-201",
    title: "Fall learning paths are live",
    message: "Explore the new featured learning paths now available on the homepage.",
    type: "Announcement",
    audience: "All learners",
    channel: "In-app",
    status: "Paused",
    scheduled: "Sep 15, 2026 · 09:00 UTC",
    createdBy: "Nora Patel",
    delivery: { sent: 942, delivered: 928, opened: 604, failed: 14 },
  },
];

const notificationStatusClass = {
  Published: "is-approved",
  Draft: "is-pending",
  Paused: "is-account-inactive",
};

export default function AuditLogs() {
  const [notifications, setNotifications] = useState(notificationSeeds);
  const [notificationSearch, setNotificationSearch] = useState("");
  const [notificationFilter, setNotificationFilter] = useState("All");
  const [notificationAudience, setNotificationAudience] = useState("All");
  const [notificationChannel, setNotificationChannel] = useState("All");
  const [selectedNotificationIds, setSelectedNotificationIds] = useState([]);
  const [previewNotification, setPreviewNotification] = useState(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ title: "", message: "", type: "Announcement", audience: "All learners", channel: "In-app", schedule: "" });

  const filteredNotifications = useMemo(() => {
    const query = notificationSearch.trim().toLowerCase();
    return notifications.filter((item) => {
      const matchesSearch = !query || [item.id, item.title, item.message, item.audience, item.type].some((value) => value.toLowerCase().includes(query));
      const matchesFilter = notificationFilter === "All" || item.status === notificationFilter;
      const matchesAudience = notificationAudience === "All" || item.audience === notificationAudience;
      const matchesChannel = notificationChannel === "All" || item.channel === notificationChannel;
      return matchesSearch && matchesFilter && matchesAudience && matchesChannel;
    });
  }, [notifications, notificationSearch, notificationFilter, notificationAudience, notificationChannel]);

  const openComposer = (notification = null) => {
    setEditingId(notification?.id || null);
    setDraft(notification ? { title: notification.title, message: notification.message, type: notification.type, audience: notification.audience, channel: notification.channel, schedule: notification.scheduled === "Not scheduled" ? "" : notification.scheduled } : { title: "", message: "", type: "Announcement", audience: "All learners", channel: "In-app", schedule: "" });
    setIsComposerOpen(true);
  };

  const saveNotification = (event) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.message.trim()) return;

    if (editingId) {
      setNotifications((current) => current.map((item) => (item.id === editingId ? { ...item, ...draft, scheduled: draft.schedule || "Not scheduled" } : item)));
    } else {
      setNotifications((current) => [{ id: `NT-${205 + current.length}`, ...draft, status: "Draft", scheduled: draft.schedule || "Not scheduled", createdBy: "Current admin", delivery: { sent: 0, delivered: 0, opened: 0, failed: 0 } }, ...current]);
    }
    setIsComposerOpen(false);
    setEditingId(null);
  };

  const updateNotificationStatus = (id, status) => {
    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, status, scheduled: status === "Published" ? "Sent just now" : item.scheduled } : item)));
  };

  const toggleNotificationSelection = (id) => {
    setSelectedNotificationIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const selectVisibleNotifications = () => {
    const visibleIds = filteredNotifications.map((item) => item.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedNotificationIds.includes(id));
    setSelectedNotificationIds((current) => allSelected ? current.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...current, ...visibleIds])));
  };

  return (
    <div className="ul-audit-page">
      <div className="ul-dash-welcome ul-audit-welcome">
        <div>
          <h2 className="ul-dash-welcome__title">Notification Management</h2>
          <p className="ul-dash-welcome__subtitle">Manage platform notifications sent across the admin portal.</p>
        </div>
        <button type="button" className="ul-btn ul-btn--primary" onClick={() => openComposer()}><IconPlus size={14} /> Create notification</button>
      </div>

      <div className="ul-audit-stats">
            <div className="ul-stat-card"><span className="ul-stat-card__label">TOTAL NOTIFICATIONS</span><span className="ul-stat-card__value">{notifications.length}</span><span className="ul-stat-card__trend is-up">Managed locally</span></div>
            <div className="ul-stat-card"><span className="ul-stat-card__label">PUBLISHED</span><span className="ul-stat-card__value">{notifications.filter((item) => item.status === "Published").length}</span><span className="ul-stat-card__trend is-up">Active delivery</span></div>
            <div className="ul-stat-card"><span className="ul-stat-card__label">DRAFTS</span><span className="ul-stat-card__value">{notifications.filter((item) => item.status === "Draft").length}</span><span className="ul-stat-card__trend is-up">Ready to edit</span></div>
            <div className="ul-stat-card"><span className="ul-stat-card__label">DELIVERY RATE</span><span className="ul-stat-card__value">{(() => { const totals = notifications.reduce((sum, item) => ({ sent: sum.sent + item.delivery.sent, delivered: sum.delivered + item.delivery.delivered }), { sent: 0, delivered: 0 }); return totals.sent ? `${Math.round((totals.delivered / totals.sent) * 100)}%` : "0%"; })()}</span><span className="ul-stat-card__trend is-up">Published delivery</span></div>
          </div>

          <div className="ul-card ul-audit-panel">
            <div className="ul-audit-toolbar">
              <label className="ul-edu-search"><IconSearch size={14} color="var(--color-text-muted)" /><input value={notificationSearch} onChange={(event) => setNotificationSearch(event.target.value)} placeholder="Search notifications…" /></label>
              <select value={notificationFilter} onChange={(event) => setNotificationFilter(event.target.value)}><option>All</option><option>Published</option><option>Draft</option><option>Paused</option></select>
              <select value={notificationAudience} onChange={(event) => setNotificationAudience(event.target.value)}><option>All</option><option>All users</option><option>All learners</option><option>Educators</option><option>Admins</option></select>
              <select value={notificationChannel} onChange={(event) => setNotificationChannel(event.target.value)}><option>All</option><option>In-app</option><option>Email</option><option>Email + In-app</option></select>
            </div>
            <div className="ul-notification-table">
              <div className="ul-notification-table__head"><span><label className="ul-audit-select-all"><input type="checkbox" checked={filteredNotifications.length > 0 && filteredNotifications.every((item) => selectedNotificationIds.includes(item.id))} onChange={selectVisibleNotifications} /> Select all</label></span><span>Notification</span><span>Audience / Delivery</span><span>Status</span><span>Actions</span></div>
              {filteredNotifications.map((item) => (
                <div className="ul-notification-row" key={item.id}>
                  <label className="ul-audit-row-check"><input type="checkbox" checked={selectedNotificationIds.includes(item.id)} onChange={() => toggleNotificationSelection(item.id)} /></label>
                  <div className="ul-notification-row__main"><span className="ul-mgmt-type-tag">{item.id}</span><strong>{item.title}</strong><p>{item.message}</p><small>{item.type} · Created by {item.createdBy} · {item.scheduled}</small></div>
                  <div className="ul-notification-row__meta"><span>{item.audience} · {item.channel}</span><small>Delivered {item.delivery.delivered} / {item.delivery.sent} · Opened {item.delivery.opened}</small></div>
                  <span className={`ul-status-badge ${notificationStatusClass[item.status]}`}>{item.status}</span>
                  <div className="ul-audit-actions"><button type="button" className="ul-btn ul-btn--ghost" onClick={() => setPreviewNotification(item)}>Preview</button><button type="button" className="ul-btn ul-btn--ghost" onClick={() => openComposer(item)}><IconEdit size={13} /> Edit</button>{item.status === "Published" ? <button type="button" className="ul-btn ul-btn--ghost" onClick={() => updateNotificationStatus(item.id, "Paused")}>Pause</button> : <button type="button" className="ul-btn ul-btn--primary" onClick={() => updateNotificationStatus(item.id, "Published")}>{item.status === "Paused" ? "Resume" : "Publish"}</button>}</div>
                </div>
              ))}
              {!filteredNotifications.length && <p className="ul-audit-empty">No notifications match the current search or filter.</p>}
            </div>
          </div>

      {isComposerOpen && <div className="ul-audit-modal-backdrop" role="presentation" onMouseDown={() => setIsComposerOpen(false)}><form className="ul-audit-modal" onSubmit={saveNotification} onMouseDown={(event) => event.stopPropagation()}><div className="ul-audit-modal__head"><div><span className="ul-card__eyebrow"><IconBell size={12} /> notification composer</span><h3>{editingId ? "Edit notification" : "Create notification"}</h3></div><button type="button" className="ul-btn ul-btn--ghost" onClick={() => setIsComposerOpen(false)}>Close</button></div><label>Title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required /></label><label>Message<textarea value={draft.message} onChange={(event) => setDraft({ ...draft, message: event.target.value })} rows={4} required /></label><div className="ul-audit-form-grid"><label>Type<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}><option>Announcement</option><option>Policy</option><option>Alert</option><option>System</option></select></label><label>Audience<select value={draft.audience} onChange={(event) => setDraft({ ...draft, audience: event.target.value })}><option>All learners</option><option>All users</option><option>Educators</option><option>Admins</option></select></label><label>Channel<select value={draft.channel} onChange={(event) => setDraft({ ...draft, channel: event.target.value })}><option>In-app</option><option>Email</option><option>Email + In-app</option></select></label></div><label>Schedule delivery<input type="datetime-local" value={draft.schedule} onChange={(event) => setDraft({ ...draft, schedule: event.target.value })} /></label><div className="ul-audit-modal__actions"><button type="button" className="ul-btn ul-btn--ghost" onClick={() => setIsComposerOpen(false)}>Cancel</button><button type="submit" className="ul-btn ul-btn--primary">Save as draft</button></div></form></div>}

      {previewNotification && <div className="ul-audit-modal-backdrop" role="presentation" onMouseDown={() => setPreviewNotification(null)}><div className="ul-audit-modal ul-notification-preview" onMouseDown={(event) => event.stopPropagation()}><div className="ul-audit-modal__head"><div><span className="ul-card__eyebrow"><IconBell size={12} /> recipient preview</span><h3>{previewNotification.title}</h3></div><button type="button" className="ul-btn ul-btn--ghost" onClick={() => setPreviewNotification(null)}>Close</button></div><div className="ul-notification-preview__message">{previewNotification.message}</div><div className="ul-audit-detail-grid"><span>Audience<strong>{previewNotification.audience}</strong></span><span>Channel<strong>{previewNotification.channel}</strong></span><span>Status<strong>{previewNotification.status}</strong></span><span>Delivery<strong>{previewNotification.delivery.delivered} delivered</strong></span></div></div></div>}
    </div>
  );
}
