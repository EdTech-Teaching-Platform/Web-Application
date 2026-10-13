// ======================================================================
// Performance tab of the series detail view (Part 7): the full per-series
// student-performance dashboard. Data comes from the deterministic generator in
// data/testSeriesPerformanceData.js (no backend yet), aggregated by
// testSeriesPerformanceStats.js; the UI pieces live in ./performance/.
// Props are unchanged (`series`) so TestSeriesDetail needs no edits.
// ======================================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTestSeries } from "../../../context/TestSeriesContext";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import EmptyState from "../../../components/ui/EmptyState";
import Button from "../../../components/ui/Button";
import { ChartIcon, QuizIcon } from "../../../components/ui/icons";
import { isLive, seriesPerformanceSummary } from "../data/testSeriesData";
import { MOCK_TODAY_ISO } from "../data/testSeriesDeadlines";
import { buildRoster } from "../data/studentDirectory";
import { generateSeriesPerformance, seriesHasAttempts } from "../data/testSeriesPerformanceData";
import { computeReport, DEFAULT_FILTERS } from "../data/testSeriesPerformanceStats";
import { buildInsights } from "../data/testSeriesPerformanceInsights";
import { buildPerformanceFile } from "../data/testSeriesPerformanceExport";
import { downloadBlob } from "../data/spreadsheetExport";
import PerformanceFilters, { ExportModal, filterSummary } from "./performance/PerformanceFilters";
import KpiRow from "./performance/KpiRow";
import ScoreDistribution from "./performance/ScoreDistribution";
import PerformanceTrendChart from "./performance/PerformanceTrendChart";
import Leaderboard from "./performance/Leaderboard";
import StudentTable from "./performance/StudentTable";
import StudentDrawer from "./performance/StudentDrawer";
import SectionTopicAnalytics from "./performance/SectionTopicAnalytics";
import QuestionAnalytics from "./performance/QuestionAnalytics";
import EngagementIntegrity from "./performance/EngagementIntegrity";
import InsightsPanel from "./performance/InsightsPanel";
import PerformanceSkeleton from "./performance/PerformanceSkeleton";

const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

