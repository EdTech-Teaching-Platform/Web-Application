import { useState } from "react";
import StatusBadge from "../../../components/ui/StatusBadge";

const initialNotifications = [
  { id: "n1", category: "Live classes", title: "Your Python live class starts today", body: "Loops & Functions · 5:00 PM", time: "Today", unread: true },
  { id: "n2", category: "Assessments", title: "Your assignment was graded", body: "View educator feedback for Submit your project.", time: "Yesterday", unread: true },
  { id: "n3", category: "Messages", title: "Rohan Mehta sent you a message", body: "Your Algebra session is ready for review.", time: "Sep 17", unread: false },
];

export default function Notifications() {
  const [items, setItems] = useState(initialNotifications);
  const unread = items.filter((item) => item.unread).length;

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Stay in the loop</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text">Notifications</h1>
          <p className="mt-2 text-sm text-text/60">{unread ? `${unread} unread updates` : "You're all caught up."}</p>
        </div>
        <button type="button" onClick={() => setItems((current) => current.map((item) => ({ ...item, unread: false })))} className="text-sm font-semibold text-primary hover:underline">
          Mark all as read
        </button>
      </div>
      <div className="mt-6 space-y-2">
        {items.map((item) => (
          <article key={item.id} className={`rounded-xl border p-4 ${item.unread ? "border-primary/20 bg-primary/[0.03]" : "border-text/10 bg-white"}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={item.unread ? "warning" : "success"}>{item.category}</StatusBadge>
                  {item.unread && <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread" />}
                </div>
                <h2 className="mt-3 font-display text-base font-semibold text-text">{item.title}</h2>
                <p className="mt-1 text-sm text-text/60">{item.body}</p>
              </div>
              <span className="shrink-0 text-xs text-text/40">{item.time}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-10 rounded-2xl border border-text/10 bg-white p-5">
        <h2 className="font-display text-lg font-semibold text-text">Notification preferences</h2>
        <p className="mt-1 text-sm text-text/55">Optional preferences will sync when the notification service is connected. Transactional and security updates remain enabled.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {["Learning reminders", "Assessment updates", "Live class reminders", "Educator messages"].map((label) => (
            <label key={label} className="flex items-center gap-3 rounded-xl bg-bg p-3 text-sm text-text">
              <input type="checkbox" defaultChecked className="accent-primary" />
              {label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
