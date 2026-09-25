import { Link } from "react-router-dom";
import StatusBadge from "../../../components/ui/StatusBadge";
import { AwardIcon, CheckCircleIcon, ClockIcon, TargetIcon, TrendingUpIcon } from "../../../components/ui/icons";
import { getSavedAttempts } from "../data/assessmentCatalog";

export default function AssessmentResults() {
  const attempts = getSavedAttempts();
  const average = attempts.length ? Math.round(attempts.reduce((sum, item) => sum + item.percentage, 0) / attempts.length) : 0;
  const bySkill = new Map();
  attempts.forEach((attempt) => {
    (attempt.skills || []).forEach((skill) => {
      const current = bySkill.get(skill) || [];
      current.push(attempt.percentage);
      bySkill.set(skill, current);
    });
  });
  const skillRows = Array.from(bySkill.entries()).map(([skill, scores]) => [skill, Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)]).slice(0, 6);
  const byAssessment = new Map();
  attempts.slice().reverse().forEach((attempt) => {
    const list = byAssessment.get(attempt.assessmentId) || [];
    list.push(attempt);
    byAssessment.set(attempt.assessmentId, list);
  });
  const improvements = Array.from(byAssessment.values()).map((history) => ({ title: history[history.length - 1].assessmentTitle, first: history[0].percentage, latest: history[history.length - 1].percentage })).filter((item) => item.first !== item.latest);

  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
    <Link to="/student/assessments" className="text-xs font-semibold text-primary">← Assessments</Link>
    <header className="mt-4 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary/70">Your assessment history</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">My Results</h1><p className="mt-2 text-sm text-text/55">See what’s improving and decide what to practice next.</p></div><span className="rounded-full bg-[#e7f1ef] px-3 py-1.5 text-xs font-semibold text-[#28756f]">Saved to your learning profile</span></header>
    <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{[[attempts.length, "Tests completed"], [average + "%", "Average score"], [attempts.filter((item) => item.passed).length, "Tests passed"], [attempts.reduce((total, item) => total + item.total, 0), "Questions answered"]].map(([value, label]) => <div key={label} className="rounded-2xl border border-text/10 bg-white p-4"><strong className="font-display text-2xl text-text sm:text-3xl">{value}</strong><span className="mt-1 block text-xs text-text/50">{label}</span></div>)}</section>
    <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-2xl border border-text/10 bg-white p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-primary/70">Assessment history</p><h2 className="mt-1 font-display text-xl font-bold text-text">Recent assessments</h2></div><ClockIcon className="h-5 w-5 text-text/35" /></div>{attempts.length ? <div className="mt-4 divide-y divide-text/10">{attempts.map((attempt) => <Link key={attempt.id} to={"/student/assessments/results/" + attempt.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-1"><div className="min-w-0"><p className="truncate text-sm font-semibold text-text">{attempt.assessmentTitle}</p><p className="mt-1 text-xs text-text/45">Attempt {attempt.attemptNumber} · {new Date(attempt.submittedAt).toLocaleDateString()} · {Math.floor(attempt.timeTakenSeconds / 60)}m {attempt.timeTakenSeconds % 60}s</p>{attempt.certificateEligible && <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#28756f]"><AwardIcon className="h-3.5 w-3.5" />{attempt.passed ? "Certificate unlocked" : "Certificate eligible"}</p>}</div><div className="flex items-center gap-3"><strong className="font-display text-xl text-text">{attempt.percentage}%</strong><StatusBadge status={attempt.passed ? "success" : "warning"}>{attempt.passed ? "Passed" : "Retake"}</StatusBadge></div></Link>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-text/15 bg-[#fcfbfa] px-5 py-10 text-center"><p className="font-semibold text-text">No results to show yet</p><p className="mt-1 text-sm text-text/50">Complete a test series or course quiz to start building your history.</p><Link to="/student/assessments/test-series" className="mt-4 inline-block text-sm font-semibold text-primary">Explore Test Series →</Link></div>}</section>
      <div className="space-y-5"><section className="rounded-2xl border border-text/10 bg-white p-5"><div className="flex items-center gap-2"><TargetIcon className="h-5 w-5 text-[#71549a]" /><h2 className="font-display text-lg font-bold text-text">Performance by Skill</h2></div>{skillRows.length ? <div className="mt-4 space-y-4">{skillRows.map(([skill, score]) => <div key={skill}><div className="flex justify-between gap-2 text-xs"><span className="font-medium text-text/65">{skill}</span><strong className="text-text">{score}%</strong></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-text/10"><div className="h-full rounded-full bg-[#71549a]" style={{ width: score + "%" }} /></div></div>)}</div> : <p className="mt-3 text-sm leading-5 text-text/50">Skill scores appear here after your first assessment.</p>}</section>
        <section className="rounded-2xl bg-[#e7f1ef] p-5"><div className="flex items-center gap-2"><TrendingUpIcon className="h-5 w-5 text-[#28756f]" /><h2 className="font-display text-lg font-bold text-text">Recent Improvement</h2></div>{improvements.length ? <div className="mt-3 space-y-3">{improvements.slice(0, 3).map((item) => <div key={item.title} className="flex items-center justify-between gap-3 rounded-xl bg-white/75 p-3"><span className="min-w-0 truncate text-xs font-semibold text-text/65">{item.title}</span><strong className={item.latest > item.first ? "shrink-0 text-sm text-[#28756f]" : "shrink-0 text-sm text-primary"}>{item.first}% → {item.latest}%</strong></div>)}</div> : <p className="mt-3 text-sm leading-5 text-text/55">Repeat a test after practice to see how your score changes over time.</p>}<p className="mt-4 flex items-center gap-2 text-xs text-[#28756f]"><CheckCircleIcon className="h-4 w-4" />Use results to choose your next lesson.</p></section>
      </div>
    </div>
  </div>;
}
