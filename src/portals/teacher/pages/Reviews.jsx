// Reviews (read) — portfolio-wide
// Jira: Day 8 — Reviews (read) + availability calendar
// Doc reference: Sec 5.4
//
// Standalone read surface aggregating feedback across every course this
// educator has published. Reached from the Average Rating stat card on the
// Dashboard (see pages/Dashboard.jsx) — previously a tab shared with the
// Availability calendar; split out onto its own screen per request.
import PortfolioReviewsSection from "../components/PortfolioReviewsSection";

export default function Reviews() {
  return (
    <div className="pb-16">
      <div className="mb-1">
        <div className="eyebrow mb-1.5">Feedback</div>
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Reviews</h1>
        <p className="mt-1 text-sm text-muted">See how students are rating your courses.</p>
      </div>

      <div className="mt-6">
        <PortfolioReviewsSection />
      </div>
    </div>
  );
}
