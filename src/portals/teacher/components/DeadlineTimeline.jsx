// Visual timeline: Assigned -> Build deadline -> Go-live -> Window opens ->
// Window closes, with today marked. Out-of-order dates turn red and are listed
// as plain-language conflicts underneath.
import { timelineEvents, MOCK_TODAY_ISO, daysBetween } from "../data/testSeriesDeadlines";
import { formatDate } from "../data/testSeriesData";

export function timelineConflicts(events) {
  const ordered = [...events].sort((a, b) => a.order - b.order);
  const bad = new Set();
  const messages = [];
  ordered.forEach((later, j) => {
    for (let i = 0; i < j; i += 1) {
      const earlier = ordered[i];
      if (daysBetween(earlier.date, later.date) < 0) {
        bad.add(later.key);
        messages.push(`${later.label} (${formatDate(later.date)}) comes before ${earlier.label.toLowerCase()} (${formatDate(earlier.date)}).`);
        break;
      }
    }
  });
  return { bad, messages };
}

export default function DeadlineTimeline({ series }) {
  const events = timelineEvents(series);
  const { bad, messages } = timelineConflicts(events);
  const items = [
    ...events.map((e) => ({ ...e, kind: "event" })),
    { key: "today", order: -1, label: "Today", date: MOCK_TODAY_ISO, kind: "today" },
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind === "today" ? 1 : -1));

  if (events.length <= 1) {
    return <p className="rounded-2xl bg-bg px-4 py-3 text-sm text-muted">Set a build deadline, go-live or availability window above and your timeline will appear here.</p>;
  }

  return (
    <div>
      <ol className="flex flex-col sm:flex-row" aria-label="Series timeline">
        {items.map((it) => {
          const isToday = it.kind === "today";
          const conflict = bad.has(it.key);
          const past = !isToday && daysBetween(MOCK_TODAY_ISO, it.date) < 0;
          const dot = isToday
            ? "h-4 w-4 bg-primary ring-4 ring-primary/20"
            : conflict
              ? "h-3.5 w-3.5 bg-danger ring-4 ring-danger/20"
              : past
                ? "h-3.5 w-3.5 bg-pastel-sage-ink"
                : "h-3.5 w-3.5 border-2 border-primary bg-surface";
          return (
            <li
              key={it.key}
              className="relative ml-1.5 flex items-start gap-3 border-l-2 border-text/15 pb-4 pl-5 last:border-l-transparent last:pb-0 sm:ml-0 sm:flex-1 sm:flex-col sm:items-center sm:gap-2 sm:border-l-0 sm:pb-0 sm:pl-0 sm:text-center sm:before:absolute sm:before:left-0 sm:before:right-0 sm:before:top-2 sm:before:h-0.5 sm:before:bg-text/15 sm:first:before:left-1/2 sm:last:before:right-1/2"
            >
              <span aria-hidden="true" className={`absolute -left-[0.5625rem] top-0.5 z-10 shrink-0 rounded-full sm:static sm:mt-0.5 ${dot}`} style={isToday ? { marginLeft: "-0.125rem" } : undefined} />
              <span className="min-w-0">
                <span className={`block text-xs font-bold ${isToday ? "text-primary" : conflict ? "text-danger" : "text-text"}`}>{it.label}</span>
                <span className={`block text-[11px] ${conflict ? "text-danger" : "text-muted"}`}>{formatDate(it.date)}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {messages.length > 0 && (
        <ul role="alert" className="mt-4 flex flex-col gap-1.5 rounded-2xl bg-danger/10 px-4 py-3 text-xs font-semibold text-danger">
          {messages.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
    </div>
  );
}
