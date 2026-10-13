// Leaderboard tab of the series detail view. Two views of the SAME real
// attempt data the Performance tab uses (see data/testSeriesLeaderboard.js):
//   Overall   -- students ranked across the whole series (average of best scores)
//   Per test  -- standings for one test: score, time taken, completion date
// Top three get a podium and medal-style rank badges. Sort by score / time /
// completion date, search by name. Table on desktop, stacked cards on mobile.
// Preview-as-Student attempts are never part of the data.
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../../components/ui/EmptyState";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import Button from "../../../components/ui/Button";
import { AlertTriangleIcon, ChartIcon, StarIcon } from "../../../components/ui/icons";
import { Avatar, Pager, Panel, fmtClock, fmtDate, fmtPct } from "./performance/perfUi";
import { LB_SORTS, LB_VIEWS, OVERALL_METHOD, buildLeaderboard, searchRows, sortRows } from "../data/testSeriesLeaderboard";

const PAGE = 10;
const MEDAL = {
  1: { badge: "bg-secondary text-white ring-2 ring-secondary/40", row: "bg-secondary/[0.07]", podium: "bg-secondary/15 ring-2 ring-secondary", label: "1st place" },
  2: { badge: "bg-pastel-blue text-pastel-blue-ink ring-2 ring-pastel-blue-ink/20", row: "bg-pastel-blue/40", podium: "bg-pastel-blue", label: "2nd place" },
  3: { badge: "bg-pastel-orange text-pastel-orange-ink ring-2 ring-pastel-orange-ink/20", row: "bg-pastel-orange/40", podium: "bg-pastel-orange", label: "3rd place" },
};

function RankBadge({ rank, size = "md" }) {
  const medal = MEDAL[rank];
  const dim = size === "lg" ? "h-10 w-10 text-base" : "h-8 w-8 text-sm";
  if (!medal) return <span className="inline-flex h-8 w-8 items-center justify-center text-sm font-bold tabular-nums text-muted">#{rank}</span>;
  return (
    <span
      className={`relative inline-flex ${dim} items-center justify-center rounded-full font-bold tabular-nums shadow-soft transition-transform duration-200 hover:scale-110 motion-safe:animate-[celebrate-pop_0.5s_ease-out_both] ${medal.badge}`}
      title={medal.label}
    >
      {rank === 1 ? <StarIcon className="h-4 w-4" /> : rank}
      <span className="sr-only">{medal.label}</span>
    </span>
  );
}

