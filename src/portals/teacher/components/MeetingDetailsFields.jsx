import { useState } from "react";
import Select from "../../../components/ui/Select";
import Input from "../../../components/ui/Input";
import { MEETING_PROVIDERS, validateMeetingLink } from "../data/meetingProviders";
import { InfoIcon } from "../../../components/ui/icons";

// "Meeting details" section shared by every live class form. Controlled:
// `meeting` = { provider, link, meetingId, passcode }. The link error shows
// inline once the field has been touched.
export default function MeetingDetailsFields({ meeting, onChange }) {
  const [touched, setTouched] = useState(false);
  const linkError = touched ? validateMeetingLink(meeting.link) : null;
  const set = (patch) => onChange({ ...meeting, ...patch });
  return (
    <div>
      <span className="mb-2.5 block text-sm font-medium text-text">Meeting details</span>
      <div className="flex flex-col gap-4 rounded-2xl bg-bg p-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-text">Meeting provider</span>
          <Select
            wrapperClassName="block w-full max-w-[260px]"
            value={meeting.provider}
            onChange={(e) => set({ provider: e.target.value })}
            className="w-full rounded-full border border-text/12 bg-surface px-4 py-3 pr-10 text-sm text-text"
          >
            {MEETING_PROVIDERS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </Select>
        </label>
        <Input
          label="Meeting link"
          type="url"
          inputMode="url"
          placeholder="https://zoom.us/j/123456789"
          value={meeting.link}
          onChange={(e) => set({ link: e.target.value })}
          onBlur={() => setTouched(true)}
          error={linkError}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Meeting ID (optional)" value={meeting.meetingId} onChange={(e) => set({ meetingId: e.target.value })} placeholder="123 456 7890" />
          <Input label="Passcode (optional)" value={meeting.passcode} onChange={(e) => set({ passcode: e.target.value })} placeholder="Passcode" />
        </div>
        <p className="flex items-start gap-2 text-xs text-muted">
          <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Video calling and recording are handled by your meeting provider.
        </p>
      </div>
    </div>
  );
}
