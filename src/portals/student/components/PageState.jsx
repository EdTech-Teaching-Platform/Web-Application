import { useEffect, useState } from "react";
import Button from "../../../components/ui/Button";
import { BookOpenIcon } from "../../../components/ui/icons";

// Shared loading / error / empty states for the student test-series screens.

export function LoadingState({ label = "Loading…", rows = 3 }) {
  // After a few seconds, say so: a slow connection should read as "still
  // working", not as a frozen page.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(id);
  }, []);
  const text = `${String(label).replace(/[….]+$/, "")}…`;

  return (
    <div role="status" aria-live="polite" aria-label={text} className="space-y-3">
      <div className="flex items-center justify-center gap-3 py-2 text-sm font-semibold text-(--lp-muted)">
        <span className="flex items-center gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full bg-(--lp-blue) motion-safe:animate-pulse" style={{ animationDelay: `${i * 180}ms` }} />
          ))}
        </span>
        <span>{text}</span>
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-24 animate-pulse items-center gap-4 rounded-[1.75rem] bg-white/80 px-6 ring-1 ring-(--lp-line)">
          <span className="h-12 w-12 shrink-0 rounded-2xl bg-slate-200/70" />
          <span className="flex-1 space-y-2.5">
            <span className="block h-3.5 w-1/3 rounded-full bg-slate-200/70" />
            <span className="block h-3 w-2/3 rounded-full bg-slate-200/70" />
          </span>
        </div>
      ))}
      {slow && (
        <p className="pt-1 text-center text-xs font-medium text-(--lp-muted)">
          Still working on it. This is taking a little longer than usual.
        </p>
      )}
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

export function EmptyPanel({ heading, message, action, icon: Icon = BookOpenIcon }) {
  return (
    <div className="flex flex-col items-center rounded-[1.75rem] bg-white px-6 py-14 text-center ring-1 ring-(--lp-line)">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-(--lp-blue-soft) text-(--lp-blue-deep)" aria-hidden="true">
        <Icon className="h-7 w-7" />
      </span>
      <p className="mt-5 font-display text-lg font-bold text-text">{heading}</p>
      {message && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-text/60">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
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
