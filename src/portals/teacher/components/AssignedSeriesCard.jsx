// Rich card for the "Assigned to me" page: admin brief (expandable), taxonomy,
// expected structure vs. what's built so far, deadline countdown, builder
// progress ring and the state-appropriate primary action.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import ProgressRing from "../../../components/ui/ProgressRing";
import { ChevronDownIcon, LockIcon, ClockIcon, FlagIcon } from "../../../components/ui/icons";
import { DeadlineChip, SeriesStatusBadge, isOverdue } from "./TestSeriesStatus";
import { formatDate, seriesPoints, seriesQuestionCount, seriesTestCount } from "../data/testSeriesData";
import { timeAgo } from "../data/testSeriesDeadlines";

function Pill({ children, tone = "primary" }) {
  const cls = tone === "lavender" ? "bg-pastel-lavender text-pastel-lavender-ink" : tone === "blue" ? "bg-pastel-blue text-pastel-blue-ink" : tone === "sage" ? "bg-pastel-sage text-pastel-sage-ink" : "bg-primary/[0.08] text-primary";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

// One metric tile: built so far vs what the admin asked for, with a thin progress bar.
function Stat({ label, built, expected }) {
  const pct = expected ? Math.min(100, Math.round((built / expected) * 100)) : null;
  const met = expected ? built >= expected : false;
  return (
    <div className="rounded-2xl bg-[#f5f6f8] px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-xl font-bold leading-none ${met ? "text-pastel-sage-ink" : "text-text"}`}>{built}</span>
        {expected ? <span className="text-xs font-medium text-muted">/ {expected}</span> : null}
      </div>
      {pct !== null && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-text/[0.08]">
          <div className={`h-full rounded-full ${met ? "bg-pastel-sage-ink" : "bg-primary"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default function AssignedSeriesCard({ series, onRequestExtension, onWithdrawExtension, onDecline }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const a = series.assignment;
  const exp = a.expected || {};
  const tax = a.taxonomy || {};
  const overdue = isOverdue(series);
  const declined = Boolean(series.declined);
  const ext = series.extensionRequest;
  const canAsk = !declined && ["assigned", "drafting", "ready"].includes(series.status);

  return (
    <article className={`relative flex h-full flex-col overflow-hidden rounded-3xl bg-white p-6 shadow-[0_10px_30px_-18px_rgba(15,17,21,0.25)] ring-1 transition-shadow duration-200 hover:shadow-[0_16px_36px_-18px_rgba(15,17,21,0.32)] motion-safe:animate-[rise-in_0.4s_ease-out_both] ${overdue ? "ring-2 ring-danger/40" : "ring-text/[0.07]"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/20 px-3 py-1 text-[11px] font-bold text-pastel-orange-ink">
          <FlagIcon className="h-3 w-3" />
          Assigned by admin
        </span>
        <SeriesStatusBadge series={series} size="sm" />
      </div>

      <h3 className="mt-4 text-lg font-bold leading-snug text-text">{series.title}</h3>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <DeadlineChip series={series} />
        <span className="text-xs text-muted">Assigned {formatDate(a.assignedOn)}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {(tax.grades || []).map((g) => <Pill key={g}>{g}</Pill>)}
        {(tax.subjects || []).map((g) => <Pill key={g} tone="blue">{g}</Pill>)}
        {(tax.exams || []).map((g) => <Pill key={g} tone="lavender">{g}</Pill>)}
        {tax.difficulty && <Pill tone="sage">{tax.difficulty}</Pill>}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Tests" built={seriesTestCount(series)} expected={exp.tests} />
        <Stat label="Questions" built={seriesQuestionCount(series)} expected={exp.questions} />
        <Stat label="Marks" built={seriesPoints(series)} expected={exp.marks} />
      </div>

      <div className="mt-4">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 rounded-2xl border border-text/10 px-4 py-2.5 text-left text-sm font-semibold text-text transition-colors hover:border-primary/40">
          Admin brief and notes
          <ChevronDownIcon className={`h-4 w-4 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
        <div className={`grid transition-all duration-300 ease-out ${open ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className="flex flex-col gap-3 px-1 text-sm text-muted">
              <p className="whitespace-pre-line">{a.adminBrief}</p>
              {a.adminNotes && (
                <div className="rounded-xl bg-[#f5f6f8] px-3.5 py-3">
                  <div className="eyebrow mb-1 inline-flex items-center gap-1"><LockIcon className="h-3 w-3" />Admin notes (read-only)</div>
                  <p>{a.adminNotes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {ext && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-pastel-orange px-4 py-2.5 text-xs text-pastel-orange-ink">
          <ClockIcon className="h-3.5 w-3.5" />
          <span className="min-w-0 flex-1 font-semibold">
            Extension {ext.status === "pending" ? "pending" : ext.status}: new deadline {formatDate(ext.newDate)}
          </span>
          {ext.status === "pending" && (
            <button type="button" onClick={onWithdrawExtension} className="font-bold underline">
              Withdraw
            </button>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-text/[0.07] pt-5">
        <ProgressRing value={series.builderProgress} size={56} stroke={6} label={`Builder progress ${series.builderProgress}%`} />
        <div className="min-w-0 text-xs text-muted">
          <div className="font-semibold text-text">Builder progress</div>
          <div>{series.lastSavedAt ? `Saved ${timeAgo(series.lastSavedAt)}` : "Not started"}</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!declined && (
            <Button fullWidth={false} className="px-6 py-2.5" onClick={() => navigate(`/teacher/testseries/${series.id}`)}>
              Start building
            </Button>
          )}
        </div>
      </div>

      {canAsk && (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
          {(!ext || ext.status !== "pending") && (
            <button type="button" onClick={onRequestExtension} className="text-primary hover:underline">
              Request deadline extension
            </button>
          )}
          <button type="button" onClick={onDecline} className="text-muted hover:text-danger hover:underline">
            Decline with reason
          </button>
        </div>
      )}
      {declined && <p className="mt-3 rounded-2xl bg-[#f5f6f8] px-4 py-2.5 text-xs text-muted">You declined this assignment: {series.declined.reason}</p>}
    </article>
  );
}
