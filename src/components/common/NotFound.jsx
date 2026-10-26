import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import { SearchIcon } from "../ui/icons";
import { AUTH_THEME_VARS, AuthShapes, BrandMark } from "../../auth/components/AuthKit";
import { Squiggle } from "../../public/components/landing/LandingUI";

// 404 page (the catch-all route). Same blue / ink / yellow look as the landing
// and login pages, with a way back and a few places worth going instead.
const QUICK_LINKS = [
  { to: "/test-series", label: "Browse test series" },
  { to: "/login", label: "Log in" },
  { to: "/teacher/login", label: "Educator login" },
];

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const canGoBack = typeof window !== "undefined" && window.history.length > 1;

  return (
    <div style={AUTH_THEME_VARS} className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-white px-4 py-10 font-body text-text">
      <AuthShapes />
      <main className="relative z-10 w-full max-w-xl rounded-[36px] bg-white px-6 py-10 text-center shadow-[0_30px_80px_rgba(37,87,214,0.18)] ring-1 ring-(--lp-line) sm:px-10">
        <div className="flex justify-center">
          <BrandMark className="h-12 w-12" />
        </div>

        {/* 4 [search] 4 */}
        <p
          className="mt-6 flex items-center justify-center gap-1 font-(family-name:--lp-font) text-[6.5rem] font-bold leading-none tracking-[-0.06em] text-(--lp-ink) sm:text-[8rem]"
          aria-label="Error 404"
        >
          <span aria-hidden="true">4</span>
          <span className="grid h-[0.78em] w-[0.78em] place-items-center rounded-full bg-(--lp-yellow) text-(--lp-ink) ring-4 ring-white shadow-[0_14px_30px_-12px_rgba(15,17,21,0.35)]" aria-hidden="true">
            <SearchIcon className="h-[0.34em] w-[0.34em]" />
          </span>
          <span aria-hidden="true">4</span>
        </p>

        <h1 className="mt-4 font-(family-name:--lp-font) text-2xl font-bold tracking-tight text-(--lp-ink) sm:text-3xl">
          We couldn't find that{" "}
          <span className="relative inline-block">
            <span className="relative z-10">page</span>
            <Squiggle className="absolute -bottom-2 left-0 -z-0 h-3 w-full text-(--lp-blue)" />
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-(--lp-muted)">
          The link may be broken or the page may have moved.{" "}
          <code className="break-all rounded-md bg-(--lp-grey) px-1.5 py-0.5 text-xs text-(--lp-ink)">{location.pathname}</code>{" "}
          doesn't exist here.
        </p>

        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button as={Link} to="/" variant="ink" fullWidth={false} className="px-8">
            Go to home
          </Button>
          {canGoBack && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-full px-6 py-3 text-sm font-semibold text-(--lp-ink) ring-1 ring-inset ring-(--lp-ink)/20 transition-colors hover:bg-(--lp-grey) focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-(--lp-blue)/35"
            >
              Go back
            </button>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 border-t border-(--lp-line) pt-6">
          <span className="text-xs font-semibold uppercase tracking-wide text-(--lp-muted)">Or try</span>
          {QUICK_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-full bg-(--lp-blue-soft) px-3.5 py-1.5 text-xs font-semibold text-(--lp-blue-deep) transition-colors hover:bg-(--lp-blue) hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
