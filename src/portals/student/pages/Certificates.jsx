// Certificate view/download
// Jira: Day 13 — Certificate view/download
// Doc reference: Sec 5.9, 5.10
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import { AwardIcon, DownloadIcon, CheckCircleIcon, FlameIcon } from "../../../components/ui/icons";
import { useScrollToHash } from "../../../hooks/useScrollToHash";
import { useAuth } from "../../../hooks/useAuth";

const EARNED_CERTIFICATES = [
  {
    id: "cert-1",
    courseId: "c4",
    title: "Guitar for Beginners",
    instructor: "Vikram Rao",
    issueDate: "September 1, 2026",
    grade: "Course requirements completed",
    credentialId: "UL-2026-GT-0004",
  },
];

export default function Certificates() {
  const navigate = useNavigate();
  const [previewCertificate, setPreviewCertificate] = useState(null);
  const { user } = useAuth();
  useScrollToHash();

  // Lightweight badges derived from data this page already has (earned
  // certificates, a streak figure matching Dashboard's) rather than a
  // full badges system — there's no Badges entity/backend yet, so this is
  // an honest preview, not a stand-in for one.
  const badges = [
    { icon: AwardIcon, label: "Course Completion", detail: `${EARNED_CERTIFICATES.length} course${EARNED_CERTIFICATES.length === 1 ? "" : "s"} completed` },
    { icon: FlameIcon, label: "Certificate Earned", detail: `${EARNED_CERTIFICATES[0].title} · ${EARNED_CERTIFICATES[0].issueDate}` },
  ];

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
                  <CheckCircleIcon className="h-3.5 w-3.5" /> Issued
                </span>
              </div>

              <h3 className="font-display text-lg font-bold text-text">{cert.title}</h3>
              <p className="mt-1 text-xs text-text/60">Instructor: {cert.instructor}</p>

              <div className="mt-4 space-y-1.5 border-t border-text/5 pt-3 text-xs text-text/70">
                <p>
                  <span className="font-semibold text-text">Issued:</span> {cert.issueDate}
                </p>
                <p>
                    <span className="font-semibold text-text">Result:</span> {cert.grade}
                </p>
                <p className="font-mono text-[11px] text-text/45">{cert.credentialId}</p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2">
              <Button fullWidth variant="secondary" onClick={() => setPreviewCertificate(cert)}>
                <AwardIcon className="mr-1.5 h-4 w-4" /> Preview Certificate
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div id="badges" className="mt-8 scroll-mt-24 rounded-3xl border border-text/10 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">Badges</p>
        <h2 className="mt-1 font-display text-lg font-bold text-[#17324d]">Your achievements</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {badges.map((badge) => {
            const Icon = badge.icon;
            return (
              <div key={badge.label} className="flex items-start gap-3 rounded-2xl border border-text/10 bg-[#fffaf7] p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-text">{badge.label}</span>
                  <span className="mt-0.5 block text-xs text-text/55">{badge.detail}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {previewCertificate && (
        <div className="certificate-preview-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#17324d]/55 p-4 sm:p-8" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewCertificate(null); }} onKeyDown={(event) => { if (event.key === "Escape") setPreviewCertificate(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="certificate-preview-title" className="certificate-dialog w-full max-w-4xl rounded-3xl border border-white/50 bg-[#fffaf7] p-4 shadow-2xl sm:p-7">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary/70">Certificate preview</p><h2 id="certificate-preview-title" className="mt-1 font-display text-xl font-bold text-text">Review your certificate</h2></div>
              <button type="button" autoFocus onClick={() => setPreviewCertificate(null)} aria-label="Close certificate preview" className="flex h-9 w-9 items-center justify-center rounded-full border border-text/10 bg-white text-lg text-text/60 hover:text-primary">×</button>
            </div>
            <article className="certificate-print-area relative overflow-hidden border-[8px] border-double border-[#bd8b5e] bg-white px-6 py-10 text-center shadow-sm sm:px-12 sm:py-14">
              <div className="pointer-events-none absolute inset-3 border border-[#bd8b5e]/35" />
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Universal Learning</p>
              <AwardIcon className="mx-auto mt-5 h-10 w-10 text-[#bd8b5e]" />
              <h3 className="mt-4 font-display text-3xl font-bold text-[#17324d] sm:text-4xl">Certificate of Completion</h3>
              <p className="mt-5 text-sm text-text/55">This certificate is proudly presented to</p>
              <p className="mt-2 font-display text-2xl font-semibold text-primary">{user?.name || "Student"}</p>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-text/60">for successfully completing</p>
              <p className="mt-1 font-display text-xl font-bold text-[#17324d]">{previewCertificate.title}</p>
              <p className="mt-2 text-sm text-text/55">Instructor: {previewCertificate.instructor}</p>
              <div className="mx-auto mt-8 grid max-w-lg grid-cols-2 gap-4 border-t border-text/10 pt-5 text-left text-xs text-text/60">
                <p><strong className="block text-text">Issue date</strong>{previewCertificate.issueDate}</p>
                <p><strong className="block text-text">Final score</strong>{previewCertificate.grade}</p>
                <p className="col-span-2 text-center font-mono text-[11px]">Credential ID: {previewCertificate.credentialId}</p>
              </div>
              <span className="absolute bottom-4 right-5 text-[9px] font-semibold uppercase tracking-widest text-[#bd8b5e]/70">Verified achievement</span>
            </article>
            <div className="certificate-dialog-actions mt-5 flex flex-wrap justify-end gap-3">
              <Button fullWidth={false} variant="secondary" onClick={() => setPreviewCertificate(null)}>Close preview</Button>
              <Button fullWidth={false} onClick={() => window.print()}><DownloadIcon className="mr-1.5 h-4 w-4" /> Print / Save as PDF</Button>
            </div>
          </section>
          <style>{`@media print { @page { size: landscape; margin: 12mm; } body * { visibility: hidden !important; } .certificate-preview-overlay, .certificate-preview-overlay * { visibility: visible !important; } .certificate-preview-overlay { position: fixed !important; inset: 0 !important; display: block !important; overflow: visible !important; padding: 0 !important; background: white !important; } .certificate-dialog { width: 100% !important; max-width: none !important; border: 0 !important; padding: 0 !important; box-shadow: none !important; background: white !important; } .certificate-dialog > :first-child, .certificate-dialog-actions { display: none !important; } .certificate-print-area { position: fixed !important; inset: 0 !important; display: flex !important; height: 100% !important; flex-direction: column !important; justify-content: center !important; border-width: 8px !important; box-shadow: none !important; } }`}</style>
        </div>
      )}

      <div className="mt-6 rounded-3xl border border-dashed border-text/15 bg-white p-8 text-center">
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
