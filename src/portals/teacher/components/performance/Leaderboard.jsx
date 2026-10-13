import { useMemo, useState } from "react";
import Select from "../../../../components/ui/Select";
import Input from "../../../../components/ui/Input";
import EmptyState from "../../../../components/ui/EmptyState";
import { StarIcon, ChartIcon } from "../../../../components/ui/icons";
import { Panel, Avatar, Delta, MiniChip, CHIP_TONES, Pager, fmtPct, fmtClock } from "./perfUi";

const PAGE = 8;
const SORTS = {
  Rank: (a, b) => a.rank - b.rank,
  Score: (a, b) => b.avgPct - a.avgPct,
  Percentile: (a, b) => b.percentile - a.percentile,
  Accuracy: (a, b) => (b.accuracy || 0) - (a.accuracy || 0),
  "Time (fastest)": (a, b) => a.timeSec - b.timeSec,
  Attempts: (a, b) => b.attemptCount - a.attemptCount,
};
const PODIUM = [
  { rank: 2, tone: "bg-pastel-blue", label: "2nd", offset: "sm:mt-6" },
  { rank: 1, tone: "bg-secondary/15 ring-2 ring-secondary", label: "1st", offset: "" },
  { rank: 3, tone: "bg-pastel-orange", label: "3rd", offset: "sm:mt-10" },
];

function Podium({ students, onOpen }) {
  const top = students.slice(0, 3);
  if (top.length < 3) return null;
  return (
    <ol className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Top three students">
      {PODIUM.map((p) => {
        const s = top[p.rank - 1];
        return (
          <li key={p.rank} className={p.offset}>
            <button type="button" onClick={() => onOpen(s.key)} className={`flex w-full flex-col items-center gap-2 rounded-3xl p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card ${p.tone}`}>
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text">
                {p.rank === 1 && <StarIcon className="h-3.5 w-3.5 text-secondary" />}
                {p.label}
              </span>
              <Avatar name={s.name} size="lg" />
              <span className="max-w-full truncate text-sm font-bold text-text">{s.name}</span>
              <span className="text-2xl font-bold tracking-tight text-text">{fmtPct(s.avgPct)}</span>
              <span className="text-xs text-muted">{s.percentile}th percentile · {fmtPct(s.accuracy)} accuracy</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export default function Leaderboard({ students, onOpen }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("Rank");
  const [page, setPage] = useState(0);
  const ranked = useMemo(() => students.filter((s) => s.avgPct !== null).sort(SORTS.Rank), [students]);
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return ranked.filter((s) => !term || s.name.toLowerCase().includes(term)).sort(SORTS[sort]);
  }, [ranked, q, sort]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const slice = list.slice(cur * PAGE, cur * PAGE + PAGE);

  return (
    <Panel eyebrow="Leaderboard" title="Top performers" subtitle="Ranked by average score across the tests in view. Ties share a rank.">
      <Podium students={ranked} onOpen={onOpen} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input aria-label="Search leaderboard" placeholder="Search students" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} containerClassName="w-full sm:w-64" className="py-2.5" />
        <label className="flex items-center gap-2 text-xs font-semibold text-muted">
          Sort by
          <Select className="rounded-full border border-text/12 bg-surface py-2 pl-3 pr-8 text-sm font-medium text-text" value={sort} onChange={(e) => { setSort(e.target.value); setPage(0); }} aria-label="Sort leaderboard">
            {Object.keys(SORTS).map((k) => <option key={k}>{k}</option>)}
          </Select>
        </label>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={ChartIcon} heading="No students match" message="Try a different name." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="eyebrow-muted">
                <th scope="col" className="w-14 pb-2 pr-2">Rank</th>
                <th scope="col" className="pb-2">Student</th>
                <th scope="col" className="pb-2 text-right">Score</th>
                <th scope="col" className="pb-2 text-right">Percentile</th>
                <th scope="col" className="pb-2 text-right">Accuracy</th>
                <th scope="col" className="pb-2 text-right">Avg time</th>
                <th scope="col" className="pb-2 text-right">Attempts</th>
                <th scope="col" className="pb-2 pl-3 text-right">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-text/[0.06]">
              {slice.map((s) => (
                <tr key={s.key} className="transition-colors hover:bg-primary/[0.03]">
                  <td className="py-3 pr-2 font-bold tabular-nums text-text">#{s.rank}</td>
                  <td className="py-3">
                    <button type="button" onClick={() => onOpen(s.key)} className="flex items-center gap-3 text-left" aria-label={`Open ${s.name}'s performance detail`}>
                      <Avatar name={s.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-text">{s.name}</span>
                        {s.badges.length > 0 && (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {s.badges.map((b) => <MiniChip key={b} tone={CHIP_TONES[b]}>{b}</MiniChip>)}
                          </span>
                        )}
                      </span>
                    </button>
                  </td>
                  <td className="py-3 text-right font-semibold tabular-nums text-text">{fmtPct(s.avgPct)}</td>
                  <td className="py-3 text-right tabular-nums text-text">{s.percentile}</td>
                  <td className="py-3 text-right tabular-nums text-text">{fmtPct(s.accuracy)}</td>
                  <td className="py-3 text-right tabular-nums text-muted">{fmtClock(s.timeSec)}</td>
                  <td className="py-3 text-right tabular-nums text-muted">{s.attemptCount}</td>
                  <td className="py-3 pl-3 text-right"><Delta value={s.delta} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={cur} pages={pages} onPage={setPage} total={list.length} label="students" />
    </Panel>
  );
}
