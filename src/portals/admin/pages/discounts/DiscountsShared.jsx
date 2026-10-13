// Small pieces shared by the Discount Management pages.
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../../../hooks/useAuth";
import { IconMore, IconClose } from "../../components/icons";
import { STATUS_LABEL, STATUS_BADGE, can } from "../../data/discountsMock";
import "../AdminDashboard.css";
import "../EducatorVerification.css";
import "../RegionalHeads.css";
import "./Discounts.css";

/* ---- in-page navigation: all discount sections live on ONE page ---- */
export const DISCOUNT_TABS = [
  { key: "manage", label: "Manage Discounts" },
  { key: "create", label: "Create Discount" },
  { key: "analytics", label: "Analytics & Reports" },
  { key: "history", label: "Discount History" },
];
// "/admin/discounts/coupons?status=active" -> { tab: "coupons", params: { status: "active" } }
export function parseDiscountPath(path) {
  const [p, qs = ""] = String(path).split("?");
  const seg = p.replace(/^\/admin\/discounts\/?/, "").split("/").filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(qs));
  if (seg[0] === "edit" && seg[1]) return { tab: "create", params: { ...params, edit: seg[1] } };
  return { tab: DISCOUNT_TABS.some((t) => t.key === seg[0]) ? seg[0] : "manage", params };
}
const DiscountNavContext = createContext({ navigate: () => {}, params: new URLSearchParams(), setParams: () => {} });
export const DiscountNavProvider = DiscountNavContext.Provider;
export const useDiscountNavigate = () => useContext(DiscountNavContext).navigate;
export function useDiscountSearchParams() { const c = useContext(DiscountNavContext); return [c.params, c.setParams]; }
export function DLink({ to, className, children }) {
  const navigate = useDiscountNavigate();
  return <a href={to} className={className} onClick={(e) => { e.preventDefault(); navigate(to); }}>{children}</a>;
}
let _flash = "";
export const setFlash = (m) => { _flash = m; };
export const takeFlash = () => { const m = _flash; _flash = ""; return m; };

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
// <input type="datetime-local"> value from an ISO string (local time)
export const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso); const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function useActor() {
  const { user } = useAuth();
  const role = user?.role || "admin";
  return { name: user?.name || "Admin User", role, can: (a) => can(role, a) };
}

