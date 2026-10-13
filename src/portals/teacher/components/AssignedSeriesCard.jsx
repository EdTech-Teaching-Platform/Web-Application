// Rich card for the "Assigned to me" page: admin brief (expandable), taxonomy,
// expected structure vs. what's built so far, deadline countdown, builder
// progress ring and the state-appropriate primary action.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import ProgressRing from "../../../components/ui/ProgressRing";
import { ChevronDownIcon, EyeIcon, LockIcon, ClockIcon } from "../../../components/ui/icons";
import { AdminAvatar, DeadlineChip, OriginTags, SeriesStatusBadge, isOverdue } from "./TestSeriesStatus";
import { formatDate, primaryAction, seriesPoints, seriesQuestionCount, seriesTestCount } from "../data/testSeriesData";
import { timeAgo } from "../data/testSeriesDeadlines";

function Pill({ children, tone = "primary" }) {
  const cls = tone === "lavender" ? "bg-pastel-lavender text-pastel-lavender-ink" : tone === "blue" ? "bg-pastel-blue text-pastel-blue-ink" : tone === "sage" ? "bg-pastel-sage text-pastel-sage-ink" : "bg-primary/[0.07] text-primary";
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

function Expect({ label, built, expected }) {
  const met = expected ? built >= expected : true;
  return (
    <div className="rounded-2xl bg-bg px-3 py-2.5 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-text">
        <span className={met ? "text-pastel-sage-ink" : ""}>{built}</span>
        {expected ? <span className="font-medium text-muted"> / {expected}</span> : null}
      </div>
    </div>
  );
}

export default function AssignedSeriesCard({ series, onRequestExtension, onWithdrawExtension, onDecline }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const a = series.assignment;
  const action = primaryAction(series);
  const exp = a.expected || {};
  const tax = a.taxonomy || {};
  const overdue = isOverdue(series);
  const declined = Boolean(series.declined);
  const ext = series.extensionRequest;
  const canAsk = !declined && ["assigned", "drafting", "ready"].includes(series.status);

  return (
    <article className={`motion-safe:animate-[rise-in_0.4s_ease-out_both] relative flex h-full flex-col overflow-hidden rounded-3xl bg-surface p-5 shadow-soft transition-all duration-200 hover:shadow-card sm:p-6 ${overdue ? "ring-2 ring-danger/30" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <OriginTags series={series} />
        <SeriesStatusBadge series={series} size="sm" />
      </div>

      <h3 className="mt-3 text-base font-bold leading-snug text-text sm:text-lg">{series.title}</h3>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-2 text-sm text-text">
          <AdminAvatar name={a.assignedBy.name} />
          <span>
            <span className="block text-sm font-semibold leading-tight">{a.assignedBy.name}</span>
            <span className="block text-[11px] text-muted">{a.assignedBy.role} · assigned {formatDate(a.assignedOn)}</span>
          </span>
        </span>
        <DeadlineChip series={series} className="ml-auto" />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {(tax.grades || []).map((g) => <Pill key={g}>{g}</Pill>)}
        {(tax.subjects || []).map((g) => <Pill key={g} tone="blue">{g}</Pill>)}
        {(tax.exams || []).map((g) => <Pill key={g} tone="lavender">{g}</Pill>)}
        {tax.difficulty && <Pill tone="sage">{tax.difficulty}</Pill>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Expect label="Sections" built={series.sections.length} expected={exp.sections} />
        <Expect label="Tests" built={seriesTestCount(series)} expected={exp.tests} />
        <Expect label="Questions" built={seriesQuestionCount(series)} expected={exp.questions} />
        <Expect label="Marks" built={seriesPoints(series)} expected={exp.marks} />
      </div>

      <div className="mt-4 rounded-2xl bg-bg">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-text">
          Admin brief and notes
          <ChevronDownIcon className={`h-4 w-4 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
        <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className="flex flex-col gap-3 px-4 pb-4 text-sm text-muted">
              <p className="whitespace-pre-line">{a.adminBrief}</p>
              {a.adminNotes && (
                <div className="rounded-xl bg-surface px-3.5 py-3 ring-1 ring-text/[0.06]">
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

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
        <ProgressRing value={series.builderProgress} size={56} stroke={6} label={`Builder progress ${series.builderProgress}%`} />
        <div className="min-w-0 text-xs text-muted">
          <div className="font-semibold text-text">Builder progress</div>
          <div>{series.lastSavedAt ? `Saved ${timeAgo(series.lastSavedAt)}` : "Not started"}</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!declined && (
            <Button fullWidth={false} className="px-5 py-2.5" onClick={() => navigate(action.to)}>
              {action.key === "view" && <EyeIcon className="h-4 w-4" />}
              {action.label}
            </Button>
          )}
        </div>
      </div>

      {canAsk && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-text/[0.06] pt-3 text-xs font-semibold">
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
      {declined && <p className="mt-3 rounded-2xl bg-bg px-4 py-2.5 text-xs text-muted">You declined this assignment: {series.declined.reason}</p>}
    </article>
  );
}
