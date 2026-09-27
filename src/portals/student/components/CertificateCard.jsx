import { DownloadIcon } from "../../../components/ui/icons";
import { CertificateIllustration } from "../../../components/ui/illustrations";
import { rotationClassFor } from "../../../components/ui/ColorBlockCard";
import { imgFallback } from "../../../utils/stockImages";

// CertificateCard — new component, proposed in the Student Dashboard build
// spec: no existing named component in design.md fits a thumbnail +
// download-action pattern (StatCard has no image, ListRow isn't a card).
// Same 16-20px radius / shadow-minimal rules as everything else, no new
// colors/tokens introduced — the thumbnail tint cycles the same rotation
// tokens as ColorBlockCard (at low opacity, so it reads as a seal rather
// than a decorative course block) instead of a blank placeholder. Kept
// inside portals/student since only the Dashboard's Certificates strip
// uses it today — promote to src/components/ui if the standalone
// Certificates page (Sec 4.9) also adopts it, per the "promote once 2+
// consumers need it" rule. Confirm the name/shape with whoever owns
// design.md before it's treated as final.
export default function CertificateCard({ thumbnail, courseName, accentIndex = 0, onView }) {
  return (
    <button
      type="button"
      onClick={onView}
      className="flex w-48 shrink-0 flex-col overflow-hidden rounded-2xl bg-white text-left transition-transform duration-150 ease-out hover:-translate-y-1"
    >
      <div className={`relative aspect-[4/3] w-full overflow-hidden ${rotationClassFor(accentIndex)}/15`}>
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            onError={(e) => imgFallback(e, courseName ?? "certificate", 300, 225)}
            className="h-full w-full object-cover"
          />
        ) : (
          <CertificateIllustration className="h-full w-full text-primary" aria-hidden="true" />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <span className="truncate text-sm font-medium text-text">{courseName}</span>
        <DownloadIcon className="shrink-0 text-primary" />
      </div>
    </button>
  );
}
