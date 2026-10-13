import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import CourseStatusBadge from "./CourseStatusBadge";
import StatusBadge from "../../../components/ui/StatusBadge";
import { formatMoney } from "../../../utils/formatMoney";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import { validateBundle, bundleWarnings, countdownInfo } from "../data/bundleData";
import { computeReadinessChecklist, builderPath } from "./contentData";
import {
  CheckIcon,
  XIcon,
  ClockIcon,
  ArrowRightIcon,
  SendIcon,
  FlagIcon,
  SparkleIcon,
  PencilIcon,
} from "../../../components/ui/icons";

function ChecklistItem({ item, courseId }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(builderPath(item.to, courseId))}
      className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors duration-150 hover:bg-bg"
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          item.complete ? "bg-success/15 text-success" : item.blocking ? "bg-danger/12 text-danger" : "bg-warning/12 text-warning"
        }`}
      >
        {item.complete ? <CheckIcon className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-text">{item.label}</span>
        {!item.complete && (
          <span className={`block text-xs ${item.blocking ? "text-danger/80" : "text-warning/80"}`}>
            {item.blocking ? "Required before you can submit" : "Recommended, not required"}
            {item.detail ? ` · ${item.detail}` : ""}
          </span>
        )}
      </span>
      <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 text-text/25" />
    </button>
  );
}

function SubmitModal({ open, onClose, onConfirm }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Submit for review?"
      footer={
        <>
          <Button variant="primary" fullWidth={false} className="flex items-center gap-2 px-6" onClick={onConfirm}>
            <SendIcon className="h-4 w-4" />
            Confirm & Submit
          </Button>
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={onClose}>
            Go back
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        Your course will be frozen and sent to our team for review. You'll be notified once it's approved or if
        changes are needed — you won't be able to edit it in the meantime.
      </p>
    </Modal>
  );
}

// PublishReadiness — Course Builder Part 4, the Review step. Renders one of
// four faces depending on the shared course.status: the checklist + submit
// action (draft / changes_requested), the frozen "submitted" card (pending
// review), or the celebratory published card. The pending-review card also
// exposes the two admin-decision outcomes as demo buttons, since there's no
// real Admin portal wired up yet for this prototype to react to.
export default function PublishReadiness({ course, modules, setStatus, courseId }) {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const { courses, bundles } = useTeacherCourses();
  const bundle = bundles.find((b) => b.courseIds[0] === course.id && b.enabled);
  const bundleCheck = bundle ? validateBundle(bundle, courses) : null;
  const bundleWarn = bundle ? bundleWarnings(bundle, Object.fromEntries(courses.map((c) => [c.id, c]))) : [];
  const bundleItem = bundle
    ? {
        id: "bundle",
        label: "Bundle is valid",
        complete: bundleCheck.valid && bundleWarn.length === 0,
        blocking: true,
        to: "/teacher/publishflow",
        detail: Object.values(bundleCheck.errors)[0] || (bundleWarn[0] ? `${bundleWarn[0].title} is archived` : null),
      }
    : null;
  const checklist = [...computeReadinessChecklist(course, modules), ...(bundleItem ? [bundleItem] : [])];
  const blocking = checklist.filter((i) => !i.complete && i.blocking);
  const warnings = checklist.filter((i) => !i.complete && !i.blocking);
  const canSubmit = blocking.length === 0;

  function confirmSubmit() {
    setModalOpen(false);
    setStatus("pending_review", { submittedAt: new Date().toISOString(), adminFeedback: "" });
    setJustSubmitted(true);
    setTimeout(() => setJustSubmitted(false), 2600);
  }

  if (course.status === "pending_review") {
    return (
      <div className="flex flex-col gap-6">
        {justSubmitted && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-success/12 px-5 py-3.5 text-sm font-semibold text-success">
            <CheckIcon className="h-4 w-4" />
            Submitted — your course is now Pending Review.
          </div>
        )}

        <div className="rounded-3xl bg-white p-7 text-center shadow-soft">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning/12 text-warning">
            <ClockIcon className="h-6 w-6" />
          </span>
          <h2 className="mt-4 font-display text-xl text-text">Submitted for Review</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
            Our team typically reviews new submissions within <strong>2–3 business days</strong>. We'll email you the
            moment there's a decision.
          </p>

          <div className="mx-auto mt-6 flex max-w-sm items-center gap-3 rounded-xl bg-bg px-4 py-3 text-left">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rotation-1/40 to-rotation-2/30 text-xs font-bold text-muted">
              {(course.title || "?").slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text">{course.title}</p>
              <p className="truncate text-xs text-muted">{modules.reduce((s, m) => s + m.lessons.length, 0)} lessons · ${course.price}</p>
            </div>
            <CourseStatusBadge status={course.status} />
          </div>

          <div className="mx-auto mt-6 flex max-w-sm items-center gap-2 rounded-xl bg-text/[0.05] px-4 py-3 text-left text-xs text-muted">
            <PencilIcon className="h-3.5 w-3.5 shrink-0" />
            Editing is disabled until a decision is made — this protects what our reviewers see from changing mid-review.
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-text/15 bg-bg p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Demo only — simulate the Admin decision
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Button
              variant="primary"
              fullWidth={false}
              className="flex flex-1 items-center justify-center gap-2"
              onClick={() => setStatus("published", { submittedAt: course.submittedAt })}
            >
              <CheckIcon className="h-4 w-4" />
              Simulate: Approved
            </Button>
            <Button
              variant="secondary"
              fullWidth={false}
              className="flex flex-1 items-center justify-center gap-2"
              onClick={() =>
                setStatus("changes_requested", {
                  adminFeedback:
                    "The intro video in Module 1 is missing captions, and the assignment rubric needs at least one criterion covering accessibility. Please add both and resubmit.",
                })
              }
            >
              <FlagIcon className="h-4 w-4" />
              Simulate: Changes Requested
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (course.status === "published") {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-3xl bg-white p-7 text-center shadow-soft">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/12 text-success">
            <SparkleIcon className="h-7 w-7" />
          </span>
          <h2 className="mt-4 font-display text-xl text-text">Your course is live</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
            <strong>{course.title}</strong> was approved and published. Students can now discover and enroll in it.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button variant="primary" fullWidth={false} className="px-6" onClick={() => navigate(builderPath("/teacher/coursepreview", courseId))}>
              View Live Course
            </Button>
            <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => setStatus("archived")}>
              Archive this course
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (course.status === "archived") {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-3xl bg-white p-7 text-center opacity-70 shadow-soft">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-text/[0.08] text-muted">
            <ClockIcon className="h-6 w-6" />
          </span>
          <h2 className="mt-4 font-display text-xl text-muted">This course is archived</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
            <strong>{course.title}</strong> is read-only and no longer visible to new students. Reach out to support
            if you need it reinstated.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {course.status === "changes_requested" && course.adminFeedback && (
        <div className="rounded-2xl bg-danger/10 p-5">
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-danger">
            <FlagIcon className="h-4 w-4" /> Feedback from our review team
          </p>
          <p className="text-sm text-danger/85">"{course.adminFeedback}"</p>
        </div>
      )}

      <div className="rounded-3xl bg-white p-6 sm:p-7 shadow-soft">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text">Readiness check</h2>
            <p className="mt-1 text-sm text-muted">Resolve the required items below before submitting.</p>
          </div>
          <span className="shrink-0 rounded-full bg-bg px-3 py-1.5 text-xs font-semibold text-muted">
            {checklist.filter((i) => i.complete).length}/{checklist.length} complete
          </span>
        </div>

        <div className="flex flex-col divide-y divide-text/[0.06]">
          {checklist.map((item) => (
            <ChecklistItem key={item.id} item={item} courseId={courseId} />
          ))}
        </div>

        {bundle && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-bg px-4 py-3.5">
            <span className="eyebrow">Bundle</span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{bundle.name || "Untitled bundle"}</span>
            <span className="text-xs text-muted">{bundle.courseIds.length} courses</span>
            <span className="text-sm font-bold text-text">{formatMoney(bundleCheck.pricing.final)}</span>
            {bundleCheck.pricing.valid && bundleCheck.pricing.savings > 0 && (
              <span className="rounded-full bg-secondary/15 px-2.5 py-1 text-[11px] font-bold text-secondary">{bundleCheck.pricing.savingsPct}% off</span>
            )}
            {countdownInfo(bundle) && <span className="text-xs text-muted">{countdownInfo(bundle).label}</span>}
            <StatusBadge status={bundleItem.complete ? "success" : "warning"} size="sm">
              {bundleItem.complete ? "Ready" : "Needs attention"}
            </StatusBadge>
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-2">
        <span title={canSubmit ? undefined : `Missing: ${blocking.map((b) => b.label).join(", ")}`}>
          <Button
            variant="primary"
            fullWidth={false}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-7"
            onClick={() => setModalOpen(true)}
          >
            <SendIcon className="h-4 w-4" />
            {course.status === "changes_requested" ? "Resubmit for Review" : "Submit for Review"}
          </Button>
        </span>
        {!canSubmit && (
          <span className="text-xs text-danger">{blocking.length} required item{blocking.length === 1 ? "" : "s"} left</span>
        )}
        {canSubmit && warnings.length > 0 && (
          <span className="text-xs text-warning">{warnings.length} recommendation not addressed — you can still submit</span>
        )}
      </div>

      <SubmitModal open={modalOpen} onClose={() => setModalOpen(false)} onConfirm={confirmSubmit} />
    </div>
  );
}
