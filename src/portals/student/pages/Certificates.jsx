// Certificate view/download
// Jira: Day 13 — Certificate view/download
// Doc reference: Sec 5.9, 5.10
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import { AwardIcon, DownloadIcon, CheckCircleIcon } from "../../../components/ui/icons";

const EARNED_CERTIFICATES = [
  {
    id: "cert-1",
    courseId: "c1",
    title: "Complete Python Bootcamp",
    instructor: "Priya Sharma",
    issueDate: "September 12, 2026",
    grade: "98% (Excellence)",
    credentialId: "UL-2026-PY-9842",
  },
];

export default function Certificates() {
  const navigate = useNavigate();

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
          My Certificates
        </h1>
        <p className="mt-1 text-sm text-text/60">
          View, download, and share your earned certifications and credentials.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {EARNED_CERTIFICATES.map((cert) => (
          <div
            key={cert.id}
            className="flex flex-col justify-between rounded-3xl border border-text/10 bg-white p-6 shadow-xs transition-all hover:border-primary/30"
          >
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <AwardIcon className="h-6 w-6" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
                  <CheckCircleIcon className="h-3.5 w-3.5" /> Verified
                </span>
              </div>

              <h3 className="font-display text-lg font-bold text-text">{cert.title}</h3>
              <p className="mt-1 text-xs text-text/60">Instructor: {cert.instructor}</p>

              <div className="mt-4 space-y-1.5 border-t border-text/5 pt-3 text-xs text-text/70">
                <p>
                  <span className="font-semibold text-text">Issued:</span> {cert.issueDate}
                </p>
                <p>
                  <span className="font-semibold text-text">Score:</span> {cert.grade}
                </p>
                <p className="font-mono text-[11px] text-text/45">{cert.credentialId}</p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2">
              <Button fullWidth onClick={() => alert("Certificate downloaded successfully.")}>
                <DownloadIcon className="mr-1.5 h-4 w-4" /> Download PDF
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-3xl border border-dashed border-text/15 bg-white p-8 text-center">
        <h3 className="font-display text-base font-bold text-text">Earn more credentials</h3>
        <p className="mt-1 text-xs text-text/60">
          Complete courses and pass final assessments to unlock professional certificates.
        </p>
        <div className="mt-4">
          <Button fullWidth={false} variant="secondary" onClick={() => navigate("/student/explore")}>
            Explore Courses
          </Button>
        </div>
      </div>
    </div>
  );
}
