import { Link, useLocation } from "react-router-dom";
import Button from "../ui/Button";

export default function NotFound() {
  const location = useLocation();

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text/45">
          Page not found
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold text-text">
          This page is not connected yet
        </h1>
        <p className="mt-3 text-sm text-text/60">
          The route <code className="rounded bg-text/5 px-1.5 py-0.5">{location.pathname}</code>{" "}
          does not exist. Use the button below to return to a working page.
        </p>
        <Button as={Link} to="/" fullWidth={false} className="mt-6">
          Go to home
        </Button>
      </div>
    </div>
  );
}
