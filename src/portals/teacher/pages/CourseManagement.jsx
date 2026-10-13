// Course Management Overview — a single-course workspace opened from a My
// Courses card. Tabbed so everything about one course (performance,
// curriculum, students, grading, reviews, analytics) lives in one place,
// reading/writing the same TeacherCoursesContext record My Courses and the
// Course Builder use, so nothing here is separately hardcoded.
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams, NavLink } from "react-router-dom";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import CourseStatusBadge from "../components/CourseStatusBadge";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import { relativeDate } from "../components/CoursePortfolioCard";
import { courseMonthlyRevenue } from "../data/teacherCourses";
import ManagementOverviewTab from "../components/ManagementOverviewTab";
import CourseTestSeriesRow from "../components/CourseTestSeriesRow";
import useCourseArchive from "../hooks/useCourseArchive";
import ManagementCurriculumTab from "../components/ManagementCurriculumTab";
import ManagementStudentsTab from "../components/ManagementStudentsTab";
import ManagementGradingTab from "../components/ManagementGradingTab";
import ManagementReviewsTab from "../components/ManagementReviewsTab";
import ManagementAnalyticsTab from "../components/ManagementAnalyticsTab";
import ManagementResultsTab from "../components/ManagementResultsTab";
import ManagementAnnouncementsTab from "../components/ManagementAnnouncementsTab";
import HomeworkUploadPanel from "../components/HomeworkUploadPanel";
import ResultsUploadPanel from "../components/ResultsUploadPanel";
import {
  ArrowLeftIcon,
  PencilIcon,
  EyeIcon,
  ArchiveIcon,
  FlagIcon,
  UsersIcon,
  StarIcon,
  WalletIcon,
  UploadIcon,
  CertificateIcon,
  VideoIcon,
} from "../../../components/ui/icons";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "curriculum", label: "Curriculum" },
  { key: "students", label: "Students" },
  { key: "grading", label: "Grading Queue" },
  { key: "results", label: "Results" },
  { key: "announcements", label: "Announcements" },
  { key: "reviews", label: "Reviews" },
  { key: "analytics", label: "Analytics" },
];

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-text px-4 py-2.5 text-sm font-medium text-white shadow-lg">{message}</div>
  );
}

const ROTATION_CLASSES = ["bg-pastel-orange", "bg-pastel-blue", "bg-pastel-sage", "bg-pastel-lavender"];

function AdminFeedbackModal({ course, open, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Feedback from our review team"
      footer={
        <Button variant="secondary" fullWidth={false} onClick={onClose}>
          Close
        </Button>
      }
    >
      <p className="text-sm text-muted">"{course.adminFeedback}"</p>
    </Modal>
  );
}

