import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import { AlertTriangleIcon, CheckCircleIcon, ClockIcon, FileTextIcon, SearchIcon, StarIcon, TargetIcon } from "../../../components/ui/icons";
import { ATTEMPT_STORAGE_KEY, ASSESSMENT_CATEGORIES, DIFFICULTIES, DURATION_FILTERS, QUESTION_TYPES, SORT_OPTIONS, TEST_SERIES, TEST_TYPES, getSavedAttempts } from "../data/assessmentCatalog";

function durationMatches(minutes, filter) {
  if (filter === "Under 15 min") return minutes < 15;
  if (filter === "15–30 min") return minutes >= 15 && minutes <= 30;
  if (filter === "30–60 min") return minutes > 30 && minutes <= 60;
  if (filter === "60+ min") return minutes > 60;
  return true;
}

// Marks-per-question is presentational/mock — there's no backend field for
// per-question weighting yet, so every test is scored out of a flat total
// that's split evenly across its questions.
const MARKS_PER_QUESTION = 4;

// Highlights subject/category/difficulty/badge keywords inside a test
// card's description so scannable terms stand out. Purely presentational —
// matches against fields already on the assessment record, nothing fetched.
function highlightKeywords(text, keywords) {
  const terms = Array.from(new Set(keywords.filter(Boolean))).sort((a, b) => b.length - a.length);
  if (!terms.length) return text;
  const pattern = new RegExp("(" + terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi");
  const parts = text.split(pattern);
  return parts.map((part, index) =>
    terms.some((term) => term.toLowerCase() === part.toLowerCase())
      ? <mark key={index} className="rounded bg-[#f8e8df] px-1 py-0.5 font-semibold text-primary">{part}</mark>
      : <span key={index}>{part}</span>
  );
}

function SeriesCard({ assessment }) {
  const attempts = getSavedAttempts().filter((attempt) => attempt.assessmentId === assessment.id);
  return <article className="flex h-full flex-col rounded-2xl border border-text/10 bg-white p-5 shadow-[0_4px_18px_rgba(23,50,77,0.04)] transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-[#f8e8df] px-2.5 py-1 text-[10px] font-bold text-primary">{assessment.category}</span>{assessment.badge && <span className="rounded-full bg-[#f6f0dc] px-2.5 py-1 text-[9px] font-bold tracking-wider text-[#8a6a2a]">{assessment.badge}</span>}</div>
    <p className="mt-3 text-[11px] font-medium text-text/45">{assessment.type} · {assessment.difficulty}</p>
    <h2 className="mt-1 font-display text-lg font-bold leading-snug text-text">{assessment.title}</h2>
    <p className="mt-2 line-clamp-2 text-sm leading-5 text-text/55">{highlightKeywords(assessment.description, [assessment.category, assessment.difficulty, assessment.subject, assessment.badge, ...assessment.skills])}</p>
    <div className="mt-4 grid grid-cols-2 gap-2 border-y border-text/10 py-3 text-xs text-text/55"><span className="inline-flex items-center gap-1.5"><FileTextIcon className="h-3.5 w-3.5" />{assessment.questions.length} questions</span><span className="inline-flex items-center gap-1.5"><ClockIcon className="h-3.5 w-3.5" />{assessment.durationMinutes} min</span><span>Pass: {assessment.passingScore}%</span><span className="inline-flex items-center gap-1"><StarIcon className="h-3.5 w-3.5 fill-current text-[#b88825]" />{assessment.rating.toFixed(1)}</span></div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text/45"><span>{assessment.attempts.toLocaleString()} attempts</span><span>{attempts.length ? attempts.length + " personal attempt" + (attempts.length === 1 ? "" : "s") : (assessment.attemptsAllowed === "Unlimited" ? "Unlimited attempts" : assessment.attemptsAllowed + " attempts")}</span></div>
    <Link to={"/student/assessments/test-series/" + assessment.id} className="mt-auto pt-5"><span className="flex w-full items-center justify-center rounded-full border border-primary/20 px-4 py-2.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white">Join <span className="ml-1" aria-hidden="true">→</span></span></Link>
  </article>;
}

export default function TestSeries() {
  const navigate = useNavigate();
  const { assessmentId } = useParams();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [type, setType] = useState("");
  const [duration, setDuration] = useState("");
  const [questionType, setQuestionType] = useState("");
  const [sort, setSort] = useState("Popular");
  const assessment = TEST_SERIES.find((item) => item.id === assessmentId);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const result = TEST_SERIES.filter((item) =>
      (!text || (item.title + " " + item.subject + " " + item.skills.join(" ")).toLowerCase().includes(text)) &&
      (!category || item.category === category) && (!difficulty || item.difficulty === difficulty) &&
      (!type || item.type === type) && (!duration || durationMatches(item.durationMinutes, duration)) &&
      (!questionType || item.questionType === questionType)
    );
    return result.sort((a, b) => {
      if (sort === "Newest") return b.id.localeCompare(a.id);
      if (sort === "Highest Rated") return b.rating - a.rating;
      if (sort === "Shortest") return a.durationMinutes - b.durationMinutes;
      if (sort === "Most Attempted") return b.attempts - a.attempts;
      return b.attempts * b.rating - a.attempts * a.rating;
    });
  }, [category, difficulty, duration, query, questionType, sort, type]);

  if (assessmentId) {
    if (!assessment) return <div className="px-5 py-16 text-center"><h1 className="font-display text-2xl font-bold text-text">Assessment not found</h1><Button fullWidth={false} className="mt-4" onClick={() => navigate("/student/assessments/test-series")}>Back to Test Series</Button></div>;
    const history = getSavedAttempts().filter((attempt) => attempt.assessmentId === assessment.id);
    const topics = assessment.topics || [];
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem("ul_assessment_wishlist") || "[]"); } catch { saved = []; }
    const wishlisted = saved.includes(assessment.id);
    function toggleWishlist() {
      const next = wishlisted ? saved.filter((id) => id !== assessment.id) : [...saved, assessment.id];
      try { localStorage.setItem("ul_assessment_wishlist", JSON.stringify(next)); } catch { /* optional preference */ }
      navigate(0);
    }
    return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10">
      <Link to="/student/assessments/test-series" className="text-sm font-semibold text-primary">← Back to Test Series</Link>
      <div className="mt-5 overflow-hidden rounded-3xl bg-[#4a0e0e] p-6 text-white shadow-sm sm:p-9"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold tracking-wider">{assessment.type}</span><span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold">{assessment.difficulty}</span>{assessment.badge && <span className="rounded-full bg-[#f0c2b2] px-3 py-1 text-[10px] font-bold text-primary">{assessment.badge}</span>}</div><p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#f0c2b2]">{assessment.subject}</p><h1 className="mt-2 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl">{assessment.title}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">{assessment.description}</p><div className="mt-7 flex flex-wrap gap-3"><Button fullWidth={false} onClick={() => navigate("/student/assessments/take/" + assessment.id)}>Start Test</Button><Button fullWidth={false} variant="inverse" onClick={toggleWishlist}>{wishlisted ? "Saved to Wishlist ✓" : "Add to Wishlist"}</Button></div></div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{[[assessment.questions.length, "Questions"], [assessment.durationMinutes + " min", "Duration"], [assessment.passingScore + "%", "Passing score"], [assessment.attemptsAllowed, "Attempts"], [assessment.difficulty, "Difficulty"], [MARKS_PER_QUESTION + " marks", "Per question"]].map(([value, label]) => <div key={label} className="rounded-xl border border-text/10 bg-white p-4"><strong className="block text-sm font-bold text-text">{value}</strong><span className="mt-1 block text-[11px] text-text/45">{label}</span></div>)}</div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_300px]"><div className="space-y-5"><section className="rounded-2xl border border-text/10 bg-white p-5 sm:p-6"><h2 className="font-display text-xl font-bold text-text">What you’ll be tested on</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{topics.map((topic) => <p key={topic} className="flex items-center gap-2 text-sm text-text/65"><CheckCircleIcon className="h-4 w-4 text-[#28756f]" />{topic}</p>)}</div></section><section className="rounded-2xl border border-text/10 bg-white p-5 sm:p-6"><h2 className="font-display text-xl font-bold text-text">Skills assessed</h2><div className="mt-3 flex flex-wrap gap-2">{assessment.skills.map((skill) => <span key={skill} className="rounded-full bg-[#e7f1ef] px-3 py-1.5 text-xs font-semibold text-[#28756f]">{skill}</span>)}</div></section><section className="rounded-2xl border border-text/10 bg-white p-5 sm:p-6"><h2 className="font-display text-xl font-bold text-text">Before you begin</h2><ul className="mt-3 space-y-2 text-sm leading-6 text-text/60"><li>• Each question carries {MARKS_PER_QUESTION} marks, for {assessment.questions.length * MARKS_PER_QUESTION} marks total.</li><li>• Read each question carefully and choose the best answer.</li><li>• You can move between questions and mark items to revisit.</li><li>• Unanswered questions are included in your result as skipped.</li><li>• Your answers are saved automatically during the attempt.</li><li>• Submit before the timer expires; time remaining is shown throughout.</li></ul><div className="mt-4 rounded-xl bg-[#fbefe7] p-4"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary"><AlertTriangleIcon className="h-4 w-4" />Test integrity</p><ul className="mt-2 space-y-1.5 text-sm leading-6 text-text/65"><li>• Do not switch tabs or refresh the page during the test.</li><li>• No external help, notes or collaboration is allowed.</li><li>• Stay on this screen until you submit — leaving may cost you time.</li></ul></div></section></div><aside className="h-fit rounded-2xl border border-text/10 bg-[#fffaf7] p-5 lg:sticky lg:top-24"><p className="text-xs font-bold uppercase tracking-[0.15em] text-primary/70">Recent attempts</p><h2 className="mt-1 font-display text-lg font-bold text-text">Your history</h2>{history.length ? <div className="mt-3 space-y-3">{history.slice(0, 4).map((attempt) => <div key={attempt.id} className="flex items-center justify-between gap-2 text-xs"><span className="text-text/55">Attempt {attempt.attemptNumber} · {new Date(attempt.submittedAt).toLocaleDateString()}</span><strong className="text-text">{attempt.percentage}%</strong></div>)}</div> : <p className="mt-2 text-sm text-text/50">No previous attempts.</p>}<Link to={"/student/assessments/take/" + assessment.id} className="mt-5 block"><span className="flex w-full justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white">Start Test</span></Link></aside></div>
    </div>;
  }

  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><Link to="/student/assessments/test-series" className="text-xs font-semibold text-primary">Test Series</Link><p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-primary/70">Structured tests & mock exams</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">Test Series</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-text/55">Build confidence with focused practice, timed mock exams and course-level assessments.</p></div><div className="flex flex-col items-end gap-2"><div className="rounded-2xl bg-[#e7f1ef] px-4 py-3 text-xs font-semibold text-[#28756f]">{TEST_SERIES.length} curated assessments · results saved to My Results</div><Link to="/student/assessments/my-results" className="rounded-full border border-primary/20 bg-white px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/5">View My Results →</Link></div></div>
    <div className="mt-6 grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="h-fit rounded-2xl border border-text/10 bg-white p-4 lg:sticky lg:top-20"><div className="flex items-center justify-between border-b border-text/10 pb-3"><h2 className="font-display font-bold text-text">Filters</h2><button type="button" onClick={() => { setCategory(""); setDifficulty(""); setType(""); setDuration(""); setQuestionType(""); setQuery(""); }} className="text-xs font-semibold text-primary">Clear all</button></div>
        {[["Category", "categories", ASSESSMENT_CATEGORIES, category, setCategory], ["Difficulty", "difficulties", DIFFICULTIES, difficulty, setDifficulty], ["Test type", "test types", TEST_TYPES, type, setType], ["Duration", "durations", DURATION_FILTERS, duration, setDuration], ["Question type", "question types", QUESTION_TYPES, questionType, setQuestionType]].map(([label, plural, options, value, setter]) => <label key={label} className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold text-text/65">{label}</span><select value={value} onChange={(event) => setter(event.target.value)} className="w-full rounded-lg border border-text/10 bg-white px-3 py-2.5 text-xs text-text outline-none focus:border-primary"><option value="">All {plural}</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>)}
      </aside>
      <section className="min-w-0"><div className="flex flex-col gap-3 sm:flex-row"><label className="relative min-w-0 flex-1"><SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text/35" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tests, subjects or skills..." className="w-full rounded-xl border border-text/10 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-primary" /></label><label className="flex items-center gap-2 rounded-xl border border-text/10 bg-white px-3 text-xs text-text/55">Sort by<select value={sort} onChange={(event) => setSort(event.target.value)} className="bg-transparent py-3 font-semibold text-text outline-none">{SORT_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label></div>
        <div className="mt-4 flex items-center justify-between text-xs text-text/45"><span>{filtered.length} assessments</span><span className="hidden items-center gap-1 sm:inline-flex"><StarIcon className="h-3.5 w-3.5 fill-current text-[#b88825]" />Original practice content</span></div>
        {filtered.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((item) => <SeriesCard key={item.id} assessment={item} />)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-text/15 bg-white px-6 py-14 text-center"><h2 className="font-display text-lg font-bold text-text">No tests match these filters</h2><p className="mt-2 text-sm text-text/50">Try a broader search or clear your filters.</p></div>}
      </section>
    </div>
  </div>;
}
