// Test Series Tracker — overall view of test series creation, educator
// assignment progress, submission/review status, and (5.1) Repeated
// Questions Detection, all on one page. Reuses testSeriesMock.js and
// testAssignmentsMock.js directly — no separate dataset is kept here.
//
// Reuses existing Admin primitives: .ul-edu-header / .ul-edu-toolbar /
// .ul-edu-table / .ul-edu-pagination (EducatorVerification.css),
// .ul-card / .ul-status-badge / .ul-progress-* (AdminDashboard.css),
// .ul-confirm-modal / .ul-mgmt-detail-* (ConfirmModal.css /
// ManagementDashboards.css), .ul-stat-card (AdminDashboard.css).

import { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTestSeriesList, SERIES_STATUS, SUBJECT_OPTIONS } from "../data/testSeriesMock";
import {
  useAssignments,
  computeTrackerStats,
  groupAssignmentsBySeries,
  getDisplayStatus,
  getAssignmentProgress,
  ASSIGNMENT_STATUS_LABEL,
} from "../data/testAssignmentsMock";
import {
  computeRepeatedQuestionMatches,
  withReviewStatus,
  useMatchReviewState,
  markMatchReviewed,
  dismissMatch,
  flagMatchConfirmed,
  MATCH_TYPE,
  MATCH_TYPE_LABEL,
  MATCH_TYPE_BADGE_CLASS,
  MATCH_REVIEW_STATUS,
  MATCH_REVIEW_STATUS_LABEL,
  MATCH_REVIEW_STATUS_BADGE_CLASS,
} from "../data/questionSimilarityMock";
import { IconSearch, IconClose, IconChevronDown, IconLayers, IconWallet, IconHistory, IconCheck, IconAlert } from "../components/icons";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "../components/ConfirmModal.css";
import "./ManagementDashboards.css";
import "./TestSeriesTracker.css";

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function truncate(text, n = 90) {
  const t = String(text || "");
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

const OVERALL_STATUS_BADGE = {
  "On Track": "is-approved",
  "Complete": "is-approved",
  "Needs Revision": "is-rejected",
  "Overdue": "is-rejected",
  "No Assignments Yet": "is-pending",
};

export default function TestSeriesTracker() {
  const navigate = useNavigate();
  const seriesList = useTestSeriesList();
  const assignments = useAssignments();

  const trackerStats = useMemo(() => computeTrackerStats(assignments), [assignments]);
  const totalSeries = seriesList.length;
  const activeSeries = seriesList.filter((s) => s.status === SERIES_STATUS.PUBLISHED).length;

  const grouped = useMemo(() => {
    const g = groupAssignmentsBySeries(assignments);
    const covered = new Set(g.map((x) => x.seriesId).filter(Boolean));
    const zeros = seriesList
      .filter((s) => !covered.has(s.id))
      .map((s) => ({
        seriesId: s.id,
        seriesName: s.name,
        subject: s.subject,
        educators: [],
        totalTestsRequired: 0,
        testsCreated: 0,
        testsSubmitted: 0,
        testsApproved: 0,
        completionPct: 0,
        deadline: null,
        overallStatus: "No Assignments Yet",
        assignments: [],
      }));
    return [...g, ...zeros];
  }, [assignments, seriesList]);

  // ---- tracker table: search / filters / sort / pagination ----
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterRef = useRef(null);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [educatorFilter, setEducatorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("deadline_asc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!filtersOpen) return undefined;
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFiltersOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [filtersOpen]);

  const educatorOptions = useMemo(
    () => ["all", ...Array.from(new Set(grouped.flatMap((g) => g.educators))).sort()],
    [grouped]
  );
  const activeFilterCount = [subjectFilter !== "all", educatorFilter !== "all", statusFilter !== "all"].filter(Boolean).length;
  const clearFilters = () => {
    setSubjectFilter("all");
    setEducatorFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = grouped.filter((g) => {
      if (q && !`${g.seriesName} ${g.subject}`.toLowerCase().includes(q)) return false;
      if (subjectFilter !== "all" && g.subject !== subjectFilter) return false;
      if (educatorFilter !== "all" && !g.educators.includes(educatorFilter)) return false;
      if (statusFilter !== "all" && g.overallStatus !== statusFilter) return false;
      return true;
    });
    r = [...r];
    if (sortBy === "deadline_asc") r.sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"));
    else if (sortBy === "completion_desc") r.sort((a, b) => b.completionPct - a.completionPct);
    else if (sortBy === "name_asc") r.sort((a, b) => a.seriesName.localeCompare(b.seriesName));
    return r;
  }, [grouped, search, subjectFilter, educatorFilter, statusFilter, sortBy]);

  const PAGE_SIZE = 8;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const [detailSeriesId, setDetailSeriesId] = useState(null);
  const detailGroup = grouped.find((g) => (g.seriesId || g.seriesName) === detailSeriesId) || null;

  // ---------- Repeated Questions Detection (5.1) ----------
  const reviewState = useMatchReviewState();
  const rawMatches = useMemo(() => computeRepeatedQuestionMatches(seriesList), [seriesList]);
  const matches = useMemo(() => withReviewStatus(rawMatches, reviewState), [rawMatches, reviewState]);

  const testEducatorMap = useMemo(() => {
    const map = new Map();
    assignments.forEach((a) => {
      if (a.seriesId && a.testName) map.set(`${a.seriesId}::${a.testName}`, a.educatorName);
    });
    return map;
  }, [assignments]);
  const lookupEducator = (q) => testEducatorMap.get(`${q.seriesId}::${q.testName}`) || "—";

  const [matchTypeFilter, setMatchTypeFilter] = useState("all");
  const [matchSubjectFilter, setMatchSubjectFilter] = useState("all");
  const [matchSeriesFilter, setMatchSeriesFilter] = useState("all");
  const [matchReviewFilter, setMatchReviewFilter] = useState("all");

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (matchTypeFilter !== "all" && m.matchType !== matchTypeFilter) return false;
      if (matchSubjectFilter !== "all" && m.original.subject !== matchSubjectFilter && m.matching.subject !== matchSubjectFilter) return false;
      if (matchSeriesFilter !== "all" && m.original.seriesId !== matchSeriesFilter && m.matching.seriesId !== matchSeriesFilter) return false;
      if (matchReviewFilter !== "all" && m.reviewStatus !== matchReviewFilter) return false;
      return true;
    });
  }, [matches, matchTypeFilter, matchSubjectFilter, matchSeriesFilter, matchReviewFilter]);

  const [sideBySide, setSideBySide] = useState(null); // match object

  return (
    <>
      <div className="ul-edu-header">
        <div>
          <h2 className="ul-edu-header__title">Test Series Tracker</h2>
          <p className="ul-edu-header__subtitle">
            Overall progress across test series creation, educator assignments, submissions, and approvals — plus repeated-question detection below.
          </p>
        </div>
      </div>

      <div className="ul-trk-stats">
        <div className="ul-trk-stat"><span className="ul-trk-stat__icon"><IconLayers size={14} /></span><strong>{totalSeries}</strong><small>Total Test Series</small></div>
        <div className="ul-trk-stat"><span className="ul-trk-stat__icon"><IconCheck size={14} /></span><strong>{activeSeries}</strong><small>Active Test Series</small></div>
        <div className="ul-trk-stat"><span className="ul-trk-stat__icon"><IconWallet size={14} /></span><strong>{trackerStats.totalAssignments}</strong><small>Total Assignments</small></div>
      </div>

      <div className="ul-edu-toolbar">
        <label className="ul-edu-search">
          <IconSearch size={14} color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder="Search by test series or subject…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button type="button" className="ul-edu-search__clear" onClick={() => setSearch("")} aria-label="Clear search">
              <IconClose size={12} />
            </button>
          )}
        </label>

        <select className="ul-edu-select ul-edu-select--sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="deadline_asc">Deadline: soonest first</option>
          <option value="completion_desc">Completion: highest first</option>
          <option value="name_asc">Series name: A–Z</option>
        </select>

        <div className="ul-asg-filter-popover-wrap" ref={filterRef}>
          <button type="button" className={`ul-btn ul-btn--ghost ul-asg-filters-toggle${filtersOpen ? " is-open" : ""}`} onClick={() => setFiltersOpen((v) => !v)}>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""} <IconChevronDown size={13} />
          </button>
          {filtersOpen && (
            <div className="ul-asg-filter-popover">
              <label className="ul-asg-filter-field">
                <span>Subject</span>
                <select value={subjectFilter} onChange={(e) => { setSubjectFilter(e.target.value); setPage(1); }}>
                  <option value="all">All subjects</option>
                  {SUBJECT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="ul-asg-filter-field">
                <span>Educator</span>
                <select value={educatorFilter} onChange={(e) => { setEducatorFilter(e.target.value); setPage(1); }}>
                  {educatorOptions.map((e) => <option key={e} value={e}>{e === "all" ? "All educators" : e}</option>)}
                </select>
              </label>
              <label className="ul-asg-filter-field">
                <span>Overall Status</span>
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option value="all">All statuses</option>
                  <option value="On Track">On Track</option>
                  <option value="Complete">Complete</option>
                  <option value="Needs Revision">Needs Revision</option>
                  <option value="Overdue">Overdue</option>
                  <option value="No Assignments Yet">No Assignments Yet</option>
                </select>
              </label>
              <button type="button" className="ul-btn ul-btn--ghost ul-asg-filter-popover__clear" onClick={clearFilters} disabled={activeFilterCount === 0}>
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="ul-card ul-edu-table-card">
        {pageItems.length === 0 ? (
          <div className="ul-edu-empty">No test series match your filters.</div>
        ) : (
          <div className="ul-edu-table-scroll">
            <table className="ul-edu-table ul-trk-table">
              <colgroup>
                {["16%", "9%", "19%", "5%", "6%", "7%", "7%", "11%", "10%", "10%"].map((w, i) => <col key={i} style={{ width: w }} />)}
              </colgroup>
              <thead>
                <tr>
                  <th>Test Series</th>
                  <th>Subject</th>
                  <th>Assigned Educators</th>
                  <th>Required</th>
                  <th>Created</th>
                  <th>Submitted</th>
                  <th>Approved</th>
                  <th>Progress</th>
                  <th>Deadline</th>
                  <th>Overall Status</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((g) => (
                  <tr key={g.seriesId || g.seriesName} className="ul-edu-row--clickable" onClick={() => setDetailSeriesId(g.seriesId || g.seriesName)}>
                    <td className="ul-asg-ellipsis">{g.seriesName}</td>
                    <td>{g.subject}</td>
                    <td className="ul-trk-educators">{g.educators.length ? g.educators.map((n) => <div key={n}>{n}</div>) : "—"}</td>
                    <td>{g.totalTestsRequired}</td>
                    <td>{g.testsCreated}</td>
                    <td>{g.testsSubmitted}</td>
                    <td>{g.testsApproved}</td>
                    <td>
                      <div className="ul-asg-progress">
                        <div className="ul-progress-track ul-asg-progress-track">
                          <div className="ul-progress-fill" style={{ width: `${g.completionPct}%` }} />
                        </div>
                        <span>{g.completionPct}%</span>
                      </div>
                    </td>
                    <td>{fmtDate(g.deadline)}</td>
                    <td><span className={`ul-status-badge ${OVERALL_STATUS_BADGE[g.overallStatus] || "is-pending"}`}>{g.overallStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pageItems.length > 0 && (
          <div className="ul-edu-pagination">
            <span className="ul-edu-pagination__info">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, rows.length)} of {rows.length}
            </span>
            <div className="ul-edu-pagination__controls">
              <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
              <span>{currentPage} / {pageCount}</span>
              <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      {/* ---------- Tracker row detail ---------- */}
      {detailGroup && (
        <div className="ul-confirm-backdrop" onClick={() => setDetailSeriesId(null)}>
          <div className="ul-confirm-modal ul-mgmt-detail-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ul-confirm-modal__header">
              <span className="ul-confirm-modal__icon"><IconLayers size={16} color="var(--color-primary-dark)" /></span>
              <button type="button" className="ul-confirm-modal__close" onClick={() => setDetailSeriesId(null)} aria-label="Close"><IconClose size={15} /></button>
            </div>
            <h3 className="ul-confirm-modal__title">{detailGroup.seriesName}</h3>
            <p className="ul-confirm-modal__desc">{detailGroup.subject} · {detailGroup.educators.join(", ") || "No educators assigned yet"}</p>

            <div className="ul-mgmt-detail-stats">
              <div><span>{detailGroup.totalTestsRequired}</span>Required</div>
              <div><span>{detailGroup.testsCreated}</span>Created</div>
              <div><span>{detailGroup.testsApproved}</span>Approved</div>
              <div><span>{detailGroup.completionPct}%</span>Complete</div>
            </div>

            <span className="ul-mgmt-detail-subhead">Assignments in this series</span>
            {detailGroup.assignments.length === 0 ? (
              <p className="ul-mgmt-empty">No assignments created for this series yet.</p>
            ) : (
              <div className="ul-mgmt-activity-list">
                {detailGroup.assignments.map((a) => (
                  <div key={a.id} className="ul-mgmt-activity-row">
                    <span className="ul-mgmt-activity-row__dot" />
                    <div className="ul-mgmt-activity-row__body">
                      <p className="ul-mgmt-activity-row__text"><strong>{a.testName}</strong> — {a.educatorName}</p>
                      <p className="ul-mgmt-activity-row__meta">
                        {a.id} · {ASSIGNMENT_STATUS_LABEL[getDisplayStatus(a)]} · {getAssignmentProgress(a)}% · {a.questionCount} Qs · {a.totalMarks} marks · {a.duration} min · deadline {fmtDate(a.deadline)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      )}

      {/* ---------- Repeated question side-by-side ---------- */}
      {sideBySide && (
        <div className="ul-confirm-backdrop" onClick={() => setSideBySide(null)}>
          <div className="ul-confirm-modal ul-mgmt-detail-modal ul-trk-rqd-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ul-confirm-modal__header">
              <span className="ul-confirm-modal__icon"><IconHistory size={16} color="var(--color-primary-dark)" /></span>
              <button type="button" className="ul-confirm-modal__close" onClick={() => setSideBySide(null)} aria-label="Close"><IconClose size={15} /></button>
            </div>
            <h3 className="ul-confirm-modal__title">
              {MATCH_TYPE_LABEL[sideBySide.matchType]} — {sideBySide.similarityPercent}% similar
            </h3>
            <div className="ul-trk-rqd-sidebyside">
              <div className="ul-trk-rqd-sidebyside__col">
                <span className="ul-mgmt-detail-subhead">Original</span>
                <p className="ul-trk-rqd-question-text">{sideBySide.original.text}</p>
                <p className="ul-trk-rqd-question-meta">{sideBySide.original.seriesName} · {sideBySide.original.testName} · {sideBySide.original.subject}</p>
                <button type="button" className="ul-btn ul-btn--ghost" onClick={() => navigate(`/admin/testseries/${sideBySide.original.seriesId}/tests/${sideBySide.original.testId}`)}>
                  Open Test to Edit
                </button>
              </div>
              <div className="ul-trk-rqd-sidebyside__col">
                <span className="ul-mgmt-detail-subhead">Matching</span>
                <p className="ul-trk-rqd-question-text">{sideBySide.matching.text}</p>
                <p className="ul-trk-rqd-question-meta">{sideBySide.matching.seriesName} · {sideBySide.matching.testName} · {sideBySide.matching.subject}</p>
                <button type="button" className="ul-btn ul-btn--ghost" onClick={() => navigate(`/admin/testseries/${sideBySide.matching.seriesId}/tests/${sideBySide.matching.testId}`)}>
                  Open Test to Edit
                </button>
              </div>
            </div>

            <div className="ul-confirm-modal__actions ul-trk-rqd-modal-actions">
              <button type="button" className="ul-btn ul-btn--ghost" onClick={() => { markMatchReviewed(sideBySide.id); setSideBySide(null); }}>
                Mark Reviewed
              </button>
              <button type="button" className="ul-btn ul-btn--ghost" onClick={() => { dismissMatch(sideBySide.id, "Reviewed and judged not a real duplicate."); setSideBySide(null); }}>
                Dismiss (False Positive)
              </button>
              <button type="button" className="ul-btn ul-btn--danger" onClick={() => { flagMatchConfirmed(sideBySide.id, "Confirmed duplicate — needs correction."); setSideBySide(null); }}>
                Flag Confirmed Duplicate
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