export default function CourseManagement() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { courses, setCourseStatus, shareHomework, publishResults } = useTeacherCourses();
  const [searchParams, setSearchParams] = useSearchParams();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [homeworkOpen, setHomeworkOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [toast, setToast] = useState("");

  function flash(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  const course = courses.find((c) => c.id === courseId);
  const { archiveOrRestore, archiveModal } = useCourseArchive(course);
  const initialTab = TABS.some((t) => t.key === searchParams.get("tab")) ? searchParams.get("tab") : "overview";
  const [tab, setTab] = useState(initialTab);

  const canEdit = course && course.status !== "pending_review" && course.status !== "archived";
  const canArchive = course && course.status !== "pending_review";
  const isArchived = course?.status === "archived";
  const revenue = useMemo(() => (course ? courseMonthlyRevenue(course) : 0), [course]);

  if (!course) {
    return (
      <div className="flex flex-col items-center rounded-3xl bg-white px-8 py-16 text-center shadow-soft">
        <p className="text-sm font-medium text-muted">This course couldn't be found.</p>
        <NavLink to="/teacher/mycourses" className="mt-4">
          <Button variant="secondary" fullWidth={false} className="px-5">
            Back to My Courses
          </Button>
        </NavLink>
      </div>
    );
  }

  function changeTab(key) {
    setTab(key);
    setSearchParams(key === "overview" ? {} : { tab: key }, { replace: true });
  }

  return (
    <div className="pb-16">
      <button
        type="button"
        onClick={() => navigate("/teacher/mycourses")}
        className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-text"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        My Courses
      </button>

      {/* Header — persistent across all tabs */}
      <div className="flex flex-col gap-5 rounded-3xl bg-white p-5 sm:p-6 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-muted ${ROTATION_CLASSES[0]}`}>
              {course.title.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight text-text sm:text-2xl">{course.title}</h1>
                <CourseStatusBadge status={course.status} />
              </div>
              <p className="mt-1 truncate text-sm text-muted">{course.subtitle}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-4 text-sm text-muted">
                <span className="flex items-center gap-1.5">
                  <UsersIcon className="h-4 w-4 text-muted" />
                  {course.students.length} students
                </span>
                <span className="flex items-center gap-1.5">
                  <StarIcon className="h-4 w-4 text-warning" />
                  {course.ratingCount ? course.rating.toFixed(1) : "No ratings yet"}
                </span>
                <span className="flex items-center gap-1.5">
                  <WalletIcon className="h-4 w-4 text-muted" />
                  ${revenue.toLocaleString()} this month
                </span>
                <span className="text-muted">Updated {relativeDate(course.updatedAt)}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              fullWidth={false}
              className="flex items-center gap-1.5"
              onClick={() => navigate(`/teacher/liveclasses?courseId=${course.id}`)}
            >
              <VideoIcon className="h-4 w-4" />
              Schedule Live Class
            </Button>
            <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5" onClick={() => setHomeworkOpen(true)}>
              <UploadIcon className="h-4 w-4" />
              Share Homework / Notes
            </Button>
            <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5" onClick={() => setResultsOpen(true)}>
              <CertificateIcon className="h-4 w-4" />
              Upload Marksheet / Results
            </Button>
            {course.status === "changes_requested" && (
              <Button
                variant="secondary"
                fullWidth={false}
                className="flex items-center gap-1.5 border-danger text-danger hover:bg-danger/5"
                onClick={() => setFeedbackOpen(true)}
              >
                <FlagIcon className="h-4 w-4" />
                View Admin Feedback
              </Button>
            )}
            <span title={!canEdit ? "This course can't be edited right now." : undefined}>
              <Button
                variant="secondary"
                fullWidth={false}
                disabled={!canEdit}
                className="flex items-center gap-1.5"
                onClick={() => navigate(`/teacher/coursebuilder/${course.id}`)}
              >
                <PencilIcon className="h-4 w-4" />
                Edit Course
              </Button>
            </span>
            <Button
              variant="secondary"
              fullWidth={false}
              className="flex items-center gap-1.5"
              onClick={() => navigate(`/teacher/coursepreview/${course.id}`)}
            >
              <EyeIcon className="h-4 w-4" />
              Preview
            </Button>
            <span title={!canArchive ? "Can't archive while pending review." : undefined}>
              <Button
                variant="secondary"
                fullWidth={false}
                disabled={!canArchive}
                className="flex items-center gap-1.5"
                onClick={archiveOrRestore}
              >
                <ArchiveIcon className="h-4 w-4" />
                {isArchived ? "Unarchive" : "Archive"}
              </Button>
            </span>
          </div>
        </div>

        {/* Tab bar — scrolls horizontally on small viewports instead of wrapping */}
        <div className="-mx-1 flex gap-1 overflow-x-auto border-t border-text/[0.07] px-1 pt-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => changeTab(t.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-150 ${
                tab === t.key ? "bg-primary text-white" : "text-muted hover:bg-primary/[0.06] hover:text-text"
              } hover:-translate-y-0.5 hover:shadow-soft`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {tab === "overview" && (
          <>
            <CourseTestSeriesRow courseId={course.id} className="mb-5" />
            <ManagementOverviewTab course={course} />
          </>
        )}
        {tab === "curriculum" && <ManagementCurriculumTab course={course} />}
        {tab === "students" && <ManagementStudentsTab course={course} />}
        {tab === "grading" && <ManagementGradingTab course={course} />}
        {tab === "results" && <ManagementResultsTab course={course} />}
        {tab === "announcements" && <ManagementAnnouncementsTab course={course} />}
        {tab === "reviews" && <ManagementReviewsTab course={course} />}
        {tab === "analytics" && <ManagementAnalyticsTab course={course} />}
      </div>

      <AdminFeedbackModal course={course} open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <HomeworkUploadPanel
        open={homeworkOpen}
        course={course}
        presetAttach={null}
        onClose={() => setHomeworkOpen(false)}
        onShare={(item) => {
          shareHomework(course.id, item);
          setHomeworkOpen(false);
          flash("Shared with students.");
        }}
      />
      <ResultsUploadPanel
        open={resultsOpen}
        course={course}
        onClose={() => setResultsOpen(false)}
        onPublish={(item) => {
          publishResults(course.id, item);
          setResultsOpen(false);
          flash("Results published — visible on affected students' dashboards.");
        }}
      />
      {archiveModal}
      <Toast message={toast} />
    </div>
  );
}
