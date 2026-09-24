// Standalone Terms of Service page — linked from the onboarding Terms step,
// the Register/Login footers, and (once it exists) Account Settings.
// Content ownership note (per spec): actual legal copy is supplied by
// legal/compliance, not generated here — this file defines presentation
// only, with short placeholder body copy standing in for the real text.
import LegalPageLayout from "./LegalPageLayout";

const sections = [
  {
    id: "acceptance",
    heading: "Acceptance of terms",
    body: (
      <p>
        By creating an account or using Universal Learning, you agree to these Terms of Service and to
        our Privacy Policy. If you don't agree, please don't use the platform.
      </p>
    ),
  },
  {
    id: "accounts",
    heading: "Accounts & eligibility",
    body: (
      <p>
        You're responsible for keeping your account credentials secure and for the activity on your
        account. Students under 18 may only create an account with a parent or guardian's awareness and
        involvement, as confirmed during onboarding.
      </p>
    ),
  },
  {
    id: "content",
    heading: "Courses & content",
    body: (
      <p>
        Course content on Universal Learning is owned by the educators who created it or licensed to the
        platform. You may access purchased or enrolled content for your own learning; redistributing it
        without permission isn't allowed.
      </p>
    ),
  },
  {
    id: "conduct",
    heading: "Community & academic integrity",
    body: (
      <p>
        Live classes, messages, submissions and reviews should reflect honest, respectful use of the
        platform — no harassment, cheating, or misrepresenting your own work.
      </p>
    ),
  },
  {
    id: "payments",
    heading: "Payments & refunds",
    body: (
      <p>
        Course and session payments are processed securely and confirmed only once payment clears.
        Refund eligibility follows the policy shown at checkout for each purchase.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes to these terms",
    body: (
      <p>
        We may update these Terms from time to time. Material changes will be reflected in the "Last
        updated" date above, and significant changes may be highlighted the next time you sign in.
      </p>
    ),
  },
];

export default function Terms() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="14 Sep 2026" sections={sections} />
  );
}
