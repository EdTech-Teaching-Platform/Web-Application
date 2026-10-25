// Product-style compositions for the auth showcase panel (no photography, no
// illustration): a few overlapping "real UI" cards — the same kind of cards
// users meet inside the product — laid out like a designer's hero shot.
// Static, decorative (aria-hidden), numbers are sample data.
import { AwardIcon, CheckCircleIcon, FlameIcon, StarIcon, VideoIcon } from "../../components/ui/icons";

const CARD = "absolute rounded-[26px] bg-white p-4 text-(--lp-ink) shadow-[0_28px_60px_rgba(0,0,0,0.28)] ring-1 ring-black/5";
const LABEL = "text-[10px] font-bold uppercase tracking-[0.14em] text-(--lp-muted)";

function Avatars({ items }) {
  return (
    <span className="flex -space-x-2">
      {items.map(([ch, bg]) => (
        <span key={ch} className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold text-white ring-2 ring-white ${bg}`}>{ch}</span>
      ))}
    </span>
  );
}

// ------------------------------------------------------------------ student
function StudentScene() {
  return (
    <>
      <div className={`${CARD} left-0 top-2 w-[250px] -rotate-3`}>
        <div className="flex items-center justify-between">
          <span className={LABEL}>This week</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-(--lp-yellow-soft) px-2.5 py-1 text-[11px] font-bold"><FlameIcon className="h-3 w-3 text-(--lp-ink)" /> 7-day streak</span>
        </div>
        <div className="mt-3 flex justify-between">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${i < 6 ? "bg-(--lp-ink) text-white" : "bg-(--lp-grey) text-(--lp-muted)"}`}>{d}</span>
          ))}
        </div>
      </div>

      <div className={`${CARD} right-0 top-[104px] w-[280px] rotate-2`}>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-(--lp-danger) px-2.5 py-1 text-[10px] font-bold uppercase text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white" /> Live now
          </span>
          <span className="text-xs font-semibold text-(--lp-muted)">6:00 PM</span>
        </div>
        <p className="mt-3 font-(family-name:--lp-font) text-base font-bold leading-snug">Python — Functions in practice</p>
        <p className="mt-0.5 text-xs text-(--lp-muted)">Priya Sharma · Programming</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold">
            <Avatars items={[["A", "bg-(--lp-blue)"], ["R", "bg-(--lp-ink)"], ["S", "bg-(--lp-blue-deep)"]]} />
            +42 joined
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-(--lp-ink) px-3.5 py-2 text-xs font-semibold text-white"><VideoIcon className="h-3.5 w-3.5" /> Join</span>
        </div>
      </div>

      <div className={`${CARD} bottom-0 left-2 w-[290px] -rotate-1 !bg-(--lp-ink) !text-white !ring-white/10`}>
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-(--lp-blue) font-mono text-sm font-bold text-white">{"</>"}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">Complete Python Bootcamp</p>
            <p className="text-[11px] text-white/60">Lesson 14 of 22 · Loops & Functions</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2.5">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15"><div className="h-full w-[62%] rounded-full bg-(--lp-yellow)" /></div>
          <span className="text-xs font-bold text-(--lp-yellow)">62%</span>
        </div>
      </div>
    </>
  );
}

// ----------------------------------------------------------------- educator
function EducatorScene() {
  const bars = [38, 52, 44, 66, 58, 82, 96];
  return (
    <>
      <div className={`${CARD} left-0 top-0 w-[290px] -rotate-2 !bg-(--lp-ink) !text-white !ring-white/10`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">Earnings · this month</span>
          <span className="rounded-full bg-(--lp-yellow) px-2.5 py-1 text-[11px] font-bold text-(--lp-ink)">+18%</span>
        </div>
        <p className="mt-2 font-(family-name:--lp-font) text-4xl font-bold tracking-tight">₹48,250</p>
        <div className="mt-2.5 flex h-10 items-end gap-1.5">
          {bars.map((h, i) => (
            <span key={i} className={`flex-1 rounded-md ${i === bars.length - 1 ? "bg-(--lp-yellow)" : "bg-white/20"}`} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>

      <div className={`${CARD} right-0 top-[156px] w-[270px] rotate-2`}>
        <span className={LABEL}>Next live class</span>
        <p className="mt-1.5 font-(family-name:--lp-font) text-base font-bold leading-snug">Algebra — Quadratic equations</p>
        <p className="text-xs text-(--lp-muted)">Today · 5:30 PM · 60 min</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold">
            <Avatars items={[["K", "bg-(--lp-blue)"], ["M", "bg-(--lp-ink)"], ["N", "bg-(--lp-blue-deep)"]]} />
            24 enrolled
          </span>
          <span className="whitespace-nowrap rounded-full bg-(--lp-blue) px-3.5 py-2 text-xs font-semibold text-white">Start class</span>
        </div>
      </div>

      <div className={`${CARD} bottom-0 left-3 flex w-[260px] -rotate-1 items-center gap-3`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-(--lp-blue-soft) text-(--lp-blue-deep)"><CheckCircleIcon className="h-5 w-5" /></span>
        <div>
          <p className="text-sm font-bold">Profile verified</p>
          <p className="text-[11px] text-(--lp-muted)">Your Digital ID card is live</p>
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------- signup
function SignupScene() {
  const chips = [["Programming", true], ["Math", false], ["Science", false], ["Languages", true], ["Design", false], ["Music", false]];
  return (
    <>
      <div className={`${CARD} left-0 top-0 w-[310px] -rotate-2`}>
        <span className={LABEL}>What do you want to learn?</span>
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map(([c, on]) => (
            <span key={c} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${on ? "bg-(--lp-ink) text-white" : "bg-(--lp-grey) text-(--lp-ink)"}`}>{c}</span>
          ))}
        </div>
      </div>

      <div className={`${CARD} right-0 top-[120px] w-[260px] rotate-2 !p-3`}>
        <div className="relative grid h-16 place-items-center overflow-hidden rounded-2xl bg-(--lp-blue)">
          <span className="font-mono text-2xl font-bold text-white/90">{"</>"}</span>
          <span className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-(--lp-yellow)" />
        </div>
        <div className="px-1 pb-1 pt-3">
          <p className="font-(family-name:--lp-font) text-base font-bold leading-snug">UI Design Fundamentals</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-(--lp-muted)">Meera Iyer · <StarIcon className="h-3 w-3 fill-current text-(--lp-ink)" /> 4.8</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm font-bold">₹499 <span className="text-xs font-normal text-(--lp-muted) line-through">₹799</span></span>
            <span className="rounded-full bg-(--lp-ink) px-3.5 py-2 text-xs font-semibold text-white">Enroll</span>
          </div>
        </div>
      </div>

      <div className={`${CARD} bottom-0 left-2 flex w-[280px] -rotate-1 items-center gap-3 !bg-(--lp-yellow) !ring-0`}>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-(--lp-ink) text-(--lp-yellow)"><AwardIcon className="h-5 w-5" /></span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em]">Certificate</p>
          <p className="text-sm font-bold">Earn proof of every course</p>
        </div>
      </div>
    </>
  );
}

const SCENES = { student: StudentScene, educator: EducatorScene, signup: SignupScene };

export default function AuthScene({ variant = "student" }) {
  const Scene = SCENES[variant] ?? StudentScene;
  return (
    <div className="relative mx-auto h-full min-h-[300px] w-full max-w-[470px]" aria-hidden="true">
      <Scene />
    </div>
  );
}
