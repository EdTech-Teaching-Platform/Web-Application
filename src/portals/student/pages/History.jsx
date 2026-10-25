// Test history (student_my_history): every attempt, newest first.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import ListRow from "../../../components/ui/ListRow";
import StatusBadge from "../../../components/ui/StatusBadge";
import { EmptyPanel, ErrorState, LoadingState, PAGE, PageHeader } from "../components/PageState";
import { useStudentData } from "../hooks/useStudentData";
import { studentSeriesApi } from "../services/studentSeriesApi";
import { attemptStatus, formatDate, formatPercent, formatScore, formatSeconds } from "../utils/format";

const PAGE_SIZE = 20;

export function attemptTarget(item) {
  if (item.status === "in_progress" && !item.is_expired) return `/student/test/${item.test_id}/take`;
  if (item.has_report || item.is_expired) return `/student/report/${item.attempt_id}`;
  return null;   // finished outside this portal: no detailed report
}

export function AttemptRow({ item, onOpen }) {
  const status = attemptStatus(item);
  const target = attemptTarget(item);
  const finished = item.status === "submitted" || item.status === "timed_out";
  return (
    <ListRow
      title={item.test_title}
      subtitle={[item.series_title, `Attempt ${item.attempt_number}`, formatDate(item.submitted_at || item.started_at, true)].filter(Boolean).join(" · ")}
      meta={finished ? `${formatScore(item.score, item.max_score)} · ${formatPercent(item.percentage, 1)}${item.time_taken_secs ? ` · ${formatSeconds(item.time_taken_secs)}` : ""}` : undefined}
      trailing={
        <span className="flex items-center gap-2">
          {finished && item.passed && <StatusBadge status="success">Passed</StatusBadge>}
          <StatusBadge status={status.tone}>{status.label}</StatusBadge>
        </span>
      }
      onClick={target ? () => onOpen(target) : undefined}
    />
  );
}

export default function History() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useStudentData(() => studentSeriesApi.history({ page, size: PAGE_SIZE }), page);

  return (
    <div className={PAGE}>
      <PageHeader eyebrow="Your progress" title="Test history" subtitle="Every attempt you've made. Open one to see its report." />
      {loading ? (
        <LoadingState label="Loading your history" rows={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} title="Couldn't load your history" />
      ) : data.items.length === 0 ? (
        <EmptyPanel
          heading="No attempts yet"
          message="Take a test from one of your series and it will show up here."
          action={<Button fullWidth={false} onClick={() => navigate("/student/test-series")}>Browse test series</Button>}
        />
      ) : (
        <>
          <ul className="space-y-2">
            {data.items.map((item) => <li key={item.attempt_id}><AttemptRow item={item} onOpen={navigate} /></li>)}
          </ul>
          {data.total_pages > 1 && (
            <nav className="flex items-center justify-center gap-3" aria-label="Pages">
              <Button variant="secondary" fullWidth={false} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="text-sm text-text/60">Page {page} of {data.total_pages}</span>
              <Button variant="secondary" fullWidth={false} disabled={page >= data.total_pages} onClick={() => setPage(page + 1)}>Next</Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
