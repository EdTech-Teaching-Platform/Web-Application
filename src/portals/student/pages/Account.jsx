// Account: test stats (student_get_stats) and the student's own profile
// (profiles + student_profiles rows). No dummy values: empty fields stay empty.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../../components/ui/Button";
import ChipInput from "../../../components/ui/ChipInput";
import Input from "../../../components/ui/Input";
import StatCard from "../../../components/ui/StatCard";
import { useAuth } from "../../../hooks/useAuth";
import { useSignOut } from "../../../hooks/useSignOut";
import { isEmail, isPhone } from "../../../auth/utils/validators";
import { AlertTriangleIcon, AwardIcon, BookOpenIcon, CheckIcon, ClockIcon, FileTextIcon, FlameIcon, LockIcon, MailIcon, StarIcon, TargetIcon } from "../../../components/ui/icons";
import { ErrorState, LoadingState } from "../components/PageState";
import { Rise } from "../components/StudentKit";
import { useStudentData } from "../hooks/useStudentData";
import { profileApi } from "../services/profileApi";
import { studentSeriesApi } from "../services/studentSeriesApi";
import { formatPercent, formatSeconds } from "../utils/format";

// Short fields that sit two-up on phones; everything else takes a full row.
const PAIRED = new Set(["location", "grade", "age", "gender"]);
// Shown under "Parent or guardian" instead of "Personal details".
const GUARDIAN_FIELDS = new Set(["father_name", "mother_name", "parent_email"]);

const TEXT_FIELDS = [
  { name: "full_name", label: "Full name", autoComplete: "name" },
  { name: "phone", label: "Phone", autoComplete: "tel" },
  { name: "location", label: "City" },
  { name: "grade", label: "Class / grade" },
  { name: "school_name", label: "School" },
  { name: "age", label: "Age" },
  { name: "gender", label: "Gender" },
  { name: "father_name", label: "Father's name" },
  { name: "mother_name", label: "Mother's name" },
  { name: "parent_email", label: "Parent's email", type: "email" },
];

export function toForm(profile, student) {
  const form = { interests: Array.isArray(student?.interests) ? student.interests : [] };
  for (const f of TEXT_FIELDS) form[f.name] = (profile?.[f.name] ?? student?.[f.name] ?? "") || "";
  return form;
}

export function validateAccount(form) {
  const e = {};
  if (!form.full_name.trim()) e.full_name = "Enter your name.";
  else if (form.full_name.trim().length < 2) e.full_name = "Name is too short.";
  if (form.phone.trim() && !isPhone(form.phone)) e.phone = "Enter a valid phone number.";
  if (form.parent_email.trim() && !isEmail(form.parent_email)) e.parent_email = "Enter a valid email address.";
  if (form.age.trim() && !/^\d{1,3}$/.test(form.age.trim())) e.age = "Enter your age in years.";
  return e;
}

const WIDE = "mx-auto w-full max-w-7xl space-y-6 px-4 py-4 sm:space-y-8 sm:px-6 sm:py-6 lg:px-8";
const SURFACE = "rounded-2xl bg-white ring-1 ring-(--lp-line) shadow-[0_1px_2px_rgb(15_17_21/0.04)]";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--lp-blue-deep)";
const FIELD = "rounded-xl! bg-white! py-2.5! focus:border-(--lp-blue-deep)! focus:ring-(--lp-blue)/20!";

function StatTile({ icon: Icon, value, label, suffix }) {
  return (
    <div className="flex items-center gap-3.5 bg-white p-4 sm:p-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-(--lp-blue-tint) text-(--lp-blue-deep)" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <StatCard
        value={value}
        suffix={suffix}
        label={label}
        className="min-w-0 gap-0.5"
        valueClassName="font-display text-2xl font-semibold leading-none tabular-nums tracking-tight text-(--lp-ink)"
        labelClassName="truncate text-xs font-medium text-(--lp-muted)"
      />
    </div>
  );
}

