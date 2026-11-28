// /student/answer-sheet/:attemptId: step 2 of a test with written questions
// (QA 22 Nov flow, 20261128090000). The test is finished (answers locked);
// the student now has the test's upload time (default 5 minutes) to upload a
// PDF or photos of the handwritten answers, then presses Submit. When the
// countdown ends the sheet is submitted automatically with what's uploaded.
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import { ErrorState, LoadingState, PAGE } from "../components/PageState";
import AnswerUploader from "../components/AnswerUploader";
import { sheetUploadsApi } from "../../../services/answerUploadsApi";
import { formatCountdown, useServerCountdown } from "../hooks/useServerCountdown";

export default function AnswerSheet({ api = sheetUploadsApi }) {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const autoSent = useRef(false);

  useEffect(() => {
    let alive = true;
    api.status(attemptId).then((s) => { if (alive) setStatus(s); }).catch((e) => { if (alive) setError(e); });
    return () => { alive = false; };
  }, [api, attemptId]);

  const msLeft = useServerCountdown(status?.canUpload ? status.windowClosesAt : null, status?.serverNow);

  const submit = useCallback(async (auto = false) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.submit(attemptId);
    } catch { /* the window closes on the server anyway; the report explains */ }
    navigate(`/student/report/${attemptId}`, { replace: true, state: { sheet: auto ? "auto" : "submitted" } });
  }, [api, attemptId, navigate, submitting]);

  // Time's up: submit with whatever is uploaded.
  useEffect(() => {
    if (msLeft === 0 && status?.canUpload && !autoSent.current) {
      autoSent.current = true;
      submit(true);
    }
  }, [msLeft, status, submit]);

  // Leaving the page while it's open loses nothing (files are saved), but warn.
  useEffect(() => {
    if (!status?.canUpload) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status?.canUpload]);

  if (error) return <div className={PAGE}><ErrorState error={error} title="Couldn't open the answer sheet" /></div>;
  if (!status) return <div className={PAGE}><LoadingState label="Opening the answer sheet" /></div>;
  if (status.status === "in_progress") return <Navigate to={`/student/test/${status.testId}/take`} replace />;
  if (!status.canUpload) return <Navigate to={`/student/report/${attemptId}`} replace />;

  const files = status.files || [];
  const low = msLeft != null && msLeft <= 60000;
  return (
    <div className={PAGE}>
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-3xl bg-white p-6 ring-1 ring-text/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Step 2 of 2</p>
              <h1 className="mt-1 font-display text-2xl font-bold text-text">Upload your answer sheet</h1>
            </div>
            <span role="timer" aria-label={`${formatCountdown(msLeft)} left`}
              className={`rounded-full px-4 py-1.5 font-mono text-lg font-semibold ${low ? "bg-danger/15 text-danger" : "bg-bg text-text ring-1 ring-text/10"}`}>
              {formatCountdown(msLeft)}
            </span>
          </div>
          <p className="mt-3 text-sm text-text/70">
            Your test answers are saved and can't be changed. You have {status.graceMinutes} minute{status.graceMinutes === 1 ? "" : "s"} to
            upload what you wrote on paper: one PDF, or a clear photo of each page (up to {status.maxFiles} files). Then press Submit.
            When the time ends, your answer sheet is submitted automatically with what you've uploaded.
          </p>
          {low && <p className="sr-only" aria-live="assertive">Less than a minute left</p>}
        </header>

        <AnswerUploader
          attemptId={attemptId} questionId={null} files={files} canUpload={!submitting} canRemove={!submitting}
          maxFiles={status.maxFiles} api={api} onChange={setStatus} label="Your answer sheet" onBusyChange={setUploading}
          hint="Upload one PDF of all your written answers, or photos of each page. Write the question number next to each answer."
        />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-5 ring-1 ring-text/10">
          <p id="sheet-submit-note" className="text-sm text-text/70">
            {uploading ? "Wait for the upload to finish." : files.length ? `${files.length} file${files.length === 1 ? "" : "s"} ready.` : "Upload your answer sheet to submit."}
          </p>
          {/* QA 28 Nov: Submit stays disabled until at least one file has finished uploading. */}
          <Button fullWidth={false} disabled={submitting || uploading || files.length === 0} aria-describedby="sheet-submit-note" onClick={() => setConfirming(true)}>
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </div>

      <Modal
        open={confirming && !submitting && files.length > 0 && !uploading}
        onClose={() => setConfirming(false)}
        title="Submit your answer sheet?"
        footer={
          <>
            <Button onClick={() => { setConfirming(false); submit(false); }}>Submit</Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>Keep uploading</Button>
          </>
        }
      >
        <p className="text-sm text-text/70">
          {`You're submitting ${files.length} file${files.length === 1 ? "" : "s"}. After this you can't add or remove anything.`}
        </p>
      </Modal>
    </div>
  );
}
