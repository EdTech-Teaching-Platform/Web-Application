import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import SectionShapes from "../../../components/common/SectionShapes";
import Chip from "../../../components/ui/Chip";
import { SearchIcon, StarIcon, FileTextIcon, ClockIcon, BookOpenIcon } from "../../../components/ui/icons";
import { useAuth } from "../../../hooks/useAuth";
import {
  CLASS_LEVELS,
  SERIES_SUBJECTS,
  EXAM_GOALS,
  SERIES_TEST_TYPES,
  SERIES_DIFFICULTIES,
  SERIES_LANGUAGES,
  SERIES_PRICE_FILTERS,
  SERIES_SORT_OPTIONS,
  TEST_SERIES_PACKAGES,
  getSeriesStartPath,
  isSeriesPurchased,
} from "../data/testSeriesCatalog";

const FILTER_GROUPS = [
  ["Class / Grade", CLASS_LEVELS, "classGrade", (pkg, value) => pkg.classGrade === value],
  ["Subject", SERIES_SUBJECTS, "subject", (pkg, value) => pkg.subject === value],
  ["Exam / Goal", EXAM_GOALS, "examGoal", (pkg, value) => pkg.examGoal === value],
  ["Test Type", SERIES_TEST_TYPES, "testType", (pkg, value) => pkg.testTypeSummary.some((entry) => entry.type === value)],
  ["Difficulty", SERIES_DIFFICULTIES, "difficulty", (pkg, value) => pkg.difficulty === value],
  ["Language", SERIES_LANGUAGES, "language", (pkg, value) => pkg.language === value],
  ["Price", SERIES_PRICE_FILTERS, "price", (pkg, value) => (value === "Free" ? pkg.price === 0 : pkg.price > 0)],
];

function badgeTone(badge) {
  if (badge === "FREE") return "bg-[#e7f1ef] text-[#28756f]";
  if (badge === "POPULAR") return "bg-[#f8e8df] text-primary";
  if (badge === "NEW") return "bg-[#e8effa] text-[#2f5f9e]";
  if (badge === "BEST VALUE") return "bg-[#f6f0dc] text-[#8a6a2a]";
  return "bg-[#f6f0dc] text-[#8a6a2a]";
}

function SeriesCard({ pkg }) {
  const { user } = useAuth();
  const location = useLocation();
  // Rendered both at the protected /student/test-series (logged-in browse)
  // and the public /test-series (anonymous browse — see public/routes.jsx).
  // Anyone can look; only actually starting/buying a test gates on login,
  // handled inside TestSeriesPackageDetail, so the "not purchased" link
  // below must still point at the RIGHT package-detail route family
  // depending on where the visitor currently is, same pattern CourseDetails
  // uses for relatedCoursePath.
  const isStudentContext = location.pathname.startsWith("/student/");
  const purchased = isSeriesPurchased(pkg.id, user);
  const ready = pkg.sections.some((section) => section.tests.some((test) => test.assessmentId));
  const detailPath = isStudentContext ? `/student/test-series/${pkg.id}` : `/test-series/${pkg.id}`;
  const href = purchased && ready ? getSeriesStartPath(pkg) : detailPath;
  return (
    <article className="flex h-full flex-col rounded-2xl border border-text/10 bg-white p-5 shadow-[0_4px_18px_rgba(23,50,77,0.04)] transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-wrap items-center gap-2">
        {pkg.badges.map((badge) => (
          <span key={badge} className={`rounded-full px-2.5 py-1 text-[9px] font-bold tracking-wider ${badgeTone(badge)}`}>{badge}</span>
        ))}
      </div>
      <p className="mt-3 text-[11px] font-semibold text-text/45">{pkg.classGrade} · {pkg.subject}</p>
      <h2 className="mt-1 font-display text-lg font-bold leading-snug text-text">{pkg.title}</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 border-y border-text/10 py-3 text-xs text-text/55">
        <span className="inline-flex items-center gap-1.5"><BookOpenIcon className="h-3.5 w-3.5" />{pkg.numberOfTests} tests</span>
        <span className="inline-flex items-center gap-1.5"><FileTextIcon className="h-3.5 w-3.5" />{pkg.totalQuestions}+ questions</span>
        <span className="inline-flex items-center gap-1.5"><ClockIcon className="h-3.5 w-3.5" />{pkg.durationRangeLabel}</span>
        <span className="inline-flex items-center gap-1"><StarIcon className="h-3.5 w-3.5 fill-current text-[#b88825]" />{pkg.rating.toFixed(1)}</span>
      </div>
      <p className="mt-3 text-[11px] text-text/50">{pkg.testTypeSummary.map((entry) => `${entry.count} ${entry.type}${entry.count === 1 ? "" : "s"}`).join(" · ")}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="font-display text-base font-bold text-text">{pkg.price === 0 ? "Free" : `₹${pkg.price}`}</span>
        <Link to={href} className="rounded-full border border-primary/20 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white">Join Test Series →</Link>
      </div>
    </article>
  );
}

