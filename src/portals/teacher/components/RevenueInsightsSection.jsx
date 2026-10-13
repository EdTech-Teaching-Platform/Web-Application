// RevenueInsightsSection — Analytics hub Part 5: revenue efficiency stat
// cards, the free-preview conversion signal (framed as a correlation, not
// a claim), and a clear hand-off to the real Earnings dashboard. Reuses
// courseTotalRevenue()/courseComparisonRows() so figures match Earnings
// exactly.
import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import StatCard from "../../../components/ui/StatCard";
import Button from "../../../components/ui/Button";
import { WalletIcon, UsersIcon, BookIcon, InfoIcon, ArrowUpRightIcon, EyeIcon } from "../../../components/ui/icons";
import { revenueEfficiency, previewConversionSignal, revenueBySource, formatUsd } from "../data/analyticsData";
import { formatMoney } from "../../../utils/formatMoney";

export default function RevenueInsightsSection({ courses, range = "All" }) {
  const efficiency = useMemo(() => revenueEfficiency(courses), [courses]);
  const preview = useMemo(() => previewConversionSignal(courses), [courses]);
  const bySource = useMemo(() => revenueBySource(courses, range), [courses, range]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={WalletIcon} tone="maroon" label="Lifetime revenue (published courses)" value={formatUsd(efficiency.totalRevenue)} />
        <StatCard icon={UsersIcon} tone="blue" label="Revenue per student" value={formatUsd(efficiency.perStudent)} />
        <StatCard icon={BookIcon} tone="sage" label="Revenue per published course" value={formatUsd(efficiency.perCourse)} />
      </div>

      <section className="rounded-3xl bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-text">Revenue by source</h2>
          <span className="text-xs text-muted">Selected range · net of platform fee</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {bySource.rows.map((r) => (
            <div key={r.key} className="rounded-2xl bg-bg p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{r.label}</p>
              <p className="mt-1 text-2xl font-bold text-text">{formatMoney(r.amount)}</p>
              <p className="text-xs text-muted">
                {r.count} sale{r.count === 1 ? "" : "s"}
                {bySource.total > 0 ? ` · ${Math.round((r.amount / bySource.total) * 100)}%` : ""}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          Total {formatMoney(bySource.total)}. Bundle sales are existing course sales tagged by source, so this matches Earnings exactly.
        </p>
      </section>

      <section className="rounded-3xl bg-white p-5 sm:p-6 shadow-soft">
        <div className="flex items-center gap-2">
          <EyeIcon className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold text-text">Free-preview lesson conversion signal</h2>
        </div>
        <p className="mt-1 text-xs text-muted">
          A correlation across your current course set, not a proven cause-and-effect claim — treat this as a signal
          worth watching, not a definitive result.
        </p>

        {preview.rows.length < 2 ? (
          <p className="mt-6 py-4 text-center text-sm text-muted">Not enough courses yet to compare</p>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-bg p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                2+ free-preview lessons ({preview.moreGroupCount} course{preview.moreGroupCount === 1 ? "" : "s"})
              </p>
              <p className="mt-2 text-2xl font-semibold text-text">{preview.moreGroupAvgSales.toLocaleString()}</p>
              <p className="text-xs text-muted">avg. total sales</p>
            </div>
            <div className="rounded-xl bg-bg p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Fewer than 2 ({preview.fewerGroupCount} course{preview.fewerGroupCount === 1 ? "" : "s"})
              </p>
              <p className="mt-2 text-2xl font-semibold text-text">{preview.fewerGroupAvgSales.toLocaleString()}</p>
              <p className="text-xs text-muted">avg. total sales</p>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-warning/[0.08] px-4 py-3 text-xs text-warning">
          <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          With only a handful of courses in this portfolio, this comparison is directional at best — don't restructure
          a course's preview lessons on this alone.
        </div>
      </section>

      <section className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-primary/[0.06] p-5 ring-1 ring-primary/15 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h2 className="text-base font-bold text-text">Want the full transaction-level picture?</h2>
          <p className="mt-1 text-sm text-muted">Ledger entries, payouts, wallet balance and commission — all in the Earnings dashboard.</p>
        </div>
        <NavLink to="/teacher/earnings" className="shrink-0">
          <Button variant="primary" fullWidth={false} className="flex items-center gap-1.5 px-5">
            View Full Earnings Dashboard
            <ArrowUpRightIcon className="h-4 w-4" />
          </Button>
        </NavLink>
      </section>
    </div>
  );
}
