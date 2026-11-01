// Series banners and question figures for the student pages (stored
// test-assets paths, through assetUrl). Nothing renders when there is no
// image or it fails to load: no broken-image icons.
import AssetImage from "../../../components/common/AssetImage";

export function SeriesBanner({ path, className = "" }) {
  if (!path) return null;
  return <AssetImage path={path} alt="" fallback={null} className={`aspect-[16/5] w-full rounded-3xl object-cover ${className}`} />;
}

export function SeriesThumb({ path }) {
  if (!path) return null;
  return <AssetImage path={path} alt="" fallback={null} className="h-8 w-14 shrink-0 rounded-lg object-cover" />;
}

export function QuestionFigure({ path, alt, position }) {
  if (!path) return null;
  return (
    <AssetImage path={path} alt={alt || (position ? `Figure for question ${position}` : "Question figure")} fallback={null}
      className="mt-3 block max-h-80 w-auto max-w-full rounded-2xl bg-white object-contain ring-1 ring-text/10" />
  );
}
