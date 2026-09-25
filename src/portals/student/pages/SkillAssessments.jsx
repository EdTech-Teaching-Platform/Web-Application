import { Link, useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import { ArrowLeftIcon, CheckCircleIcon, ClockIcon, TargetIcon, TrendingUpIcon } from "../../../components/ui/icons";
import { SKILL_ASSESSMENTS, getSavedAttempts } from "../data/assessmentCatalog";

function levelFrom(score) {
  if (score >= 85) return "Advanced";
  if (score >= 65) return "Intermediate";
  return "Developing";
}

export default function SkillAssessments() {
  const navigate = useNavigate();
  const attempts = getSavedAttempts();
  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
    <Link to="/student/assessments" className="text-xs font-semibold text-primary">← Assessments</Link>
    <header className="mt-4 rounded-3xl bg-[#eeeaf6] p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#71549a]">Know your current level</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">Skill Assessments</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-text/60">Short diagnostics identify what you already know and which skills to strengthen next. They’re designed to guide your learning, not rank you.</p></div><TargetIcon className="h-10 w-10 text-[#71549a]" /></div></header>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{SKILL_ASSESSMENTS.map((assessment) => {
      const previous = attempts.filter((item) => item.assessmentId === assessment.id && item.source === "skill");
      const latest = previous[0];
      const level = latest ? levelFrom(latest.percentage) : null;
      const weakTopic = latest?.topicBreakdown?.slice().sort((a, b) => a.percentage - b.percentage)[0]?.topic;
      return <article key={assessment.id} className="flex min-h-[280px] flex-col rounded-2xl border border-text/10 bg-white p-5 shadow-[0_4px_18px_rgba(23,50,77,0.04)]"><div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eeeaf6] text-[#71549a]"><TargetIcon className="h-5 w-5" /></span><span className="rounded-full bg-bg px-3 py-1 text-[10px] font-semibold text-text/50">{assessment.category}</span></div><h2 className="mt-4 font-display text-lg font-bold text-text">{assessment.subject} Skill Assessment</h2><p className="mt-2 flex-1 text-sm leading-5 text-text/55">{assessment.description}</p><div className="mt-4 flex flex-wrap items-center gap-4 border-t border-text/10 pt-3 text-xs text-text/50"><span>{assessment.questions.length} questions</span><span className="inline-flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" />~{assessment.durationMinutes} min</span></div>{latest && <div className="mt-3 rounded-xl bg-[#fcfbfa] p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs text-text/55">Your current level</span><StatusBadge status={latest.percentage >= assessment.passingScore ? "success" : "warning"}>{level}</StatusBadge></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-text/10"><div className="h-full rounded-full bg-[#71549a]" style={{ width: latest.percentage + "%" }} /></div><p className="mt-2 text-[11px] text-text/45">{weakTopic ? "Next focus: " + weakTopic : "Latest result: " + latest.percentage + "%"}</p></div>}<Button className="mt-4" onClick={() => navigate("/student/assessments/attempt/" + assessment.id + "?source=skill")}>{latest ? "Reassess My Skill" : "Assess My Skill"}</Button></article>;
    })}</div>
    <section className="mt-7 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-text/10 bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.15em] text-primary/70">A useful next step</p><h2 className="mt-2 font-display text-lg font-bold text-text">Turn a result into a learning plan</h2><p className="mt-2 text-sm leading-6 text-text/55">Each skill result highlights stronger areas and topics to revisit, then links back to relevant learning.</p><Link to="/student/my-learning" className="mt-4 inline-block text-sm font-semibold text-primary">Explore My Learning →</Link></div><div className="flex gap-3 rounded-2xl bg-[#e7f1ef] p-5"><TrendingUpIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#28756f]" /><div><h2 className="font-display font-bold text-text">Skill levels are a guide</h2><p className="mt-1 text-sm leading-5 text-text/55">Reassess after practice to see progress. These short skill checks do not award certificates.</p><div className="mt-3 flex gap-2 text-[11px] font-semibold text-[#28756f]"><CheckCircleIcon className="h-4 w-4" />Private to your learning profile</div></div></div></section>
  </div>;
}
