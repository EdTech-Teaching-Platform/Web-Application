import Button from "../../../../components/ui/Button";
import EmptyState from "../../../../components/ui/EmptyState";
import { SparkleIcon, AlertTriangleIcon, InfoIcon, CheckIcon, MegaphoneIcon, ArrowRightIcon } from "../../../../components/ui/icons";
import { Panel } from "./perfUi";

const TONES = {
  danger: { wrap: "bg-pastel-pink", ink: "text-pastel-pink-ink", Icon: AlertTriangleIcon },
  warning: { wrap: "bg-pastel-orange", ink: "text-pastel-orange-ink", Icon: AlertTriangleIcon },
  info: { wrap: "bg-pastel-blue", ink: "text-pastel-blue-ink", Icon: InfoIcon },
  success: { wrap: "bg-pastel-sage", ink: "text-pastel-sage-ink", Icon: CheckIcon },
};

// Auto-generated plain-language insights, each with a real action.
export default function InsightsPanel({ insights, onAction, rosterKeys }) {
  return (
    <Panel id="perf-insights" eyebrow="Insights" title="What to do next" subtitle="Generated from the data in view. Announcements open pre-filled in Announcements.">
      {insights.length === 0 ? <EmptyState icon={SparkleIcon} heading="No insights yet" message="Insights appear once students have submitted attempts." /> : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {insights.map((it) => {
            const t = TONES[it.tone] || TONES.info;
            const announce = it.action.kind === "announce";
            const reach = announce ? it.action.keys.filter((k) => rosterKeys.has(k)).length : 0;
            return (
              <li key={it.id} className={`flex flex-col justify-between gap-4 rounded-3xl p-5 ${t.wrap}`}>
                <div className="flex items-start gap-3">
                  <t.Icon className={`mt-0.5 h-5 w-5 shrink-0 ${t.ink}`} />
                  <p className={`text-sm font-medium ${t.ink}`}>{it.text}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="secondary" fullWidth={false} className="px-4 py-2 text-xs" disabled={announce && reach === 0} title={announce && reach === 0 ? "None of these students are on a course roster yet" : undefined} onClick={() => onAction(it.action)}>
                    {announce ? <MegaphoneIcon className="h-3.5 w-3.5" /> : <ArrowRightIcon className="h-3.5 w-3.5" />}
                    {it.action.label}
                  </Button>
                  {announce && <span className={`text-xs ${t.ink}`}>{reach} of {it.action.keys.length} on your roster</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
