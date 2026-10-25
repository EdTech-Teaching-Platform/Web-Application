import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import { BookOpenIcon } from "../../../components/ui/icons";

// Shared loading / error / empty states for the student test-series screens.

export function LoadingState({ label = "Loading…", rows = 3 }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl bg-text/5" />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "Something went wrong" }) {
  return (
    <div role="alert" className="rounded-2xl bg-danger/10 p-6 text-center">
      <p className="font-semibold text-danger">{title}</p>
      <p className="mt-1 text-sm text-text/70">{error?.message || "Please try again."}</p>
      {onRetry && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" fullWidth={false} onClick={onRetry}>Try again</Button>
        </div>
      )}
    </div>
  );
}

export function EmptyPanel({ heading, message, action, icon = BookOpenIcon }) {
  return <EmptyState icon={icon} heading={heading} message={message} action={action} />;
}

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>}
        <h1 className="mt-1 font-display text-2xl font-bold text-text sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-text/60">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}

export const PAGE = "mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 lg:px-8";
