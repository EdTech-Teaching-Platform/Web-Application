import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EVENT_TYPES = ["All activities", "Live class", "Assignment", "Quiz", "Deadline"];
const EVENTS = [
  { id: "live-today", day: 24, type: "Live class", course: "Complete Python Bootcamp", title: "Loops & Functions · Module 3", meta: "9:00 AM – 10:00 AM", action: "/student/liveclassjoin?session=l1", label: "Join class" },
  { id: "live-python", day: 20, type: "Live class", course: "Complete Python Bootcamp", title: "Loops & Functions", meta: "5:00 PM – 6:00 PM", action: "/student/liveclassjoin?session=l1", label: "Join class" },
  { id: "quiz-python", day: 20, type: "Quiz", course: "Complete Python Bootcamp", title: "Control Flow knowledge check", meta: "Due today · 10 questions", action: "/student/quiz?course=c1", label: "Start quiz" },
  { id: "assignment-python", day: 24, type: "Assignment", course: "Complete Python Bootcamp", title: "Submit your project", meta: "Due September 24 · 11:59 PM", action: "/student/assignmentsubmit?item=assignment-project", label: "Open assignment" },
  { id: "quiz-ielts", day: 24, type: "Quiz", course: "IELTS Speaking Mastery", title: "Speaking Practice Assessment", meta: "2:00 PM · 10 questions · ~15 min", action: "/student/quiz?course=c3", label: "Start quiz" },
  { id: "recording-algebra", day: 24, type: "Recorded class", course: "Algebra Foundations", title: "Quadratic Equations", meta: "5:30 PM · 36 min", action: "/student/courseplayer?course=c2", label: "Watch" },
  { id: "algebra-review", day: 22, type: "Assignment", course: "Algebra Foundations", title: "Complete Quadratics lesson", meta: "Continue learning", action: "/student/courseplayer?course=c2", label: "Continue" },
  { id: "ielts-class", day: 27, type: "Live class", course: "IELTS Speaking Mastery", title: "Speaking practice", meta: "4:00 PM – 5:00 PM", action: "/student/live-classes", label: "View class" },
];

const TYPE_STYLES = {
  "Live class": { dot: "bg-primary", badge: "bg-primary/10 text-primary" },
  Assignment: { dot: "bg-accent-teal", badge: "bg-accent-teal/10 text-accent-teal" },
  Quiz: { dot: "bg-accent-lilac", badge: "bg-accent-lilac/10 text-accent-lilac" },
  Deadline: { dot: "bg-accent-peach", badge: "bg-accent-peach/15 text-[#9b5d2c]" },
  "Recorded class": { dot: "bg-text/35", badge: "bg-text/10 text-text/60" },
};

