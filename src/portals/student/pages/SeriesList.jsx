// Test series list. Student mode (/student/test-series): student_list_series
// with search (?q=), category filter (?category=), paging and enrol.
// Public mode (/test-series): public_list_series; actions go through login.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Chip from "../../../components/ui/Chip";
import Select from "../../../components/ui/Select";
import Button from "../../../components/ui/Button";
import { BookOpenIcon, CheckIcon, ChevronRightIcon, ClockIcon, FileTextIcon, SearchIcon, TargetIcon } from "../../../components/ui/icons";
import AssetImage from "../../../components/common/AssetImage";
import { Rise } from "../components/StudentKit";
import { EmptyPanel, ErrorState, LoadingState } from "../components/PageState";
import { useStudentData } from "../hooks/useStudentData";
import { peekPublicList, studentSeriesApi } from "../services/studentSeriesApi";
import { isNotAvailable } from "../services/studentRpc";
import { formatMinutes, priceLabel } from "../utils/format";
import LoginPrompt from "../../../public/components/LoginPrompt";

const PAGE_SIZE = 12;
const LEVEL_ORDER = ["beginner", "intermediate", "advanced"];

// The catalogue is small, so student mode loads every live series (the RPC
// returns up to 50 per page) and filters + pages on the client. Search and
// the exam-category chips still go to the server.
async function listAll({ search, category }) {
  const first = await studentSeriesApi.list({ search, category, page: 1, size: 50 });
  let items = first.items ?? [];
  for (let p = 2; p <= Math.min(first.total_pages ?? 1, 10); p += 1) {
    const next = await studentSeriesApi.list({ search, category, page: p, size: 50 });
    items = items.concat(next.items ?? []);
  }
  return { ...first, items, total: items.length, total_pages: 1 };
}

const WIDE = "mx-auto w-full max-w-7xl space-y-6 px-4 py-4 sm:space-y-8 sm:px-6 sm:py-6 lg:px-8";
const SURFACE = "rounded-2xl bg-white ring-1 ring-(--lp-line) shadow-[0_1px_2px_rgb(15_17_21/0.04)]";
const FILTER_LABEL = "mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-(--lp-muted)";
const FILTER_CHIP = "h-9 px-4 py-0 text-[13px]";
const FILTER_SELECT = "h-10 w-full rounded-xl border border-(--lp-line) bg-white px-3.5 pr-10 text-sm font-medium text-text outline-none transition-[border-color,box-shadow] duration-150 hover:border-(--lp-blue)/50 focus:border-(--lp-blue-deep) focus:ring-4 focus:ring-(--lp-blue)/15";

// Quiet cover tints, cycled in a fixed order.
const TINTS = [
  "bg-(--lp-blue-soft) text-(--lp-blue-deep)",
  "bg-(--lp-yellow-soft) text-(--lp-ink)",
  "bg-(--lp-grey) text-(--lp-ink)",
];

