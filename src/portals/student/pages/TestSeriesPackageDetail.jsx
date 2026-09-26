import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../../../components/ui/Button";
import { AlertTriangleIcon, CheckCircleIcon, CheckIcon, ChevronDownIcon, ClockIcon, FileTextIcon, LockIcon, StarIcon } from "../../../components/ui/icons";
import { useAuth } from "../../../hooks/useAuth";
import { getSeriesById, isSeriesPurchased, purchaseSeries } from "../data/testSeriesCatalog";

function InfoTile({ label, value }) {
  return (
    <div className="rounded-xl border border-text/10 bg-white p-4">
      <strong className="block text-sm font-bold text-text">{value}</strong>
      <span className="mt-1 block text-[11px] text-text/45">{label}</span>
    </div>
  );
}

function TestRow({ test, purchased, onLockedClick }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-text">{test.title}</p>
        <p className="mt-0.5 text-xs text-text/50">{test.questions} questions · {test.durationMinutes} minutes</p>
      </div>
      {test.comingSoon ? (
        <span className="shrink-0 rounded-full bg-[#f6f0dc] px-3 py-1.5 text-[11px] font-semibold text-[#8a6a2a]">Coming Soon</span>
      ) : purchased ? (
        <Link to={`/student/assessments/test-series/${test.assessmentId}`} className="shrink-0 rounded-full border border-primary/20 px-3 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary hover:text-white">View Test →</Link>
      ) : (
        <button type="button" onClick={onLockedClick} className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-bg px-3 py-1.5 text-[11px] font-semibold text-text/50">
          <LockIcon className="h-3 w-3" />Locked
        </button>
      )}
    </div>
  );
}

