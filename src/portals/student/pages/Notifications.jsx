// /student/notifications: the student's real inbox (student_list_notifications,
// 20261107090000). Report resolutions from the admin's content moderation land
// here and stay after the popup is gone. Opening one marks it read and follows
// its link (the test series) when it has one.
import { useNavigate } from "react-router-dom";
import StatusBadge from "../../../components/ui/StatusBadge";
import { useStudentNotifications } from "../hooks/useStudentNotifications";
import { categoryLabel, notificationsApi } from "../services/notificationsApi";

function when(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return `Today, ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Notifications({ api = notificationsApi }) {
  const navigate = useNavigate();
  const inbox = useStudentNotifications({ api, limit: 100, intervalMs: 0 });

  const open = async (item) => {
    if (!item.isRead) await inbox.markRead(item.id);
    if (item.actionUrl) navigate(item.actionUrl);
  };

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Stay in the loop</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text">Notifications</h1>
          <p className="mt-2 text-sm text-text/60">
            {inbox.loading && !inbox.loaded ? "Loading…" : inbox.unread ? `${inbox.unread} unread update${inbox.unread === 1 ? "" : "s"}` : "You're all caught up."}
          </p>
        </div>
        {inbox.unread > 0 && (
          <button type="button" onClick={inbox.markAllRead} className="text-sm font-semibold text-primary hover:underline">
            Mark all as read
          </button>
        )}
      </div>

      {inbox.error && !inbox.loaded && (
        <div role="alert" className="mt-6 rounded-xl bg-danger/10 p-4 text-sm text-danger">
          {inbox.error.message || "We couldn't load your notifications."}{" "}
          <button type="button" className="font-semibold underline" onClick={inbox.refresh}>Try again</button>
        </div>
      )}

      <div className="mt-6 space-y-2">
        {inbox.loaded && inbox.rows.length === 0 && (
          <p className="rounded-xl border border-text/10 bg-white p-6 text-center text-sm text-text/55">
            No notifications yet. When an admin resolves an issue you reported, it shows up here.
          </p>
        )}
        {inbox.rows.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => open(item)}
            className={`block w-full rounded-xl border p-4 text-left transition-colors ${item.isRead ? "border-text/10 bg-white" : "border-primary/20 bg-primary/[0.03] hover:bg-primary/[0.06]"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={item.isRead ? "success" : "warning"}>{categoryLabel(item.category)}</StatusBadge>
                  {!item.isRead && <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread" />}
                </div>
                <h2 className="mt-3 font-display text-base font-semibold text-text">{item.title}</h2>
                {item.body && <p className="mt-1 whitespace-pre-line text-sm text-text/60">{item.body}</p>}
                {item.actionUrl && <p className="mt-2 text-xs font-semibold text-primary">Open the test series →</p>}
              </div>
              <span className="shrink-0 text-xs text-text/40">{when(item.createdAt)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