function HorizontalRow({ title, packages, viewAllOnClick }) {
  if (!packages.length) return null;
  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-text">{title}</h2>
        {viewAllOnClick && <button type="button" onClick={viewAllOnClick} className="text-xs font-semibold text-primary hover:underline">View all →</button>}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {packages.map((pkg) => <SeriesCard key={pkg.id} pkg={pkg} />)}
      </div>
    </section>
  );
}

export default function TestSeriesMarketplace() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState("Popular");

  function toggle(key, value) {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? "" : value }));
  }
  function clearAll() {
    setFilters({});
    setQuery("");
  }

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const result = TEST_SERIES_PACKAGES.filter((pkg) => {
      if (text && !(pkg.title + " " + pkg.subject + " " + pkg.classGrade + " " + pkg.examGoal).toLowerCase().includes(text)) return false;
      return FILTER_GROUPS.every(([, , key, matches]) => !filters[key] || matches(pkg, filters[key]));
    });
    return result.sort((a, b) => {
      if (sort === "Newest") return b.id.localeCompare(a.id);
      if (sort === "Most Tests") return b.numberOfTests - a.numberOfTests;
      if (sort === "Highest Rated") return b.rating - a.rating;
      if (sort === "Price: Low to High") return a.price - b.price;
      return b.studentsEnrolled - a.studentsEnrolled;
    });
  }, [filters, query, sort]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const featured = TEST_SERIES_PACKAGES.filter((pkg) => pkg.badges.includes("POPULAR"));
  const freeSeries = TEST_SERIES_PACKAGES.filter((pkg) => pkg.price === 0);
  const fullLength = TEST_SERIES_PACKAGES.filter((pkg) => pkg.testTypeSummary.some((entry) => entry.type === "Full-Length Test"));

  return (
    <div>
      <div className="relative rounded-b-3xl bg-bg px-4 py-8 sm:px-6 lg:px-10">
        <SectionShapes variant="hero" />
        <div className="relative mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary/70">Prepare. Practice. Perform.</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">Test Series</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text/55">Practice with structured tests, improve your accuracy and understand your performance.</p>
          <label className="relative mt-6 block max-w-xl">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search test series, subjects or exams..."
              className="w-full rounded-full border border-text/10 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl bg-white rounded-3xl px-4 py-8 sm:px-6 lg:px-10">
        <SectionShapes variant="courses" />

        <HorizontalRow title="Featured Test Series" packages={featured} viewAllOnClick={() => document.getElementById("browse-all-test-series")?.scrollIntoView({ behavior: "smooth", block: "start" })} />
        <HorizontalRow title="Free Test Series" packages={freeSeries} viewAllOnClick={() => { setFilters({ price: "Free" }); document.getElementById("browse-all-test-series")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
        <HorizontalRow title="Full-Length Mock Tests" packages={fullLength} viewAllOnClick={() => { setFilters({ testType: "Full-Length Test" }); document.getElementById("browse-all-test-series")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />

        <section id="browse-all-test-series" className="mt-10 border-t border-text/10 pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-text">Browse all test series</h2>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && <button type="button" onClick={clearAll} className="text-xs font-semibold text-primary">Clear filters ({activeFilterCount})</button>}
              <label className="flex items-center gap-2 rounded-xl border border-text/10 bg-white px-3 text-xs text-text/55">
                Sort by
                <select value={sort} onChange={(event) => setSort(event.target.value)} className="bg-transparent py-2.5 font-semibold text-text outline-none">
                  {SERIES_SORT_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {FILTER_GROUPS.map(([label, options, key]) => (
              <div key={key}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text/45">{label}</p>
                <div className="flex flex-wrap gap-2">
                  {options.map((option) => (
                    <Chip key={option} active={filters[key] === option} onClick={() => toggle(key, option)} className="!px-3.5 !py-1.5 text-xs">{option}</Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between text-xs text-text/45">
            <span>{filtered.length} test series</span>
          </div>

          {filtered.length ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((pkg) => <SeriesCard key={pkg.id} pkg={pkg} />)}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-text/15 bg-white px-6 py-14 text-center">
              <h2 className="font-display text-lg font-bold text-text">No test series found.</h2>
              <p className="mt-2 text-sm text-text/50">Try changing your class, subject or test type filters.</p>
              <button type="button" onClick={clearAll} className="mt-4 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-white">Clear filters</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
