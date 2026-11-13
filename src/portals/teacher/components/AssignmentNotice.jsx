import { BellIcon, XIcon } from "../../../components/ui/icons";

// Popup for the educator's newest unread assignment message ("New test
// assignment", "Deadline updated", "Assignment cancelled"…), QA 13 Nov.
// "View assignment" and "Dismiss" both mark it read on the server, so it is
// shown once, not at every sign-in.
export default function AssignmentNotice({ notifications, onView, onDismiss }) {
  const unread = (notifications || []).filter((n) => !n.isRead);
  const notice = unread[0];
  if (!notice) return null;
  const more = unread.length - 1;
  const canOpen = notice.type !== "cancelled" && notice.assignmentId;
  return (
    <div role="status" aria-live="polite"
      className="fixed inset-x-3 bottom-6 z-50 mx-auto max-w-md rounded-2xl bg-white p-4 text-[#101828] shadow-[0_18px_48px_-18px_rgba(15,17,21,0.45)] ring-1 ring-[#e4e7ec] md:inset-x-auto md:right-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] text-[#1d4ed8]" aria-hidden="true">
          <BellIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{notice.title}</p>
          {notice.message && <p className="mt-1 line-clamp-3 text-sm text-[#475467]">{notice.message}</p>}
          {more > 0 && <p className="mt-1 text-xs text-[#667085]">+{more} more about your assignments</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="rounded-full bg-[#101828] px-4 py-2 text-xs font-semibold text-white" onClick={() => onView(notice)}>
              {canOpen ? "View assignment" : "Open Assigned"}
            </button>
          </div>
        </div>
        <button type="button" aria-label="Dismiss" className="rounded-full p-1.5 text-[#667085] hover:bg-[#f2f4f7]" onClick={() => onDismiss(notice)}>
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
