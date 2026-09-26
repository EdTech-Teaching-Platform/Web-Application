// Course player shell + video
// Jira: Day 7 — Course player shell + video (built as part of the Day 4
// Course Player pass — folds in the PDF/Resource Viewer, Text Reader, and
// Notes panel too, since the spec treats them as one integrated learning
// experience rather than separate pages).
// Doc reference: Sec 5.5, 10.1
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { getCourseById } from "../../../data/catalogMock";
import BackButton from "../../../components/common/BackButton";
import { useCourseProgress } from "../hooks/useCourseProgress";
import { useCourseQA } from "../hooks/useCourseQA";
import { flattenCurriculum } from "../components/coursePlayer/lessonContent";
import CourseNavSidebar from "../components/coursePlayer/CourseNavSidebar";
import VideoLessonPlayer from "../components/coursePlayer/VideoLessonPlayer";
import ResourceLessonViewer from "../components/coursePlayer/ResourceLessonViewer";
import TextLessonReader from "../components/coursePlayer/TextLessonReader";
import OtherLessonCard from "../components/coursePlayer/OtherLessonCard";
import LessonNotesPanel from "../components/coursePlayer/LessonNotesPanel";
import TranscriptTab from "../components/coursePlayer/TranscriptTab";
import QATab from "../components/coursePlayer/QATab";
import LessonNavFooter from "../components/coursePlayer/LessonNavFooter";
import {
  MenuIcon,
  XIcon,
  ChevronRightIcon,
  AlertTriangleIcon,
  BookOpenIcon,
  FileTextIcon,
  ChatIcon,
} from "../../../components/ui/icons";

function LoadingSkeleton() {
  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[320px_1fr]">
      <div className="hidden h-[70vh] animate-pulse rounded-2xl bg-text/5 lg:block" />
      <div className="space-y-4">
        <div className="h-4 w-40 animate-pulse rounded bg-text/10" />
        <div className="h-8 w-2/3 animate-pulse rounded bg-text/10" />
        <div className="aspect-video w-full animate-pulse rounded-2xl bg-text/10" />
        <div className="h-24 w-full animate-pulse rounded-2xl bg-text/5" />
      </div>
    </div>
  );
}

