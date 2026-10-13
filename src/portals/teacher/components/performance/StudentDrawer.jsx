import { useEffect, useMemo, useRef, useState } from "react";
import Button from "../../../../components/ui/Button";
import StatusBadge from "../../../../components/ui/StatusBadge";
import { XIcon, MegaphoneIcon } from "../../../../components/ui/icons";
import { computeStudentDetail } from "../../data/testSeriesPerformanceDetail";
import { Avatar, MiniChip, CHIP_TONES, fmtPct } from "./perfUi";
import { ScoreHistory, SectionBlock, TopicBlock, DifficultyBlock, TimeBlock } from "./DrawerCharts";
import { AttemptHistory, NegativeBlock, GuessSkipBlock, SubjectiveBlock } from "./DrawerDetails";

const STATUS_TONE = { Completed: "success", "In progress": "warning", "Not started": "neutral", Late: "danger" };

// Right-edge slide-over (same shell pattern as StudentProgressDrawer) with the
// full per-student breakdown.
export default function StudentDrawer({ studentKey, report, onClose, onAnnounce, onRoster }) {
  const [entered, setEntered] = useState(false);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const open = Boolean(studentKey);
  const detail = useMemo(() => (open ? computeStudentDetail(report, studentKey) : null), [open, report, studentKey]);

  useEffect(() => {
    if (!open) { setEntered(false); return undefined; }
    const raf = requestAnimationFrame(() => { setEntered(true); closeRef.current?.focus(); });
    const onKey = (e) => e.key === "Escape" && onCloseRef.current?.();
    document.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!open || !detail) return null;
  const s = detail.student;
  const reachable = onRoster(s.key);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className={`absolute inset-0 bg-text/50 transition-opacity duration-200 ease-out ${entered ? "opacity-100" : "opacity-0"}`} />
      <div role="dialog" aria-modal="true" aria-label={`${s.name} performance detail`} className={`relative flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-l-3xl bg-bg shadow-elevated transition-all duration-200 ease-out ${entered ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"}`}>
        <div className="flex items-start gap-4 border-b border-text/[0.07] bg-surface px-5 py-4">
          <Avatar name={s.name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold text-text">{s.name}</p>
            <p className="text-xs text-muted">{s.batch}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={STATUS_TONE[s.status]} size="sm" showIcon={false}>{s.status}</StatusBadge>
              {s.rank && <MiniChip>Rank #{s.rank}</MiniChip>}
              {s.percentile !== null && <MiniChip>{s.percentile}th percentile</MiniChip>}
              {s.badges.map((b) => <MiniChip key={b} tone={CHIP_TONES[b]}>{b}</MiniChip>)}
            </div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-bg hover:text-text"><XIcon className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-4 grid grid-cols-3 gap-3 text-center">
            {[["Average score", fmtPct(s.avgPct)], ["Accuracy", fmtPct(s.accuracy)], ["Attempts", s.attemptCount]].map(([k, v]) => (
              <div key={k} className="rounded-3xl bg-surface p-3 shadow-soft"><div className="text-xl font-bold text-text">{v}</div><div className="text-[11px] text-muted">{k}</div></div>
            ))}
          </div>
          <div className="flex flex-col gap-4">
            <ScoreHistory history={detail.history} />
            <SectionBlock sections={detail.sections} />
            <TopicBlock topics={detail.topics} />
            <DifficultyBlock difficulty={detail.difficulty} />
            <TimeBlock timing={detail.timing} />
            <AttemptHistory attempts={detail.attempts} />
            <NegativeBlock negative={detail.negative} />
            <GuessSkipBlock student={s} cohortGuess={detail.cohortGuess} cohortSkip={detail.cohortSkip} />
            <SubjectiveBlock items={detail.subjective} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-text/[0.07] bg-surface px-5 py-3">
          <p className="text-xs text-muted">{reachable ? "Opens Announcements with this student pre-filled." : "This learner isn't on a course roster yet, so they can't be added to an announcement."}</p>
          <Button fullWidth={false} className="px-5 py-2.5 text-xs" disabled={!reachable} onClick={() => onAnnounce([s.key], `Feedback on your test series, ${s.name.split(" ")[0]}`)}>
            <MegaphoneIcon className="h-3.5 w-3.5" />
            Add to group announcement
          </Button>
        </div>
      </div>
    </div>
  );
}
