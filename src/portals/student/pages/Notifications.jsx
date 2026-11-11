// /student/notifications: the student's real inbox (student_list_notifications,
// 20261107090000). Report resolutions from the admin's content moderation land
// here and stay after the popup is gone. Opening one marks it read and follows
// its link (the test series) when it has one.
import { useNavigate } from "react-router-dom";
import { BellIcon, ChevronRightIcon } from "../../../components/ui/icons";
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

const WIDE = "mx-auto w-full max-w-4xl space-y-6 px-4 py-4 sm:space-y-8 sm:px-6 sm:py-6 lg:px-8";
const SURFACE = "rounded-2xl bg-white ring-1 ring-(--lp-line) shadow-[0_1px_2px_rgb(15_17_21/0.04)]";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--lp-blue-deep)";

export default function Notifications({ api = notificationsApi }) {
  const navigate = useNavigate();
  const inbox = useStudentNotifications({ api, limit: 100, intervalMs: 0 });

  const open = async (item) => {
    if (!item.isRead) await inbox.markRead(item.id);
    if (item.actionUrl) navigate(item.actionUrl);
  };

  return (
    <div className={`${WIDE} pb-12`}>
      <header className={`${SURFACE} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-8`}>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-(--lp-muted)">Stay in the loop</p>
          <h1 className="mt-2 font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-(--lp-ink) sm:text-[2.25rem]">Notifications</h1>
          <p className="mt-2 text-sm text-(--lp-muted) sm:text-[15px]">
            {inbox.loading && !inbox.loaded ? "Loading…" : inbox.unread ? `${inbox.unread} unread update${inbox.unread === 1 ? "" : "s"}` : "You're all caught up."}
          </p>
        </div>
        {inbox.unread > 0 && (
          <button
            type="button"
            onClick={inbox.markAllRead}
            className={`inline-flex shrink-0 items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-(--lp-ink) ring-1 ring-(--lp-line) transition-colors duration-200 hover:bg-(--lp-grey) ${FOCUS}`}
          >
            Mark all as read
          </button>
        )}
      </header>

      {inbox.error && !inbox.loaded && (
        <div role="alert" className="rounded-xl bg-danger/10 p-4 text-sm text-danger">
          {inbox.error.message || "We couldn't load your notifications."}{" "}
          <button type="button" className="font-semibold underline" onClick={inbox.refresh}>Try again</button>
        </div>
      )}

      {inbox.loaded && inbox.rows.length === 0 && (
        <div className={`${SURFACE} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-(--lp-blue-soft) text-(--lp-blue-deep)" aria-hidden="true">
            <BellIcon className="h-5 w-5" />
          </span>
          <p className="max-w-sm text-sm leading-relaxed text-(--lp-muted)">
            No notifications yet. When an admin resolves an issue you reported, it shows up here.
          </p>
        </div>
      )}

      {inbox.rows.length > 0 && (
        <ul className={`${SURFACE} divide-y divide-(--lp-line) overflow-hidden`}>
          {inbox.rows.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => open(item)}
                className={`group relative flex w-full items-start gap-4 p-4 text-left transition-colors duration-150 sm:p-5 ${FOCUS} focus-visible:-outline-offset-2 ${item.isRead ? "bg-white hover:bg-(--lp-grey)/60" : "bg-(--lp-blue-tint) hover:bg-(--lp-blue-soft)/60"}`}
              >
                {!item.isRead && <span className="absolute inset-y-0 left-0 w-1 bg-(--lp-blue-deep)" aria-hidden="true" />}
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.isRead ? "bg-(--lp-grey) text-(--lp-muted)" : "bg-white text-(--lp-blue-deep) ring-1 ring-(--lp-line)"}`} aria-hidden="true">
                  <BellIcon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${item.isRead ? "bg-(--lp-grey) text-(--lp-muted)" : "bg-(--lp-blue-soft) text-(--lp-blue-deep)"}`}>{categoryLabel(item.category)}</span>
                    {!item.isRead && <span className="h-2 w-2 rounded-full bg-(--lp-blue-deep)" aria-label="Unread" />}
                    <span className="ml-auto shrink-0 text-xs text-(--lp-muted) sm:hidden">{when(item.createdAt)}</span>
                  </div>
                  <h2 className={`mt-2 font-display text-[15px] leading-snug text-(--lp-ink) ${item.isRead ? "font-medium" : "font-semibold"}`}>{item.title}</h2>
                  {item.body && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-(--lp-muted)">{item.body}</p>}
                  {item.actionUrl && (
                    <p className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-semibold text-(--lp-blue-deep)">
                      Open the test series
                      <ChevronRightIcon className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
                    </p>
                  )}
                </div>
                <span className="hidden shrink-0 text-xs text-(--lp-muted) sm:block">{when(item.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
