import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import { CheckIcon, ClockIcon } from "../../../components/ui/icons";
import { ASSIGNMENT, getAssignmentState, saveAssignmentDraft, submitAssignment } from "../data/assessmentMock";

const STATUS_STYLE = { Pending: "warning", Graded: "success", Returned: "danger" };

export default function AssignmentSubmit() {
  const navigate = useNavigate();
  const [state, setState] = useState(getAssignmentState);
  const [fileName, setFileName] = useState("");
  const [draftText, setDraftText] = useState("");
  const [notice, setNotice] = useState("");
  const latest = state.submissions[state.submissions.length - 1];
  const canSubmit = ASSIGNMENT.permissions.canSubmit && ASSIGNMENT.permissions.canResubmit;
  const total = ASSIGNMENT.rubric.reduce((sum, criterion) => sum + criterion.earned, 0);

  function saveDraft() {
    if (!draftText.trim()) return;
    setState(saveAssignmentDraft({ text: draftText.trim() }));
    setNotice("Draft saved. It has not been submitted to your educator.");
  }

  function submit() {
    if (!fileName.trim()) {
      setNotice("Add a file name before submitting.");
      return;
    }
    const result = submitAssignment(fileName.trim());
    if (!result.ok) setNotice("Your current permissions do not allow another submission.");
    else {
      setState(result.state);
      setFileName("");
      setNotice("Submission received. Status: Pending.");
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-text/45">Assessment</p><h1 className="mt-2 font-display text-3xl font-bold text-text">{ASSIGNMENT.title}</h1><p className="mt-2 text-sm text-text/60">Due {ASSIGNMENT.dueDate} · Resubmission window until {ASSIGNMENT.resubmissionUntil}</p></div><Button fullWidth={false} variant="secondary" onClick={() => navigate("/student/courseplayer?course=c1&lesson=l9")}>Back to course</Button></div>
      {notice && <div className="mt-5 rounded-2xl bg-primary/5 px-4 py-3 text-sm text-primary">{notice}</div>}
      <div className="mt-7 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <main className="space-y-6">
          <section className="rounded-2xl bg-white p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-text/45">Current status</p><h2 className="mt-2 font-display text-2xl font-bold text-text">{state.late ? "Late submission" : latest?.status || state.status}</h2></div><StatusBadge status={STATUS_STYLE[latest?.status || state.status] || "neutral"}>{state.late ? "Late" : latest?.status || state.status}</StatusBadge></div><p className="mt-4 text-sm text-text/60">Submission permission is determined by the assessment service. This screen does not bypass educator or backend permissions.</p><div className="mt-6 flex items-center gap-3 rounded-2xl bg-text/5 p-4 text-sm"><ClockIcon className="text-text/50" /><span>Allowed file size: {ASSIGNMENT.maxFileSize}</span></div>{canSubmit && <div className="mt-6"><label className="block text-sm font-semibold text-text">Submission file<input value={fileName} onChange={(event) => setFileName(event.target.value)} className="mt-2 w-full rounded-2xl bg-text/5 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="e.g. python-loops-project.zip" /></label><Button className="mt-4" onClick={submit}>Submit version {state.submissions.length + 1}</Button></div>} {!canSubmit && <div className="mt-6 rounded-2xl bg-danger/10 p-4 text-sm text-danger">Resubmission is currently closed by the assessment permissions.</div>}</section>
          <section className="rounded-2xl bg-white p-6 sm:p-8"><h2 className="font-display text-xl font-semibold text-text">Save a draft</h2><p className="mt-1 text-sm text-text/55">Drafts are private and do not change your submission status.</p><textarea value={draftText} onChange={(event) => setDraftText(event.target.value)} className="mt-4 min-h-28 w-full rounded-2xl bg-text/5 p-4 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="Add planning notes or a draft response..." /><Button fullWidth={false} variant="secondary" className="mt-3" onClick={saveDraft}>Save draft</Button></section>
          <section className="rounded-2xl bg-white p-6 sm:p-8"><h2 className="font-display text-xl font-semibold text-text">Submission history</h2><div className="mt-4 space-y-3">{[...state.submissions].reverse().map((submission) => <div key={submission.id} className="rounded-2xl bg-text/5 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-text">Version {submission.version} · {submission.fileName}</p><p className="mt-1 text-xs text-text/50">{submission.submittedAt}</p></div><StatusBadge status={STATUS_STYLE[submission.status] || "neutral"}>{submission.status}</StatusBadge></div>{submission.feedback && <p className="mt-3 text-sm text-text/65">{submission.feedback}</p>}{submission.score != null && <p className="mt-2 text-sm font-semibold text-success">Score: {submission.score}/100</p>}</div>)}</div></section>
        </main>
        <aside className="space-y-6">
          <section className="rounded-2xl bg-rotation-1 p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-text/55">Rubric grade</p><p className="mt-2 font-display text-4xl font-bold text-text">{total}/100</p><p className="mt-1 text-sm text-text/65">Criterion-based grading</p><div className="mt-5 space-y-4">{ASSIGNMENT.rubric.map((criterion) => <div key={criterion.criterion}><div className="flex justify-between text-sm font-semibold text-text"><span>{criterion.criterion}</span><span>{criterion.earned}/{criterion.points}</span></div><div className="mt-2 h-2 rounded-full bg-white/60"><div className="h-full rounded-full bg-primary" style={{ width: `${(criterion.earned / criterion.points) * 100}%` }} /></div><p className="mt-1 text-xs text-text/65">{criterion.feedback}</p></div>)}</div></section>
          <section className="rounded-2xl bg-white p-6"><h2 className="font-display font-semibold text-text">Grade timeline</h2><div className="mt-5 space-y-5">{state.timeline.map((event) => <div key={`${event.label}-${event.date}`} className="flex gap-3"><span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${event.state === "current" ? "bg-warning/20 text-warning" : "bg-success/15 text-success"}`}>{event.state === "current" ? <ClockIcon className="h-3 w-3" /> : <CheckIcon className="h-3 w-3" />}</span><div><p className="text-sm font-semibold text-text">{event.label}</p><p className="mt-1 text-xs text-text/50">{event.date}</p></div></div>)}</div></section>
        </aside>
      </div>
    </div>
  );
}
