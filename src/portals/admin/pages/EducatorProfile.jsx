// Educator Management — Educator Profile
// Jira: Day 2 — Educator management & verification queue
// Admin must review educator verification applications and approve or
// reject them; educators cannot teach or publish courses until approved.
//
// Full tabbed detail view for a single educator, opened from the list
// (EducatorVerification.jsx) via "View" or a row's "Edit" action. Tabs:
// Overview | Personal & Professional | Students | Performance |
// Communication | Documents | Account & Access | Payments. Verification
// review for pending/under-review educators lives on the Overview tab.
//
// Reads/writes the same shared mock store as the list page
// (useEducator/updateEducator/... in ../data/educatorsMock.js), so any
// action here is reflected there immediately and vice versa. UI-only —
// every action below mutates local mock state, nothing is sent to a
// backend.

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  useEducator,
  updateEducator,
  updateEducatorDocument,
  addEducatorMessage,
  deleteEducator,
} from "../data/educatorsMock";
import ConfirmModal from "../components/ConfirmModal";
import {
  IconChevronLeft, IconStar, IconMail, IconPhone, IconSend, IconDownload,
  IconRefresh, IconCheck, IconClose, IconWallet, IconShield, IconSearch,
} from "../components/icons";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./EducatorProfile.css";

const ACCOUNT_LABEL = { active: "Active", inactive: "Inactive", suspended: "Suspended" };
const VERIFICATION_LABEL = { pending: "Pending", under_review: "Pending", verified: "Verified", rejected: "Rejected" };
const DOC_STATUS_LABEL = { pending: "Pending", verified: "Verified", rejected: "Rejected" };
const STUDENT_STATUS_LABEL = { active: "Active", completed: "Completed", at_risk: "At risk", inactive: "Inactive" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "personal", label: "Personal & Professional" },
  { key: "students", label: "Students" },
  { key: "performance", label: "Performance" },
  { key: "communication", label: "Communication" },
  { key: "documents", label: "Documents" },
  { key: "account", label: "Account & Access" },
  { key: "payments", label: "Payments" },
];

function AccountBadge({ status }) {
  return <span className={`ul-status-badge is-account-${status}`}>{ACCOUNT_LABEL[status]}</span>;
}
function VerificationBadge({ status }) {
  return <span className={`ul-status-badge is-${status === "under_review" ? "pending" : status}`}>{VERIFICATION_LABEL[status]}</span>;
}
function DocStatusBadge({ status }) {
  return <span className={`ul-status-badge is-${status}`}>{DOC_STATUS_LABEL[status]}</span>;
}
function StudentStatusBadge({ status }) {
  const cls = status === "active" ? "is-approved" : status === "completed" ? "is-verified" : status === "at_risk" ? "is-pending" : "is-rejected";
  return <span className={`ul-status-badge ${cls}`}>{STUDENT_STATUS_LABEL[status]}</span>;
}

function StatBlock({ label, value }) {
  return (
    <div className="ul-edp-stat">
      <p className="ul-edp-stat__value">{value}</p>
      <p className="ul-edp-stat__label">{label}</p>
    </div>
  );
}

