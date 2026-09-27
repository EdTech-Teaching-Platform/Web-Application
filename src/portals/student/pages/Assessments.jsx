import { Link } from "react-router-dom";
import { AwardIcon, BookOpenIcon, CheckCircleIcon, ClockIcon, FileTextIcon, TrendingUpIcon } from "../../../components/ui/icons";
import StatusBadge from "../../../components/ui/StatusBadge";
import { COURSE_QUIZZES, getSavedAttempts } from "../data/assessmentCatalog";
import { TEST_SERIES_PACKAGES } from "../data/testSeriesCatalog";

const sections = [
  { eyebrow: "TEST SERIES", title: "Test Series", description: "Take structured tests across your courses and subjects.", count: `${TEST_SERIES_PACKAGES.length} available series`, action: "Explore Test Series", href: "/student/test-series", icon: FileTextIcon, color: "bg-[#f8e8df]", accent: "text-primary" },
  { eyebrow: "ASSIGNMENTS", title: "Assignments", description: "Complete short learning checks as you move through each course.", count: COURSE_QUIZZES.length + " course assignments", action: "View Assignments", href: "/student/assessments/course-quizzes", icon: BookOpenIcon, color: "bg-[#e7f1ef]", accent: "text-[#28756f]" },
];

export default function Assessments() {
  const attempts = getSavedAttempts();
  const latest = attempts.slice(0, 3);
  const average = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.percentage, 0) / attempts.length) : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Learn · Practice · Measure</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">Assessments</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-text/60">Test what you’ve learned. Identify your strengths. Know what to improve.</p></div>
      </header>

      <section className="mt-7 grid gap-4 lg:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return <article key={section.title} className="flex min-h-[248px] flex-col rounded-2xl border border-text/10 bg-white p-5 shadow-[0_4px_18px_rgba(23,50,77,0.04)] sm:p-6"><div className="flex items-start justify-between"><span className={"flex h-12 w-12 items-center justify-center rounded-2xl " + section.color + " " + section.accent}><Icon className="h-6 w-6" /></span><span className="rounded-full bg-bg px-3 py-1 text-[11px] font-semibold text-text/50">{section.count}</span></div><p className={"mt-5 text-[10px] font-bold tracking-[0.16em] " + section.accent}>{section.eyebrow}</p><h2 className="mt-1 font-display text-xl font-bold text-text">{section.title}</h2><p className="mt-2 flex-1 text-sm leading-6 text-text/55">{section.description}</p><Link to={section.href} className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-primary/90">{section.action}<span aria-hidden="true">→</span></Link></article>;
        })}
      </section>

      <section className="mt-7 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-text/10 bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-primary/70">Your progress</p><h2 className="mt-1 font-display text-xl font-bold text-text">A clearer picture of what you know</h2></div><Link to="/student/assessments/test-series" className="text-xs font-semibold text-primary">View in Test Series →</Link></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[[attempts.length, "Tests completed"], [average + "%", "Average score"], [attempts.filter((attempt) => attempt.passed).length, "Tests passed"], [attempts.reduce((total, attempt) => total + attempt.total, 0), "Questions answered"]].map(([value, label]) => <div key={label} className="rounded-xl bg-[#fcfbfa] p-3"><strong className="font-display text-2xl text-text">{value}</strong><span className="mt-1 block text-[11px] text-text/50">{label}</span></div>)}</div><div className="mt-5 flex items-center gap-3 rounded-xl bg-[#f5f2fa] p-4"><TrendingUpIcon className="h-5 w-5 shrink-0 text-[#71549a]" /><p className="text-sm leading-5 text-text/65">{attempts.length ? "Each completed assessment adds to your learning insights and history." : "Your attempts are saved so you can compare scores and see how your skills grow."}</p></div></div>
        <div className="rounded-2xl bg-[#4a0e0e] p-5 text-white sm:p-6"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><AwardIcon className="h-5 w-5 text-[#f0c2b2]" /></span><h2 className="mt-4 font-display text-xl font-bold">Show what you know</h2><p className="mt-2 text-sm leading-6 text-white/70">Some structured assessments include a certificate when you reach the passing score. Eligibility is always shown before you begin.</p><div className="mt-5 flex items-center gap-2 text-xs font-semibold text-[#f0c2b2]"><CheckCircleIcon className="h-4 w-4" />Verified assessment outcomes</div></div>
      </section>

      <section className="mt-7 rounded-2xl border border-text/10 bg-white p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-primary/70">Recent attempts</p><h2 className="mt-1 font-display text-xl font-bold text-text">Pick up where you left off</h2></div><ClockIcon className="h-5 w-5 text-text/35" /></div>{latest.length ? <div className="mt-4 divide-y divide-text/10">{latest.map((attempt) => <Link key={attempt.id} to={"/student/assessments/results/" + attempt.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-1"><div><p className="text-sm font-semibold text-text">{attempt.assessmentTitle}</p><p className="mt-1 text-xs text-text/45">{new Date(attempt.submittedAt).toLocaleDateString()} · Attempt {attempt.attemptNumber}</p></div><div className="flex items-center gap-3"><strong className="font-display text-lg text-text">{attempt.percentage}%</strong><StatusBadge status={attempt.passed ? "success" : "warning"}>{attempt.passed ? "Passed" : "Keep practicing"}</StatusBadge></div></Link>)}</div> : <p className="mt-3 text-sm text-text/50">Your completed assessments will appear here. Start with a test series or a short course quiz.</p>}</section>
    </div>
  );
}
