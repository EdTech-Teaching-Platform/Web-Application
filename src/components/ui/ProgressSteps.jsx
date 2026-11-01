import { CheckIcon } from "./icons";

// ProgressSteps — design.md Section 4: numbered steps (01, 02, 03…), active
// step filled --color-primary, completed steps show a checkmark, upcoming
// steps muted outline. One step visible at a time (the caller renders only
// the current step's content — this component is just the indicator).
// Shared across Student/Educator Onboarding, Course Builder, Identity
// Verification per design.md, so it lives in components/ui, not a portal.
// compact: labels wrap under their circle instead of staying on one line, so
// long step names fit inside narrow cards (opt-in; default look is unchanged).
export default function ProgressSteps({ steps, currentIndex, compact = false }) {
  return (
    <ol className="flex items-start">
      {steps.map((label, i) => {
        const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "upcoming";
        const number = String(i + 1).padStart(2, "0");
        return (
          <li key={label} className={`flex items-center ${compact ? "min-w-0 flex-1 last:flex-1" : "flex-1 last:flex-none"}`}>
            <div className={`flex flex-col items-center gap-1.5 ${compact ? "min-w-0 flex-1 text-center" : ""}`}>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                  state === "upcoming"
                    ? "border border-text/20 text-text/40"
                    : "bg-primary text-white"
                }`}
              >
                {state === "done" ? <CheckIcon className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={`${compact ? "break-words text-[11px] leading-tight" : "whitespace-nowrap text-xs"} font-semibold ${
                  state === "upcoming" ? "text-text/40" : "text-text"
                }`}
              >
                {number} {label}
              </span>
            </div>
            {i < steps.length - 1 && <span className={`mt-4 h-px bg-text/10 ${compact ? "w-3 shrink-0 sm:w-5" : "mx-3 flex-1"}`} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
