// Digital ID Card section for the educator dashboard: the same card, status and
// Download / Share actions as the Digital ID Card screen (pages/ProfileSetup.jsx),
// in a compact panel. Nothing new is fetched; it reads the signed-in educator's
// account like that screen does.
import { useState } from "react";
import { NavLink } from "react-router-dom";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import { ChevronRightIcon, InfoIcon, UploadIcon } from "../../../components/ui/icons";
import DigitalIDCard from "./DigitalIDCard";
import IDCardShareModal from "./IDCardShareModal";
import { useCurrentEducator, toIdCardProfile, EDUCATOR_STATUS, EDUCATOR_STATUS_META } from "../data/educatorAccountStore";

export default function DashboardIdCard({ delay = 0 }) {
  const account = useCurrentEducator();
  const [shareOpen, setShareOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  if (!account) return null;

  const profile = toIdCardProfile(account);
  const verified = account.status === EDUCATOR_STATUS.APPROVED;
  const meta = EDUCATOR_STATUS_META[account.status];

  const handleDownload = () => {
    setDownloading(true);
    // Same placeholder as the Digital ID Card screen until the backend renders the asset.
    setTimeout(() => setDownloading(false), 900);
  };

  return (
    <section
      style={{ animationDelay: `${delay}ms` }}
      className="motion-safe:animate-[rise-in_0.5s_ease-out_both] rounded-3xl bg-white p-5 shadow-soft"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow-muted">Credential</div>
          <h2 className="text-xl font-bold text-text">Digital ID Card</h2>
        </div>
        <StatusBadge status={meta.badgeStatus}>{verified ? "Profile live" : meta.label}</StatusBadge>
      </div>

      <div className="flex justify-center">
        <DigitalIDCard profile={profile} maxWidthClass="max-w-[260px]" />
      </div>

      {verified ? (
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Button shape="rect" fullWidth={false} onClick={handleDownload} disabled={downloading} className="flex items-center justify-center gap-2 px-5 text-sm">
            <UploadIcon className="h-4 w-4 rotate-180" />
            {downloading ? "Preparing…" : "Download"}
          </Button>
          <Button shape="rect" fullWidth={false} variant="secondary" className="px-5 text-sm" onClick={() => setShareOpen(true)}>
            Share
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-pastel-blue px-4 py-3 text-xs text-pastel-blue-ink">
          <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Download and Share unlock after verification.</span>
        </div>
      )}

      <NavLink to="/teacher/profilesetup" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary transition-opacity hover:opacity-70">
        View full profile
        <ChevronRightIcon className="h-4 w-4" />
      </NavLink>

      {verified && <IDCardShareModal open={shareOpen} onClose={() => setShareOpen(false)} profile={profile} />}
    </section>
  );
}
