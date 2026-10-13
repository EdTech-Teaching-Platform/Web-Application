// Educator registration — ONE unified, upfront flow
// Jira: Day 1 — Educator registration & verification (+ Day 2 profile setup,
// now merged in)
// Doc reference: Sec 5.1 (User Management & Onboarding — educator
// registration + verification, Digital ID Card issued once approved)
//
// This is the merge of the former two-stage sequence ("register -> wait for
// admin approval -> then set up profile + get ID card") into a single sitting.
// Everything an educator used to provide in either stage is collected here, as
// a 5-step wizard (one step visible at a time via the shared ProgressSteps):
//
//   1. Account & Contact — name, email, password, phone(s), address, location
//   2. Teaching Profile  — photo, headline, bio, pronouns, qualification,
//                          institution, experience, links, subjects, teaching
//                          modes, grades & subjects taught, specializations,
//                          teaching languages, Discovery visibility
//   3. Career History    — work experience, education, certifications,
//                          volunteering, awards, professional references
//                          (all optional, exactly as in the old Profile Setup)
//   4. Your Objective    — objectives, how you work, preferred age groups
//   5. Verify            — ID, certificate, background check, resume,
//                          reference notes, terms + privacy consent
//
// Overlapping fields from the two old flows were deduplicated (full name,
// headline, city, years of experience, website/portfolio) — see
// data/educatorRegistrationData.js. Submission creates ONE complete educator
// record (data/educatorAccountStore.js) with status "pending" and signs the
// educator in right away; the portal then shows its shell with locked content
// until an admin approves (TeacherLayout). The Digital ID Card shown at the
// end is PROVISIONAL ("Pending Verification") until that approval.
//
// `?resubmit=1` re-opens the same form pre-filled for an educator whose
// status is changes_requested / rejected; submitting updates the same record
// and sets it back to pending.
import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import Input from "../../../components/ui/Input";
import Checkbox from "../../../components/ui/Checkbox";
import FileDropzone from "../../../components/ui/FileDropzone";
import Button from "../../../components/ui/Button";
import Chip from "../../../components/ui/Chip";
import ProgressSteps from "../../../components/ui/ProgressSteps";
import AuthBackdrop from "../../../components/ui/AuthBackdrop";
import StatusBadge from "../../../components/ui/StatusBadge";
import Select from "../../../components/ui/Select";
import { InfoIcon, PlusIcon, XIcon, AlertTriangleIcon, ClockIcon } from "../../../components/ui/icons";
import { isStrongPassword } from "../../../auth/utils/validators";
import PhotoUploader from "../components/PhotoUploader";
import SubjectGradeRow from "../components/SubjectGradeRow";
import RepeatableEntryList from "../components/RepeatableEntryList";
import DigitalIDCard from "../components/DigitalIDCard";
import {
  SUBJECT_AREAS, QUALIFICATIONS, TEACHING_MODES, OBJECTIVES, EMPLOYMENT_TYPES, AGE_GROUPS, DIAL_CODES,
  COUNTRY_STATE_MAP, COUNTRIES, GRADES, SUBJECTS, LANGUAGES, PRONOUNS, SPECIALIZATIONS,
  emptyGradeRow, emptyWorkExperience, emptyEducation, emptyCertification, emptyVolunteering, emptyAward,
  emptyReference, WORK_FIELDS, EDUCATION_FIELDS, CERTIFICATION_FIELDS, VOLUNTEER_FIELDS, AWARD_FIELDS,
  REFERENCE_FIELDS, createInitialForm,
} from "../data/educatorRegistrationData";
import {
  registerEducator, resubmitEducator, findEducatorByIdentifier, useCurrentEducator, toIdCardProfile,
  EDUCATOR_STATUS, EDUCATOR_STATUS_META,
} from "../data/educatorAccountStore";

const STEPS = ["Account", "Profile", "Career", "Objective", "Verify"];

const STEP_META = [
  { title: "Account & Contact", subtitle: "Create your login and tell us how to reach you. This is also where we'll send your verification updates." },
  { title: "Teaching Profile", subtitle: "This is what students and parents see on your public profile and Digital ID Card." },
  { title: "Career History", subtitle: "Optional — add as much or as little as you like. A fuller profile builds more trust." },
  { title: "Your Objective", subtitle: "Let us know your goals so we can tailor the best experience for you." },
  { title: "Verify", subtitle: "Submit your certification details. Upload the necessary documents to complete your verification process." },
];

function FieldLabel({ children, required = false, className = "" }) {
  return (
    <span className={`mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted ${className}`}>
      {children}
      {required && <span className="ml-0.5 text-danger">*</span>}
    </span>
  );
}

function SectionHeading({ children }) {
  return <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">{children}</h2>;
}

