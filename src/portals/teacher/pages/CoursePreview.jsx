// Course Preview — Course Builder, entered from ContentUpload.jsx's
// "Preview Course" button (Doc reference: Sec 5.4, 11.1, same Day-5 scope
// as Content Upload). A dedicated route rather than a modal/mode-flag on
// ContentUpload.jsx because it needs to render the actual public course
// page chrome (banner, tabs, curriculum accordion) at full width, plus a
// simulated student-facing player — neither of which belongs inside the
// content-editing layout.
//
// Reads `course`/`modules` from router state (what ContentUpload.jsx just
// had the educator editing); falls back to contentData.js's mock so the
// route still demos fully populated if opened directly.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import CourseStatusBadge from "../components/CourseStatusBadge";
import { useCourseBuilder } from "../context/CourseBuilderContext";
import { builderPath } from "../components/contentData";
import { formatMoney } from "../../../utils/formatMoney";
import { formatBytes, lessonStatus, quizTotalPoints } from "../components/contentData";
import { LESSON_TYPE_META } from "../components/LessonRow";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  FileGenericIcon,
  LockIcon,
  MobileIcon,
  MonitorIcon,
  PlayIcon,
  StarIcon,
  TabletIcon,
} from "../../../components/ui/icons";

const TABS = ["Overview", "Curriculum", "Instructor", "Reviews"];
const DEVICE_WIDTH = { desktop: "100%", tablet: "740px", mobile: "390px" };

function flattenLessons(modules) {
  return modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleId: m.id, moduleTitle: m.title })));
}

// -- Feedback checklist ------------------------------------------------
function buildChecklist(course, modules) {
  const flat = flattenLessons(modules);
  const emptyLessons = flat.filter((l) => lessonStatus(l, false) === "empty");
  const items = [];

  if (emptyLessons.length > 0) {
    items.push({
      id: "empty-lessons",
      blocking: true,
      text: `${emptyLessons.length} lesson${emptyLessons.length === 1 ? "" : "s"} still missing content`,
    });
  }
  if (!course.thumbnail) {
    items.push({ id: "thumbnail", blocking: true, text: "No course thumbnail uploaded" });
  }
  if (!flat.some((l) => l.preview)) {
    items.push({ id: "preview", blocking: false, text: "No free preview lesson set" });
  }
  if (!course.outcomes || course.outcomes.length === 0) {
    items.push({ id: "outcomes", blocking: false, text: "\"What you'll learn\" is empty" });
  }
  const modulesWithoutContent = modules.filter((m) => m.lessons.length > 0 && m.lessons.every((l) => lessonStatus(l, false) === "empty"));
  if (modulesWithoutContent.length > 0) {
    items.push({
      id: "empty-modules",
      blocking: true,
      text: `${modulesWithoutContent.length} module${modulesWithoutContent.length === 1 ? "" : "s"} has no content at all`,
    });
  }

  return items;
}

