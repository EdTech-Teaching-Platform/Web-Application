// Edit profile — "My profile" from the avatar menu.
//
// A settings-style page (NOT the onboarding wizard): every detail asked at
// onboarding lives here as a section card on one scrolling page, with a
// section jump-list on the left and a single "Save changes" bar. Saves to the
// same educator record via updateEducatorProfile(); an approved educator stays
// approved. Email is read-only and there is no password field.
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import Chip from "../../../components/ui/Chip";
import Checkbox from "../../../components/ui/Checkbox";
import FileDropzone from "../../../components/ui/FileDropzone";
import { InfoIcon, PlusIcon, XIcon, AlertTriangleIcon, CheckIcon, UsersIcon, BookIcon, CertificateIcon, FlagIcon, FileTextIcon } from "../../../components/ui/icons";
import PhotoUploader from "../components/PhotoUploader";
import SubjectGradeRow from "../components/SubjectGradeRow";
import RepeatableEntryList from "../components/RepeatableEntryList";
import {
  SUBJECT_AREAS, QUALIFICATIONS, TEACHING_MODES, OBJECTIVES, EMPLOYMENT_TYPES, AGE_GROUPS, DIAL_CODES,
  COUNTRY_STATE_MAP, COUNTRIES, GRADES, SUBJECTS, LANGUAGES, PRONOUNS, SPECIALIZATIONS,
  emptyGradeRow, emptyWorkExperience, emptyEducation, emptyCertification, emptyVolunteering, emptyAward,
  emptyReference, WORK_FIELDS, EDUCATION_FIELDS, CERTIFICATION_FIELDS, VOLUNTEER_FIELDS, AWARD_FIELDS,
  REFERENCE_FIELDS, createInitialForm,
} from "../data/educatorRegistrationData";
import { useCurrentEducator, updateEducatorProfile } from "../data/educatorAccountStore";

const SECTIONS = [
  { id: "personal", label: "Personal & contact", icon: UsersIcon },
  { id: "teaching", label: "Teaching profile", icon: BookIcon },
  { id: "career", label: "Career history", icon: FileTextIcon },
  { id: "goals", label: "Your objective", icon: FlagIcon },
  { id: "documents", label: "Documents", icon: CertificateIcon },
];

function formFromAccount(account) {
  const base = createInitialForm();
  const p = account.profile || {};
  return {
    ...base,
    ...p,
    gradeRows: p.gradeRows?.length ? p.gradeRows : base.gradeRows,
    workExperience: p.workExperience ?? [],
    education: p.education ?? [],
    certifications: p.certifications ?? [],
    volunteering: p.volunteering ?? [],
    awards: p.awards ?? [],
    referenceList: p.referenceList ?? [],
    additionalSubjects: p.additionalSubjects ?? [],
    teachingModes: p.teachingModes ?? [],
    specializations: p.specializations ?? [],
    languages: p.languages ?? [],
    objectives: p.objectives ?? [],
    ageGroups: p.ageGroups ?? [],
    email: account.email,
    password: "",
    confirmPassword: "",
    govId: account.documents?.govId ?? null,
    certificate: account.documents?.certificate ?? null,
    backgroundCheck: account.documents?.backgroundCheck ?? null,
    resume: account.documents?.resume ?? null,
    photo: null,
  };
}

const inputCls = "w-full rounded-xl border border-(--lp-line) bg-white px-3.5 py-2.5 text-sm text-(--lp-ink) outline-none transition-colors placeholder:text-(--lp-muted)/70 focus:border-(--lp-blue) focus:ring-2 focus:ring-(--lp-blue)/15";
const errCls = "!border-danger focus:!border-danger focus:!ring-danger/15";

function Label({ children, required, optional }) {
  return (
    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-(--lp-muted)">
      {children}
      {required && <span className="ml-0.5 text-danger">*</span>}
      {optional && <span className="ml-1 font-medium normal-case tracking-normal text-(--lp-muted)/70">(optional)</span>}
    </span>
  );
}

