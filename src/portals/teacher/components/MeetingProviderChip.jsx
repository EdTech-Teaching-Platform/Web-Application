import { providerMeta } from "../data/meetingProviders";
import { VideoIcon } from "../../../components/ui/icons";

// Provider-coloured pill (pastel tokens) shown on session cards and details.
export default function MeetingProviderChip({ provider, className = "" }) {
  if (!provider) return null;
  const meta = providerMeta(provider);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.chip} ${className}`}>
      <VideoIcon className="h-2.5 w-2.5" />
      {meta.label}
    </span>
  );
}
