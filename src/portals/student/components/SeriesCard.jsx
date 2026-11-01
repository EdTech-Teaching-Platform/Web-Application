import { useMemo } from "react";
import ColorBlockCard, { rotationClassFor } from "../../../components/ui/ColorBlockCard";
import AssetImage from "../../../components/common/AssetImage";
import { formatMinutes } from "../utils/format";

// A test series on the shared ColorBlockCard (design.md: one card component).
// `series` is the card shape from docs/STUDENT_RPC_CONTRACT.md. The cover is
// the series banner (cover_path, a test-assets path, through assetUrl), or
// the rotation colour block when there is none or it fails to load.
const COVERS = [0, 1, 2, 3].map((i) => {
  function Cover({ className }) {
    return <div className={`${rotationClassFor(i)} ${className ?? ""}`} aria-hidden="true" />;
  }
  return Cover;
});

function bannerCover(path, index) {
  const Block = COVERS[index % COVERS.length];
  function BannerCover({ className }) {
    return <AssetImage path={path} alt="" className={`object-cover ${className ?? ""}`} fallback={<Block className={className} />} />;
  }
  return BannerCover;
}

export default function SeriesCard({ series, index = 0, onOpen, actionLabel, onAction, actionDisabled, progress, onResume }) {
  const cover = series.cover_path;
  const Illustration = useMemo(() => (cover ? bannerCover(cover, index) : COVERS[index % COVERS.length]), [cover, index]);
  const meta = [
    `${series.tests_count ?? 0} ${series.tests_count === 1 ? "test" : "tests"}`,
    series.total_duration_mins ? formatMinutes(series.total_duration_mins) : null,
    series.level,
  ].filter(Boolean).join(" · ");
  return (
    <ColorBlockCard
      rotationIndex={index}
      fullWidth
      illustration={Illustration}
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
