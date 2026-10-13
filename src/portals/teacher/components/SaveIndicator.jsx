// Autosave indicator: "Saved just now / 2 min ago", "Saving…" or
// "Couldn't save — retry" (a real button). Re-renders every 30s so the
// relative time stays honest.
import { useEffect, useState } from "react";
import AutoSaveIndicator from "../../../components/ui/AutoSaveIndicator";
import { timeAgo } from "../data/testSeriesDeadlines";

export default function SaveIndicator({ status, savedAt, onRetry, className = "" }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);
  if (status === "error") {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-danger ${className}`} role="status">
        <span className="h-1.5 w-1.5 rounded-full bg-danger" />
        Couldn't save —
        <button type="button" onClick={onRetry} className="font-bold underline">
          retry
        </button>
      </span>
    );
  }
  return (
    <span role="status" className={className}>
      <AutoSaveIndicator status={status} timestamp={savedAt ? timeAgo(savedAt) : "up to date"} />
    </span>
  );
}
