// Standalone Privacy Policy page — same shell/role as Terms.jsx. Ties into
// the Data Privacy & Consent Management addition (LMS doc Sec 5.1, Aug 2026):
// the plain-language summary here is what the onboarding Terms step's short
// bullet list links out to for full detail, and what the future Account
// Settings "Privacy & Data" section links to for its retention-policy line.
import LegalPageLayout from "./LegalPageLayout";

const sections = [
  {
    id: "data-we-collect",
    heading: "Data we collect",
    body: (
      <p>
        Profile information (name, age/grade, contact details), course activity and progress,
        assessment and submission records, payment history, and messages/communications you send
        through the platform.
      </p>
    ),
  },
  {
    id: "how-we-use-it",
    heading: "How we use it",
    body: (
      <p>
        To run your account, courses and live classes; to show your progress and certificates; to
        process payments; and, where you've opted in, for product-improvement analytics or marketing
        communications. We don't sell your data.
      </p>
    ),
  },
  {
    id: "minors",
    heading: "Students under 18",
    body: (
      <p>
        For students under 18, a parent or guardian's phone number is collected during onboarding and
        parental awareness is confirmed as part of accepting these terms. Consent-related requests for a
        minor's account (data export, deletion) are handled through that parent contact rather than the
        student acting alone.
      </p>
    ),
  },
  {
    id: "your-choices",
    heading: "Your choices",
    body: (
      <p>
        Optional, non-essential data uses — like product-improvement analytics or marketing
        communications — can be turned on or off any time from Account Settings → Privacy &amp; Data.
        Processing required to operate your account isn't toggleable, and is labeled as such rather than
        hidden.
      </p>
    ),
  },
  {
    id: "export-deletion",
    heading: "Exporting or deleting your data",
    body: (
      <p>
        You can request an export of what we store about you, or request deletion of your account and
        associated data, from Account Settings → Privacy &amp; Data. Both are logged, auditable requests
        — not instant actions — and you'll see their status (pending, completed, or rejected) until
        they're resolved.
      </p>
    ),
  },
  {
    id: "retention",
    heading: "Data retention",
    body: (
      <p>
        We retain account data for as long as your account is active. Inactive-account retention and
        deletion timelines are detailed in Account Settings → Privacy &amp; Data → Data retention.
      </p>
    ),
  },
];

export default function Privacy() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="14 Sep 2026" sections={sections} />
  );
}