function Err({ children }) {
  return children ? <span className="mt-1 block text-xs text-danger">{children}</span> : null;
}

function Card({ id, icon: Icon, title, subtitle, children }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-[1.75rem] bg-white p-5 shadow-[0_18px_40px_-30px_rgba(15,17,21,0.3)] ring-1 ring-(--lp-line) sm:p-7">
      <div className="mb-5 flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-(--lp-blue-tint) text-(--lp-blue-deep)"><Icon className="h-5 w-5" /></span>
        <div>
          <h2 className="font-(family-name:--lp-font) text-lg font-bold tracking-tight text-(--lp-ink)">{title}</h2>
          <p className="mt-0.5 text-sm text-(--lp-muted)">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Sub({ children, hint }) {
  return (
    <div className="border-t border-(--lp-line) pt-5">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-(--lp-muted)">{children}</h3>
      {hint && <p className="mt-1 text-xs text-(--lp-muted)">{hint}</p>}
    </div>
  );
}

function Pick({ value, onChange, options, placeholder, disabled, invalid }) {
  return (
    <Select
      wrapperClassName="block w-full"
      disabled={disabled}
      className={`${inputCls} pr-9 disabled:cursor-not-allowed disabled:opacity-50 ${invalid ? errCls : ""}`}
      value={value}
      onChange={onChange}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </Select>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="relative inline-flex shrink-0 cursor-pointer items-center">
      <input type="checkbox" className="peer sr-only" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="h-6 w-11 rounded-full bg-(--lp-line) transition-colors peer-checked:bg-(--lp-blue)" />
      <span className="absolute left-1 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
    </label>
  );
}

export default function EditProfile() {
  const account = useCurrentEducator();
  if (!account) return <Navigate to="/teacher/login" replace />;
  return <EditProfileForm account={account} />;
}

function EditProfileForm({ account }) {
  const [form, setForm] = useState(() => formFromAccount(account));
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);

  // Scroll-spy: the section whose top has crossed just under the sticky top
  // bar is "current"; at the very bottom of the page the last one wins.
  useEffect(() => {
    const update = () => {
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) return setActiveSection(SECTIONS[SECTIONS.length - 1].id);
      let current = SECTIONS[0].id;
      for (const { id } of SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 140) current = id;
      }
      setActiveSection(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const set = (field) => (value) => {
    setSaved(false);
    setForm((f) => ({ ...f, [field]: value }));
  };
  const toggleIn = (field) => (label) => {
    setSaved(false);
    setForm((f) => ({ ...f, [field]: f[field].includes(label) ? f[field].filter((o) => o !== label) : [...f[field], label] }));
  };
  const listHelpers = (field) => ({
    onAdd: (makeEmpty) => { setSaved(false); setForm((f) => ({ ...f, [field]: [...f[field], makeEmpty()] })); },
    onChange: (id, next) => { setSaved(false); setForm((f) => ({ ...f, [field]: f[field].map((item) => (item.id === id ? next : item)) })); },
    onRemove: (id) => { setSaved(false); setForm((f) => ({ ...f, [field]: f[field].filter((item) => item.id !== id) })); },
  });
  const work = listHelpers("workExperience");
  const edu = listHelpers("education");
  const certs = listHelpers("certifications");
  const vol = listHelpers("volunteering");
  const awards = listHelpers("awards");
  const refs = listHelpers("referenceList");

  const gradeRowsValid = form.gradeRows.every((r) => r.grade && r.subjects.length > 0);
  const errors = useMemo(() => {
    const e = {};
    if (form.fullName.trim().length < 2) e.fullName = "Enter your full name";
    if (form.phone.trim().length < 7) e.phone = "Enter a valid phone number";
    if (!form.address.trim()) e.address = "Street address is required";
    if (!form.country) e.country = "Select a country";
    if (form.country === "Other" ? !form.otherState.trim() : !form.state) e.state = "Select a state";
    if (!form.city.trim()) e.city = "Required";
    if (!form.zipCode.trim()) e.zipCode = "Required";
    if (!form.headline.trim()) e.headline = "This field is required";
    if (form.bio.trim().length < 20) e.bio = "Write at least 20 characters";
    if (!form.qualification) e.qualification = "Select a qualification";
    if (!form.institution.trim()) e.institution = "This field is required";
    if (!String(form.experience).trim()) e.experience = "This field is required";
    if (!form.primarySubject) e.primarySubject = "Select a subject";
    if (form.teachingModes.length === 0) e.teachingModes = "Select at least one teaching mode";
    if (!gradeRowsValid) e.gradeRows = "Every row needs a grade and at least one subject.";
    if (form.languages.length === 0) e.languages = "Select at least one language.";
    if (form.objectives.length === 0) e.objectives = "Select at least one objective";
    if (!form.employmentType) e.employmentType = "Choose how you work";
    if (form.ageGroups.length === 0) e.ageGroups = "Select at least one age group";
    if (!form.govId) e.govId = "Upload your ID";
    if (!form.certificate) e.certificate = "Upload your certificate or degree";
    if (!form.noBackgroundCheck && !form.backgroundCheck) e.backgroundCheck = "Upload your background check, or switch the toggle above";
    return e;
  }, [form, gradeRowsValid]);
  const errorCount = Object.keys(errors).length;
  const err = (k) => (showErrors ? errors[k] : "");

  const availableExtraSubjects = SUBJECT_AREAS.filter((s) => s !== form.primarySubject && !form.additionalSubjects.includes(s));

  const save = async () => {
    setFailed(false);
    if (errorCount > 0) {
      setShowErrors(true);
      const first = Object.keys(errors)[0];
      document.querySelector(`[data-field="${first}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true);
    try {
      await updateEducatorProfile(account.id, form);
      setSaved(true);
      window.scrollTo?.({ top: 0, behavior: "smooth" });
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const name = form.fullName || account.profile?.fullName || "Educator";

  return (
    <div className="pb-28">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-[2rem] bg-(--lp-ink) px-6 py-7 text-white shadow-[0_24px_50px_-28px_rgba(15,17,21,0.6)] sm:px-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-(--lp-blue)/40 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 right-1/3 h-40 w-40 rounded-full bg-(--lp-yellow)/25 blur-2xl" />
        <div className="relative">
          <span className="inline-flex rounded-full bg-(--lp-yellow) px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-(--lp-ink)">My profile</span>
          <h1 className="mt-3 font-(family-name:--lp-font) text-3xl font-bold tracking-tight sm:text-4xl">Edit profile details</h1>
          <p className="mt-1.5 max-w-xl text-sm text-white/70">Keep your details current. Everything you shared at onboarding lives here, and changes keep your verification status as it is.</p>
        </div>
      </div>

      {saved && (
        <div role="status" className="mt-5 flex items-center gap-3 rounded-2xl bg-(--lp-blue-tint) px-5 py-3.5 text-sm font-semibold text-(--lp-blue-deep) ring-1 ring-(--lp-blue-soft)">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-(--lp-blue) text-white"><CheckIcon className="h-3.5 w-3.5" /></span>
          Profile saved. <Link to="/teacher/profilesetup" className="ml-auto underline">View Digital ID Card</Link>
        </div>
      )}
      {failed && (
        <div role="alert" className="mt-5 flex items-center gap-3 rounded-2xl bg-danger/10 px-5 py-3.5 text-sm font-semibold text-danger">
          <AlertTriangleIcon className="h-4 w-4" /> We couldn't save your changes. Nothing was lost; please try again.
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[14rem_1fr]">
        {/* Section jump-list */}
        <nav aria-label="Profile sections" className="lg:sticky lg:top-24 lg:self-start">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:rounded-[1.5rem] lg:bg-white lg:p-2 lg:ring-1 lg:ring-(--lp-line)">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <a
                key={id}
                href={`#${id}`}
                aria-current={activeSection === id ? "true" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveSection(id);
                  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  activeSection === id
                    ? "bg-(--lp-ink) text-white shadow-[0_10px_22px_-12px_rgba(15,17,21,0.6)]"
                    : "bg-white text-(--lp-muted) ring-1 ring-(--lp-line) hover:bg-(--lp-blue-tint) hover:text-(--lp-ink) lg:bg-transparent lg:ring-0"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </a>
            ))}
          </div>
        </nav>

        <div className="min-w-0 space-y-6">
          {/* ---------------------------------------------- Personal & contact */}
          <Card id="personal" icon={UsersIcon} title="Personal & contact" subtitle="How we and your students reach you.">
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-6">
              <PhotoUploader file={form.photo} fallbackName={name} onChange={set("photo")} />
              <p className="text-xs text-(--lp-muted) sm:max-w-xs">A clear, friendly photo helps students trust your profile. Leave it as is to keep your current photo.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div data-field="fullName">
                <Input shape="rect" label={<Label required>Full name</Label>} className="px-3.5 py-2.5 text-sm" value={form.fullName} onChange={(e) => set("fullName")(e.target.value)} error={err("fullName")} />
              </div>
              <Input shape="rect" label={<Label>Email</Label>} type="email" className="px-3.5 py-2.5 text-sm" value={form.email} disabled helperText="Your login email can't be changed here." />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div data-field="phone">
                <Label required>Phone number</Label>
                <div className="flex gap-1.5">
                  <Select wrapperClassName="block w-[5.5rem] shrink-0" aria-label="Country calling code" value={form.dialCode} onChange={(e) => set("dialCode")(e.target.value)} className={`${inputCls} px-2 pr-7`} chevronClassName="right-2 h-3.5 w-3.5">
                    {DIAL_CODES.map((d) => (<option key={d.code} value={d.code}>{d.code}</option>))}
                  </Select>
                  <input type="tel" inputMode="numeric" placeholder="9876543210" className={`${inputCls} ${err("phone") ? errCls : ""}`} value={form.phone} onChange={(e) => set("phone")(e.target.value.replace(/[^\d]/g, ""))} />
                </div>
                <Err>{err("phone")}</Err>
              </div>
              <Input shape="rect" label={<Label optional>Alternate phone</Label>} type="tel" placeholder="+1 (555) 123-4567" className="px-3.5 py-2.5 text-sm" value={form.altPhone} onChange={(e) => set("altPhone")(e.target.value)} />
            </div>
            <div data-field="address">
              <Input shape="rect" label={<Label required>Street address</Label>} placeholder="123 Contractor Lane, Suite 100" className="px-3.5 py-2.5 text-sm" value={form.address} onChange={(e) => set("address")(e.target.value)} error={err("address")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div data-field="country">
                <Label required>Country</Label>
                <Pick placeholder="Select country" options={COUNTRIES} value={form.country} invalid={!!err("country")} onChange={(e) => { set("country")(e.target.value); set("state")(""); set("otherState")(""); }} />
                <Err>{err("country")}</Err>
              </div>
              <div data-field="state">
                <Label required>State / province</Label>
                {form.country === "Other" ? (
                  <input type="text" placeholder="Enter your state/province" className={`${inputCls} ${err("state") ? errCls : ""}`} value={form.otherState} onChange={(e) => set("otherState")(e.target.value)} />
                ) : (
                  <Pick placeholder={form.country ? "Select state" : "Select a country first"} options={COUNTRY_STATE_MAP[form.country] ?? []} value={form.state} disabled={!form.country} invalid={!!err("state")} onChange={(e) => set("state")(e.target.value)} />
                )}
                <Err>{err("state")}</Err>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div data-field="city">
                <Input shape="rect" label={<Label required>City</Label>} placeholder="e.g. Bengaluru" className="px-3.5 py-2.5 text-sm" value={form.city} onChange={(e) => set("city")(e.target.value)} error={err("city")} />
              </div>
              <div data-field="zipCode">
                <Input shape="rect" label={<Label required>Zip code</Label>} placeholder="10004" className="px-3.5 py-2.5 text-sm" value={form.zipCode} onChange={(e) => set("zipCode")(e.target.value)} error={err("zipCode")} />
              </div>
            </div>
          </Card>

          {/* ---------------------------------------------- Teaching profile */}
          <Card id="teaching" icon={BookIcon} title="Teaching profile" subtitle="What students and parents see on your public profile and Digital ID Card.">
            <div data-field="headline">
              <Input shape="rect" label={<Label required>Professional headline</Label>} placeholder="e.g. Certified Math Educator, 8+ yrs" className="px-3.5 py-2.5 text-sm" value={form.headline} onChange={(e) => set("headline")(e.target.value)} error={err("headline")} />
            </div>
            <label className="block" data-field="bio">
              <Label required>Bio</Label>
              <textarea rows={4} className={`${inputCls} ${err("bio") ? errCls : ""}`} placeholder="Tell students and parents about your teaching style, experience and what makes your classes stand out." value={form.bio} onChange={(e) => set("bio")(e.target.value)} />
              <span className="mt-1 flex items-center justify-between text-xs">
                <span className="text-danger">{err("bio")}</span>
                <span className="text-(--lp-muted)">{form.bio.trim().length}/600</span>
              </span>
            </label>
            <div>
              <Label optional>Pronouns</Label>
              <div className="flex flex-wrap gap-2">
                {PRONOUNS.map((p) => (
                  <Chip key={p} active={form.pronouns === p} onClick={() => set("pronouns")(form.pronouns === p ? "" : p)}>{p}</Chip>
                ))}
              </div>
            </div>

            <Sub>Teaching background</Sub>
            <div className="grid gap-4 sm:grid-cols-2">
              <div data-field="qualification">
                <Label required>Highest qualification</Label>
                <Pick placeholder="Select qualification" options={QUALIFICATIONS} value={form.qualification} invalid={!!err("qualification")} onChange={(e) => set("qualification")(e.target.value)} />
                <Err>{err("qualification")}</Err>
              </div>
              <div data-field="institution">
                <Input shape="rect" label={<Label required>Institution / university</Label>} placeholder="e.g. University of Delhi" className="px-3.5 py-2.5 text-sm" value={form.institution} onChange={(e) => set("institution")(e.target.value)} error={err("institution")} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div data-field="experience">
                <Input shape="rect" label={<Label required>Years of teaching experience</Label>} type="number" min="0" placeholder="e.g. 8" className="px-3.5 py-2.5 text-sm" value={form.experience} onChange={(e) => set("experience")(e.target.value)} error={err("experience")} />
              </div>
              <Input shape="rect" label={<Label optional>LinkedIn profile</Label>} placeholder="linkedin.com/in/yourname" className="px-3.5 py-2.5 text-sm" value={form.linkedin} onChange={(e) => set("linkedin")(e.target.value)} />
            </div>
            <Input shape="rect" label={<Label optional>Portfolio / website</Label>} placeholder="www.yoursite.com" className="px-3.5 py-2.5 text-sm" value={form.website} onChange={(e) => set("website")(e.target.value)} />

            <div data-field="primarySubject">
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-(--lp-muted)">Primary subject area<span className="ml-0.5 text-danger">*</span></span>
                <span title="Add up to 5 more subject areas" className="text-(--lp-muted)"><InfoIcon /></span>
                {form.additionalSubjects.length < 5 && (
                  <button type="button" onClick={() => setAddSubjectOpen((o) => !o)} aria-label="Add another subject area" className="ml-auto grid h-6 w-6 place-items-center rounded-full border border-(--lp-blue)/40 text-(--lp-blue-deep) hover:bg-(--lp-blue-tint)">
                    <PlusIcon className="h-3 w-3" />
                  </button>
                )}
              </div>
              <Pick placeholder="Select subject" options={SUBJECT_AREAS} value={form.primarySubject} invalid={!!err("primarySubject")} onChange={(e) => { set("primarySubject")(e.target.value); set("additionalSubjects")(form.additionalSubjects.filter((s) => s !== e.target.value)); }} />
              <Err>{err("primarySubject")}</Err>
              {addSubjectOpen && (
                <div className="mt-2">
                  <Pick placeholder="Choose an additional subject" options={availableExtraSubjects} value="" onChange={(e) => { if (e.target.value) { set("additionalSubjects")([...form.additionalSubjects, e.target.value]); setAddSubjectOpen(false); } }} />
                </div>
              )}
              {form.additionalSubjects.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.additionalSubjects.map((s) => (
                    <span key={s} className="flex items-center gap-1 rounded-full bg-(--lp-blue-tint) px-2.5 py-1 text-xs font-semibold text-(--lp-blue-deep)">
                      {s}
                      <button type="button" onClick={() => set("additionalSubjects")(form.additionalSubjects.filter((x) => x !== s))} aria-label={`Remove ${s}`} className="text-(--lp-blue-deep)/60 hover:text-(--lp-blue-deep)"><XIcon className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div data-field="teachingModes">
              <Label required>Preferred teaching mode</Label>
              <div className="flex flex-wrap gap-2">
                {TEACHING_MODES.map((m) => (<Chip key={m} active={form.teachingModes.includes(m)} onClick={() => toggleIn("teachingModes")(m)}>{m}</Chip>))}
              </div>
              <Err>{err("teachingModes")}</Err>
            </div>

            <Sub>Grades &amp; subjects taught</Sub>
            <div className="space-y-3" data-field="gradeRows">
              {form.gradeRows.map((row) => (
                <SubjectGradeRow
                  key={row.id}
                  row={row}
                  onChange={(next) => { setSaved(false); setForm((f) => ({ ...f, gradeRows: f.gradeRows.map((r) => (r.id === row.id ? next : r)) })); }}
                  onRemove={() => setForm((f) => ({ ...f, gradeRows: f.gradeRows.length > 1 ? f.gradeRows.filter((r) => r.id !== row.id) : f.gradeRows }))}
                  removable={form.gradeRows.length > 1}
                  gradeOptions={GRADES}
                  subjectOptions={SUBJECTS}
                  error={showErrors ? { grade: row.grade ? "" : "Select a grade", subjects: row.subjects.length > 0 ? "" : "Select at least one subject" } : undefined}
                />
              ))}
              <Err>{err("gradeRows")}</Err>
              <button type="button" onClick={() => setForm((f) => ({ ...f, gradeRows: [...f.gradeRows, emptyGradeRow()] }))} className="text-sm font-semibold text-(--lp-blue-deep) hover:underline">+ Add another grade</button>
            </div>

            <Sub hint="Helps students and Discovery search find your specific strengths.">Teaching specializations</Sub>
            <div className="flex flex-wrap gap-2">
              {SPECIALIZATIONS.map((s) => (<Chip key={s} active={form.specializations.includes(s)} onClick={() => toggleIn("specializations")(s)}>{s}</Chip>))}
            </div>

            <Sub>Teaching languages *</Sub>
            <div data-field="languages">
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((l) => (<Chip key={l} active={form.languages.includes(l)} onClick={() => toggleIn("languages")(l)}>{l}</Chip>))}
              </div>
              <Err>{err("languages")}</Err>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl bg-(--lp-grey) px-4 py-3.5">
              <div>
                <p className="text-sm font-semibold text-(--lp-ink)">List me in Discovery search</p>
                <p className="mt-0.5 text-xs text-(--lp-muted)">Students can find and view your public profile.</p>
              </div>
              <Toggle checked={form.listInDiscovery} onChange={set("listInDiscovery")} label="List me in Discovery search" />
            </div>
          </Card>

          {/* ---------------------------------------------- Career history */}
          <Card id="career" icon={FileTextIcon} title="Career history" subtitle="Optional. A fuller profile builds more trust.">
            <div>
              <Sub hint="Teaching or education-related roles you've held.">Work experience</Sub>
              <div className="mt-3"><RepeatableEntryList items={form.workExperience} fields={WORK_FIELDS} requiredKeys={["jobTitle", "employer"]} entryLabel={(i, n) => i.jobTitle || `Experience ${n + 1}`} addLabel="Add work experience" emptyLabel="No work experience added yet." onAdd={() => work.onAdd(emptyWorkExperience)} onChange={work.onChange} onRemove={work.onRemove} /></div>
            </div>
            <div>
              <Sub hint="Degrees, diplomas or other academic qualifications.">Education</Sub>
              <div className="mt-3"><RepeatableEntryList items={form.education} fields={EDUCATION_FIELDS} requiredKeys={["degree", "institution"]} entryLabel={(i, n) => i.degree || `Education ${n + 1}`} addLabel="Add education" emptyLabel="No education added yet." onAdd={() => edu.onAdd(emptyEducation)} onChange={edu.onChange} onRemove={edu.onRemove} /></div>
            </div>
            <div>
              <Sub hint="Teaching licenses, subject certifications, training credentials.">Professional certifications &amp; licenses</Sub>
              <div className="mt-3"><RepeatableEntryList items={form.certifications} fields={CERTIFICATION_FIELDS} requiredKeys={["name", "issuingOrg"]} entryLabel={(i, n) => i.name || `Certification ${n + 1}`} addLabel="Add certification" emptyLabel="No certifications added yet." onAdd={() => certs.onAdd(emptyCertification)} onChange={certs.onChange} onRemove={certs.onRemove} /></div>
            </div>
            <div>
              <Sub hint="Tutoring programs, community teaching, non-profit involvement.">Volunteer &amp; community involvement</Sub>
              <div className="mt-3"><RepeatableEntryList items={form.volunteering} fields={VOLUNTEER_FIELDS} requiredKeys={["organization", "role"]} entryLabel={(i, n) => i.organization || `Volunteer work ${n + 1}`} addLabel="Add volunteer work" emptyLabel="No volunteer work added yet." onAdd={() => vol.onAdd(emptyVolunteering)} onChange={vol.onChange} onRemove={vol.onRemove} /></div>
            </div>
            <div>
              <Sub hint="Teaching awards, honors, published work or media recognition.">Awards &amp; recognitions</Sub>
              <div className="mt-3"><RepeatableEntryList items={form.awards} fields={AWARD_FIELDS} requiredKeys={["title", "issuer"]} entryLabel={(i, n) => i.title || `Award ${n + 1}`} addLabel="Add award" emptyLabel="No awards added yet." onAdd={() => awards.onAdd(emptyAward)} onChange={awards.onChange} onRemove={awards.onRemove} /></div>
            </div>
            <div>
              <Sub hint="Former colleagues, principals or institutions who can vouch for you.">Professional references</Sub>
              <div className="mt-3"><RepeatableEntryList items={form.referenceList} fields={REFERENCE_FIELDS} requiredKeys={["name", "relationship"]} entryLabel={(i, n) => i.name || `Reference ${n + 1}`} addLabel="Add reference" emptyLabel="No references added yet." onAdd={() => refs.onAdd(emptyReference)} onChange={refs.onChange} onRemove={refs.onRemove} /></div>
            </div>
          </Card>

          {/* ---------------------------------------------- Objective */}
          <Card id="goals" icon={FlagIcon} title="Your objective" subtitle="Your goals help us tailor the experience for you.">
            <div className="grid gap-6 sm:grid-cols-2">
              <div data-field="objectives">
                <Label required>What best describes your objective?</Label>
                <div className="space-y-2">
                  {OBJECTIVES.map((o) => (<Checkbox key={o} label={o} checked={form.objectives.includes(o)} onChange={() => toggleIn("objectives")(o)} />))}
                </div>
                <Err>{err("objectives")}</Err>
              </div>
              <div className="space-y-5">
                <div data-field="employmentType">
                  <Label required>How do you work?</Label>
                  <div className="space-y-2">
                    {EMPLOYMENT_TYPES.map((t) => (
                      <label key={t} className="flex cursor-pointer items-center gap-2.5 text-sm text-(--lp-ink)">
                        <input type="radio" name="employmentType" className="h-4 w-4 shrink-0 accent-(--lp-blue-deep)" checked={form.employmentType === t} onChange={() => set("employmentType")(t)} />
                        {t}
                      </label>
                    ))}
                  </div>
                  <Err>{err("employmentType")}</Err>
                </div>
                <div data-field="ageGroups">
                  <Label required>Preferred student age group</Label>
                  <div className="flex flex-wrap gap-2">
                    {AGE_GROUPS.map((g) => (<Chip key={g} active={form.ageGroups.includes(g)} onClick={() => toggleIn("ageGroups")(g)}>{g}</Chip>))}
                  </div>
                  <Err>{err("ageGroups")}</Err>
                </div>
              </div>
            </div>
          </Card>

          {/* ---------------------------------------------- Documents */}
          <Card id="documents" icon={CertificateIcon} title="Documents" subtitle="Your uploaded verification documents. Upload a new file only to replace one.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div data-field="govId">
                <Label required>Government-issued ID</Label>
                <FileDropzone label="Click or drag to replace" hint="PNG, JPG or PDF" file={form.govId} status={form.govIdStatus} onFileSelect={(f) => { set("govId")(f); set("govIdStatus")("success"); }} onRetry={() => set("govIdStatus")("success")} />
                <Err>{err("govId")}</Err>
              </div>
              <div data-field="certificate">
                <Label required>Teaching certificate / degree</Label>
                <FileDropzone label="Click or drag to replace" hint="PNG, JPG or PDF" file={form.certificate} status={form.certificateStatus} onFileSelect={(f) => { set("certificate")(f); set("certificateStatus")("success"); }} onRetry={() => set("certificateStatus")("success")} />
                <Err>{err("certificate")}</Err>
              </div>
            </div>
            <div data-field="backgroundCheck">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <Label required={!form.noBackgroundCheck}>Background check</Label>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[11px] font-medium text-(--lp-muted)">
                  My subject does not require this
                  <Toggle checked={form.noBackgroundCheck} onChange={set("noBackgroundCheck")} label="My subject does not require a background check" />
                </label>
              </div>
              {!form.noBackgroundCheck && (
                <>
                  <FileDropzone label="Click or drag to replace" hint="PNG, JPG or PDF" file={form.backgroundCheck} status={form.backgroundCheckStatus} onFileSelect={(f) => { set("backgroundCheck")(f); set("backgroundCheckStatus")("success"); }} onRetry={() => set("backgroundCheckStatus")("success")} />
                  <Err>{err("backgroundCheck")}</Err>
                </>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label optional>Resume / CV</Label>
                <FileDropzone label="Click or drag to upload" hint="PDF or DOCX" file={form.resume} onFileSelect={set("resume")} />
              </div>
              <div>
                <Label optional>Additional reference notes</Label>
                <textarea className={inputCls} rows={3} placeholder="Name, relationship and contact info of a former colleague" value={form.references} onChange={(e) => set("references")(e.target.value)} />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 px-3 pb-3 sm:px-5 lg:pl-[17rem] lg:pr-6">
        <div className="mx-auto flex max-w-[1280px] items-center gap-3 rounded-full bg-white/90 px-4 py-2.5 shadow-[0_18px_40px_-16px_rgba(15,17,21,0.4)] ring-1 ring-(--lp-line) backdrop-blur-xl">
          <p className={`min-w-0 flex-1 truncate pl-2 text-xs font-medium ${showErrors && errorCount > 0 ? "text-danger" : "text-(--lp-muted)"}`}>
            {showErrors && errorCount > 0 ? `${errorCount} required field${errorCount > 1 ? "s" : ""} need attention.` : saved ? "All changes saved." : "Review your details, then save."}
          </p>
          <Link to="/teacher/profilesetup" className="rounded-full px-4 py-2 text-sm font-semibold text-(--lp-muted) transition-colors hover:bg-(--lp-grey) hover:text-(--lp-ink)">Cancel</Link>
          <button type="button" onClick={save} disabled={saving} className="rounded-full bg-(--lp-ink) px-6 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
