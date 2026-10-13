import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnClickOutside } from "../hooks/useOnClickOutside";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import useCourseArchive from "../hooks/useCourseArchive";
import { MoreIcon, PencilIcon, DuplicateIcon, EyeIcon, ArchiveIcon, ChartIcon } from "../../../components/ui/icons";

// CourseQuickActionsMenu — the one kebab menu both the My Courses grid
// card and list row use (per the spec, they show "the same quick-action
// menu"). Which options are enabled follows the exact lock rules
// contentData.editableSections already establishes for the builder: a
// course under review or archived can't be edited, matching the
// LockedSection treatment those screens show if you get there anyway.
export default function CourseQuickActionsMenu({ course, className = "" }) {
  const navigate = useNavigate();
  const { duplicateCourse } = useTeacherCourses();
  const { archiveOrRestore, archiveModal } = useCourseArchive(course);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOnClickOutside(ref, () => setOpen(false));

  const canEdit = course.status !== "pending_review" && course.status !== "archived";
  const canArchive = course.status !== "pending_review";
  const isArchived = course.status === "archived";

  function go(path) {
    setOpen(false);
    navigate(path);
  }

  const items = [
    {
      key: "edit",
      label: "Edit",
      Icon: PencilIcon,
      disabled: !canEdit,
      reason: course.status === "pending_review" ? "Can't edit while pending review" : "Archived courses are read-only",
      onClick: () => go(`/teacher/coursebuilder/${course.id}`),
    },
    {
      key: "duplicate",
      label: "Duplicate",
      Icon: DuplicateIcon,
      disabled: false,
      onClick: () => {
        duplicateCourse(course.id);
        setOpen(false);
      },
    },
    {
      key: "preview",
      label: "Preview",
      Icon: EyeIcon,
      disabled: false,
      onClick: () => go(`/teacher/coursepreview/${course.id}`),
    },
    {
      key: "archive",
      label: isArchived ? "Unarchive" : "Archive",
      Icon: ArchiveIcon,
      disabled: !canArchive,
      reason: "Can't archive while pending review",
      onClick: () => {
        archiveOrRestore();
        setOpen(false);
      },
    },
    {
      key: "analytics",
      label: "View Analytics",
      Icon: ChartIcon,
      disabled: false,
      onClick: () => go(`/teacher/coursemanagement/${course.id}?tab=analytics`),
    },
  ];

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        aria-label="Course actions"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded-full p-1.5 text-muted transition-colors duration-150 hover:bg-text/[0.06] hover:text-text"
      >
        <MoreIcon className="h-4.5 w-4.5" />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-2xl bg-white py-1 shadow-lg"
        >
          {items.map(({ key, label, Icon, disabled, reason, onClick }) => (
            <button
              key={key}
              type="button"
              disabled={disabled}
              title={disabled ? reason : undefined}
              onClick={disabled ? undefined : onClick}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors duration-150 ${
                disabled ? "cursor-not-allowed text-text/25" : "text-text hover:bg-bg"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 text-muted" />
              {label}
            </button>
          ))}
        </div>
      )}
      <div onClick={(e) => e.stopPropagation()}>{archiveModal}</div>
    </div>
  );
}
