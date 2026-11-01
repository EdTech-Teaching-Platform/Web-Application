// Student onboarding after Google sign-in: Basics → Details → Interests, then
// the details are saved to the student's own profile (profiles +
// student_profiles via profileApi, the same rows the Account page edits) and
// the student lands on the dashboard (or the ?redirect= they came from).
// Split layout: a dark welcome panel with a live "your profile" preview on the
// left, the current step's form on the right. Skippable: details can always
// be filled in later on the Account page. (The older OnboardingLayout is left
// untouched for the retired wizard files.)
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthFrame, BrandMark } from "../../../auth/components/AuthKit";
import {
  ArrowLeftIcon, BriefcaseIcon, ChatIcon, CheckIcon, ChevronRightIcon, CodeIcon, FlaskIcon,
  GridIcon, MailIcon, MapPinIcon, MusicNoteIcon, PaletteIcon, PiIcon, ShieldCheckIcon,
} from "../../../components/ui/icons";
import { useAuth } from "../../../hooks/useAuth";
import { isEmail, isPhone, safeRedirect } from "../../../auth/utils/validators";
import { profileApi } from "../services/profileApi";
import { markOnboardingSkipped } from "../utils/onboarding";

const ORDINAL = (n) => {
  if (n >= 11 && n <= 13) return `${n}th`;
  const last = n % 10;
  if (last === 1) return `${n}st`;
  if (last === 2) return `${n}nd`;
  if (last === 3) return `${n}rd`;
  return `${n}th`;
};
const GRADES = Array.from({ length: 12 }, (_, i) => ({ value: `${ORDINAL(i + 1)} Grade`, short: ORDINAL(i + 1) }));
const SUBJECTS = [
  { name: "Programming", icon: CodeIcon, tone: "bg-(--lp-blue-soft) text-(--lp-blue-deep)" },
  { name: "Math", icon: PiIcon, tone: "bg-(--lp-yellow-soft) text-(--lp-ink)" },
  { name: "Science", icon: FlaskIcon, tone: "bg-(--lp-blue-soft) text-(--lp-blue-deep)" },
  { name: "Languages", icon: ChatIcon, tone: "bg-(--lp-yellow-soft) text-(--lp-ink)" },
  { name: "Music", icon: MusicNoteIcon, tone: "bg-(--lp-yellow-soft) text-(--lp-ink)" },
  { name: "Design", icon: PaletteIcon, tone: "bg-(--lp-blue-soft) text-(--lp-blue-deep)" },
  { name: "Business", icon: BriefcaseIcon, tone: "bg-(--lp-blue-soft) text-(--lp-blue-deep)" },
  { name: "Other", icon: GridIcon, tone: "bg-(--lp-yellow-soft) text-(--lp-ink)" },
];

const STEPS = [
  {
    key: "basics", label: "About you",
    eyebrow: "Step 1 of 3", title: "Let's start with the basics",
    sub: "This helps us recommend test series that match your class and school.",
    panel: "Tell us who's learning.",
  },
  {
    key: "details", label: "Contact",
    eyebrow: "Step 2 of 3", title: "How can we reach you?",
    sub: "We use these only for account and test updates.",
    panel: "Stay in the loop.",
  },
  {
    key: "interests", label: "Interests",
    eyebrow: "Step 3 of 3", title: "What do you want to practise?",
    sub: "Pick everything that interests you. You can change this any time.",
    panel: "Make it yours.",
  },
];

const EMPTY = { full_name: "", age: "", grade: "", location: "", school_name: "", phone: "", parent_email: "", interests: [] };

const STYLES = `
@keyframes ul-ob-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.ul-ob-in { animation: ul-ob-in 0.4s ease-out both; }
@media (prefers-reduced-motion: reduce) { .ul-ob-in { animation: none; } }
`;

function stepErrors(step, f) {
  const e = {};
  if (step === 0) {
    if (f.full_name.trim().length < 2) e.full_name = "Enter your name.";
    if (!/^\d{1,3}$/.test(f.age.trim())) e.age = "Enter your age in years.";
    if (!f.grade) e.grade = "Select your grade.";
    if (!f.location.trim()) e.location = "Enter your city.";
    if (!f.school_name.trim()) e.school_name = "Enter your school.";
  } else if (step === 1) {
    if (!isPhone(f.phone)) e.phone = "Enter a valid phone number.";
    if (f.parent_email.trim() && !isEmail(f.parent_email)) e.parent_email = "Enter a valid email address.";
  } else if (f.interests.length === 0) {
    e.interests = "Pick at least one subject.";
  }
  return e;
}

