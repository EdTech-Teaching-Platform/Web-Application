// Laptop + phone mock-up for the "Practise anytime, anywhere" CTA: the same
// test-series student UI on two devices, replacing the old stock portrait. Built in CSS
// (no image), sized in `em` off a container-query font size so it scales
// cleanly from phone to desktop. Decorative, aria-hidden; numbers are sample
// data.
import { CheckCircleIcon } from "../../../components/ui/icons";

// Gentle float, progress-bar fill and a "live" ping. transform/opacity only,
// ease-out, switched off for visitors who prefer reduced motion.
const DM_CSS = `
@keyframes dm-float-a { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
@keyframes dm-float-b { 0%,100% { transform: translateY(0); } 50% { transform: translateY(7px); } }
.dm-float-a { animation: dm-float-a 7s ease-in-out infinite; }
.dm-float-b { animation: dm-float-b 8s ease-in-out infinite; }
@keyframes dm-grow { from { transform: scaleX(0); } }
.dm-grow { transform-origin: left center; animation: dm-grow 1.4s cubic-bezier(0.22, 1, 0.36, 1) var(--d, 0.5s) both; }
@keyframes dm-rise { from { transform: scaleY(0); } }
.dm-rise { transform-origin: bottom center; animation: dm-rise 1.1s cubic-bezier(0.22, 1, 0.36, 1) var(--d, 0.6s) both; }
@keyframes dm-ping { 0% { transform: scale(1); opacity: 0.7; } 80%, 100% { transform: scale(2.4); opacity: 0; } }
.dm-ping { animation: dm-ping 1.8s ease-out infinite; }
@keyframes dm-ring { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(1.18); opacity: 0; } }
.dm-ring { animation: dm-ring 2.2s ease-out infinite; }
@media (prefers-reduced-motion: reduce) { .dm-float-a, .dm-float-b, .dm-grow, .dm-rise, .dm-ping, .dm-ring { animation: none; } }
`;

function Bar({ w, className = "bg-(--lp-line)" }) {
  return <span className={`block h-[0.55em] rounded-full ${className}`} style={{ width: w }} />;
}

