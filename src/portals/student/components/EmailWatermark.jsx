// EmailWatermark — a faint, non-interactive overlay that repeats the signed-in
// student's email across the whole test screen (the way proctored exams stamp
// the candidate's identity on every page), plus a few larger marks at fixed
// spots. Purely visual: pointer-events are off, so it never blocks answering,
// scrolling, selection handlers or any button underneath.
import { useMemo } from "react";
import { useAuth } from "../../../hooks/useAuth";

const escapeXml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function tileUrl(text) {
  const w = Math.max(260, Math.round(text.length * 8.6) + 80);
  const h = 150;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="middle" ` +
    `transform="rotate(-24 ${w / 2} ${h / 2})" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="600" ` +
    `fill="#0f1115" fill-opacity="0.085">${escapeXml(text)}</text></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

const MARK = "absolute select-none whitespace-nowrap font-display font-bold text-(--lp-ink)/[0.07]";

export default function EmailWatermark() {
  const { user } = useAuth();
  const email = user?.email?.trim();
  const background = useMemo(() => (email ? tileUrl(email) : null), [email]);
  if (!email) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden select-none" aria-hidden="true">
      <div className="absolute inset-0" style={{ backgroundImage: background, backgroundRepeat: "repeat" }} />
      <span className={`${MARK} left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] text-3xl sm:text-5xl`}>{email}</span>
      <span className={`${MARK} left-4 top-24 -rotate-[24deg] text-lg sm:text-2xl`}>{email}</span>
      <span className={`${MARK} bottom-24 right-4 -rotate-[24deg] text-lg sm:text-2xl`}>{email}</span>
      <span className={`${MARK} bottom-6 left-6 text-sm`}>{email}</span>
      <span className={`${MARK} right-6 top-20 text-sm`}>{email}</span>
    </div>
  );
}
