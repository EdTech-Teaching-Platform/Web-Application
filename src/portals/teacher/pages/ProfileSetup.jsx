// Educator Digital ID Card
// Jira: Day 2 — Profile setup + digital ID card
// Doc reference: Sec 5.1 (User Management & Onboarding — Digital ID Card
// issued once an educator is approved)
//
// This file used to be the post-approval "Profile Setup" form. That form (and
// every one of its fields) has been merged into the single upfront
// registration flow — see Registration.jsx / data/educatorRegistrationData.js —
// so nothing is deferred to "after approval" any more. What remains here is
// the Digital ID Card screen, driven by the educator's verification status:
//   * pending / changes requested / rejected -> provisional card badged
//     "Pending Verification"; Download + Share are unavailable
//   * approved -> the finished "Verified" card with Download + Share
// The route path stays "/teacher/profilesetup" so existing links keep working.
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import { UploadIcon, InfoIcon } from "../../../components/ui/icons";
import DigitalIDCard from "../components/DigitalIDCard";
import IDCardShareModal from "../components/IDCardShareModal";
import {
  useCurrentEducator,
  toIdCardProfile,
  EDUCATOR_STATUS,
  EDUCATOR_STATUS_META,
} from "../data/educatorAccountStore";

function Row({ label, children }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-text">{children || "—"}</dd>
    </div>
  );
}

export default function ProfileSetup() {
  const account = useCurrentEducator();
  const { hash } = useLocation();

  // "View profile" in the header menus links to #profile -- scroll to it
  // (after ScrollToTop's own reset has run).
  useEffect(() => {
    if (hash !== "#profile") return undefined;
    const t = setTimeout(() => document.getElementById("profile")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    return () => clearTimeout(t);
  }, [hash]);
  const [shareOpen, setShareOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!account) return null; // TeacherLayout redirects to /login before this renders

  const profile = toIdCardProfile(account);
  const verified = account.status === EDUCATOR_STATUS.APPROVED;
  const meta = EDUCATOR_STATUS_META[account.status];
  const needsFix = account.status === EDUCATOR_STATUS.CHANGES_REQUESTED || account.status === EDUCATOR_STATUS.REJECTED;

  const handleDownload = () => {
    setDownloading(true);
    // TODO: wire to teacherApi.downloadDigitalIdCard(educatorId) — expected
    // to return a rendered PDF/PNG asset from the backend rather than a
    // client-side DOM screenshot, so the credential stays visually
    // consistent regardless of the viewer's browser/zoom.
    setTimeout(() => setDownloading(false), 900);
  };

  return (
    <div className="relative mx-auto max-w-3xl overflow-hidden px-1 py-2 sm:px-4">
      <div className="mb-5">
        <div className="eyebrow mb-1.5">Educator profile</div>
        <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">Digital ID Card</h1>
      </div>

      <div className="rounded-3xl bg-white px-5 py-5 shadow-soft sm:px-6">
        <div className="grid gap-6 sm:grid-cols-[260px_1fr] sm:items-center">
          <DigitalIDCard profile={profile} maxWidthClass="max-w-[260px]" />

          <div>
            <StatusBadge status={meta.badgeStatus}>{verified ? "Profile live" : meta.label}</StatusBadge>
            <h2 className="mt-1.5 font-display text-base text-text">
              {verified ? "Your Digital ID Card is ready" : "Your Digital ID Card is on hold"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {verified
                ? "This credential confirms your verified educator status on Universal Learning. Click the card to see the verification QR on the back."
                : needsFix
                ? "Update your profile and resubmit — your card becomes a real, shareable credential once an admin approves it."
                : "This is a provisional card. It becomes your real, shareable credential — with a scannable QR and issue date — once our team approves your profile."}
            </p>

            {verified ? (
              <div className="mt-3 flex flex-wrap gap-3">
                <Button
                  shape="rect"
                  fullWidth={false}
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex items-center justify-center gap-2 px-5"
                >
                  <UploadIcon className="h-4 w-4 rotate-180" />
                  {downloading ? "Preparing…" : "Download ID card"}
                </Button>
                <Button shape="rect" fullWidth={false} variant="secondary" className="px-5" onClick={() => setShareOpen(true)}>
                  Share
                </Button>
              </div>
            ) : (
              <div className="mt-3 flex items-start gap-2.5 rounded-2xl bg-pastel-blue px-4 py-3 text-xs text-pastel-blue-ink">
                <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Download and Share unlock after verification.</span>
              </div>
            )}

            {needsFix && (
              <div className="mt-3">
                <Link to="/teacher/registration?resubmit=1">
                  <Button shape="rect" fullWidth={false} variant="secondary" className="px-5">
                    Update &amp; resubmit
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {verified && <IDCardShareModal open={shareOpen} onClose={() => setShareOpen(false)} profile={profile} />}
      </div>

      {/* Read-only summary of the profile submitted at registration. */}
      <section id="profile" className="mt-6 scroll-mt-24 rounded-3xl bg-white px-5 py-5 shadow-soft sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg text-text">Educator profile</h2>
          <StatusBadge status={meta.badgeStatus}>{meta.label}</StatusBadge>
        </div>
        <p className="mt-1 text-xs text-muted">
          {needsFix
            ? "Update these details and resubmit when you're ready."
            : "The details you submitted at registration. Our team reviews them for verification."}
        </p>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Row label="Name">{account.profile.fullName}</Row>
          <Row label="Email">{account.email}</Row>
          <Row label="Phone">{`${account.profile.dialCode ?? ""} ${account.profile.phone ?? ""}`.trim()}</Row>
          <Row label="Location">{[account.profile.city, account.profile.state || account.profile.otherState, account.profile.country].filter(Boolean).join(", ")}</Row>
          <Row label="Headline">{account.profile.headline}</Row>
          <Row label="Qualification">
            {[account.profile.qualification, account.profile.institution].filter(Boolean).join(" — ")}
          </Row>
          <Row label="Teaching experience">{account.profile.experience ? `${account.profile.experience} years` : ""}</Row>
          <Row label="Subjects">
            {[account.profile.primarySubject, ...(account.profile.additionalSubjects ?? [])].filter(Boolean).join(", ")}
          </Row>
          <Row label="Teaching modes">{(account.profile.teachingModes ?? []).join(", ")}</Row>
          <Row label="Languages">{(account.profile.languages ?? []).join(", ")}</Row>
        </dl>
        {account.profile.bio && (
          <p className="mt-4 rounded-2xl bg-bg px-4 py-3 text-sm text-text">{account.profile.bio}</p>
        )}
        {needsFix && (
          <Link to="/teacher/registration?resubmit=1" className="mt-4 inline-block">
            <Button shape="rect" fullWidth={false} className="px-5">
              Edit &amp; resubmit
            </Button>
          </Link>
        )}
      </section>
    </div>
  );
}
