// Landing "Featured test series": the newest published series from
// public_list_series (anon RPC). Loading shows placeholders; if the request
// fails the section quietly hides (the rest of the landing page still works).
import { useNavigate } from "react-router-dom";
import SeriesCard from "../../../portals/student/components/SeriesCard";
import { useStudentData } from "../../../portals/student/hooks/useStudentData";
import { studentSeriesApi } from "../../../portals/student/services/studentSeriesApi";
import { PillButton, Reveal, SectionHead } from "./LandingUI";

const SHELL = "mx-auto w-full max-w-[1200px] px-5 sm:px-8";

export default function FeaturedSeries({ limit = 6 }) {
  const navigate = useNavigate();
  const { data, error, loading } = useStudentData(() => studentSeriesApi.publicList(limit), limit);
  if (error) return null;
  const items = data ?? [];

  return (
    <section id="featured-series" className="scroll-mt-24 bg-white py-14 md:py-20" aria-labelledby="featured-series-title">
      <div className={SHELL}>
        <Reveal>
          <SectionHead
            eyebrow="Featured test series"
            title={<span id="featured-series-title">Start practising today.</span>}
            subtitle="Published series you can join now. Free series open in one click after you sign up."
          />
        </Reveal>
        {loading ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading test series">
            {Array.from({ length: 3 }, (_, i) => <div key={i} className="h-[340px] animate-pulse rounded-xl bg-(--lp-grey)" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="mt-10 text-center text-sm text-(--lp-muted)">New test series are on their way. Check back soon.</p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((series, i) => (
              <SeriesCard key={series.id} series={series} index={i} actionLabel="View series"
                onAction={() => navigate(`/test-series/${series.id}`)} onOpen={() => navigate(`/test-series/${series.id}`)} />
            ))}
          </div>
        )}
        <Reveal className="mt-10 flex justify-center">
          <PillButton tone="ink" onClick={() => navigate("/test-series")}>See all test series</PillButton>
        </Reveal>
      </div>
    </section>
  );
}