function SectionLabel({ children, hint }) {
  return (
    <div className="mb-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{children}</h3>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function SelectField({ value, onChange, onBlur, error, placeholder, options, disabled }) {
  return (
    <div>
      <Select
        wrapperClassName="block w-full"
        disabled={disabled}
        className={`w-full rounded-lg border bg-bg px-3 py-2 pr-9 text-sm text-text outline-none transition-colors duration-150 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-40 ${
          error
            ? "border-danger focus:border-danger focus:ring-danger/15"
            : "border-text/15 focus:border-primary focus:ring-primary/15"
        }`}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </Select>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </div>
  );
}

// Per-step required-field lists, used to mark everything touched (so inline
// errors appear) when someone hits Next on an invalid step — a disabled
// button with no explanation just looks broken.
const STEP_FIELDS = [
  ["fullName", "email", "password", "confirmPassword", "phone", "address", "country", "state", "city", "zipCode"],
  ["headline", "bio", "qualification", "institution", "experience", "primarySubject", "teachingModes", "gradeRows", "languages"],
  [],
  ["objectives", "employmentType", "ageGroups"],
  ["govId", "certificate", "backgroundCheck", "acceptedTerms", "acceptedPrivacy"],
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Pre-fill for resubmission: the stored profile + document metadata.
function formFromAccount(account) {
  const base = createInitialForm();
  const p = account.profile;
  return {
    ...base,
    ...p,
    gradeRows: p.gradeRows?.length ? p.gradeRows : base.gradeRows,
    workExperience: p.workExperience ?? [],
    education: p.education ?? [],
    referenceList: p.referenceList ?? [],
    email: account.email,
    govId: account.documents.govId,
    certificate: account.documents.certificate,
    backgroundCheck: account.documents.backgroundCheck,
    resume: account.documents.resume,
    photo: null,
  };
}

export default function Registration() {
  const [searchParams] = useSearchParams();
  const wantsResubmit = searchParams.get("resubmit") === "1";
  const current = useCurrentEducator();
  // Decided once, on first render: after a successful resubmit the status flips
  // to "pending", which must not bounce the educator away from the confirmation.
  const [resubmitAccount] = useState(() =>
    wantsResubmit &&
    current &&
    (current.status === EDUCATOR_STATUS.CHANGES_REQUESTED || current.status === EDUCATOR_STATUS.REJECTED)
      ? current
      : null
  );

  // Asking to resubmit without an eligible signed-in account -> nothing to edit.
  if (wantsResubmit && !resubmitAccount) return <Navigate to={current ? "/teacher" : "/login"} replace />;

  return <RegistrationFlow resubmitAccount={resubmitAccount} />;
}

function RegistrationFlow({ resubmitAccount }) {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const isResubmit = Boolean(resubmitAccount);

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(() => (resubmitAccount ? formFromAccount(resubmitAccount) : createInitialForm()));
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null); // null | "email_taken" | "generic"
  const [completed, setCompleted] = useState(null); // the saved account, once submitted
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));
  const markTouched = (field) => () => setTouched((t) => ({ ...t, [field]: true }));
  const markStepTouched = () => {
    const fields = STEP_FIELDS[stepIndex] ?? [];
    setTouched((t) => ({ ...t, ...Object.fromEntries(fields.map((f) => [f, true])) }));
  };
  const errorFor = (field, message) => (touched[field] ? message : "");

  const toggleInList = (field) => (label) => {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(label) ? f[field].filter((o) => o !== label) : [...f[field], label],
    }));
    markTouched(field)();
  };
  const toggleObjective = toggleInList("objectives");
  const toggleAgeGroup = toggleInList("ageGroups");
  const toggleTeachingMode = toggleInList("teachingModes");
  const toggleLanguage = toggleInList("languages");
  const toggleSpecialization = toggleInList("specializations");

  // Same add/update/remove shape for every repeatable "career history" list.
  const listHelpers = (field) => ({
    onAdd: (makeEmpty) => setForm((f) => ({ ...f, [field]: [...f[field], makeEmpty()] })),
    onChange: (id, next) => setForm((f) => ({ ...f, [field]: f[field].map((item) => (item.id === id ? next : item)) })),
    onRemove: (id) => setForm((f) => ({ ...f, [field]: f[field].filter((item) => item.id !== id) })),
  });
  const workHelpers = listHelpers("workExperience");
  const educationHelpers = listHelpers("education");
  const certificationHelpers = listHelpers("certifications");
  const volunteerHelpers = listHelpers("volunteering");
  const awardHelpers = listHelpers("awards");
  const referenceHelpers = listHelpers("referenceList");

  const updateGradeRow = (id, next) => setForm((f) => ({ ...f, gradeRows: f.gradeRows.map((r) => (r.id === id ? next : r)) }));
  const addGradeRow = () => setForm((f) => ({ ...f, gradeRows: [...f.gradeRows, emptyGradeRow()] }));
  const removeGradeRow = (id) =>
    setForm((f) => ({ ...f, gradeRows: f.gradeRows.length > 1 ? f.gradeRows.filter((r) => r.id !== id) : f.gradeRows }));
  const gradeRowsValid = useMemo(() => form.gradeRows.every((r) => r.grade && r.subjects.length > 0), [form.gradeRows]);

  const availableExtraSubjects = SUBJECT_AREAS.filter(
    (s) => s !== form.primarySubject && !form.additionalSubjects.includes(s)
  );
  const addAdditionalSubject = (subject) => {
    if (!subject || form.additionalSubjects.length >= 5) return;
    setForm((f) => ({ ...f, additionalSubjects: [...f.additionalSubjects, subject] }));
    setAddSubjectOpen(false);
  };
  const removeAdditionalSubject = (subject) =>
    setForm((f) => ({ ...f, additionalSubjects: f.additionalSubjects.filter((s) => s !== subject) }));

  const emailTaken = !isResubmit && EMAIL_RE.test(form.email) && Boolean(findEducatorByIdentifier(form.email));
  const passwordOk = isResubmit || isStrongPassword(form.password);
  const confirmOk = isResubmit || form.password === form.confirmPassword;

  const isStepValid = useMemo(() => {
    switch (stepIndex) {
      case 0: {
        const stateOk = form.country === "Other" ? form.otherState.trim().length > 0 : Boolean(form.state);
        return (
          form.fullName.trim().length >= 2 &&
          EMAIL_RE.test(form.email) &&
          !emailTaken &&
          passwordOk &&
          confirmOk &&
          form.phone.trim().length >= 7 &&
          form.address.trim().length > 0 &&
          Boolean(form.country) &&
          stateOk &&
          form.city.trim().length > 0 &&
          form.zipCode.trim().length > 0
        );
      }
      case 1:
        return (
          form.headline.trim().length > 0 &&
          form.bio.trim().length >= 20 &&
          Boolean(form.qualification) &&
          form.institution.trim().length > 0 &&
          form.experience.trim().length > 0 &&
          Boolean(form.primarySubject) &&
          form.teachingModes.length > 0 &&
          gradeRowsValid &&
          form.languages.length > 0
        );
      case 2:
        return true; // career history is optional
      case 3:
        return form.objectives.length > 0 && Boolean(form.employmentType) && form.ageGroups.length > 0;
      case 4:
        return (
          Boolean(form.govId) &&
          form.govIdStatus === "success" &&
          Boolean(form.certificate) &&
          form.certificateStatus === "success" &&
          (form.noBackgroundCheck || (Boolean(form.backgroundCheck) && form.backgroundCheckStatus === "success")) &&
          form.acceptedTerms &&
          form.acceptedPrivacy
        );
      default:
        return false;
    }
  }, [stepIndex, form, gradeRowsValid, emailTaken, passwordOk, confirmOk]);

  // Not a native `disabled` button: a truly disabled button fires no click, so
  // a missing required field would give zero feedback. The button stays
  // clickable but greyed out; clicking while invalid reveals inline errors.
  const handleContinue = async () => {
    if (!isStepValid) {
      markStepTouched();
      return;
    }
    if (stepIndex < STEPS.length - 1) {
      setTouched({});
      setStepIndex((i) => i + 1);
      window.scrollTo?.({ top: 0 });
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // ONE call saves the account details AND the profile details together.
      const account = isResubmit ? await resubmitEducator(resubmitAccount.id, form) : await registerEducator(form);
      setUser({
        id: account.id,
        name: account.profile.fullName,
        identifier: account.email,
        role: "teacher",
        onboardingComplete: true,
      });
      setCompleted(account);
    } catch (err) {
      setSubmitError(err?.code === "email_taken" ? "email_taken" : "generic");
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    setTouched({});
    setSubmitError(null);
    setStepIndex((i) => i - 1);
  };

  if (completed) {
    const meta = EDUCATOR_STATUS_META[completed.status];
    return (
      <div className="relative min-h-screen w-full">
        <AuthBackdrop />
        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
          <div className="w-full max-w-3xl rounded-3xl bg-white px-5 py-7 shadow-soft sm:px-8">
            <div className="grid gap-7 sm:grid-cols-[260px_1fr] sm:items-center">
              <DigitalIDCard profile={toIdCardProfile(completed)} maxWidthClass="max-w-[260px]" />
              <div>
                <StatusBadge status={meta.badgeStatus}>{meta.label}</StatusBadge>
                <h1 className="mt-2 font-display text-xl text-text">
                  {isResubmit ? "Profile resubmitted" : "You're registered — welcome aboard"}
                </h1>
                <p className="mt-2 text-sm text-muted">
                  We've received your account, profile and documents in one go. You're already signed in and can
                  explore the portal; your dashboard content unlocks as soon as our team approves your profile
                  (usually within 2–3 business days).
                </p>
                <div className="mt-3 flex items-start gap-2.5 rounded-2xl bg-pastel-blue px-4 py-3 text-xs text-pastel-blue-ink">
                  <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    This Digital ID Card is provisional. It becomes your verified, shareable credential after approval.
                  </span>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button shape="rect" fullWidth={false} className="px-6" onClick={() => navigate("/teacher")}>
                    Go to my portal
                  </Button>
                  <Link to="/teacher/profilesetup" className="text-sm font-semibold text-primary hover:underline">
                    View ID card
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full">
      <AuthBackdrop />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Link to={isResubmit ? "/teacher" : "/teacher/login"} className="font-display text-lg tracking-tight text-primary">
              Universal Learning
            </Link>
            <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
              {!isResubmit && (
                <Link to="/teacher/login" className="text-xs font-semibold text-primary hover:underline">
                  Already have an account? Sign in
                </Link>
              )}
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                {isResubmit ? "Update Your Profile" : "Educator Registration"}
              </span>
            </div>
          </div>

          <div className="rounded-3xl bg-white px-5 py-6 shadow-soft sm:px-10">
            {isResubmit && resubmitAccount.adminFeedback && (
              <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
                <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">What our team asked you to fix</p>
                  <p className="mt-0.5 text-danger/90">"{resubmitAccount.adminFeedback}"</p>
                </div>
              </div>
            )}

            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold text-text">{STEP_META[stepIndex].title}</h1>
                <p className="mt-1 text-sm text-muted">{STEP_META[stepIndex].subtitle}</p>
              </div>
              <span className="shrink-0 rounded-full border border-text/15 px-3 py-1 text-xs font-semibold text-muted">
                Step {stepIndex + 1} of {STEPS.length}
              </span>
            </div>

            {/* Steps stay legible on narrow screens: the indicator scrolls sideways
                instead of squashing five labels into a phone-width row. */}
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <div className="min-w-[440px]">
                <ProgressSteps steps={STEPS} currentIndex={stepIndex} />
              </div>
            </div>

            <div className="mt-4 border-t border-text/10 pt-5">
              {/* ------------------------------------------------ Step 1: Account & Contact */}
              {stepIndex === 0 && (
                <div className="space-y-4">
                  <SectionLabel>Your account</SectionLabel>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      shape="rect"
                      label={<FieldLabel required>Full Name</FieldLabel>}
                      placeholder="e.g. Priya Sharma"
                      className="px-3 py-2 text-sm"
                      value={form.fullName}
                      onChange={(e) => set("fullName")(e.target.value)}
                      onBlur={markTouched("fullName")}
                      error={errorFor("fullName", form.fullName.trim().length >= 2 ? "" : "Enter your full name")}
                    />
                    <Input
                      shape="rect"
                      label={<FieldLabel required>Email</FieldLabel>}
                      type="email"
                      placeholder="you@example.com"
                      className="px-3 py-2 text-sm"
                      value={form.email}
                      disabled={isResubmit}
                      onChange={(e) => set("email")(e.target.value)}
                      onBlur={markTouched("email")}
                      error={errorFor(
                        "email",
                        !EMAIL_RE.test(form.email)
                          ? "Enter a valid email address"
                          : emailTaken
                          ? "An account with this email already exists — log in instead"
                          : ""
                      )}
                    />
                  </div>
                  {!isResubmit && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        shape="rect"
                        label={<FieldLabel required>Password</FieldLabel>}
                        type="password"
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        className="px-3 py-2 text-sm"
                        value={form.password}
                        onChange={(e) => set("password")(e.target.value)}
                        onBlur={markTouched("password")}
                        helperText="Min 8 characters, with a letter and a number."
                        error={errorFor("password", passwordOk ? "" : "Use at least 8 characters with a letter and a number")}
                      />
                      <Input
                        shape="rect"
                        label={<FieldLabel required>Confirm Password</FieldLabel>}
                        type="password"
                        autoComplete="new-password"
                        placeholder="Re-enter your password"
                        className="px-3 py-2 text-sm"
                        value={form.confirmPassword}
                        onChange={(e) => set("confirmPassword")(e.target.value)}
                        onBlur={markTouched("confirmPassword")}
                        error={errorFor("confirmPassword", confirmOk ? "" : "Passwords don't match")}
                      />
                    </div>
                  )}

                  <div className="border-t border-text/10 pt-4">
                    <SectionLabel>Contact details</SectionLabel>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel required>Phone Number</FieldLabel>
                      <div className="flex gap-1.5">
                        <Select
                          wrapperClassName="block w-[5.5rem] shrink-0"
                          aria-label="Country calling code"
                          value={form.dialCode}
                          onChange={(e) => set("dialCode")(e.target.value)}
                          className="w-full rounded-lg border border-text/15 bg-bg px-2 py-2 pr-7 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                          chevronClassName="right-2 h-3.5 w-3.5"
                        >
                          {DIAL_CODES.map((d) => (
                            <option key={d.code} value={d.code}>{d.code}</option>
                          ))}
                        </Select>
                        <input
                          type="tel"
                          inputMode="numeric"
                          placeholder="9876543210"
                          className={`w-full rounded-lg border bg-bg px-3 py-2 text-sm text-text outline-none transition-colors duration-150 placeholder:text-muted focus:ring-2 ${
                            errorFor("phone", form.phone.trim().length >= 7 ? "" : "x")
                              ? "border-danger focus:border-danger focus:ring-danger/15"
                              : "border-text/15 focus:border-primary focus:ring-primary/15"
                          }`}
                          value={form.phone}
                          onChange={(e) => set("phone")(e.target.value.replace(/[^\d]/g, ""))}
                          onBlur={markTouched("phone")}
                        />
                      </div>
                      {errorFor("phone", form.phone.trim().length >= 7 ? "" : "x") && (
                        <span className="mt-1 block text-xs text-danger">Enter a valid phone number</span>
                      )}
                    </div>
                    <Input
                      shape="rect"
                      label={<FieldLabel>Alternate Phone (optional)</FieldLabel>}
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      className="px-3 py-2 text-sm"
                      value={form.altPhone}
                      onChange={(e) => set("altPhone")(e.target.value)}
                    />
                  </div>
                  <Input
                    shape="rect"
                    label={<FieldLabel required>Street Address</FieldLabel>}
                    placeholder="123 Contractor Lane, Suite 100"
                    className="px-3 py-2 text-sm"
                    value={form.address}
                    onChange={(e) => set("address")(e.target.value)}
                    onBlur={markTouched("address")}
                    error={errorFor("address", form.address.trim() ? "" : "Street address is required")}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel required>Country</FieldLabel>
                      <SelectField
                        placeholder="Select country"
                        options={COUNTRIES}
                        value={form.country}
                        onChange={(e) => {
                          set("country")(e.target.value);
                          set("state")("");
                          set("otherState")("");
                          markTouched("country")();
                        }}
                        onBlur={markTouched("country")}
                        error={errorFor("country", form.country ? "" : "Select a country")}
                      />
                    </div>
                    <div>
                      <FieldLabel required>State / Province</FieldLabel>
                      {form.country === "Other" ? (
                        <input
                          type="text"
                          placeholder="Enter your state/province"
                          className={`w-full rounded-lg border bg-bg px-3 py-2 text-sm text-text outline-none transition-colors duration-150 placeholder:text-muted focus:ring-2 ${
                            errorFor("state", form.otherState.trim() ? "" : "Required")
                              ? "border-danger focus:border-danger focus:ring-danger/15"
                              : "border-text/15 focus:border-primary focus:ring-primary/15"
                          }`}
                          value={form.otherState}
                          onChange={(e) => set("otherState")(e.target.value)}
                          onBlur={markTouched("state")}
                        />
                      ) : (
                        <SelectField
                          placeholder={form.country ? "Select state" : "Select a country first"}
                          options={COUNTRY_STATE_MAP[form.country] ?? []}
                          value={form.state}
                          disabled={!form.country}
                          onChange={(e) => set("state")(e.target.value)}
                          onBlur={markTouched("state")}
                          error={errorFor("state", form.state ? "" : "Select a state")}
                        />
                      )}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      shape="rect"
                      label={<FieldLabel required>City</FieldLabel>}
                      placeholder="e.g. Bengaluru"
                      className="px-3 py-2 text-sm"
                      value={form.city}
                      onChange={(e) => set("city")(e.target.value)}
                      onBlur={markTouched("city")}
                      error={errorFor("city", form.city.trim() ? "" : "Required")}
                    />
                    <Input
                      shape="rect"
                      label={<FieldLabel required>Zip Code</FieldLabel>}
                      placeholder="10004"
                      className="px-3 py-2 text-sm"
                      value={form.zipCode}
                      onChange={(e) => set("zipCode")(e.target.value)}
                      onBlur={markTouched("zipCode")}
                      error={errorFor("zipCode", form.zipCode.trim() ? "" : "Required")}
                    />
                  </div>
                </div>
              )}

              {/* ------------------------------------------------ Step 2: Teaching Profile */}
              {stepIndex === 1 && (
                <div className="space-y-6">
                  <div>
                    <SectionLabel hint="Optional — a clear, friendly photo helps students trust your profile.">Photo</SectionLabel>
                    <PhotoUploader file={form.photo} fallbackName={form.fullName} onChange={set("photo")} />
                  </div>

                  <div className="space-y-4 border-t border-text/10 pt-5">
                    <SectionLabel>Basic information</SectionLabel>
                    <Input
                      shape="rect"
                      label={<FieldLabel required>Professional Headline</FieldLabel>}
                      placeholder="e.g. Certified Math Educator, 8+ yrs"
                      className="px-3 py-2 text-sm"
                      value={form.headline}
                      onChange={(e) => set("headline")(e.target.value)}
                      onBlur={markTouched("headline")}
                      error={errorFor("headline", form.headline.trim() ? "" : "This field is required")}
                    />
                    <label className="block">
                      <FieldLabel required>Bio</FieldLabel>
                      <textarea
                        rows={4}
                        className={`w-full rounded-lg border bg-bg px-3 py-2 text-sm text-text outline-none transition-colors duration-150 placeholder:text-muted focus:ring-2 ${
                          errorFor("bio", form.bio.trim().length >= 20 ? "" : "x")
                            ? "border-danger focus:border-danger focus:ring-danger/15"
                            : "border-text/15 focus:border-primary focus:ring-primary/15"
                        }`}
                        placeholder="Tell students and parents about your teaching style, experience and what makes your classes stand out."
                        value={form.bio}
                        onChange={(e) => set("bio")(e.target.value)}
                        onBlur={markTouched("bio")}
                      />
                      <span className="mt-1 flex items-center justify-between text-xs">
                        <span className="text-danger">
                          {errorFor("bio", form.bio.trim().length >= 20 ? "" : "Write at least 20 characters")}
                        </span>
                        <span className="text-muted">{form.bio.trim().length}/600</span>
                      </span>
                    </label>
                    <div>
                      <FieldLabel>Pronouns (optional)</FieldLabel>
                      <div className="flex flex-wrap gap-2">
                        {PRONOUNS.map((p) => (
                          <Chip key={p} active={form.pronouns === p} onClick={() => set("pronouns")(form.pronouns === p ? "" : p)}>
                            {p}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-text/10 pt-5">
                    <SectionLabel>Teaching background</SectionLabel>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <FieldLabel required>Highest Qualification</FieldLabel>
                        <SelectField
                          placeholder="Select qualification"
                          options={QUALIFICATIONS}
                          value={form.qualification}
                          onChange={(e) => set("qualification")(e.target.value)}
                          onBlur={markTouched("qualification")}
                          error={errorFor("qualification", form.qualification ? "" : "Select a qualification")}
                        />
                      </div>
                      <Input
                        shape="rect"
                        label={<FieldLabel required>Institution / University</FieldLabel>}
                        placeholder="e.g. University of Delhi"
                        className="px-3 py-2 text-sm"
                        value={form.institution}
                        onChange={(e) => set("institution")(e.target.value)}
                        onBlur={markTouched("institution")}
                        error={errorFor("institution", form.institution.trim() ? "" : "This field is required")}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        shape="rect"
                        label={<FieldLabel required>Years of Teaching Experience</FieldLabel>}
                        type="number"
                        min="0"
                        placeholder="e.g. 8"
                        className="px-3 py-2 text-sm"
                        value={form.experience}
                        onChange={(e) => set("experience")(e.target.value)}
                        onBlur={markTouched("experience")}
                        error={errorFor("experience", form.experience.trim() ? "" : "This field is required")}
                      />
                      <Input
                        shape="rect"
                        label={<FieldLabel>LinkedIn Profile (optional)</FieldLabel>}
                        placeholder="linkedin.com/in/yourname"
                        className="px-3 py-2 text-sm"
                        value={form.linkedin}
                        onChange={(e) => set("linkedin")(e.target.value)}
                      />
                    </div>
                    <Input
                      shape="rect"
                      label={<FieldLabel>Portfolio / Website (optional)</FieldLabel>}
                      placeholder="www.yoursite.com"
                      className="px-3 py-2 text-sm"
                      value={form.website}
                      onChange={(e) => set("website")(e.target.value)}
                    />

                    <div>
                      <div className="mb-1 flex items-center gap-1.5">
                        <FieldLabel required className="mb-0">Primary Subject Area</FieldLabel>
                        <span title="Add up to 5 more subject areas" className="text-muted">
                          <InfoIcon />
                        </span>
                        {form.additionalSubjects.length < 5 && (
                          <button
                            type="button"
                            onClick={() => setAddSubjectOpen((o) => !o)}
                            aria-label="Add another subject area"
                            className="ml-auto flex h-5 w-5 items-center justify-center rounded-full border border-primary/40 text-primary hover:bg-primary/5"
                          >
                            <PlusIcon className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <SelectField
                        placeholder="Select subject"
                        options={SUBJECT_AREAS}
                        value={form.primarySubject}
                        onChange={(e) => {
                          set("primarySubject")(e.target.value);
                          set("additionalSubjects")(form.additionalSubjects.filter((s) => s !== e.target.value));
                        }}
                        onBlur={markTouched("primarySubject")}
                        error={errorFor("primarySubject", form.primarySubject ? "" : "Select a subject")}
                      />
                      {addSubjectOpen && (
                        <div className="mt-1.5">
                          <SelectField
                            placeholder="Choose an additional subject"
                            options={availableExtraSubjects}
                            value=""
                            onChange={(e) => addAdditionalSubject(e.target.value)}
                          />
                        </div>
                      )}
                      {form.additionalSubjects.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {form.additionalSubjects.map((s) => (
                            <span key={s} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                              {s}
                              <button type="button" onClick={() => removeAdditionalSubject(s)} aria-label={`Remove ${s}`} className="text-primary/60 hover:text-primary">
                                <XIcon className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <FieldLabel required>Preferred Teaching Mode</FieldLabel>
                      <div className="flex flex-wrap gap-2">
                        {TEACHING_MODES.map((m) => (
                          <Chip key={m} active={form.teachingModes.includes(m)} onClick={() => toggleTeachingMode(m)}>
                            {m}
                          </Chip>
                        ))}
                      </div>
                      {errorFor("teachingModes", form.teachingModes.length > 0 ? "" : "x") && (
                        <span className="mt-1 block text-xs text-danger">Select at least one teaching mode</span>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-text/10 pt-5">
                    <SectionLabel>Grades &amp; subjects taught</SectionLabel>
                    <div className="space-y-3">
                      {form.gradeRows.map((row) => (
                        <SubjectGradeRow
                          key={row.id}
                          row={row}
                          onChange={(next) => updateGradeRow(row.id, next)}
                          onRemove={() => removeGradeRow(row.id)}
                          removable={form.gradeRows.length > 1}
                          gradeOptions={GRADES}
                          subjectOptions={SUBJECTS}
                          error={
                            touched.gradeRows
                              ? {
                                  grade: row.grade ? "" : "Select a grade",
                                  subjects: row.subjects.length > 0 ? "" : "Select at least one subject",
                                }
                              : undefined
                          }
                        />
                      ))}
                    </div>
                    {touched.gradeRows && !gradeRowsValid && (
                      <p className="mt-2 text-xs text-danger">Every row needs a grade and at least one subject.</p>
                    )}
                    <button
                      type="button"
                      onClick={addGradeRow}
                      onBlur={markTouched("gradeRows")}
                      className="mt-3 text-sm font-semibold text-primary hover:underline"
                    >
                      + Add another grade
                    </button>
                  </div>

                  <div className="border-t border-text/10 pt-5">
                    <SectionLabel hint="Optional — helps students and Discovery search find your specific strengths.">
                      Teaching specializations
                    </SectionLabel>
                    <div className="flex flex-wrap gap-2">
                      {SPECIALIZATIONS.map((s) => (
                        <Chip key={s} active={form.specializations.includes(s)} onClick={() => toggleSpecialization(s)}>
                          {s}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-text/10 pt-5">
                    <SectionLabel>
                      Teaching languages <span className="ml-0.5 text-danger">*</span>
                    </SectionLabel>
                    <div className="flex flex-wrap gap-2">
                      {LANGUAGES.map((lang) => (
                        <Chip key={lang} active={form.languages.includes(lang)} onClick={() => toggleLanguage(lang)}>
                          {lang}
                        </Chip>
                      ))}
                    </div>
                    {errorFor("languages", form.languages.length > 0 ? "" : "x") && (
                      <p className="mt-2 text-xs text-danger">Select at least one language.</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-text/10 pt-5">
                    <div>
                      <p className="text-sm font-medium text-text">List me in Discovery search</p>
                      <p className="mt-0.5 text-xs text-muted">Students can find and view your public profile once you're verified.</p>
                    </div>
                    <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        aria-label="List me in Discovery search"
                        checked={form.listInDiscovery}
                        onChange={(e) => set("listInDiscovery")(e.target.checked)}
                      />
                      <span className="h-6 w-11 rounded-full bg-text/20 transition-colors duration-150 peer-checked:bg-primary" />
                      <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition-transform duration-150 peer-checked:translate-x-5" />
                    </label>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------ Step 3: Career History */}
              {stepIndex === 2 && (
                <div className="space-y-7">
                  <div>
                    <SectionLabel hint="Optional — add every teaching or education-related role you've held.">Work experience</SectionLabel>
                    <RepeatableEntryList
                      items={form.workExperience}
                      fields={WORK_FIELDS}
                      requiredKeys={["jobTitle", "employer"]}
                      entryLabel={(item, i) => item.jobTitle || `Experience ${i + 1}`}
                      addLabel="Add work experience"
                      emptyLabel="No work experience added yet."
                      onAdd={() => workHelpers.onAdd(emptyWorkExperience)}
                      onChange={workHelpers.onChange}
                      onRemove={workHelpers.onRemove}
                    />
                  </div>
                  <div className="border-t border-text/10 pt-6">
                    <SectionLabel hint="Optional — degrees, diplomas or other academic qualifications.">Education</SectionLabel>
                    <RepeatableEntryList
                      items={form.education}
                      fields={EDUCATION_FIELDS}
                      requiredKeys={["degree", "institution"]}
                      entryLabel={(item, i) => item.degree || `Education ${i + 1}`}
                      addLabel="Add education"
                      emptyLabel="No education added yet."
                      onAdd={() => educationHelpers.onAdd(emptyEducation)}
                      onChange={educationHelpers.onChange}
                      onRemove={educationHelpers.onRemove}
                    />
                  </div>
                  <div className="border-t border-text/10 pt-6">
                    <SectionLabel hint="Optional — teaching licenses, subject certifications, training credentials.">
                      Professional certifications &amp; licenses
                    </SectionLabel>
                    <RepeatableEntryList
                      items={form.certifications}
                      fields={CERTIFICATION_FIELDS}
                      requiredKeys={["name", "issuingOrg"]}
                      entryLabel={(item, i) => item.name || `Certification ${i + 1}`}
                      addLabel="Add certification"
                      emptyLabel="No certifications added yet."
                      onAdd={() => certificationHelpers.onAdd(emptyCertification)}
                      onChange={certificationHelpers.onChange}
                      onRemove={certificationHelpers.onRemove}
                    />
                  </div>
                  <div className="border-t border-text/10 pt-6">
                    <SectionLabel hint="Optional — tutoring programs, community teaching, non-profit involvement.">
                      Volunteer &amp; community involvement
                    </SectionLabel>
                    <RepeatableEntryList
                      items={form.volunteering}
                      fields={VOLUNTEER_FIELDS}
                      requiredKeys={["organization", "role"]}
                      entryLabel={(item, i) => item.organization || `Volunteer work ${i + 1}`}
                      addLabel="Add volunteer work"
                      emptyLabel="No volunteer work added yet."
                      onAdd={() => volunteerHelpers.onAdd(emptyVolunteering)}
                      onChange={volunteerHelpers.onChange}
                      onRemove={volunteerHelpers.onRemove}
                    />
                  </div>
                  <div className="border-t border-text/10 pt-6">
                    <SectionLabel hint="Optional — teaching awards, honors, published work or media recognition.">
                      Awards &amp; recognitions
                    </SectionLabel>
                    <RepeatableEntryList
                      items={form.awards}
                      fields={AWARD_FIELDS}
                      requiredKeys={["title", "issuer"]}
                      entryLabel={(item, i) => item.title || `Award ${i + 1}`}
                      addLabel="Add award"
                      emptyLabel="No awards added yet."
                      onAdd={() => awardHelpers.onAdd(emptyAward)}
                      onChange={awardHelpers.onChange}
                      onRemove={awardHelpers.onRemove}
                    />
                  </div>
                  <div className="border-t border-text/10 pt-6">
                    <SectionLabel hint="Optional — former colleagues, principals or institutions who can vouch for you.">
                      Professional references
                    </SectionLabel>
                    <RepeatableEntryList
                      items={form.referenceList}
                      fields={REFERENCE_FIELDS}
                      requiredKeys={["name", "relationship"]}
                      entryLabel={(item, i) => item.name || `Reference ${i + 1}`}
                      addLabel="Add reference"
                      emptyLabel="No references added yet."
                      onAdd={() => referenceHelpers.onAdd(emptyReference)}
                      onChange={referenceHelpers.onChange}
                      onRemove={referenceHelpers.onRemove}
                    />
                  </div>
                </div>
              )}

              {/* ------------------------------------------------ Step 4: Your Objective */}
              {stepIndex === 3 && (
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <SectionHeading>What best describes your objective? *</SectionHeading>
                    <div className="space-y-2">
                      {OBJECTIVES.map((o) => (
                        <Checkbox key={o} label={o} checked={form.objectives.includes(o)} onChange={() => toggleObjective(o)} />
                      ))}
                    </div>
                    {errorFor("objectives", form.objectives.length > 0 ? "" : "x") && (
                      <span className="mt-1 block text-xs text-danger">Select at least one objective</span>
                    )}
                  </div>
                  <div>
                    <SectionHeading>How do you work? *</SectionHeading>
                    <div className="space-y-2">
                      {EMPLOYMENT_TYPES.map((type) => (
                        <label key={type} className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
                          <input
                            type="radio"
                            name="employmentType"
                            className="h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                            checked={form.employmentType === type}
                            onChange={() => {
                              set("employmentType")(type);
                              markTouched("employmentType")();
                            }}
                          />
                          {type}
                        </label>
                      ))}
                    </div>
                    {errorFor("employmentType", form.employmentType ? "" : "x") && (
                      <span className="mt-1 block text-xs text-danger">Choose how you work</span>
                    )}
                    <div className="mt-5">
                      <SectionHeading>Preferred student age group *</SectionHeading>
                      <div className="flex flex-wrap gap-2.5">
                        {AGE_GROUPS.map((g) => (
                          <Chip key={g} active={form.ageGroups.includes(g)} onClick={() => toggleAgeGroup(g)}>
                            {g}
                          </Chip>
                        ))}
                      </div>
                      {errorFor("ageGroups", form.ageGroups.length > 0 ? "" : "x") && (
                        <span className="mt-1 block text-xs text-danger">Select at least one age group</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------ Step 5: Verify */}
              {stepIndex === 4 && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel required>Government-issued ID</FieldLabel>
                      <FileDropzone
                        label="Click or drag to upload"
                        hint="PNG, JPG or PDF"
                        file={form.govId}
                        status={form.govIdStatus}
                        onFileSelect={(f) => {
                          set("govId")(f);
                          set("govIdStatus")("success");
                        }}
                        onRetry={() => set("govIdStatus")("success")}
                      />
                      {errorFor("govId", form.govId ? "" : "x") && <span className="mt-1 block text-xs text-danger">Upload your ID</span>}
                    </div>
                    <div>
                      <FieldLabel required>Teaching Certificate / Degree</FieldLabel>
                      <FileDropzone
                        label="Click or drag to upload"
                        hint="PNG, JPG or PDF"
                        file={form.certificate}
                        status={form.certificateStatus}
                        onFileSelect={(f) => {
                          set("certificate")(f);
                          set("certificateStatus")("success");
                        }}
                        onRetry={() => set("certificateStatus")("success")}
                      />
                      {errorFor("certificate", form.certificate ? "" : "x") && (
                        <span className="mt-1 block text-xs text-danger">Upload your certificate or degree</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <FieldLabel required={!form.noBackgroundCheck}>Background Check</FieldLabel>
                      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[11px] font-medium text-muted">
                        My subject does not require this
                        <span className="relative inline-flex">
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={form.noBackgroundCheck}
                            onChange={(e) => set("noBackgroundCheck")(e.target.checked)}
                          />
                          <span className="h-5 w-9 rounded-full bg-text/20 transition-colors duration-150 peer-checked:bg-primary" />
                          <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-150 peer-checked:translate-x-4" />
                        </span>
                      </label>
                    </div>
                    {!form.noBackgroundCheck && (
                      <>
                        <FileDropzone
                          label="Click or drag to upload"
                          hint="PNG, JPG or PDF"
                          file={form.backgroundCheck}
                          status={form.backgroundCheckStatus}
                          onFileSelect={(f) => {
                            set("backgroundCheck")(f);
                            set("backgroundCheckStatus")("success");
                          }}
                          onRetry={() => set("backgroundCheckStatus")("success")}
                        />
                        {errorFor("backgroundCheck", form.backgroundCheck ? "" : "x") && (
                          <span className="mt-1 block text-xs text-danger">Upload your background check, or switch the toggle above</span>
                        )}
                      </>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel>Resume / CV (optional)</FieldLabel>
                      <FileDropzone label="Click or drag to upload" hint="PDF or DOCX" file={form.resume} onFileSelect={set("resume")} />
                    </div>
                    <div>
                      <FieldLabel>Additional reference notes (optional)</FieldLabel>
                      <textarea
                        className="w-full rounded-lg border border-text/15 bg-bg px-3 py-2 text-sm text-text outline-none transition-colors duration-150 placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
                        rows={2}
                        placeholder="Name, relationship and contact info of a former colleague"
                        value={form.references}
                        onChange={(e) => set("references")(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-text/10 pt-3">
                    <Checkbox
                      label={
                        <span>
                          I agree to the <span className="font-semibold text-primary">terms</span> and{" "}
                          <span className="font-semibold text-primary">conditions</span> of certification
                        </span>
                      }
                      checked={form.acceptedTerms}
                      onChange={(e) => set("acceptedTerms")(e.target.checked)}
                    />
                    <Checkbox
                      label={
                        <span>
                          I consent to Universal Learning verifying the documents above and storing them per the{" "}
                          <span className="font-semibold text-primary">privacy policy</span>
                        </span>
                      }
                      checked={form.acceptedPrivacy}
                      onChange={(e) => set("acceptedPrivacy")(e.target.checked)}
                    />
                  </div>

                  <div className="flex items-start gap-2.5 rounded-2xl bg-pastel-blue px-4 py-3 text-xs text-pastel-blue-ink">
                    <ClockIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      After you submit you can sign in straight away. Your dashboard content unlocks once our team
                      approves your profile, and your Digital ID Card becomes Verified at that point.
                    </span>
                  </div>

                  {submitError && (
                    <div role="alert" className="flex items-start gap-2.5 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
                      <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        {submitError === "email_taken" ? (
                          <>
                            <p className="font-semibold">That email is already registered.</p>
                            <p className="mt-0.5 text-danger/80">
                              <Link to="/login" className="font-semibold underline">Log in</Link> instead, or go back and use a different email.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-semibold">We couldn't submit your registration.</p>
                            <p className="mt-0.5 text-danger/80">Nothing was lost — check your connection and try again.</p>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-text/10 pt-4">
              {stepIndex > 0 ? (
                <Button variant="secondary" shape="rect" fullWidth={false} className="px-6" onClick={goBack} disabled={submitting}>
                  Back
                </Button>
              ) : (
                <span />
              )}
              <div className="flex flex-col items-end gap-2">
                {!isStepValid && Object.keys(touched).length > 0 && (
                  <span className="text-xs font-medium text-danger">Please fill in all required fields to continue.</span>
                )}
                <Button
                  shape="rect"
                  fullWidth={false}
                  className={`px-7 ${!isStepValid ? "opacity-50" : ""}`}
                  aria-disabled={submitting}
                  disabled={submitting}
                  onClick={handleContinue}
                >
                  {submitting
                    ? "Submitting…"
                    : stepIndex === STEPS.length - 1
                    ? submitError === "generic"
                      ? "Try again"
                      : isResubmit
                      ? "Resubmit for Review"
                      : "Submit for Review"
                    : "Next and Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
