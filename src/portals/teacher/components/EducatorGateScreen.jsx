import { Link } from "react-router-dom";
import Button from "../../../components/ui/Button";
import { AUTH_THEME_VARS, BrandMark } from "../../../auth/components/AuthKit";
import { GATE } from "../utils/onboarding";

const formatDate = (value) => (value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null);

// Full-page screens for an educator who can't use the portal yet. No portal
// navigation, so feature URLs lead here, not to the features.
export default function EducatorGateScreen({ gate, status, error, onRetry, onLogout }) {
  let title;
  let body;
  let action = null;
  if (error && !status) {
    title = "We couldn't check your account";
    body = "Check your connection and try again.";
    action = <Button type="button" variant="ink" fullWidth={false} onClick={onRetry}>Try again</Button>;
  } else if (gate === GATE.PENDING) {
    const submitted = formatDate(status?.submitted_at);
    title = "Pending approval";
    body = (
      <>
        {submitted ? <>We received your application on <strong>{submitted}</strong>. </> : null}
        Our team is reviewing your details and documents. This usually takes a working day or two. You'll get a
        notification as soon as it's done, and this page opens your portal automatically once you're approved.
      </>
    );
  } else if (gate === GATE.CHANGES) {
    title = "Changes requested";
    body = (
      <>
        Our team needs a few changes before approving your application.
        {status?.note && <span className="mt-3 block rounded-2xl bg-(--lp-yellow)/30 p-4 text-left text-text"><strong>Note from the team:</strong> {status.note}</span>}
      </>
    );
    action = <Button as={Link} to="/teacher/onboarding" variant="ink" fullWidth={false}>Edit and resubmit</Button>;
  } else if (gate === GATE.REJECTED) {
    title = "Application not approved";
    body = (
      <>
        Your application wasn't approved this time.
        {status?.note && <span className="mt-3 block rounded-2xl bg-danger/10 p-4 text-left text-text"><strong>Reason:</strong> {status.note}</span>}
        <span className="mt-3 block">You can update your details and apply again.</span>
      </>
    );
    action = <Button as={Link} to="/teacher/onboarding" variant="ink" fullWidth={false}>Update and resubmit</Button>;
  } else if (gate === GATE.SUSPENDED) {
    title = "Your educator account is suspended";
    body = (
      <>
        You can't use the teacher portal right now. Contact support if you think this is a mistake.
        {status?.note && <span className="mt-3 block rounded-2xl bg-danger/10 p-4 text-left text-text"><strong>Reason:</strong> {status.note}</span>}
      </>
    );
  } else {
    title = "One moment";
    body = "Checking your account…";
  }

  return (
    <div style={AUTH_THEME_VARS} className="flex min-h-screen items-center justify-center bg-[#f3f6fd] px-4 py-10 font-body text-text">
      <main className="w-full max-w-lg rounded-[1.75rem] bg-white p-8 text-center shadow-[0_18px_40px_-24px_rgba(15,17,21,0.28)]" aria-labelledby="gate-title">
        <BrandMark className="mx-auto h-14 w-14" />
        <h1 id="gate-title" className="mt-5 font-display text-2xl font-bold">{title}</h1>
        <div className="mt-3 text-sm leading-relaxed text-text/70" role={gate === GATE.PENDING ? "status" : undefined}>{body}</div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {action}
          <Button type="button" variant="social" fullWidth={false} onClick={onLogout}>Log out</Button>
        </div>
      </main>
    </div>
  );
}
