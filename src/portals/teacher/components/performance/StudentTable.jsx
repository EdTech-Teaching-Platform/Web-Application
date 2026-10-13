import { useMemo, useState } from "react";
import Chip from "../../../../components/ui/Chip";
import Input from "../../../../components/ui/Input";
import Button from "../../../../components/ui/Button";
import Checkbox from "../../../../components/ui/Checkbox";
import StatusBadge from "../../../../components/ui/StatusBadge";
import EmptyState from "../../../../components/ui/EmptyState";
import { UsersIcon, MegaphoneIcon, ChevronRightIcon } from "../../../../components/ui/icons";
import { Panel, Avatar, Delta, MiniChip, Pager, fmtPct } from "./perfUi";

const PAGE = 10;
const STATUSES = ["All", "Completed", "In progress", "Not started", "Late"];
const STATUS_TONE = { Completed: "success", "In progress": "warning", "Not started": "neutral", Late: "danger" };
const STATUS_ORDER = { Late: 0, "In progress": 1, "Not started": 2, Completed: 3 };
const COLS = [
  { key: "name", label: "Student" },
  { key: "avg", label: "Avg score" },
  { key: "rank", label: "Rank" },
  { key: "status", label: "Status" },
];

function MiniBars({ pcts, tests }) {
  return (
    <span className="flex h-8 items-end gap-1" role="img" aria-label={`Scores by test: ${pcts.map((p, i) => `${tests[i]?.title || `T${i + 1}`} ${p === null ? "not taken" : `${p}%`}`).join(", ")}`}>
      {pcts.map((p, i) => (
        <span key={tests[i]?.id || i} title={`${tests[i]?.title || `T${i + 1}`}: ${p === null ? "not taken" : `${p}%`}`} className="flex h-full w-2 items-end rounded-full bg-primary/[0.06]">
          {p !== null && <span className={`w-full rounded-full ${p >= 40 ? "bg-primary/70" : "bg-chart-6"}`} style={{ height: `${Math.max(8, p)}%` }} />}
        </span>
      ))}
    </span>
  );
}