// Presentation-only card for the catalogue grid. Same props and behaviour as
// SeriesShowcaseCard (series, index, onOpen, actionLabel, onAction,
// actionDisabled); a series banner (cover_path) covers the tinted band when
// there is one, and if it fails to load the band shows through.
function CatalogCard({ series, index = 0, onOpen, actionLabel, onAction, actionDisabled = false }) {
  const badge = series.exam || series.subject || undefined;
  const enrolled = Boolean(series.is_enrolled);
  const testsLabel = `${series.tests_count ?? 0} ${series.tests_count === 1 ? "test" : "tests"}`;
  const facts = [
    { icon: FileTextIcon, text: testsLabel },
    series.total_duration_mins ? { icon: ClockIcon, text: formatMinutes(series.total_duration_mins) } : null,
    series.level ? { icon: TargetIcon, text: series.level } : null,
  ].filter(Boolean);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(e); }}
      className="group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-(--lp-line) shadow-[0_1px_2px_rgb(15_17_21/0.04)] transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgb(15_17_21/0.28)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--lp-blue-deep)"
    >
      <div className={`relative h-28 w-full overflow-hidden ${TINTS[index % TINTS.length]}`}>
        <BookOpenIcon className="pointer-events-none absolute -bottom-5 right-4 h-24 w-24 opacity-[0.12]" aria-hidden="true" />
        {series.cover_path && <AssetImage path={series.cover_path} alt="" fallback={null} className="absolute inset-0 h-full w-full object-cover" />}
        {badge && (
          <span className="absolute left-4 top-4 max-w-[70%] truncate rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-(--lp-ink) shadow-sm">
            {badge}
          </span>
        )}
        {enrolled && (
          <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-success shadow-sm">
            <CheckIcon className="h-3 w-3" aria-hidden="true" />
            Enrolled
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="space-y-1">
          <h3 className="line-clamp-2 font-display text-[17px] font-semibold leading-snug tracking-tight text-(--lp-ink) sm:min-h-[2.8rem]">{series.title}</h3>
          {series.subject && <p className="line-clamp-1 text-sm font-medium text-text/70">{series.subject}</p>}
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-(--lp-muted)">
          {facts.map(({ icon: Icon, text }) => (
            <li key={text} className="inline-flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>

        {series.description && <p className="line-clamp-2 text-[13px] leading-relaxed text-text/60">{series.description}</p>}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-(--lp-line) pt-4">
          <span className="font-display text-lg font-semibold tracking-tight text-(--lp-ink)">{priceLabel(series)}</span>
          {actionLabel && (
            <button
              type="button"
              disabled={actionDisabled}
              onClick={(e) => { e.stopPropagation(); onAction?.(); }}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--lp-blue-deep) ${
                actionDisabled
                  ? "cursor-not-allowed bg-(--lp-grey) text-(--lp-muted)"
                  : enrolled
                    ? "bg-success/15 text-success hover:bg-success/25"
                    : "bg-(--lp-ink) text-white hover:bg-(--lp-blue-deep)"
              }`}
            >
              {actionLabel}
              {!actionDisabled && <ChevronRightIcon className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5" aria-hidden="true" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SeriesList({ publicMode = false }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const subject = params.get("subject") ?? "";
  const level = params.get("level") ?? "";
  const price = params.get("price") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [draft, setDraft] = useState(q);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState("");
  const [loginFor, setLoginFor] = useState(null);

  // Debounce typing into ?q= (page resets to 1).
  useEffect(() => {
    if (draft === q) return undefined;
    const id = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (draft.trim()) next.set("q", draft.trim()); else next.delete("q");
      next.delete("page");
      setParams(next, { replace: true });
    }, 350);
    return () => clearTimeout(id);
  }, [draft, q, params, setParams]);

  const key = publicMode ? "public" : `${q}|${category}`;
  // Repeat visitors see the last known list immediately; the fresh one swaps in
  // when it arrives, and a failed refresh never replaces a list that is showing.
  const [snapshot] = useState(() => {
    const items = publicMode ? peekPublicList() : null;
    return items ? { items, total: items.length, total_pages: 1, categories: [] } : null;
  });
  const { data: fetched, error: fetchError, loading: fetching, reload, setData } = useStudentData(
    () => (publicMode
      ? studentSeriesApi.publicListCached(50).then((items) => ({ items, total: items.length, total_pages: 1, categories: [] }))
      : listAll({ search: q, category })),
    key,
  );
  const data = fetched ?? snapshot;
  const loading = fetching && !data;
  const error = data ? null : fetchError;

  // Options for the filter dropdowns come from the series actually loaded.
  const subjects = useMemo(
    () => [...new Set((data?.items ?? []).map((s) => s.subject).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [data],
  );
  const levels = useMemo(() => {
    const found = [...new Set((data?.items ?? []).map((s) => s.level).filter(Boolean))];
    const rank = (l) => { const i = LEVEL_ORDER.indexOf(l.toLowerCase()); return i === -1 ? 99 : i; };
    return found.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }, [data]);

  // Public mode also filters its (small) list by the search text on the client.
  const filtered = useMemo(() => {
    const needle = publicMode ? q.toLowerCase() : "";
    return (data?.items ?? []).filter((s) => {
      if (needle && ![s.title, s.description, s.subject, s.exam].some((v) => v?.toLowerCase().includes(needle))) return false;
      if (subject && s.subject !== subject) return false;
      if (level && s.level !== level) return false;
      if (price === "free" && !s.is_free) return false;
      if (price === "paid" && s.is_free) return false;
      return true;
    });
  }, [data, publicMode, q, subject, level, price]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const items = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filtersActive = Boolean(subject || level || price || category);

  const setParam = (name, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value); else next.delete(name);
    if (name !== "page") next.delete("page");
    setParams(next);
  };

  const detailPath = (id) => (publicMode ? `/test-series/${id}` : `/student/test-series/${id}`);
  // Series the student is already enrolled in open under "My tests" (so that tab stays active).
  const openPath = (series) => (!publicMode && series.is_enrolled ? `/student/my-tests/${series.id}` : detailPath(series.id));

  const enroll = async (series) => {
    if (publicMode) {
      setLoginFor(series.id);
      return;
    }
    setBusyId(series.id);
    setNotice("");
    try {
      await studentSeriesApi.enroll(series.id);
      setData({ ...data, items: data.items.map((s) => (s.id === series.id ? { ...s, is_enrolled: true } : s)) });
    } catch (err) {
      setNotice(isNotAvailable(err) ? "Paid test series can't be bought yet. Free series are open now." : err.message);
    } finally {
      setBusyId(null);
    }
  };

  const showFilters = (data?.items?.length ?? 0) > 0;
  const hasCategories = !publicMode && (data?.categories?.length ?? 0) > 0;
  const clearFilters = () => {
    const next = new URLSearchParams(params);
    ["subject", "level", "price", "category", "page"].forEach((k) => next.delete(k));
    setParams(next);
  };

  return (
    <div className={`${WIDE} pb-12`}>
      <Rise>
        <header className={`${SURFACE} flex flex-col gap-6 p-5 sm:p-8 md:flex-row md:items-end md:justify-between`}>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-(--lp-muted)">Test series</p>
            <h1 className="mt-2 font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-(--lp-ink) sm:text-[2.25rem]">Find a test series</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-(--lp-muted) sm:text-[15px]">
              Practice tests with a timer, instant scoring and a detailed report after every attempt.
            </p>
          </div>
          <div className="relative w-full md:max-w-sm">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-(--lp-muted)" />
            <input
              type="search"
              aria-label="Search test series"
              placeholder="Search by title, subject or exam"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-12 w-full rounded-full border-0 bg-(--lp-grey) pl-11 pr-5 text-sm text-text ring-1 ring-(--lp-line) transition-[box-shadow,background-color] duration-150 ease-out placeholder:text-text/45 focus:bg-white focus:outline-none focus:ring-2 focus:ring-(--lp-blue-deep)"
            />
          </div>
        </header>
      </Rise>

      <div className={`grid gap-6 lg:gap-8 ${showFilters ? "lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:items-start" : ""}`}>
        {showFilters && (
          <aside aria-label="Filters" className={`${SURFACE} p-5 lg:sticky lg:top-24`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-sm font-semibold text-(--lp-ink)">Filters</h2>
              {filtersActive && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-md py-0.5 text-xs font-semibold text-(--lp-blue-deep) underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--lp-blue-deep)"
                >
                  Clear filters
                </button>
              )}
            </div>

            {hasCategories && (
              <div className="mt-5">
                <p className={FILTER_LABEL}>Exam type</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by exam type">
                  <Chip tone="blue" active={!category} onClick={() => setParam("category", "")} className={FILTER_CHIP}>All exams</Chip>
                  {data.categories.map((c) => (
                    <Chip tone="blue" key={c.id} active={category === c.id} onClick={() => setParam("category", c.id)} className={FILTER_CHIP}>{c.name}</Chip>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-1" role="group" aria-label="Filter test series">
              <div className="block min-w-0">
                <span className={FILTER_LABEL}>Subject</span>
                <Select wrapperClassName="block w-full" className={FILTER_SELECT} value={subject} onChange={(e) => setParam("subject", e.target.value)}>
                  <option value="">All subjects</option>
                  {subjects.map((v) => <option key={v} value={v}>{v}</option>)}
                </Select>
              </div>
              <div className="block min-w-0">
                <span className={FILTER_LABEL}>Difficulty</span>
                <Select wrapperClassName="block w-full" className={FILTER_SELECT} value={level} onChange={(e) => setParam("level", e.target.value)}>
                  <option value="">Any level</option>
                  {levels.map((v) => <option key={v} value={v}>{v}</option>)}
                </Select>
              </div>
              <div className="col-span-2 lg:col-span-1">
                <span className={FILTER_LABEL}>Price</span>
                <div className="flex gap-2" role="group" aria-label="Price">
                  {[["", "All"], ["free", "Free"], ["paid", "Paid"]].map(([value, label]) => (
                    <Chip tone="blue" key={label} active={price === value} onClick={() => setParam("price", value)} className={FILTER_CHIP}>{label}</Chip>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        )}

        <div className="min-w-0 space-y-6">
          {notice && <p role="status" className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-text">{notice}</p>}

          {loading ? (
            <LoadingState label="Loading test series" rows={3} />
          ) : error ? (
            <ErrorState error={error} onRetry={reload} title="Couldn't load test series" />
          ) : items.length === 0 ? (
            <EmptyPanel
              icon={q || filtersActive ? SearchIcon : undefined}
              heading={q ? `Nothing found for “${q}”` : filtersActive ? "No series match these filters" : "No test series yet"}
              message={q || filtersActive ? "We couldn't find a test series that matches. Try a different keyword or clear your filters." : "New test series appear here as soon as they're published."}
              action={(q || filtersActive) && (
                <Button variant="secondary" fullWidth={false} onClick={() => { setDraft(""); setParams(new URLSearchParams()); }}>
                  Clear search and filters
                </Button>
              )}
            />
          ) : (
            <>
              <p className="text-sm text-(--lp-muted)" role="status">
                {filtersActive || q ? `${filtered.length} series found` : `${filtered.length} ${filtered.length === 1 ? "series" : "series"} available`}
              </p>
              <div className={`grid gap-5 sm:grid-cols-2 ${showFilters ? "xl:grid-cols-3" : "lg:grid-cols-3"}`}>
                {items.map((series, i) => (
                  <Rise key={series.id} delay={Math.min(i, 8) * 50} className="h-full">
                    <CatalogCard
                      series={series}
                      index={i}
                      onOpen={() => navigate(openPath(series))}
                      actionLabel={series.is_enrolled ? "Enrolled · Open" : busyId === series.id ? "Enrolling…" : series.is_free ? "Enrol free" : "View details"}
                      actionDisabled={busyId === series.id}
                      onAction={() => (series.is_enrolled || !series.is_free ? navigate(openPath(series)) : enroll(series))}
                    />
                  </Rise>
                ))}
              </div>
              {totalPages > 1 && (
                <nav className="flex items-center justify-center gap-3 pt-2" aria-label="Pages">
                  <Button variant="secondary" fullWidth={false} disabled={currentPage <= 1} onClick={() => setParam("page", String(currentPage - 1))}>
                    Previous
                  </Button>
                  <span className="text-sm text-(--lp-muted)">Page {currentPage} of {totalPages}</span>
                  <Button variant="secondary" fullWidth={false} disabled={currentPage >= totalPages} onClick={() => setParam("page", String(currentPage + 1))}>
                    Next
                  </Button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>

      {publicMode && (
        <LoginPrompt
          open={Boolean(loginFor)}
          onClose={() => setLoginFor(null)}
          redirect={loginFor ? `/student/test-series/${loginFor}` : ""}
          title="Log in to enrol"
        />
      )}
    </div>
  );
}
