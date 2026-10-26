// Product showcase used by the public landing page: a tabbed "platform"
// section whose previews are rendered inside a window frame. Previews are
// illustrative (placeholder data), not live app screens. Colours come from
// the --lp-* variables set by landingTheme.js on the landing wrapper.
import { useState } from "react";
import { FileTextIcon, BarChartIcon, ClockIcon, CheckIcon } from "../../../components/ui/icons";

const DISPLAY = "font-(family-name:--lp-font)";

// ─────────────────────── small presentational bits ───────────────────────

export function Eyebrow({ children, dark = false }) {
  return (
    <p className={`flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.16em] ${dark ? "text-white/70" : "text-(--lp-blue-deep)"}`}>
      <span className={`h-px w-7 ${dark ? "bg-white/40" : "bg-(--lp-blue-deep)/50"}`} aria-hidden="true" />
      {children}
    </p>
  );
}

export function SectionTitle({ eyebrow, title, subtitle, dark = false, className = "" }) {
  return (
    <div className={className}>
      <Eyebrow dark={dark}>{eyebrow}</Eyebrow>
      <h2 className={`${DISPLAY} mt-4 max-w-2xl text-balance text-[2rem] font-bold leading-[1.08] tracking-[-0.02em] sm:text-4xl md:text-[2.75rem] ${dark ? "text-white" : "text-(--lp-ink)"}`}>
        {title}
      </h2>
      {subtitle && <p className={`mt-4 max-w-xl text-base leading-relaxed ${dark ? "text-white/70" : "text-(--lp-muted)"}`}>{subtitle}</p>}
    </div>
  );
}

