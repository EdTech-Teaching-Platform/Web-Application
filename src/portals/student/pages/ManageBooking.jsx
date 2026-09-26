import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import {
  AlertTriangleIcon,
  BookOpenIcon,
  CheckIcon,
  HelpCircleIcon,
  VideoIcon,
} from "../../../components/ui/icons";
import { AVAILABLE_SLOTS, ATTENDANCE_SESSIONS, RECORDINGS, getStoredBooking } from "../data/sessionMock";
import { imageForCategory } from "../../../utils/stockImages";

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const todayItems = [
  { time: "10:00 AM", title: "Python Programming", topic: "Loops & Functions", educator: "Priya Sharma", status: "Completed", category: "Programming" },
  { time: "2:00 PM", title: "Java Programming", topic: "OOP Concepts", educator: "Rohit Mehta", status: "Upcoming", category: "Programming" },
  { time: "5:00 PM", title: "Python Programming", topic: "Live Class", educator: "Priya Sharma", status: "Starting soon", category: "Programming" },
];
const weekItems = [
  ...todayItems,
  { time: "7:00 PM", title: "Data Science", topic: "Working with datasets", educator: "Anaya Kapoor", status: "Upcoming", category: "Science" },
];

function getCurrentWeek() {
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - mondayOffset);
  return DAY_LABELS.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { label, dayOfMonth: date.getDate(), isToday: index === mondayOffset };
  });
}

