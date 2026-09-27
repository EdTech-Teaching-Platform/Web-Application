// Test Series — Overview + Manage Test Series (Tab 1) and Test & Question
// Structure (Tab 2, embeds TestSeriesDetail.jsx / TestDetail.jsx via
// props). Strict 3-level hierarchy: Test Series -> Tests -> Questions.
// Sits in the sidebar right after Course Management and before
// Institutions.
//
// Single Admin role — every action here is available to any Admin,
// reusing the existing Settings & Permissions matrix's Test Series row
// (see data/permissionsMock.js MODULE.TEST_SERIES).
//
// Reuses .ul-card/.ul-stats/.ul-stat-card/.ul-status-badge/.ul-tabs from
// AdminDashboard.css, EducatorVerification.css & SettingsPermissions.css
// (also reused for its table/search/filter/drawer/kv classes), and
// .ul-usr-pagination-style primitives are replaced here by the
// .ul-ts-pagination-* classes in TestSeries.css to match the redesigned
// pagination control. Page-specific layout lives in TestSeries.css.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SERIES_STATUS,
  SERIES_STATUS_LABEL,
  SERIES_STATUS_BADGE_CLASS,
  PRICING_TYPE,
  PRICING_TYPE_LABEL,
  SUBJECT_OPTIONS,
  AUDIENCE_OPTIONS,
  useTestSeriesList,
  computeOverviewStats,
  createTestSeries,
  updateTestSeries,
  deleteTestSeries,
  duplicateTestSeries,
  setSeriesStatus,
  validateSeriesForPublish,
} from "../data/testSeriesMock";
import {
  IconSearch, IconClose, IconPlus, IconEdit, IconBook, IconLayers,
  IconUsers, IconReport, IconChart, IconAtom, IconCalculator,
  IconGraduationCap, IconInstitution, IconLightbulb, IconMore, IconEye,
  IconEyeOff, IconCheck, IconChevronLeft, IconChevronRight,
} from "../components/icons";
import ConfirmModal from "../components/ConfirmModal";
import TestSeriesDetail from "./TestSeriesDetail";
import TestDetail from "./TestDetail";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./SettingsPermissions.css";
import "./UserManagement.css";
import "./TestSeries.css";

const PAGE_SIZE = 8;

const EMPTY_FORM = {
  name: "",
  description: "",
  subject: "",
  audience: "",
  pricing: PRICING_TYPE.FREE,
  price: "",
  startDate: "",
  endDate: "",
};

const TABS = [
  { key: "series", label: "Test Series Structure", icon: IconBook },
  { key: "tests", label: "Test & Question Structure", icon: IconLayers },
];

const SUBJECT_STYLE = {
  Physics: { icon: IconAtom, bg: "#fdece0", fg: "#d9822b" },
  Mathematics: { icon: IconCalculator, bg: "#e3edfc", fg: "#2f6fed" },
  Biology: { icon: IconGraduationCap, bg: "#e6f4ea", fg: "#2f9e56" },
  "Computer Science": { icon: IconChart, bg: "#eef2ff", fg: "#5b6bd6" },
  "Reasoning & Aptitude": { icon: IconInstitution, bg: "#f1e9fb", fg: "#8a4fd1" },
  "General Knowledge": { icon: IconLightbulb, bg: "#fff6e0", fg: "#d9a91b" },
  English: { icon: IconBook, bg: "#fde4ef", fg: "#d1478a" },
};
function subjectStyle(subject) {
  return SUBJECT_STYLE[subject] || { icon: IconBook, bg: "var(--color-bg-secondary)", fg: "var(--color-text-secondary)" };
}

