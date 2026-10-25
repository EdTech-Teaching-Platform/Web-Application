// Account: test stats (student_get_stats) and the student's own profile
// (profiles + student_profiles rows). No dummy values: empty fields stay empty.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../../components/ui/Button";
import ChipInput from "../../../components/ui/ChipInput";
import Input from "../../../components/ui/Input";
import StatCard from "../../../components/ui/StatCard";
import { useAuth } from "../../../hooks/useAuth";
import { isEmail, isPhone } from "../../../auth/utils/validators";
import { ErrorState, LoadingState, PAGE, PageHeader } from "../components/PageState";
import { useStudentData } from "../hooks/useStudentData";
import { profileApi } from "../services/profileApi";
import { studentSeriesApi } from "../services/studentSeriesApi";
import { formatPercent, formatSeconds } from "../utils/format";

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

function StatsSection() {
  const { data: stats, error, loading, reload } = useStudentData(() => studentSeriesApi.stats(), "stats");
  if (loading) return <LoadingState label="Loading your stats" rows={1} />;
  if (error) return <ErrorState error={error} onRetry={reload} title="Couldn't load your stats" />;
  return (
    <section className="grid grid-cols-2 gap-5 rounded-3xl bg-white p-6 ring-1 ring-text/10 sm:grid-cols-4" aria-label="Your stats">
      <StatCard value={stats.tests_taken} label="Tests taken" />
      <StatCard value={stats.tests_passed} label="Tests passed" />
      <StatCard value={stats.series_enrolled} label="Series enrolled" />
      <StatCard value={stats.current_streak} suffix={stats.current_streak === 1 ? " day" : " days"} label="Current streak" />
      <StatCard value={formatPercent(stats.average_percentage, 1)} label="Average score" />
      <StatCard value={formatPercent(stats.best_percentage, 1)} label="Best score" />
      <StatCard value={formatPercent(stats.accuracy_percentage, 1)} label="Accuracy" />
      <StatCard value={formatSeconds(stats.total_time_secs)} label="Time practising" />
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
    <form onSubmit={save} noValidate className="space-y-5 rounded-3xl bg-white p-6 ring-1 ring-text/10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-text">Profile</h2>
        <p className="text-sm text-text/60">Signed in as {email}</p>
      </div>
      {message.text && (
        <p role={message.tone === "danger" ? "alert" : "status"}
          className={`rounded-xl px-4 py-3 text-sm ${message.tone === "danger" ? "bg-danger/10 text-danger" : "bg-success/10 text-text"}`}>
          {message.text}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {TEXT_FIELDS.map((f) => (
          <Input
            key={f.name}
            label={f.label}
            type={f.type ?? "text"}
            value={form[f.name]}
            autoComplete={f.autoComplete}
            onChange={(e) => set(f.name, e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, [f.name]: true }))}
            error={touched[f.name] ? errors[f.name] : undefined}
          />
        ))}
      </div>
      <ChipInput label="Interests" values={form.interests} onChange={(v) => set("interests", v)} placeholder="e.g. physics, maths" max={10} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" fullWidth={false} disabled={!valid || !dirty || saving}>{saving ? "Saving…" : "Save changes"}</Button>
        <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">Change password</Link>
      </div>
    </form>
  );
}

export default function Account() {
  const { user, logout } = useAuth();
  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow="Account"
        title={user?.name || "Your account"}
        actions={<Button variant="secondary" fullWidth={false} onClick={() => logout()}>Sign out</Button>}
      />
      <StatsSection />
      {user && <ProfileForm user={user} />}
    </div>
  );
}