function StatsSection() {
  const { data: stats, error, loading, reload } = useStudentData(() => studentSeriesApi.stats(), "stats");
  if (loading) return <LoadingState label="Loading your stats" rows={1} />;
  if (error) return <ErrorState error={error} onRetry={reload} title="Couldn't load your stats" />;
  return (
    <section className="space-y-4" aria-label="Your stats">
      <h2 className="font-display text-lg font-semibold tracking-tight text-(--lp-ink) sm:text-xl">Performance overview</h2>
      <div className={`${SURFACE} grid grid-cols-2 gap-px overflow-hidden bg-(--lp-line) lg:grid-cols-4`}>
        <StatTile icon={FileTextIcon} value={stats.tests_taken} label="Tests taken" />
        <StatTile icon={AwardIcon} value={stats.tests_passed} label="Tests passed" />
        <StatTile icon={BookOpenIcon} value={stats.series_enrolled} label="Series enrolled" />
        <StatTile icon={FlameIcon} value={stats.current_streak} suffix={stats.current_streak === 1 ? " day" : " days"} label="Current streak" />
        <StatTile icon={TargetIcon} value={formatPercent(stats.average_percentage, 1)} label="Average score" />
        <StatTile icon={StarIcon} value={formatPercent(stats.best_percentage, 1)} label="Best score" />
        <StatTile icon={CheckIcon} value={formatPercent(stats.accuracy_percentage, 1)} label="Accuracy" />
        <StatTile icon={ClockIcon} value={formatSeconds(stats.total_time_secs)} label="Time practising" />
      </div>
    </section>
  );
}

function ProfileForm({ user }) {
  const { data, error, loading, reload } = useStudentData(() => profileApi.get(user.id), user.id);
  const initial = useMemo(() => (data ? toForm(data.profile, data.student) : null), [data]);
  const [message, setMessage] = useState({ tone: "", text: "" });

  if (loading && !initial) return <LoadingState label="Loading your profile" rows={2} />;
  if (error) return <ErrorState error={error} onRetry={reload} title="Couldn't load your profile" />;
  // Remounts with fresh values after every save (key = saved snapshot).
  return (
    <ProfileFields key={JSON.stringify(initial)} user={user} email={data.profile?.email || user.email}
      initial={initial} reload={reload} message={message} setMessage={setMessage} />
  );
}

