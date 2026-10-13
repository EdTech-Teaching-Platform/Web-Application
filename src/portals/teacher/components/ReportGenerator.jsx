// ReportGenerator — Analytics hub Part 6: build/preview/generate exportable
// reports. Entirely local, simulated state (same "simulate the async step,
// then show success" pattern PayoutRequestPanel already uses
// elsewhere in this portal) — there's no real backend to export from yet.
// The live preview and Report History counts are still pulled from the
// same real derived data as the rest of Analytics, never invented figures.
import { useMemo, useState } from "react";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import { FileGenericIcon, DownloadIcon, ChartIcon, CheckIcon, ClockIcon } from "../../../components/ui/icons";
import {
  ANALYTICS_RANGES,
  heroStats,
  courseComparisonRows,
  engagementFunnel,
  quizAnalytics,
  gradingTurnaround,
  revenueEfficiency,
  formatUsd,
} from "../data/analyticsData";
import Select from "../../../components/ui/Select";

const REPORT_TYPES = [
  { key: "course-performance", label: "Course Performance Summary" },
  { key: "student-engagement", label: "Student Engagement Summary" },
  { key: "assessment", label: "Assessment Summary" },
  { key: "full-portfolio", label: "Full Portfolio Overview" },
];

const FORMATS = ["PDF", "CSV"];

function seedHistory() {
  return [
    {
      id: "rep-seed-1",
      name: "Full Portfolio Overview — August 2026",
      type: "Full Portfolio Overview",
      format: "PDF",
      range: "6M",
      generatedAt: "2026-09-02",
    },
  ];
}

