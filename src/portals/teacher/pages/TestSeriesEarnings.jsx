// Earnings — per-test-series revenue & enrollment tracking (DUMMY UI).
// Every figure here is sample data so the layout can be reviewed; nothing is
// read from or written to a backend yet. Swap the constants below for API
// data later; the components only depend on their shapes.
import { useEffect, useMemo, useRef, useState } from "react";
import { WalletIcon, UsersIcon, TrendingUpIcon, ClockIcon, FileTextIcon, DownloadIcon, ChevronRightIcon, CheckIcon, TagIcon, ArrowDownLeftIcon } from "../../../components/ui/icons";

const inr = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const compact = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : `₹${n}`);
const COMMISSION = 0.2;

// 12 months, oldest -> newest (Nov 2025 .. Oct 2026)
const MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
const TREND = [
  { revenue: 61000, enrolled: 82 }, { revenue: 74000, enrolled: 96 }, { revenue: 66300, enrolled: 88 },
  { revenue: 72800, enrolled: 101 }, { revenue: 76000, enrolled: 99 }, { revenue: 88800, enrolled: 118 },
  { revenue: 101100, enrolled: 134 }, { revenue: 132700, enrolled: 171 }, { revenue: 118400, enrolled: 152 },
  { revenue: 125900, enrolled: 160 }, { revenue: 141200, enrolled: 184 }, { revenue: 156800, enrolled: 203 },
].map((d, i) => ({ ...d, label: MONTHS[i] }));

const SERIES = [
  { id: "s1", title: "JEE Main Mathematics Full-Length Mocks", tag: "Competitive Exams", price: 1499, enrolled: 1240, month: 96, completion: 72, avgScore: 64, status: "Live", spark: [40, 52, 48, 66, 71, 90, 96] },
  { id: "s2", title: "Class 10 Science Chapter-wise Tests", tag: "Board Exams", price: 799, enrolled: 864, month: 61, completion: 81, avgScore: 71, status: "Live", spark: [30, 36, 50, 44, 58, 60, 61] },
  { id: "s3", title: "NEET Physics Topic Tests", tag: "Entrance Exams", price: 599, enrolled: 312, month: 38, completion: 58, avgScore: 55, status: "Live", spark: [12, 18, 22, 30, 28, 35, 38] },
  { id: "s4", title: "JEE Main Physics Mastery — Full Syllabus", tag: "Competitive Exams", price: 1299, enrolled: 412, month: 27, completion: 66, avgScore: 60, status: "Live", spark: [20, 22, 25, 24, 30, 26, 27] },
  { id: "s5", title: "React Patterns — Final Assessment", tag: "Course add-on", price: 499, enrolled: 56, month: 9, completion: 88, avgScore: 79, status: "Final", spark: [4, 6, 9, 8, 12, 10, 9] },
  { id: "s6", title: "English Grammar Essentials — Class 7", tag: "School", price: 349, enrolled: 38, month: 6, completion: 74, avgScore: 68, status: "Live", spark: [3, 4, 4, 6, 5, 7, 6] },
].map((s) => ({ ...s, gross: s.enrolled * s.price }));

const ORDERS = [
  { id: "o1", student: "Aarav Mehta", series: "JEE Main Mathematics Full-Length Mocks", amount: 1499, when: "Today, 10:42", status: "Paid" },
  { id: "o2", student: "Diya Nair", series: "Class 10 Science Chapter-wise Tests", amount: 799, when: "Today, 09:15", status: "Paid" },
  { id: "o3", student: "Kabir Singh", series: "NEET Physics Topic Tests", amount: 479, when: "Yesterday", status: "Coupon" },
  { id: "o4", student: "Ishita Rao", series: "JEE Main Physics Mastery — Full Syllabus", amount: 1299, when: "Yesterday", status: "Paid" },
    { id: "o6", student: "Meera Iyer", series: "JEE Main Mathematics Full-Length Mocks", amount: 1499, when: "Oct 24", status: "Paid" },
];

