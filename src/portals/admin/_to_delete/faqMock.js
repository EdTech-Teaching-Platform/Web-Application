// Admin FAQs / Internal Knowledge Base — mock data.
// Its own section (separate from Support Request / Help Desk), reached
// via AdminSidebar's "FAQs" link and AdminTopbar's FAQs shortcut.
//
// An internal admin knowledge base, not a customer-facing help page —
// the questions Admin staff themselves ask while working tickets,
// refunds, approvals and compliance, framed as SOP-style guidance
// grounded in this platform's actual governance rules and the
// other Admin screens already built (role/module access from Settings &
// Permissions, approval gates from Course Approval, audit logging from
// Audit Logs, accreditation from Regional Growth & Compliance, etc.).
// Read-only reference content for now.

export const FAQ_CATEGORIES = [
  "Ticket Handling",
  "Refunds & Billing",
  "Verification & Approvals",
  "Certificates & Compliance",
  "Account Actions",
  "Escalations & Audit",
];

export const FAQS = [
  {
    id: "FAQ-01", category: "Ticket Handling",
    question: "What's the expected first-response time on a new ticket?",
    answer: "Urgent-priority tickets (account lockouts, live-class-blocking issues) should get a first reply within 30 minutes; High within 2 hours; Medium/Low within one business day. If you can't hit that window, reassign the ticket rather than let it sit — an unattended Urgent ticket is exactly what the \"Urgent & Open\" stat card on the Support Request screen is meant to surface.",
  },
  {
    id: "FAQ-02", category: "Ticket Handling",
    question: "A ticket has multiple issues bundled into one message — what do I do?",
    answer: "Handle the most urgent issue in your reply and note in the thread that the rest will be split. Ask the requester to raise separate tickets for unrelated issues (e.g. a billing question tacked onto a technical bug) so each one gets routed to the right team and tracked against the right category.",
  },
  {
    id: "FAQ-03", category: "Ticket Handling",
    question: "When should I mark a ticket Resolved vs Closed?",
    answer: "Resolved means the fix is confirmed and you're giving the requester a window to reply if the issue recurs. Closed means the thread is done — either the requester confirmed it, or enough time has passed with no response. Don't jump straight to Closed on a first reply; that skips the confirmation step the requester expects.",
  },
  {
    id: "FAQ-04", category: "Ticket Handling",
    question: "The requester hasn't replied in several days — can I close it?",
    answer: "Yes. Send one follow-up reply asking if the issue is resolved, then if there's no response after a reasonable window (a few business days), move it to Resolved with a note like \"No response after follow-up — assuming resolved.\" Don't leave it sitting in In Progress indefinitely; that skews the queue's real backlog.",
  },
  {
    id: "FAQ-05", category: "Refunds & Billing",
    question: "Is there a limit on the refund amount I can approve?",
    answer: "No — Admin has full authority to approve or reject refunds of any amount (see the Payments & Refunds row in Settings & Permissions). There's no escalation step; just make sure you've verified the transaction first (see FAQ-06) before approving.",
  },
  {
    id: "FAQ-06", category: "Refunds & Billing",
    question: "How do I confirm a payment actually went through before processing a refund?",
    answer: "Cross-check the transaction ID the requester gives you against Payment Oversight / Financial Analytics — payment status there is driven by the provider's own webhook confirmation, never a client-side claim. Don't refund based solely on a screenshot or the requester's word; verify the transaction's real status first.",
  },
  {
    id: "FAQ-07", category: "Refunds & Billing",
    question: "A student reports being charged twice — is that usually a real double charge?",
    answer: "Almost always no — it's a duplicate webhook retry from the payment provider, not a genuine second purchase. Check Financial Analytics for two transactions with the same amount seconds/minutes apart; if confirmed, reverse the duplicate rather than opening a full refund case.",
  },
  {
    id: "FAQ-08", category: "Refunds & Billing",
    question: "An educator says their payout is stuck in \"Processing\" — what should I check first?",
    answer: "Payouts follow requested → approved → processing → paid; a payout can sit in Processing pending a bank-verification step on the educator's account. Check the payout's status in Payment Oversight before promising a timeline — most clear within 5–7 business days of approval.",
  },
  {
    id: "FAQ-09", category: "Verification & Approvals",
    question: "What do I check before approving an educator's verification?",
    answer: "Confirm identity documents are genuine and match the profile, qualifications are relevant to the subjects they want to teach, and there's nothing outstanding in a prior rejection note. An educator can't publish courses or host live classes until verification is approved — don't rush it just to clear the queue.",
  },
  {
    id: "FAQ-10", category: "Verification & Approvals",
    question: "Why can't an educator publish their own course directly?",
    answer: "Course publishing is gated at the data layer — draft → pending review → published only happens after Admin approval, by design, so there's always a quality/compliance checkpoint before a course goes live. If an educator is asking why their course is \"stuck,\" check Course Approval rather than treating it as a bug.",
  },
  {
    id: "FAQ-11", category: "Verification & Approvals",
    question: "What's a reasonable reason to reject a course in review?",
    answer: "Missing or misleading curriculum details, low-quality or incomplete content, pricing that doesn't match what was described at submission, or anything that fails a basic content-moderation check. Always leave a specific rejection note in Course Approval — \"needs work\" alone sends the educator back with nothing actionable.",
  },
  {
    id: "FAQ-12", category: "Certificates & Compliance",
    question: "A student says their certificate has the wrong name or date — how do I fix it?",
    answer: "Open Certificate Management under Settings & Permissions, find the certificate by number, and use Issue Certificate to generate a corrected one — issuance is idempotent, so it won't create a duplicate against the same completion. Note the correction reason in your ticket reply so there's a record of why a second certificate exists for that course.",
  },
  {
    id: "FAQ-13", category: "Certificates & Compliance",
    question: "When is it appropriate to revoke a certificate?",
    answer: "Only for a documented reason — fraudulent completion, a duplicate/merged account, or a data-privacy deletion request are the standard cases. Revoking always requires a reason (captured in the Revoke flow) and is logged to the audit trail, so never revoke without writing down why.",
  },
  {
    id: "FAQ-14", category: "Certificates & Compliance",
    question: "How do I know if an institution's accreditation is about to lapse?",
    answer: "Check the Accreditation & Compliance tab under Regional Growth & Compliance — institutions flagged \"Expiring Soon\" are within 90 days of their renewal date. Proactively flagging these to the institution before they hit \"Expired\" is part of keeping their compliance score current.",
  },
  {
    id: "FAQ-15", category: "Account Actions",
    question: "What justifies blocking a student or educator account?",
    answer: "Policy violations you can point to — sharing course content outside the platform, abusive behavior toward other users, confirmed payment fraud. Blocking is immediate and total (the account loses access regardless of valid credentials), so always record a specific reason in User Management — it's what the account owner sees if they dispute it.",
  },
  {
    id: "FAQ-16", category: "Account Actions",
    question: "Someone's locked out and says they never get their MFA code — what can I actually do?",
    answer: "Verify their identity first (enrollment ID for students, verification ID for educators), then you can manually clear the pending MFA challenge from User Management so they can log in and re-register their authenticator/number. Never share or reset credentials over an unverified request.",
  },
  {
    id: "FAQ-17", category: "Escalations & Audit",
    question: "Which actions get written to the audit log automatically?",
    answer: "Anything governance-relevant: account blocks/unblocks, permission and role changes, certificate issue/revoke, refund approvals, and course approval/rejection decisions. You don't need to log these yourself — but your admin account and the reason you gave (where one is required) are what shows up in Audit Logs, so make reasons specific.",
  },
  {
    id: "FAQ-18", category: "Escalations & Audit",
    question: "When should I flag something instead of just handling it myself?",
    answer: "Anything that looks like a security concern — credential stuffing, suspicious bulk account creation, a pattern of fraudulent refund requests — should be logged with a clear note rather than resolved quietly, even though Admin has the access to action it directly. The audit trail matters more than the fix being fast.",
  },
  {
    id: "FAQ-19", category: "Escalations & Audit",
    question: "How should I triage a callback request that looks low-quality or spam?",
    answer: "Mark it Contacted with a follow-up note explaining why (e.g. \"no legitimate institution/contact details, appears to be spam\"), then Closed once you've made a reasonable attempt to verify it isn't a real lead. Don't just delete or ignore it — the record stays for anyone who later wonders why it went unanswered.",
  },
];

export function getFaqCategoryCounts() {
  const counts = {};
  FAQS.forEach((f) => { counts[f.category] = (counts[f.category] || 0) + 1; });
  return counts;
}
