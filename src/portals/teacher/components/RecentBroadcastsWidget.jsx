import { NavLink } from "react-router-dom";
import ProgressRing from "../../../components/ui/ProgressRing";
import { useMessaging } from "../context/MessagingContext";
import { ArrowRightIcon, MegaphoneIcon } from "../../../components/ui/icons";
import { broadcastStats, relativeTime } from "../data/messagingData";

// Compact "recent announcements" card for the Dashboard, linking to the
// Announcements page. Reads the same MessagingContext history the Sent tab
// shows, so the two can never disagree.
export default function RecentBroadcastsWidget() {
  const { sent, scheduled } = useMessaging();
  const recent = sent.slice(0, 3);
  return (
    <section style={{ animationDelay: "200ms" }} className="motion-safe:animate-[rise-in_0.5s_ease-out_both] rounded-3xl bg-white p-5 shadow-soft">
      <div className="eyebrow-muted">Announcements</div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-text">Recent broadcasts</h2>
        {scheduled.length > 0 && <span className="rounded-full bg-pastel-orange px-2.5 py-1 text-[11px] font-semibold text-pastel-orange-ink">{scheduled.length} scheduled</span>}
      </div>
      {recent.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-bg px-4 py-6 text-center">
          <MegaphoneIcon className="h-5 w-5 text-muted" />
          <p className="text-sm text-muted">You haven't sent an announcement yet.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {recent.map((b) => {
            const st = broadcastStats(b);
            return (
              <li key={b.id} className="flex items-center gap-3">
                <ProgressRing value={st.openedPct} size={40} stroke={5} label={`${st.openedPct}% opened`} showValue={false} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">{b.subject}</p>
                  <p className="text-xs text-muted">
                    {relativeTime(b.sentAt)} · {st.total} recipients · {st.openedPct}% opened
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <NavLink to="/teacher/messaging" className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        Open Announcements
        <ArrowRightIcon className="h-3.5 w-3.5" />
      </NavLink>
    </section>
  );
}
