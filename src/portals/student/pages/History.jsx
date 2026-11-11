// Test history (student_my_history): every attempt, newest first.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import ListRow from "../../../components/ui/ListRow";
import StatusBadge from "../../../components/ui/StatusBadge";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, FileTextIcon } from "../../../components/ui/icons";
import { EmptyPanel, ErrorState, LoadingState } from "../components/PageState";
import { Rise } from "../components/StudentKit";
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
const WIDE = "mx-auto w-full max-w-7xl space-y-6 px-4 py-4 sm:space-y-8 sm:px-6 sm:py-6 lg:px-8";
const SURFACE = "rounded-2xl bg-white ring-1 ring-(--lp-line) shadow-[0_1px_2px_rgb(15_17_21/0.04)]";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--lp-blue-deep)";
// One column template shared by the table header and every row so figures line up.
const COLS = "grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-[2.5rem_minmax(0,1fr)_5.5rem_6.5rem_6.5rem_10rem_1rem]";

function HistoryRow({ item, onOpen }) {
  const status = attemptStatus(item);
  const target = attemptTarget(item);
  const finished = item.status === "submitted" || item.status === "timed_out";
  const passed = finished && item.passed;
  const subtitle = [item.series_title, `Attempt ${item.attempt_number}`, formatDate(item.submitted_at || item.started_at, true)].filter(Boolean).join(" · ");
  const score = finished ? formatScore(item.score, item.max_score) : null;
  const percentage = finished ? formatPercent(item.percentage, 1) : null;
  const taken = finished && item.time_taken_secs ? formatSeconds(item.time_taken_secs) : null;
  const iconTone = passed ? "bg-success/15 text-success" : finished ? "bg-(--lp-blue-soft) text-(--lp-blue-deep)" : "bg-(--lp-grey) text-(--lp-muted)";
  const Icon = passed ? CheckIcon : finished ? FileTextIcon : ClockIcon;
  const Wrapper = target ? "button" : "div";
  const cell = "hidden text-right text-sm font-semibold tabular-nums text-(--lp-ink) md:block";
  return (
    <Wrapper
      type={target ? "button" : undefined}
      onClick={target ? () => onOpen(target) : undefined}
      className={`group grid w-full items-center gap-x-4 px-4 py-4 text-left sm:px-5 ${COLS} ${
        target ? `cursor-pointer transition-colors duration-150 hover:bg-(--lp-grey)/70 ${FOCUS} focus-visible:-outline-offset-2` : ""
      }`}
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${iconTone}`} aria-hidden="true">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-(--lp-ink)">{item.test_title}</p>
        <p className="truncate text-sm text-(--lp-muted)">{subtitle}</p>
        {finished && (
          <p className="mt-0.5 truncate text-xs font-medium tabular-nums text-text/70 md:hidden">
            {[score, percentage, taken].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <span className={cell}>{score}</span>
      <span className={cell}>{percentage}</span>
      <span className={cell}>{taken}</span>
      <span className="flex flex-wrap items-center justify-end gap-2">
        {passed && <StatusBadge status="success">Passed</StatusBadge>}
        <StatusBadge status={status.tone}>{status.label}</StatusBadge>
      </span>
      <span className="hidden justify-end md:flex" aria-hidden="true">
        {target && <ChevronRightIcon className="h-4 w-4 text-text/30 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />}
      </span>
    </Wrapper>
  );
}

const PAGER_BTN = `inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-(--lp-ink) ring-1 ring-(--lp-line) transition-colors duration-200 hover:bg-(--lp-grey) disabled:pointer-events-none disabled:text-text/30 ${FOCUS}`;

export default function History() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useStudentData(() => studentSeriesApi.history({ page, size: PAGE_SIZE }), page);

  return (
    <div className={`${WIDE} pb-12`}>
      <Rise>
        <header className={`${SURFACE} flex flex-col gap-5 p-5 sm:p-8 md:flex-row md:items-center md:justify-between`}>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-(--lp-muted)">Your progress</p>
            <h1 className="mt-2 font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-(--lp-ink) sm:text-[2.25rem]">Test history</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-(--lp-muted) sm:text-[15px]">Every attempt you've made. Open one to see its report.</p>
          </div>
        </header>
      </Rise>

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
          <Rise>
            <div className={`${SURFACE} overflow-hidden`}>
              <div className={`hidden grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 border-b border-(--lp-line) bg-(--lp-grey)/60 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-(--lp-muted) sm:px-5 md:grid ${COLS}`} aria-hidden="true">
                <span className="col-span-2">Test</span>
                <span className="text-right">Score</span>
                <span className="text-right">Percentage</span>
                <span className="text-right">Time taken</span>
                <span className="text-right">Status</span>
                <span />
              </div>
              <ul className="divide-y divide-(--lp-line)">
                {data.items.map((item) => <li key={item.attempt_id}><HistoryRow item={item} onOpen={navigate} /></li>)}
              </ul>
            </div>
          </Rise>
          {data.total_pages > 1 && (
            <nav className="flex items-center justify-center gap-3" aria-label="Pages">
              <button type="button" className={PAGER_BTN} disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeftIcon className="h-4 w-4" />
                Previous
              </button>
              <span className="px-2 text-sm font-medium text-(--lp-muted)">Page {page} of {data.total_pages}</span>
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
