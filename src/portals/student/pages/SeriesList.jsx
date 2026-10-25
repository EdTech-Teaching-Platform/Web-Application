// Test series list. Student mode (/student/test-series): student_list_series
// with search (?q=), category filter (?category=), paging and enrol.
// Public mode (/test-series): public_list_series; actions go through login.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Chip from "../../../components/ui/Chip";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import { SearchIcon } from "../../../components/ui/icons";
import SeriesCard from "../components/SeriesCard";
import { EmptyPanel, ErrorState, LoadingState, PAGE, PageHeader } from "../components/PageState";
import { useStudentData } from "../hooks/useStudentData";
import { studentSeriesApi } from "../services/studentSeriesApi";
import { isNotAvailable } from "../services/studentRpc";

const PAGE_SIZE = 12;

export default function SeriesList({ publicMode = false }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [draft, setDraft] = useState(q);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState("");

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

  const key = publicMode ? "public" : `${q}|${category}|${page}`;
  const { data, error, loading, reload, setData } = useStudentData(
    () => (publicMode
      ? studentSeriesApi.publicList(50).then((items) => ({ items, total: items.length, total_pages: 1, categories: [] }))
      : studentSeriesApi.list({ search: q, category, page, size: PAGE_SIZE })),
    key,
  );

  // Public mode filters the (small) public list on the client.
  const items = useMemo(() => {
    const all = data?.items ?? [];
    if (!publicMode || !q) return all;
    const needle = q.toLowerCase();
    return all.filter((s) => [s.title, s.description, s.subject, s.exam].some((v) => v?.toLowerCase().includes(needle)));
  }, [data, publicMode, q]);

  const setParam = (name, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value); else next.delete(name);
    if (name !== "page") next.delete("page");
    setParams(next);
  };

  const detailPath = (id) => (publicMode ? `/test-series/${id}` : `/student/test-series/${id}`);

  const enroll = async (series) => {
    if (publicMode) {
      navigate(`/login?redirect=${encodeURIComponent(`/student/test-series/${series.id}`)}`);
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
    <div className={PAGE}>
      <PageHeader
        eyebrow="Test series"
        title="Find a test series"
        subtitle="Practice tests with a timer, instant scoring and a detailed report after every attempt."
      />

      <div className="flex flex-col gap-4">
        <div className="relative max-w-xl">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text/40" />
          <Input
            aria-label="Search test series"
            placeholder="Search by title, subject or exam"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="pl-10"
          />
        </div>
        {!publicMode && (data?.categories?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by subject">
            <Chip active={!category} onClick={() => setParam("category", "")}>All subjects</Chip>
            {data.categories.map((c) => (
              <Chip key={c.id} active={category === c.id} onClick={() => setParam("category", c.id)}>{c.name}</Chip>
            ))}
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
          heading={q || category ? "No series match your search" : "No test series yet"}
          message={q || category ? "Try another word or clear the filters." : "New test series appear here as soon as they're published."}
          action={(q || category) && (
            <Button variant="secondary" fullWidth={false} onClick={() => { setDraft(""); setParams(new URLSearchParams()); }}>
              Clear search
            </Button>
          )}
        />
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((series, i) => (
              <SeriesCard
                key={series.id}
                series={series}
                index={i}
                onOpen={() => navigate(detailPath(series.id))}
                actionLabel={series.is_enrolled ? "Enrolled · Open" : busyId === series.id ? "Enrolling…" : series.is_free ? "Enrol free" : "View details"}
                actionDisabled={busyId === series.id}
                onAction={() => (series.is_enrolled || !series.is_free ? navigate(detailPath(series.id)) : enroll(series))}
              />
            ))}
          </div>
          {!publicMode && (data?.total_pages ?? 1) > 1 && (
            <nav className="flex items-center justify-center gap-3" aria-label="Pages">
              <Button variant="secondary" fullWidth={false} disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>
                Previous
              </Button>
              <span className="text-sm text-text/60">Page {page} of {data.total_pages}</span>
              <Button variant="secondary" fullWidth={false} disabled={page >= data.total_pages} onClick={() => setParam("page", String(page + 1))}>
                Next
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
