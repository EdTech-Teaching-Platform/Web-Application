import { useMemo, useState } from "react";
import Button from "../../../components/ui/Button";
import Chip from "../../../components/ui/Chip";
import ProgressRing from "../../../components/ui/ProgressRing";
import EmptyState from "../../../components/ui/EmptyState";
import StatusBadge from "../../../components/ui/StatusBadge";
import { useMessaging } from "../context/MessagingContext";
import { Avatar, AudienceChips, ChannelIcons, SideDrawer, TypePill } from "./BroadcastShared";
import { ChevronRightIcon, DuplicateIcon, MegaphoneIcon, RepeatIcon } from "../../../components/ui/icons";
import { audienceLabels, broadcastStats, emptyCompose, formatDateTime, relativeTime, stripHtml } from "../data/messagingData";

const FILTERS = ["All", "Delivered", "Opened", "Failed"];
const STATUS_BADGE = { opened: ["success", "Opened"], delivered: ["neutral", "Delivered"], failed: ["danger", "Failed"] };

function Stat({ value, label }) {
  return (
    <div className="flex items-center gap-2.5">
      <ProgressRing value={value} size={44} stroke={5} label={`${label} ${value}%`} showValue={false} />
      <div>
        <p className="text-sm font-bold text-text">{value}%</p>
        <p className="text-[11px] text-muted">{label}</p>
      </div>
    </div>
  );
}

export function broadcastToCompose(b) {
  return {
    ...emptyCompose(),
    type: b.type,
    audience: b.audience,
    subject: b.subject,
    bodyHtml: b.bodyHtml,
    attachments: b.attachments || [],
    cta: b.cta ? { enabled: true, label: b.cta.label, link: b.cta.link } : { enabled: false, label: "", link: "" },
    channels: b.channels,
    priority: b.priority,
  };
}

export default function BroadcastSentTab({ env, onDuplicate, onGoCompose, onToast }) {
  const { sent, groups, resendToUnopened } = useMessaging();
  const [openId, setOpenId] = useState(null);
  const [filter, setFilter] = useState("All");
  const open = sent.find((b) => b.id === openId) || null;
  const labelEnv = { ...env, groups };

  const stats = useMemo(() => Object.fromEntries(sent.map((b) => [b.id, broadcastStats(b)])), [sent]);
  const openStats = open ? stats[open.id] : null;

  const rows = useMemo(() => {
    if (!open) return [];
    return open.recipients.filter((r) => {
      if (filter === "All") return true;
      if (filter === "Opened") return r.status === "opened";
      if (filter === "Failed") return r.status === "failed";
      return r.status === "delivered";
    });
  }, [open, filter]);

  if (sent.length === 0) {
    return <EmptyState icon={MegaphoneIcon} heading="Nothing sent yet" message="Broadcasts you send will show up here with delivery results." action={<Button fullWidth={false} className="px-6" onClick={onGoCompose}>Compose a message</Button>} />;
  }

  function resend() {
    const n = resendToUnopened(open.id);
    onToast(n ? `Resent to ${n} student${n === 1 ? "" : "s"} who haven't opened it.` : "Everyone has already opened this message.");
  }

  return (
    <div className="flex flex-col gap-3">
      {sent.map((b) => {
        const st = stats[b.id];
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => { setOpenId(b.id); setFilter("All"); }}
            className="flex w-full flex-col gap-4 rounded-3xl bg-white p-4 text-left shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card sm:p-5 lg:flex-row lg:items-center"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <TypePill type={b.type} />
                {b.priority === "Important" && <StatusBadge status="warning" size="sm" showIcon={false}>Important</StatusBadge>}
                <span className="text-xs text-muted">{relativeTime(b.sentAt)}</span>
              </div>
              <p className="mt-1.5 truncate text-sm font-semibold text-text">{b.subject}</p>
              <p className="mt-0.5 truncate text-xs text-muted">{stripHtml(b.bodyHtml)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <AudienceChips labels={audienceLabels(b.audience, labelEnv)} max={2} />
                <ChannelIcons channels={b.channels} />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <Stat value={st.deliveredPct} label="Delivered" />
              <Stat value={st.openedPct} label="Opened" />
              <Stat value={st.clickedPct} label="Link clicks" />
              <ChevronRightIcon className="hidden h-4 w-4 text-muted lg:block" />
            </div>
          </button>
        );
      })}

      <SideDrawer
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        title={open?.subject}
        subtitle={open ? `Sent ${formatDateTime(open.sentAt)} · ${openStats.total} recipients` : ""}
        footer={
          open && (
            <>
              <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5 px-4 py-2 text-xs" onClick={() => { onDuplicate(broadcastToCompose(open)); setOpenId(null); }}>
                <DuplicateIcon className="h-3.5 w-3.5" />
                Duplicate
              </Button>
              <Button fullWidth={false} className="flex items-center gap-1.5 px-4 py-2 text-xs" disabled={openStats.unopened + openStats.failed === 0} onClick={resend}>
                <RepeatIcon className="h-3.5 w-3.5" />
                Resend to unopened ({openStats.unopened + openStats.failed})
              </Button>
            </>
          )
        }
      >
        {open && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-3 rounded-3xl bg-white p-4 shadow-soft">
              <Stat value={openStats.deliveredPct} label="Delivered" />
              <Stat value={openStats.openedPct} label="Opened" />
              <Stat value={openStats.clickedPct} label="Link clicks" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TypePill type={open.type} />
              <ChannelIcons channels={open.channels} />
              {open.resends > 0 && <span className="text-xs text-muted">Resent {open.resends}x · {relativeTime(open.lastResendAt)}</span>}
            </div>
            <div className="rounded-2xl bg-white p-4 text-sm leading-relaxed text-text shadow-soft [&_a]:text-primary [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: open.bodyHtml }} />
            <div>
              <div className="mb-2 flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <Chip key={f} active={filter === f} onClick={() => setFilter(f)} className="px-3.5 py-1.5 text-xs">
                    {f}
                  </Chip>
                ))}
              </div>
              {rows.length === 0 ? (
                <p className="rounded-2xl bg-white p-4 text-center text-sm text-muted shadow-soft">No recipients match this filter.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-text/[0.06] rounded-3xl bg-white px-4 shadow-soft">
                  {rows.map((r) => {
                    const [tone, label] = STATUS_BADGE[r.status];
                    return (
                      <li key={r.studentId} className="flex items-center gap-3 py-2.5">
                        <Avatar name={r.name} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{r.name}</span>
                        {r.clicked && <span className="text-[11px] font-semibold text-primary">Clicked</span>}
                        <StatusBadge status={tone} size="sm" showIcon={false}>{label}</StatusBadge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </SideDrawer>
    </div>
  );
}
