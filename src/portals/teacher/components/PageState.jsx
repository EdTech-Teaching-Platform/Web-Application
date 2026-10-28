// Loading / error / empty states shared by the educator portal pages.
export function PageCard({ title, action, children, className = "" }) {
  return (
    <section className={`rounded-[1.5rem] bg-white p-5 shadow-[0_18px_40px_-28px_rgba(15,17,21,0.28)] ring-1 ring-(--lp-line) ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-(family-name:--lp-font) text-lg font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Loading({ label = "Loading…" }) {
  return <p role="status" className="py-6 text-center text-sm text-(--lp-muted)">{label}</p>;
}

export function ErrorState({ error, onRetry }) {
  return (
    <div role="alert" className="rounded-2xl bg-danger/10 p-4 text-sm text-danger">
      {error?.message || "Something went wrong."}
      {onRetry && <button type="button" className="ml-3 font-semibold underline" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function Empty({ children }) {
  return <p className="py-6 text-center text-sm text-(--lp-muted)">{children}</p>;
}

export function StatusPill({ status, label }) {
  const tone = {
    published: "bg-emerald-100 text-emerald-800", scheduled: "bg-sky-100 text-sky-800", completed: "bg-emerald-100 text-emerald-800",
    approved: "bg-emerald-100 text-emerald-800", draft: "bg-slate-100 text-slate-700", assigned: "bg-slate-100 text-slate-700",
    in_progress: "bg-sky-100 text-sky-800", pending_approval: "bg-amber-100 text-amber-800", submitted: "bg-amber-100 text-amber-800",
    under_review: "bg-amber-100 text-amber-800", revision_requested: "bg-amber-100 text-amber-800", overdue: "bg-red-100 text-red-800",
    rejected: "bg-red-100 text-red-800", cancelled: "bg-slate-100 text-slate-500", pending: "bg-amber-100 text-amber-800",
  }[status] || "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{label || String(status || "").replace(/_/g, " ")}</span>;
}
