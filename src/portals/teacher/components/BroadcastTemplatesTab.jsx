import { useEffect, useRef, useState } from "react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Modal from "../../../components/ui/Modal";
import Select from "../../../components/ui/Select";
import RichTextEditor from "../../../components/ui/RichTextEditor";
import { useMessaging } from "../context/MessagingContext";
import { ConfirmDialog, TypePill } from "./BroadcastShared";
import { DuplicateIcon, PencilIcon, PlusIcon, TrashIcon, SparkleIcon } from "../../../components/ui/icons";
import { MERGE_TAGS, MESSAGE_TYPES, SUBJECT_MAX, BODY_MAX, relativeTime, stripHtml } from "../data/messagingData";

function TemplateEditor({ template, onClose, onSave }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("announcement");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [key, setKey] = useState(0);
  const wrap = useRef(null);
  const open = template !== null;

  useEffect(() => {
    if (!open) return;
    setName(template.name || "");
    setType(template.type || "announcement");
    setSubject(template.subject || "");
    setBodyHtml(template.bodyHtml || "");
    setKey((k) => k + 1);
  }, [open, template]);

  const bodyLen = stripHtml(bodyHtml).length;
  const valid = name.trim() && subject.trim() && subject.length <= SUBJECT_MAX && bodyLen > 0 && bodyLen <= BODY_MAX;

  function insertTag(tag) {
    const el = wrap.current?.querySelector("[contenteditable]");
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel.rangeCount || !el.contains(sel.anchorNode)) {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    document.execCommand("insertText", false, `{{${tag}}}`);
    setBodyHtml(el.innerHTML);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={template?.id ? "Edit template" : "New template"}
      size="lg"
      footer={
        <>
          <Button fullWidth={false} className="px-6" disabled={!valid} onClick={() => onSave({ id: template.id, name: name.trim(), type, subject: subject.trim(), bodyHtml, builtIn: template.builtIn })}>
            Save template
          </Button>
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <Input label="Template name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekly check-in" />
        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">Message type</span>
          <Select wrapperClassName="block w-full" value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-full border border-text/12 bg-surface px-4 py-3 pr-10 text-sm text-text">
            {MESSAGE_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <p className={`mt-1 text-right text-[11px] ${subject.length > SUBJECT_MAX ? "font-semibold text-danger" : "text-muted"}`}>{subject.length}/{SUBJECT_MAX}</p>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">Body</span>
          <div ref={wrap}>
            <RichTextEditor key={key} value={bodyHtml} onChange={setBodyHtml} minHeight={140} />
          </div>
          <p className={`mt-1 text-right text-[11px] ${bodyLen > BODY_MAX ? "font-semibold text-danger" : "text-muted"}`}>{bodyLen}/{BODY_MAX}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {MERGE_TAGS.map((t) => (
              <button key={t.key} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertTag(t.key)} className="rounded-full border border-primary/25 bg-primary/[0.05] px-3 py-1 font-mono text-[11px] font-semibold text-primary hover:bg-primary/10">
                {`{{${t.key}}}`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function BroadcastTemplatesTab({ onUse, onToast }) {
  const { templates, saveTemplate, duplicateTemplate, deleteTemplate } = useMessaging();
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-5 shadow-soft">
        <div>
          <div className="eyebrow mb-1">Templates</div>
          <p className="text-sm text-muted">Start from a ready-made message. Using one fills the Compose tab.</p>
        </div>
        <Button fullWidth={false} className="flex items-center gap-1.5 px-5 py-2 text-xs" onClick={() => setEditing({ id: null, name: "", type: "announcement", subject: "", bodyHtml: "" })}>
          <PlusIcon className="h-3.5 w-3.5" />
          New template
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => (
          <div key={t.id} className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <TypePill type={t.type} />
              <span className="text-[11px] text-muted">{t.builtIn ? "Prebuilt" : `Edited ${relativeTime(t.updatedAt)}`}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-text">{t.name}</p>
              <p className="mt-0.5 truncate text-xs font-medium text-text">{t.subject}</p>
              <p className="mt-1 line-clamp-3 text-xs text-muted">{stripHtml(t.bodyHtml)}</p>
            </div>
            <div className="mt-auto flex items-center gap-1 border-t border-text/[0.07] pt-3">
              <Button fullWidth={false} className="flex items-center gap-1.5 px-4 py-1.5 text-xs" onClick={() => onUse(t)}>
                <SparkleIcon className="h-3.5 w-3.5" />
                Use
              </Button>
              <button type="button" aria-label={`Edit ${t.name}`} title="Edit" onClick={() => setEditing(t)} className="ml-auto rounded-full p-1.5 text-muted hover:bg-bg hover:text-primary">
                <PencilIcon className="h-4 w-4" />
              </button>
              <button type="button" aria-label={`Duplicate ${t.name}`} title="Duplicate" onClick={() => { duplicateTemplate(t.id); onToast("Template duplicated."); }} className="rounded-full p-1.5 text-muted hover:bg-bg hover:text-primary">
                <DuplicateIcon className="h-4 w-4" />
              </button>
              <button type="button" aria-label={`Delete ${t.name}`} title="Delete" onClick={() => setDeleteId(t.id)} className="rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <TemplateEditor
        template={editing}
        onClose={() => setEditing(null)}
        onSave={(tpl) => { saveTemplate(tpl); setEditing(null); onToast("Template saved."); }}
      />
      <ConfirmDialog
        open={Boolean(deleteId)}
        heading="Delete this template?"
        message="Messages already sent from it aren't affected."
        confirmLabel="Delete template"
        onConfirm={() => { deleteTemplate(deleteId); setDeleteId(null); onToast("Template deleted."); }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