const PAYOUTS = [
  { id: "p1", date: "Oct 05, 2026", amount: 98400, status: "Paid", ref: "UL-PO-2210" },
  { id: "p2", date: "Sep 05, 2026", amount: 84200, status: "Paid", ref: "UL-PO-2144" },
  { id: "p3", date: "Aug 05, 2026", amount: 76950, status: "Paid", ref: "UL-PO-2081" },
];

const PALETTE = ["var(--lp-blue-deep)", "var(--lp-ink)", "var(--lp-blue)", "var(--lp-yellow)", "#8fb2ff", "#c9d6f5"];

const card = "rounded-[1.75rem] bg-white p-5 shadow-[0_18px_40px_-30px_rgba(15,17,21,0.3)] ring-1 ring-(--lp-line) sm:p-6";

function Head({ eyebrow, title, right }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--lp-muted)">{eyebrow}</div>
        <h2 className="font-(family-name:--lp-font) text-lg font-bold tracking-tight text-(--lp-ink)">{title}</h2>
      </div>
      {right}
    </div>
  );
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-full bg-(--lp-grey) p-1 ring-1 ring-(--lp-line)" role="group">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(o)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${value === o ? "bg-(--lp-ink) text-white" : "text-(--lp-muted) hover:text-(--lp-ink)"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

