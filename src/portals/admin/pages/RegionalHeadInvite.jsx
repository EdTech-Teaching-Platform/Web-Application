// Regional Head invitation page — what an invitee sees after opening the
// secure link from the (mock) invitation email. Standalone: rendered
// outside the admin layout (no sidebar), mounted at
// /invite/regional-head/:token.
//
// The invitation store is browser-local (see ../data/regionalHeadsMock.js),
// so this only works in the same browser profile as the admin's — fine for
// a demo; a real deployment validates the token on the server.

import { useState } from "react";
import { useParams } from "react-router-dom";
import { useRegionalState, lookupInvitation, respondToInvitation, MOCK_EMAIL_NOTICE } from "../data/regionalHeadsMock";
import "./AdminDashboard.css";
import "./RegionalHeads.css";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function StateCard({ tone, icon, title, text }) {
  return (
    <div className="ul-rhi-state">
      <div className={`ul-rhi-state__icon is-${tone}`}>{icon}</div>
      <h1 className="ul-rhi-title">{title}</h1>
      <p className="ul-rhi-text">{text}</p>
    </div>
  );
}

export default function RegionalHeadInvite() {
  const { token } = useParams();
  useRegionalState(); // re-render if the invitation changes in another tab
  const found = lookupInvitation(token);
  const inv = found.invitation;

  const [step, setStep] = useState("review"); // review | onboarding | decline
  const [form, setForm] = useState({ phone: "", qualification: "", years: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(null); // "accepted" | "rejected"

  const submitAccept = (e) => {
    e.preventDefault();
    if (!form.phone.trim() || !form.qualification.trim()) {
      setError("Phone number and qualification are required.");
      return;
    }
    const res = respondToInvitation(token, "accept", form);
    if (!res.ok) {
      setError(
        res.reason === "region_taken"
          ? "Sorry — this region has since been assigned to another Regional Head."
          : res.reason === "validation"
            ? "Please complete all required fields."
            : "This invitation can no longer be accepted."
      );
      return;
    }
    setDone("accepted");
  };

  const submitDecline = () => {
    const res = respondToInvitation(token, "reject");
    if (!res.ok) {
      setError("This invitation can no longer be declined.");
      return;
    }
    setDone("rejected");
  };

  let body;
  if (done === "accepted") {
    body = (
      <StateCard
        tone="ok"
        icon="✓"
        title="Welcome aboard!"
        text={`You're now the Regional Head for the ${inv.region}. Your onboarding is complete and the Universal Learning admin team has been notified.`}
      />
    );
  } else if (done === "rejected") {
    body = (
      <StateCard tone="warn" icon="–" title="Invitation declined" text="Thanks for letting us know. The admin team has been notified and no changes were made." />
    );
  } else if (found.state === "invalid") {
    body = <StateCard tone="bad" icon="!" title="Invalid invitation link" text="This link isn't valid. Check that you copied the whole link from your email, or ask the admin team for a new invitation." />;
  } else if (found.state === "expired") {
    body = <StateCard tone="warn" icon="!" title="This invitation has expired" text="The link was only valid for 7 days. Please ask the admin team to resend your invitation." />;
  } else if (found.state === "revoked") {
    body = <StateCard tone="bad" icon="!" title="Invitation withdrawn" text="The admin team has withdrawn this invitation. Please contact them if you think this is a mistake." />;
  } else if (found.state === "used") {
    body = (
      <StateCard
        tone="warn"
        icon="!"
        title="Link already used"
        text={`This invitation was already ${inv.status === "accepted" ? "accepted" : "declined"}. Each link can only be used once.`}
      />
    );
  } else {
    body = (
      <>
        <h1 className="ul-rhi-title">You're invited to be a Regional Head</h1>
        <p className="ul-rhi-text">
          Hi {inv.name}, the Universal Learning admin team would like you to serve as Regional Head. Review the details below and choose to accept or decline.
        </p>
        <dl className="ul-rhi-facts">
          <dt>Region</dt>
          <dd>{inv.region}</dd>
          <dt>Invited as</dt>
          <dd>{inv.email}</dd>
          <dt>Invited by</dt>
          <dd>{inv.invitedBy}</dd>
          <dt>Link expires</dt>
          <dd>{fmtDate(inv.expiresAt)}</dd>
        </dl>

        {step === "review" && (
          <div className="ul-rhi-actions">
            <button type="button" className="ul-btn ul-btn--ghost" onClick={() => { setError(""); setStep("decline"); }}>Decline</button>
            <button type="button" className="ul-btn ul-btn--primary" onClick={() => { setError(""); setStep("onboarding"); }}>Accept &amp; continue</button>
          </div>
        )}

        {step === "onboarding" && (
          <form onSubmit={submitAccept}>
            <p className="ul-rhi-text">Complete your onboarding to activate the role.</p>
            <div className="ul-rhi-form">
              <div className="ul-rhi-field">
                <label>Phone number *</label>
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
              </div>
              <div className="ul-rhi-field">
                <label>Highest qualification *</label>
                <input value={form.qualification} onChange={(e) => setForm((f) => ({ ...f, qualification: e.target.value }))} placeholder="e.g. M.Ed., Delhi University" />
              </div>
              <div className="ul-rhi-field">
                <label>Years of experience</label>
                <input type="number" min="0" value={form.years} onChange={(e) => setForm((f) => ({ ...f, years: e.target.value }))} />
              </div>
            </div>
            {error && <p className="ul-rh-error">{error}</p>}
            <div className="ul-rhi-actions">
              <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setStep("review")}>Back</button>
              <button type="submit" className="ul-btn ul-btn--primary">Accept invitation</button>
            </div>
          </form>
        )}

        {step === "decline" && (
          <>
            <p className="ul-rhi-text">Decline this invitation? The admin team will be notified and the link will stop working.</p>
            {error && <p className="ul-rh-error">{error}</p>}
            <div className="ul-rhi-actions">
              <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setStep("review")}>Back</button>
              <button type="button" className="ul-btn ul-btn--danger" onClick={submitDecline}>Yes, decline</button>
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <div className="ul-rhi-page">
      <div className="ul-rhi-card">
        <div className="ul-rhi-brand">Universal Learning</div>
        {body}
        <p className="ul-rhi-mock">{MOCK_EMAIL_NOTICE.replace("Use the secure link to test acceptance.", "This is a demo flow.")}</p>
      </div>
    </div>
  );
}
