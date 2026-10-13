// Archiving a course that still has test series attached asks first, instead of
// silently leaving them dangling. Returns { archiveOrRestore, archiveModal }:
// call archiveOrRestore() from the existing Archive / Unarchive buttons and
// render {archiveModal} once next to them.
// (There is no "delete course" action in the educator portal yet; if one is
// added it should route through the same warning.)
import { useState } from "react";
import { useTestSeries } from "../../../context/TestSeriesContext";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import { SeriesStatusBadge } from "../components/TestSeriesStatus";

export default function useCourseArchive(course) {
  const { setCourseStatus } = useTeacherCourses();
  const { courseSeries, transitionSeries } = useTestSeries();
  const [open, setOpen] = useState(false);
  const attached = course ? courseSeries(course.id).filter((s) => s.status !== "archived") : [];
  const isArchived = course?.status === "archived";
  const archivable = attached.filter((s) => s.origin === "own" && s.status !== "final");

  function archiveOrRestore() {
    if (!course) return;
    if (isArchived || attached.length === 0) setCourseStatus(course.id, isArchived ? "draft" : "archived");
    else setOpen(true);
  }
  function confirm(alsoSeries) {
    if (!course) return;
    if (alsoSeries) archivable.forEach((s) => transitionSeries(s.id, "archived"));
    setCourseStatus(course.id, "archived");
    setOpen(false);
  }

  const archiveModal = (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="This course has test series attached"
      footer={
        <>
          {archivable.length > 0 && (
            <Button fullWidth={false} className="px-6" onClick={() => confirm(true)}>
              Archive course and {archivable.length} series
            </Button>
          )}
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => confirm(false)}>
            Archive course only
          </Button>
          <Button variant="tertiary" fullWidth={false} className="px-6" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        "{course?.title}" has {attached.length} test series linked to it. Archiving the course makes it read-only; the series below are not archived automatically.
        {attached.some((s) => s.origin === "assigned" || s.status === "final") ? " Admin-assigned and final published series can't be archived from here." : ""}
      </p>
      <ul className="mt-4 flex flex-col gap-2 pb-2">
        {attached.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 rounded-2xl bg-bg px-4 py-2.5">
            <span className="min-w-0 truncate text-sm font-semibold text-text">{s.title}</span>
            <SeriesStatusBadge series={s} size="sm" />
          </li>
        ))}
      </ul>
    </Modal>
  );
  return { archiveOrRestore, archiveModal };
}