function Delta({ value }) {
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${up ? "bg-[#e3f5ec] text-[#1f9d6b]" : "bg-[#fde8e9] text-[#e5484d]"}`}>
      {up ? "▲" : "▼"} {Math.abs(value)}%
    </span>
  );
}

function Spark({ data, className = "" }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={`h-7 w-20 ${className}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="var(--lp-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Revenue bars + enrollments line
function TrendChart({ data }) {
  const [hover, setHover] = useState(null);
  const W = 640, H = 240, L = 44, R = 14, T = 16, B = 28;
  const maxRev = Math.max(...data.map((d) => d.revenue)) * 1.15;
  const maxEn = Math.max(...data.map((d) => d.enrolled)) * 1.15;
  const bw = (W - L - R) / data.length;
  const x = (i) => L + bw * i + bw / 2;
  const yR = (v) => T + (H - T - B) * (1 - v / maxRev);
  const yE = (v) => T + (H - T - B) * (1 - v / maxEn);
  const line = data.map((d, i) => `${x(i)},${yE(d.enrolled)}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Revenue and enrollments by month">
        {ticks.map((t) => {
          const y = T + (H - T - B) * (1 - t);
          return (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y} y2={y} stroke="var(--lp-line)" />
              <text x={L - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--lp-muted)">{compact(maxRev * t)}</text>
            </g>
          );
        })}
        {data.map((d, i) => (
          <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={L + bw * i} y={T} width={bw} height={H - T - B} fill="transparent" />
            <rect x={x(i) - bw * 0.26} y={yR(d.revenue)} width={bw * 0.52} height={H - B - yR(d.revenue)} rx="6" fill={hover === i ? "var(--lp-blue-deep)" : "var(--lp-blue-soft)"} />
            <text x={x(i)} y={H - 9} textAnchor="middle" fontSize="10" fill="var(--lp-muted)">{d.label}</text>
          </g>
        ))}
        <polyline points={line} fill="none" stroke="var(--lp-ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={d.label} cx={x(i)} cy={yE(d.enrolled)} r={hover === i ? 5 : 3.5} fill="var(--lp-yellow)" stroke="var(--lp-ink)" strokeWidth="2" />
        ))}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-2 rounded-2xl bg-(--lp-ink) px-3 py-2 text-xs text-white shadow-lg" style={{ left: `${Math.min(78, Math.max(2, ((x(hover) / W) * 100) - 8))}%` }}>
          <div className="font-bold">{data[hover].label}</div>
          <div className="mt-0.5 text-white/80">Revenue {inr(data[hover].revenue)}</div>
          <div className="text-white/80">Enrolled {data[hover].enrolled}</div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-(--lp-muted)">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-(--lp-blue-soft) ring-1 ring-(--lp-blue)/30" />Gross revenue</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-(--lp-ink)" />New enrollments</span>
      </div>
    </div>
  );
}

function Donut({ items, total, centerLabel }) {
  const r = 52, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0 -rotate-90" role="img" aria-label="Revenue share by series">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--lp-grey)" strokeWidth="18" />
        {items.map((it, i) => {
          const len = (it.value / total) * c;
          const el = <circle key={it.label} cx="70" cy="70" r={r} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="18" strokeDasharray={`${len - 2} ${c - len + 2}`} strokeDashoffset={-acc} />;
          acc += len;
          return el;
        })}
        <g className="rotate-90" style={{ transformOrigin: "70px 70px" }}>
          <text x="70" y="68" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--lp-ink)">{compact(total)}</text>
          <text x="70" y="83" textAnchor="middle" fontSize="8" fill="var(--lp-muted)">{centerLabel}</text>
        </g>
      </svg>
      <ul className="min-w-0 flex-1 space-y-2">
        {items.map((it, i) => (
          <li key={it.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="min-w-0 flex-1 truncate text-(--lp-ink)">{it.label}</span>
            <span className="font-bold text-(--lp-ink)">{Math.round((it.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, delta, note }) {
  return (
    <div className="flex flex-col gap-3 bg-white px-5 py-4">
      <div className="flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-(--lp-blue-tint) text-(--lp-blue-deep)"><Icon className="h-4 w-4" /></span>
        {delta !== undefined && <Delta value={delta} />}
      </div>
      <div>
        <div className="font-(family-name:--lp-font) text-2xl font-bold leading-none text-(--lp-ink)">{value}</div>
        <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-(--lp-muted)">{label}</div>
        {note && <div className="mt-0.5 text-[11px] text-(--lp-muted)/80">{note}</div>}
      </div>
    </div>
  );
}

// Nicer "change test series" control for the insights header: prev / next
// arrows plus a searchable-looking dropdown listing every series.
function SeriesSwitcher({ series, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const idx = series.findIndex((s) => s.id === value);
  const current = series[idx] ?? series[0];
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const step = (d) => onChange(series[(idx + d + series.length) % series.length].id);
  const arrow = "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/25 transition-colors hover:bg-white/25";
  return (
    <div ref={ref} className="relative flex w-full items-center gap-2 sm:w-auto">
      <button type="button" onClick={() => step(-1)} aria-label="Previous test series" className={arrow}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-full bg-white px-4 py-2 text-left text-(--lp-ink) shadow-[0_10px_24px_-14px_rgba(0,0,0,0.5)] sm:w-80 sm:flex-none"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-(--lp-blue-tint) text-(--lp-blue-deep)"><FileTextIcon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-(--lp-muted)">Test series {idx + 1} of {series.length}</span>
          <span className="block truncate text-sm font-bold">{current.title}</span>
        </span>
        <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-(--lp-muted) transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <button type="button" onClick={() => step(1)} aria-label="Next test series" className={arrow}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </button>
      {open && (
        <ul role="listbox" aria-label="Choose a test series" className="absolute right-0 top-full z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-3xl bg-white p-2 text-(--lp-ink) shadow-[0_24px_60px_-20px_rgba(15,17,21,0.45)] ring-1 ring-(--lp-line) sm:w-[26rem]">
          {series.map((s) => {
            const active = s.id === value;
            return (
              <li key={s.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => { onChange(s.id); setOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${active ? "bg-(--lp-blue-tint)" : "hover:bg-(--lp-grey)"}`}
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${active ? "bg-(--lp-blue-deep) text-white" : "bg-(--lp-blue-tint) text-(--lp-blue-deep)"}`}>
                    {active ? <CheckIcon className="h-4 w-4" /> : <FileTextIcon className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{s.title}</span>
                    <span className="block text-[11px] text-(--lp-muted)">{s.tag} · {s.enrolled.toLocaleString("en-IN")} students</span>
                  </span>
                  <span className="shrink-0 text-xs font-bold">{compact(s.gross)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const STATUS_STYLE = {
  Paid: "bg-[#e3f5ec] text-[#1f9d6b]",
  Coupon: "bg-(--lp-yellow-soft) text-(--lp-ink)",
};

export default function TestSeriesEarnings() {
  const [range, setRange] = useState("6M");
  const [sort, setSort] = useState("gross");
  const [selectedId, setSelectedId] = useState(SERIES[0].id);

  const data = useMemo(() => TREND.slice(range === "3M" ? -3 : range === "6M" ? -6 : -12), [range]);
  const totals = useMemo(() => {
    const revenue = data.reduce((s, d) => s + d.revenue, 0);
    const enrolled = data.reduce((s, d) => s + d.enrolled, 0);
    return { revenue, enrolled, net: revenue * (1 - COMMISSION), avg: revenue / enrolled };
  }, [data]);
  const rows = useMemo(() => [...SERIES].sort((a, b) => (sort === "enrolled" ? b.enrolled - a.enrolled : sort === "completion" ? b.completion - a.completion : b.gross - a.gross)), [sort]);
  const selected = SERIES.find((s) => s.id === selectedId) ?? SERIES[0];
  const allGross = SERIES.reduce((s, x) => s + x.gross, 0);
  const allEnrolled = SERIES.reduce((s, x) => s + x.enrolled, 0);
  const sel = { gross: selected.gross, fee: selected.gross * COMMISSION };
  sel.net = sel.gross - sel.fee;

  return (
    <div className="pb-12">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-[2rem] bg-(--lp-ink) px-6 py-7 text-white shadow-[0_24px_50px_-28px_rgba(15,17,21,0.6)] sm:px-8 sm:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-(--lp-blue)/40 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 right-1/3 h-40 w-40 rounded-full bg-(--lp-yellow)/25 blur-2xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-(--lp-yellow) px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-(--lp-ink)">Earnings</span>
            <h1 className="mt-3 font-(family-name:--lp-font) text-3xl font-bold tracking-tight sm:text-4xl">Track every test series</h1>
            <p className="mt-1.5 max-w-lg text-sm text-white/70">See what each series earns, how many students enrolled, and when your next payout lands.</p>
          </div>
          <div className="relative flex flex-wrap items-center gap-3 rounded-[1.5rem] bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
            <div className="pr-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">Available to withdraw</div>
              <div className="font-(family-name:--lp-font) text-3xl font-bold">{inr(112640)}</div>
              <div className="text-[11px] text-white/60">+ {inr(23180)} pending clearance</div>
            </div>
            <button type="button" className="rounded-full bg-(--lp-yellow) px-5 py-2.5 text-sm font-bold text-(--lp-ink) transition-transform hover:-translate-y-0.5">Request payout</button>
          </div>
        </div>
      </div>

      {/* Period + export */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented value={range} onChange={setRange} options={["3M", "6M", "12M"]} />
        <button type="button" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-(--lp-ink) ring-1 ring-(--lp-line) transition-colors hover:bg-(--lp-blue-tint)">
          <DownloadIcon className="h-3.5 w-3.5" /> Export report
        </button>
      </div>

      {/* KPI strip */}
      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[1.5rem] bg-(--lp-line) ring-1 ring-(--lp-line) lg:grid-cols-5">
        <Kpi icon={WalletIcon} label="Gross revenue" value={compact(totals.revenue)} delta={14} />
        <Kpi icon={TrendingUpIcon} label="Net earnings" value={compact(totals.net)} delta={12} note={`after ${COMMISSION * 100}% platform fee`} />
        <Kpi icon={UsersIcon} label="New enrollments" value={totals.enrolled.toLocaleString("en-IN")} delta={9} />
        <Kpi icon={TagIcon} label="Avg. per student" value={inr(totals.avg)} delta={4} />
        <Kpi icon={ClockIcon} label="Pending clearance" value={compact(23180)} note="clears in 3–5 days" />
      </div>

      {/* Trend + share */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className={card}>
          <Head eyebrow="Performance" title="Revenue & enrollments" right={<span className="text-xs font-medium text-(--lp-muted)">Last {range === "3M" ? "3" : range === "6M" ? "6" : "12"} months</span>} />
          <TrendChart data={data} />
        </section>
        <div className="flex flex-col gap-6">
          <section className={card}>
            <Head eyebrow="Breakdown" title="Revenue share by series" />
            <Donut items={SERIES.map((s) => ({ label: s.title, value: s.gross }))} total={allGross} centerLabel="all time" />
          </section>
        </div>
      </div>

      {/* Per-series table */}
      <section className={`${card} mt-6`}>
        <Head
          eyebrow="Per test series"
          title="Earnings by series"
          right={<Segmented value={sort === "gross" ? "Revenue" : sort === "enrolled" ? "Students" : "Completion"} onChange={(v) => setSort(v === "Revenue" ? "gross" : v === "Students" ? "enrolled" : "completion")} options={["Revenue", "Students", "Completion"]} />}
        />
        <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-(--lp-line) text-[10px] font-bold uppercase tracking-wider text-(--lp-muted)">
                <th className="py-3 pr-3">Test series</th>
                <th className="px-3 py-3">Price</th>
                <th className="px-3 py-3">Students</th>
                <th className="px-3 py-3">This month</th>
                <th className="px-3 py-3">Trend</th>
                <th className="px-3 py-3">Completion</th>
                <th className="px-3 py-3 text-right">Gross</th>
                <th className="py-3 pl-3 text-right">Net earnings</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} onClick={() => setSelectedId(s.id)} className={`cursor-pointer border-b border-(--lp-line) transition-colors last:border-0 ${selectedId === s.id ? "bg-(--lp-blue-tint)" : "hover:bg-(--lp-grey)"}`}>
                  <td className="py-3.5 pr-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-(--lp-blue-tint) text-(--lp-blue-deep)"><FileTextIcon className="h-4 w-4" /></span>
                      <div className="min-w-0">
                        <div className="max-w-[16rem] truncate font-semibold text-(--lp-ink)">{s.title}</div>
                        <div className="text-[11px] text-(--lp-muted)">{s.tag} · {s.status}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 font-medium text-(--lp-ink)">{inr(s.price)}</td>
                  <td className="px-3 py-3.5 font-semibold text-(--lp-ink)">{s.enrolled.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-3.5"><span className="font-semibold text-(--lp-ink)">+{s.month}</span></td>
                  <td className="px-3 py-3.5"><Spark data={s.spark} /></td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-(--lp-blue-soft)"><div className="h-full rounded-full bg-(--lp-blue)" style={{ width: `${s.completion}%` }} /></div>
                      <span className="text-xs font-semibold text-(--lp-ink)">{s.completion}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-right font-medium text-(--lp-ink)">{inr(s.gross)}</td>
                  <td className="py-3.5 pl-3 text-right font-bold text-(--lp-ink)">{inr(s.gross * (1 - COMMISSION))}</td>
                  <td className="pl-2 text-(--lp-muted)"><ChevronRightIcon className="h-4 w-4" /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="text-sm font-bold text-(--lp-ink)">
                <td className="pt-4">All series</td><td /><td className="px-3 pt-4">{allEnrolled.toLocaleString("en-IN")}</td><td className="px-3 pt-4">+{SERIES.reduce((s, x) => s + x.month, 0)}</td><td /><td />
                <td className="px-3 pt-4 text-right">{inr(allGross)}</td><td className="pl-3 pt-4 text-right">{inr(allGross * (1 - COMMISSION))}</td><td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Selected series detail */}
      <section className="mt-6 rounded-[2rem] bg-white shadow-[0_18px_40px_-30px_rgba(15,17,21,0.3)] ring-1 ring-(--lp-line)">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-t-[2rem] bg-(--lp-blue-deep) px-6 py-5 text-white">
          <div className="min-w-0 sm:flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">Series insights</div>
            <h2 className="truncate font-(family-name:--lp-font) text-xl font-bold tracking-tight">{selected.title}</h2>
          </div>
          <SeriesSwitcher series={SERIES} value={selectedId} onChange={setSelectedId} />
        </div>
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-3">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-(--lp-muted)">Where the money goes</h3>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex justify-between"><dt className="text-(--lp-muted)">Gross sales</dt><dd className="font-semibold text-(--lp-ink)">{inr(sel.gross)}</dd></div>
              <div className="flex justify-between"><dt className="text-(--lp-muted)">Platform fee ({COMMISSION * 100}%)</dt><dd className="font-semibold text-[#e5484d]">− {inr(sel.fee)}</dd></div>
              <div className="flex justify-between border-t border-(--lp-line) pt-3"><dt className="font-bold text-(--lp-ink)">Net earnings</dt><dd className="font-(family-name:--lp-font) text-xl font-bold text-(--lp-blue-deep)">{inr(sel.net)}</dd></div>
            </dl>
          </div>
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-(--lp-muted)">Students</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[
                ["Enrolled", selected.enrolled.toLocaleString("en-IN")],
                ["This month", `+${selected.month}`],
                ["Completion", `${selected.completion}%`],
                ["Avg. score", `${selected.avgScore}%`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-(--lp-grey) px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-(--lp-muted)">{k}</div>
                  <div className="mt-0.5 font-(family-name:--lp-font) text-xl font-bold text-(--lp-ink)">{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-(--lp-muted)">Enrollments, last 7 months</h3>
            <div className="mt-3 flex h-32 items-end gap-2">
              {selected.spark.map((v, i) => {
                const max = Math.max(...selected.spark);
                return (
                  <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="text-[10px] font-bold text-(--lp-ink)">{v}</span>
                    <div className={`w-full rounded-t-lg ${i === selected.spark.length - 1 ? "bg-(--lp-blue-deep)" : "bg-(--lp-blue-soft)"}`} style={{ height: `${(v / max) * 80}%` }} />
                    <span className="text-[10px] text-(--lp-muted)">{MONTHS[5 + i]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Orders + payouts */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className={card}>
          <Head eyebrow="Latest activity" title="Recent enrollments" right={<span className="rounded-full bg-(--lp-grey) px-3 py-1 text-xs font-bold text-(--lp-ink)">{ORDERS.length}</span>} />
          <ul className="divide-y divide-(--lp-line)">
            {ORDERS.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-(--lp-ink) text-xs font-bold text-white">{o.student.split(" ").map((p) => p[0]).join("")}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-(--lp-ink)">{o.student}</div>
                  <div className="truncate text-xs text-(--lp-muted)">{o.series}</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold text-(--lp-ink)`}>{inr(o.amount)}</div>
                  <div className="text-[11px] text-(--lp-muted)">{o.when}</div>
                </div>
                <span className={`hidden rounded-full px-2.5 py-1 text-[11px] font-bold sm:inline-block ${STATUS_STYLE[o.status]}`}>{o.status}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={card}>
          <Head eyebrow="Wallet" title="Payouts" />
          <div className="rounded-2xl bg-(--lp-blue-tint) p-4">
            <div className="flex items-center justify-between text-xs text-(--lp-muted)"><span>Next payout</span><span className="font-bold text-(--lp-ink)">Nov 05, 2026</span></div>
            <div className="mt-1 font-(family-name:--lp-font) text-2xl font-bold text-(--lp-blue-deep)">{inr(112640)}</div>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-(--lp-muted)"><WalletIcon className="h-3.5 w-3.5" /> HDFC Bank ···· 4821</div>
          </div>
          <ul className="mt-3 divide-y divide-(--lp-line)">
            {PAYOUTS.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e3f5ec] text-[#1f9d6b]"><ArrowDownLeftIcon className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-(--lp-ink)">{inr(p.amount)}</div>
                  <div className="text-[11px] text-(--lp-muted)">{p.date} · {p.ref}</div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#e3f5ec] px-2.5 py-1 text-[11px] font-bold text-[#1f9d6b]"><CheckIcon className="h-3 w-3" />{p.status}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-2xl bg-(--lp-grey) px-4 py-3 text-[11px] leading-relaxed text-(--lp-muted)">Payouts run on the 5th of every month for balances older than 5 days. A {COMMISSION * 100}% platform fee applies to every sale.</p>
        </section>
      </div>
    </div>
  );
}
