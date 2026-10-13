import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRegionHead } from "../hooks/useRegionHead";
import { fmtDateTime, timeAgo } from "../../admin/data/regionalPortalMock";
import { IconUsers, IconGraduationCap, IconChart, IconCheck } from "../../admin/components/icons";
import "../../admin/pages/AdminDashboard.css";
import "../../admin/pages/EducatorVerification.css";

const BANDS = [
  { label: "0 – 25%", test: (p) => p <= 25 },
  { label: "26 – 50%", test: (p) => p > 25 && p <= 50 },
  { label: "51 – 75%", test: (p) => p > 50 && p <= 75 },
  { label: "76 – 100%", test: (p) => p > 75 },
];

const svg = (children) => function Icon({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
};
const IconUserPlus = svg(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" /><path d="M19 8v6M16 11h6" /></>);
const IconClock = svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
const IconWarn = svg(<><path d="M12 3.5 2.8 19.5h18.4L12 3.5z" /><path d="M12 10v4.5M12 17.2v.1" /></>);
const IconUpload = svg(<><path d="M12 16V5M7.5 9.5 12 5l4.5 4.5" /><path d="M4 15v4h16v-4" /></>);
const IconChevron = svg(<path d="m9 6 6 6-6 6" />);
const IconInbox = svg(<><path d="M3.5 13 6 5.5h12L20.5 13v5.5h-17V13z" /><path d="M3.5 13h5l1.2 2.5h4.6L15.5 13h5" /></>);
const IconDoc = svg(<><path d="M6 3.5h8l4 4V20.5H6z" /><path d="M14 3.5v4h4M9 12h6M9 15.5h6" /></>);
const IconChat = svg(<path d="M4 5.5h16v11H9.5L5 20v-3.5H4z" />);

const initials = (name) => String(name).split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export default function RHDashboard() {
  const { head, region, data } = useRegionHead();
  const navigate = useNavigate();
  const { students, teachers, queries, escalations, activity } = data;

  const s = useMemo(() => {
    const onboarded = students.filter((x) => x.onboardedByHead);
    const active = students.filter((x) => !x.blocked && !x.inactive);
    const openQ = queries.filter((q) => q.status === "open").length;
    const escPending = escalations.filter((e) => e.status === "pending" || e.status === "in_review").length;
    const avg = students.length ? Math.round(students.reduce((n, x) => n + x.progress, 0) / students.length) : 0;
    const month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const inMonth = (x) => x.onboardedAt && new Date(`${x.onboardedAt}T00:00:00`) >= month;
    return {
      onboarded: onboarded.length + teachers.length,
      thisMonth: onboarded.filter(inMonth).length + teachers.filter(inMonth).length,
      total: students.length, active: active.length,
      tTotal: teachers.length, tActive: teachers.filter((t) => !t.attention).length,
      openQ, escPending, avg, resolved: queries.filter((q) => q.status === "resolved").length,
    };
  }, [students, teachers, queries, escalations]);

  const feed = useMemo(() => {
    const onboard = [...students.filter((x) => x.onboardedByHead), ...teachers].filter((x) => x.onboardedAt).map((x) => ({
      id: `o-${x.id}`, at: new Date(`${x.onboardedAt}T12:00:00`).toISOString(), text: `${x.name} onboarded`, kind: "onboarding",
    }));
    return [...activity.map((a) => ({ id: a.id, at: a.at, text: a.text, kind: a.kind })), ...onboard]
      .sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8);
  }, [students, teachers, activity]);

  const attention = queries.filter((q) => q.status === "open").slice(0, 5);

  const stats = [
    { tone: "pink", Icon: IconUsers, label: "Onboarded", sub: "(students + teachers)", value: s.onboarded, hint: `${s.thisMonth} this month` },
    { tone: "blue", Icon: IconUsers, label: "Students in region", value: s.total, hint: `All students linked to ${region}` },
    { tone: "green", Icon: IconCheck, label: "Active students", value: s.active, hint: "Not blocked, active in last 14 days" },
    { tone: "purple", Icon: IconGraduationCap, label: "Teachers in region", value: s.tTotal, hint: `${s.tActive} active` },
    { tone: "amber", Icon: IconDoc, label: "Pending cases", value: s.openQ + s.escPending, hint: `${s.openQ} open · ${s.escPending} with Admin` },
    { tone: "red", Icon: IconChart, label: "Avg. progress", value: `${s.avg}%`, hint: "Across enrolled courses" },
    { tone: "indigo", Icon: IconChat, label: "Resolved queries", value: s.resolved, hint: "In your resolution history" },
  ];

  return (
    <div className="ul-rhp-dash">
      <div className="ul-rhp-dash__head">
        <h2>Welcome, {head.name}</h2>
        <p>Here&apos;s an overview of your region&apos;s activity.</p>
      </div>

      <div className="ul-rhp-dstats">
        {stats.map((c) => (
          <div key={c.label} className={`ul-rhp-dstat is-${c.tone}`}>
            <div className="ul-rhp-dstat__top">
              <span className="ul-rhp-dstat__icon"><c.Icon size={18} /></span>
              <span className="ul-rhp-dstat__label">{c.label}{c.sub && <small>{c.sub}</small>}</span>
            </div>
            <strong>{c.value}</strong>
            <small>{c.hint}</small>
          </div>
        ))}
      </div>

      <div className="ul-rhp-dgrid">
        <div className="ul-rhp-dcol">
        <section className="ul-rhp-dpanel">
          <h3><span className="ul-rhp-dpanel__icon"><IconChart size={18} /></span>Progress summary</h3>
          {students.length === 0 && <p>No students in this region yet.</p>}
          {BANDS.map((b) => {
            const n = students.filter((x) => b.test(x.progress)).length;
            const pct = students.length ? Math.round((n / students.length) * 100) : 0;
            return (
              <div className="ul-rhp-drow" key={b.label}>
                <span>{b.label}</span>
                <div className="ul-rhp-track"><div className="ul-rhp-fill" style={{ width: `${pct}%` }} /></div>
                <strong>{n}</strong>
              </div>
            );
          })}
          <Link className="ul-rhp-dlink" to="/regionalhead/progress">Open Student Progress <span aria-hidden="true">→</span></Link>
        </section>

        <section className="ul-rhp-dpanel">
          <h3><span className="ul-rhp-dpanel__icon"><IconWarn size={18} /></span>Needs your attention</h3>
          {attention.length === 0 ? <p>No open queries. Nice work.</p> : (
            <ul className="ul-rhp-dfeed is-rows">
              {attention.map((q) => (
                <li key={q.id} className="is-click" onClick={() => navigate("/regionalhead/queries")}>
                  <span className="ul-rhp-dfeed__avatar">{initials(q.studentName)}</span>
                  <span className="ul-rhp-dfeed__text">{q.studentName} — {q.subject}</span>
                  <small>{timeAgo(q.createdAt)}</small>
                  <IconChevron size={14} />
                </li>
              ))}
            </ul>
          )}
          <Link className="ul-rhp-dlink" to="/regionalhead/queries">Open Query Resolution <span aria-hidden="true">→</span></Link>
        </section>

        </div>
        <div className="ul-rhp-dcol">
        <section className="ul-rhp-dpanel">
          <h3><span className="ul-rhp-dpanel__icon"><IconClock size={18} /></span>Recent activity</h3>
          {feed.length === 0 ? <p>No activity yet.</p> : (
            <ul className="ul-rhp-dfeed">
              {feed.map((f) => (
                <li key={f.id} title={fmtDateTime(f.at)}>
                  <span className={`ul-rhp-dfeed__dot${f.kind === "onboarding" ? " is-blue" : " is-green"}`}>
                    {f.kind === "onboarding" ? <IconUserPlus size={14} /> : <IconCheck size={14} />}
                  </span>
                  <span className="ul-rhp-dfeed__text">{f.text}</span>
                  <small>{timeAgo(f.at)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ul-rhp-dpanel">
          <h3><span className="ul-rhp-dpanel__icon"><IconUpload size={18} /></span>Escalations to Admin</h3>
          {escalations.length === 0 ? (
            <div className="ul-rhp-dempty">
              <span className="ul-rhp-dempty__icon"><IconInbox size={30} /></span>
              <strong>You have not escalated anything yet.</strong>
              <small>Escalate unresolved or high-priority issues to the Admin team.</small>
            </div>
          ) : (
            <ul className="ul-rhp-dfeed is-rows">
              {escalations.slice(0, 5).map((e) => (
                <li key={e.id} className="is-click" onClick={() => navigate("/regionalhead/queries?tab=escalations")}>
                  <span className="ul-rhp-dfeed__avatar">{initials(e.studentName)}</span>
                  <span className="ul-rhp-dfeed__text">{e.studentName} — {e.status.replace("_", " ")}</span>
                  <small>{timeAgo(e.updatedAt)}</small>
                  <IconChevron size={14} />
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>
      </div>
    </div>
  );
}
