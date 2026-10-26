// "Find your test series" for the public landing page: pick a class, then a
// subject, and land on the Test Series marketplace pre-filtered
// (/test-series?class=…&subject=…). Class and subject values come from the
// test-series catalog so they match the marketplace filters exactly.
// Colours come from the --lp-* variables set by landingTheme.js.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
const CLASS_LEVELS = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12", "College / University", "Competitive Exams", "Other"];
const SERIES_SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "Computer Science", "Social Science", "Other"];
import { PillButton, ArrowUpRight } from "./LandingUI";
import { PiIcon, TargetIcon, FlaskIcon, HeartIcon, ChatIcon, CodeIcon, UsersIcon, BookOpenIcon } from "../../../components/ui/icons";

const DISPLAY = "font-(family-name:--lp-font)";

const SUBJECT_ICONS = {
  Mathematics: PiIcon,
  Physics: TargetIcon,
  Chemistry: FlaskIcon,
  Biology: HeartIcon,
  English: ChatIcon,
  "Computer Science": CodeIcon,
  "Social Science": UsersIcon,
};

// Short tile labels for the non-numeric levels.
const TILE_LABELS = {
  "College / University": { big: "UG", small: "College" },
  "Competitive Exams": { big: "★", small: "Exams" },
};

function tileFor(level) {
  const m = level.match(/^Class (\d+)$/);
  if (m) return { big: m[1], small: "Class" };
  return TILE_LABELS[level] ?? { big: "•", small: level };
}

export default function ClassFinder() {
  const navigate = useNavigate();
  const levels = CLASS_LEVELS.filter((l) => l !== "Other");
  const subjects = SERIES_SUBJECTS.filter((s) => s !== "Other");
  const [level, setLevel] = useState("Class 11");

  const go = (subject) => {
    // The series search matches title / subject / exam; the class level is
    // only a UI step for now (series do not expose a searchable grade).
    navigate(subject ? `/test-series?q=${encodeURIComponent(subject)}` : "/test-series");
  };

  return (
    <div className="mt-8 sm:mt-12">
      {/* step 1 — class */}
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className={`${DISPLAY} grid h-6 w-6 place-items-center rounded-full bg-(--lp-ink) text-xs font-bold text-white`}>1</span>
        Choose your class
      </p>
      <div role="tablist" aria-label="Class" className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-2.5 lg:grid-cols-9">
        {levels.map((l) => {
          const on = l === level;
          const t = tileFor(l);
          return (
            <button
              key={l}
              role="tab"
              type="button"
              aria-selected={on}
              aria-label={l}
              onClick={() => setLevel(l)}
              className={`flex flex-col items-center justify-center rounded-xl py-3 outline-none transition-all sm:rounded-2xl sm:py-4 duration-200 ease-out focus-visible:ring-4 focus-visible:ring-(--lp-blue)/35 ${
                on ? "-translate-y-0.5 bg-(--lp-ink) text-white shadow-[0_16px_30px_-16px_rgba(15,17,21,0.7)]" : "bg-(--lp-grey) text-(--lp-ink) hover:bg-(--lp-blue-soft)"
              }`}
            >
              <span className={`${DISPLAY} text-2xl font-bold leading-none tracking-tight sm:text-3xl ${on ? "text-(--lp-yellow)" : ""}`}>{t.big}</span>
              <span className={`mt-1 text-[10px] font-semibold uppercase tracking-wider sm:mt-1.5 sm:text-[11px] ${on ? "text-white/70" : "text-(--lp-muted)"}`}>{t.small}</span>
            </button>
          );
        })}
      </div>

      {/* step 2 — subject */}
      <div className="mt-6 rounded-[22px] bg-(--lp-blue-tint) p-4 sm:mt-8 sm:rounded-[28px] ring-1 ring-(--lp-blue)/10 sm:p-8">
        <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className={`${DISPLAY} grid h-6 w-6 place-items-center rounded-full bg-(--lp-ink) text-xs font-bold text-white`}>2</span>
            Pick a subject for <span className="rounded-md bg-(--lp-yellow) px-1.5 py-0.5">{level}</span>
          </p>
          <PillButton tone="ink" size="sm" className="w-full sm:w-auto [&>span:first-child]:flex-1 [&>span:first-child]:text-center sm:[&>span:first-child]:flex-none" onClick={() => go()}>
            All {level} test series
          </PillButton>
        </div>

        <div key={level} className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-6 sm:gap-3 sm:grid-cols-3 lg:grid-cols-4 motion-safe:animate-[lp-fade_0.4s_ease-out]">
          <style>{`@keyframes lp-fade { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: none; } }`}</style>
          {subjects.map((s) => {
            const Icon = SUBJECT_ICONS[s] ?? BookOpenIcon;
            return (
              <button
                key={s}
                type="button"
                onClick={() => go(s)}
                className="group flex flex-col items-start gap-2 rounded-xl bg-white p-3 text-left sm:rounded-2xl sm:p-3.5 sm:flex-row sm:items-center sm:gap-3 ring-1 ring-(--lp-line) outline-none transition-all duration-200 ease-out hover:-translate-y-0.5 hover:ring-(--lp-ink) focus-visible:ring-4 focus-visible:ring-(--lp-blue)/35"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg sm:h-11 sm:w-11 sm:rounded-xl bg-(--lp-blue-soft) text-(--lp-blue-deep) transition-colors duration-200 group-hover:bg-(--lp-ink) group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`${DISPLAY} block text-sm font-bold leading-tight tracking-tight sm:truncate sm:text-base`}>{s}</span>
                  <span className="block text-[11px] text-(--lp-muted)">Test series</span>
                </span>
                <ArrowUpRight className="hidden h-4 w-4 shrink-0 text-(--lp-muted) sm:block transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-(--lp-ink)" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