function Section({ title, action, children }) {
  return (
    <div className="ul-card ul-edp-section">
      <div className="ul-edp-section__head">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function MiniBars({ data, valueKey = "value", suffix = "" }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  return (
    <div className="ul-edp-bars">
      {data.map((d) => (
        <div key={d.month} className="ul-edp-bars__col">
          <div className="ul-edp-bars__track">
            <div className="ul-edp-bars__fill" style={{ height: `${Math.max(4, (d[valueKey] / max) * 100)}%` }} />
          </div>
          <span className="ul-edp-bars__val">{d[valueKey]}{suffix}</span>
          <span className="ul-edp-bars__month">{d.month}</span>
        </div>
      ))}
    </div>
  );
}

export default function EducatorProfile() {
  const { educatorId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const educator = useEducator(educatorId);

  const initialTab = location.state?.tab && TABS.some((t) => t.key === location.state.tab) ? location.state.tab : "overview";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [confirmAction, setConfirmAction] = useState(null); // { type, payload }
  const [reasonText, setReasonText] = useState("");
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageForm, setMessageForm] = useState({ subject: "", body: "" });
  const [studentSearch, setStudentSearch] = useState("");
  const [studentStatusFilter, setStudentStatusFilter] = useState("all");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);


  const filteredStudents = useMemo(() => {
    if (!educator) return [];
    const q = studentSearch.trim().toLowerCase();
    return educator.students.filter((s) => {
      if (q && !`${s.name} ${s.email} ${s.course}`.toLowerCase().includes(q)) return false;
      if (studentStatusFilter !== "all" && s.status !== studentStatusFilter) return false;
      return true;
    });
  }, [educator, studentSearch, studentStatusFilter]);

  if (!educator) {
    return (
      <div className="ul-edp-notfound">
        <p>This educator no longer exists (it may have been deleted).</p>
        <button type="button" className="ul-btn ul-btn--primary" onClick={() => navigate("/admin/educatorverification")}>
          Back to Educator Management
        </button>
      </div>
    );
  }

  const runConfirmed = () => {
    if (!confirmAction) return;
    const { type } = confirmAction;
    if (type === "deactivate") { updateEducator(educator.id, { accountStatus: "inactive" }); setToast("Educator deactivated."); }
    if (type === "suspend") { updateEducator(educator.id, { accountStatus: "suspended" }); setToast("Educator suspended."); }
    if (type === "delete") { deleteEducator(educator.id); navigate("/admin/educatorverification"); return; }
    if (type === "approve") { updateEducator(educator.id, { verificationStatus: "verified" }); setToast("Educator verified & approved."); }
    if (type === "reject") { updateEducator(educator.id, { verificationStatus: "rejected" }); setToast("Application rejected."); }
    if (type === "request_info") { updateEducator(educator.id, { verificationStatus: "under_review" }); setToast("Requested additional information."); }
    if (type === "reset_password") { setToast("Password reset link sent to " + educator.email + "."); }
    if (type === "force_logout") { setToast("Educator has been force-logged-out of all sessions."); }
    if (type === "reject_document") { updateEducatorDocument(educator.id, confirmAction.docId, { status: "rejected", rejectionReason: reasonText || "Document did not meet verification requirements." }); setToast("Document rejected."); }
    if (type === "verify_document") { updateEducatorDocument(educator.id, confirmAction.docId, { status: "verified", rejectionReason: null }); setToast("Document verified."); }
    if (type === "request_replacement") { updateEducatorDocument(educator.id, confirmAction.docId, { status: "pending", rejectionReason: null }); setToast("Replacement requested."); }
    setConfirmAction(null);
    setReasonText("");
  };

  const confirmCopy = {
    deactivate: { title: "Deactivate this educator?", description: "Their courses stay live, but they won't be able to sign in or teach until reactivated.", confirmLabel: "Deactivate", tone: "default" },
    suspend: { title: "Suspend this educator?", description: "This immediately blocks sign-in and hides their courses from students until you lift the suspension.", confirmLabel: "Suspend", tone: "danger" },
    delete: { title: "Delete this educator?", description: "This permanently removes their profile, courses and history from Educator Management. This cannot be undone.", confirmLabel: "Delete", tone: "danger" },
    approve: { title: "Approve & verify this educator?", description: "They will be able to publish courses and appear as a verified educator on the platform.", confirmLabel: "Approve", tone: "default" },
    reject: { title: "Reject this application?", description: "Let the admin team know why — this reason is stored with the application.", confirmLabel: "Reject", tone: "danger", withReason: true },
    request_info: { title: "Request additional information?", description: "The educator's status moves to Pending until they resubmit.", confirmLabel: "Request info", tone: "default", withReason: true },
    reset_password: { title: "Reset this educator's password?", description: "Sends a password reset link to their registered email. Their current session stays active until they use it.", confirmLabel: "Send reset link", tone: "default" },
    force_logout: { title: "Force logout everywhere?", description: "Immediately ends this educator's active sessions on every device. They'll need to sign in again.", confirmLabel: "Force logout", tone: "danger" },
    reject_document: { title: "Reject this document?", description: "Tell the educator what needs to be fixed or resubmitted.", confirmLabel: "Reject document", tone: "danger", withReason: true },
    verify_document: { title: "Mark this document as verified?", description: "Confirms this document meets verification requirements.", confirmLabel: "Verify document", tone: "default" },
    request_replacement: { title: "Request a replacement document?", description: "Resets this document to Pending so the educator knows to resubmit it.", confirmLabel: "Request replacement", tone: "default" },
  }[confirmAction?.type];

  const sendMessage = () => {
    if (!messageForm.subject.trim() || !messageForm.body.trim()) return;
    addEducatorMessage(educator.id, {
      direction: "sent",
      subject: messageForm.subject,
      body: messageForm.body,
      date: "Just now",
    });
    setMessageForm({ subject: "", body: "" });
    setMessageOpen(false);
    setToast("Message sent to " + educator.name + ".");
  };

  const p = educator.performance;
  const needsReview = educator.verificationStatus === "pending" || educator.verificationStatus === "under_review";
  const isVerificationPending = educator.verificationStatus === "pending";

  return (
    <div className="ul-edp">
      {toast && <div className="ul-edp-toast">{toast}</div>}

      <button type="button" className="ul-edp-back" onClick={() => navigate("/admin/educatorverification")}>
        <IconChevronLeft size={14} /> Back to Educator Management
      </button>

      <div className="ul-card ul-edp-header">
        <div className="ul-edp-header__main">
          <div className="ul-avatar-chip ul-edp-avatar" style={{ background: `${educator.avatarColor}22`, color: educator.avatarColor }}>
            {educator.initials}
          </div>
          <div>
            <div className="ul-edp-header__nameRow">
              <h2>{educator.name}</h2>
              <AccountBadge status={educator.accountStatus} />
              <VerificationBadge status={educator.verificationStatus} />
            </div>
            <p className="ul-edp-header__meta">
              {educator.subjects.join(", ")} &middot; {educator.yearsExperience} yrs experience
            </p>
            <p className="ul-edp-header__meta">
              <IconMail size={12} /> {educator.email} &nbsp;&nbsp; <IconPhone size={12} /> {educator.phone}
            </p>
          </div>
        </div>
        <div className="ul-edp-header__actions">
          {educator.accountStatus === "active" ? (
            <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setConfirmAction({ type: "deactivate" })}>Deactivate</button>
          ) : (
            <button type="button" className="ul-btn ul-btn--ghost" onClick={() => updateEducator(educator.id, { accountStatus: "active" })}>Activate</button>
          )}
          {educator.accountStatus !== "suspended" && (
            <button type="button" className="ul-btn ul-btn--danger" onClick={() => setConfirmAction({ type: "suspend" })}>Suspend</button>
          )}
          <button type="button" className="ul-btn ul-btn--primary" onClick={() => { setActiveTab("communication"); setMessageOpen(true); }}>
            <IconSend size={13} /> Contact
          </button>
        </div>
      </div>

      <div className="ul-edp-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            className={`ul-edp-tab${activeTab === t.key ? " is-active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            {t.key === "overview" && needsReview && <span className="ul-edp-tab__dot" />}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="ul-edp-grid">
          <div className="ul-edp-col">
            <Section title="Snapshot">
              <div className="ul-edp-stats">
                <StatBlock label="Total students" value={isVerificationPending ? "—" : educator.studentsCount} />
                <StatBlock label="Total courses" value={educator.coursesCount} />
                <StatBlock label="Avg. rating" value={educator.rating > 0 ? educator.rating.toFixed(1) : "—"} />
                <StatBlock label="Completion rate" value={p.avgCompletionRate ? `${p.avgCompletionRate}%` : "—"} />
              </div>
            </Section>

            <Section title="Professional summary">
              <p className="ul-edp-summary-text">{educator.professionalSummary}</p>
            </Section>

            <Section title="Recent activity">
              <ul className="ul-edp-activity">
                <li>Last active {educator.lastActive}</li>
                <li>Joined the platform on {educator.joinedDate}</li>
                <li>{educator.messages.length} message{educator.messages.length === 1 ? "" : "s"} sent from admin</li>
              </ul>
            </Section>
          </div>

          <div className="ul-edp-col">
            {needsReview && (
              <Section title="Verification review">
                <div className="ul-edp-review">
                  <div className="ul-edp-review__row"><span>Application date</span><strong>{educator.joinedDate}</strong></div>
                  <div className="ul-edp-review__row"><span>Qualification</span><strong>{educator.qualification}</strong></div>
                  <div className="ul-edp-review__row"><span>Experience</span><strong>{educator.yearsExperience} years</strong></div>
                  <div className="ul-edp-review__row"><span>Subjects</span><strong>{educator.subjects.join(", ")}</strong></div>
                  <div className="ul-edp-review__row"><span>Documents submitted</span><strong>{educator.documents.length}</strong></div>
                  <div className="ul-edp-review__row"><span>Documents verified</span><strong>{educator.documents.filter((d) => d.status === "verified").length} / {educator.documents.length}</strong></div>
                  <div className="ul-edp-review__row"><span>Current status</span><VerificationBadge status={educator.verificationStatus} /></div>
                </div>
                <div className="ul-edp-review__actions">
                  <button type="button" className="ul-btn ul-btn--primary" onClick={() => setConfirmAction({ type: "approve" })}>
                    <IconCheck size={13} /> Approve
                  </button>
                  <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setConfirmAction({ type: "request_info" })}>
                    Request info
                  </button>
                  <button type="button" className="ul-btn ul-btn--danger" onClick={() => setConfirmAction({ type: "reject" })}>
                    Reject
                  </button>
                </div>
              </Section>
            )}

            <Section title="Platform info">
              <div className="ul-edp-review">
                <div className="ul-edp-review__row"><span>Joining date</span><strong>{educator.joinedDate}</strong></div>
                <div className="ul-edp-review__row"><span>Account status</span><AccountBadge status={educator.accountStatus} /></div>
                <div className="ul-edp-review__row"><span>Verification status</span><VerificationBadge status={educator.verificationStatus} /></div>
                <div className="ul-edp-review__row"><span>Last login</span><strong>{educator.lastActive}</strong></div>
              </div>
            </Section>
          </div>
        </div>
      )}

      {activeTab === "personal" && (
        <div className="ul-edp-grid">
          <div className="ul-edp-col">
            <Section title="Personal information">
              <div className="ul-edp-review">
                <div className="ul-edp-review__row"><span>First name</span><strong>{educator.firstName}</strong></div>
                <div className="ul-edp-review__row"><span>Last name</span><strong>{educator.lastName}</strong></div>
                <div className="ul-edp-review__row"><span>Email</span><strong>{educator.email}</strong></div>
                <div className="ul-edp-review__row"><span>Phone</span><strong>{educator.phone}</strong></div>
                <div className="ul-edp-review__row"><span>Date of birth</span><strong>{educator.dob}</strong></div>
                <div className="ul-edp-review__row"><span>Gender</span><strong>{educator.gender}</strong></div>
                <div className="ul-edp-review__row"><span>Address</span><strong>{educator.address}</strong></div>
              </div>
            </Section>
          </div>

          <div className="ul-edp-col">
            <Section title="Professional information">
              <div className="ul-edp-review">
                <div className="ul-edp-review__row"><span>Qualification</span><strong>{educator.qualification}</strong></div>
                <div className="ul-edp-review__row"><span>Years of experience</span><strong>{educator.yearsExperience}</strong></div>
                <div className="ul-edp-review__row"><span>Subjects taught</span><strong>{educator.subjects.join(", ")}</strong></div>
                <div className="ul-edp-review__row"><span>Skills</span><strong>{educator.skills.join(", ")}</strong></div>
                <div className="ul-edp-review__row"><span>Certifications</span><strong>{educator.certifications.join(", ")}</strong></div>
                <div className="ul-edp-review__row"><span>Previous experience</span><strong>{educator.previousExperience.map((e) => `${e.role} at ${e.org} (${e.years} yrs)`).join("; ")}</strong></div>
              </div>
            </Section>
          </div>
        </div>
      )}

      {activeTab === "students" && isVerificationPending && (
        <div className="ul-card ul-edp-pending-notice">
          <strong>Verification Pending</strong>
          <p>Student data will be available after approval.</p>
        </div>
      )}

      {activeTab === "students" && !isVerificationPending && (
        <>
          <div className="ul-edp-stats ul-edp-stats--4col">
            <StatBlock label="Total students" value={educator.performance.totalStudents} />
            <StatBlock label="Active" value={educator.performance.activeStudents} />
            <StatBlock label="Completed" value={educator.performance.completedStudents} />
            <StatBlock label="At risk / inactive" value={educator.performance.atRiskStudents} />
          </div>
          <div className="ul-edu-toolbar">
            <label className="ul-edu-search">
              <IconSearch size={14} color="var(--color-text-muted)" />
              <input type="text" placeholder="Search students by name, email or course…" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
            </label>
            <select className="ul-edu-select" value={studentStatusFilter} onChange={(e) => setStudentStatusFilter(e.target.value)}>
              <option value="all">Status: All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="at_risk">At risk</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="ul-card ul-edu-table-card">
            {filteredStudents.length === 0 ? (
              <div className="ul-edu-empty">No students match these filters.</div>
            ) : (
              <div className="ul-edu-table-scroll">
                <table className="ul-edu-table">
                  <thead>
                    <tr>
                      <th>Student</th><th>Course</th><th>Enrolled</th><th>Progress</th><th>Last active</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div className="ul-edu-cell-id">
                            <div className="ul-avatar-chip ul-edu-table-avatar">{s.initials}</div>
                            <div className="ul-edu-cell-id__body">
                              <span style={{ fontWeight: 700 }}>{s.name}</span>
                              <span className="ul-edu-cell-id__sub">{s.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>{s.course}</td>
                        <td>{s.enrolledDate}</td>
                        <td>
                          <div className="ul-edp-progress">
                            <div className="ul-edp-progress__track"><div className="ul-edp-progress__fill" style={{ width: `${s.progress}%` }} /></div>
                            <span>{s.progress}%</span>
                          </div>
                        </td>
                        <td>{s.lastActive}</td>
                        <td><StudentStatusBadge status={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "performance" && isVerificationPending && (
        <div className="ul-card ul-edp-pending-notice">
          <strong>Verification Pending</strong>
          <p>Student data will be available after approval.</p>
        </div>
      )}

      {activeTab === "performance" && !isVerificationPending && (
        <div className="ul-edp-grid">
          <div className="ul-edp-col">
            <Section title="Key metrics">
              <div className="ul-edp-stats">
                <StatBlock label="Active students" value={p.activeStudents} />
                <StatBlock label="Course completion" value={`${p.avgCompletionRate}%`} />
                <StatBlock label="Avg. student score" value={`${p.avgStudentScore}%`} />
                <StatBlock label="Engagement score" value={p.engagementScore ? `${p.engagementScore}%` : "—"} />
                <StatBlock label="Assignment completion" value={p.assignmentCompletionRate ? `${p.assignmentCompletionRate}%` : "—"} />
                <StatBlock label="Sessions conducted" value={p.sessionsConducted || "—"} />
              </div>
            </Section>
            <Section title="Enrollment growth (last 6 months)">
              <MiniBars data={p.enrollmentTrend} />
            </Section>
          </div>
          <div className="ul-edp-col">
            <Section title="Rating trend">
              <MiniBars data={p.ratingTrend} suffix="★" />
            </Section>
            <Section title="Course completion trend">
              <MiniBars data={p.completionTrend} suffix="%" />
            </Section>
            <Section title="Course performance">
              {educator.courses.length === 0 ? (
                <p className="ul-edu-cell-id__sub">No courses yet.</p>
              ) : (
                <div className="ul-edp-courses">
                  {educator.courses.map((c) => (
                    <div key={c.id} className="ul-edp-course-row">
                      <span className="ul-edp-course-row__title">{c.title}</span>
                      <span>{c.students} students</span>
                      <span>{c.completionRate}% completion</span>
                      <span><IconStar size={11} color="var(--color-warning-accent)" /> {c.rating > 0 ? c.rating.toFixed(1) : "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </div>
      )}

      {activeTab === "communication" && (
        <div className="ul-edp-grid">
          <div className="ul-edp-col ul-edp-col--full">
            <Section title="Message history" action={
              <button type="button" className="ul-btn ul-btn--primary" onClick={() => setMessageOpen(true)}><IconSend size={12} /> Send message</button>
            }>
              {educator.messages.length === 0 ? (
                <p className="ul-edu-cell-id__sub">No messages yet.</p>
              ) : (
                <div className="ul-edp-messages">
                  {educator.messages.map((m) => (
                    <div key={m.id} className="ul-edp-message">
                      <div className="ul-edp-message__head">
                        <strong>{m.subject}</strong>
                        <span className="ul-edu-cell-id__sub">{m.date}</span>
                      </div>
                      <p>{m.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="ul-card ul-edu-table-card">
          <div className="ul-edu-table-scroll">
            <table className="ul-edu-table">
              <colgroup>
                <col style={{ width: "19%" }} />
                <col style={{ width: "23%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "24%" }} />
              </colgroup>
              <thead>
                <tr><th>Document</th><th>File name</th><th>Uploaded</th><th>Status</th><th aria-label="Actions" /></tr>
              </thead>
              <tbody>
                {educator.documents.map((d) => (
                  <tr key={d.id}>
                    <td>{d.type}</td>
                    <td className="ul-edu-cell-id__sub">{d.fileName}</td>
                    <td>{d.uploadedDate}</td>
                    <td>
                      <DocStatusBadge status={d.status} />
                      {d.status === "rejected" && d.rejectionReason && (
                        <div className="ul-edp-doc-reason">{d.rejectionReason}</div>
                      )}
                    </td>
                    <td className="ul-edu-actions-cell">
                      <div className="ul-edu-doc-actions">
                        <button type="button" className="ul-btn ul-btn--ghost ul-edu-view-btn" onClick={() => setToast(`Previewing ${d.fileName} (mock)`)}>View</button>
                        <button type="button" className="ul-edu-more-btn" title="Download" onClick={() => setToast(`Downloading ${d.fileName} (mock)`)}><IconDownload size={13} /></button>
                        {d.status !== "verified" && (
                          <button type="button" className="ul-edu-more-btn" title="Verify" onClick={() => setConfirmAction({ type: "verify_document", docId: d.id })}><IconCheck size={13} /></button>
                        )}
                        {d.status !== "rejected" && (
                          <button type="button" className="ul-edu-more-btn" title="Reject" onClick={() => setConfirmAction({ type: "reject_document", docId: d.id })}><IconClose size={13} /></button>
                        )}
                        <button type="button" className="ul-edu-more-btn" title="Request replacement" onClick={() => setConfirmAction({ type: "request_replacement", docId: d.id })}><IconRefresh size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "account" && (
        <div className="ul-edp-grid">
          <div className="ul-edp-col">
            <Section title="Account & access">
              <div className="ul-edp-review">
                <div className="ul-edp-review__row"><span>Account status</span><AccountBadge status={educator.accountStatus} /></div>
                <div className="ul-edp-review__row"><span>Verification status</span><VerificationBadge status={educator.verificationStatus} /></div>
                <div className="ul-edp-review__row"><span>Last login</span><strong>{educator.lastActive}</strong></div>
                <div className="ul-edp-review__row"><span>Account created</span><strong>{educator.joinedDate}</strong></div>
                <div className="ul-edp-review__row"><span>Assigned role</span><strong><IconShield size={12} /> {educator.role}</strong></div>
              </div>
            </Section>
            <Section title="Permissions / access level">
              <div className="ul-edu-chips">
                {educator.permissions.map((perm) => <span key={perm} className="ul-edu-chip">{perm}</span>)}
              </div>
            </Section>
          </div>
          <div className="ul-edp-col">
            <Section title="Account actions">
              <div className="ul-edp-action-list">
                {educator.accountStatus === "active" ? (
                  <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setConfirmAction({ type: "deactivate" })}>Deactivate account</button>
                ) : (
                  <button type="button" className="ul-btn ul-btn--ghost" onClick={() => updateEducator(educator.id, { accountStatus: "active" })}>Activate account</button>
                )}
                {educator.accountStatus !== "suspended" && (
                  <button type="button" className="ul-btn ul-btn--danger" onClick={() => setConfirmAction({ type: "suspend" })}>Suspend account</button>
                )}
                <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setConfirmAction({ type: "reset_password" })}>Reset password</button>
                <button type="button" className="ul-btn ul-btn--danger" onClick={() => setConfirmAction({ type: "force_logout" })}>Force logout</button>
                <button type="button" className="ul-btn ul-btn--danger" onClick={() => setConfirmAction({ type: "delete" })}>Delete educator</button>
              </div>
            </Section>
          </div>
        </div>
      )}

      {activeTab === "payments" && (
        <>
          <div className="ul-edp-stats ul-edp-stats--4col">
            <StatBlock label="Total earnings" value={`$${educator.payments.totalEarnings.toLocaleString()}`} />
            <StatBlock label="Paid" value={`$${educator.payments.paidAmount.toLocaleString()}`} />
            <StatBlock label="Pending" value={`$${educator.payments.pendingAmount.toLocaleString()}`} />
            <StatBlock label="Commission rate" value={`${educator.payments.commissionRate}%`} />
          </div>
          {educator.payments.nextPayoutDate && (
            <div className="ul-card ul-edp-next-payout">
              <IconWallet size={16} color="var(--color-primary)" />
              <span>Next payout of <strong>${educator.payments.nextPayoutAmount.toLocaleString()}</strong> scheduled for <strong>{educator.payments.nextPayoutDate}</strong></span>
            </div>
          )}
          <div className="ul-card ul-edu-table-card">
            {educator.payments.history.length === 0 ? (
              <div className="ul-edu-empty">No payment history yet — payouts begin once the educator is verified.</div>
            ) : (
              <div className="ul-edu-table-scroll">
                <table className="ul-edu-table">
                  <thead>
                    <tr><th>Payout ID</th><th>Date</th><th>Amount</th><th>Commission</th><th>Net</th><th>Status</th><th>Method</th></tr>
                  </thead>
                  <tbody>
                    {educator.payments.history.map((h) => (
                      <tr key={h.id}>
                        <td>{h.id}</td>
                        <td>{h.date}</td>
                        <td>${h.amount.toLocaleString()}</td>
                        <td>${h.commission.toLocaleString()}</td>
                        <td>${h.net.toLocaleString()}</td>
                        <td><span className={`ul-status-badge is-${h.status === "paid" ? "approved" : h.status === "failed" ? "rejected" : "pending"}`}>{h.status[0].toUpperCase() + h.status.slice(1)}</span></td>
                        <td>{h.method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <ConfirmModal
        open={!!confirmAction}
        title={confirmCopy?.title}
        description={confirmCopy?.description}
        confirmLabel={confirmCopy?.confirmLabel}
        tone={confirmCopy?.tone}
        onConfirm={runConfirmed}
        onCancel={() => { setConfirmAction(null); setReasonText(""); }}
      >
        {confirmCopy?.withReason && (
          <textarea
            className="ul-confirm-modal__reason"
            placeholder="Add a reason or comment (visible to the educator)…"
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
          />
        )}
      </ConfirmModal>

      <ConfirmModal
        open={messageOpen}
        title={`Message ${educator.name}`}
        description="Sends a one-off message/announcement to this educator (mock — added to their message history)."
        confirmLabel="Send"
        tone="default"
        confirmDisabled={!messageForm.subject.trim() || !messageForm.body.trim()}
        onConfirm={sendMessage}
        onCancel={() => setMessageOpen(false)}
      >
        <div className="ul-edp-form" style={{ marginTop: 10 }}>
          <label className="ul-edp-form__full">To<input type="text" value={educator.email} disabled /></label>
          <label className="ul-edp-form__full">Subject<input type="text" value={messageForm.subject} onChange={(e) => setMessageForm({ ...messageForm, subject: e.target.value })} /></label>
          <label className="ul-edp-form__full">Message<textarea rows={4} value={messageForm.body} onChange={(e) => setMessageForm({ ...messageForm, body: e.target.value })} /></label>
          <label className="ul-edp-form__full">Attachment<input type="text" placeholder="No file attached (mock)" disabled /></label>
        </div>
      </ConfirmModal>
    </div>
  );
}
