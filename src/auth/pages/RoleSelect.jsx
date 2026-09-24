// Role-selection landing page — single entry point ("/") for the general
// (non-admin) audience. Replaces having to manually know/visit separate
// Student vs Educator login URLs: the visitor picks a role here and is
// routed straight to the matching login screen (/login for Student,
// /teacher/login for Educator). Purely a chooser — it holds no auth state
// of its own and doesn't touch anything the existing /login or
// /teacher/login pages do.
import { useNavigate } from "react-router-dom";

// Small inline icons (no new dependency) — a mortarboard for Student and a
// chalkboard/podium mark for Educator.
function StudentIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c0 1.657 2.686 3 6 3s6-1.343 6-3v-5" />
    </svg>
  );
}
function EducatorIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

const ROLES = [
  {
    key: "student",
    title: "I'm a Student",
    description: "Browse courses, join live classes and track your progress.",
    icon: StudentIcon,
    to: "/login",
  },
  {
    key: "educator",
    title: "I'm an Educator",
    description: "Create courses, host live classes and manage your learners.",
    icon: EducatorIcon,
    to: "/teacher/login",
  },
];

export default function RoleSelect() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 py-12">
      <div className="mx-auto mb-10 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary font-display text-sm font-bold text-white">
        UL
      </div>

      <h1 className="text-center font-display text-2xl text-text sm:text-3xl">
        Welcome to Universal Learning
      </h1>
      <p className="mt-2 max-w-sm text-center text-sm text-text/60">
        Tell us who you are so we can take you to the right place.
      </p>

      <div className="mt-10 grid w-full max-w-2xl gap-5 sm:grid-cols-2">
        {ROLES.map(({ key, title, description, icon: Icon, to }) => (
          <button
            key={key}
            type="button"
            onClick={() => navigate(to)}
            className="group flex flex-col items-start gap-4 rounded-2xl border border-[#e5ded9] bg-white p-6 text-left shadow-sm transition-colors duration-150 hover:border-primary hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-150 group-hover:bg-primary group-hover:text-white">
              <Icon className="h-[22px] w-[22px]" />
            </span>
            <span>
              <span className="block font-display text-lg text-text">{title}</span>
              <span className="mt-1 block text-sm text-text/60">{description}</span>
            </span>
            <span className="mt-1 text-sm font-medium text-primary">Continue &rarr;</span>
          </button>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-text/40">
        By continuing, you agree to our{" "}
        <a href="/terms" className="underline hover:text-text/60">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline hover:text-text/60">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
