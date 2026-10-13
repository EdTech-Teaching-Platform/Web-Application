// Skeleton shown while the dashboard "loads". Opacity pulse only (motion-safe).
const bar = "rounded-3xl bg-primary/[0.07] motion-safe:animate-pulse";
export default function PerformanceSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true" aria-label="Loading performance data">
      <div className={`${bar} h-36`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className={`${bar} h-40`} />)}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><div className={`${bar} h-72`} /><div className={`${bar} h-72`} /></div>
      <div className={`${bar} h-96`} />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
