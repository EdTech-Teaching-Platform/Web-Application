// Public "All Instructors" page — the real destination for Landing's
// "View all instructors" link (Section 5.3, Discovery — Educator Search &
// Public Profile: "Browse/search educators; view bio, qualifications,
// subjects, ratings, courses, and live sessions"). Previously that link
// just sent visitors to /explore, which lists courses, not educators —
// this page is the actual educator-search screen the doc describes.
//
// Public route (see src/public/routes.jsx) — no login required to browse,
// per Section 4.3 ("visitors can browse but must register to enroll or
// book"). Reuses ColorBlockCard (never a separate InstructorCard) and the
// same EDUCATORS mock data every other educator-facing screen reads from.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ColorBlockCard from "../../components/ui/ColorBlockCard";
import { SearchIcon } from "../../components/ui/icons";
import { EDUCATORS, getCoursesByEducator } from "../../data/catalogMock";
import { imageForPerson } from "../../utils/stockImages";

const SUBJECT_FILTERS = ["All", ...new Set(EDUCATORS.flatMap((e) => e.subjects))];

export default function InstructorsPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeSubject, setActiveSubject] = useState("All");

  const instructors = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EDUCATORS.filter((educator) => {
      const haystack = `${educator.name} ${educator.headline} ${educator.subjects.join(" ")}`.toLowerCase();
      return (
        haystack.includes(q) &&
        (activeSubject === "All" || educator.subjects.includes(activeSubject))
      );
    });
  }, [query, activeSubject]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Discovery</div>
      <h1 className="font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
        Learn from verified educators.
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-text/60">
        Browse every educator teaching on Universal Learning — check their qualifications, subjects, ratings, and
        courses before you enroll or book a session.
      </p>

      <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 sm:w-full sm:max-w-xl">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text/35" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search educators by name or subject..."
            className="w-full rounded-2xl border border-text/10 bg-white py-3.5 pl-12 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <select
          value={activeSubject}
          onChange={(event) => setActiveSubject(event.target.value)}
          aria-label="Filter educators by subject"
          className="rounded-2xl border border-text/10 bg-white px-4 py-3.5 text-sm text-text/70 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 sm:ml-auto sm:w-52"
        >
          {SUBJECT_FILTERS.map((subject) => <option key={subject} value={subject}>{subject === "All" ? "All subjects" : subject}</option>)}
        </select>
      </div>

      <p className="mt-6 text-sm text-text/60">
        <strong className="text-text">{instructors.length}</strong> educator{instructors.length === 1 ? "" : "s"}
      </p>

      {instructors.length ? (
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {instructors.map((educator, i) => {
            const courseCount = getCoursesByEducator(educator.id).length;
            return (
              <ColorBlockCard
                key={educator.id}
                rotationIndex={i}
                image={imageForPerson(educator.name)}
                badge={educator.rating >= 4.7 ? "Top Rated Instructor" : "Verified Educator"}
                title={educator.name}
                subtitle={educator.headline}
                description={`${educator.subjects.slice(0, 2).join(", ")} · ${courseCount} course${courseCount === 1 ? "" : "s"} · ${educator.city}`}
                rating={educator.rating}
                reviewCount={educator.reviewCount}
                actionLabel="View Profile"
                className="w-full"
                onClick={() => navigate(`/educator?educator=${educator.id}`)}
                onAction={() => navigate(`/educator?educator=${educator.id}`)}
              />
            );
          })}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-text/15 bg-white px-6 py-16 text-center">
          <h2 className="font-display text-lg font-semibold text-text">No educators match this search</h2>
          <p className="mt-2 text-sm text-text/55">Try a different name or subject.</p>
        </div>
      )}
    </div>
  );
}
