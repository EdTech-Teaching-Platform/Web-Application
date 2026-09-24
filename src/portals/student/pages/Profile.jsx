import { useNavigate } from "react-router-dom";
import { useState } from "react";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import { useAuth } from "../../../hooks/useAuth";

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [goal, setGoal] = useState("Build job-ready skills");
  const name = user?.name || "Student";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10">
      <div className="border-b border-text/10 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Account</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text">Your profile</h1>
        <p className="mt-2 text-sm text-text/60">Manage your learner identity and account preferences.</p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-text/10 bg-white p-6">
          <div className="flex items-start justify-between gap-4 border-b border-text/10 pb-5">
            <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">{initials}</span>
            <div>
              <h2 className="font-display text-xl font-semibold text-text">{name}</h2>
              <p className="mt-1 text-sm text-text/55">{user?.email || "Student account"}</p>
              <StatusBadge status="success">Active learner</StatusBadge>
            </div>
            </div>
            <button type="button" onClick={() => setEditing((value) => !value)} className="rounded-full border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/5">{editing ? "Done" : "Edit profile"}</button>
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-xs uppercase tracking-wide text-text/40">Name</dt><dd className="mt-1 text-sm font-medium text-text">{name}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-text/40">Role</dt><dd className="mt-1 text-sm font-medium capitalize text-text">{user?.role || "student"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-text/40">Learning mode</dt><dd className="mt-1 text-sm font-medium text-text">Self-paced + live</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-text/40">Notifications</dt><dd className="mt-1 text-sm font-medium text-text">Enabled</dd></div>
          </dl>
          {editing && <div className="mt-5 grid gap-3 border-t border-text/10 pt-5 sm:grid-cols-2">
            <label className="text-xs font-semibold text-text/60">Display name<input defaultValue={name} className="mt-1 w-full rounded-xl border border-text/10 bg-bg px-3 py-2.5 text-sm font-normal text-text outline-none focus:border-primary" /></label>
            <label className="text-xs font-semibold text-text/60">Email address<input defaultValue={user?.email || ""} className="mt-1 w-full rounded-xl border border-text/10 bg-bg px-3 py-2.5 text-sm font-normal text-text outline-none focus:border-primary" /></label>
          </div>}
        </section>

        <section className="rounded-2xl border border-text/10 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary/70">Learner shortcuts</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-text">Keep your learning moving</h2>
          <div className="mt-4 space-y-2">
            <button type="button" onClick={() => navigate("/student/my-learning")} className="flex w-full items-center justify-between rounded-xl bg-bg px-4 py-3 text-left text-sm font-medium text-text hover:bg-text/5">
              Continue learning <span className="text-text/35">→</span>
            </button>
            <button type="button" onClick={() => navigate("/student/explore")} className="flex w-full items-center justify-between rounded-xl bg-bg px-4 py-3 text-left text-sm font-medium text-text hover:bg-text/5">
              Discover recommended courses <span className="text-text/35">→</span>
            </button>
            <button type="button" onClick={() => navigate("/student/certificates")} className="flex w-full items-center justify-between rounded-xl bg-bg px-4 py-3 text-left text-sm font-medium text-text hover:bg-text/5">
              View certificates <span className="text-text/35">→</span>
            </button>
          </div>
        </section>
      </div>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-text/10 bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary/70">Learning snapshot</p><h2 className="mt-1 font-display text-lg font-semibold text-text">Your progress at a glance</h2></div>
            <button type="button" onClick={() => navigate("/student/learninghistory")} className="text-xs font-semibold text-primary">View history →</button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["2", "Courses enrolled", "bg-[#fff0eb]"], ["62%", "Course progress", "bg-[#eef7f4]"], ["7 days", "Current streak", "bg-[#fff8df]"], ["1", "Certificate earned", "bg-[#f1eefb]"]].map(([value, label, color]) => <div key={label} className={`rounded-2xl ${color} p-4`}><strong className="block font-display text-2xl text-text">{value}</strong><span className="mt-1 block text-xs text-text/55">{label}</span></div>)}
          </div>
          <div className="mt-5 rounded-2xl bg-bg p-4">
            <div className="flex items-center justify-between text-xs"><span className="font-semibold text-text">Profile completion</span><strong className="text-primary">75%</strong></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full w-3/4 rounded-full bg-primary" /></div>
            <p className="mt-2 text-xs text-text/50">Add your learning goal and interests to get more relevant recommendations.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#eadbd3] bg-[#fbf0ea] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary/70">Learning goal</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-text">What are you working toward?</h2>
          <select value={goal} onChange={(event) => setGoal(event.target.value)} className="mt-5 w-full rounded-xl border border-white bg-white px-3 py-3 text-sm text-text outline-none focus:border-primary">
            <option>Build job-ready skills</option>
            <option>Prepare for an exam</option>
            <option>Explore a new hobby</option>
            <option>Improve my current role</option>
          </select>
          <p className="mt-3 text-xs leading-5 text-text/60">We’ll use this to tailor course recommendations and reminders.</p>
          <button type="button" onClick={() => navigate("/student/explore")} className="mt-5 rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-white">Explore recommendations →</button>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-text/10 bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary/70">Activity overview</p><h2 className="mt-1 font-display text-lg font-semibold text-text">Your learning progress</h2><p className="mt-1 text-xs text-text/50">Lessons completed across the last 7 weeks</p></div>
          <div className="text-right"><strong className="block font-display text-2xl text-primary">24 hrs</strong><span className="text-xs text-text/50">learning time</span></div>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_210px]">
          <div className="min-w-0 rounded-2xl bg-[#fffaf7] p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between text-xs"><span className="font-semibold text-text/65">Lessons completed</span><span className="rounded-full bg-[#f1d9d0] px-2.5 py-1 font-semibold text-primary">+34% this month</span></div>
            <svg viewBox="0 0 720 260" role="img" aria-label="Student learning activity graph" className="h-64 w-full overflow-visible">
              <defs><linearGradient id="profileProgressFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#d58b78" stopOpacity=".35" /><stop offset="100%" stopColor="#d58b78" stopOpacity=".02" /></linearGradient><filter id="profileGraphShadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#4a0e0e" floodOpacity=".12" /></filter></defs>
              {[45, 90, 135, 180].map((y) => <line key={y} x1="52" x2="688" y1={y} y2={y} stroke="#eadfd9" strokeDasharray="3 7" />)}
              {[0, 6, 12, 18, 24].map((label, index) => <text key={label} x="38" y={185 - index * 35} textAnchor="end" fill="#a09590" fontSize="11">{label}</text>)}
              <path d="M55 180 C105 174 115 155 160 163 S225 172 265 125 S340 146 370 135 S445 112 475 123 S535 68 580 83 S638 50 685 44 L685 195 L55 195 Z" fill="url(#profileProgressFill)" />
              <path d="M55 180 C105 174 115 155 160 163 S225 172 265 125 S340 146 370 135 S445 112 475 123 S535 68 580 83 S638 50 685 44" fill="none" filter="url(#profileGraphShadow)" stroke="#4a0e0e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
              {[[55, 180], [160, 163], [265, 125], [370, 135], [475, 123], [580, 83], [685, 44]].map(([cx, cy], index) => <g key={`${cx}-${cy}`}><circle cx={cx} cy={cy} r="8" fill="#fffaf7" stroke="#4a0e0e" strokeWidth="3" /><circle cx={cx} cy={cy} r="3" fill="#4a0e0e" />{index === 6 && <g><rect x={cx - 34} y={cy - 38} width="68" height="24" rx="12" fill="#4a0e0e" /><text x={cx} y={cy - 22} textAnchor="middle" fill="white" fontSize="11" fontWeight="600">18 lessons</text></g>}</g>)}
              {["Aug 10", "Aug 17", "Aug 24", "Aug 31", "Sep 7", "Sep 14", "Today"].map((label, index) => <text key={label} x={55 + index * 105} y="228" textAnchor={index === 0 ? "start" : index === 6 ? "end" : "middle"} fill="#8b817d" fontSize="11">{label}</text>)}
            </svg>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            {[["18", "Lessons done", "↗"], ["86%", "Weekly goal", "↗"], ["24 hrs", "Learning time", "—"], ["7", "Day streak", "🔥"]].map(([value, label, icon]) => <div key={label} className="rounded-2xl border border-text/5 bg-white px-4 py-3 shadow-[0_4px_14px_rgba(23,50,77,0.04)]"><div className="flex items-center justify-between"><strong className="font-display text-xl text-text">{value}</strong><span className="text-xs text-primary">{icon}</span></div><span className="mt-1 block text-[11px] text-text/50">{label}</span></div>)}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl border border-text/10 bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-text">Interests</h2>
          <p className="mt-1 text-xs leading-5 text-text/50">Topics that shape your course feed.</p>
          <div className="mt-4 flex flex-wrap gap-2">{["Programming", "Mathematics", "Languages"].map((item) => <span key={item} className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">{item}</span>)}</div>
          <button type="button" onClick={() => setEditing(true)} className="mt-5 text-xs font-semibold text-primary">Manage interests →</button>
        </div>
        <div className="rounded-2xl border border-text/10 bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-text">Achievements</h2>
          <div className="mt-4 space-y-3 text-sm"><button type="button" onClick={() => navigate("/student/certificates")} className="flex w-full items-center justify-between rounded-xl bg-bg px-3 py-3 text-left"><span><strong className="block text-text">First course completed</strong><span className="text-xs text-text/50">Certificate available</span></span><span className="text-primary">→</span></button><div className="flex items-center justify-between rounded-xl bg-bg px-3 py-3"><span><strong className="block text-text">7-day learner</strong><span className="text-xs text-text/50">Keep your streak going</span></span><span>🔥</span></div></div>
        </div>
        <div className="rounded-2xl border border-[#eadbd3] bg-[#fbf0ea] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary/70">Study preferences</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-text">Make your learning work for you</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-xl bg-white/75 px-3 py-3">
              <p className="font-semibold text-text">Preferred learning mode</p>
              <p className="mt-1 text-xs text-text/55">Self-paced + live sessions</p>
            </div>
            <div className="rounded-xl bg-white/75 px-3 py-3">
              <p className="font-semibold text-text">Weekly learning goal</p>
              <p className="mt-1 text-xs text-text/55">5 hours · 86% complete</p>
            </div>
            <button type="button" onClick={() => navigate("/student/recommended")} className="text-xs font-semibold text-primary hover:underline">Refresh my recommendations →</button>
          </div>
        </div>
      </section>

      <div className="mt-5 rounded-2xl border border-[#d9e9e5] bg-[#eef7f4] p-5 text-sm text-text/65">
        <strong className="text-[#28756f]">Need help with your account?</strong> Visit My Payments for billing support or submit a complaint from the Live Classes page.
      </div>
    </div>
  );
}
