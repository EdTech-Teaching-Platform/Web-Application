// Test history (student_my_history): every attempt, newest first.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import ListRow from "../../../components/ui/ListRow";
import StatusBadge from "../../../components/ui/StatusBadge";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, FileTextIcon } from "../../../components/ui/icons";
import { EmptyPanel, ErrorState, LoadingState, PAGE } from "../components/PageState";
import PageHero from "../components/PageHero";
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

// Presentation-only row for the redesigned page (AttemptRow above is kept as-is).
function HistoryRow({ item, onOpen }) {
  const status = attemptStatus(item);
  const target = attemptTarget(item);
  const finished = item.status === "submitted" || item.status === "timed_out";
  const passed = finished && item.passed;
  const subtitle = [item.series_title, `Attempt ${item.attempt_number}`, formatDate(item.submitted_at || item.started_at, true)].filter(Boolean).join(" · ");
  const figures = finished
    ? [
        { label: "Score", value: formatScore(item.score, item.max_score) },
        { label: "Percentage", value: formatPercent(item.percentage, 1) },
        ...(item.time_taken_secs ? [{ label: "Time taken", value: formatSeconds(item.time_taken_secs) }] : []),
      ]
    : null;
  const pct = Math.min(Math.max(Number(item.percentage) || 0, 0), 100);
  const iconTone = passed ? "bg-success/15 text-success" : finished ? "bg-(--lp-blue-soft) text-primary" : "bg-(--lp-grey) text-(--lp-muted)";
  const Icon = passed ? CheckIcon : finished ? FileTextIcon : ClockIcon;
  const Wrapper = target ? "button" : "div";
  return (
    <Wrapper
      type={target ? "button" : undefined}
      onClick={target ? () => onOpen(target) : undefined}
      className={`group flex w-full items-center gap-4 rounded-3xl bg-white p-4 text-left ring-1 ring-(--lp-line) transition-[transform,box-shadow] duration-200 ease-out sm:px-5 sm:py-5 ${
        target ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgb(15_17_21/0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" : ""
      }`}
    >
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${iconTone}`} aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-text">{item.test_title}</p>
        <p className="truncate text-sm text-(--lp-muted)">{subtitle}</p>
      </div>
      {figures && (
        <div className="hidden shrink-0 flex-col items-end gap-2 md:flex">
          <dl className="flex items-start gap-5">
            {figures.map((f) => (
              <div key={f.label} className="flex flex-col items-end gap-0.5">
                <dd className="text-sm font-bold leading-none text-text">{f.value}</dd>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-(--lp-muted)">{f.label}</dt>
              </div>
            ))}
          </dl>
          <span className="h-1.5 w-full overflow-hidden rounded-full bg-(--lp-grey)" aria-hidden="true">
            <span className={`block h-full rounded-full ${passed ? "bg-success" : "bg-(--lp-blue)"}`} style={{ width: `${pct}%` }} />
          </span>
        </div>
      )}
      <span className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {passed && <StatusBadge status="success">Passed</StatusBadge>}
        <StatusBadge status={status.tone}>{status.label}</StatusBadge>
      </span>
      {target && <ChevronRightIcon className="hidden h-4 w-4 shrink-0 text-text/30 transition-transform duration-200 ease-out group-hover:translate-x-0.5 sm:block" aria-hidden="true" />}
    </Wrapper>
  );
}

const PAGER_BTN = "inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-primary ring-1 ring-(--lp-line) transition-[transform,background-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:bg-(--lp-blue-tint) hover:shadow-[0_8px_20px_rgb(37_87_214/0.12)] disabled:pointer-events-none disabled:translate-y-0 disabled:text-text/30 disabled:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function History() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useStudentData(() => studentSeriesApi.history({ page, size: PAGE_SIZE }), page);

  return (
    <div className={`${PAGE} space-y-10 pb-10`}>
      <PageHero
        compact
        theme="peach"
        art="clock"
        eyebrow="Your progress"
        title="Test history"
        subtitle="Every attempt you've made. Open one to see its report."
      />

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
          <ul className="space-y-3">
            {data.items.map((item) => <li key={item.attempt_id}><HistoryRow item={item} onOpen={navigate} /></li>)}
          </ul>
          {data.total_pages > 1 && (
            <nav className="flex items-center justify-center gap-3" aria-label="Pages">
              <button type="button" className={PAGER_BTN} disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeftIcon className="h-4 w-4" />
                Previous
              </button>
              <span className="rounded-full bg-white px-4 py-2.5 text-sm font-medium text-text/70 ring-1 ring-(--lp-line)">Page {page} of {data.total_pages}</span>
              <button type="button" className={PAGER_BTN} disabled={page >= data.total_pages} onClick={() => setPage(page + 1)}>
                Next
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