function StatusPill({ children }) {
  const tone = children === "Completed"
    ? "bg-success/10 text-success"
    : children === "Starting soon"
      ? "bg-primary/10 text-primary"
      : "bg-accent-sky/20 text-text";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{children}</span>;
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/65">{eyebrow}</p>}
        <h2 className="mt-1 font-display text-xl font-bold text-[#17324d]">{title}</h2>
        {description && <p className="mt-1 text-sm text-text/55">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function ScheduleRow({ item, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-wrap items-center gap-3 border-b border-text/10 py-3 text-left last:border-0"
    >
      <span className="w-20 text-xs font-semibold text-text/55">{item.time}</span>
      <img src={imageForCategory(item.category)} alt="" className="h-9 w-9 rounded-lg object-cover" />
      <span className="min-w-[150px] flex-1">
        <strong className="block text-sm text-text">{item.title}</strong>
        <span className="text-xs text-text/50">{item.topic} · {item.educator}</span>
      </span>
      <StatusPill>{item.status}</StatusPill>
    </button>
  );
}

export default function ManageBooking() {
  const navigate = useNavigate();
  const [booking] = useState(() => getStoredBooking());
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const currentWeek = useState(() => getCurrentWeek())[0];
  const todayIndex = currentWeek.findIndex((day) => day.isToday);
  const [selectedDayIndex, setSelectedDayIndex] = useState(todayIndex);
  const availableRecordings = RECORDINGS.filter((recording) => recording.status === "Available");
  const attended = ATTENDANCE_SESSIONS.filter((session) => session.attended).length;
  const missed = ATTENDANCE_SESSIONS.filter((session) => !session.attended).length;
  const attendanceTotal = ATTENDANCE_SESSIONS.length;
  const attendancePercent = attendanceTotal ? Math.round((attended / attendanceTotal) * 100) : 0;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const upcomingCount = AVAILABLE_SLOTS.filter((slot) => slot.status === "available" && new Date(slot.date) >= todayStart).length;
  const todayCount = todayItems.filter((item) => item.status !== "Completed").length;

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-7 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Live learning</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#17324d]">Live Classes</h1>
          <p className="mt-2 text-sm text-text/60">Attend live sessions, interact with expert educators and get real-time support.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button fullWidth={false} variant="secondary" onClick={() => navigate("/student/calendar")}>View Calendar</Button>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 rounded-2xl border border-text/10 bg-white p-4 shadow-sm sm:grid-cols-4">
        {[
          [String(upcomingCount), "Upcoming classes", "Available sample slots"],
          [String(todayCount), "Today", "In the sample schedule"],
          [String(attended), "Completed sessions", "Sample attendance records"],
          [`${attendancePercent}%`, "Attendance", `${attended} of ${attendanceTotal} sample sessions`],
        ].map(([value, label, note]) => (
          <div key={label} className="border-text/10 px-3 py-2 first:border-0 sm:border-l">
            <p className="font-display text-2xl font-bold text-[#17324d]">{value}</p>
            <p className="mt-1 text-sm font-semibold text-text">{label}</p>
            <p className="mt-0.5 text-xs text-text/45">{note}</p>
          </div>
        ))}
      </section>

      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.72fr)]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-text/10 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/65">Class schedule</p>
                <h2 className="mt-1 font-display text-xl font-bold text-[#17324d]">Your next live class</h2>
              </div>
              <span className="rounded-full bg-[#f8e8df] px-2.5 py-1 text-[11px] font-bold text-primary">{booking ? "SAMPLE BOOKING" : "NO BOOKING"}</span>
            </div>
            {booking ? (
              <div className="flex flex-col gap-4 rounded-2xl bg-bg p-4 sm:flex-row sm:items-center">
                <img src={imageForCategory("Programming")} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1"><h3 className="font-display text-lg font-bold text-[#17324d]">{booking.classTitle || booking.topic}</h3><p className="mt-1 text-sm text-text/55">{booking.educator} · {booking.date} · {booking.time}</p><p className="mt-2 text-xs text-text/45">This is a locally saved prototype booking. Live video and attendance are not connected.</p></div>
                <Button fullWidth={false} variant="secondary" onClick={() => navigate("/student/liveclassjoin?session=booked")}>Open room preview</Button>
              </div>
            ) : (
              <div className="rounded-2xl bg-bg p-5"><p className="font-semibold text-text">No class is booked yet.</p><p className="mt-1 text-sm text-text/55">Explore scheduled group classes and open a class overview to see its details.</p><Button fullWidth={false} className="mt-4" onClick={() => navigate("/student/live-classes")}>Explore live classes</Button></div>
            )}
          </section>

          <section className="rounded-2xl border border-text/10 bg-white p-5 shadow-sm sm:p-6">
            <SectionHeading eyebrow="Sample schedule" title="Today's schedule" action={<button type="button" onClick={() => navigate("/student/calendar")} className="text-xs font-semibold text-primary hover:underline">View calendar →</button>} />
            <div>{todayItems.map((item) => <ScheduleRow key={`${item.time}-${item.topic}`} item={item} onClick={() => item.status === "Starting soon" && navigate("/student/liveclassjoin?session=booked")} />)}</div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-text/10 bg-white p-5 shadow-sm">
            <SectionHeading eyebrow="Quick access" title="Quick actions" />
            <div className="grid grid-cols-2 gap-2">
              {[
                [BookOpenIcon, "Calendar", "View schedule", "/student/calendar"],
                [VideoIcon, "Recordings", "Watch past classes", "/student/recordings"],
                [CheckIcon, "Attendance", "View attendance", "/student/attendance"],
                [HelpCircleIcon, "Discussions", "Ask questions", "/student/messages"],
              ].map(([Icon, label, description, href]) => (
                <button type="button" key={label} onClick={() => navigate(href)} className="rounded-xl border border-text/10 p-3 text-left transition hover:border-primary/30 hover:bg-bg">
                  <Icon className="h-4 w-4 text-primary" />
                  <strong className="mt-2 block text-sm text-text">{label}</strong>
                  <span className="mt-0.5 block text-[11px] leading-4 text-text/50">{description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-text/10 bg-white p-5 shadow-sm">
            <SectionHeading eyebrow="Sample records" title="Attendance preview" action={<button type="button" onClick={() => navigate("/student/attendance")} className="text-xs font-semibold text-primary hover:underline">View records →</button>} />
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(#2f7f7a ${attendancePercent}%, #e8eef2 0)` }}>
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white font-display text-lg font-bold text-[#17324d]">{attendancePercent}%</span>
              </div>
              <div className="space-y-1.5 text-xs text-text/60">
                <p><strong className="text-text">{attended}</strong> attended</p>
                <p><strong className="text-text">{missed}</strong> missed</p>
                <p><strong className="text-text">{attendanceTotal}</strong> total sample sessions</p>
                <p className="pt-1 text-text/45">Preview data, not an official attendance record.</p>
              </div>
            </div>
          </section>
        </aside>
      </section>

      <section className="mt-6 rounded-2xl border border-text/10 bg-white p-5 shadow-sm sm:p-6">
        <SectionHeading eyebrow="This week" title="This week's schedule" action={<button type="button" onClick={() => navigate("/student/calendar")} className="text-xs font-semibold text-primary hover:underline">View full calendar →</button>} />
        <div className="mb-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
          {currentWeek.map((day, index) => <button type="button" key={`${day.label}-${day.dayOfMonth}`} onClick={() => setSelectedDayIndex(index)} className={`rounded-xl border px-2 py-2.5 text-center text-[11px] font-semibold ${index === selectedDayIndex ? "border-primary bg-primary text-white" : day.isToday ? "border-primary/50 text-primary" : "border-text/10 text-text/60 hover:border-primary/40"}`}>{day.label} {day.dayOfMonth}</button>)}
        </div>
        <div>
          {selectedDayIndex === todayIndex
            ? weekItems.map((item) => <ScheduleRow key={`${item.time}-${item.title}`} item={item} onClick={() => undefined} />)
            : <div className="rounded-2xl bg-bg p-5 text-sm text-text/50">No sample classes scheduled for this day.</div>}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-text/10 bg-white p-5 shadow-sm">
          <SectionHeading eyebrow="Find a class" title="Explore live learning" />
          <p className="text-sm leading-6 text-text/55">Browse group class listings to compare topics, educators, and schedules. Private one-to-one session booking is not offered here.</p>
          <Button fullWidth={false} className="mt-4" onClick={() => navigate("/student/live-classes")}>Browse live classes</Button>
        </section>

        <section className="rounded-2xl border border-text/10 bg-white p-5 shadow-sm">
          <SectionHeading eyebrow="Post-session learning" title="Recent recordings" action={<button type="button" onClick={() => navigate("/student/recordings")} className="text-xs font-semibold text-primary hover:underline">View all →</button>} />
          <div className="space-y-1">
            {availableRecordings.slice(0, 3).map((recording) => (
              <div key={recording.id} className="flex items-center gap-3 border-b border-text/10 py-2.5 last:border-0">
                <img src={imageForCategory(recording.courseId === "c1" ? "Programming" : recording.courseId === "c3" ? "Languages" : "Math")} alt="" className="h-10 w-14 rounded-lg object-cover" />
                <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-text">{recording.title}</strong><span className="text-[11px] text-text/50">{recording.date} · {recording.duration} · {recording.educator}</span></span>
                <Button fullWidth={false} variant="secondary" className="rounded-full px-3 py-1.5 text-[11px]" onClick={() => navigate(`/student/courseplayer?course=${recording.courseId}&lesson=${recording.lessonId}&recording=${recording.id}`)}>Watch</Button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-warning/20 bg-warning/10 p-5">
          <SectionHeading eyebrow="Needs your attention" title="Missed class" />
          <div className="flex items-center gap-3">
            <AlertTriangleIcon className="h-5 w-5 shrink-0 text-warning" />
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-text">Python · Debugging Clinic</p><p className="text-xs text-text/55">September 6 · Recording unavailable</p></div>
            <button type="button" onClick={() => navigate("/student/attendance")} className="text-xs font-semibold text-primary hover:underline">View details →</button>
          </div>
        </section>
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-text/10 bg-[#fbf0ea] p-5">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/65">Keep your learning on track</p><h2 className="mt-1 font-display text-lg font-bold text-[#17324d]">2 live classes this week</h2><p className="mt-1 text-xs text-text/55">Next: Python Programming · Today, 5:00 PM</p></div>
          <Button fullWidth={false} variant="secondary" onClick={() => navigate("/student/calendar")}>View schedule</Button>
        </section>
      </div>

      <Modal open={requestOpen} onClose={() => setRequestOpen(false)} title={requestSent ? "Complaint submitted" : "Submit a complaint"} footer={!requestSent && <><Button onClick={() => { setRequestSent(true); setTimeout(() => setRequestOpen(false), 900); }}>Submit complaint</Button><Button variant="secondary" onClick={() => setRequestOpen(false)}>Cancel</Button></>}>
        {requestSent ? <div className="text-center"><CheckIcon className="mx-auto text-success" /><p className="mt-3 font-semibold text-text">Status: Under Review</p><p className="mt-1 text-sm text-text/60">Our support team will review your complaint and update you through Notifications.</p></div> : <div className="space-y-4"><p className="rounded-2xl bg-primary/5 px-4 py-3 text-xs leading-5 text-text/65">Tell us about any issue with a course, educator, live class, payment, or your learning experience.</p><label className="block text-sm font-medium text-text">What is this about?<select defaultValue="Live class or booking" className="mt-2 w-full rounded-2xl bg-text/5 px-4 py-3 text-sm outline-none"><option>Course content</option><option>Educator or teaching</option><option>Live class or booking</option><option>Technical issue</option><option>Payment or refund</option><option>Other</option></select></label><label className="block text-sm font-medium text-text">Describe your complaint<textarea className="mt-2 min-h-28 w-full rounded-2xl bg-text/5 px-4 py-3 text-sm outline-none" placeholder="Please explain what happened and how it affected your learning" /></label></div>}
      </Modal>
    </div>
  );
}
