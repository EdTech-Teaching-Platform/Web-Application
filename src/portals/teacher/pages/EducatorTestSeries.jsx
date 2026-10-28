// /teacher/test-series: the educator's own and assigned series
// (list_test_series is role-aware: an educator only gets theirs), in tabs:
// Published, Drafts, Pending approval, Rejected (with the admin's reason).
// "Manage" opens the shared admin manage view (TestSeriesDetail) hosted in
// the teacher portal.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useRpc } from "../../admin/hooks/useRpc";
import { testSeriesApi } from "../../admin/services/testSeriesApi";
import { SERIES_TABS, groupSeriesByTab } from "../utils/onboarding";
import { Empty, ErrorState, Loading, PageCard, StatusPill } from "../components/PageState";
import { formatDate } from "../utils/format";

const EMPTY_TEXT = {
  published: "Nothing published yet. Series go live once an admin approves them (or when you publish an assigned one).",
  drafts: "No drafts. Create a test series to get started.",
  pending: "Nothing is waiting for approval.",
  rejected: "No rejected series.",
};

export default function EducatorTestSeries({ api = testSeriesApi }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState("drafts");
  const [toast, setToast] = useState("");
  const request = useCallback(() => api.list({ p_page: 1, p_size: 100 }), [api]);
  const { data, loading, error, refetch } = useRpc(request);
  const groups = useMemo(() => groupSeriesByTab(data?.rows), [data]);

  // Toast from the wizard ("Submitted for approval…"), then land on the right tab.
  useEffect(() => {
    if (!location.state?.toast) return;
    setToast(location.state.toast);
    if (/approval/i.test(location.state.toast)) setTab("pending");
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const rows = groups[tab] || [];

  return (
    <PageCard
      title="My test series"
      action={<Link to="/teacher/test-series/new" className="rounded-full bg-(--lp-ink) px-4 py-2 text-sm font-semibold text-white">Create Test Series</Link>}
    >
      {toast && <p role="status" className="mb-4 rounded-2xl bg-(--lp-blue-tint) p-3 text-sm">{toast}</p>}
      <div role="tablist" aria-label="Test series by status" className="mb-4 flex flex-wrap gap-2">
        {SERIES_TABS.map((t) => (
          <button key={t.key} type="button" role="tab" id={`ts-tab-${t.key}`} aria-selected={tab === t.key} aria-controls="ts-panel"
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === t.key ? "bg-(--lp-ink) text-white" : "bg-(--lp-grey) text-(--lp-ink)"}`}
            onClick={() => setTab(t.key)}>
            {t.label} <span className="ml-1 opacity-70">({groups[t.key]?.length || 0})</span>
          </button>
        ))}
      </div>
      <div id="ts-panel" role="tabpanel" aria-labelledby={`ts-tab-${tab}`}>
        {loading && <Loading label="Loading your test series…" />}
        {error && <ErrorState error={error} onRetry={() => refetch().catch(() => {})} />}
        {!loading && !error && rows.length === 0 && <Empty>{EMPTY_TEXT[tab]}</Empty>}
        {rows.length > 0 && (
          <ul className="divide-y divide-(--lp-line)">
            {rows.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{s.name}</p>
                  <p className="text-xs text-(--lp-muted)">
                    {s.code} · {s.test_count} test{s.test_count === 1 ? "" : "s"} · {s.origin === "educator" ? "Your series" : "Assigned by admin"}
                    {s.status === "pending_approval" && s.submitted_at ? ` · submitted ${formatDate(s.submitted_at)}` : ""}
                    {s.status === "published" ? ` · ${s.attempts} attempts` : ""}
                  </p>
                  {s.status === "rejected" && s.rejection_reason && (
                    <p className="mt-1 text-sm text-red-700"><strong>Reason:</strong> {s.rejection_reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={s.status} />
                  <Link to={`/teacher/test-series/${s.id}`} className="rounded-full border border-(--lp-ink) px-4 py-1.5 text-sm font-semibold">
                    {s.status === "rejected" ? "Edit" : "Manage"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageCard>
  );
}