function ReportPreview({ typeKey, courses, range }) {
  const stats = useMemo(() => heroStats(courses, range), [courses, range]);
  const rows = useMemo(() => courseComparisonRows(courses), [courses]);
  const funnel = useMemo(() => engagementFunnel(courses), [courses]);
  const quiz = useMemo(() => quizAnalytics(courses), [courses]);
  const turnaround = useMemo(() => gradingTurnaround(courses), [courses]);
  const efficiency = useMemo(() => revenueEfficiency(courses), [courses]);

  const sections = [];

  if (typeKey === "course-performance" || typeKey === "full-portfolio") {
    sections.push({
      title: "Course Performance",
      lines: rows.slice(0, 5).map((r) => `${r.title} — ${r.enrollments} enrolled, ${r.completionRate}% completion, ${formatUsd(r.revenue)}`),
    });
  }
  if (typeKey === "student-engagement" || typeKey === "full-portfolio") {
    sections.push({
      title: "Student Engagement",
      lines: [
        `${stats.totalStudents} total students reached, ${stats.completionRate}% overall completion rate`,
        ...funnel.map((f) => `${f.label}: ${f.count} (${f.pctOfStart}%)`),
      ],
    });
  }
  if (typeKey === "assessment" || typeKey === "full-portfolio") {
    sections.push({
      title: "Assessment & Quizzes",
      lines: [
        quiz.totalQuestions ? `Avg. quiz score ${quiz.avgScore}%, pass rate ${quiz.passRate}%` : "No quiz data recorded yet",
        turnaround.sampleSize ? `Avg. grading turnaround: ${turnaround.avgTurnaround} days across ${turnaround.sampleSize} graded submissions` : "No graded assignments yet",
      ],
    });
  }
  if (typeKey === "full-portfolio") {
    sections.push({
      title: "Revenue",
      lines: [`${formatUsd(efficiency.totalRevenue)} lifetime revenue, ${formatUsd(efficiency.perStudent)} per student, ${formatUsd(efficiency.perCourse)} per course`],
    });
  }

  return (
    <div className="rounded-xl border border-dashed border-text/15 bg-bg p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Live preview</p>
      <div className="flex flex-col gap-4">
        {sections.map((s) => (
          <div key={s.title}>
            <p className="text-sm font-semibold text-text">{s.title}</p>
            <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted">
              {s.lines.map((l, i) => (
                <li key={i} className="truncate">• {l}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReportGenerator({ courses, range }) {
  const [typeKey, setTypeKey] = useState(REPORT_TYPES[0].key);
  const [reportRange, setReportRange] = useState(range || "6M");
  const [format, setFormat] = useState("PDF");
  const [status, setStatus] = useState("idle"); // idle | processing | success
  const [history, setHistory] = useState(seedHistory);
  const [lastGenerated, setLastGenerated] = useState(null);

  function handleGenerate() {
    setStatus("processing");
    window.setTimeout(() => {
      const typeLabel = REPORT_TYPES.find((t) => t.key === typeKey)?.label;
      const entry = {
        id: `rep-${Date.now()}`,
        name: `${typeLabel} — ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
        type: typeLabel,
        format,
        range: reportRange,
        generatedAt: new Date().toISOString().slice(0, 10),
      };
      setHistory((prev) => [entry, ...prev]);
      setLastGenerated(entry);
      setStatus("success");
    }, 1600);
  }

  function handleDownload(entry) {
    window.alert(`Simulated download: "${entry.name}.${entry.format.toLowerCase()}" — this is a UI prototype, no real file is produced.`);
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-3xl bg-white p-5 sm:p-6 shadow-soft">
        <h2 className="text-base font-bold text-text">Generate a report</h2>
        <p className="mt-0.5 text-xs text-muted">Choose what to include — the preview below updates as you change these.</p>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Report type</label>
              <Select
                wrapperClassName="block w-full"
                value={typeKey}
                onChange={(e) => setTypeKey(e.target.value)}
                className="w-full rounded-full border border-text/15 bg-white px-4 py-2.5 pr-9 text-sm font-medium text-text outline-none focus:border-primary/40"
              >
                {REPORT_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Date range</label>
              <div className="flex rounded-full bg-bg p-1 text-xs font-semibold">
                {ANALYTICS_RANGES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReportRange(r)}
                    className={`flex-1 rounded-full px-3 py-2 transition-all duration-150 ${
                      reportRange === r ? "bg-primary text-white" : "text-muted hover:text-text"
                    } hover:-translate-y-0.5 hover:shadow-soft`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Format</label>
              <div className="flex gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`rounded-full border px-5 py-2 text-sm font-medium transition-all duration-150 ${
                      format === f ? "border-primary bg-primary text-white" : "border-primary bg-bg text-primary hover:bg-primary/5"
                    } hover:-translate-y-0.5 hover:shadow-soft`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {status !== "success" ? (
              <Button
                variant="primary"
                fullWidth={false}
                disabled={status === "processing"}
                className="mt-2 flex items-center justify-center gap-2 px-6"
                onClick={handleGenerate}
              >
                {status === "processing" ? (
                  <>
                    <ClockIcon className="h-4 w-4 animate-pulse" />
                    Generating report…
                  </>
                ) : (
                  <>
                    <ChartIcon className="h-4 w-4" />
                    Generate Report
                  </>
                )}
              </Button>
            ) : (
              <div className="mt-2 flex flex-col gap-2 rounded-xl bg-success/[0.08] p-4">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-success">
                  <CheckIcon className="h-4 w-4" />
                  Report ready
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="primary" fullWidth={false} className="flex items-center gap-1.5 px-4 py-2 text-xs" onClick={() => handleDownload(lastGenerated)}>
                    <DownloadIcon className="h-3.5 w-3.5" />
                    Download
                  </Button>
                  <Button variant="secondary" fullWidth={false} className="px-4 py-2 text-xs" onClick={() => setStatus("idle")}>
                    Generate another
                  </Button>
                </div>
              </div>
            )}
          </div>

          <ReportPreview typeKey={typeKey} courses={courses} range={reportRange} />
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 sm:p-6 shadow-soft">
        <h2 className="text-base font-bold text-text">Report history</h2>
        {history.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <FileGenericIcon className="h-8 w-8 text-text/20" />
            <p className="mt-3 text-sm text-muted">No reports generated yet</p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col divide-y divide-text/[0.06]">
            {history.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/[0.08] text-primary">
                    <FileGenericIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">{r.name}</p>
                    <p className="text-xs text-muted">{r.generatedAt} · {r.range}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status="neutral" showIcon={false} size="sm">{r.format}</StatusBadge>
                  <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5 px-3 py-1.5 text-xs" onClick={() => handleDownload(r)}>
                    <DownloadIcon className="h-3.5 w-3.5" />
                    Re-download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
