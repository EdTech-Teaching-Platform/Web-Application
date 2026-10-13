import StatCard from "../../../../components/ui/StatCard";
import { UsersIcon, QuizIcon, ChartIcon, StarIcon, CertificateIcon, ClockIcon, CheckIcon, TrendingUpIcon } from "../../../../components/ui/icons";
import Sparkline from "./Sparkline";

// Nine KPI tiles (StatCard tone / hero / ring) with per-test sparklines.
export default function KpiRow({ kpi, spark, trackedNote }) {
  const cards = [
    { key: "enrolled", icon: UsersIcon, tone: "blue", label: "Enrolled (tracked)", value: kpi.enrolled, spark: spark.enrolled, sparkLabel: "Attempts per test" },
    { key: "attempted", icon: QuizIcon, tone: "lavender", label: "Attempted", value: kpi.attempted, spark: spark.attempted, sparkLabel: "Students per test" },
    { key: "completion", icon: ChartIcon, tone: "sage", label: "Completion rate", value: `${kpi.completion}%`, ring: kpi.completion, spark: spark.completion, sparkLabel: "Completion by test" },
    { key: "avg", icon: TrendingUpIcon, tone: "maroon", label: "Average score", value: `${kpi.avg}%`, hero: true, spark: spark.avg, sparkLabel: "Average score by test" },
    { key: "median", icon: ChartIcon, tone: "orange", label: "Median score", value: `${kpi.median}%`, spark: spark.median, sparkLabel: "Median by test" },
    { key: "high", icon: StarIcon, tone: "pink", label: "Highest score", value: `${kpi.high}%`, spark: spark.high, sparkLabel: "Highest by test" },
    { key: "pass", icon: CertificateIcon, tone: "sage", label: "Pass rate", value: `${kpi.pass}%`, ring: kpi.pass, spark: spark.pass, sparkLabel: "Pass rate by test" },
    { key: "time", icon: ClockIcon, tone: "blue", label: "Avg time per test", value: `${kpi.timeMin} min`, spark: spark.timeMin, sparkLabel: "Minutes by test" },
    { key: "acc", icon: CheckIcon, tone: "lavender", label: "Avg accuracy", value: `${kpi.accuracy}%`, ring: kpi.accuracy, spark: spark.accuracy, sparkLabel: "Accuracy by test" },
  ];
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <StatCard key={c.key} icon={c.icon} tone={c.tone} label={c.label} value={c.value} hero={c.hero} ring={c.ring} action={<Sparkline values={c.spark} label={c.sparkLabel} />} />
        ))}
      </div>
      {trackedNote && <p className="mt-3 text-xs text-muted">{trackedNote}</p>}
    </div>
  );
}
