// Discount Management — Overview ("Discount Analytics"). Every figure is
// computed from the live campaign / redemption records in data/discountsMock.js.
import { useEffect, useMemo, useState } from "react";
import { useDiscountState, refreshExpiry, inr } from "../../data/discountsMock";
import { LineChart } from "./DiscountsShared";
import { IconPercent, IconWallet, IconUsers, IconChart, IconStar } from "../../components/icons";

const DAY = 86400000;
const dayKey = (t) => new Date(t).toISOString().slice(0, 10);
const RANGES = [{ v: 7, l: "Last 7 days" }, { v: 14, l: "Last 14 days" }, { v: 30, l: "Last 30 days" }];

function Spark({ values, tone = "red" }) {
  const W = 96, H = 38, max = Math.max(1, ...values);
  const pts = values.map((v, i) => [values.length > 1 ? (i / (values.length - 1)) * W : W / 2, H - 4 - (v / max) * (H - 10)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <svg className={`ul-dov-spark is-${tone}`} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <path d={`${d} L${W},${H} L0,${H} Z`} className="ul-dov-spark__area" />
      <path d={d} className="ul-dov-spark__line" />
    </svg>
  );
}

function Kpi({ icon, tone, label, value, delta, spark, range }) {
  const up = delta != null && delta >= 0;
  return (
    <div className="ul-dov-kpi">
      <span className={`ul-dov-ico is-${tone}`}>{icon}</span>
      <div className="ul-dov-kpi__body">
        <span className="ul-dov-kpi__label">{label}</span>
        <span className="ul-dov-kpi__value">{value}</span>
        <span className="ul-dov-kpi__delta">
          {delta == null ? <em>No earlier data to compare</em> : (<><b className={up ? "is-up" : "is-down"}>{up ? "↑" : "↓"} {Math.abs(delta)}%</b> vs previous {range} days</>)}
        </span>
      </div>
      {spark && <Spark values={spark} tone={tone === "green" ? "green" : "red"} />}
    </div>
  );
}

export default function DiscountOverview() {
  const st = useDiscountState();
  const [range, setRange] = useState(14);
  useEffect(() => { refreshExpiry(); }, []);

  const m = useMemo(() => {
    const now = Date.now();
    const inWin = (r, from, to) => { const t = new Date(r.at).getTime(); return t > from && t <= to; };
    const cur = st.redemptions.filter((r) => inWin(r, now - range * DAY, now + DAY));
    const prev = st.redemptions.filter((r) => inWin(r, now - 2 * range * DAY, now - range * DAY));
    const sum = (list, f) => list.reduce((a, r) => a + f(r), 0);
    const coupons = (r) => r.applied.length;
    const pct = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);

    const days = Array.from({ length: range }, (_, i) => dayKey(now - (range - 1 - i) * DAY));
    const series = (f) => days.map((k) => sum(cur.filter((r) => dayKey(r.at) === k), f));
    const redeemedSeries = series(coupons);
    const trend = days.map((k, i) => ({ x: k.slice(5), y: redeemedSeries[i] }));

    const revenue = sum(cur, (r) => r.final), given = sum(cur, (r) => r.discount), redeemed = sum(cur, coupons);
    const assignedAll = st.assignments.length, assignedUsed = st.assignments.filter((a) => a.redeemedAt).length;
    const rate = assignedAll ? Math.round((assignedUsed / assignedAll) * 100) : null;

    const byCode = {}, byCampaign = {};
    cur.forEach((r) => r.applied.forEach((a) => {
      byCode[a.code] = (byCode[a.code] || 0) + 1;
      const b = (byCampaign[a.campaignId] ||= { name: a.campaignName, revenue: 0, uses: 0 });
      b.uses += 1; b.revenue += r.final / r.applied.length;
    }));
    const topCodes = Object.entries(byCode).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([code, n]) => ({ code, n }));
    const best = Object.values(byCampaign).sort((a, b) => b.revenue - a.revenue).slice(0, 5).map((c) => ({ ...c, revenue: Math.round(c.revenue) }));
    return {
      revenue, given, redeemed, rate, assignedAll, assignedUsed, trend, topCodes, best,
      topMax: Math.max(1, ...topCodes.map((c) => c.n)),
      bestTotal: Math.max(1, best.reduce((a, c) => a + c.revenue, 0)),
      d: { revenue: pct(revenue, sum(prev, (r) => r.final)), given: pct(given, sum(prev, (r) => r.discount)), redeemed: pct(redeemed, sum(prev, coupons)) },
      s: { revenue: series((r) => r.final), given: series((r) => r.discount), redeemed: redeemedSeries },
    };
  }, [st, range]);

  const list = m.revenue + m.given;
  const paidPct = list ? (m.revenue / list) * 100 : 0;

  return (
    <div className="ul-dov">
      <div className="ul-dov-head">
        <span className="ul-dov-head__ico"><IconPercent size={22} /></span>
        <div className="ul-dov-head__text">
          <h3>Performance summary</h3>
          <p>Track the performance of your discounts and offers</p>
        </div>
        <select className="ul-dov-range" value={range} onChange={(e) => setRange(Number(e.target.value))} aria-label="Date range">
          {RANGES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
        </select>
      </div>

      <div className="ul-dov-kpis">
        <Kpi tone="red" icon={<IconWallet size={18} />} label="Revenue from discounts" value={inr(m.revenue)} delta={m.d.revenue} spark={m.s.revenue} range={range} />
        <Kpi tone="amber" icon={<IconPercent size={18} />} label="Total discounts given" value={inr(m.given)} delta={m.d.given} spark={m.s.given} range={range} />
        <Kpi tone="red" icon={<IconChart size={18} />} label="Coupon redemptions" value={m.redeemed} delta={m.d.redeemed} spark={m.s.redeemed} range={range} />
        <div className="ul-dov-kpi">
          <span className="ul-dov-ico is-green"><IconUsers size={18} /></span>
          <div className="ul-dov-kpi__body">
            <span className="ul-dov-kpi__label">Redemption rate</span>
            <span className="ul-dov-kpi__value">{m.rate == null ? "—" : `${m.rate}%`}</span>
            <span className="ul-dov-kpi__delta"><em>{m.assignedAll ? `${m.assignedUsed} of ${m.assignedAll} assigned coupons used` : "No coupons assigned to students yet"}</em></span>
          </div>
        </div>
      </div>

      <div className="ul-dov-row">
        <section className="ul-dov-card">
          <header className="ul-dov-card__head">
            <span className="ul-dov-ico is-red"><IconChart size={16} /></span>
            <div><h4>Coupon redemptions — last {range} days</h4><p>Coupons redeemed per day</p></div>
            <span className="ul-dov-pill">Total redemptions: {m.redeemed}</span>
          </header>
          {m.redeemed === 0 ? <p className="ul-dsc-empty">No coupons were redeemed in this period.</p> : <LineChart points={m.trend} label="Redemptions" />}
        </section>

        <section className="ul-dov-card">
          <header className="ul-dov-card__head">
            <span className="ul-dov-ico is-red"><IconWallet size={16} /></span>
            <div><h4>Revenue from discounted purchases</h4><p>Amount actually paid after discounts</p></div>
            <span className="ul-dov-total"><small>Total (List Price)</small><b>{inr(list)}</b></span>
          </header>
          <div className="ul-dov-bignum">{inr(m.revenue)}</div>
          <div className="ul-dsc-split"><div className="ul-dsc-split__paid" style={{ width: `${paidPct}%` }} /><div className="ul-dsc-split__disc" style={{ width: `${list ? 100 - paidPct : 0}%` }} /></div>
          <div className="ul-dsc-split__legend">
            <span><i style={{ background: "var(--color-primary)" }} />Paid {inr(m.revenue)} {list ? `(${paidPct.toFixed(1)}%)` : ""}</span>
            <span><i style={{ background: "#e0a48f" }} />Discounted {inr(m.given)} {list ? `(${(100 - paidPct).toFixed(1)}%)` : ""}</span>
          </div>
          <div className="ul-dov-listrow"><span>List price of discounted purchases</span><b>{inr(list)}</b></div>
        </section>
      </div>

      <div className="ul-dov-row">
        <section className="ul-dov-card">
          <header className="ul-dov-card__head">
            <span className="ul-dov-ico is-red"><IconStar size={16} /></span>
            <div><h4>Most-used coupon codes</h4><p>By number of redemptions</p></div>
          </header>
          {m.topCodes.length === 0 ? <p className="ul-dsc-empty">No coupon was redeemed in this period.</p> : (
            <table className="ul-dov-table">
              <thead><tr><th>#</th><th>Coupon code</th><th>Redemptions</th><th>Usage</th></tr></thead>
              <tbody>
                {m.topCodes.map((c, i) => (
                  <tr key={c.code}>
                    <td><span className="ul-dov-rank">{i + 1}</span></td>
                    <td><span className="ul-dov-code">{c.code}</span></td>
                    <td className="ul-dov-num">{c.n}</td>
                    <td><div className="ul-dov-bar"><div className="ul-dov-bar__track"><div style={{ width: `${(c.n / m.topMax) * 100}%` }} /></div><span>{Math.round((c.n / m.topMax) * 100)}%</span></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="ul-dov-card">
          <header className="ul-dov-card__head">
            <span className="ul-dov-ico is-red"><IconChart size={16} /></span>
            <div><h4>Best-performing discounts</h4><p>By revenue from discounted purchases</p></div>
          </header>
          {m.best.length === 0 ? <p className="ul-dsc-empty">No discount earned revenue in this period.</p> : (
            <table className="ul-dov-table">
              <thead><tr><th>#</th><th>Discount name</th><th>Redemptions</th><th>Revenue (Discounted)</th><th>Performance</th></tr></thead>
              <tbody>
                {m.best.map((c, i) => (
                  <tr key={c.name}>
                    <td><span className="ul-dov-rank">{i + 1}</span></td>
                    <td className="ul-dov-name">{c.name}</td>
                    <td className="ul-dov-num">{c.uses}</td>
                    <td className="ul-dov-num">{inr(c.revenue)}</td>
                    <td><div className="ul-dov-bar"><div className="ul-dov-bar__track"><div style={{ width: `${(c.revenue / m.bestTotal) * 100}%` }} /></div><span>{Math.round((c.revenue / m.bestTotal) * 100)}%</span></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
