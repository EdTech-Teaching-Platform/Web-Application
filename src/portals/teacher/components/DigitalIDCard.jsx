import { useMemo, useState } from "react";
import StatusBadge from "../../../components/ui/StatusBadge";
import QRCodePattern from "./QRCodePattern";

// DigitalIDCard — the credential issued to an educator the moment they
// finish Profile Setup after verification approval (Sec 5.1: "Digital ID
// Card issued once approved"). Not one of design.md's named reusable
// components (ColorBlockCard/ConfirmationCard/etc. don't cover a
// double-sided credential), so it's a purpose-built, screen-local
// component — but it still resolves every color through the shared design
// tokens (color-primary block per the "Color-block card" language, success
// token for the Verified badge) rather than any ad hoc hex.
//
// Flip interaction: click/tap or press Enter/Space to flip between the
// front (photo, name, headline, status) and back (QR verification code +
// full credential detail), a 3D `rotateY` transform only — no
// scale/opacity trickery — at 600ms ease-out, the top of design.md's
// "section reveal" motion range.
function formatDate(iso) {
  if (!iso) return "On approval";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// `profile.status`: "verified" (default — the finished, shareable card) or
// "pending" (provisional card shown while the admin is still reviewing: same
// layout, but badged "Pending Verification", no issue/expiry dates yet).
export default function DigitalIDCard({ profile, className = "", maxWidthClass = "max-w-sm" }) {
  const [flipped, setFlipped] = useState(false);
  const pending = profile.status === "pending";

  const initials = useMemo(
    () =>
      (profile.fullName || "")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join(""),
    [profile.fullName]
  );

  return (
    <div className={`mx-auto w-full ${maxWidthClass} ${className}`}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Digital ID card for ${profile.fullName}. Press to flip.`}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setFlipped((f) => !f))}
        className="group relative aspect-[10/16] w-full cursor-pointer select-none [perspective:1600px] sm:aspect-[10/15]"
      >
        <div
          className="relative h-full w-full transition-transform duration-[600ms] ease-out [transform-style:preserve-3d]"
          style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          {/* FRONT */}
          <div className="absolute inset-0 flex flex-col overflow-hidden rounded-[20px] bg-primary text-white [backface-visibility:hidden]">
            <div className="flex items-center justify-between px-6 pt-6">
              <span className="font-display text-sm tracking-tight">Universal Learning</span>
              <StatusBadge
                status={pending ? "warning" : "success"}
                className="bg-white/15 text-white [&>svg]:text-white"
              >
                {pending ? "Pending Verification" : "Verified"}
              </StatusBadge>
            </div>

            <div className="mt-6 flex flex-1 flex-col items-center px-6 text-center">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-white/15 text-2xl font-semibold ring-4 ring-white/25">
                {profile.photoUrl ? (
                  <img src={profile.photoUrl} alt={profile.fullName} className="h-full w-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <h3 className="mt-4 font-display text-xl">{profile.fullName}</h3>
              <p className="mt-1 text-sm text-white/70">{profile.headline}</p>

              {profile.subjects?.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                  {profile.subjects.slice(0, 3).map((s) => (
                    <span key={s} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-white/15 px-6 py-4">
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/50">
                  Educator ID
                </span>
                <span className="font-mono text-xs tracking-wide">{profile.educatorId}</span>
              </div>
              <span className="text-[11px] font-medium text-white/50">Tap to flip</span>
            </div>
          </div>

          {/* BACK */}
          <div
            className="absolute inset-0 flex flex-col overflow-hidden rounded-[20px] border border-text/10 bg-white text-text [backface-visibility:hidden]"
            style={{ transform: "rotateY(180deg)" }}
          >
            <div className="flex items-center justify-between px-6 pt-6">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Educator Credential
              </span>
              <StatusBadge status={pending ? "warning" : "success"}>{pending ? "Pending" : "Valid"}</StatusBadge>
            </div>

            <div className="flex flex-col items-center px-6 pt-5">
              <div className="rounded-xl bg-bg p-2 ring-1 ring-text/10">
                <QRCodePattern seed={profile.educatorId} className={`h-32 w-32 text-text ${pending ? "opacity-30 blur-[1px]" : ""}`} />
              </div>
              <span className="mt-2 text-[11px] text-muted">
                {pending ? "QR becomes scannable once verified" : "Scan to verify this educator"}
              </span>
            </div>

            <dl className="mt-5 grid flex-1 grid-cols-2 gap-x-4 gap-y-4 border-t border-text/10 px-6 py-5 text-sm">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">ID No.</dt>
                <dd className="mt-0.5 font-mono text-xs text-text">{profile.educatorId}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">City</dt>
                <dd className="mt-0.5 text-text">{profile.city || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Issued</dt>
                <dd className="mt-0.5 text-text">{formatDate(profile.issueDate)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Expires</dt>
                <dd className="mt-0.5 text-text">{formatDate(profile.expiryDate)}</dd>
              </div>
            </dl>

            <p className="border-t border-text/10 px-6 py-4 text-center text-[11px] leading-relaxed text-muted">
              {pending
                ? `This is a provisional card for ${profile.fullName}. It becomes a verified, shareable credential once our team approves the profile.`
                : `This card confirms ${profile.fullName} completed Universal Learning's educator identity & credential verification.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
