import { useMemo, useState } from "react";
import StatCard from "../../../components/ui/StatCard";
import Button from "../../../components/ui/Button";
import EarningsTrendChart from "./EarningsTrendChart";
import { WalletIcon, TrendingUpIcon, ClockIcon, ArrowDownLeftIcon, ChartIcon, InfoIcon } from "../../../components/ui/icons";
import { PLATFORM_COMMISSION_RATE } from "./contentData";
import { DATE_RANGES, formatMoney, courseBreakdown } from "../data/earningsData";
import { TODAY } from "../data/teacherCourses";

function monthlySeries(ledger, months = 6) {
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en-US", { month: "short" }), gross: 0, net: 0 });
  }
  ledger.forEach((e) => {
    if (e.type !== "sale" && e.type !== "clawback") return;
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = buckets.find((b) => b.key === key);
    if (!bucket) return;
    bucket.net += e.amount;
    bucket.gross += e.grossAmount ? (e.amount >= 0 ? e.grossAmount : -e.grossAmount) : e.amount / (1 - PLATFORM_COMMISSION_RATE);
  });
  return buckets.map((b) => ({ label: b.label, gross: Math.round(b.gross * 100) / 100, net: Math.round(b.net * 100) / 100 }));
}

// Revenue Dashboard — the Earnings section's landing view. Every figure
// here (hero cards, the chart, the per-course table, the commission
// panel) reads the same `ledger`/`payouts`/`balances` the other three tabs
// use, passed down from Earnings.jsx, so nothing on this screen can drift
// from what the Ledger or Wallet tabs show.
export default function EarningsDashboardTab({ ledger, courses, balances, currency = "INR", onRequestPayout }) {
  const [metric, setMetric] = useState("net");
  const [range, setRange] = useState("6M");

  const series = useMemo(() => {
    const months = range === "30D" ? 1 : range === "3M" ? 3 : 6;
    return monthlySeries(ledger, months);
  }, [ledger, range]);

  const breakdown = useMemo(() => courseBreakdown(ledger, courses), [ledger, courses]);
  const lifetimeCommission = useMemo(
    () => Math.round(ledger.reduce((s, e) => s + (e.type === "sale" ? e.commission || 0 : 0), 0) * 100) / 100,
    [ledger]
  );
  const lifetimeGross = useMemo(
    () => Math.round(ledger.reduce((s, e) => s + (e.type === "sale" && e.grossAmount ? e.grossAmount : 0), 0) * 100) / 100,
    [ledger]
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TrendingUpIcon} tone="sage" label="Total earnings (lifetime)" value={formatMoney(balances.totalEarnings, currency)} />
        <StatCard
          icon={WalletIcon} tone="maroon"
          label="Available balance"
          value={formatMoney(balances.availableBalance, currency)}
          hero
          action={
            <Button fullWidth={false} className="px-4 py-2 text-xs" onClick={onRequestPayout}>
              Request Payout
            </Button>
          }
        />
        <StatCard icon={ClockIcon} tone="orange" label={`Pending (clears in ${14}d)`} value={formatMoney(balances.pendingBalance, currency)} />
        <StatCard icon={ArrowDownLeftIcon} tone="pink" label="Lifetime withdrawn" value={formatMoney(balances.lifetimeWithdrawn, currency)} />
      </div>

      <section className="gradient-hero rounded-3xl bg-surface p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-text">Earnings over time</h2>
            <p className="mt-0.5 text-xs text-muted">Gross sales vs. what you actually keep after commission</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full bg-bg p-1 text-xs font-semibold">
              {["net", "gross"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetric(m)}
                  className={`rounded-full px-3 py-1.5 capitalize transition-all duration-150 ${
                    metric === m ? "bg-primary text-white" : "text-muted hover:text-text"
                  } hover:-translate-y-0.5 hover:shadow-soft`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex rounded-full bg-bg p-1 text-xs font-semibold">
              {DATE_RANGES.filter((r) => r !== "All").map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={`rounded-full px-3 py-1.5 transition-all duration-150 ${
                    range === r ? "bg-primary text-white" : "text-muted hover:text-text"
                  } hover:-translate-y-0.5 hover:shadow-soft`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <EarningsTrendChart data={series} metric={metric} currency={currency} className="text-primary" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-3xl bg-white p-5 sm:p-6 shadow-soft">
          <h2 className="text-base font-bold text-text">Per-course breakdown</h2>
          <p className="mt-0.5 text-xs text-muted">Net earnings by course, all time</p>
          <div className="mt-4 flex flex-col divide-y divide-text/[0.06]">
            {breakdown.length === 0 && <p className="py-8 text-center text-sm text-muted">No sales yet</p>}
            {breakdown.map((row) => (
              <div key={row.courseId} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-text">{row.courseTitle}</div>
                  <div className="text-xs text-muted">{row.sales} sale{row.sales === 1 ? "" : "s"}</div>
                </div>
                <div className={`shrink-0 text-sm font-semibold ${row.net < 0 ? "text-danger" : "text-text"}`}>
                  {formatMoney(row.net, currency)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-dashed border-text/15 bg-bg p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
              <ChartIcon className="h-3.5 w-3.5" />
              Commission transparency
            </span>
            <span className="group relative">
              <InfoIcon className="h-3.5 w-3.5 cursor-help text-muted" />
              <span className="pointer-events-none absolute right-0 top-6 z-10 w-56 rounded-xl bg-text px-3 py-2 text-[11px] leading-relaxed text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100">
                Commission is captured at the moment of each sale — a later rate change never applies retroactively to
                past sales.
              </span>
            </span>
          </div>
          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted">Gross sales (lifetime)</dt>
              <dd className="font-medium text-text">{formatMoney(lifetimeGross, currency)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">Platform commission ({Math.round(PLATFORM_COMMISSION_RATE * 100)}%)</dt>
              <dd className="font-medium text-danger">−{formatMoney(lifetimeCommission, currency)}</dd>
            </div>
            <div className="my-1 border-t border-dashed border-text/15" />
            <div className="flex items-center justify-between">
              <dt className="font-semibold text-text">Your lifetime earnings</dt>
              <dd className="text-lg font-bold text-success">{formatMoney(balances.totalEarnings, currency)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
