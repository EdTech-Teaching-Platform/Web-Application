// Pricing + publish flow + lifecycle states
// Jira: Day 6 — Pricing + publish flow + lifecycle states
// Doc reference: Sec 5.4
//
// Same two-sub-step-per-page pattern CourseBuilder.jsx uses for
// Details/Curriculum: this file covers Pricing (global step 4) and
// Review/Publish (global step 5) behind one ProgressSteps indicator, with
// a local stepIndex (0/1) mapped onto the global 0-based index (3/4).
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProgressSteps from "../../../components/ui/ProgressSteps";
import AutoSaveIndicator from "../../../components/ui/AutoSaveIndicator";
import Button from "../../../components/ui/Button";
import CourseStatusBadge from "../components/CourseStatusBadge";
import CourseLifecyclePanel from "../components/CourseLifecyclePanel";
import LifecycleBanner from "../components/LifecycleBanner";
import PricingForm from "../components/PricingForm";
import PublishReadiness from "../components/PublishReadiness";
import { isPricingValid, builderPath, COURSE_BUILDER_STEPS } from "../components/contentData";
import { useCourseBuilder } from "../context/CourseBuilderContext";

export default function PublishFlow() {
  const navigate = useNavigate();
  const { course, setCourse, modules, sections, setStatus, courseId } = useCourseBuilder();
  const [stepIndex, setStepIndex] = useState(0);
  const [attemptedContinue, setAttemptedContinue] = useState(false);
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
    }, 700);
    return () => clearTimeout(saveTimer.current);
  }, [course]);

  function goNext() {
    if (stepIndex === 0) {
      if (!isPricingValid(course)) {
        setAttemptedContinue(true);
        return;
      }
      setStepIndex(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goBack() {
    if (stepIndex === 0) {
      navigate(builderPath("/teacher/contentupload", courseId));
    } else {
      setStepIndex(0);
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
          <p className="mt-1.5 text-sm text-muted">{course.title}</p>
          <div className="mt-1">
            <CourseLifecyclePanel course={course} />
          </div>
        </div>
        <AutoSaveIndicator status={saveStatus} timestamp={savedAt} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-3xl bg-white px-5 py-5 sm:px-8 shadow-soft">
        <ProgressSteps steps={COURSE_BUILDER_STEPS} currentIndex={3 + stepIndex} />
      </div>

      <LifecycleBanner status={course.status} adminFeedback={course.adminFeedback} className="mt-6" />

      <div className="mt-8">
        {stepIndex === 0 && (
          <PricingForm
            course={course}
            onChange={setCourse}
            locked={!sections.pricing}
            forceShowError={attemptedContinue}
          />
        )}
        {stepIndex === 1 && <PublishReadiness course={course} modules={modules} setStatus={setStatus} courseId={courseId} />}
      </div>

      {stepIndex === 0 && (
        <div className="mt-8 flex items-center justify-between border-t border-text/[0.07] pt-6">
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={goBack}>
            Back
          </Button>
          <Button variant="primary" fullWidth={false} className="px-6" onClick={goNext}>
            Continue to Review
          </Button>
        </div>
      )}

      {stepIndex === 1 && (course.status === "draft" || course.status === "changes_requested") && (
        <div className="mt-8 flex items-center justify-between border-t border-text/[0.07] pt-6">
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={goBack}>
            Back to Pricing
          </Button>
          <span />
        </div>
      )}
    </div>
  );
}