function EventBadge({ type }) {
  const style = TYPE_STYLES[type] || TYPE_STYLES.Assignment;
  return <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${style.badge}`}>{type}</span>;
}

export default function Calendar() {
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState(24);
  const [monthOffset, setMonthOffset] = useState(0);
  const [filter, setFilter] = useState("All activities");
  const monthDate = new Date(2026, 8 + monthOffset, 1);
  const monthName = monthDate.toLocaleString("en-US", { month: "long", year: "numeric" });
  const firstDay = monthDate.getDay();
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const previousMonthDays = new Date(monthDate.getFullYear(), monthDate.getMonth(), 0).getDate();
  const calendarCells = Array.from({ length: 35 }, (_, index) => {
    const dayNumber = index - firstDay + 1;
    if (dayNumber < 1) return { day: previousMonthDays + dayNumber, outside: true };
    if (dayNumber > daysInMonth) return { day: dayNumber - daysInMonth, outside: true };
    return { day: dayNumber, outside: false };
  });
  const filteredEvents = filter === "All activities" ? EVENTS : EVENTS.filter((event) => event.type === filter);
  const visibleEvents = useMemo(() => filteredEvents.filter((event) => event.day === selectedDay), [filteredEvents, selectedDay]);

  function shiftMonth(amount) {
    setMonthOffset((value) => value + amount);
    setSelectedDay(1);
  }

  function goToday() {
    setMonthOffset(0);
    setSelectedDay(24);
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-7 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Planner</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text">Your calendar</h1>
          <p className="mt-2 text-sm text-text/60">Plan live classes, course work, quizzes, and deadlines in one place.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => shiftMonth(-1)} className="rounded-full border border-text/10 bg-white px-3 py-2 text-xs font-semibold text-text/65">← Previous</button>
          <button type="button" onClick={goToday} className="rounded-full bg-primary px-3 py-2 text-xs font-semibold text-white">Today</button>
          <button type="button" onClick={() => shiftMonth(1)} className="rounded-full border border-text/10 bg-white px-3 py-2 text-xs font-semibold text-text/65">Next →</button>
        </div>
      </header>

      <section className="rounded-2xl border border-text/10 bg-white p-3.5 shadow-sm sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-[#17324d]">{monthName}</h2>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-text/55">
              {Object.entries({ "Live class": "bg-primary", Assignment: "bg-accent-teal", Quiz: "bg-accent-lilac", Deadline: "bg-accent-peach" }).map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><i className={`h-2 w-2 rounded-full ${color}`} />{label}</span>)}
            </div>
          </div>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-full border border-text/10 bg-bg px-3 py-2 text-xs font-semibold text-text/65 outline-none focus:border-primary">
            {EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
        </div>

        <div>
          <div className="grid grid-cols-7 gap-2">
            {DAYS.map((day) => <div key={day} className="px-1 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-text/45 sm:text-xs">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {calendarCells.map(({ day, outside }, index) => {
              const dayEvents = filteredEvents.filter((event) => event.day === day);
              const selected = !outside && selectedDay === day;
              return (
                <button type="button" key={`${index}-${day}`} disabled={outside} onClick={() => setSelectedDay(day)} className={`relative flex min-h-[86px] flex-col rounded-xl border p-2 text-left transition sm:min-h-[96px] sm:p-2.5 ${outside ? "border-text/5 bg-bg/35 text-text/20" : selected ? "border-primary bg-primary/[0.06] text-primary ring-1 ring-primary/20" : "border-text/10 bg-white text-text/70 hover:border-primary/35 hover:bg-bg"}`}>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${selected ? "bg-primary text-white" : ""}`}>{day}</span>
                  {!outside && dayEvents.length > 0 && <div className="mt-auto flex items-center gap-1">{dayEvents.slice(0, 3).map((event) => <i key={event.id} className={`h-2 w-2 rounded-full ${TYPE_STYLES[event.type]?.dot || "bg-accent-teal"}`} />)}{dayEvents.length > 3 && <span className="text-[10px] text-text/40">+{dayEvents.length - 3}</span>}</div>}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-text/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-text/10 pb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/70">{selectedDay === 24 && monthOffset === 0 ? "Today · " : ""}{monthName.split(" ")[0].toUpperCase()} {selectedDay}</p>
            <h2 className="mt-1 font-display text-xl font-bold text-[#17324d]">Your schedule</h2>
          </div>
          <p className="text-xs text-text/50">{visibleEvents.length} {visibleEvents.length === 1 ? "activity" : "activities"} scheduled</p>
        </div>
        <div className="mt-2 divide-y divide-text/10">
          {visibleEvents.length ? visibleEvents.map((event) => (
            <div key={event.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
              <div className="w-36 shrink-0"><p className="text-xs font-semibold text-text/55">{event.meta}</p><div className="mt-2"><EventBadge type={event.type} /></div></div>
            <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-text">{event.course}</h3><p className="mt-1 text-xs text-text/55">{event.title}</p>{event.type === "Live class" && <p className="mt-1 text-[11px] text-text/45">Priya Sharma</p>}</div>
              <button type="button" onClick={() => navigate(event.action)} className="shrink-0 text-xs font-semibold text-primary hover:underline">{event.label} →</button>
            </div>
          )) : <div className="py-8 text-center"><p className="text-sm font-semibold text-text">No activities scheduled for this day.</p><p className="mt-1 text-xs text-text/50">You're all caught up!</p></div>}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-text/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/70">Up next</p><h2 className="mt-1 font-display text-xl font-bold text-[#17324d]">Your upcoming learning</h2></div>
            <button type="button" onClick={() => setSelectedDay(27)} className="text-xs font-semibold text-primary hover:underline">View all →</button>
          </div>
          <div className="mt-3 divide-y divide-text/10">
            {[
              ["Tomorrow", "Complete Python Bootcamp", "Live class · 5:00 PM", "live-python"],
              ["Sep 26", "IELTS Speaking Mastery", "Assignment due", "quiz-ielts"],
              ["Sep 27", "Algebra Foundations", "Quiz", "algebra-review"],
            ].map(([date, course, detail, eventId]) => <button type="button" key={eventId} onClick={() => { const event = EVENTS.find((item) => item.id === eventId); if (event) navigate(event.action); }} className="flex w-full items-center justify-between gap-3 py-3 text-left"><span><strong className="block text-sm text-text">{date}</strong><span className="text-xs text-text/50">{course} · {detail}</span></span><span className="text-xs font-semibold text-primary">View →</span></button>)}
          </div>
        </section>
        <section className="rounded-2xl border border-text/10 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/70">This week</p>
          <h2 className="mt-1 font-display text-xl font-bold text-[#17324d]">Learning activity summary</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-2">
            {[["12", "Activities"], ["4", "Live classes"], ["3", "Assignments"], ["2", "Quizzes"], ["3", "Deadlines"]].map(([value, label]) => <div key={label} className="rounded-xl bg-bg px-3 py-2.5"><strong className="font-display text-lg text-text">{value}</strong><p className="mt-0.5 text-[11px] text-text/50">{label}</p></div>)}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-text/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/70">Today’s progress</p><h2 className="mt-1 font-display text-xl font-bold text-[#17324d]">2 of 4 activities completed</h2></div>
          <span className="font-display text-xl font-bold text-primary">50%</span>
        </div>
        <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full" style={{ background: "conic-gradient(#4a0e0e 50%, rgba(74, 14, 14, 0.12) 0)" }}>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white font-display text-base font-bold text-primary">50%</span>
          </div>
          <div className="grid flex-1 gap-2 text-xs text-text/60 sm:grid-cols-2">
            <p><span className="mr-2 text-success">✓</span>Python lesson</p>
            <p><span className="mr-2 text-success">✓</span>Previous assignment</p>
            <p><span className="mr-2 text-text/35">○</span>Live class</p>
            <p><span className="mr-2 text-text/35">○</span>Quiz</p>
          </div>
        </div>
      </section>
    </div>
  );
}