export default function StudentTable({ students, tests, onOpen, onAnnounce, rosterKeys }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [sort, setSort] = useState({ key: "rank", dir: 1 });
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState(() => new Set());

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const f = students.filter((s) => (status === "All" || s.status === status) && (!term || s.name.toLowerCase().includes(term)));
    const val = {
      name: (s) => s.name,
      avg: (s) => s.avgPct ?? -1,
      rank: (s) => s.rank ?? 9999,
      status: (s) => STATUS_ORDER[s.status],
    }[sort.key];
    return f.sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * sort.dir || a.name.localeCompare(b.name);
    });
  }, [students, q, status, sort]);

  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const slice = list.slice(cur * PAGE, cur * PAGE + PAGE);
  const allOnPage = slice.length > 0 && slice.every((s) => picked.has(s.key));
  const onRoster = [...picked].filter((k) => rosterKeys.has(k));

  function toggle(key) {
    setPicked((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }
  function togglePage() {
    setPicked((p) => { const n = new Set(p); slice.forEach((s) => (allOnPage ? n.delete(s.key) : n.add(s.key))); return n; });
  }
  function sortBy(key) {
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: key === "avg" ? -1 : 1 }));
    setPage(0);
  }

  return (
    <Panel eyebrow="Students" title="Student performance" subtitle="Click a student for the full breakdown. Tick rows to message several at once.">
      <div className="mb-4 flex flex-col gap-3">
        <Input aria-label="Search students" placeholder="Search students" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} containerClassName="w-full sm:w-64" className="py-2.5" />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {STATUSES.map((s) => (
            <Chip key={s} active={status === s} className="px-4 py-1.5 text-xs" onClick={() => { setStatus(s); setPage(0); }}>
              {s}{s !== "All" ? ` (${students.filter((x) => x.status === s).length})` : ` (${students.length})`}
            </Chip>
          ))}
        </div>
      </div>

      {picked.size > 0 && (
        <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary/[0.06] px-4 py-3">
          <p className="text-sm font-semibold text-text">
            {picked.size} selected
            <span className="ml-2 text-xs font-medium text-muted">{onRoster.length} on your course roster</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button fullWidth={false} className="px-4 py-2 text-xs" disabled={onRoster.length === 0} title={onRoster.length === 0 ? "None of the selected students are on a course roster yet" : undefined} onClick={() => onAnnounce([...picked], "Update on your test series")}>
              <MegaphoneIcon className="h-3.5 w-3.5" />
              Add to group announcement
            </Button>
            <Button variant="tertiary" fullWidth={false} className="px-4 py-2 text-xs" onClick={() => setPicked(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState icon={UsersIcon} heading="No students match" message="Change the status filter or search term." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="eyebrow-muted">
                <th scope="col" className="w-8 pb-2"><Checkbox label={<span className="sr-only">Select all students on this page</span>} checked={allOnPage} onChange={togglePage} /></th>
                {COLS.slice(0, 1).map((c) => <SortTh key={c.key} col={c} sort={sort} onSort={sortBy} />)}
                <th scope="col" className="pb-2">Per test</th>
                {COLS.slice(1, 3).map((c) => <SortTh key={c.key} col={c} sort={sort} onSort={sortBy} />)}
                <th scope="col" className="pb-2">Strong / weak topics</th>
                {COLS.slice(3).map((c) => <SortTh key={c.key} col={c} sort={sort} onSort={sortBy} />)}
                <th scope="col" className="pb-2"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-text/[0.06]">
              {slice.map((s) => (
                <tr key={s.key} className={`transition-colors hover:bg-primary/[0.03] ${picked.has(s.key) ? "bg-primary/[0.05]" : ""}`}>
                  <td className="py-3 pr-2"><Checkbox label={<span className="sr-only">{`Select ${s.name}`}</span>} checked={picked.has(s.key)} onChange={() => toggle(s.key)} /></td>
                  <td className="py-3 pr-3">
                    <button type="button" onClick={() => onOpen(s.key)} className="flex items-center gap-3 text-left">
                      <Avatar name={s.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-text">{s.name}</span>
                        <span className="block text-xs text-muted">{s.batch}{s.attemptCount ? ` · ${s.attemptCount} attempt${s.attemptCount === 1 ? "" : "s"}` : ""}</span>
                      </span>
                    </button>
                  </td>
                  <td className="py-3 pr-3"><MiniBars pcts={s.pcts} tests={tests} /></td>
                  <td className="py-3 pr-3 font-semibold tabular-nums text-text">{fmtPct(s.avgPct)}</td>
                  <td className="py-3 pr-3">
                    {s.rank ? <span className="inline-flex items-center gap-1.5 tabular-nums"><span className="font-semibold text-text">#{s.rank}</span><Delta value={s.rankMove} unit="rank" /></span> : <span className="text-muted">–</span>}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex max-w-[16rem] flex-wrap gap-1">
                      {s.strengths.map((t) => <MiniChip key={`s-${t}`} tone="bg-pastel-sage text-pastel-sage-ink" title="Strength">{t}</MiniChip>)}
                      {s.weak.map((t) => <MiniChip key={`w-${t}`} tone="bg-pastel-pink text-pastel-pink-ink" title="Needs work">{t}</MiniChip>)}
                      {!s.strengths.length && !s.weak.length && <span className="text-xs text-muted">Not enough data</span>}
                    </div>
                  </td>
                  <td className="py-3 pr-3"><StatusBadge status={STATUS_TONE[s.status]} size="sm" showIcon={false}>{s.status}</StatusBadge></td>
                  <td className="py-3 text-right">
                    <button type="button" onClick={() => onOpen(s.key)} aria-label={`Open ${s.name}'s detail`} className="rounded-full p-1.5 text-muted transition-colors hover:bg-primary/[0.07] hover:text-text"><ChevronRightIcon className="h-4 w-4" /></button>
                  </td>
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

function SortTh({ col, sort, onSort }) {
  const active = sort.key === col.key;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className="pb-2 pr-3">
      <button type="button" onClick={() => onSort(col.key)} className={`inline-flex items-center gap-1 uppercase tracking-[0.14em] ${active ? "text-primary" : ""}`}>
        {col.label}
        <span aria-hidden="true">{active ? (sort.dir === 1 ? "↑" : "↓") : ""}</span>
      </button>
    </th>
  );
}
