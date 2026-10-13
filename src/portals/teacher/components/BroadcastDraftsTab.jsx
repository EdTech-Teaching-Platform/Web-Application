import { useState } from "react";
import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import { useMessaging } from "../context/MessagingContext";
import { AudienceChips, ConfirmDialog, TypePill } from "./BroadcastShared";
import { FileGenericIcon, PencilIcon, TrashIcon } from "../../../components/ui/icons";
import { audienceLabels, relativeTime, stripHtml } from "../data/messagingData";

export default function BroadcastDraftsTab({ env, onResume, onGoCompose, onToast }) {
  const { drafts, groups, deleteDraft } = useMessaging();
  const [deleteId, setDeleteId] = useState(null);
  const sorted = [...drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const labelEnv = { ...env, groups };

  if (sorted.length === 0) {
    return <EmptyState icon={FileGenericIcon} heading="No drafts" message="Unfinished messages are saved here automatically while you write." action={<Button fullWidth={false} className="px-6" onClick={onGoCompose}>Compose a message</Button>} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {sorted.map((d) => (
        <div key={d.draftId} className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <TypePill type={d.type} />
            <span className="text-xs text-muted">Edited {relativeTime(d.updatedAt)}</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{d.subject.trim() || "Untitled draft"}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted">{stripHtml(d.bodyHtml) || "No body yet."}</p>
          </div>
          <AudienceChips labels={audienceLabels(d.audience, labelEnv)} max={3} />
          <div className="mt-auto flex items-center gap-2 border-t border-text/[0.07] pt-3">
            <Button fullWidth={false} className="flex items-center gap-1.5 px-4 py-1.5 text-xs" onClick={() => onResume(d)}>
              <PencilIcon className="h-3.5 w-3.5" />
              Resume editing
            </Button>
            <Button variant="tertiary" fullWidth={false} className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 text-xs text-danger hover:bg-danger/10" onClick={() => setDeleteId(d.draftId)}>
              <TrashIcon className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
      ))}
      <ConfirmDialog
        open={Boolean(deleteId)}
        heading="Delete this draft?"
        message="This can't be undone."
        confirmLabel="Delete draft"
        onConfirm={() => { deleteDraft(deleteId); setDeleteId(null); onToast("Draft deleted."); }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