// A browser-style window frame used to present product previews.
function Frame({ title, children, className = "", dark = false }) {
  return (
    <div className={`overflow-hidden rounded-[22px] shadow-[0_40px_80px_-30px_rgba(15,17,21,0.35)] ring-1 ${dark ? "bg-(--lp-ink) ring-white/10" : "bg-white ring-(--lp-line)"} ${className}`}>
      <div className={`flex items-center gap-3 border-b px-4 py-3 ${dark ? "border-white/10" : "border-(--lp-line) bg-(--lp-grey)/70"}`}>
        <span className="flex gap-1.5" aria-hidden="true">
          <i className="h-2.5 w-2.5 rounded-full bg-(--lp-ink)/15" />
          <i className="h-2.5 w-2.5 rounded-full bg-(--lp-ink)/15" />
          <i className="h-2.5 w-2.5 rounded-full bg-(--lp-ink)/15" />
        </span>
        <span className={`truncate text-[11px] font-medium ${dark ? "text-white/55" : "text-(--lp-muted)"}`}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// ─────────────────── product previews (illustrative) ───────────────────

function TestPreview() {
  return (
    <Frame title="universallearning.app / test / physics-mock-3">
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>Question 12 of 50</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-(--lp-ink) px-3 py-1 text-xs tabular-nums text-white">
            <ClockIcon className="h-3.5 w-3.5" /> 34:28
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-(--lp-blue-soft)">
          <div className="h-full w-[24%] rounded-full bg-(--lp-blue)" />
        </div>
        <p className="mt-5 text-sm font-medium leading-relaxed">A 2 kg block slides down a frictionless incline of 30°. What is its acceleration along the plane?</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {["4.9 m/s²", "9.8 m/s²", "8.5 m/s²", "2.5 m/s²"].map((o, i) => (
            <span key={o} className={`rounded-xl px-3.5 py-2.5 text-sm ring-1 ring-inset ${i === 0 ? "bg-(--lp-blue-soft) font-semibold text-(--lp-blue-deep) ring-(--lp-blue)" : "text-(--lp-ink)/80 ring-(--lp-line)"}`}>
              <b className="mr-2 text-(--lp-muted)">{"ABCD"[i]}</b>
              {o}
            </span>
          ))}
        </div>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-(--lp-muted)">Question palette</p>
        <div className="mt-2 grid grid-cols-8 gap-1.5 sm:grid-cols-12">
          {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => {
            const tone =
              n <= 8 ? "bg-(--lp-blue) text-white" : n === 12 ? "bg-(--lp-ink) text-white" : n === 9 || n === 15 ? "bg-(--lp-yellow) text-(--lp-ink)" : n === 6 || n === 13 ? "bg-(--lp-blue-soft) text-(--lp-blue-deep)" : "bg-(--lp-grey) text-(--lp-muted)";
            return (
              <span key={n} className={`grid aspect-square place-items-center rounded-lg text-[11px] font-bold ${tone}`}>
                {n}
              </span>
            );
          })}
        </div>
      </div>
    </Frame>
  );
}

function ProgressPreview() {
  const weeks = [48, 55, 52, 63, 68, 74, 82];
  const topics = [
    { name: "Rotational motion", score: 41, tone: "bg-(--lp-yellow)" },
    { name: "Thermodynamics", score: 58, tone: "bg-(--lp-blue)/60" },
    { name: "Electrostatics", score: 86, tone: "bg-(--lp-blue)" },
  ];
  return (
    <Frame title="universallearning.app / student / performance">
      <div className="p-5 sm:p-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium text-(--lp-muted)">Average score, last 7 tests</p>
            <p className={`${DISPLAY} text-3xl font-bold tracking-tight`}>
              82% <span className="ml-1 align-middle rounded-full bg-(--lp-blue-soft) px-2 py-0.5 text-xs font-semibold text-(--lp-blue-deep)">+34 pts</span>
            </p>
          </div>
        </div>
        <div className="mt-5 flex h-28 items-end gap-2" role="img" aria-label="Score trend rising from 48 to 82 percent over seven tests">
          {weeks.map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div style={{ height: `${h}%` }} className={`w-full rounded-t-lg ${i === weeks.length - 1 ? "bg-(--lp-blue)" : "bg-(--lp-blue-soft)"}`} />
              <span className="text-[10px] text-(--lp-muted)">T{i + 1}</span>
            </div>
          ))}
        </div>
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-(--lp-muted)">Needs attention</p>
        <ul className="mt-2 space-y-3">
          {topics.map((t) => (
            <li key={t.name}>
              <div className="flex justify-between text-sm">
                <span className="font-medium">{t.name}</span>
                <span className="tabular-nums text-(--lp-muted)">{t.score}%</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-(--lp-grey)">
                <div style={{ width: `${t.score}%` }} className={`h-full rounded-full ${t.tone}`} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}

const SHOWCASE = [
  {
    id: "tests",
    icon: FileTextIcon,
    label: "Test series",
    text: "Chapter-wise tests and full-length mocks, timed like the real exam, with a palette that shows exactly where you stand.",
    points: ["Chapter-wise and full-length mocks", "Timed like the real exam", "Question palette to track every answer"],
    Preview: TestPreview,
  },
  {
    id: "progress",
    icon: BarChartIcon,
    label: "Progress tracking",
    text: "Per-question time and accuracy turn into a clear list of what to revise next, so practice always has a direction.",
    points: ["Score trend across every test", "Accuracy and time per question", "A revise-next list by topic"],
    Preview: ProgressPreview,
  },
];

export function ProductShowcase() {
  const [active, setActive] = useState("tests");
  const current = SHOWCASE.find((s) => s.id === active) ?? SHOWCASE[0];
  const Preview = current.Preview;
  return (
    <div className="relative mt-12 overflow-hidden rounded-[32px] bg-(--lp-blue-tint) p-4 ring-1 ring-(--lp-blue)/10 sm:p-8 lg:p-10">
      {/* dotted grid, fades toward the right */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden="true"
        style={{
          backgroundImage: "radial-gradient(rgba(37,87,214,0.18) 1px, transparent 1.3px)",
          backgroundSize: "24px 24px",
          maskImage: "linear-gradient(to right, black, transparent 70%)",
          WebkitMaskImage: "linear-gradient(to right, black, transparent 70%)",
        }}
      />
      <div className="relative grid items-stretch gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-12">
        {/* left: tabs + detail + CTA */}
        <div className="flex flex-col">
          <div role="tablist" aria-label="Platform features" className="flex flex-col gap-3">
            {SHOWCASE.map((item, i) => {
              const on = item.id === active;
              return (
                <button
                  key={item.id}
                  role="tab"
                  type="button"
                  aria-selected={on}
                  onClick={() => setActive(item.id)}
                  className={`group rounded-2xl p-5 text-left outline-none transition-all duration-300 ease-out focus-visible:ring-4 focus-visible:ring-(--lp-blue)/35 ${
                    on ? "bg-white shadow-[0_18px_40px_-20px_rgba(37,87,214,0.45)] ring-1 ring-(--lp-ink)/10" : "bg-white/50 ring-1 ring-transparent hover:bg-white/80"
                  }`}
                >
                  <span className="flex items-center gap-3.5">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors duration-300 ${on ? "bg-(--lp-ink) text-white" : "bg-white text-(--lp-ink) ring-1 ring-(--lp-line)"}`}>
                      <item.icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`${DISPLAY} block text-lg font-bold tracking-tight`}>{item.label}</span>
                    </span>
                    <span className={`${DISPLAY} text-sm font-bold tabular-nums ${on ? "text-(--lp-blue-deep)" : "text-(--lp-muted)/60"}`}>0{i + 1}</span>
                  </span>
                  {on && (
                    <span className="mt-4 block border-t border-(--lp-line) pt-4">
                      <span className="block text-sm leading-relaxed text-(--lp-muted)">{item.text}</span>
                      <span className="mt-4 block space-y-2.5">
                        {item.points.map((pt) => (
                          <span key={pt} className="flex items-center gap-2.5 text-sm font-medium text-(--lp-ink)">
                            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-(--lp-yellow)">
                              <CheckIcon className="h-3 w-3" />
                            </span>
                            {pt}
                          </span>
                        ))}
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* right: product window */}
        <div key={current.id} role="tabpanel" className="min-w-0 motion-safe:animate-[lp-fade_0.45s_ease-out]">
          <style>{`@keyframes lp-fade { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: none; } }`}</style>
          <Preview />
        </div>
      </div>
    </div>
  );
}