function currency(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function timelineOf(s) {
  const today = new Date().toISOString().slice(0, 10);
  if (s.startDate > today) return "upcoming";
  if (s.endDate < today) return "ended";
  return "ongoing";
}

export default function TestSeries() {
  const seriesList = useTestSeriesList();

  const [tab, setTab] = useState("series");
  const [selectedSeriesId, setSelectedSeriesId] = useState(null);
  const [selectedTestId, setSelectedTestId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pricingFilter, setPricingFilter] = useState("all");
  const [timelineFilter, setTimelineFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  const [formOpen, setFormOpen] = useState(null); // null | "create" | "edit"
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [formErrors, setFormErrors] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    toastTimer.current = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  useEffect(() => setPage(1), [search, statusFilter, pricingFilter, timelineFilter]);

  useEffect(() => {
    if (!openMenuId) return undefined;
    const close = () => setOpenMenuId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [openMenuId]);

  const stats = useMemo(() => computeOverviewStats(seriesList), [seriesList]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return seriesList.filter((s) => {
      const matchesSearch = !query || [s.name, s.subject, s.audience, s.id].some((v) => (v || "").toLowerCase().includes(query));
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      const matchesPricing = pricingFilter === "all" || s.pricing === pricingFilter;
      const matchesTimeline = timelineFilter === "all" || timelineOf(s) === timelineFilter;
      return matchesSearch && matchesStatus && matchesPricing && matchesTimeline;
    });
  }, [seriesList, search, statusFilter, pricingFilter, timelineFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPricingFilter("all");
    setTimelineFilter("all");
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormErrors([]);
    setFormOpen("create");
  };

  const openEdit = (s) => {
    setForm({
      name: s.name, description: s.description, subject: s.subject, audience: s.audience,
      pricing: s.pricing, price: s.pricing === PRICING_TYPE.PAID ? String(s.price) : "",
      startDate: s.startDate, endDate: s.endDate,
    });
    setEditingId(s.id);
    setFormErrors([]);
    setFormOpen("edit");
  };

  const closeForm = () => {
    setFormOpen(null);
    setFormErrors([]);
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    description: form.description.trim(),
    subject: form.subject,
    audience: form.audience,
    pricing: form.pricing,
    price: form.pricing === PRICING_TYPE.PAID ? Number(form.price) || 0 : 0,
    startDate: form.startDate,
    endDate: form.endDate,
  });

  const saveAsDraft = () => {
    const payload = { ...buildPayload(), status: SERIES_STATUS.DRAFT };
    if (formOpen === "edit") {
      updateTestSeries(editingId, payload);
      setToast(`"${payload.name || "Test Series"}" saved as draft.`);
      closeForm();
    } else {
      const created = createTestSeries(payload);
      setToast(`"${payload.name || "Test Series"}" created as draft. Now add Tests and Questions.`);
      closeForm();
      setSelectedSeriesId(created.id);
      setSelectedTestId(null);
      setTab("tests");
    }
  };

  const saveAndPublish = () => {
    const payload = { ...buildPayload(), status: SERIES_STATUS.PUBLISHED };
    const { valid, errors } = validateSeriesForPublish(payload);
    if (!valid) {
      setFormErrors(errors);
      return;
    }
    let publishedId = editingId;
    if (formOpen === "edit") {
      updateTestSeries(editingId, payload);
      setToast(`"${payload.name}" updated and published.`);
    } else {
      const created = createTestSeries(payload);
      publishedId = created.id;
      setToast(`"${payload.name}" created and published.`);
    }
    closeForm();
    // Jump straight to this series' Test & Question Structure page instead
    // of leaving the admin sitting on the edit drawer / series list —
    // publishing means the questions are already in place, so the next
    // thing they want to see is the structure they just published.
    setSelectedSeriesId(publishedId);
    setSelectedTestId(null);
    setTab("tests");
  };

  const handlePublish = (s) => {
    if (s.status === SERIES_STATUS.PUBLISHED) return;
    const { valid, errors } = validateSeriesForPublish(s);
    if (!valid) {
      setToast(errors[0]);
      return;
    }
    setSeriesStatus(s.id, SERIES_STATUS.PUBLISHED);
    setToast(`"${s.name}" published.`);
  };

  const handleUnpublish = (s) => {
    if (s.status !== SERIES_STATUS.PUBLISHED) return;
    setSeriesStatus(s.id, SERIES_STATUS.DRAFT);
    setToast(`"${s.name}" unpublished.`);
  };

  const handleDuplicate = (s) => {
    duplicateTestSeries(s.id);
    setToast(`"${s.name}" duplicated.`);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteTestSeries(deleteTarget.id);
    setToast(`"${deleteTarget.name}" deleted.`);
    setDeleteTarget(null);
  };

  const manageTests = (s) => {
    setSelectedSeriesId(s.id);
    setSelectedTestId(null);
    setTab("tests");
  };

  // Switching tabs via the tab bar itself (as opposed to "Manage Tests" on
  // a specific series row, which calls manageTests() above) must never
  // carry over a stale selectedSeriesId from an earlier visit — entering
  // "Test & Question Structure" this way should always land on its empty
  // "Select a Test Series" default, not silently reopen whatever series
  // happened to be selected last time.
  const switchTab = (key) => {
    if (key === "tests") {
      setSelectedSeriesId(null);
      setSelectedTestId(null);
    }
    setTab(key);
  };

  return (
    <div className="ul-ts-page">
      <div className="ul-dash-welcome">
        <h2 className="ul-dash-welcome__title">Test Series</h2>
        <p className="ul-dash-welcome__subtitle">Create and manage Test Series, their Tests, and Questions across the platform.</p>
      </div>

      <div className="ul-ts-tabs-row">
        <div className="ul-tabs ul-ts-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`ul-tab${tab === t.key ? " is-active" : ""}`}
              onClick={() => switchTab(t.key)}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <t.icon size={13} /> {t.label}
              </span>
            </button>
          ))}
        </div>
        {tab === "series" && (
          <button type="button" className="ul-btn ul-btn--primary" onClick={openCreate}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <IconPlus size={14} /> Create Test Series
            </span>
          </button>
        )}
      </div>

      {tab === "series" && (
        <>
          <div className="ul-stats ul-ts-stats">
            <div className="ul-stat-card ul-ts-stat-card">
              <span className="ul-ts-stat-icon" style={{ background: "#fdece0", color: "#d9822b" }}><IconLayers size={17} /></span>
              <span className="ul-stat-card__label">TOTAL TEST SERIES</span>
              <span className="ul-stat-card__value ul-ts-stat-value--neutral">{stats.totalSeries}</span>
              <span className="ul-stat-card__trend">Across all subjects</span>
            </div>
            <div className="ul-stat-card ul-ts-stat-card">
              <span className="ul-ts-stat-icon" style={{ background: "#e6f4ea", color: "#2f9e56" }}><IconUsers size={17} /></span>
              <span className="ul-stat-card__label">TOTAL ENROLLED STUDENTS</span>
              <span className="ul-stat-card__value">{stats.totalEnrolled.toLocaleString("en-IN")}</span>
              <span className="ul-stat-card__trend">Across all series</span>
            </div>
            <div className="ul-stat-card ul-ts-stat-card">
              <span className="ul-ts-stat-icon" style={{ background: "#fde4ef", color: "#d1478a" }}><IconReport size={17} /></span>
              <span className="ul-stat-card__label">TOTAL ATTEMPTS</span>
              <span className="ul-stat-card__value">{stats.totalAttempts.toLocaleString("en-IN")}</span>
              <span className="ul-stat-card__trend">All tests, all series</span>
            </div>
            <div className="ul-stat-card ul-ts-stat-card">
              <span className="ul-ts-stat-icon" style={{ background: "#fdeceb", color: "#b3261e" }}><IconChart size={17} /></span>
              <span className="ul-stat-card__label">AVERAGE PERFORMANCE</span>
              <span className="ul-stat-card__value">{stats.avgPerformance}%</span>
              <span className="ul-stat-card__trend">Across series with attempts</span>
            </div>
          </div>

          <div className="ul-set-filters">
            <label className="ul-set-search">
              <IconSearch size={14} color="var(--color-text-muted)" />
              <input type="text" placeholder="Search by name, subject, or ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && (
                <button type="button" className="ul-usr-search__clear" onClick={() => setSearch("")} aria-label="Clear search">
                  <IconClose size={12} />
                </button>
              )}
            </label>
            <select className="ul-set-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Status: All</option>
              {Object.values(SERIES_STATUS).map((s) => <option key={s} value={s}>{SERIES_STATUS_LABEL[s]}</option>)}
            </select>
            <select className="ul-set-select" value={pricingFilter} onChange={(e) => setPricingFilter(e.target.value)}>
              <option value="all">Pricing: All</option>
              {Object.values(PRICING_TYPE).map((p) => <option key={p} value={p}>{PRICING_TYPE_LABEL[p]}</option>)}
            </select>
            <select className="ul-set-select" value={timelineFilter} onChange={(e) => setTimelineFilter(e.target.value)}>
              <option value="all">Timeline: All</option>
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="ended">Ended</option>
            </select>
            <button type="button" className="ul-btn ul-btn--ghost" onClick={resetFilters}>Reset</button>
          </div>

          <div className="ul-card ul-set-table-card">
            {pageItems.length === 0 ? (
              <div className="ul-set-empty">No Test Series match these filters.</div>
            ) : (
              <div className="ul-set-table-scroll">
                <table className="ul-set-table ul-ts-table" style={{ minWidth: 960 }}>
                  <colgroup>
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "20%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Test Series</th>
                      <th>Status</th>
                      <th>Pricing</th>
                      <th>Enrollment</th>
                      <th>Attempts</th>
                      <th>Performance</th>
                      <th>Date Range</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((s) => {
                      const st = subjectStyle(s.subject);
                      const SubjectIcon = st.icon;
                      return (
                        <tr key={s.id}>
                          <td data-label="Test Series">
                            <div className="ul-ts-name-cell">
                              <span className="ul-ts-thumb" style={{ background: st.bg, color: st.fg, border: "none" }}><SubjectIcon size={16} /></span>
                              <div className="ul-ts-name-cell__text">
                                <strong>{s.name}</strong>
                                <small>{s.subject} · {s.audience} · {s.tests.length} test{s.tests.length === 1 ? "" : "s"}</small>
                              </div>
                            </div>
                          </td>
                          <td data-label="Status"><span className={`ul-status-badge ${SERIES_STATUS_BADGE_CLASS[s.status]}`}>{SERIES_STATUS_LABEL[s.status]}</span></td>
                          <td className="ul-ts-pricing-cell" data-label="Pricing">
                            <strong>{s.pricing === PRICING_TYPE.PAID ? currency(s.price) : "Free"}</strong>
                          </td>
                          <td data-label="Enrollment">{s.enrollment.toLocaleString("en-IN")}</td>
                          <td data-label="Attempts">{s.attempts.toLocaleString("en-IN")}</td>
                          <td data-label="Performance">
                            <div className="ul-ts-perf-cell">
                              <span className="ul-ts-perf-value">{s.avgPerformance}%</span>
                              <span className="ul-ts-perf-bar"><span style={{ width: `${s.avgPerformance}%` }} /></span>
                            </div>
                          </td>
                          <td className="ul-ts-dates-cell" data-label="Date Range">{s.startDate}<br />to {s.endDate}</td>
                          <td data-label="Actions">
                            <div className="ul-ts-actions-cell">
                              <button type="button" className="ul-btn ul-btn--ghost ul-set-btn-sm ul-ts-manage-btn" onClick={() => manageTests(s)}>Manage Tests</button>
                              <button type="button" className="ul-ts-icon-btn" onClick={() => openEdit(s)} aria-label="Edit"><IconEdit size={14} /></button>
                              <div className="ul-ts-kebab-wrap">
                                <button type="button" className="ul-ts-icon-btn" onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === s.id ? null : s.id); }} aria-label="More actions"><IconMore size={14} /></button>
                                {openMenuId === s.id && (
                                  <div className="ul-ts-kebab-menu" onClick={(e) => e.stopPropagation()}>
                                    <button type="button" className="is-publish" onClick={() => { handlePublish(s); setOpenMenuId(null); }}><IconCheck size={13} /> Publish</button>
                                    <button type="button" className="is-unpublish" onClick={() => { handleUnpublish(s); setOpenMenuId(null); }}><IconEyeOff size={13} /> Unpublish</button>
                                    <button type="button" onClick={() => { handleDuplicate(s); setOpenMenuId(null); }}><IconReport size={13} /> Duplicate</button>
                                    <button type="button" onClick={() => { setViewTarget(s); setOpenMenuId(null); }}><IconEye size={13} /> View Details</button>
                                    <button type="button" className="is-danger" onClick={() => { setDeleteTarget(s); setOpenMenuId(null); }}><IconClose size={13} /> Delete</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="ul-ts-pagination">
            <span className="ul-ts-pagination__info">Showing {filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} test series</span>
            <div className="ul-ts-pagination__controls">
              <button type="button" className="ul-ts-page-btn" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page"><IconChevronLeft size={13} /></button>
              <span className="ul-ts-page-current">{currentPage}</span>
              <button type="button" className="ul-ts-page-btn" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} aria-label="Next page"><IconChevronRight size={13} /></button>
            </div>
          </div>
        </>
      )}

      {tab === "tests" && (
        <div className="ul-card ul-ts-tests-tab-card" style={{ padding: 18 }}>
          {!selectedSeriesId ? (
            <>
              <div className="ul-card__head">
                <span className="ul-card__eyebrow">Test &amp; Question Structure</span>
                <h3>Select a Test Series</h3>
              </div>
              <p className="ul-dash-welcome__subtitle" style={{ marginBottom: 14 }}>
                Choose a Test Series below (or use "Manage Tests" from the Test Series Structure tab) to manage its Tests and Questions.
              </p>
              <div className="ul-ts-form-row" style={{ maxWidth: 420 }}>
                <label>Test Series</label>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedSeriesId(e.target.value);
                      setSelectedTestId(null);
                    }
                  }}
                >
                  <option value="">Select a Test Series…</option>
                  {seriesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </>
          ) : selectedTestId ? (
            <TestDetail
              seriesId={selectedSeriesId}
              testId={selectedTestId}
              onBack={() => setSelectedTestId(null)}
              onSeriesPublished={() => {
                // "Publish Test Series" is a bigger action than the plain
                // Back button — it means the admin is done with this
                // series entirely, so land them on the top-level Test
                // Series Structure tab (the series list/grid), not just
                // one level up on this series' Tests list.
                setSelectedSeriesId(null);
                setSelectedTestId(null);
                setTab("series");
              }}
            />
          ) : (
            <TestSeriesDetail
              seriesId={selectedSeriesId}
              onBack={() => {
                setSelectedSeriesId(null);
                setTab("series");
              }}
              onManageQuestions={(testId) => setSelectedTestId(testId)}
            />
          )}
        </div>
      )}

      {/* ---------- Create / Edit drawer ---------- */}
      {formOpen && (
        <div className="ul-set-drawer-backdrop" onClick={closeForm}>
          <div className="ul-set-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ul-set-drawer__head">
              <div>
                <h3 className="ul-set-drawer__title">{formOpen === "edit" ? "Edit Test Series" : "Create Test Series"}</h3>
                <p className="ul-set-drawer__sub">{formOpen === "create" ? "Fill in the basic details below. You'll add Tests and Questions next before publishing." : "Fill in the details below. You can save as a draft and publish later."}</p>
              </div>
            </div>
            <div className="ul-set-drawer__body">
              <div className="ul-ts-form">
                {formErrors.length > 0 && (
                  <div className="ul-ts-errors">
                    <strong>Fix the following before publishing:</strong>
                    <ul>{formErrors.map((err, i) => <li key={i}>{err}</li>)}</ul>
                  </div>
                )}

                <div className="ul-ts-form-row">
                  <label>Test Series Name</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. JEE Main Physics Test Series 2026" />
                </div>

                <div className="ul-ts-form-row">
                  <label>Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does this Test Series cover?" />
                </div>

                <div className="ul-ts-form-grid-2">
                  <div className="ul-ts-form-row">
                    <label>Subject / Category</label>
                    <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                      <option value="">Select subject…</option>
                      {SUBJECT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="ul-ts-form-row">
                    <label>Target Audience / Level</label>
                    <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                      <option value="">Select audience…</option>
                      {AUDIENCE_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>

                <div className="ul-ts-form-row">
                  <label>Free or Paid</label>
                  <div className="ul-ts-pill-toggle">
                    <button type="button" className={form.pricing === PRICING_TYPE.FREE ? "is-active" : ""} onClick={() => setForm({ ...form, pricing: PRICING_TYPE.FREE })}>Free</button>
                    <button type="button" className={form.pricing === PRICING_TYPE.PAID ? "is-active" : ""} onClick={() => setForm({ ...form, pricing: PRICING_TYPE.PAID })}>Paid</button>
                  </div>
                </div>

                {form.pricing === PRICING_TYPE.PAID && (
                  <div className="ul-ts-form-row">
                    <label>Price (₹)</label>
                    <input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="e.g. 999" />
                  </div>
                )}

                <div className="ul-ts-form-grid-2">
                  <div className="ul-ts-form-row">
                    <label>Start Date</label>
                    <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                  </div>
                  <div className="ul-ts-form-row">
                    <label>End Date</label>
                    <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
            <div className="ul-set-drawer__actions ul-ts-drawer-actions">
              <button type="button" className="ul-btn ul-btn--ghost" onClick={closeForm}>Cancel</button>
              {formOpen === "create" ? (
                <button type="button" className="ul-btn ul-btn--primary" onClick={saveAsDraft}>Next</button>
              ) : (
                <>
                  <button type="button" className="ul-btn ul-btn--ghost" onClick={saveAsDraft}>Save as Draft</button>
                  <button type="button" className="ul-btn ul-btn--primary" onClick={saveAndPublish}>Publish</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- View Details drawer ---------- */}
      {viewTarget && (
        <div className="ul-set-drawer-backdrop" onClick={() => setViewTarget(null)}>
          <div className="ul-set-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ul-set-drawer__head">
              <div>
                <h3 className="ul-set-drawer__title">{viewTarget.name}</h3>
                <p className="ul-set-drawer__sub">{viewTarget.description || "No description provided."}</p>
              </div>
            </div>
            <div className="ul-set-drawer__body">
              <div className="ul-set-kv">
                <div className="ul-set-kv__item"><p className="ul-set-kv__label">Status</p><p className="ul-set-kv__value"><span className={`ul-status-badge ${SERIES_STATUS_BADGE_CLASS[viewTarget.status]}`}>{SERIES_STATUS_LABEL[viewTarget.status]}</span></p></div>
                <div className="ul-set-kv__item"><p className="ul-set-kv__label">Subject</p><p className="ul-set-kv__value">{viewTarget.subject}</p></div>
                <div className="ul-set-kv__item"><p className="ul-set-kv__label">Audience</p><p className="ul-set-kv__value">{viewTarget.audience}</p></div>
                <div className="ul-set-kv__item"><p className="ul-set-kv__label">Pricing</p><p className="ul-set-kv__value">{viewTarget.pricing === PRICING_TYPE.PAID ? currency(viewTarget.price) : "Free"}</p></div>
                <div className="ul-set-kv__item"><p className="ul-set-kv__label">Start Date</p><p className="ul-set-kv__value">{viewTarget.startDate}</p></div>
                <div className="ul-set-kv__item"><p className="ul-set-kv__label">End Date</p><p className="ul-set-kv__value">{viewTarget.endDate}</p></div>
                <div className="ul-set-kv__item"><p className="ul-set-kv__label">Tests</p><p className="ul-set-kv__value">{viewTarget.tests.length}</p></div>
                <div className="ul-set-kv__item"><p className="ul-set-kv__label">Enrollment</p><p className="ul-set-kv__value">{viewTarget.enrollment.toLocaleString("en-IN")}</p></div>
                <div className="ul-set-kv__item"><p className="ul-set-kv__label">Attempts</p><p className="ul-set-kv__value">{viewTarget.attempts.toLocaleString("en-IN")}</p></div>
                <div className="ul-set-kv__item"><p className="ul-set-kv__label">Avg. Performance</p><p className="ul-set-kv__value">{viewTarget.avgPerformance}%</p></div>
              </div>
            </div>
            <div className="ul-set-drawer__actions ul-ts-drawer-actions">
              <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setViewTarget(null)}>Close</button>
              <button type="button" className="ul-btn ul-btn--primary" onClick={() => { const target = viewTarget; setViewTarget(null); openEdit(target); }}>Edit</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete this Test Series?"
        description={deleteTarget ? `"${deleteTarget.name}" and all of its Tests and Questions will be permanently deleted. This cannot be undone.` : ""}
        confirmLabel="Delete Test Series"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {toast && <div className="ul-set-toast">{toast}</div>}
    </div>
  );
}
