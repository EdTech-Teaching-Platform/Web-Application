import { Panel, BarRow, heatBg, HEAT_GRADIENT } from "./perfUi";

function RankList({ title, items, tone }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold text-text">{title}</h3>
      {items.length === 0 ? <p className="text-xs text-muted">Not enough data.</p> : (
        <ol className="flex flex-col gap-2">
          {items.map((t, i) => (
            <li key={t.topic} className="flex items-center gap-3 text-sm">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${tone}`}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-medium text-text" title={t.topic}>{t.topic}</span>
              <span className="font-semibold tabular-nums text-text">{t.acc}%</span>
              <span className="w-14 text-right text-xs text-muted">{t.n} resp.</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// Section averages, topic heatmap (red to green via success/danger tokens) and weakest/strongest topics.
export default function SectionTopicAnalytics({ sections, topics }) {
  const overall = sections.length ? Math.round((sections.reduce((n, s) => n + s.avg, 0) / sections.length) * 10) / 10 : 0;
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
      <div className="flex flex-col gap-6 xl:col-span-2">
        <Panel eyebrow="Sections" title="Per-section averages" subtitle="Marks earned over marks available. Gold tick = average across sections.">
          {sections.length === 0 ? <p className="text-sm text-muted">No section results in this view.</p> : (
            <div className="flex flex-col gap-3.5">
              {sections.map((s) => <BarRow key={s.id} label={s.title} value={s.avg} marker={overall} tone={s.avg < overall - 4 ? "bg-chart-6" : "bg-primary"} title={`${s.title}: ${s.avg}% average across ${s.n} results`} />)}
            </div>
          )}
        </Panel>
        <Panel eyebrow="Topics" title="Weakest and strongest topics">
          <div className="flex flex-col gap-6">
            <RankList title="Top 5 weakest" items={topics.weakest} tone="bg-pastel-pink text-pastel-pink-ink" />
            <RankList title="Top 5 strongest" items={topics.strongest} tone="bg-pastel-sage text-pastel-sage-ink" />
          </div>
        </Panel>
      </div>
      <Panel className="xl:col-span-3" eyebrow="Heatmap" title="Topic accuracy heatmap" subtitle={`Accuracy on attempted questions by topic and ${topics.columns[0] && topics.columns[0].id === "Beginner" ? "difficulty" : "test"}. Lowest topics first.`}>
        {topics.rows.length === 0 ? <p className="text-sm text-muted">No topic-tagged questions in this view.</p> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-separate border-spacing-1 text-xs">
                <thead>
                  <tr>
                    <th scope="col" className="eyebrow-muted pb-1 text-left">Topic</th>
                    {topics.columns.map((c, i) => <th key={c.id} scope="col" className="eyebrow-muted max-w-[6rem] truncate pb-1 text-center" title={c.label}>{c.id === c.label ? c.label : `T${i + 1}`}</th>)}
                    <th scope="col" className="eyebrow-muted pb-1 text-center">All</th>
                  </tr>
                </thead>
                <tbody>
                  {topics.rows.map((r) => (
                    <tr key={r.topic}>
                      <th scope="row" className="max-w-[10rem] truncate pr-2 text-left font-medium text-text" title={r.topic}>{r.topic}</th>
                      {r.cells.map((c, i) => (
                        <td key={i} title={c.acc === null ? "No responses" : `${r.topic} · ${topics.columns[i].label}: ${c.acc}% (${c.n} responses)`} className="rounded-lg px-1 py-2 text-center font-semibold tabular-nums text-text" style={{ background: heatBg(c.acc) }}>
                          {c.acc === null ? "–" : `${Math.round(c.acc)}`}
                        </td>
                      ))}
                      <td title={`${r.topic}: ${r.acc ?? "no data"}% overall`} className="rounded-lg px-1 py-2 text-center font-bold tabular-nums text-text ring-1 ring-text/10" style={{ background: heatBg(r.acc) }}>{r.acc === null ? "–" : Math.round(r.acc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center gap-3 text-[11px] font-medium text-muted">
              <span>0%</span>
              <span className="h-2.5 w-40 rounded-full ring-1 ring-text/10" style={{ background: HEAT_GRADIENT }} aria-hidden="true" />
              <span>100% accuracy</span>
              {topics.columns.length > 0 && topics.columns[0].id !== "Beginner" && <span className="ml-auto hidden sm:inline">T1 to T{topics.columns.length} follow test order</span>}
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
