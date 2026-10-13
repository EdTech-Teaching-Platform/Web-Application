// Content Upload — Course Builder Part 3 (Day 5)
// Doc reference: Sec 5.4, 11.1 (Course Builder & Curriculum)
//
// Picks up right where CurriculumBuilder.jsx (Part 2 of CourseBuilder.jsx)
// leaves off: the module/lesson outline already exists, and now every
// lesson gets its actual material attached. Kept as its own route/page
// (not folded into CourseBuilder.jsx's step switch) because a
// lesson-by-lesson content workspace needs its own two-pane layout — a
// persistent curriculum tree beside a full editor panel — which doesn't
// fit CourseBuilder's single-column step body.
//
// modules now live in CourseBuilderContext (see routes.jsx), shared with
// CourseBuilder.jsx (Curriculum step), Course Preview and Publish Flow's
// readiness checklist — no more separate local seed state handed forward
// one-way via router `state`.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProgressSteps from "../../../components/ui/ProgressSteps";
import Button from "../../../components/ui/Button";
import LockedSection from "../../../components/ui/LockedSection";
import AutoSaveIndicator from "../../../components/ui/AutoSaveIndicator";
import { lessonStatus, COURSE_BUILDER_STEPS } from "../components/contentData";
import ContentLessonTree from "../components/ContentLessonTree";
import LessonContentPanel from "../components/LessonContentPanel";
import CourseStatusBadge from "../components/CourseStatusBadge";
import CourseLifecyclePanel from "../components/CourseLifecyclePanel";
import LifecycleBanner from "../components/LifecycleBanner";
import { useCourseBuilder } from "../context/CourseBuilderContext";
import { builderPath } from "../components/contentData";
import { EyeIcon } from "../../../components/ui/icons";

export default function ContentUpload() {
  const navigate = useNavigate();
  const { course, modules, setModules, sections, courseId } = useCourseBuilder();
  const flat = modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleId: m.id })));
  const [activeLessonId, setActiveLessonId] = useState(flat[0]?.id ?? null);
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [savedAt, setSavedAt] = useState("just now");
  const saveTimer = useRef(null);
  const isFirstRender = useRef(true);

  const activeLesson = flat.find((l) => l.id === activeLessonId) || null;
  const locked = !sections.curriculum;

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveStatus("saved");
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 700);
    return () => clearTimeout(saveTimer.current);
  }, [modules]);

  function updateLesson(updated) {
    setModules((prev) =>
      prev.map((m) => (m.id === updated.moduleId ? { ...m, lessons: m.lessons.map((l) => (l.id === updated.id ? updated : l)) } : m))
    );
  }

  function selectLesson(lesson) {
    setActiveLessonId(lesson.id);
    setMobileTreeOpen(false);
  }

  function nextEmptyLesson() {
    const idx = flat.findIndex((l) => l.id === activeLessonId);
    const rest = [...flat.slice(idx + 1), ...flat.slice(0, idx + 1)];
    return rest.find((l) => lessonStatus(l, false) === "empty" && l.id !== activeLessonId);
  }

  function saveAndNext() {
    const next = nextEmptyLesson();
    if (next) setActiveLessonId(next.id);
  }

  function goPreview() {
    navigate(builderPath("/teacher/coursepreview", courseId));
  }

  const hasNext = Boolean(nextEmptyLesson());

  return (
    <div className="pb-16">
      <div className="flex flex-col gap-4 border-b border-text/[0.07] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow mb-1.5">Create</div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Course Builder</h1>
            <CourseStatusBadge status={course.status} />
          </div>
          <p className="mt-1.5 text-sm text-muted">{course.title}</p>
          <div className="mt-1">
            <CourseLifecyclePanel course={course} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <AutoSaveIndicator status={saveStatus} timestamp={savedAt} />
          <Button variant="secondary" fullWidth={false} className="flex items-center gap-2 px-5" onClick={goPreview}>
            <EyeIcon className="h-4 w-4" />
            Preview Course
          </Button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-3xl bg-white px-5 py-5 sm:px-8 shadow-soft">
        <ProgressSteps steps={COURSE_BUILDER_STEPS} currentIndex={2} />
      </div>

      <LifecycleBanner status={course.status} adminFeedback={course.adminFeedback} className="mt-6" />

      <div className="mt-8">
        <button
          type="button"
          onClick={() => setMobileTreeOpen(true)}
          className="mb-4 flex w-full items-center justify-between rounded-3xl bg-white px-4 py-3 text-sm font-semibold text-text lg:hidden shadow-soft"
        >
          Curriculum
          <span className="text-xs font-normal text-muted">{activeLesson ? activeLesson.title || "Untitled lesson" : "Select a lesson"}</span>
        </button>

        <LockedSection
          locked={locked}
          reason={
            course.status === "published"
              ? "Content is locked once a course is published."
              : "Content can't be edited while this course is under review."
          }
        >
          <div className="flex items-start gap-6">
            <ContentLessonTree
              modules={modules}
              activeLessonId={activeLessonId}
              onSelect={selectLesson}
              mobileOpen={mobileTreeOpen}
              onCloseMobile={() => setMobileTreeOpen(false)}
            />

            <div className="min-w-0 flex-1">
              <LessonContentPanel
                lesson={activeLesson}
                onChange={updateLesson}
                onSaveDraft={() => setSaveStatus("saved")}
                onSaveNext={saveAndNext}
                saveStatus={saveStatus}
                savedAt={savedAt}
                hasNext={hasNext}
              />
            </div>
          </div>
        </LockedSection>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-text/[0.07] pt-6">
        <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => navigate(builderPath("/teacher/coursebuilder", courseId))}>
          Back
        </Button>
        <Button variant="primary" fullWidth={false} className="px-6" onClick={() => navigate(builderPath("/teacher/publishflow", courseId))}>
          Continue to Pricing
        </Button>
      </div>
    </div>
  );
}
