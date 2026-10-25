// My Tests (student_my_series): the series the student is enrolled in, with progress.
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import SeriesCard from "../components/SeriesCard";
import { EmptyPanel, ErrorState, LoadingState, PAGE, PageHeader } from "../components/PageState";
import { useStudentData } from "../hooks/useStudentData";
import { studentSeriesApi } from "../services/studentSeriesApi";
import { formatDate, formatPercent } from "../utils/format";

export default function MyTests() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useStudentData(() => studentSeriesApi.mySeries(), "my-series");

  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow="Enrolled"
        title="My tests"
        subtitle="Your test series and how far you've got in each."
        actions={<Button variant="secondary" fullWidth={false} onClick={() => navigate("/student/test-series")}>Find more</Button>}
      />
      {loading ? (
        <LoadingState label="Loading your series" />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} title="Couldn't load your series" />
      ) : data.length === 0 ? (
        <EmptyPanel
          heading="You haven't enrolled in a test series yet"
          message="Free series can be joined in one click."
          action={<Button fullWidth={false} onClick={() => navigate("/student/test-series")}>Browse test series</Button>}
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((s, i) => (
            <div key={s.id} className="flex flex-col gap-2">
              <SeriesCard
                series={s}
                index={i}
                progress={Number(s.progress_percentage) || 0}
                onResume={() => navigate(`/student/test-series/${s.id}`)}
                onOpen={() => navigate(`/student/test-series/${s.id}`)}
              />
              <p className="px-1 text-xs text-text/60">
                {s.tests_attempted} of {s.tests_count} tests taken
                {s.best_percentage !== null && s.best_percentage !== undefined && <> · best {formatPercent(s.best_percentage, 1)}</>}
                {s.latest_attempt_at && <> · last {formatDate(s.latest_attempt_at)}</>}
                {s.expires_at && <> · access until {formatDate(s.expires_at)}</>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