export default function CoursePlayer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseId = searchParams.get("course");
  const lessonParam = searchParams.get("lesson");
  const tabParam = searchParams.get("tab");
  const seekParam = searchParams.get("seek");
  const recordingId = searchParams.get("recording");
  const simulateVideoError = searchParams.get("simulateVideoError") === "1";
  const simulateResourceError = searchParams.get("simulateResourceError") === "1";

  const course = useMemo(() => (courseId ? getCourseById(courseId) : null), [courseId]);
  const progress = useCourseProgress(courseId ?? "unknown");
  const qa = useCourseQA(courseId ?? "unknown");

  const [loading, setLoading] = useState(true);
  const [navOpen, setNavOpen] = useState(false);
  const [resumedNotice, setResumedNotice] = useState(false);
  const [activeTab, setActiveTab] = useState(tabParam || "notes");
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  const videoPlayerRef = useRef(null);

  // Brief, realistic loading state on course load (spec Section 11)
  useEffect(() => {
    setLoading(true);
    const t = window.setTimeout(() => setLoading(false), 300);
    return () => window.clearTimeout(t);
  }, [courseId]);

  const flatLessons = useMemo(
    () => (course && Array.isArray(course.curriculum) ? flattenCurriculum(course.curriculum) : []),
    [course]
  );

  // Resolve the active lesson: explicit ?lesson= wins, otherwise resume
  // the last lesson the student was on, otherwise start at lesson 1 —
  // spec Section 9 (Learning History / Resume).
  const currentLessonId = useMemo(() => {
    if (!flatLessons.length) return null;
    if (lessonParam && flatLessons.some((l) => l.id === lessonParam)) return lessonParam;
    if (progress.lastLessonId && flatLessons.some((l) => l.id === progress.lastLessonId)) return progress.lastLessonId;
    return flatLessons[0].id;
  }, [flatLessons, lessonParam, progress.lastLessonId]);

  const currentIndex = flatLessons.findIndex((l) => l.id === currentLessonId);
  const currentLesson = currentIndex >= 0 ? flatLessons[currentIndex] : null;
  const prevLesson = currentIndex > 0 ? flatLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < flatLessons.length - 1 ? flatLessons[currentIndex + 1] : null;

  useEffect(() => {
    if (!currentLesson) return;
    const wasResuming = !lessonParam && progress.lastLessonId && progress.lastLessonId === currentLesson.id;
    setResumedNotice(Boolean(wasResuming));
    progress.openLesson(currentLesson);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, currentLesson?.id]);

  // Seek video if initial `seek` parameter provided
  useEffect(() => {
    if (seekParam && videoPlayerRef.current) {
      const s = Number(seekParam);
      if (Number.isFinite(s)) {
        setTimeout(() => {
          videoPlayerRef.current?.seekTo(s);
        }, 600);
      }
    }
  }, [seekParam, currentLesson?.id]);

  function goToLesson(lessonId) {
    setNavOpen(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("lesson", lessonId);
      return next;
    });
  }

  function handleJumpToNote(note) {
    if (note.lessonId && note.lessonId !== currentLesson?.id) {
      goToLesson(note.lessonId);
    }
    if (note.timestampSec != null && videoPlayerRef.current) {
      videoPlayerRef.current.seekTo(note.timestampSec);
      window.scrollTo({ top: 100, behavior: "smooth" });
    }
  }

  if (recordingId) {
    return <Navigate to={`/student/live-recording?recording=${encodeURIComponent(recordingId)}`} replace />;
  }

  if (!courseId || !course) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">
        <AlertTriangleIcon className="h-8 w-8 text-danger" />
        <p className="font-display text-lg font-semibold text-text">We couldn't find that course.</p>
        <button
          type="button"
          onClick={() => navigate("/student/dashboard")}
          className="text-sm font-semibold text-primary hover:underline"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (loading) return <LoadingSkeleton />;

  if (!currentLesson) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-24 text-center">
        <p className="font-display text-lg font-semibold text-text">Lesson content isn't available yet.</p>
      </div>
    );
  }

  const completedCount = flatLessons.filter((l) => progress.getLessonState(l.id).status === "completed").length;
  const courseProgressPercent = flatLessons.length ? Math.round((completedCount / flatLessons.length) * 100) : 0;
  const currentState = progress.getLessonState(currentLesson.id);
  const isCourseComplete = !nextLesson && currentState.status === "completed";
  const moduleNumber = currentLesson.moduleIndex + 1;
  const lessonNumberInModule = currentLesson.lessonIndex + 1;

  const notesList = progress.getNotes();
  const currentLessonNotes = notesList.filter((n) => n.lessonId === currentLesson.id);

  const sidebar = (
    <CourseNavSidebar
      course={course}
      curriculum={course.curriculum}
      getLessonState={progress.getLessonState}
      currentLessonId={currentLesson.id}
      courseProgressPercent={courseProgressPercent}
      onSelectLesson={goToLesson}
    />
  );

  const playerTabs = [
    { id: "curriculum", label: "Curriculum", icon: BookOpenIcon, mobileOnly: true },
    { id: "notes", label: `Notes (${currentLessonNotes.length})`, icon: FileTextIcon },
    { id: "transcript", label: "Transcript", icon: FileTextIcon, videoOnly: true },
    { id: "qa", label: `Q&A (${qa.questions?.length || 0})`, icon: ChatIcon },
  ];

  return (
    <div className="student-learning-shell flex h-[calc(100vh-4rem)] min-h-0 flex-col overflow-hidden lg:flex-row">
      {/* Desktop nav rail — independently scrollable, sticky under the navbar */}
      <aside className="hidden h-full w-[320px] shrink-0 overflow-hidden border-r border-text/10 bg-white lg:block">
        {sidebar}
      </aside>

      {/* Mobile nav drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-text/40" onClick={() => setNavOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-sm animate-[fadeScaleIn_200ms_ease-out] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-text/10 px-4 py-3">
              <span className="font-display text-sm font-semibold text-text">Course Contents</span>
              <button type="button" onClick={() => setNavOpen(false)} aria-label="Close" className="text-text/50">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="h-[calc(100%-49px)]">{sidebar}</div>
          </div>
        </div>
      )}

      {/* Main learning area */}
      <div className="flex min-w-0 min-h-0 flex-1">
      <div className="min-w-0 min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 lg:px-10">
        <div className="flex items-center justify-between gap-4 mb-3">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-text/5 px-3 py-1.5 text-xs font-semibold text-text lg:hidden"
          >
            <MenuIcon className="h-4 w-4" /> Course Contents
          </button>
        </div>

        <main className="mx-auto max-w-3xl space-y-6">
          <BackButton fallback="/student/my-learning" label="Back to My Learning" />
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-text/45">
              <span className="truncate">{course.title}</span>
              <ChevronRightIcon className="h-3 w-3 shrink-0" />
              <span className="shrink-0">
                Module {moduleNumber} → Lesson {lessonNumberInModule}
              </span>
            </div>
            <h1 className="mb-5 font-display text-2xl font-bold leading-tight text-text sm:text-3xl">{currentLesson.title}</h1>

            {resumedNotice && (
              <p className="mb-5 inline-block rounded-xl bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary">
                Resumed from where you left off.
              </p>
            )}
          </div>
          {/* Main Media Player / Lesson Viewer */}
          <div>
            {currentLesson.type === "video" && (
              <VideoLessonPlayer
                ref={videoPlayerRef}
                lesson={currentLesson}
                state={currentState}
                onProgress={({ positionSec, percent, deltaSeconds }) =>
                  progress.updateVideoProgress(currentLesson, { positionSec, percent, deltaSeconds })
                }
                onTimeUpdate={(currentTime, duration) => {
                  setCurrentVideoTime(currentTime);
                  setVideoDuration(duration);
                }}
                simulateError={simulateVideoError}
              />
            )}
            {currentLesson.type === "resource" && (
              <ResourceLessonViewer
                lesson={currentLesson}
                moduleTitle={currentLesson.moduleTitle}
                isCompleted={currentState.status === "completed"}
                onMarkComplete={() => progress.markComplete(currentLesson)}
                simulateError={simulateResourceError}
              />
            )}
            {currentLesson.type === "article" && (
              <TextLessonReader
                lesson={currentLesson}
                moduleTitle={currentLesson.moduleTitle}
                isCompleted={currentState.status === "completed"}
                onMarkComplete={() => progress.markComplete(currentLesson)}
              />
            )}
            {["quiz", "assignment", "live"].includes(currentLesson.type) && (
              <OtherLessonCard lesson={currentLesson} courseId={course.id} />
            )}
          </div>

          {/* Player Tab Switcher: Curriculum | Notes | Transcript | Q&A (Spec Section 2) */}
          <div className="rounded-2xl border border-text/10 bg-white p-2">
            <nav className="flex flex-wrap items-center gap-1.5 border-b border-text/10 pb-2 px-2" aria-label="Lesson tabs">
              {playerTabs.map((t) => {
                if (t.mobileOnly && !navOpen) {
                  // We can display Curriculum tab as an option in tab bar too
                }
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors duration-150 ${
                      isActive
                        ? "bg-primary text-white shadow-xs"
                        : "text-text/60 hover:bg-text/5 hover:text-text"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </nav>

            {/* Tab content panels */}
            <div className="pt-3">
              {activeTab === "curriculum" && (
                <div className="p-2">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-text/50">Curriculum</p>
                    <span className="text-xs font-semibold text-primary">{courseProgressPercent}% Completed</span>
                  </div>
                  {sidebar}
                </div>
              )}

              {activeTab === "notes" && (
                <LessonNotesPanel
                  currentLesson={currentLesson}
                  notes={notesList}
                  canTimestamp={currentLesson.type === "video"}
                  currentVideoTime={currentVideoTime}
                  onAddNote={(text, ts) => progress.addNote(currentLesson, text, ts)}
                  onUpdateNote={progress.updateNote}
                  onDeleteNote={progress.deleteNote}
                  onJumpToNote={handleJumpToNote}
                />
              )}

              {activeTab === "transcript" && (
                <TranscriptTab
                  lesson={currentLesson}
                  currentTime={currentVideoTime}
                  duration={videoDuration}
                  onSeek={(sec) => videoPlayerRef.current?.seekTo(sec)}
                />
              )}

              {activeTab === "qa" && (
                <QATab
                  lesson={currentLesson}
                  questions={qa.questions}
                  onAsk={qa.askQuestion}
                  onToggleFollow={qa.toggleFollow}
                />
              )}
            </div>
          </div>

          {/* Bottom Next/Previous Navigation */}
            <LessonNavFooter
              prevLesson={prevLesson}
              nextLesson={nextLesson}
              isCurrentCompleted={currentState.status === "completed"}
              isCourseComplete={isCourseComplete}
              onNavigate={goToLesson}
            />
          </main>

        </div>

          <aside className="hidden h-full min-h-0 w-[300px] shrink-0 overflow-y-auto px-6 py-6 xl:block">
                <section className="rounded-2xl border border-[#eadbd3] bg-[#fbf0ea] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary/65">Keep going</p>
                      <h2 className="mt-1 font-display text-base font-bold text-text">Your course progress</h2>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-primary">{courseProgressPercent}%</span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/80">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${courseProgressPercent}%` }} />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-text/60">
                    {completedCount} of {flatLessons.length} lessons completed. A little progress today adds up.
                  </p>
                </section>

                <section className="rounded-2xl border border-text/10 bg-white p-5 shadow-[0_8px_24px_rgba(23,50,77,0.05)]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text/45">Up next</p>
                  <h2 className="mt-1 font-display text-base font-bold text-text">
                    {nextLesson ? nextLesson.title : "Course complete"}
                  </h2>
                  <p className="mt-2 text-xs leading-5 text-text/55">
                    {nextLesson
                      ? `${nextLesson.moduleTitle} · ${nextLesson.type === "video" ? "Video lesson" : "Learning activity"}`
                      : "You have finished every lesson in this course."}
                  </p>
                  {nextLesson && (
                    <button type="button" onClick={() => goToLesson(nextLesson.id)} className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-primary/90">
                      Continue next lesson
                    </button>
                  )}
                </section>

                <section className="rounded-2xl border border-text/10 bg-white p-5 shadow-[0_8px_24px_rgba(23,50,77,0.05)]">
                  <h2 className="font-display text-base font-bold text-text">Study shortcuts</h2>
                  <div className="mt-3 space-y-2">
                    <button type="button" onClick={() => setActiveTab("notes")} className="flex w-full items-center justify-between rounded-xl bg-[#fffaf7] px-3 py-3 text-left text-xs font-semibold text-text/70 transition hover:bg-primary/5 hover:text-primary">
                      <span>Review my notes</span><span className="text-primary">→</span>
                    </button>
                    <button type="button" onClick={() => setActiveTab("qa")} className="flex w-full items-center justify-between rounded-xl bg-[#fffaf7] px-3 py-3 text-left text-xs font-semibold text-text/70 transition hover:bg-primary/5 hover:text-primary">
                      <span>Ask the course community</span><span className="text-primary">→</span>
                    </button>
                    <button type="button" onClick={() => navigate(`/student/course/${course.id}`)} className="flex w-full items-center justify-between rounded-xl bg-[#fffaf7] px-3 py-3 text-left text-xs font-semibold text-text/70 transition hover:bg-primary/5 hover:text-primary">
                      <span>View course overview</span><span className="text-primary">→</span>
                    </button>
                    <button type="button" onClick={() => navigate(`/student/learninghistory?course=${course.id}`)} className="flex w-full items-center justify-between rounded-xl bg-[#fffaf7] px-3 py-3 text-left text-xs font-semibold text-text/70 transition hover:bg-primary/5 hover:text-primary">
                      <span>View course learning history</span><span className="text-primary">→</span>
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl border border-[#d9e9e5] bg-[#eef7f4] p-5">
                  <p className="text-xs font-bold text-[#28756f]">Learning tip</p>
                  <p className="mt-2 text-xs leading-5 text-text/65">After each lesson, write one takeaway and one question. It makes revision and discussion much easier.</p>
                </section>
          </aside>
      </div>
      </div>
  );
}
