// Test Performance Analytics — performance of PUBLISHED tests/series,
// using the learner-attempt aggregates already modeled on each test
// (attempts / avgScore / avgTimeTakenMinutes in testSeriesMock.js). No
// separate "attempts" dataset is invented here.
//
// Metrics this app genuinely has no underlying per-learner/per-question
// data for (Pass Rate, Completion Rate, question-level accuracy) are shown
// as an explicit empty state rather than a fabricated number.
//
// Reuses .ul-edu-header / .ul-edu-toolbar / .ul-edu-table (EducatorVerification.css),
// .ul-card / .ul-card__head / .ul-card__eyebrow (AdminDashboard.css),
// .ul-report-bars family (ReportsBuilder.css).

import { useCallback, useState } from "react";
import { useRpc } from "../hooks/useRpc";
import { performanceApi } from "../services/performanceApi";
import { IconChart, IconDownload, IconHistory, IconLayers } from "../components/icons";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./ReportsBuilder.css";
import "./TestPerformanceAnalytics.css";

function pct(n) {
  return `${Math.round(n)}%`;
}

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function csvCell(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells) {
  return cells.map(csvCell).join(",");
}

function downloadCSV(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildEducatorMap(assignments) {
  const map = new Map();
  for (const a of assignments) {
    if (a.status !== "approved" && a.status !== "completed") continue;
    if (!a.seriesId || !a.testName) continue;
    map.set(`${a.seriesId}::${a.testName}`, a.educatorName || a.educatorId || "—");
  }
  return map;
}

// every educator who has been assigned to build tests for a series (rejected work excluded)
function buildSeriesEducators(assignments) {
  const map = new Map();
  for (const a of assignments) {
    if (a.status === "rejected" || !a.seriesId) continue;
    const name = a.educatorName || a.educatorId;
    if (!name) continue;
    if (!map.has(a.seriesId)) map.set(a.seriesId, new Set());
    map.get(a.seriesId).add(name);
  }
  return map;
}

function flattenPublishedTests(seriesList, assignments) {
  const educatorMap = buildEducatorMap(assignments);
  const seriesEducators = buildSeriesEducators(assignments);
  const rows = [];
  for (const series of seriesList) {
    for (const test of series.tests || []) {
      if (test.status !== "published") continue;
      const exact = educatorMap.get(`${series.id}::${test.name}`);
      const educators = exact ? [exact] : Array.from(seriesEducators.get(series.id) || []).sort();
      rows.push({
        testId: test.id,
        testName: test.name,
        seriesId: series.id,
        seriesName: series.name,
        subject: series.subject,
        scheduledAt: test.scheduledAt,
        attempts: test.attempts || 0,
        avgScore: test.avgScore || 0,
        avgTimeTakenMinutes: test.avgTimeTakenMinutes || 0,
        totalMarks: test.totalMarks,
        educators,
        educatorName: educators.length ? educators.join(", ") : "Unassigned",
      });
    }
  }
  return rows;
}

// Display-only sample values for the "Test-wise Score Comparison" table
// (keyed by test name). Other cards keep using the real test data.
const COMPARISON_SAMPLE = {
  "Physics Full Mock Test 1 — Mechanics & Waves": { attempts: 2845, avgScore: 68 },
  "Weekly Test 1 — Real Numbers & Polynomials": { attempts: 4310, avgScore: 78 },
  "Practice Set 12 — Puzzles & Seating Arrangement": { attempts: 6975, avgScore: 61 },
  "Grammar & Vocabulary Test 1": { attempts: 3190, avgScore: 72 },
};

function weightedAvg(rows, valueKey, weightKey) {
  let totalWeight = 0;
  let sum = 0;
  for (const r of rows) {
    const w = r[weightKey] || 0;
    sum += (r[valueKey] || 0) * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? sum / totalWeight : 0;
}

function wrapLabel(text, max = 13) {
  const words = String(text).split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (cur && `${cur} ${w}`.length > max) { lines.push(cur); cur = w; } else { cur = cur ? `${cur} ${w}` : w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Smooth line/area chart (subject -> weighted average score, 0-100%).
function LineChart({ points }) {
  const [hover, setHover] = useState(null);
  const W = 520, H = 214, L = 40, R = 40, T = 18, B = 52;
  const iw = W - L - R, ih = H - T - B;
  const n = points.length;
  const xs = points.map((_, i) => (n === 1 ? L + iw / 2 : L + (iw * i) / (n - 1)));
  const ys = points.map((p) => T + ih - (Math.min(100, Math.max(0, p.avgScore)) / 100) * ih);
  let line = "";
  if (n > 0) {
    line = `M ${xs[0]} ${ys[0]}`;
    for (let i = 0; i < n - 1; i += 1) {
      const x0 = xs[i - 1] ?? xs[i], y0 = ys[i - 1] ?? ys[i];
      const x1 = xs[i], y1 = ys[i], x2 = xs[i + 1], y2 = ys[i + 1];
      const x3 = xs[i + 2] ?? x2, y3 = ys[i + 2] ?? y2;
      const c1x = x1 + (x2 - x0) / 6, c1y = y1 + (y2 - y0) / 6;
      const c2x = x2 - (x3 - x1) / 6, c2y = y2 - (y3 - y1) / 6;
      line += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
    }
  }
  const area = n > 1 ? `${line} L ${xs[n - 1]} ${T + ih} L ${xs[0]} ${T + ih} Z` : "";
  const ticks = [0, 25, 50, 75, 100];
  const active = hover != null ? hover : null;
  return (
    <div className="ul-tpa-line">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Subject-wise average score line chart" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="ul-tpa-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => {
          const y = T + ih - (t / 100) * ih;
          return (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y} y2={y} className="ul-tpa-line__grid" />
            </g>
          );
        })}
        {area && <path d={area} fill="url(#ul-tpa-area)" />}
        {n > 0 && <path d={line} className="ul-tpa-line__path" />}
        {active != null && <line x1={xs[active]} x2={xs[active]} y1={T} y2={T + ih} className="ul-tpa-line__guide" />}
        {points.map((p, i) => (
          <g key={p.subject} onMouseEnter={() => setHover(i)}>
            <rect x={xs[i] - 28} y={T} width="56" height={ih + B} fill="transparent" />
            <circle cx={xs[i]} cy={ys[i]} r={active === i ? 5.5 : 4} className="ul-tpa-line__dot" />
            <text x={xs[i]} y={ys[i] - 10} textAnchor="middle" className={`ul-tpa-line__val${active === i ? " is-active" : ""}`}>{pct(p.avgScore)}</text>
            <text x={xs[i]} textAnchor="middle" className="ul-tpa-line__label">
              {wrapLabel(p.subject).map((ln, li) => (
                <tspan key={li} x={xs[i]} y={T + ih + 18 + li * 13}>{ln}</tspan>
              ))}
            </text>
          </g>
        ))}
      </svg>
      {active != null && (
        <div className="ul-tpa-line__tip">
          {points[active].subject}: {pct(points[active].avgScore)} avg · {points[active].attempts.toLocaleString("en-IN")} attempts
        </div>
      )}
    </div>
  );
}

export default function TestPerformanceAnalytics() {
  const [seriesFilter, setSeriesFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [testFilter, setTestFilter] = useState("all");
  const [educatorFilter, setEducatorFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const filters = { series: seriesFilter, subject: subjectFilter, test: testFilter, educator: educatorFilter, from: dateFrom, to: dateTo };
  const filterState = useRpc(useCallback(() => performanceApi.filterOptions(seriesFilter), [seriesFilter]));
  const summaryState = useRpc(useCallback(() => performanceApi.summary(filters), [seriesFilter, subjectFilter, testFilter, educatorFilter, dateFrom, dateTo]));
  const subjectState = useRpc(useCallback(() => performanceApi.subjectScores(filters), [seriesFilter, subjectFilter, testFilter, educatorFilter, dateFrom, dateTo]));
  const engagementState = useRpc(useCallback(() => performanceApi.engagement(filters), [seriesFilter, subjectFilter, testFilter, educatorFilter, dateFrom, dateTo]));
  const comparisonState = useRpc(useCallback(() => performanceApi.comparison(filters), [seriesFilter, subjectFilter, testFilter, educatorFilter, dateFrom, dateTo]));
  const lbState = useRpc(useCallback(() => performanceApi.leaderboard(lbSeries, dateFrom, dateTo), [lbSeries, dateFrom, dateTo]));
  const options = filterState.data || { series: [], subjects: [], tests: [], educators: [] };
  const seriesOptions = (options.series || []).map((s) => [s.id, s.title]);
  const lbSeriesOptions = seriesOptions;
  const testOptions = (options.tests || []).map((t) => ({ testId: t.id, testName: t.title }));
  const educatorOptions = (options.educators || []).map((e) => e.name);
  const filteredTests = (comparisonState.data || []).map((t) => ({ testId: t.test_id, testName: t.test_title, seriesName: t.series_title, educators: t.educators ? t.educators.split(", ") : [], subject: "", attempts: Number(t.attempts || 0), avgScore: Number(t.avg_score || 0), avgTimeTakenMinutes: Number(t.avg_time_minutes || 0) }));
  const summary = summaryState.data || {};
  const totalAttempts = Number(summary.total_attempts || 0);
  const avgScore = Number(summary.avg_score || 0);
  const avgTimeTaken = Number(summary.avg_time_minutes || 0);
  const totalPublishedTests = Number(summary.published_tests || 0);
  const hasAnyAttemptData = totalAttempts > 0;
  const bySubject = (subjectState.data || []).map((r) => ({ subject: r.subject, avgScore: Number(r.avg_score || 0), attempts: Number(r.attempts || 0) }));
  const seriesEngagement = (engagementState.data || []).map((r) => ({ seriesId: r.series_id, seriesName: r.series_title, subject: r.subject, attempts: Number(r.attempts || 0), avgPerformance: Number(r.avg_performance || 0), educators: r.educators && r.educators !== "Unassigned" ? r.educators.split(", ") : [] }));

  // ---- Leaderboard & Ranking ----
  const [lbSeries, setLbSeries] = useState("all");
  const lbLoading = lbState.loading;
  const lbSeriesId = lbSeries;
  const lbRows = (lbState.data || []).map((r) => ({ rank: r.rank_no, name: r.learner, score: Number(r.score || 0), percentile: Number(r.percentile || 0), attempts: Number(r.attempts || 0) }));
  const withAttempts = filteredTests.filter((t) => t.attempts > 0);
  const lbTop = lbRows.slice(0, 3);
  const lbShown = lbRows.slice(0, 10);
  const lbName = (r) => r.name;
  const lbScore = (r) => pct(r.score);

  async function exportCSV() {
    const rows = await performanceApi.exportRows(filters);
    const header = csvRow(["Test", "Test Series", "Subject", "Educator", "Attempts", "Avg Score", "Avg Time Taken (min)"]);
    const csvRows = rows.map((t) => csvRow([t.test, t.series, t.subject, t.educators, t.attempts, t.avg_score_pct ? `${t.avg_score_pct}%` : "—", t.avg_time_min || "—"]));
    downloadCSV("test-performance-analytics.csv", [header, ...csvRows].join("\n"));
    performanceApi.logExport(filters, rows.length).catch((error) => console.error("Failed to log analytics export.", error));
  }

  const subjectMax = Math.max(1, ...bySubject.map((s) => s.avgScore));

  return (
    <>
      <div className="ul-edu-header">
        <div>
          <h1 className="ul-edu-header__title">Test Performance Analytics</h1>
          <p className="ul-edu-header__subtitle">
            Learner performance on published tests, aggregated from actual attempt data.
          </p>
        </div>
        <button type="button" className="ul-btn ul-btn--ghost" onClick={exportCSV}>
          <IconDownload /> Export CSV
        </button>
      </div>

      <div className="ul-tpa-filters">
        <select value={seriesFilter} onChange={(e) => { setSeriesFilter(e.target.value); setTestFilter("all"); }}>
          <option value="all">All Test Series</option>
          {seriesOptions.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <select value={subjectFilter} onChange={(e) => { setSubjectFilter(e.target.value); setTestFilter("all"); }}>
          <option value="all">All Subjects</option>
          {options.subjects.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={testFilter} onChange={(e) => setTestFilter(e.target.value)}>
          <option value="all">All Tests</option>
          {testOptions.map((t) => (
            <option key={t.testId} value={t.testId}>{t.testName}</option>
          ))}
        </select>
        <select value={educatorFilter} onChange={(e) => setEducatorFilter(e.target.value)}>
          <option value="all">All Educators</option>
          {educatorOptions.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <div className="ul-tpa-dates">
        <div className="ul-tpa-date-field">
          <label htmlFor="tpa-from">From</label>
          <input id="tpa-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        {(summaryState.loading || subjectState.loading || engagementState.loading || comparisonState.loading) && <div className="ul-edu-empty">Loading analytics…</div>}
        {(summaryState.error || subjectState.error || engagementState.error || comparisonState.error) && (
          <div className="ul-edu-empty" role="alert"><p>{summaryState.error?.message || subjectState.error?.message || engagementState.error?.message || comparisonState.error?.message}</p><button type="button" className="ul-btn ul-btn--ghost" onClick={() => { summaryState.refetch(); subjectState.refetch(); engagementState.refetch(); comparisonState.refetch(); }}>Retry</button></div>
        )}
        <div className="ul-tpa-date-field">
          <label htmlFor="tpa-to">To</label>
          <input id="tpa-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        </div>
      </div>

      <div className="ul-tpa-metrics">
        <div className="ul-tpa-metric">
          <div className="ul-tpa-metric__icon"><IconChart /></div>
          <div>
            <div className="ul-tpa-metric__label">Total Test Attempts</div>
            <div className="ul-tpa-metric__value">{totalAttempts.toLocaleString("en-IN")}</div>
          </div>
        </div>
        <div className="ul-tpa-metric">
          <div className="ul-tpa-metric__icon"><IconLayers /></div>
          <div>
            <div className="ul-tpa-metric__label">Average Score</div>
            <div className="ul-tpa-metric__value">{hasAnyAttemptData ? pct(avgScore) : "—"}</div>
          </div>
        </div>
        <div className="ul-tpa-metric">
          <div className="ul-tpa-metric__icon"><IconHistory /></div>
          <div>
            <div className="ul-tpa-metric__label">Published Tests (in view)</div>
            <div className="ul-tpa-metric__value">{totalPublishedTests}</div>
          </div>
        </div>
        <div className="ul-tpa-metric">
          <div className="ul-tpa-metric__icon"><IconChart /></div>
          <div>
            <div className="ul-tpa-metric__label">Average Time Taken</div>
            <div className="ul-tpa-metric__value">{hasAnyAttemptData ? `${Math.round(avgTimeTaken)} min` : "—"}</div>
          </div>
        </div>
      </div>

      {!hasAnyAttemptData ? (
        <div className="ul-card ul-edu-empty">No learner attempt data for the current filters yet.</div>
      ) : (
        <div className="ul-tpa-grid">
          <div className="ul-tpa-col">
          <div className="ul-card ul-tpa-chart-card">
            <div className="ul-card__head">
              <span className="ul-card__eyebrow">Subject-wise Average Score</span>
            </div>
            <LineChart points={bySubject} />
          </div>


          <div className="ul-card ul-tpa-table-card">
            <div className="ul-card__head">
              <span className="ul-card__eyebrow">Test Series Engagement</span>
            </div>
            <div className="ul-tpa-scroll">
            <table className="ul-tpa-table ul-tpa-full">
              <thead>
                <tr>
                  <th>Test Series</th>
                  <th>Educators</th>
                  <th>Subject</th>
                  <th>Attempts</th>
                  <th>Avg Performance</th>
                </tr>
              </thead>
              <tbody>
                {seriesEngagement.map((s) => (
                  <tr key={s.seriesId}>
                    <td>{s.seriesName}</td>
                    <td>{s.educators.length ? s.educators.map((n) => <div key={n}>{n}</div>) : "Unassigned"}</td>
                    <td>{s.subject}</td>
                    <td>{s.attempts.toLocaleString("en-IN")}</td>
                    <td>{pct(s.avgPerformance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          </div>

          <div className="ul-card ul-tpa-lb">
            <div className="ul-card__head ul-tpa-lb__head">
              <span className="ul-card__eyebrow">Leaderboard &amp; Ranking</span>
            </div>
            <select className="ul-tpa-lb__select" value={lbSeriesId} onChange={(e) => setLbSeries(e.target.value)} aria-label="Leaderboard test series">
              <option value="all">All Test Series</option>
              {lbSeriesOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>

            {lbLoading ? (
              <div className="ul-tpa-lb__skeleton" aria-busy="true" aria-label="Loading leaderboard">
                {[0, 1, 2, 3, 4].map((i) => <div key={i} className="ul-tpa-lb__skrow" />)}
              </div>
            ) : lbRows.length === 0 ? (
              <div className="ul-edu-empty ul-tpa-lb__empty">No attempt data for this series yet.</div>
            ) : (
              <>
                <div className="ul-tpa-lb__top">
                  {lbTop.map((r) => (
                    <div className={`ul-tpa-lb__podium is-${r.rank}`} key={r.studentId}>
                      <span className="ul-tpa-lb__medal">{r.rank <= 3 ? "🏆 " : ""}#{r.rank}</span>
                      <span className="ul-tpa-lb__pname">{lbName(r)}</span>
                      <span className="ul-tpa-lb__pscore">{lbScore(r)}</span>
                    </div>
                  ))}
                </div>
                <div className="ul-tpa-scroll">
                  <table className="ul-tpa-table ul-tpa-full">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Learner</th>
                        <th>Score</th>
                        <th>Percentile</th>
                        <th>Attempts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lbShown.map((r) => (
                        <tr key={r.studentId}>
                          <td>{r.rank <= 3 ? "🏆 " : ""}{r.rank}</td>
                          <td>{lbName(r)}</td>
                          <td>{lbScore(r)}</td>
                          <td>{r.percentile.toFixed(1)}</td>
                          <td>{r.attempts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="ul-tpa-lb__note">
                  Top {lbShown.length} of {lbRows.length} learners.
                  {lbSeriesId === "all" ? "; overall = attempt-weighted average across series" : ""}.
                </p>
              </>
            )}
          </div>

          <div className="ul-card ul-tpa-table-card ul-tpa-wide">
            <div className="ul-card__head">
              <span className="ul-card__eyebrow">Test-wise Score Comparison</span>
            </div>
            <div className="ul-tpa-scroll">
            <table className="ul-tpa-table ul-tpa-full">
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Series</th>
                  <th>Educator</th>
                  <th>Attempts</th>
                  <th>Avg Score</th>
                  <th>Avg Time</th>
                </tr>
              </thead>
              <tbody>
                {withAttempts.map((t) => (
                  <tr key={t.testId}>
                    <td className="ul-asg-ellipsis">{t.testName}</td>
                    <td className="ul-asg-ellipsis">{t.seriesName}</td>
                    <td>{t.educators.length ? t.educators.map((n) => <div key={n}>{n}</div>) : "Unassigned"}</td>
                    <td>{(COMPARISON_SAMPLE[t.testName]?.attempts ?? t.attempts).toLocaleString("en-IN")}</td>
                    <td>{pct(COMPARISON_SAMPLE[t.testName]?.avgScore ?? t.avgScore)}</td>
                    <td>{t.avgTimeTakenMinutes} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
