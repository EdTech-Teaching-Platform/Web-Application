// Laptop + phone mock-up for the "Learn anytime, anywhere" CTA: the same
// product UI on two devices, replacing the old stock portrait. Built in CSS
// (no image), sized in `em` off a container-query font size so it scales
// cleanly from phone to desktop. Decorative, aria-hidden; numbers are sample
// data.
import { CheckCircleIcon } from "../../../components/ui/icons";

function Bar({ w, className = "bg-(--lp-line)" }) {
  return <span className={`block h-[0.55em] rounded-full ${className}`} style={{ width: w }} />;
}

export default function DeviceMockup() {
  return (
    <div className="relative w-full [container-type:inline-size]" aria-hidden="true">
      <div className="relative aspect-[7/6] w-full" style={{ fontSize: "1.9cqw" }}>
        {/* backdrop: spotlight, concentric rings, a brand-yellow disc peeking
            from behind the laptop, dotted grid and a soft contact shadow */}
        <div className="absolute left-[4%] top-[2%] h-[70%] w-[70%] rounded-full bg-(--lp-blue)/35 blur-[5em]" />
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1.3px)",
            backgroundSize: "2.2em 2.2em",
            maskImage: "radial-gradient(ellipse at 45% 50%, black 0%, transparent 68%)",
            WebkitMaskImage: "radial-gradient(ellipse at 45% 50%, black 0%, transparent 68%)",
          }}
        />
        <div className="absolute left-1/2 top-[52%] aspect-square w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-white/10" />
        <div className="absolute left-1/2 top-[52%] aspect-square w-[68%] -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-white/15" />
        <div className="absolute -left-[2%] top-[6%] aspect-square w-[34%] rounded-full bg-(--lp-yellow)" />
        <div className="absolute -bottom-[1%] left-[6%] h-[7%] w-[78%] rounded-[50%] bg-black/60 blur-[1.2em]" />
        <div className="absolute -bottom-[3%] left-[18%] h-[8%] w-[52%] rounded-[50%] bg-(--lp-yellow)/35 blur-[2em]" />

        {/* ------------------------------------------------------ laptop */}
        <div className="absolute left-[3%] top-[12%] w-[84%]">
          <div className="rounded-[1.5em] bg-(--lp-ink-soft) p-[0.7em] shadow-[0_3em_5em_rgba(0,0,0,0.45)] ring-1 ring-white/15">
            <div className="flex h-[27em] overflow-hidden rounded-[1em] bg-white text-(--lp-ink)">
              <div className="flex w-[6.2em] shrink-0 flex-col gap-[0.9em] bg-(--lp-grey) p-[0.9em]">
                <span className="grid h-[2.2em] w-[2.2em] place-items-center rounded-full bg-(--lp-ink)"><span className="h-[1.2em] w-[1.2em] rounded-full bg-(--lp-blue)" /></span>
                <Bar w="100%" className="bg-(--lp-ink)" />
                <Bar w="80%" />
                <Bar w="90%" />
                <Bar w="60%" />
              </div>
              <div className="min-w-0 flex-1 p-[1.1em]">
                <div className="flex items-center justify-between">
                  <p className="font-(family-name:--lp-font) text-[1.25em] font-bold leading-none">Welcome back, Ansh</p>
                  <span className="rounded-full bg-(--lp-yellow) px-[0.8em] py-[0.35em] text-[0.8em] font-bold">7-day streak</span>
                </div>
                <div className="mt-[1em] grid grid-cols-3 gap-[0.7em]">
                  {[
                    ["Courses", "3/5", "bg-(--lp-blue) text-white"],
                    ["Assessments", "2/4", "bg-(--lp-ink) text-white"],
                    ["Live classes", "4/8", "bg-(--lp-yellow-soft) text-(--lp-ink)"],
                  ].map(([l, v, tone]) => (
                    <div key={l} className={`rounded-[0.9em] p-[0.8em] ${tone}`}>
                      <p className="text-[0.72em] opacity-75">{l}</p>
                      <p className="font-(family-name:--lp-font) text-[1.45em] font-bold leading-tight">{v}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-[1.1em] text-[0.85em] font-bold">Continue learning</p>
                <div className="mt-[0.6em] grid grid-cols-2 gap-[0.7em]">
                  {[
                    ["Python Bootcamp", "62%", "bg-(--lp-blue-soft)", "bg-(--lp-blue)"],
                    ["Algebra Foundations", "30%", "bg-(--lp-yellow-soft)", "bg-(--lp-ink)"],
                  ].map(([t, p, bg, bar]) => (
                    <div key={t} className="rounded-[0.9em] bg-(--lp-grey) p-[0.6em]">
                      <div className={`h-[4.2em] rounded-[0.6em] ${bg}`} />
                      <p className="mt-[0.5em] text-[0.8em] font-bold">{t}</p>
                      <div className="mt-[0.4em] h-[0.45em] overflow-hidden rounded-full bg-white"><div className={`h-full rounded-full ${bar}`} style={{ width: p }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="mx-auto h-[1.1em] w-[108%] -translate-x-[4%] rounded-b-[1.4em] bg-gradient-to-b from-[#c9ced8] to-[#9aa1ae] shadow-[0_1em_2em_rgba(0,0,0,0.35)]" />
        </div>

        {/* -------------------------------------------------------- phone */}
        <div className="absolute bottom-[2%] right-[1%] w-[30%]">
          <div className="rounded-[2.6em] bg-(--lp-ink) p-[0.55em] shadow-[0_3em_5em_rgba(0,0,0,0.5)] ring-1 ring-white/20">
            <div className="relative flex h-[27em] flex-col overflow-hidden rounded-[2.1em] bg-white p-[1em] text-(--lp-ink)">
              <span className="absolute left-1/2 top-[0.55em] h-[0.9em] w-[3.6em] -translate-x-1/2 rounded-full bg-(--lp-ink)" />
              <p className="mt-[1.6em] text-[0.7em] font-semibold text-(--lp-muted)">Up next</p>
              <div className="mt-[0.5em] rounded-[1.1em] bg-(--lp-ink) p-[0.9em] text-white">
                <span className="inline-flex items-center gap-[0.4em] rounded-full bg-(--lp-danger) px-[0.7em] py-[0.25em] text-[0.62em] font-bold uppercase">
                  <span className="h-[0.5em] w-[0.5em] rounded-full bg-white" /> Live now
                </span>
                <p className="mt-[0.6em] font-(family-name:--lp-font) text-[0.95em] font-bold leading-snug">Python — Functions in practice</p>
                <p className="mt-[0.25em] text-[0.62em] text-white/60">Priya Sharma · 6:00 PM</p>
                <span className="mt-[0.8em] block rounded-full bg-(--lp-yellow) py-[0.55em] text-center text-[0.72em] font-bold text-(--lp-ink)">Join class</span>
              </div>
              <p className="mt-[1.1em] text-[0.7em] font-semibold text-(--lp-muted)">This week</p>
              <div className="mt-[0.5em] flex justify-between">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <span key={i} className={`grid h-[1.9em] w-[1.9em] place-items-center rounded-full text-[0.6em] font-bold ${i < 6 ? "bg-(--lp-blue) text-white" : "bg-(--lp-grey) text-(--lp-muted)"}`}>{d}</span>
                ))}
              </div>
              <div className="mt-[1.1em] rounded-[1em] bg-(--lp-blue-tint) p-[0.8em]">
                <p className="text-[0.7em] font-bold">Python Bootcamp</p>
                <div className="mt-[0.5em] h-[0.45em] overflow-hidden rounded-full bg-white"><div className="h-full w-[62%] rounded-full bg-(--lp-blue)" /></div>
              </div>
              <div className="mt-auto flex justify-around pt-[0.8em]">
                {[1, 2, 3, 4].map((n) => <span key={n} className={`h-[0.6em] w-[0.6em] rounded-full ${n === 1 ? "bg-(--lp-ink)" : "bg-(--lp-line)"}`} />)}
              </div>
            </div>
          </div>
        </div>

        {/* sync chip */}
        <div className="absolute right-[4%] top-[3%] flex items-center gap-[0.6em] rounded-full bg-white px-[1em] py-[0.6em] text-[0.85em] font-semibold text-(--lp-ink) shadow-[0_1.5em_3em_rgba(0,0,0,0.3)]">
          <CheckCircleIcon className="h-[1.3em] w-[1.3em] text-(--lp-blue)" /> Synced just now
        </div>
      </div>
    </div>
  );
}
