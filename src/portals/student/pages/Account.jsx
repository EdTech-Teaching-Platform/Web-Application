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
import PageHero, { HERO_BTN_LIGHT } from "../components/PageHero";
import StatBlock, { STAT_BLOCK_LABEL, STAT_BLOCK_VALUE_COMPACT } from "../components/StatBlock";
import { ErrorState, LoadingState, PAGE } from "../components/PageState";
import { Rise, Squiggle } from "../components/StudentKit";
import { useStudentData } from "../hooks/useStudentData";
import { profileApi } from "../services/profileApi";
import { studentSeriesApi } from "../services/studentSeriesApi";
import { formatPercent, formatSeconds } from "../utils/format";

// Short fields that sit two-up on phones; everything else takes a full row.
const PAIRED = new Set(["location", "grade", "age", "gender"]);

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

function StatTile({ icon, tone, value, label, suffix }) {
  return (
    <StatBlock compact icon={icon} tone={tone}>
      <StatCard value={value} suffix={suffix} label={label} valueClassName={STAT_BLOCK_VALUE_COMPACT} labelClassName={STAT_BLOCK_LABEL} className="gap-2" />
    </StatBlock>
  );
}

function StatsSection() {
  const { data: stats, error, loading, reload } = useStudentData(() => studentSeriesApi.stats(), "stats");
  if (loading) return <LoadingState label="Loading your stats" rows={1} />;
  if (error) return <ErrorState error={error} onRetry={reload} title="Couldn't load your stats" />;
  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Your stats">
      <StatTile icon={FileTextIcon} tone="blue" value={stats.tests_taken} label="Tests taken" />
      <StatTile icon={AwardIcon} tone="yellow" value={stats.tests_passed} label="Tests passed" />
      <StatTile icon={BookOpenIcon} tone="peach" value={stats.series_enrolled} label="Series enrolled" />
      <StatTile icon={FlameIcon} tone="ink" value={stats.current_streak} suffix={stats.current_streak === 1 ? " day" : " days"} label="Current streak" />
      <StatTile icon={TargetIcon} tone="yellow" value={formatPercent(stats.average_percentage, 1)} label="Average score" />
      <StatTile icon={StarIcon} tone="sky" value={formatPercent(stats.best_percentage, 1)} label="Best score" />
      <StatTile icon={CheckIcon} tone="ink" value={formatPercent(stats.accuracy_percentage, 1)} label="Accuracy" />
      <StatTile icon={ClockIcon} tone="blue" value={formatSeconds(stats.total_time_secs)} label="Time practising" />
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

  return (
    <form onSubmit={save} noValidate className="space-y-5 rounded-[1.5rem] bg-white p-4 shadow-[0_24px_40px_-30px_rgb(15_17_21/0.4)] ring-1 ring-(--lp-line) sm:space-y-6 sm:rounded-[2rem] sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="relative inline-block font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">
          Profile
          <Squiggle className="absolute -bottom-2.5 left-0 h-2 w-full text-(--lp-blue)/70" />
        </h2>
        <p className="inline-flex w-full max-w-full items-center gap-2 rounded-full bg-(--lp-grey) px-3.5 py-2 text-[13px] text-text/70 sm:w-auto sm:px-4 sm:text-sm">
          <MailIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">Signed in as {email}</span>
        </p>
      </div>
      {message.text && (
        <p role={message.tone === "danger" ? "alert" : "status"}
          className={`flex items-center gap-3 rounded-2xl px-5 py-3.5 text-sm ${message.tone === "danger" ? "bg-danger/10 text-danger ring-1 ring-danger/20" : "bg-success/10 text-text ring-1 ring-success/20"}`}>
          {message.tone === "danger"
            ? <AlertTriangleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            : <CheckIcon className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />}
          <span>{message.text}</span>
        </p>
      )}
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-5 sm:gap-y-5">
        {TEXT_FIELDS.map((f) => (
          <Input
            key={f.name}
            label={f.label}
            containerClassName={PAIRED.has(f.name) ? "" : "col-span-2 sm:col-span-1"}
            type={f.type ?? "text"}
            value={form[f.name]}
            autoComplete={f.autoComplete}
            className="bg-(--lp-grey)! focus:bg-white!"
            onChange={(e) => set(f.name, e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, [f.name]: true }))}
            error={touched[f.name] ? errors[f.name] : undefined}
          />
        ))}
      </div>
      <ChipInput label="Interests" values={form.interests} onChange={(v) => set("interests", v)} placeholder="e.g. physics, maths" max={10} />
      <div className="flex flex-col gap-2.5 border-t border-(--lp-line) pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:pt-6">
        <Button type="submit" fullWidth={false} disabled={!valid || !dirty || saving}>{saving ? "Saving…" : "Save changes"}</Button>
        <Link
          to="/forgot-password"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-(--lp-grey) px-5 py-3 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-(--lp-blue-soft) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <LockIcon className="h-4 w-4" aria-hidden="true" />
          Change password
        </Link>
      </div>
    </form>
  );
}

export default function Account() {
  const { user } = useAuth();
  const signOut = useSignOut();
  const initials = (user?.name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div className={`${PAGE} pb-10`}>
      <PageHero
        compact
        theme="ink"
        art="card"
        eyebrow="Account"
        title={user?.name || "Your account"}
        lead={initials ? (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-(--lp-yellow) font-display text-lg font-bold text-(--lp-ink) ring-4 ring-white/15 sm:h-20 sm:w-20 sm:text-2xl" aria-hidden="true">
            {initials}
          </span>
        ) : null}
      >
        <button type="button" onClick={signOut} className={HERO_BTN_LIGHT}>
          Sign out
        </button>
      </PageHero>
      <Rise><StatsSection /></Rise>
      {user && <Rise delay={80}><ProfileForm user={user} /></Rise>}
    </div>
  );
}
