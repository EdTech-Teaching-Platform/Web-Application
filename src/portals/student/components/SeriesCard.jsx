import ColorBlockCard, { rotationClassFor } from "../../../components/ui/ColorBlockCard";
import { formatMinutes } from "../utils/format";

// A test series on the shared ColorBlockCard (design.md: one card component).
// `series` is the card shape from docs/STUDENT_RPC_CONTRACT.md. Covers are
// the rotation colour block (cover_path is a storage path, not a public URL).
const COVERS = [0, 1, 2, 3].map((i) => {
  function Cover({ className }) {
    return <div className={`${rotationClassFor(i)} ${className ?? ""}`} aria-hidden="true" />;
  }
  return Cover;
});

export default function SeriesCard({ series, index = 0, onOpen, actionLabel, onAction, actionDisabled, progress, onResume }) {
  const meta = [
    `${series.tests_count ?? 0} ${series.tests_count === 1 ? "test" : "tests"}`,
    series.total_duration_mins ? formatMinutes(series.total_duration_mins) : null,
    series.level,
  ].filter(Boolean).join(" · ");
  return (
    <ColorBlockCard
      rotationIndex={index}
      fullWidth
      illustration={COVERS[index % COVERS.length]}
      badge={series.exam || series.subject || undefined}
      title={series.title}
      subtitle={series.subject || undefined}
      meta={meta}
      description={series.description || undefined}
      price={progress === undefined ? (series.is_free ? 0 : Number(series.price_inr)) : undefined}
      progress={progress}
      resumeLabel="Open"
      onResume={onResume}
      actionLabel={actionLabel}
      onAction={onAction}
      actionDisabled={actionDisabled}
      onClick={onOpen}
    />
  );
}
