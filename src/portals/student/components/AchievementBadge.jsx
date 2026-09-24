// AchievementBadge grid — new component, MINUTO-reference-inspired
// (their 4-item achievement badge grid). Not in the LMS doc's Section 15
// feature list at all — a gamification enrichment beyond what's
// documented, added only because the visual reference calls for it and
// the user chose to match its density. Flag for whoever owns the backend
// scope: there is no "achievements" entity/endpoint anywhere in the doc,
// so this stays fully mock/illustrative (locked vs unlocked by a client
// boolean) until a real feature spec exists — treat as decorative, not a
// commitment to ship an achievements system. Uses AwardIcon + the
// existing rotation tokens (locked = 15%-opacity/gray, unlocked = full
// rotation color) — no new colors.
import { AwardIcon } from "../../../components/ui/icons";
import { rotationClassFor } from "../../../components/ui/ColorBlockCard";

export default function AchievementBadge({ label, unlocked, rotationIndex = 0 }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4 text-center">
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full text-white ${
          unlocked ? rotationClassFor(rotationIndex) : "bg-text/10 text-text/30"
        }`}
      >
        <AwardIcon />
      </span>
      <span className={`text-xs font-medium ${unlocked ? "text-text" : "text-text/40"}`}>{label}</span>
    </div>
  );
}
