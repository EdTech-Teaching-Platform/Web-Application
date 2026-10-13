import { useEffect, useMemo, useState } from "react";
import Chip from "../../../../components/ui/Chip";
import Select from "../../../../components/ui/Select";
import Modal from "../../../../components/ui/Modal";
import EmptyState from "../../../../components/ui/EmptyState";
import { AlertTriangleIcon, CheckIcon, QuizIcon } from "../../../../components/ui/icons";
import { Panel, MiniChip, Pager, fmtClock } from "./perfUi";

const PAGE = 8;
const AUTO_TONE = { "Too easy": "bg-pastel-blue text-pastel-blue-ink", Balanced: "bg-pastel-sage text-pastel-sage-ink", "Too hard": "bg-pastel-pink text-pastel-pink-ink", "No data": "bg-primary/[0.07] text-muted" };
const SORTS = {
  "Test order": () => 0,
  "Lowest correct %": (a, b) => (a.correctPct ?? 101) - (b.correctPct ?? 101),
  "Highest correct %": (a, b) => (b.correctPct ?? -1) - (a.correctPct ?? -1),
  "Slowest": (a, b) => (b.avgTimeSec ?? 0) - (a.avgTimeSec ?? 0),
  "Best discrimination": (a, b) => (b.disc ?? -2) - (a.disc ?? -2),
};