// Labelled text field: soft grey fill, white + blue ring on focus.
function Field({ label, hint, error, icon: Icon, className = "", ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-semibold text-(--lp-ink)">{label}</span>
      <span className="relative block">
        {Icon && <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-(--lp-muted)" aria-hidden="true" />}
        <input
          aria-invalid={Boolean(error)}
          className={`h-12 w-full rounded-full border bg-(--lp-grey) text-[15px] text-(--lp-ink) outline-none transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-(--lp-muted)/60 focus:bg-white ${Icon ? "pl-11 pr-5" : "px-5"} ${
            error ? "border-danger focus:ring-4 focus:ring-danger/10" : "border-transparent hover:border-(--lp-line) focus:border-(--lp-blue) focus:ring-4 focus:ring-(--lp-blue)/15"
          }`}
          {...props}
        />
      </span>
      {error ? <span className="mt-1.5 block text-xs text-danger">{error}</span> : hint ? <span className="mt-1.5 block text-xs text-(--lp-muted)">{hint}</span> : null}
    </label>
  );
}

// Left panel: dark welcome card, step list and a live profile preview.
function WelcomePanel({ step, form }) {
  const first = form.full_name.trim().split(/\s+/)[0] || "there";
  const initial = first[0]?.toUpperCase() || "U";
  const meta = [form.grade, form.location.trim()].filter(Boolean);
  return (
    <aside className="relative hidden overflow-hidden bg-(--lp-ink) p-9 text-white lg:flex lg:flex-col" aria-label="Welcome">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-16 -top-20 h-72 w-72 rounded-full bg-(--lp-blue)/70 blur-3xl" />
        <div className="absolute -bottom-24 -right-10 h-64 w-64 rounded-full bg-(--lp-yellow)/35 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />
      </div>

      <div className="relative flex items-center gap-2.5 font-(family-name:--lp-font) text-base font-bold tracking-tight">
        <BrandMark className="h-9 w-9" />
        Universal Learning
      </div>

      <div className="relative mt-12">
        <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-(--lp-yellow)">Student setup</span>
        <h2 className="mt-4 font-(family-name:--lp-font) text-4xl font-bold leading-[1.05] tracking-tight">
          {STEPS[step].panel}
        </h2>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/65">
          Three quick steps and your practice dashboard is ready. It takes about a minute.
        </p>
      </div>

      <ol className="relative mt-9 space-y-4" aria-label="Setup progress">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={s.key} className="flex items-center gap-3.5" aria-current={active ? "step" : undefined}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors duration-200 ${
                done ? "bg-(--lp-blue) text-white" : active ? "bg-(--lp-yellow) text-(--lp-ink)" : "bg-white/10 text-white/50"
              }`}>
                {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
              </span>
              <span className={`text-sm font-semibold ${active ? "text-white" : done ? "text-white/80" : "text-white/45"}`}>{s.label}</span>
            </li>
          );
        })}
      </ol>

      {/* live preview of the profile being built */}
      <div className="relative mt-auto pt-10">
        <div className="rounded-3xl bg-white p-5 text-(--lp-ink) shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-(--lp-yellow) font-(family-name:--lp-font) text-lg font-bold">{initial}</span>
            <div className="min-w-0">
              <p className="truncate font-(family-name:--lp-font) text-base font-bold leading-tight">Hi, {first}</p>
              <p className="mt-0.5 truncate text-xs text-(--lp-muted)">
                {meta.length ? meta.join(" · ") : "Your profile appears here"}
              </p>
            </div>
          </div>
          {form.school_name.trim() && <p className="mt-3 truncate text-xs font-medium text-(--lp-muted)">{form.school_name.trim()}</p>}
          <div className="mt-3 flex min-h-7 flex-wrap gap-1.5">
            {form.interests.length ? form.interests.map((i) => (
              <span key={i} className="rounded-full bg-(--lp-blue-soft) px-2.5 py-1 text-[11px] font-semibold text-(--lp-blue-deep)">{i}</span>
            )) : <span className="rounded-full bg-(--lp-grey) px-2.5 py-1 text-[11px] font-medium text-(--lp-muted)">Interests</span>}
          </div>
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-white/55">
          <ShieldCheckIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          Edit any of this later from your Account page.
        </p>
      </div>
    </aside>
  );
}

export default function StudentOnboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const destination = safeRedirect(params.get("redirect")) || "/student/dashboard";

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...EMPTY, full_name: user?.name || "" });
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill anything already on the profile (best effort).
  useEffect(() => {
    let cancelled = false;
    profileApi.get(user.id).then(({ profile, student }) => {
      if (cancelled) return;
      setForm((f) => ({
        ...f,
        full_name: profile?.full_name || f.full_name,
        phone: profile?.phone || "",
        location: profile?.location || "",
        grade: student?.grade || "",
        school_name: student?.school_name || "",
        age: student?.age ? String(student.age) : "",
        parent_email: student?.parent_email || "",
        interests: Array.isArray(student?.interests) ? student.interests : [],
      }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [user.id]);

  const errors = useMemo(() => stepErrors(step, form), [step, form]);
  const valid = Object.keys(errors).length === 0;
  const set = (name) => (value) => setForm((f) => ({ ...f, [name]: value }));
  const touch = (name) => () => setTouched((t) => ({ ...t, [name]: true }));
  const show = (name) => (touched[name] ? errors[name] : undefined);
  const toggleInterest = (s) =>
    setForm((f) => ({ ...f, interests: f.interests.includes(s) ? f.interests.filter((x) => x !== s) : [...f.interests, s] }));

  const skip = () => {
    markOnboardingSkipped(user.id);
    navigate(destination, { replace: true });
  };

  const finish = async () => {
    setSaving(true);
    setError("");
    try {
      await profileApi.save(user.id, {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        grade: form.grade,
        school_name: form.school_name.trim(),
        age: form.age.trim(),
        parent_email: form.parent_email.trim() || null,
        interests: form.interests,
      });
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err?.message || "We couldn't save your details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const last = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <AuthFrame top>
      <style>{STYLES}</style>
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[36px] bg-white shadow-[0_30px_80px_rgba(37,87,214,0.18)] ring-1 ring-(--lp-line) lg:grid-cols-[400px_1fr]">
        <WelcomePanel step={step} form={form} />

        <section className="flex min-w-0 flex-col px-6 pb-7 pt-6 sm:px-10 sm:pb-9 sm:pt-8">
          {/* mobile brand row (the welcome panel is desktop-only) */}
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <span className="inline-flex items-center gap-2.5 font-(family-name:--lp-font) text-base font-bold tracking-tight text-(--lp-ink)">
              <BrandMark className="h-9 w-9" />
              Universal Learning
            </span>
            <span className="rounded-full bg-(--lp-yellow) px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-(--lp-ink)">Setup</span>
          </div>

          {/* progress */}
          <div className="flex items-center justify-between text-xs font-semibold text-(--lp-muted)">
            <span>{current.eyebrow}</span>
            <span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-(--lp-grey)" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label="Setup progress">
            <div className="h-full rounded-full bg-(--lp-blue) transition-[width] duration-500 ease-out" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>

          <div key={step} className="ul-ob-in mt-8 flex-1">
            <h1 className="font-(family-name:--lp-font) text-3xl font-bold leading-tight tracking-tight text-(--lp-ink) sm:text-4xl">{current.title}</h1>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-(--lp-muted)">{current.sub}</p>

            {step === 0 && (
              <div className="mt-8 space-y-6">
                <div className="grid gap-5 sm:grid-cols-[1fr_140px]">
                  <Field label="Full name" autoComplete="name" placeholder="Alex Student" value={form.full_name}
                    onChange={(e) => set("full_name")(e.target.value)} onBlur={touch("full_name")} error={show("full_name")} />
                  <Field label="Age" type="number" inputMode="numeric" min="1" max="99" placeholder="14" value={form.age}
                    onChange={(e) => set("age")(e.target.value)} onBlur={touch("age")} error={show("age")} />
                </div>

                <div>
                  <span className="mb-2 block text-sm font-semibold text-(--lp-ink)" id="ob-grade-label">Class / grade</span>
                  <div role="radiogroup" aria-labelledby="ob-grade-label" className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {GRADES.map((g) => {
                      const on = form.grade === g.value;
                      return (
                        <button key={g.value} type="button" role="radio" aria-checked={on}
                          onClick={() => { set("grade")(g.value); touch("grade")(); }}
                          className={`h-11 rounded-full border text-sm font-semibold transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-95 ${
                            on ? "border-(--lp-ink) bg-(--lp-ink) text-white" : "border-(--lp-line) bg-white text-(--lp-ink) hover:border-(--lp-blue) hover:bg-(--lp-blue-tint)"
                          }`}>
                          {g.short}
                        </button>
                      );
                    })}
                  </div>
                  {show("grade") && <p className="mt-1.5 text-xs text-danger">{show("grade")}</p>}
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="City" icon={MapPinIcon} autoComplete="address-level2" placeholder="e.g. Pune" value={form.location}
                    onChange={(e) => set("location")(e.target.value)} onBlur={touch("location")} error={show("location")} />
                  <Field label="Current school" placeholder="e.g. Lincoln High" value={form.school_name}
                    onChange={(e) => set("school_name")(e.target.value)} onBlur={touch("school_name")} error={show("school_name")} />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="mt-8 space-y-6">
                <Field label="Phone number" type="tel" autoComplete="tel" placeholder="98765 43210" value={form.phone}
                  hint="We'll never share your number."
                  onChange={(e) => set("phone")(e.target.value)} onBlur={touch("phone")} error={show("phone")} />
                <Field label="Parent or guardian email (optional)" type="email" icon={MailIcon} placeholder="parent@example.com" value={form.parent_email}
                  onChange={(e) => set("parent_email")(e.target.value)} onBlur={touch("parent_email")} error={show("parent_email")} />
              </div>
            )}

            {step === 2 && (
              <div className="mt-8">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="group" aria-label="Subjects">
                  {SUBJECTS.map(({ name, icon: Icon, tone }) => {
                    const on = form.interests.includes(name);
                    return (
                      <button key={name} type="button" aria-pressed={on} onClick={() => toggleInterest(name)}
                        className={`relative flex flex-col items-start gap-3 rounded-3xl border p-4 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] ${
                          on ? "border-(--lp-blue) bg-(--lp-blue-tint) shadow-[0_0_0_3px_rgba(61,123,247,0.15)]" : "border-(--lp-line) bg-white hover:border-(--lp-blue)/50"
                        }`}>
                        <span className={`grid h-10 w-10 place-items-center rounded-2xl ${tone}`}><Icon className="h-5 w-5" /></span>
                        <span className="text-sm font-semibold text-(--lp-ink)">{name}</span>
                        <span className={`absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-(--lp-blue) text-white transition-[opacity,transform] duration-150 ease-out ${on ? "scale-100 opacity-100" : "scale-75 opacity-0"}`} aria-hidden="true">
                          <CheckIcon className="h-3 w-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>
                {form.interests.length === 0 && <p className="mt-3 text-xs text-(--lp-muted)">{errors.interests}</p>}
              </div>
            )}
          </div>

          {error && <p role="alert" className="mt-5 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger ring-1 ring-danger/20">{error}</p>}

          <div className="mt-9 flex items-center justify-between gap-3 border-t border-(--lp-line) pt-6">
            <div className="flex items-center gap-4">
              {step > 0 && (
                <button type="button" onClick={() => setStep((s) => s - 1)}
                  className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-(--lp-ink) transition-colors hover:bg-(--lp-grey)">
                  <ArrowLeftIcon className="h-4 w-4" /> Back
                </button>
              )}
              <button type="button" onClick={skip} className="text-sm font-semibold text-(--lp-muted) underline-offset-4 transition-colors hover:text-(--lp-ink) hover:underline">
                Skip for now
              </button>
            </div>
            <button type="button" disabled={!valid || saving} onClick={last ? finish : () => setStep((s) => s + 1)}
              className="group inline-flex items-center gap-2.5 rounded-full bg-(--lp-ink) py-1.5 pl-6 pr-1.5 text-sm font-semibold text-white transition-[transform,opacity] duration-200 ease-out enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40">
              {saving ? "Saving…" : last ? "Go to Dashboard" : "Continue"}
              <span className="grid h-9 w-9 place-items-center rounded-full bg-(--lp-yellow) text-(--lp-ink) transition-transform duration-200 ease-out group-enabled:group-hover:translate-x-0.5">
                <ChevronRightIcon className="h-4 w-4" />
              </span>
            </button>
          </div>
        </section>
      </div>
    </AuthFrame>
  );
}
