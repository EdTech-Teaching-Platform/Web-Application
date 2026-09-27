import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "../ui/icons";

// Only put this on a page that's reached by drilling into something else
// (a course, a live session, a booking) — never on a page that's already
// a direct sidebar destination (Dashboard, Explore, My Learning, etc.),
// where "back" has no obvious meaning since there's nothing you drilled
// in from. `fallback` is where to land if there's no real history to
// return to (e.g. the page was opened straight from a bookmarked URL).
export default function BackButton({ fallback = "/student/dashboard", label = "Back", className = "" }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) navigate(-1);
        else navigate(fallback);
      }}
      className={`inline-flex items-center gap-2 rounded-full border border-text/10 bg-white px-3.5 py-2 text-xs font-semibold text-text/65 shadow-sm transition-colors hover:border-primary/30 hover:text-primary ${className}`}
    >
      <ArrowLeftIcon className="h-4 w-4" />
      {label}
    </button>
  );
}