function FeedbackPanel({ course, modules, open, onToggle }) {
  const items = buildChecklist(course, modules);
  const blockingCount = items.filter((i) => i.blocking).length;

  return (
    <div className="fixed bottom-4 right-4 z-30 w-[min(320px,calc(100vw-2rem))] sm:right-6">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-text px-4 py-3 text-left text-sm font-semibold text-white shadow-lg"
      >
        <span>Preview feedback {items.length > 0 && <span className="text-white/60">({items.length})</span>}</span>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-2 max-h-72 overflow-y-auto rounded-3xl bg-white p-4 shadow-lg">
          {items.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckIcon className="h-4 w-4" /> Everything looks ready to submit.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {items.map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-sm">
                  <span
                    className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.blocking ? "bg-danger" : "bg-warning"}`}
                  />
                  <span className="text-muted">{item.text}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-text/[0.07] pt-3 text-[11px] text-muted">
            A private checklist only you can see — nothing here is saved to the course.
          </p>
        </div>
      )}
    </div>
  );
}

// -- Curriculum accordion ------------------------------------------------
function CurriculumAccordion({ modules, onOpenLesson }) {
  const [openModuleId, setOpenModuleId] = useState(modules[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-3">
      {modules.map((m, i) => {
        const open = openModuleId === m.id;
        return (
          <div key={m.id} className="overflow-hidden rounded-2xl border border-text/10">
            <button
              type="button"
              onClick={() => setOpenModuleId(open ? null : m.id)}
              className="flex w-full items-center gap-3 bg-bg px-4 py-3.5 text-left"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{m.title}</span>
              <span className="shrink-0 text-xs text-muted">{m.lessons.length} lessons</span>
              <ChevronDownIcon className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
              <div className="flex flex-col divide-y divide-text/[0.06]">
                {m.lessons.map((lesson) => {
                  const meta = LESSON_TYPE_META[lesson.type];
                  const hasContent = lessonStatus(lesson, false) !== "empty";
                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => onOpenLesson(lesson)}
                      className="flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-bg/70"
                    >
                      <meta.Icon className="h-4 w-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate text-sm text-text">{lesson.title || "Untitled lesson"}</span>
                      <span className="hidden shrink-0 text-xs text-muted sm:inline">
                        {lesson.duration || (lesson.type === "quiz" ? `${(lesson.questions || []).length} questions` : meta.label)}
                      </span>
                      {lesson.preview ? (
                        <span className="shrink-0 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-semibold text-success">Preview</span>
                      ) : (
                        <LockIcon className="h-3.5 w-3.5 shrink-0 text-text/25" />
                      )}
                      {!hasContent && <span className="shrink-0 text-[11px] font-semibold text-warning">Draft</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// -- Public-facing tabs ------------------------------------------------
function OverviewTab({ course }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-3 text-base font-semibold text-text">What you'll learn</h3>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {(course.outcomes || []).map((o) => (
            <div key={o} className="flex items-start gap-2 text-sm text-muted">
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              {o}
            </div>
          ))}
          {(!course.outcomes || course.outcomes.length === 0) && <p className="text-sm text-muted">Nothing added yet.</p>}
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-base font-semibold text-text">Requirements</h3>
        <ul className="flex flex-col gap-1.5 text-sm text-muted">
          {(course.requirements || []).map((r) => (
            <li key={r} className="list-disc pl-1 marker:text-text/30">
              {r}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function InstructorTab({ course }) {
  const initials = (course.instructor?.name || "")
    .split(" ")
    .map((p) => p[0])
    .join("");
  return (
    <div className="flex items-start gap-4">
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
        {initials}
      </span>
      <div>
        <h3 className="text-base font-semibold text-text">{course.instructor?.name}</h3>
        <p className="mt-0.5 text-sm text-muted">{course.instructor?.headline}</p>
        <p className="mt-3 max-w-md text-sm text-muted">
          Full instructor bio appears here once added on the Profile Setup screen — pulled from the same educator profile as the Digital ID Card.
        </p>
      </div>
    </div>
  );
}

function ReviewsTab() {
  return (
    <div className="flex flex-col items-center rounded-xl bg-bg px-6 py-12 text-center">
      <StarIcon className="h-8 w-8 text-text/15" />
      <p className="mt-3 text-sm font-medium text-muted">No reviews yet</p>
      <p className="mt-1 text-xs text-muted">Reviews will appear here once students start enrolling and rating this course.</p>
    </div>
  );
}

// -- Simulated student player ------------------------------------------------
function QuizPlayer({ lesson }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const questions = lesson.questions || [];

  function select(qId, optId, multiple) {
    setAnswers((prev) => {
      if (!multiple) return { ...prev, [qId]: [optId] };
      const current = prev[qId] || [];
      return { ...prev, [qId]: current.includes(optId) ? current.filter((o) => o !== optId) : [...current, optId] };
    });
  }

  const total = quizTotalPoints(questions);
  const scored = submitted
    ? questions.reduce((sum, q) => {
        if (q.type === "short") return sum;
        const chosen = answers[q.id] || [];
        const correctIds = q.options.filter((o) => o.correct).map((o) => o.id);
        const isCorrect = chosen.length === correctIds.length && chosen.every((c) => correctIds.includes(c));
        return sum + (isCorrect ? q.points : 0);
      }, 0)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-xl bg-bg px-4 py-2.5 text-xs text-muted">
        <span>{questions.length} questions · {total} pts</span>
        <span>
          {lesson.maxAttempts ?? 1} attempt{(lesson.maxAttempts ?? 1) === 1 ? "" : "s"} · Pass at {lesson.passThreshold ?? 70}%
          {lesson.timeLimitEnabled ? ` · ${lesson.timeLimitMinutes} min` : ""}
        </span>
      </div>

      {questions.map((q, i) => {
        const multiple = q.type === "multiple";
        return (
          <div key={q.id} className="rounded-xl border border-text/10 p-4">
            <p className="mb-2.5 text-sm font-medium text-text">
              {i + 1}. {q.text || "Untitled question"}
            </p>
            {q.type === "short" ? (
              <input
                disabled={submitted}
                placeholder="Type your answer…"
                className="w-full rounded-lg border border-text/15 bg-bg px-3 py-2 text-sm outline-none disabled:opacity-60"
              />
            ) : (
              <div className="flex flex-col gap-2">
                {q.options.map((opt) => {
                  const chosen = (answers[q.id] || []).includes(opt.id);
                  const showResult = submitted;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={submitted}
                      onClick={() => select(q.id, opt.id, multiple)}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-150 ${
                        showResult && opt.correct
                          ? "border-success bg-success/10"
                          : showResult && chosen && !opt.correct
                          ? "border-danger bg-danger/10"
                          : chosen
                          ? "border-primary bg-primary/5"
                          : "border-text/15 hover:bg-bg"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${multiple ? "rounded-[4px]" : ""} ${
                          chosen ? "border-primary bg-primary text-white" : "border-text/25"
                        }`}
                      >
                        {chosen && <CheckIcon className="h-2.5 w-2.5" />}
                      </span>
                      {opt.text || "Option"}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {!submitted ? (
        <Button variant="primary" fullWidth={false} className="self-start px-6" onClick={() => setSubmitted(true)}>
          Submit quiz
        </Button>
      ) : (
        <div className="rounded-xl bg-primary/[0.06] px-4 py-3 text-sm font-semibold text-primary">
          Scored {scored}/{total} — {scored / total >= (lesson.passThreshold ?? 70) / 100 ? "Passed" : "Below passing score"}
        </div>
      )}
    </div>
  );
}