function Podium({ rows }) {
  const top = rows.filter((r) => r.rank <= 3).slice(0, 3);
  if (top.length < 3) return null;
  const order = [top[1], top[0], top[2]]; // 2nd, 1st, 3rd
  return (
    <ol className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Top three students">
      {order.map((r, i) => (
        <li key={r.key} className={i === 0 ? "sm:mt-6" : i === 2 ? "sm:mt-10" : ""}>
          <div className={`flex flex-col items-center gap-2 rounded-3xl p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card ${MEDAL[r.rank]?.podium || "bg-bg"}`}>
            <RankBadge rank={r.rank} size="lg" />
            <Avatar name={r.name} size="lg" />
            <span className="max-w-full truncate text-sm font-bold text-text">{r.name}</span>
            <span className="text-2xl font-bold tracking-tight text-text">{fmtPct(r.pct)}</span>
            <span className="text-xs text-muted">
              {r.testsTotal ? `${r.testsDone}/${r.testsTotal} tests` : `${r.marks}/${r.maxMarks} marks`} · {fmtClock(r.timeSec)}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Skeleton() {
  return (
    <div className="rounded-3xl bg-surface p-5 shadow-soft sm:p-6" role="status" aria-label="Loading leaderboard">
      <div className="h-4 w-24 animate-pulse rounded-full bg-text/[0.08]" />
      <div className="mt-3 h-5 w-56 animate-pulse rounded-full bg-text/[0.08]" />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-3xl bg-text/[0.06]" />)}
      </div>
      <div className="mt-6 flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-11 animate-pulse rounded-2xl bg-text/[0.05]" />)}
      </div>
    </div>
  );
}

function ScoreCell({ row, perTest }) {
  return (
    <div className="min-w-[7rem]">
      <span className="font-semibold tabular-nums text-text">{fmtPct(row.pct)}</span>
      {perTest && <span className="ml-1.5 text-xs text-muted">{row.marks}/{row.maxMarks}</span>}
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-text/[0.08]">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.max(2, Math.min(100, row.pct))}%` }} />
      </div>
    </div>
  );
}

function StudentCell({ row }) {
  return (
    <span className="flex items-center gap-3">
      <Avatar name={row.name} size="sm" />
      <span className="min-w-0">
        <span className="block truncate font-semibold text-text">{row.name}</span>
        {row.batch && <span className="block truncate text-xs text-muted">{row.batch}</span>}
      </span>
    </span>
  );
}

function RowsTable({ rows, perTest }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">{perTest ? "Standings for this test" : "Overall series standings"}</caption>
        <thead>
          <tr className="eyebrow-muted">
            <th scope="col" className="w-16 pb-2 pr-2">Rank</th>
            <th scope="col" className="pb-2">Student</th>
            <th scope="col" className="pb-2">{perTest ? "Score" : "Overall score"}</th>
            {!perTest && <th scope="col" className="pb-2 text-right">Tests completed</th>}
            <th scope="col" className="pb-2 text-right">{perTest ? "Time taken" : "Total time"}</th>
            <th scope="col" className="pb-2 text-right">{perTest ? "Completed on" : "Last completed"}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-text/[0.06]">
          {rows.map((r) => (
            <tr key={r.key} className={`transition-colors hover:bg-primary/[0.04] ${MEDAL[r.rank]?.row || ""}`}>
              <td className="py-3 pl-1 pr-2"><RankBadge rank={r.rank} /></td>
              <td className="py-3 pr-3"><StudentCell row={r} /></td>
              <td className="py-3 pr-3"><ScoreCell row={r} perTest={perTest} /></td>
              {!perTest && <td className="py-3 text-right tabular-nums text-text">{r.testsDone}/{r.testsTotal} tests</td>}
              <td className="py-3 text-right tabular-nums text-muted">{fmtClock(r.timeSec)}</td>
              <td className="py-3 text-right tabular-nums text-muted">{fmtDate(r.date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowsCards({ rows, perTest }) {
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {rows.map((r) => (
        <li key={r.key} className={`rounded-2xl border border-text/[0.07] p-4 ${MEDAL[r.rank]?.row || "bg-bg"}`}>
          <div className="flex items-center gap-3">
            <RankBadge rank={r.rank} />
            <div className="min-w-0 flex-1"><StudentCell row={r} /></div>
            <span className="text-lg font-bold tabular-nums text-text">{fmtPct(r.pct)}</span>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-surface px-2 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{perTest ? "Marks" : "Tests"}</dt>
              <dd className="text-sm font-semibold text-text">{perTest ? `${r.marks}/${r.maxMarks}` : `${r.testsDone}/${r.testsTotal}`}</dd>
            </div>
            <div className="rounded-xl bg-surface px-2 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{perTest ? "Time" : "Total time"}</dt>
              <dd className="text-sm font-semibold text-text">{fmtClock(r.timeSec)}</dd>
            </div>
            <div className="rounded-xl bg-surface px-2 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{perTest ? "Completed" : "Last"}</dt>
              <dd className="text-sm font-semibold text-text">{fmtDate(r.date)}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

export default function SeriesLeaderboard({ series }) {
  // Remount per series so view, search and page never leak between series.
  return <LeaderboardView key={series.id} series={series} />;
}

function LeaderboardView({ series }) {
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0); // bumped by "Try again"
  const [view, setView] = useState("Overall");
  const [testId, setTestId] = useState("");
  const [sort, setSort] = useState("score");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    setLoading(true);
    const t = window.setTimeout(() => setLoading(false), 450);
    return () => window.clearTimeout(t);
  }, [attempt]);

  const data = useMemo(() => {
    void attempt;
    try {
      return { board: buildLeaderboard(series), error: null };
    } catch (err) {
      return { board: null, error: err };
    }
  }, [series, attempt]);

  if (loading) return <Skeleton />;
  if (data.error) {
    return (
      <EmptyState
        icon={AlertTriangleIcon}
        heading="Couldn't load the leaderboard"
        message="Something went wrong while ranking the attempts. Your data is safe."
        action={<Button fullWidth={false} className="px-6" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>}
      />
    );
  }
  const { board } = data;
  if (board.empty) {
    return (
      <EmptyState
        icon={ChartIcon}
        heading="Leaderboard is empty"
        message="No attempts yet — the leaderboard will populate once students start taking this test series."
      />
    );
  }

  const perTest = view === "Per test";
  const activeTest = board.tests.find((t) => t.id === testId) || board.tests[0];
  const allRows = perTest ? board.byTest[activeTest.id] || [] : board.overall;
  const shown = sortRows(searchRows(allRows, query), sort);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const slice = shown.slice(cur * PAGE, cur * PAGE + PAGE);

  return (
    <Panel
      eyebrow="Leaderboard"
      title={perTest ? activeTest.title : "Overall standings"}
      subtitle={perTest ? `${allRows.length} student${allRows.length === 1 ? "" : "s"} completed this test. Best attempt counts.` : OVERALL_METHOD}
      action={
        <SegmentedControl
          options={LB_VIEWS}
          value={view}
          onChange={(v) => { setView(v); setPage(0); setQuery(""); }}
        />
      }
    >
      <div key={`${view}:${activeTest.id}`} className="motion-safe:animate-[rise-in_0.35s_ease-out_both]">
        {perTest && (
          <label className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
            Test
            <Select
              aria-label="Choose a test"
              value={activeTest.id}
              onChange={(e) => { setTestId(e.target.value); setPage(0); }}
              className="max-w-[18rem] rounded-full border border-text/12 bg-surface py-2 pl-3 pr-8 text-sm font-medium text-text"
            >
              {board.tests.map((t, i) => <option key={t.id} value={t.id}>{`${i + 1}. ${t.title}`}</option>)}
            </Select>
            <span className="font-normal">{activeTest.sectionTitle} · {activeTest.maxMarks} marks</span>
          </label>
        )}

        {allRows.length === 0 ? (
          <EmptyState icon={ChartIcon} heading="Nobody has finished this test yet" message="No attempts yet — the leaderboard will populate once students start taking this test." className="shadow-none ring-1 ring-text/[0.06]" />
        ) : (
          <>
            <Podium rows={allRows} />
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <Input
                aria-label="Search students"
                placeholder="Search students"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(0); }}
                containerClassName="w-full sm:w-64"
                className="py-2.5"
              />
              <label className="flex items-center gap-2 text-xs font-semibold text-muted">
                Sort by
                <Select
                  aria-label="Sort leaderboard"
                  value={sort}
                  onChange={(e) => { setSort(e.target.value); setPage(0); }}
                  className="rounded-full border border-text/12 bg-surface py-2 pl-3 pr-8 text-sm font-medium text-text"
                >
                  {LB_SORTS.map((s) => <option key={s.key} value={s.key}>{perTest || s.key !== "time" ? s.label : "Total time"}</option>)}
                </Select>
              </label>
            </div>
            {shown.length === 0 ? (
              <EmptyState icon={ChartIcon} heading="No students match" message="Try a different name." className="shadow-none ring-1 ring-text/[0.06]" />
            ) : (
              <>
                <RowsTable rows={slice} perTest={perTest} />
                <RowsCards rows={slice} perTest={perTest} />
                <Pager page={cur} pages={pages} onPage={setPage} total={shown.length} label="students" />
              </>
            )}
            <p className="mt-4 text-xs text-muted">Only real student attempts are ranked. Your own “Preview as Student” runs are never counted.</p>
          </>
        )}
      </div>
    </Panel>
  );
}
