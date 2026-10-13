import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import { ArrowLeftIcon, EyeIcon } from "../../../components/ui/icons";

// TestSeriesPreviewBanner — the persistent "Preview Mode" strip shown on the
// selection screen, during test-taking AND on results (mirrors the
// "Previewing as a Student" header treatment in CoursePreview.jsx). Always
// carries an Exit Preview button; the host decides what Exit does.
export default function TestSeriesPreviewBanner({ paid = false, onExit, statusNote = "" }) {
  return (
    <div role="region" aria-label="Preview mode" className="flex flex-col gap-3 rounded-3xl bg-pastel-orange px-5 py-4 text-pastel-orange-ink ring-1 ring-pastel-orange-ink/10 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70">
          <EyeIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <StatusBadge status="warning" showIcon={false} size="sm" className="mb-1">
            Preview Mode
          </StatusBadge>
          <p className="text-sm font-semibold leading-snug">You're previewing this test series as a student would see it — payment is skipped in preview mode.</p>
          {statusNote && <p className="mt-0.5 text-xs font-semibold">{statusNote}</p>}
          <p className="mt-0.5 text-xs opacity-80">This attempt won't be recorded.{paid ? " This is a paid series: no checkout is shown, as for an already-enrolled student." : ""}</p>
        </div>
      </div>
      <Button variant="secondary" fullWidth={false} className="min-h-11 shrink-0 px-5" onClick={onExit}>
        <ArrowLeftIcon className="h-4 w-4" />
        Exit Preview
      </Button>
    </div>
  );
}
