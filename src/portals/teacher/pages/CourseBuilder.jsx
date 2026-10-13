// Course builder + curriculum structure
// Jira: Day 4 — Course builder + curriculum structure
// Doc reference: Sec 5.4, 9
//
// Two-part flow: Course Details (Part 1) then Curriculum Structure
// (Part 2), behind the same ProgressSteps indicator that now also covers
// Content/Pricing/Review (Day 5-6). Course + modules now live in
// CourseBuilderContext (see routes.jsx) instead of this file's own local
// state, so edits here are still there when the educator comes back from
// Content, Pricing or Review.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProgressSteps from "../../../components/ui/ProgressSteps";
import Button from "../../../components/ui/Button";
import AutoSaveIndicator from "../../../components/ui/AutoSaveIndicator";
import LockedSection from "../../../components/ui/LockedSection";
import CourseDetailsForm from "../components/CourseDetailsForm";
import CurriculumBuilder from "../components/CurriculumBuilder";
import CourseStatusBadge from "../components/CourseStatusBadge";
import CourseLifecyclePanel from "../components/CourseLifecyclePanel";
import LifecycleBanner from "../components/LifecycleBanner";
import CourseTestSeriesRow from "../components/CourseTestSeriesRow";
import { useCourseBuilder } from "../context/CourseBuilderContext";
import { builderPath, COURSE_BUILDER_STEPS } from "../components/contentData";

export default function CourseBuilder() {
  const navigate = useNavigate();
  const { course, setCourse, modules, setModules, sections, courseId } = useCourseBuilder();
  const [stepIndex, setStepIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [savedAt, setSavedAt] = useState("just now");
  const saveTimer = useRef(null);
  const isFirstRender = useRef(true);

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
    }, 900);
    return () => clearTimeout(saveTimer.current);
  }, [course, modules]);

  function goNext() {
    if (stepIndex < 1) {
      setStepIndex((i) => i + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate(builderPath("/teacher/contentupload", courseId));
    }
  }

  function goBack() {
    if (stepIndex === 0) {
      navigate("/teacher/mycourses");
    } else {
      setStepIndex((i) => i - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <div className="pb-16">
      <div className="flex flex-col gap-4 border-b border-text/[0.07] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow mb-1.5">Create</div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Course Builder</h1>
            <CourseStatusBadge status={course.status} />
          </div>
          <p className="mt-1.5 text-sm text-muted">{course.title || "Untitled course"}</p>
          <div className="mt-1">
            <CourseLifecyclePanel course={course} />
          </div>
        </div>
        <AutoSaveIndicator status={saveStatus} timestamp={savedAt} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-3xl bg-white px-5 py-5 sm:px-8 shadow-soft">
        <ProgressSteps steps={COURSE_BUILDER_STEPS} currentIndex={stepIndex} />
      </div>

      <LifecycleBanner status={course.status} adminFeedback={course.adminFeedback} className="mt-6" />

      {/* Test series attached to this course (Part 6) */}
      <CourseTestSeriesRow courseId={courseId} className="mt-6" />

      <div className="mt-8">
        {stepIndex === 0 && (
          <LockedSection locked={!sections.details} reason="Course details can't be edited while this course is under review.">
            <CourseDetailsForm course={course} onChange={setCourse} />
          </LockedSection>
        )}
        {stepIndex === 1 && (
          <LockedSection
            locked={!sections.curriculum}
            reason={
              course.status === "published"
                ? "Curriculum is locked once a course is published."
                : "Curriculum can't be edited while this course is under review."
            }
          >
            <CurriculumBuilder modules={modules} onChange={setModules} />
          </LockedSection>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-text/[0.07] pt-6">
        <Button variant="secondary" fullWidth={false} className="px-6" onClick={goBack}>
          {stepIndex === 0 ? "Cancel" : "Back"}
        </Button>
        <Button variant="primary" fullWidth={false} className="px-6" onClick={goNext}>
          {stepIndex === 0 ? "Continue to Curriculum" : "Continue to Content"}
        </Button>
      </div>
    </div>
  );
}
