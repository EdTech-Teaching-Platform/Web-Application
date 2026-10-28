// /teacher/dashboard: educator_get_dashboard (assigned work with deadlines,
// drafts, series waiting for approval, published count, recent activity,
// a stats preview).
import { useCallback } from "react";
import { Link } from "react-router-dom";
import { useRpc } from "../../admin/hooks/useRpc";
import { educatorApi } from "../services/educatorApi";
import { Empty, ErrorState, Loading, PageCard, StatusPill } from "../components/PageState";
import { formatDate } from "../utils/format";

const ACTIVITY_LABEL = {
  "test_series.wizard_save": "Saved a test series", "test_series.submit_for_approval": "Submitted a series for approval",
  "test_series.publish": "Published a series", "test.create": "Created a test", "question.create": "Added a question",
  "question.update": "Edited a question", "question.option_update": "Edited an answer option", "test.regrade": "Re-scored attempts",
  "assignment.start": "Started an assignment", "assignment.complete": "Completed an assignment",
  "educator.profile_update": "Updated your profile",
};

export default function EducatorDashboard({ api = educatorApi }) {
  const request = useCallback(() => api.getDashboard(), [api]);
  const { data, loading, error, refetch } = useRpc(request);

  if (loading && !data) return <Loading label="Loading your dashboard…" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch().catch(() => {})} />;
  const d = data || {};
  const s = d.stats || {};

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[["Published series", d.published_count ?? 0], ["Learners", s.learners ?? 0], ["Attempts", s.attempts ?? 0], ["Pass rate", `${s.pass_rate ?? 0}%`]].map(([label, value]) => (
          <div key={label} className="rounded-[1.5rem] bg-white p-5 ring-1 ring-(--lp-line)">
            <p className="text-xs font-semibold uppercase tracking-wider text-(--lp-muted)">{label}</p>
            <p className="mt-2 font-(family-name:--lp-font) text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PageCard title="Assigned to you" action={<Link to="/teacher/assigned" className="text-sm font-semibold text-(--lp-blue) underline">View all</Link>}>
          {(d.assigned || []).length === 0 ? <Empty>No open assignments.</Empty> : (
            <ul className="divide-y divide-(--lp-line)">
              {d.assigned.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link to={`/teacher/assigned/${a.id}`} className="block truncate font-semibold hover:underline">{a.test_name}</Link>
                    <p className="truncate text-xs text-(--lp-muted)">{a.series_name} · due {formatDate(a.deadline)}</p>
                  </div>
                  <StatusPill status={a.display_status} />
                </li>
              ))}
            </ul>
          )}
        </PageCard>

        <PageCard title="Drafts" action={<Link to="/teacher/test-series/new" className="text-sm font-semibold text-(--lp-blue) underline">Create test series</Link>}>
          {(d.drafts || []).length === 0 ? <Empty>No drafts. Create a test series to get started.</Empty> : (
            <ul className="divide-y divide-(--lp-line)">
              {d.drafts.map((x) => (
                <li key={x.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <Link to={`/teacher/test-series/${x.id}`} className="truncate font-semibold hover:underline">{x.title}</Link>
                    <StatusPill status={x.status} />
                  </div>
                  {x.rejection_reason && <p className="mt-1 text-xs text-red-700">Not approved: {x.rejection_reason}</p>}
                </li>
              ))}
            </ul>
          )}
        </PageCard>

        <PageCard title="Waiting for approval">
          {(d.pending_approval || []).length === 0 ? <Empty>Nothing waiting for review.</Empty> : (
            <ul className="divide-y divide-(--lp-line)">
              {d.pending_approval.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 py-3">
                  <Link to={`/teacher/test-series/${x.id}`} className="truncate font-semibold hover:underline">{x.title}</Link>
                  <span className="text-xs text-(--lp-muted)">submitted {formatDate(x.submitted_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </PageCard>

        <PageCard title="Recent activity">
          {(d.recent_activity || []).length === 0 ? <Empty>No activity yet.</Empty> : (
            <ul className="space-y-2 text-sm">
              {d.recent_activity.map((a, i) => (
                <li key={`${a.at}-${i}`} className="flex justify-between gap-3">
                  <span>{ACTIVITY_LABEL[a.action] || a.action.replace(/[._]/g, " ")}</span>
                  <span className="shrink-0 text-xs text-(--lp-muted)">{formatDate(a.at, true)}</span>
                </li>
              ))}
            </ul>
          )}
        </PageCard>
      </div>
    </div>
  );
}
