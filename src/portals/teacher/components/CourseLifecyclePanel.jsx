import { useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import ListRow from "../../../components/ui/ListRow";
import CourseStatusBadge from "./CourseStatusBadge";
import { InfoIcon } from "../../../components/ui/icons";

const MAIN_STEPS = ["draft", "pending_review", "published"];

function StepNode({ statusKey, current, title }) {
  const idx = MAIN_STEPS.indexOf(current === "changes_requested" ? "pending_review" : current);
  const stepIdx = MAIN_STEPS.indexOf(statusKey);
  const state = stepIdx < idx ? "done" : stepIdx === idx ? "active" : "upcoming";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${
          state === "upcoming" ? "border border-text/20 text-muted" : "bg-primary text-white"
        }`}
      >
        {stepIdx + 1}
      </span>
      <span className={`whitespace-nowrap text-xs font-semibold ${state === "upcoming" ? "text-muted" : "text-text"}`}>
        {title}
      </span>
    </div>
  );
}

// CourseLifecyclePanel — the "Course Status" info panel the spec asks for:
// a small lifecycle diagram (Draft -> Pending Review -> Published, with
// Archived and Changes Requested drawn as offshoots) plus a preview of how
// the current status renders as a My Courses list row, so the same badge
// system can be checked outside the builder's own chrome. Opened from the
// CourseStatusBadge in each builder screen's header rather than living
// inline on every screen, per the spec's "somewhere accessible" wording.
export default function CourseLifecyclePanel({ course }) {
  const [open, setOpen] = useState(false);
  const status = course.status;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors duration-150 hover:text-primary"
      >
        <InfoIcon className="h-3.5 w-3.5" />
        Course status
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Course status" size="lg" footer={<Button variant="secondary" fullWidth={false} onClick={() => setOpen(false)}>Close</Button>}>
        <div className="flex flex-col gap-6">
          <div>
            <span className="mb-3 block text-xs font-semibold uppercase tracking-wide text-muted">Lifecycle</span>
            <div className="rounded-3xl bg-white p-5 shadow-soft">
              <div className="flex items-center">
                <StepNode statusKey="draft" current={status} title="Draft" />
                <span className="mx-2 mt-[-14px] h-px flex-1 bg-text/15" />
                <StepNode statusKey="pending_review" current={status} title="Pending Review" />
                <span className="mx-2 mt-[-14px] h-px flex-1 bg-text/15" />
                <StepNode statusKey="published" current={status} title="Published" />
              </div>

              <div className="mt-6 grid gap-3 border-t border-text/[0.07] pt-5 sm:grid-cols-2">
                <div className="flex items-start gap-2.5 rounded-xl bg-danger/[0.06] px-3.5 py-3">
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-danger" />
                  <p className="text-xs text-muted">
                    <span className="font-semibold text-danger">Changes Requested</span> — a branch off Pending Review.
                    Admin sends feedback, editing unlocks, and you resubmit from Draft-like state.
                  </p>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl bg-text/[0.05] px-3.5 py-3">
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-text/40" />
                  <p className="text-xs text-muted">
                    <span className="font-semibold text-muted">Archived</span> — a branch off Published. Read-only,
                    no longer visible to new students.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <span className="mb-3 block text-xs font-semibold uppercase tracking-wide text-muted">
              How this looks in My Courses
            </span>
            <div className="rounded-3xl bg-white p-2 shadow-soft">
              <ListRow
                leading={
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-rotation-1/40 to-rotation-2/30 text-xs font-bold text-muted">
                    {(course.title || "?").slice(0, 1)}
                  </span>
                }
                title={course.title || "Untitled course"}
                subtitle={`${course.category || "Uncategorized"} · Last edited just now`}
                trailing={<CourseStatusBadge status={status} />}
              />
            </div>
            <p className="mt-2 text-xs text-muted">A preview only — this row doesn't link to the real My Courses list.</p>
          </div>
        </div>
      </Modal>
    </>
  );
}
