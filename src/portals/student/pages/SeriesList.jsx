// Test series list. Student mode (/student/test-series): student_list_series
// with search (?q=), category filter (?category=), paging and enrol.
// Public mode (/test-series): public_list_series; actions go through login.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Chip from "../../../components/ui/Chip";
import Select from "../../../components/ui/Select";
import Button from "../../../components/ui/Button";
import { SearchIcon } from "../../../components/ui/icons";
import SeriesShowcaseCard from "../components/SeriesShowcaseCard";
import PageHero from "../components/PageHero";
import { Rise } from "../components/StudentKit";
import { EmptyPanel, ErrorState, LoadingState, PAGE } from "../components/PageState";
import { useStudentData } from "../hooks/useStudentData";
import { peekPublicList, studentSeriesApi } from "../services/studentSeriesApi";
import { isNotAvailable } from "../services/studentRpc";
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

const FILTER_SELECT = "h-11 w-full rounded-full border border-(--lp-line) bg-white px-4 pr-10 text-sm font-medium text-text outline-none transition-[border-color,box-shadow] duration-150 hover:border-(--lp-blue)/50 focus:border-(--lp-blue) focus:ring-4 focus:ring-(--lp-blue)/15";

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

  return (
    <div className={`${PAGE} pb-10`}>
      <PageHero
        compact
        theme="sky"
        art="search"
        eyebrow="Test series"
        title="Find a test series"
        subtitle="Practice tests with a timer, instant scoring and a detailed report after every attempt."
      />

      <div className="flex flex-col gap-4">
        <div className="relative max-w-xl">
          <SearchIcon className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-(--lp-blue)" />
          <input
            type="search"
            aria-label="Search test series"
            placeholder="Search by title, subject or exam"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-12 w-full rounded-full border-0 bg-white pl-12 sm:h-14 pr-5 text-sm text-text shadow-[0_22px_50px_-18px_rgba(37,87,214,0.28)] ring-1 ring-(--lp-line) transition-shadow duration-200 ease-out placeholder:text-text/40 focus:outline-none focus:shadow-[0_26px_60px_-16px_rgba(37,87,214,0.4)] focus:ring-2 focus:ring-(--lp-blue)"
          />
        </div>
        {!publicMode && (data?.categories?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by exam type">
            <Chip tone="blue" active={!category} onClick={() => setParam("category", "")}>All exams</Chip>
            {data.categories.map((c) => (
              <Chip tone="blue" key={c.id} active={category === c.id} onClick={() => setParam("category", c.id)}>{c.name}</Chip>
            ))}
          </div>
        )}
        {(data?.items?.length ?? 0) > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-row sm:flex-wrap sm:items-end" role="group" aria-label="Filter test series">
            <div className="block min-w-0 sm:w-52">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text/60">Subject</span>
              <Select wrapperClassName="block w-full" className={FILTER_SELECT} value={subject} onChange={(e) => setParam("subject", e.target.value)}>
                <option value="">All subjects</option>
                {subjects.map((v) => <option key={v} value={v}>{v}</option>)}
              </Select>
            </div>
            <div className="block min-w-0 sm:w-48">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text/60">Difficulty</span>
              <Select wrapperClassName="block w-full" className={FILTER_SELECT} value={level} onChange={(e) => setParam("level", e.target.value)}>
                <option value="">Any level</option>
                {levels.map((v) => <option key={v} value={v}>{v}</option>)}
              </Select>
            </div>
            <div className="col-span-2 sm:col-auto">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text/60">Price</span>
              <div className="flex gap-2" role="group" aria-label="Price">
                {[["", "All"], ["free", "Free"], ["paid", "Paid"]].map(([value, label]) => (
                  <Chip tone="blue" key={label} active={price === value} onClick={() => setParam("price", value)} className="h-11 px-5">{label}</Chip>
                ))}
              </div>
            </div>
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(params);
                  ["subject", "level", "price", "category", "page"].forEach((k) => next.delete(k));
                  setParams(next);
                }}
                className="col-span-2 h-11 px-2 text-sm font-semibold text-(--lp-blue-deep) underline-offset-4 hover:underline sm:col-auto"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

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
          {(filtersActive || q) && (
            <p className="mb-3 text-sm text-text/60" role="status">
              {filtered.length} series found
            </p>
          )}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((series, i) => (
              <Rise key={series.id} delay={Math.min(i, 8) * 70} className="h-full">
                <SeriesShowcaseCard
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
            <nav className="flex items-center justify-center gap-3" aria-label="Pages">
              <Button variant="secondary" fullWidth={false} disabled={currentPage <= 1} onClick={() => setParam("page", String(currentPage - 1))}>
                Previous
              </Button>
              <span className="text-sm text-text/60">Page {currentPage} of {totalPages}</span>
              <Button variant="secondary" fullWidth={false} disabled={currentPage >= totalPages} onClick={() => setParam("page", String(currentPage + 1))}>
                Next
              </Button>
            </nav>
          )}
        </>
      )}
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