function QuestionModal({ q, onClose }) {
  const total = q ? Math.max(1, q.responses) : 1;
  return (
    <Modal open={Boolean(q)} onClose={onClose} title={q ? q.label : ""} size="xl" mobileFullScreen footer={<button type="button" onClick={onClose} className="rounded-full border border-primary/25 bg-surface px-6 py-2.5 text-sm font-semibold text-text hover:border-primary/60">Close</button>}>
      {q && (
        <div className="flex flex-col gap-5 pb-4">
          <p className="text-sm text-text">{q.text}</p>
          <div className="flex flex-wrap gap-2">
            <MiniChip>{q.topic}</MiniChip><MiniChip>{q.difficulty}</MiniChip><MiniChip>{q.points} marks</MiniChip>
            <MiniChip tone={AUTO_TONE[q.auto]}>{q.auto}</MiniChip>
            {q.flags.map((f) => <MiniChip key={f} tone="bg-pastel-pink text-pastel-pink-ink">{f}</MiniChip>)}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
            {[["Correct", q.correctPct === null ? "–" : `${q.correctPct}%`], ["Avg time", fmtClock(q.avgTimeSec)], ["Discrimination", q.disc ?? "–"], ["Responses", q.responses]].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-bg p-3"><div className="text-lg font-bold text-text">{v}</div><div className="text-[11px] text-muted">{k}</div></div>
            ))}
          </div>
          {q.dist.length === 0 ? <p className="text-sm text-muted">This is a written-answer question, so it has no option distribution. Open the student detail to see rubric scores.</p> : (
            <div>
              <h3 className="eyebrow mb-3">Option-wise distribution</h3>
              <ul className="flex flex-col gap-3">
                {q.dist.map((d) => {
                  const pct = Math.round((d.count / total) * 1000) / 10;
                  return (
                    <li key={d.key} className="text-xs">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-1.5 font-medium text-text">
                          {d.correct && <CheckIcon className="h-3.5 w-3.5 shrink-0 text-success" aria-label="Keyed correct answer" />}
                          <span className="truncate">{d.label}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-muted">{d.count} ({pct}%) · {d.top} top scorers</span>
                      </div>
                      <div className="h-3 rounded-full bg-primary/[0.08]" role="img" aria-label={`${d.label}: ${pct}% of responses`}>
                        <div className={`h-full rounded-full ${d.correct ? "bg-chart-3" : "bg-chart-6"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
                <li className="text-xs text-muted">Skipped: {q.skipped} ({q.skipPct}%)</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function QuestionAnalytics({ questions, openId, onOpenId }) {
  const [flagged, setFlagged] = useState(false);
  const [sort, setSort] = useState("Test order");
  const [page, setPage] = useState(0);
  const list = useMemo(() => questions.filter((q) => !flagged || q.flags.length).slice().sort(SORTS[sort]), [questions, flagged, sort]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const open = questions.find((q) => q.id === openId) || null;
  useEffect(() => { if (openId) { const i = list.findIndex((q) => q.id === openId); if (i >= 0) setPage(Math.floor(i / PAGE)); } }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps
  const nFlag = questions.filter((q) => q.flags.length).length;

  return (
    <Panel
      id="perf-questions" eyebrow="Questions" title="Question analytics" subtitle="Click a question to see how students answered each option."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={flagged} className="px-4 py-1.5 text-xs" onClick={() => { setFlagged((f) => !f); setPage(0); }}>Flagged only ({nFlag})</Chip>
          <Select className="rounded-full border border-text/12 bg-surface py-2 pl-3 pr-8 text-sm font-medium text-text" value={sort} onChange={(e) => { setSort(e.target.value); setPage(0); }} aria-label="Sort questions">
            {Object.keys(SORTS).map((k) => <option key={k}>{k}</option>)}
          </Select>
        </div>
      }
    >
      {list.length === 0 ? <EmptyState icon={QuizIcon} heading="No questions to show" message={flagged ? "Nothing is flagged in this view." : "No question responses in this view."} /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead><tr className="eyebrow-muted"><th scope="col" className="pb-2">Question</th><th scope="col" className="pb-2 text-right">Correct</th><th scope="col" className="pb-2 text-right">Avg time</th><th scope="col" className="pb-2 pl-4">Most-chosen wrong</th><th scope="col" className="pb-2 text-right" title="Top 27% correct rate minus bottom 27%">Discrim.</th><th scope="col" className="pb-2 pl-4">Difficulty</th><th scope="col" className="pb-2">Flags</th></tr></thead>
            <tbody className="divide-y divide-text/[0.06]">
              {list.slice(cur * PAGE, cur * PAGE + PAGE).map((q) => (
                <tr key={q.id} onClick={() => onOpenId(q.id)} className="cursor-pointer transition-colors hover:bg-primary/[0.03]">
                  <td className="max-w-[18rem] py-3 pr-3">
                    <button type="button" onClick={(e) => { e.stopPropagation(); onOpenId(q.id); }} className="block w-full text-left" aria-label={`Open option distribution for ${q.label}`}>
                      <span className="block truncate font-semibold text-text">{q.label}</span>
                      <span className="block truncate text-xs text-muted">{q.text}</span>
                    </button>
                  </td>
                  <td className="py-3 text-right font-semibold tabular-nums text-text">{q.correctPct === null ? "–" : `${q.correctPct}%`}</td>
                  <td className="py-3 text-right tabular-nums text-muted">{fmtClock(q.avgTimeSec)}</td>
                  <td className="max-w-[12rem] truncate py-3 pl-4 text-xs text-muted" title={q.topWrong ? q.topWrong.label : ""}>{q.topWrong ? `${q.topWrong.label} (${q.topWrong.pct}%)` : q.subjective ? "Written answer" : "–"}</td>
                  <td className={`py-3 text-right font-semibold tabular-nums ${q.disc !== null && q.disc < 0 ? "text-danger" : "text-text"}`}>{q.disc ?? "–"}</td>
                  <td className="py-3 pl-4"><MiniChip tone={AUTO_TONE[q.auto]}>{q.auto}</MiniChip></td>
                  <td className="py-3">
                    <span className="flex flex-wrap gap-1">{q.flags.map((f) => <MiniChip key={f} tone="bg-pastel-pink text-pastel-pink-ink"><AlertTriangleIcon className="mr-1 h-3 w-3" />{f}</MiniChip>)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={cur} pages={pages} onPage={setPage} total={list.length} label="questions" />
      <QuestionModal q={open} onClose={() => onOpenId(null)} />
    </Panel>
  );
}