export default function DeviceMockup() {
  return (
    <div className="relative w-full [container-type:inline-size]" aria-hidden="true">
      <style>{DM_CSS}</style>
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
            <div className="relative flex h-[27em] overflow-hidden rounded-[1em] bg-white text-(--lp-ink)">
              <div className="flex w-[6.2em] shrink-0 flex-col gap-[0.9em] bg-(--lp-grey) p-[0.9em]">
                <span className="grid h-[2.2em] w-[2.2em] place-items-center rounded-full bg-(--lp-ink)"><span className="h-[1.2em] w-[1.2em] rounded-full bg-(--lp-blue)" /></span>
                <Bar w="100%" className="bg-(--lp-ink)" />
                <Bar w="80%" />
                <Bar w="90%" />
                <Bar w="60%" />
              </div>
              <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-40" style={{ clipPath: "polygon(0 0, 58% 0, 24% 100%, 0 100%)" }} />
              <div className="min-w-0 flex-1 p-[1.1em]">
                <div className="flex items-center justify-between">
                  <p className="font-(family-name:--lp-font) text-[1.25em] font-bold leading-none">Welcome back, Ansh</p>
                  <span className="rounded-full bg-(--lp-yellow) px-[0.8em] py-[0.35em] text-[0.8em] font-bold">7-day streak</span>
                </div>
                <div className="mt-[1em] grid grid-cols-3 gap-[0.7em]">
                  {[
                    ["Test series", "3", "bg-(--lp-blue) text-white"],
                    ["Tests taken", "18/40", "bg-(--lp-ink) text-white"],
                    ["Avg. score", "78%", "bg-(--lp-yellow-soft) text-(--lp-ink)"],
                  ].map(([l, v, tone]) => (
                    <div key={l} className={`rounded-[0.9em] p-[0.8em] ${tone}`}>
                      <p className="text-[0.72em] opacity-75">{l}</p>
                      <p className="font-(family-name:--lp-font) text-[1.45em] font-bold leading-tight">{v}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-[1.1em] text-[0.85em] font-bold">Continue practising</p>
                <div className="mt-[0.6em] grid grid-cols-2 gap-[0.7em]">
                  {[
                    ["Physics Mock Series", "62%", "bg-(--lp-blue-soft)", "bg-(--lp-blue)"],
                    ["Class 10 Maths", "30%", "bg-(--lp-yellow-soft)", "bg-(--lp-ink)"],
                  ].map(([t, p, bg, bar], i) => (
                    <div key={t} className="rounded-[0.9em] bg-(--lp-grey) p-[0.6em]">
                      <div className={`h-[4.2em] rounded-[0.6em] ${bg}`} />
                      <p className="mt-[0.5em] text-[0.8em] font-bold">{t}</p>
                      <div className="mt-[0.4em] h-[0.45em] overflow-hidden rounded-full bg-white"><div className={`dm-grow h-full rounded-full ${bar}`} style={{ width: p, "--d": `${0.6 + i * 0.25}s` }} /></div>
                    </div>
                  ))}
                </div>
                {/* score trend + next test: fills the lower screen */}
                <div className="mt-[0.7em] grid grid-cols-[1.35fr_1fr] gap-[0.7em]">
                  <div className="rounded-[0.9em] bg-(--lp-grey) p-[0.7em]">
                    <div className="flex items-center justify-between text-[0.75em] font-bold">
                      <span>Score trend</span>
                      <span className="font-semibold text-(--lp-muted)">Last 7 tests</span>
                    </div>
                    <div className="mt-[0.5em] flex h-[3.4em] items-end gap-[0.45em]">
                      {[46, 58, 52, 68, 74, 70, 86].map((h, i) => (
                        <span key={i} className="flex h-full flex-1 items-end">
                          <span
                            className={`dm-rise block w-full rounded-t-[0.3em] ${i === 6 ? "bg-(--lp-yellow)" : "bg-(--lp-blue)"}`}
                            style={{ height: `${h}%`, "--d": `${0.8 + i * 0.08}s` }}
                          />
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col justify-between rounded-[0.9em] bg-(--lp-ink) p-[0.7em] text-white">
                    <p className="text-[0.62em] font-semibold uppercase tracking-wide text-white/55">Up next</p>
                    <div>
                      <p className="font-(family-name:--lp-font) text-[0.9em] font-bold leading-tight">Mock Test 4</p>
                      <p className="mt-[0.2em] text-[0.62em] text-white/60">Physics · 60 min</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mx-auto h-[1.1em] w-[108%] -translate-x-[4%] rounded-b-[1.4em] bg-gradient-to-b from-[#c9ced8] to-[#9aa1ae] shadow-[0_1em_2em_rgba(0,0,0,0.35)]" />
        </div>

        {/* -------------------------------------------------------- phone */}
        <div className="dm-float-b absolute bottom-[2%] right-[1%] w-[30%] rotate-[2deg]">
          <div className="rounded-[2.6em] bg-(--lp-ink) p-[0.55em] shadow-[0_3em_5em_rgba(0,0,0,0.5)] ring-1 ring-white/20">
            <div className="relative flex h-[27em] flex-col overflow-hidden rounded-[2.1em] bg-white p-[1em] text-(--lp-ink)">
              <span className="absolute left-1/2 top-[0.55em] h-[0.9em] w-[3.6em] -translate-x-1/2 rounded-full bg-(--lp-ink)" />
              <p className="mt-[1.6em] text-[0.7em] font-semibold text-(--lp-muted)">Up next</p>
              <div className="mt-[0.5em] rounded-[1.1em] bg-(--lp-ink) p-[0.9em] text-white">
                <span className="inline-flex items-center gap-[0.4em] rounded-full bg-(--lp-danger) px-[0.7em] py-[0.25em] text-[0.62em] font-bold uppercase">
                  <span className="relative h-[0.5em] w-[0.5em]"><span className="dm-ping absolute inset-0 rounded-full bg-white" /><span className="absolute inset-0 rounded-full bg-white" /></span> Timer running
                </span>
                <p className="mt-[0.6em] font-(family-name:--lp-font) text-[0.95em] font-bold leading-snug">Mock Test 3 · Physics</p>
                <p className="mt-[0.25em] text-[0.62em] text-white/60">Question 12 of 40 · 42:10 left</p>
                <span className="relative mt-[0.8em] block">
                  <span className="dm-ring absolute inset-0 rounded-full ring-2 ring-(--lp-yellow)" />
                  <span className="relative block rounded-full bg-(--lp-yellow) py-[0.55em] text-center text-[0.72em] font-bold text-(--lp-ink)">Resume test</span>
                </span>
              </div>
              <p className="mt-[1.1em] text-[0.7em] font-semibold text-(--lp-muted)">This week</p>
              <div className="mt-[0.5em] flex justify-between">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <span key={i} className={`grid h-[1.9em] w-[1.9em] place-items-center rounded-full text-[0.6em] font-bold ${i < 6 ? "bg-(--lp-blue) text-white" : "bg-(--lp-grey) text-(--lp-muted)"}`}>{d}</span>
                ))}
              </div>
              <div className="mt-[1.1em] rounded-[1em] bg-(--lp-blue-tint) p-[0.8em]">
                <p className="text-[0.7em] font-bold">Physics Mock Series</p>
                <div className="mt-[0.5em] h-[0.45em] overflow-hidden rounded-full bg-white"><div className="dm-grow h-full w-[62%] rounded-full bg-(--lp-blue)" style={{ "--d": "0.9s" }} /></div>
              </div>
              <div className="mt-[0.8em] flex items-center gap-[0.8em] rounded-[1em] bg-(--lp-yellow-soft) p-[0.7em]">
                <span className="grid h-[2.8em] w-[2.8em] shrink-0 place-items-center rounded-full" style={{ background: "conic-gradient(var(--lp-ink) 0 83%, #fff 83% 100%)" }}>
                  <span className="h-[1.9em] w-[1.9em] rounded-full bg-(--lp-yellow-soft)" />
                </span>
                <span className="leading-tight">
                  <span className="block text-[0.7em] font-bold">Daily goal</span>
                  <span className="block text-[0.62em] text-(--lp-muted)">25 of 30 min practice</span>
                </span>
              </div>
              <div className="mt-auto flex justify-around pt-[0.8em]">
                {[1, 2, 3, 4].map((n) => <span key={n} className={`h-[0.6em] w-[0.6em] rounded-full ${n === 1 ? "bg-(--lp-ink)" : "bg-(--lp-line)"}`} />)}
              </div>
            </div>
          </div>
        </div>

        {/* sync chip */}
        <div className="dm-float-a absolute right-[4%] top-[3%] flex items-center gap-[0.6em] rounded-full bg-white px-[1em] py-[0.6em] text-[0.85em] font-semibold text-(--lp-ink) shadow-[0_1.5em_3em_rgba(0,0,0,0.3)]">
          <CheckCircleIcon className="h-[1.3em] w-[1.3em] text-(--lp-blue)" /> Synced just now
        </div>
        {/* resources chip */}
        <div className="dm-float-a absolute bottom-[9%] left-[-1%] z-10 flex -rotate-[3deg] items-center gap-[0.6em] rounded-full bg-(--lp-yellow) py-[0.5em] pl-[0.55em] pr-[1em] text-[0.8em] font-bold text-(--lp-ink) shadow-[0_1.5em_3em_rgba(0,0,0,0.35)] ring-[0.18em] ring-(--lp-ink)">
          <span className="grid h-[1.9em] w-[1.9em] place-items-center rounded-full bg-(--lp-ink) text-(--lp-yellow)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="h-[1.1em] w-[1.1em]"><path d="M6 20v-7" /><path d="M12 20V6" /><path d="M18 20v-10" /></svg>
          </span>
          Report ready
        </div>
      </div>
    </div>
  );
}
