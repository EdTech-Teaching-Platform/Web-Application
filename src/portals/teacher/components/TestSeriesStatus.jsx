// Small shared pieces for the Part 6 Test Series UI: lifecycle badge +
// ProgressSteps stepper, origin/scope tags, deadline countdown chip and the
// "assigned by" avatar. Colors come from @theme tokens only.
import StatusBadge from "../../../components/ui/StatusBadge";
import ProgressSteps from "../../../components/ui/ProgressSteps";
import { ClockIcon, LockIcon, AlertTriangleIcon, CheckIcon, FlagIcon, EyeIcon } from "../../../components/ui/icons";
import { toneForKey, ICON_TONES } from "../../../components/ui/IconBadge";
import { TS_STATUS_META, TS_STAGES, TS_ORIGIN_LABEL, TS_SCOPE_LABEL, stageIndex, formatDate, initialsOf, isLive } from "../data/testSeriesData";
import { countdownLabel, daysUntil, deadlineTone, effectiveBuildDeadline } from "../data/testSeriesDeadlines";

const STATUS_ICON = { ready: EyeIcon, final: LockIcon, published: CheckIcon };

export function SeriesStatusBadge({ series, size = "md" }) {
  const meta = TS_STATUS_META[series.status] || TS_STATUS_META.drafting;
  const declined = series.declined;
  return (
    <StatusBadge status={meta.tone} size={size} icon={STATUS_ICON[series.status]} showIcon={Boolean(STATUS_ICON[series.status])}>
      {declined ? "Declined" : series.status === "published" ? "Published · live" : meta.label}
    </StatusBadge>
  );
}

// Assigned -> Build -> Review -> Publish -> Final publish. Own series start at "Created".
export function LifecycleStepper({ series }) {
  const idx = stageIndex(series.status);
  if (idx < 0) {
    return (
      <p className="rounded-2xl bg-bg px-4 py-3 text-sm text-muted">
        {series.declined ? `Declined on ${formatDate(series.declined.at.slice(0, 10))}: ${series.declined.reason}` : "This series is archived and no longer visible to students."}
      </p>
    );
  }
  const steps = series.origin === "own" ? ["Created", ...TS_STAGES.slice(1)] : TS_STAGES;
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[30rem]">
        <ProgressSteps steps={steps} currentIndex={idx} />
      </div>
    </div>
  );
}

export function OriginTags({ series, className = "" }) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {series.origin === "assigned" ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2.5 py-0.5 text-[11px] font-bold text-pastel-orange-ink">
          <FlagIcon className="h-3 w-3" />
          {TS_ORIGIN_LABEL.assigned}
        </span>
      ) : (
        <span className="rounded-full bg-primary/[0.07] px-2.5 py-0.5 text-[11px] font-semibold text-primary">{TS_ORIGIN_LABEL.own}</span>
      )}
      <span className="rounded-full bg-pastel-lavender px-2.5 py-0.5 text-[11px] font-semibold text-pastel-lavender-ink">{TS_SCOPE_LABEL[series.scope]}</span>
    </div>
  );
}

const CHIP_TONES = {
  sage: "bg-pastel-sage text-pastel-sage-ink",
  gold: "bg-secondary/20 text-pastel-orange-ink",
  danger: "bg-danger/15 text-danger",
  none: "bg-text/[0.06] text-muted",
  done: "bg-text/[0.06] text-muted",
};

// Deadline countdown chip: sage > 7 days, gold 3-7, red < 3 or overdue.
export function DeadlineChip({ series, className = "" }) {
  const date = effectiveBuildDeadline(series);
  if (!date) return null;
  if (isLive(series) || series.status === "archived") {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${CHIP_TONES.done} ${className}`}>
        <CheckIcon className="h-3 w-3" />
        Build deadline {formatDate(date)}
      </span>
    );
  }
  const days = daysUntil(date);
  const tone = deadlineTone(days);
  const Icon = days !== null && days < 0 ? AlertTriangleIcon : ClockIcon;
  return (
    <span title={`Build deadline ${formatDate(date)}`} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${CHIP_TONES[tone]} ${className}`}>
      <Icon className="h-3 w-3" />
      {countdownLabel(days)}
      <span className="font-medium opacity-80">· {formatDate(date)}</span>
    </span>
  );
}

export function AdminAvatar({ name, size = "h-8 w-8", className = "" }) {
  return (
    <span aria-hidden="true" className={`inline-flex ${size} shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${ICON_TONES[toneForKey(name)]} ${className}`}>
      {initialsOf(name.replace(/^Dr\.?\s+/i, ""))}
    </span>
  );
}

// Red banner for an assigned series whose build deadline has passed.
export function isOverdue(series) {
  if (series.origin !== "assigned" || series.declined) return false;
  if (!["assigned", "drafting", "ready"].includes(series.status)) return false;
  const d = daysUntil(effectiveBuildDeadline(series));
  return d !== null && d < 0;
}
export function OverdueBanner({ series, onRequest }) {
  if (!isOverdue(series)) return null;
  const days = Math.abs(daysUntil(effectiveBuildDeadline(series)));
  const pending = series.extensionRequest?.status === "pending";
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-3xl bg-danger/10 px-5 py-4 text-danger ring-1 ring-danger/20 sm:flex-row sm:items-center">
      <AlertTriangleIcon className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">This assigned series is {days} day{days === 1 ? "" : "s"} overdue.</p>
        <p className="text-xs opacity-90">
          The admin asked for it by {formatDate(effectiveBuildDeadline(series))}.{" "}
          {pending ? `Your extension request to ${formatDate(series.extensionRequest.newDate)} is pending.` : "Finish it now or ask for more time."}
        </p>
      </div>
      {!pending && onRequest && (
        <button type="button" onClick={onRequest} className="shrink-0 rounded-full border border-danger/40 bg-surface px-4 py-2 text-xs font-bold text-danger transition-colors hover:bg-danger/5">
          Request extension
        </button>
      )}
    </div>
  );
}
