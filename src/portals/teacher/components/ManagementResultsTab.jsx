import { useState } from "react";
import Button from "../../../components/ui/Button";
import ResultsUploadPanel from "./ResultsUploadPanel";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import { UploadIcon, CertificateIcon, DownloadFileIcon, TrashIcon, EyeIcon, UsersIcon } from "../../../components/ui/icons";

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-text px-4 py-2.5 text-sm font-medium text-white shadow-lg">{message}</div>
  );
}

const TYPE_TONE = {
  "Term Result": "bg-primary/10 text-primary",
  "Mock Test": "bg-rotation-3/20 text-muted",
  "Practice Series": "bg-rotation-4/20 text-muted",
};

// ManagementResultsTab — Marksheet/Results, deliberately separate from
// the Grading Queue: this is for a consolidated document (a term result,
// a mock-test sheet), published either to everyone enrolled or as one
// file per hand-picked student, never scored inline like an assignment.
export default function ManagementResultsTab({ course }) {
  const { publishResults, removeResults } = useTeacherCourses();
  const [panelOpen, setPanelOpen] = useState(false);
  const [toast, setToast] = useState("");
  const results = course.results || [];

  function flash(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-text">Results history</h2>
          <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5 px-4 py-2 text-sm" onClick={() => setPanelOpen(true)}>
            <UploadIcon className="h-3.5 w-3.5" />
            Upload Marksheet / Results
          </Button>
        </div>

        {results.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl bg-white px-8 py-14 text-center shadow-soft">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-text/[0.06] text-muted">
              <CertificateIcon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-medium text-text">No results uploaded yet</p>
            <p className="mt-1 text-xs text-muted">Publish a term result or mock-test sheet to make it visible on students' dashboards.</p>
            <Button variant="secondary" fullWidth={false} className="mt-4 px-4 py-2 text-xs" onClick={() => setPanelOpen(true)}>
              Upload Marksheet / Results
            </Button>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-text/[0.06] rounded-3xl bg-white shadow-soft">
            {results.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary">
                  <CertificateIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">{r.title}</p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                    <UsersIcon className="h-3 w-3 shrink-0" />
                    {r.scope === "all" ? "All students" : `${r.studentIds.length} student${r.studentIds.length === 1 ? "" : "s"}`} · Published {r.publishedAt}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TYPE_TONE[r.resultType] || "bg-text/[0.06] text-muted"}`}>{r.resultType}</span>
                <button type="button" title="View" className="shrink-0 rounded-full p-1.5 text-muted hover:bg-bg hover:text-primary">
                  <EyeIcon className="h-4 w-4" />
                </button>
                <button type="button" title="Download" className="shrink-0 rounded-full p-1.5 text-muted hover:bg-bg hover:text-primary">
                  <DownloadFileIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Remove"
                  onClick={() => {
                    removeResults(course.id, r.id);
                    flash("Result removed.");
                  }}
                  className="shrink-0 rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <ResultsUploadPanel
        open={panelOpen}
        course={course}
        onClose={() => setPanelOpen(false)}
        onPublish={(item) => {
          publishResults(course.id, item);
          setPanelOpen(false);
          flash("Results published — visible on affected students' dashboards.");
        }}
      />
      <Toast message={toast} />
    </div>
  );
}