export function StatusBadge({ status }) {
  return <span className={`ul-status-badge ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function useToast() {
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 3400);
    return () => clearTimeout(t);
  }, [toast]);
  return [toast, setToast, toast ? <div className="ul-usr-toast">{toast}</div> : null];
}

// Section header inside the unified page: a small title/subtitle on the left, section actions on the right.
export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="ul-dsc-sechead">
      <div>
        <h3 className="ul-dsc-sechead__title">{title}</h3>
        {subtitle && <p className="ul-dsc-sechead__sub">{subtitle}</p>}
      </div>
      {children && <div className="ul-rh-header-actions">{children}</div>}
    </div>
  );
}

export function StatCards({ items }) {
  return (
    <div className="ul-dsc-stats">
      {items.map((c) => {
        const body = (
          <>
            <span className="ul-stat-card__label">{c.label.toUpperCase()}</span>
            <span className="ul-stat-card__value">{c.value}</span>
            {c.note && <span className="ul-stat-card__trend is-up">{c.note}</span>}
          </>
        );
        return c.to ? (
          <DLink key={c.label} to={c.to} className="ul-stat-card ul-dsc-stat">{body}</DLink>
        ) : (
          <div key={c.label} className="ul-stat-card ul-dsc-stat">{body}</div>
        );
      })}
    </div>
  );
}

export function Pager({ page, setPage, total, size }) {
  const count = Math.max(1, Math.ceil(total / size));
  const cur = Math.min(page, count);
  if (total === 0) return null;
  return (
    <div className="ul-edu-pagination">
      <span className="ul-edu-pagination__info">Showing {(cur - 1) * size + 1}–{Math.min(cur * size, total)} of {total}</span>
      <div className="ul-edu-pagination__controls">
        <button type="button" disabled={cur === 1} onClick={() => setPage(cur - 1)}>Prev</button>
        <span>{cur} / {count}</span>
        <button type="button" disabled={cur === count} onClick={() => setPage(cur + 1)}>Next</button>
      </div>
    </div>
  );
}
export const pageSlice = (rows, page, size) => rows.slice((Math.min(page, Math.max(1, Math.ceil(rows.length / size))) - 1) * size, Math.min(page, Math.max(1, Math.ceil(rows.length / size))) * size);

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="ul-edp-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} type="button" role="tab" className={`ul-edp-tab${value === t.key ? " is-active" : ""}`} onClick={() => onChange(t.key)}>{t.label}</button>
      ))}
    </div>
  );
}

export function Modal({ title, subtitle, onClose, children, footer, wide = false, hideClose = false }) {
  return (
    <div className="ul-dsc-backdrop" onClick={onClose}>
      <div className={`ul-dsc-modal${wide ? " is-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="ul-dsc-modal__head">
          <div>
            {subtitle && <div className="ul-dsc-modal__sub">{subtitle}</div>}
            <h3>{title}</h3>
          </div>
          {!hideClose && <button type="button" className="ul-cmi-x" onClick={onClose} aria-label="Close"><IconClose size={14} /></button>}
        </div>
        <div className="ul-dsc-modal__body">{children}</div>
        {footer && <div className="ul-dsc-modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

// Row "⋮" menu rendered in a portal so table overflow can't clip it.
export function RowMenu({ items }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  const menu = useRef(null);
  const visible = items.filter(Boolean);
  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const h = menu.current ? menu.current.offsetHeight : 220;
    const top = r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4;
    setPos({ top, right: Math.max(8, window.innerWidth - r.right) });
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (menu.current?.contains(e.target) || btn.current?.contains(e.target)) return; setOpen(false); };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    window.addEventListener("scroll", () => setOpen(false), true);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  if (!visible.length) return null;
  return (
    <>
      <button type="button" ref={btn} className="ul-edu-more-btn" aria-label="More actions" aria-haspopup="menu" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
        <IconMore size={15} />
      </button>
      {open && createPortal(
        <div ref={menu} className="ul-dsc-menu" role="menu" style={{ top: pos ? pos.top : -9999, right: pos ? pos.right : 8 }} onClick={(e) => e.stopPropagation()}>
          {visible.map((it) => (
            <button key={it.label} type="button" role="menuitem" className={it.danger ? "is-danger" : ""} onClick={() => { setOpen(false); it.onClick(); }}>{it.label}</button>
          ))}
        </div>, document.body)}
    </>
  );
}

export function exportCsv(filename, rows) {
  const cell = (v) => { const t = String(v ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const csv = rows.map((r) => r.map(cell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

/* ---- tiny charts: one series, thin marks, recessive grid ---- */
export function LineChart({ points, format = (v) => v, label = "value" }) {
  // points: [{x: label, y: number}] — area chart with smooth curve, gradient fill and nice axis ticks
  const W = 520, H = 150, L = 40, B = 22, T = 12, R = 12;
  const rawMax = Math.max(1, ...points.map((p) => p.y));
  const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const niceStep = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => rawMax / st <= 4) || mag * 10;
  const max = Math.ceil(rawMax / niceStep) * niceStep;
  const ticks = []; for (let v = 0; v <= max + 1e-9; v += niceStep) ticks.push(v);
  const step = points.length > 1 ? (W - L - R) / (points.length - 1) : 0;
  const px = (i) => L + i * step;
  const py = (v) => T + (H - T - B) * (1 - v / max);
  const xy = points.map((p, i) => [px(i), py(p.y)]);
  // smooth (monotone-ish) path using midpoint control points
  let line = xy.length ? `M${xy[0][0]},${xy[0][1]}` : "";
  for (let i = 1; i < xy.length; i++) {
    const cx = (xy[i - 1][0] + xy[i][0]) / 2;
    line += ` C${cx},${xy[i - 1][1]} ${cx},${xy[i][1]} ${xy[i][0]},${xy[i][1]}`;
  }
  const area = xy.length ? `${line} L${xy[xy.length - 1][0]},${py(0)} L${xy[0][0]},${py(0)} Z` : "";
  const labelEvery = Math.ceil(points.length / 6);
  const [hover, setHover] = useState(null);
  const gid = useMemo(() => "dscg" + Math.random().toString(36).slice(2, 8), []);
  const active = hover != null ? hover : points.length - 1;
  return (
    <div className="ul-dsc-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} over time`} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={py(t)} y2={py(t)} className="ul-dsc-grid" />
            <text x={L - 6} y={py(t) + 3} textAnchor="end" className="ul-dsc-axis">{format(t)}</text>
          </g>
        ))}
        {points.map((p, i) => i % labelEvery === 0 && <text key={p.x} x={px(i)} y={H - 6} textAnchor="middle" className="ul-dsc-axis">{p.x}</text>)}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} className="ul-dsc-line" />
        {points.length > 0 && (
          <g>
            <line x1={px(active)} x2={px(active)} y1={T} y2={py(0)} className="ul-dsc-cross" />
            <circle cx={px(active)} cy={py(points[active].y)} r="4" className="ul-dsc-dot" />
            <g transform={`translate(${Math.min(Math.max(px(active), L + 40), W - R - 40)},${Math.max(py(points[active].y) - 24, 2)})`}>
              <rect x="-40" y="0" width="80" height="18" rx="9" className="ul-dsc-tipbg" />
              <text x="0" y="12.5" textAnchor="middle" className="ul-dsc-tip">{format(points[active].y)}</text>
            </g>
          </g>
        )}
        {points.map((p, i) => (
          <rect key={p.x} x={px(i) - Math.max(step / 2, 6)} y={T} width={Math.max(step, 12)} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
    </div>
  );
}

export function BarList({ rows, format = (v) => v, empty = "No data yet." }) {
  // rows: [{label, sub, value}]
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="ul-dsc-empty">{empty}</p>;
  return (
    <ul className="ul-dsc-bars">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${format(r.value)}`}>
          <div className="ul-dsc-bars__top"><span className="ul-dsc-bars__label">{r.label}</span><span className="ul-dsc-bars__val">{format(r.value)}</span></div>
          <div className="ul-dsc-bars__track"><div className="ul-dsc-bars__fill" style={{ width: `${(r.value / max) * 100}%` }} /></div>
          {r.sub && <span className="ul-dsc-bars__sub">{r.sub}</span>}
        </li>
      ))}
    </ul>
  );
}

export function campaignMetrics(c, st) {
  const reds = st.redemptions.filter((r) => r.applied.some((a) => a.campaignId === c.id));
  const assigned = st.assignments.filter((a) => a.campaignId === c.id);
  const unique = st.coupons.filter((x) => x.campaignId === c.id);
  const issued = c.codeMode === "unique" ? Math.max(unique.length, assigned.length) : assigned.length;
  const discount = reds.reduce((a, r) => a + r.applied.filter((x) => x.campaignId === c.id).reduce((s, x) => s + x.discount, 0), 0);
  const revenue = reds.reduce((a, r) => a + r.final / r.applied.length, 0);
  const redeemed = reds.length;
  const rate = issued > 0 ? Math.round((redeemed / issued) * 100) : c.totalLimit ? Math.round((redeemed / c.totalLimit) * 100) : null;
  return { reds, assigned, issued, redeemed, discount, revenue, rate, remaining: c.totalLimit == null ? null : Math.max(0, c.totalLimit - redeemed) };
}