function ContentSection({ section, open, onToggle, purchased, onLockedClick }) {
  return (
    <div className="border-b border-text/10 last:border-0">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-4 py-4 text-left">
        <span className="font-display text-base font-bold text-text">{section.title}</span>
        <span className="flex items-center gap-2 text-xs text-text/45">
          {section.tests.length} test{section.tests.length === 1 ? "" : "s"}
          <ChevronDownIcon className={`transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && <div className="divide-y divide-text/10 pb-3">{section.tests.map((test) => <TestRow key={test.id} test={test} purchased={purchased} onLockedClick={onLockedClick} />)}</div>}
    </div>
  );
}

export default function TestSeriesPackageDetail() {
  const { seriesId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const pkg = getSeriesById(seriesId);
  const [openSections, setOpenSections] = useState(() => new Set(pkg ? [pkg.sections[0]?.id] : []));
  const [purchased, setPurchased] = useState(() => (pkg ? isSeriesPurchased(pkg.id, user) : false));
  const [justPurchased, setJustPurchased] = useState(false);

  if (!pkg) {
    return (
      <div className="px-5 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-text">Test series not found</h1>
        <Button fullWidth={false} className="mt-4" onClick={() => navigate("/student/test-series")}>Back to Test Series</Button>
      </div>
    );
  }

  function toggleSection(id) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleBuy() {
    // Mock purchase — no payment gateway wired up in this phase (see
    // testSeriesCatalog.js). Marks the series purchased locally so
    // "My Test Series" states can build on real purchased-ids data next.
    purchaseSeries(pkg.id, user);
    setPurchased(true);
    setJustPurchased(true);
  }

  const negativeMarking = pkg.negativeMarking;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      <Link to="/student/test-series" className="text-sm font-semibold text-primary">← Back to Test Series</Link>

      <div className="mt-5 overflow-hidden rounded-3xl bg-[#4a0e0e] p-6 text-white shadow-sm sm:p-9">
        <div className="flex flex-wrap items-center gap-2">
          {pkg.badges.map((badge) => <span key={badge} className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold tracking-wider">{badge}</span>)}
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#f0c2b2]">{pkg.classGrade} · {pkg.subject}</p>
        <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl">{pkg.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">{pkg.description}</p>
        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-white/80">
          <span className="inline-flex items-center gap-1"><StarIcon className="h-4 w-4 fill-current text-[#f0c2b2]" />{pkg.rating.toFixed(1)}</span>
          <span>{pkg.studentsEnrolled.toLocaleString()} students enrolled</span>
          <span>{pkg.numberOfTests} tests</span>
        </div>
        <div className="mt-7 flex flex-wrap items-center gap-4">
          {purchased ? (
            <Button fullWidth={false} variant="inverse" disabled>Enrolled ✓</Button>
          ) : (
            <Button fullWidth={false} onClick={handleBuy}>{pkg.price === 0 ? "Enroll for Free" : `Buy Test Series — ₹${pkg.price}`}</Button>
          )}
          {!purchased && pkg.price > 0 && <span className="font-display text-xl font-bold">₹{pkg.price}</span>}
        </div>
        {justPurchased && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-white/10 p-4 text-sm">
            <CheckCircleIcon className="h-5 w-5 shrink-0 text-[#f0c2b2]" />
            <span>Test series added to My Test Series.</span>
            <button type="button" onClick={() => navigate("/student/my-learning#my-test-series")} className="ml-auto rounded-full bg-white px-4 py-2 text-xs font-semibold text-primary">Go to My Test Series</button>
          </div>
        )}
      </div>

      {pkg.comingSoonNotice && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#f0dcc2] bg-[#fbefe7] p-4 text-sm leading-6 text-text/65">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>{pkg.comingSoonNotice}</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <InfoTile label="Number of Tests" value={pkg.numberOfTests} />
        <InfoTile label="Total Questions" value={`${pkg.totalQuestions}+`} />
        <InfoTile label="Question Types" value={pkg.questionTypes.join(" + ")} />
        <InfoTile label="Languages" value={pkg.language} />
        <InfoTile label="Test Duration" value={pkg.durationRangeLabel} />
        <InfoTile label="Passing Score" value={pkg.passingScoreLabel} />
        <InfoTile label="Attempts" value={pkg.attemptsLabel} />
        <InfoTile label="Access" value={pkg.accessLabel} />
        <InfoTile label="Certificate" value={pkg.certificateLabel} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-text/10 bg-white p-5 sm:p-6">
            <h2 className="font-display text-xl font-bold text-text">About this test series</h2>
            <p className="mt-3 text-sm leading-6 text-text/65">{pkg.description}</p>
            <p className="mt-3 text-sm leading-6 text-text/65"><strong className="text-text">Who it's for: </strong>{pkg.audience}</p>
          </section>

          <section className="rounded-2xl border border-text/10 bg-white p-5 sm:p-6">
            <h2 className="font-display text-xl font-bold text-text">Test series content</h2>
            <div className="mt-2">
              {pkg.sections.map((section) => (
                <ContentSection key={section.id} section={section} open={openSections.has(section.id)} onToggle={() => toggleSection(section.id)} purchased={purchased} onLockedClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-text/10 bg-white p-5 sm:p-6">
            <h2 className="font-display text-xl font-bold text-text">Topics covered</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {pkg.topics.map((topic) => (
                <div key={topic.topic} className="flex items-center justify-between gap-2 text-sm text-text/65">
                  <span className="inline-flex min-w-0 items-center gap-2"><CheckIcon className="h-4 w-4 shrink-0 text-[#28756f]" /><span className="truncate">{topic.topic}</span></span>
                  <span className="shrink-0 text-xs text-text/40">{topic.tests} test{topic.tests === 1 ? "" : "s"} · {topic.questions}+ Q</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-text/10 bg-white p-5 sm:p-6">
            <h2 className="font-display text-xl font-bold text-text">Negative marking</h2>
            {negativeMarking.enabled ? (
              <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
                <div className="rounded-xl bg-[#e7f1ef] p-3"><strong className="block text-[#236963]">+{negativeMarking.correct}</strong><span className="text-xs text-text/50">Correct answer</span></div>
                <div className="rounded-xl bg-[#fbefe7] p-3"><strong className="block text-primary">−{negativeMarking.incorrect}</strong><span className="text-xs text-text/50">Incorrect answer</span></div>
                <div className="rounded-xl bg-bg p-3"><strong className="block text-text">{negativeMarking.unanswered}</strong><span className="text-xs text-text/50">Unanswered</span></div>
              </div>
            ) : (
              <p className="mt-3 text-sm font-semibold text-[#28756f]">No negative marking on this test series.</p>
            )}
            {pkg.questionTypes.some((type) => type.toLowerCase().includes("subjective") || type.toLowerCase().includes("descriptive")) && (
              <p className="mt-3 text-xs text-text/50">Subjective answers may require manual evaluation.</p>
            )}
          </section>
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border border-text/10 bg-[#fffaf7] p-5 lg:sticky lg:top-24">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary/70">Quick facts</p>
          <div className="space-y-2 text-sm text-text/65">
            <p className="flex items-center gap-2"><FileTextIcon className="h-4 w-4 text-text/40" />{pkg.numberOfTests} tests · {pkg.totalQuestions}+ questions</p>
            <p className="flex items-center gap-2"><ClockIcon className="h-4 w-4 text-text/40" />{pkg.durationRangeLabel} per test</p>
            <p className="flex items-center gap-2"><StarIcon className="h-4 w-4 text-text/40" />{pkg.difficulty} difficulty</p>
          </div>
          {purchased ? (
            <Button fullWidth onClick={() => navigate("/student/my-learning#my-test-series")}>Go to My Test Series</Button>
          ) : (
            <Button fullWidth onClick={handleBuy}>{pkg.price === 0 ? "Enroll for Free" : `Buy Test Series — ₹${pkg.price}`}</Button>
          )}
        </aside>
      </div>
    </div>
  );
}