function ProfileFields({ user, email, initial, reload, message, setMessage }) {
  const [form, setForm] = useState(initial);
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);

  const errors = validateAccount(form);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const valid = Object.keys(errors).length === 0;
  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  const save = async (e) => {
    e.preventDefault();
    setTouched(Object.fromEntries(TEXT_FIELDS.map((f) => [f.name, true])));
    if (!valid) return;
    setSaving(true);
    setMessage({ tone: "", text: "" });
    try {
      const trimmed = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === "string" ? (v.trim() || null) : v]));
      await profileApi.save(user.id, { ...trimmed, full_name: form.full_name.trim() });
      await reload();
      setMessage({ tone: "success", text: "Profile saved." });
    } catch (err) {
      setMessage({ tone: "danger", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const renderField = (f) => (
    <Input
      key={f.name}
      label={f.label}
      containerClassName={PAIRED.has(f.name) ? "" : "col-span-2 sm:col-span-1"}
      type={f.type ?? "text"}
      value={form[f.name]}
      autoComplete={f.autoComplete}
      className={FIELD}
      onChange={(e) => set(f.name, e.target.value)}
      onBlur={() => setTouched((t) => ({ ...t, [f.name]: true }))}
      error={touched[f.name] ? errors[f.name] : undefined}
    />
  );

  return (
    <form onSubmit={save} noValidate className={`${SURFACE} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-8">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-(--lp-ink) sm:text-2xl">Profile</h2>
          <p className="mt-1 text-sm text-(--lp-muted)">Keep your personal and school details up to date.</p>
        </div>
        <p className="inline-flex w-full max-w-full items-center gap-2 rounded-full bg-(--lp-grey) px-3.5 py-2 text-[13px] text-text/70 ring-1 ring-(--lp-line) sm:w-auto sm:px-4 sm:text-sm">
          <MailIcon className="h-4 w-4 shrink-0 text-(--lp-blue-deep)" aria-hidden="true" />
          <span className="truncate">Signed in as {email}</span>
        </p>
      </div>
      {message.text && (
        <div className="px-5 pb-5 sm:px-8">
          <p role={message.tone === "danger" ? "alert" : "status"}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${message.tone === "danger" ? "bg-danger/10 text-danger ring-1 ring-danger/20" : "bg-success/10 text-text ring-1 ring-success/20"}`}>
            {message.tone === "danger"
              ? <AlertTriangleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              : <CheckIcon className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />}
            <span>{message.text}</span>
          </p>
        </div>
      )}

      <FormSection title="Personal details" description="Your name, contact and school information.">
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-5 sm:gap-y-5">
          {TEXT_FIELDS.filter((f) => !GUARDIAN_FIELDS.has(f.name)).map(renderField)}
        </div>
      </FormSection>

      <FormSection title="Parent or guardian" description="Optional family contact details.">
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-5 sm:gap-y-5">
          {TEXT_FIELDS.filter((f) => GUARDIAN_FIELDS.has(f.name)).map(renderField)}
        </div>
      </FormSection>

      <FormSection title="Interests" description="Topics you like to practise.">
        <ChipInput label="Interests" values={form.interests} onChange={(v) => set("interests", v)} placeholder="e.g. physics, maths" max={10} />
      </FormSection>

      <div className="flex flex-col gap-2.5 border-t border-(--lp-line) bg-(--lp-grey)/60 px-5 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-8 sm:py-5">
        <Button type="submit" fullWidth={false} disabled={!valid || !dirty || saving}>{saving ? "Saving…" : "Save changes"}</Button>
        <Link
          to="/forgot-password"
          className={`inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-(--lp-ink) ring-1 ring-(--lp-line) transition-colors duration-200 hover:bg-(--lp-grey) ${FOCUS}`}
        >
          <LockIcon className="h-4 w-4" aria-hidden="true" />
          Change password
        </Link>
      </div>
    </form>
  );
}

// One settings block: title + hint on the left, the fields on the right.
function FormSection({ title, description, children }) {
  return (
    <div className="grid gap-4 border-t border-(--lp-line) p-5 sm:p-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
      <div>
        <h3 className="font-display text-sm font-semibold text-(--lp-ink)">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-(--lp-muted)">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export default function Account() {
  const { user } = useAuth();
  const signOut = useSignOut();
  const initials = (user?.name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div className={`${WIDE} pb-12`}>
      <Rise>
        <header className={`${SURFACE} flex flex-col gap-5 p-5 sm:p-8 md:flex-row md:items-center md:justify-between`}>
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            {initials && (
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-(--lp-blue-soft) font-display text-lg font-semibold text-(--lp-blue-deep) sm:h-[4.5rem] sm:w-[4.5rem] sm:text-2xl" aria-hidden="true">
                {initials}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-(--lp-muted)">Account</p>
              <h1 className="mt-1.5 break-words font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-(--lp-ink) sm:text-[2.25rem]">{user?.name || "Your account"}</h1>
              {user?.email && <p className="mt-1 truncate text-sm text-(--lp-muted)">{user.email}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className={`inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-(--lp-ink) ring-1 ring-(--lp-line) transition-colors duration-200 hover:bg-(--lp-grey) md:shrink-0 ${FOCUS}`}
          >
            Sign out
          </button>
        </header>
      </Rise>
      <Rise><StatsSection /></Rise>
      {user && <Rise delay={80}><ProfileForm user={user} /></Rise>}
    </div>
  );
}