function LessonPlayer({ lesson, onBack }) {
  const meta = LESSON_TYPE_META[lesson.type];
  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 self-start text-sm font-semibold text-muted hover:text-text">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to curriculum
      </button>

      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <meta.Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-lg text-text">{lesson.title || "Untitled lesson"}</h2>
          {lesson.description && <p className="text-sm text-muted">{lesson.description}</p>}
        </div>
      </div>

      {lesson.type === "video" &&
        (lesson.videoFile || lesson.embedUrl ? (
          <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl bg-text text-white">
            <PlayIcon className="h-10 w-10 opacity-80" />
            <span className="text-xs text-white/60">{lesson.duration || "Duration pending"}</span>
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-xl bg-bg text-sm text-muted">No video uploaded yet</div>
        ))}

      {lesson.type === "article" &&
        (lesson.content ? (
          <div className="prose prose-sm max-w-none text-text/80" dangerouslySetInnerHTML={{ __html: lesson.content }} />
        ) : (
          <p className="rounded-xl bg-bg px-4 py-8 text-center text-sm text-muted">This article hasn't been written yet.</p>
        ))}

      {lesson.type === "quiz" && <QuizPlayer lesson={lesson} />}

      {lesson.type === "assignment" && (
        <div className="flex flex-col gap-4">
          {lesson.instructions ? (
            <div className="prose prose-sm max-w-none text-text/80" dangerouslySetInnerHTML={{ __html: lesson.instructions }} />
          ) : (
            <p className="rounded-xl bg-bg px-4 py-8 text-center text-sm text-muted">No instructions written yet.</p>
          )}
          <div className="flex flex-wrap gap-4 rounded-xl bg-bg px-4 py-3 text-xs text-muted">
            <span>Due: {lesson.noDueDate ? "No due date" : lesson.dueDate || "—"}</span>
            <span>Max score: {lesson.maxScore ?? 100}</span>
            <span className="capitalize">Submit via: {lesson.submissionType || "file"}</span>
          </div>
          {(lesson.rubric || []).length > 0 && (
            <div className="rounded-xl border border-text/10 p-4">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">Rubric</span>
              <ul className="flex flex-col gap-1.5 text-sm text-muted">
                {lesson.rubric.map((r) => (
                  <li key={r.id} className="flex justify-between gap-3">
                    <span>{r.label}</span>
                    <span className="font-medium text-muted">{r.points} pts</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {lesson.type === "resource" && (
        <div className="flex flex-col gap-2">
          {(lesson.files || []).length === 0 ? (
            <p className="rounded-xl bg-bg px-4 py-8 text-center text-sm text-muted">No files uploaded yet.</p>
          ) : (
            lesson.files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-text/10 px-4 py-3">
                <FileGenericIcon className="h-4 w-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-sm text-text">{f.name}</span>
                <span className="shrink-0 text-xs text-muted">{formatBytes(f.size)}</span>
                <Button variant="secondary" fullWidth={false} shape="rect" className="px-3 py-1.5 text-xs">
                  Download
                </Button>
              </div>
            ))
          )}
        </div>
      )}

      {lesson.type === "live" && (
        <div className="rounded-xl border border-text/10 p-4">
          {lesson.scheduledAt ? (
            <p className="text-sm font-semibold text-text">
              Live on {new Date(lesson.scheduledAt).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} at{" "}
              {new Date(lesson.scheduledAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </p>
          ) : (
            <p className="text-sm text-muted">Not scheduled yet.</p>
          )}
          <p className="mt-3 rounded-lg bg-bg px-3 py-6 text-center text-xs text-muted">Recording will appear here after the session.</p>
        </div>
      )}
    </div>
  );
}

// -- Main page ------------------------------------------------------------
export default function CoursePreview() {
  const navigate = useNavigate();
  const { course, modules, courseId } = useCourseBuilder();

  const [device, setDevice] = useState("desktop");
  const [tab, setTab] = useState("Overview");
  const [playerLesson, setPlayerLesson] = useState(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const checklist = useMemo(() => buildChecklist(course, modules), [course, modules]);
  const blocking = checklist.filter((i) => i.blocking);
  const canSubmit = blocking.length === 0;

  return (
    <div className="pb-16">
      <div className="flex flex-col gap-3 border-b border-text/[0.07] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5 px-4" onClick={() => navigate(builderPath("/teacher/contentupload", courseId))}>
            <ArrowLeftIcon className="h-4 w-4" />
            Exit Preview
          </Button>
          <StatusBadge status="warning" showIcon={false} className="hidden sm:inline-flex">
            Previewing as a Student
          </StatusBadge>
          <CourseStatusBadge status={course.status} className="hidden sm:inline-flex" />
        </div>

        <div className="flex items-center gap-1 self-start rounded-full bg-text/[0.05] p-1 sm:self-auto">
          {[
            { key: "desktop", Icon: MonitorIcon },
            { key: "tablet", Icon: TabletIcon },
            { key: "mobile", Icon: MobileIcon },
          ].map(({ key, Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={device === key}
              onClick={() => setDevice(key)}
              aria-label={key}
              className={`rounded-full p-2 transition-all duration-200 ${device === key ? "bg-primary text-white" : "text-muted hover:text-text"} hover:-translate-y-0.5 hover:shadow-soft`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        <div title={canSubmit ? undefined : blocking.map((b) => b.text).join("; ")}>
          <Button
            variant="primary"
            fullWidth={false}
            disabled={!canSubmit}
            className="px-6"
            onClick={() => navigate(builderPath("/teacher/publishflow", courseId))}
          >
            Submit for Review
          </Button>
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <div
          className="w-full overflow-hidden rounded-3xl bg-white shadow-sm transition-[max-width] duration-300"
          style={{ maxWidth: DEVICE_WIDTH[device] }}
        >
          <div className="flex aspect-[16/6] items-center justify-center bg-gradient-to-br from-primary to-primary/70 text-white/80">
            {course.thumbnail ? (
              <img src={course.thumbnail} alt={course.title} className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm">No thumbnail uploaded</span>
            )}
          </div>

          <div className="px-5 py-6 sm:px-8">
            {playerLesson ? (
              <LessonPlayer lesson={playerLesson} onBack={() => setPlayerLesson(null)} />
            ) : (
              <>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h1 className="font-display text-2xl text-text">{course.title}</h1>
                    <p className="mt-1.5 text-sm text-muted">{course.subtitle}</p>
                    <div className="mt-3 flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1 font-semibold text-text">
                        <StarIcon className="h-4 w-4 text-warning" />
                        {course.ratingCount ? course.rating : "No ratings yet"}
                      </span>
                      <span className="text-muted">·</span>
                      <span className="text-muted">{course.level}</span>
                      <span className="text-muted">·</span>
                      <span className="text-muted">{course.language}</span>
                    </div>
                  </div>
                  <div className="shrink-0 rounded-xl bg-bg px-5 py-3 text-center">
                    <span className="block text-2xl font-bold text-text">{formatMoney(course.price, course.currency)}</span>
                    <span className="block text-xs text-muted">one-time</span>
                  </div>
                </div>

                <div className="mt-6 flex gap-1 overflow-x-auto border-b border-text/[0.07]">
                  {TABS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors duration-150 ${
                        tab === t ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="mt-6">
                  {tab === "Overview" && <OverviewTab course={course} />}
                  {tab === "Curriculum" && <CurriculumAccordion modules={modules} onOpenLesson={setPlayerLesson} />}
                  {tab === "Instructor" && <InstructorTab course={course} />}
                  {tab === "Reviews" && <ReviewsTab />}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <FeedbackPanel course={course} modules={modules} open={feedbackOpen} onToggle={() => setFeedbackOpen((o) => !o)} />
    </div>
  );
}