function scrollToId(id) {
  const el = typeof document !== "undefined" ? document.getElementById(id) : null;
  if (!el) return;
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

export default function TestSeriesPerformanceTab({ series }) {
  // Remount per series so filters, selection and the drawer never leak between series.
  return <PerformanceDashboard key={series.id} series={series} />;
}

function PerformanceDashboard({ series }) {
  const navigate = useNavigate();
  const { series: allSeries, currentTeacher, submissions } = useTestSeries();
  const { courses } = useTeacherCourses();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(typeof window !== "undefined");
  const [openStudent, setOpenStudent] = useState(null);
  const [openQuestion, setOpenQuestion] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [toast, setToast] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const t = window.setTimeout(() => setLoading(false), 450);
    return () => { mounted.current = false; window.clearTimeout(t); };
  }, []);

  const live = isLive(series) || series.status === "archived";
  const perf = useMemo(() => generateSeriesPerformance(series), [series]);
  const roster = useMemo(() => buildRoster(courses), [courses]);
  const rosterKeys = useMemo(() => new Set(roster.map((r) => r.key)), [roster]);
  const courseMembers = useMemo(() => {
    const out = {};
    roster.forEach((r) => r.enrollments.forEach((e) => { (out[e.courseId] = out[e.courseId] || []).push(r.key); }));
    return out;
  }, [roster]);
  const courseOptions = useMemo(() => {
    if (!perf) return [];
    const keys = new Set(perf.students.map((s) => s.key));
    return courses.filter((c) => (courseMembers[c.id] || []).some((k) => keys.has(k))).map((c) => ({ id: c.id, title: c.title }));
  }, [perf, courses, courseMembers]);
  const seriesOptions = useMemo(() => allSeries.filter((s) => s.teacherId === currentTeacher?.id && (seriesHasAttempts(s) || s.id === series.id)), [allSeries, currentTeacher, series.id]);
  const report = useMemo(() => (perf ? computeReport(perf, filters, { courseMembers }) : null), [perf, filters, courseMembers]);
  const insights = useMemo(() => (report ? buildInsights(report, series) : []), [report, series]);
  const pendingGrading = seriesPerformanceSummary(series, submissions).pendingGrading;

  function flash(message) {
    setToast(message);
    window.setTimeout(() => mounted.current && setToast(""), 3200);
  }

  function announce(keys, subject) {
    const studentIds = Array.from(new Set(keys)).filter((k) => rosterKeys.has(k));
    if (!studentIds.length) {
      flash("None of these students are on a course roster yet, so they can't be added to an announcement.");
      return;
    }
    // seriesIds is deliberately omitted: Messaging would widen the audience to every series enrolee.
    navigate("/teacher/messaging", { state: { composePrefill: { studentIds, source: "test-series-performance", subject } } });
  }

  function onInsightAction(action) {
    if (action.kind === "announce") announce(action.keys, action.subject);
    else if (action.kind === "question") { setOpenQuestion(action.qid); scrollToId("perf-questions"); }
    else if (action.kind === "scroll") scrollToId(action.target);
  }

  async function doExport(format) {
    if (!report) return;
    setExportError("");
    setExporting(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      const { blob, ext } = buildPerformanceFile(report, perf, filters, format);
      const name = `test-series-performance-${slug(series.title)}-${MOCK_TODAY_ISO}.${ext}`;
      downloadBlob(blob, name);
      if (!mounted.current) return;
      setExportOpen(false);
      flash(`Exported ${name}`);
    } catch (err) {
      if (mounted.current) setExportError(err?.message ? `Couldn't generate the file: ${err.message}` : "Couldn't generate the file.");
    } finally {
      if (mounted.current) setExporting(false);
    }
  }

  function switchSeries(id) {
    if (id !== series.id) navigate(`/teacher/testseries/${id}/detail?tab=performance`);
  }

  if (!live) {
    return (
      <EmptyState icon={ChartIcon} heading="Performance appears once students start" message="Publish this series and you'll see enrolments, scores, rankings and question analytics here." />
    );
  }

  const filterBar = (disabled) => (
    <PerformanceFilters
      filters={filters} onChange={setFilters} tests={perf?.tests || []} today={perf?.today || MOCK_TODAY_ISO}
      seriesOptions={seriesOptions} seriesId={series.id} onSeries={switchSeries} courseOptions={courseOptions}
      onExport={() => { setExportError(""); setExportOpen(true); }} disabled={disabled}
    />
  );

  if (!perf) {
    return (
      <div className="flex flex-col gap-6" data-slot="series-performance">
        {filterBar(true)}
        <EmptyState
          icon={QuizIcon} heading="No attempts to analyse yet"
          message={series.enrollments > 0 ? "Students are enrolled but nobody has attempted a test yet. Scores, rankings and question analytics will appear here after the first submissions." : "Nobody has enrolled yet. Once students join and attempt a test, their scores and rankings appear here."}
          action={pendingGrading > 0 ? <NavLink to="/teacher/grading" className="text-sm font-semibold text-primary hover:underline">Open grading queue</NavLink> : null}
        />
      </div>
    );
  }

  if (loading) return <PerformanceSkeleton />;

  return (
    <div className="flex flex-col gap-6" data-slot="series-performance">
      {filterBar(false)}

      {pendingGrading > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-pastel-orange px-5 py-3 text-sm text-pastel-orange-ink">
          <span>{pendingGrading} written answer{pendingGrading === 1 ? "" : "s"} in this series still need grading.</span>
          <NavLink to="/teacher/grading" className="font-semibold underline">Open grading queue</NavLink>
        </div>
      )}

      {report.empty ? (
        <EmptyState icon={ChartIcon} heading="No attempts match these filters" message="Widen the date range, pick another test or cohort, or reset the filters." action={<Button fullWidth={false} className="px-6" onClick={() => setFilters(DEFAULT_FILTERS)}>Reset filters</Button>} />
      ) : (
        <>
          <KpiRow kpi={report.kpi} spark={report.spark} trackedNote={`Sample view of ${perf.trackedCount} tracked learners (this series has ${perf.enrolledTotal.toLocaleString()} enrolments overall).`} />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ScoreDistribution bins={report.bins} curve={report.percentileCurve} passPct={report.passPct} total={report.scored.length} />
            <PerformanceTrendChart perTest={report.perTest} />
          </div>
          <Leaderboard students={report.students} onOpen={setOpenStudent} />
          <StudentTable students={report.students} tests={report.scope.tests} onOpen={setOpenStudent} onAnnounce={announce} rosterKeys={rosterKeys} />
          <SectionTopicAnalytics sections={report.sections} topics={report.topics} />
          <QuestionAnalytics questions={report.questions} openId={openQuestion} onOpenId={setOpenQuestion} />
          <EngagementIntegrity eng={report.engagement} onOpen={setOpenStudent} />
          <InsightsPanel insights={insights} onAction={onInsightAction} rosterKeys={rosterKeys} />
        </>
      )}

      <StudentDrawer studentKey={openStudent} report={report} onClose={() => setOpenStudent(null)} onAnnounce={announce} onRoster={(k) => rosterKeys.has(k)} />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} summary={filterSummary(filters, perf.tests, courseOptions)} rowCount={report?.students.length || 0} onExport={doExport} busy={exporting} error={exportError} />
      {toast && <div role="status" className="fixed bottom-6 left-1/2 z-[60] max-w-sm -translate-x-1/2 rounded-2xl bg-text px-5 py-3 text-sm text-white shadow-elevated">{toast}</div>}
    </div>
  );
}
