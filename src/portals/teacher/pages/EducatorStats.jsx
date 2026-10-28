// /teacher/stats: educator_get_stats (counts and averages only, no student
// data, no earnings). Charts reuse TrendChart and DonutChart.
import { useCallback } from "react";
import { useRpc } from "../../admin/hooks/useRpc";
import TrendChart from "../components/TrendChart";
import DonutChart from "../../../components/ui/DonutChart";
import { educatorApi } from "../services/educatorApi";
import { Empty, ErrorState, Loading, PageCard, StatusPill } from "../components/PageState";

export default function EducatorStats({ api = educatorApi }) {
  const request = useCallback(() => api.getStats(), [api]);
  const { data, loading, error, refetch } = useRpc(request);

  if (loading && !data) return <Loading label="Loading your stats…" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch().catch(() => {})} />;
  const s = data || {};
  const trend = (s.trend || []).map((w) => ({ label: new Date(w.week).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), count: Number(w.attempts || 0) }));
  const passRate = Number(s.pass_rate || 0);
  const ratings = s.ratings || { count: 0, average: 0, distribution: {} };
  const maxRating = Math.max(1, ...Object.values(ratings.distribution || {}).map(Number));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[["Test series", s.series?.total ?? 0], ["Tests / questions", `${s.tests ?? 0} / ${s.questions ?? 0}`], ["Learners", s.learners ?? 0],
          ["Attempts", s.attempts ?? 0], ["Average score", `${s.average_score ?? 0}%`], ["Pass rate", `${passRate}%`],
          ["Open assignments", s.assignments?.open ?? 0], ["Rating", ratings.count ? `${ratings.average} / 5` : "—"]].map(([label, value]) => (
          <div key={label} className="rounded-[1.5rem] bg-white p-5 ring-1 ring-(--lp-line)">
            <p className="text-xs font-semibold uppercase tracking-wider text-(--lp-muted)">{label}</p>
            <p className="mt-2 font-(family-name:--lp-font) text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <PageCard title="Attempts per week" className="lg:col-span-2">
          <figure>
            <TrendChart data={trend.some((t) => t.count > 0) ? trend : []} size="lg" />
            <figcaption className="sr-only">Submitted attempts on your test series in each of the last 12 weeks.</figcaption>
          </figure>
        </PageCard>
        <PageCard title="Pass rate">
          {s.attempts ? (
            <DonutChart centerLabel={`${passRate}%`} centerSub="passed"
              segments={[{ label: "Passed", value: passRate, colorClass: "stroke-rotation-1" }, { label: "Not passed", value: Math.max(0, 100 - passRate), colorClass: "stroke-rotation-2" }]} />
          ) : <Empty>No attempts yet.</Empty>}
        </PageCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <PageCard title="Per series" className="lg:col-span-2">
          {(s.per_series || []).length === 0 ? <Empty>No series yet.</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-(--lp-muted)"><tr><th className="py-2">Series</th><th>Status</th><th>Attempts</th><th>Average</th><th>Pass rate</th></tr></thead>
                <tbody className="divide-y divide-(--lp-line)">
                  {s.per_series.map((r) => (
                    <tr key={r.series_id}><td className="py-2 font-medium">{r.title}</td><td><StatusPill status={r.status} /></td><td>{r.attempts}</td><td>{r.average_score}%</td><td>{r.pass_rate}%</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PageCard>
        <div className="space-y-6">
          <PageCard title="Assignments">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[["Open", s.assignments?.open], ["Due in 7 days", s.assignments?.due_soon], ["Overdue", s.assignments?.overdue], ["Completed", s.assignments?.completed]].map(([k, v]) => (
                <div key={k}><dt className="text-xs text-(--lp-muted)">{k}</dt><dd className="text-xl font-bold">{v ?? 0}</dd></div>
              ))}
            </dl>
          </PageCard>
          <PageCard title="Student ratings">
            {ratings.count === 0 ? <Empty>No ratings yet.</Empty> : (
              <ul className="space-y-1.5 text-sm" aria-label={`Average ${ratings.average} out of 5 from ${ratings.count} ratings`}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const n = Number(ratings.distribution?.[star] || 0);
                  return (
                    <li key={star} className="flex items-center gap-2">
                      <span className="w-6">{star}★</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-(--lp-grey)" aria-hidden="true">
                        <span className="block h-full rounded-full bg-(--lp-yellow)" style={{ width: `${(n / maxRating) * 100}%` }} />
                      </span>
                      <span className="w-8 text-right text-xs">{n}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </PageCard>
        </div>
      </div>
    </div>
  );
}
