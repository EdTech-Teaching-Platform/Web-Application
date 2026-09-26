import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Chip from "../../../components/ui/Chip";
import { ClockIcon, FileTextIcon, StarIcon } from "../../../components/ui/icons";
import { useAuth } from "../../../hooks/useAuth";
import { TEST_SERIES_PACKAGES, getPurchasedSeriesIds, getSeriesProgress } from "../data/testSeriesCatalog";

const FILTERS = ["All", "Not Started", "In Progress", "Completed"];

function statusTone(status) {
  if (status === "Completed") return "bg-[#e7f1ef] text-[#28756f]";
  if (status === "In Progress") return "bg-[#f8e8df] text-primary";
  return "bg-bg text-text/50";
}

function SeriesProgressCard({ pkg, progress }) {
  const percent = progress.totalTests ? Math.round((progress.testsCompleted / progress.totalTests) * 100) : 0;
  // A purchased package whose entire content is still comingSoon (no
  // linked assessment has shipped yet) has totalTests === 0 — "0 of 0
  // tests completed" reads as broken, so show its actual state instead.
  if (!progress.totalTests) {
    return (
      <article className="flex h-full flex-col rounded-2xl border border-text/10 bg-white p-5 shadow-[0_4px_18px_rgba(23,50,77,0.04)]">
        <span className="w-fit rounded-full bg-[#f6f0dc] px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#8a6a2a]">COMING SOON</span>
        <p className="mt-3 text-[11px] font-semibold text-text/45">{pkg.classGrade} · {pkg.subject}</p>
        <h3 className="mt-1 font-display text-base font-bold leading-snug text-text">{pkg.title}</h3>
        <p className="mt-3 text-xs leading-5 text-text/50">{pkg.comingSoonNotice || "This series's tests aren't open for attempts yet."}</p>
        <Link to={`/student/test-series/${pkg.id}`} className="mt-4 inline-flex items-center justify-center rounded-full border border-primary/20 px-4 py-2.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white">View Series →</Link>
      </article>
    );
  }
  return (
    <article className="flex h-full flex-col rounded-2xl border border-text/10 bg-white p-5 shadow-[0_4px_18px_rgba(23,50,77,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider ${statusTone(progress.status)}`}>{progress.status}</span>
        {progress.averageScore !== null && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-text/55"><StarIcon className="h-3.5 w-3.5 fill-current text-[#b88825]" />{progress.averageScore}% avg</span>
        )}
      </div>
      <p className="mt-3 text-[11px] font-semibold text-text/45">{pkg.classGrade} · {pkg.subject}</p>
      <h3 className="mt-1 font-display text-base font-bold leading-snug text-text">{pkg.title}</h3>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] font-semibold text-text/50">
          <span>{progress.testsCompleted} of {progress.totalTests} tests completed</span>
          <span>{percent}%</span>
        </div>
        <div className="mt-1.5 h-2 rounded-full bg-bg">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-text/55">
        <span className="inline-flex items-center gap-1.5"><FileTextIcon className="h-3.5 w-3.5" />Best: {progress.bestScore !== null ? `${progress.bestScore}%` : "—"}</span>
        <span className="inline-flex items-center gap-1.5"><ClockIcon className="h-3.5 w-3.5" />{progress.lastAttempt ? "Last: " + new Date(progress.lastAttempt.submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Not attempted yet"}</span>
      </div>

      <Link
        to={progress.nextTest ? `/student/assessments/test-series/${progress.nextTest.assessmentId}` : `/student/test-series/${pkg.id}`}
        className="mt-4 inline-flex items-center justify-center rounded-full border border-primary/20 px-4 py-2.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white"
      >
        {progress.status === "Not Started" ? "Start Series →" : progress.status === "Completed" ? "Retake Latest Test →" : "Continue Series →"}
      </Link>
      <Link to={`/student/test-series/${pkg.id}`} className="mt-2 text-center text-[11px] font-semibold text-text/40 hover:text-primary hover:underline">
        View all tests in this series
      </Link>
    </article>
  );
}

// Shared between MyLearning.jsx (full section) and Dashboard.jsx (a
// compact shortcut) so "My Test Series" progress is computed and rendered
// in exactly one place — real purchased-series + real saved attempts,
// never a second parallel data source. `variant="compact"` caps the list
// to the 2 most-recently-relevant series and drops the filter chips, for
// use as a dashboard shortcut card rather than a full browsing view.
export default function MyTestSeriesSection({ variant = "full" }) {
  const { user } = useAuth();
  const [filter, setFilter] = useState("All");

  const rows = useMemo(() => {
    const purchasedIds = getPurchasedSeriesIds(user);
    return purchasedIds
      .map((id) => TEST_SERIES_PACKAGES.find((pkg) => pkg.id === id))
      .filter(Boolean)
      .map((pkg) => ({ pkg, progress: getSeriesProgress(pkg, user) }));
  }, [user]);

  const filtered = variant === "compact"
    ? [...rows].sort((a, b) => (b.progress.lastAttempt ? new Date(b.progress.lastAttempt.submittedAt) : 0) - (a.progress.lastAttempt ? new Date(a.progress.lastAttempt.submittedAt) : 0)).slice(0, 2)
    : rows.filter(({ progress }) => filter === "All" || progress.status === filter);

  if (!rows.length) {
    return (
      <section id="my-test-series" className="mt-7">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-text">My Test Series</h2>
        </div>
        <div className="mt-4 rounded-2xl border border-dashed border-text/15 bg-white px-6 py-10 text-center">
          <h3 className="font-display text-base font-semibold text-text">No test series yet</h3>
          <p className="mt-2 text-sm text-text/50">Buy a test series to start tracking your progress here.</p>
          <Link to="/student/test-series" className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-white">Browse Test Series</Link>
        </div>
      </section>
    );
  }

  return (
    <section id="my-test-series" className="mt-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-text">My Test Series</h2>
        {variant === "compact" ? (
          <Link to="/student/my-learning" className="text-xs font-semibold text-primary hover:underline">View all →</Link>
        ) : (
          <Link to="/student/test-series" className="text-xs font-semibold text-primary hover:underline">Browse more →</Link>
        )}
      </div>
      {variant !== "compact" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((item) => <Chip key={item} active={filter === item} onClick={() => setFilter(item)}>{item}</Chip>)}
        </div>
      )}
      {filtered.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ pkg, progress }) => <SeriesProgressCard key={pkg.id} pkg={pkg} progress={progress} />)}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-text/15 bg-white px-6 py-10 text-center">
          <p className="text-sm text-text/50">No test series match this filter.</p>
        </div>
      )}
    </section>
  );
}
