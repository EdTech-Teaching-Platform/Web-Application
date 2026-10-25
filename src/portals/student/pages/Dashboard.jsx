// Student dashboard (student_dashboard): continue where you left off,
// enrolled test series, recent history, stats and recommended series.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import ListRow from "../../../components/ui/ListRow";
import StatCard from "../../../components/ui/StatCard";
import { useAuth } from "../../../hooks/useAuth";
import SeriesCard from "../components/SeriesCard";
import { ErrorState, LoadingState, PAGE, PageHeader } from "../components/PageState";
import { useStudentData } from "../hooks/useStudentData";
import { studentSeriesApi } from "../services/studentSeriesApi";
import { formatClock, formatPercent } from "../utils/format";
import { AttemptRow } from "./History";

function Section({ title, action, children }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-text">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }) {
  return <p className="rounded-2xl bg-white px-5 py-6 text-sm text-text/60 ring-1 ring-text/10">{children}</p>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, error, loading, reload } = useStudentData(() => studentSeriesApi.dashboard(), "dashboard");
  const firstName = (user?.name || "").split(" ")[0];
  const [openedAt] = useState(() => Date.now());   // "time left" is a snapshot; the runner has the live timer

  if (loading) return <div className={PAGE}><LoadingState label="Loading your dashboard" rows={4} /></div>;
  if (error) return <div className={PAGE}><ErrorState error={error} onRetry={reload} title="Couldn't load your dashboard" /></div>;

  const { continue_learning: resume, enrolled_series: enrolled, recent_history: recent, stats, recommended_series: recommended } = data;

  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow="Dashboard"
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        subtitle="Pick up a test, check your latest report, or find a new series."
      />

      <section className="grid grid-cols-2 gap-5 rounded-3xl bg-white p-6 ring-1 ring-text/10 sm:grid-cols-5" aria-label="Your stats">
        <StatCard value={stats.tests_taken ?? 0} label="Tests taken" />
        <StatCard value={stats.tests_passed ?? 0} label="Passed" />
        <StatCard value={formatPercent(stats.average_percentage, 1)} label="Average" />
        <StatCard value={stats.current_streak ?? 0} suffix={stats.current_streak === 1 ? " day" : " days"} label="Streak" />
        <StatCard value={stats.series_enrolled ?? 0} label="Series" />
      </section>

      <Section title="Continue where you left off">
        {resume.length === 0 ? (
          <Empty>No test in progress. Start one from your series below.</Empty>
        ) : (
          <ul className="space-y-2">
            {resume.map((a) => {
              const left = a.deadline ? Math.max(0, (new Date(a.deadline).getTime() - openedAt) / 1000) : null;
              return (
                <li key={a.attempt_id}>
                  <ListRow
                    title={a.test_title}
                    subtitle={`${a.series_title ?? ""} · ${a.answered} of ${a.questions_count} answered`}
                    meta={left !== null ? `${formatClock(left)} left` : "Untimed"}
                    trailing={<span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">Resume</span>}
                    onClick={() => navigate(`/student/test/${a.test_id}/take`)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section
        title="Your test series"
        action={enrolled.length > 0 && <Button variant="secondary" fullWidth={false} onClick={() => navigate("/student/my-tests")}>See all</Button>}
      >
        {enrolled.length === 0 ? (
          <Empty>You haven't enrolled in a test series yet. Recommended series are below.</Empty>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {enrolled.map((s, i) => (
              <SeriesCard key={s.id} series={s} index={i} progress={Number(s.progress_percentage) || 0}
                onResume={() => navigate(`/student/test-series/${s.id}`)} onOpen={() => navigate(`/student/test-series/${s.id}`)} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Recent results"
        action={recent.length > 0 && <Button variant="secondary" fullWidth={false} onClick={() => navigate("/student/history")}>Full history</Button>}
      >
        {recent.length === 0 ? (
          <Empty>Your results appear here after your first test.</Empty>
        ) : (
          <ul className="space-y-2">
            {recent.map((item) => (
              <li key={item.attempt_id}><AttemptRow item={item} onOpen={navigate} /></li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Recommended for you"
        action={<Button variant="secondary" fullWidth={false} onClick={() => navigate("/student/test-series")}>Browse all</Button>}
      >
        {recommended.length === 0 ? (
          <Empty>No new series to recommend right now.</Empty>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((s, i) => (
              <SeriesCard key={s.id} series={s} index={i} actionLabel="View" onAction={() => navigate(`/student/test-series/${s.id}`)}
                onOpen={() => navigate(`/student/test-series/${s.id}`)} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
