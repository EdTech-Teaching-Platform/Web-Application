// StreakRow — new component, MINUTO-reference-inspired weekly streak-day
// pill row (Mon..Sun, filled for days a lesson was completed). Same
// flagging as GoalRing: an enrichment of the doc's "learning streaks"
// item, display-only until a backend confirms the streak calculation
// rule (see Dashboard.jsx's existing streak-badge flag). Uses only
// --color-primary / white-on-primary tokens — no new colors.
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export default function StreakRow({ completedDays = [] }) {
  return (
    <div className="flex gap-2">
      {DAY_LABELS.map((label, i) => {
        const done = completedDays.includes(i);
        return (
          <div
            key={i}
            title={done ? "Lesson completed" : "No lesson yet"}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
              done ? "bg-primary text-white" : "bg-primary/10 text-primary/60"
            }`}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}
