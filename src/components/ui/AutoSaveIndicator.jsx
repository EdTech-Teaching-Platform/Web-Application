import { CheckIcon } from "./icons";

// AutoSaveIndicator — the small persistent "Saving… / Saved <time>" pill
// long forms show near their header. Shared since Course Builder, Profile
// Setup-style screens and anything else with silent autosave should all
// read the same three states rather than each writing its own text.
//
// `status`: "saved" | "saving" | "error"
export default function AutoSaveIndicator({ status = "saved", timestamp, className = "" }) {
  if (status === "saving") {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-text/45 ${className}`}>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text/40" />
        Saving…
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-danger ${className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-danger" />
        Couldn't save — retrying
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-success ${className}`}>
      <CheckIcon className="h-3 w-3" />
      Saved{timestamp ? ` · ${timestamp}` : ""}
    </span>
  );
}
