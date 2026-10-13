import { useEffect, useMemo, useState } from "react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Modal from "../../../components/ui/Modal";
import Select from "../../../components/ui/Select";
import Checkbox from "../../../components/ui/Checkbox";
import EmptyState from "../../../components/ui/EmptyState";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import { ICON_TONES } from "../../../components/ui/IconBadge";
import { useMessaging } from "../context/MessagingContext";
import { Avatar, ConfirmDialog } from "./BroadcastShared";
import { MegaphoneIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon, UsersIcon } from "../../../components/ui/icons";
import { GROUP_TONES, SMART_RULES, groupMembers, relativeTime } from "../data/messagingData";

const KIND_LABELS = { manual: "Pick members", smart: "Smart rule" };

function GroupEditor({ group, pool, onClose, onSave }) {
  const open = group !== null;
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState("manual");
  const [rule, setRule] = useState(SMART_RULES[0].key);
  const [members, setMembers] = useState([]);
  const [query, setQuery] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(group.name || "");
    setColor(group.color || "blue");
    setDescription(group.description || "");
    setKind(group.kind || "manual");
    setRule(group.rule || SMART_RULES[0].key);
    setMembers(group.memberIds || []);
    setQuery("");
    setTouched(false);
  }, [open, group]);

  const filtered = useMemo(() => pool.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())), [pool, query]);
  const smartCount = useMemo(() => groupMembers({ kind: "smart", rule }, pool).length, [rule, pool]);
  const nameError = touched && !name.trim() ? "Give the group a name." : "";
  const memberError = kind === "manual" && members.length === 0 ? "Pick at least one student." : "";
  const valid = name.trim() && !memberError;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={group?.id ? "Edit group" : "New group"}
      size="lg"
      footer={
        <>
          <Button
            fullWidth={false}
            className="px-6"
            disabled={!valid}
            onClick={() => onSave({ id: group.id, name: name.trim(), color, description: description.trim(), kind, rule: kind === "smart" ? rule : "", memberIds: kind === "manual" ? members : [], lastUsedAt: group.lastUsedAt || null })}
          >
            Save group
          </Button>
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <Input label="Group name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} error={nameError} placeholder="e.g. Portfolio review circle" />
        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">Colour</span>
          <div className="flex flex-wrap gap-2">
            {GROUP_TONES.map((t) => (
              <button
                key={t}
                type="button"
                aria-label={t}
                aria-pressed={color === t}
                onClick={() => setColor(t)}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-150 ${ICON_TONES[t]} ${color === t ? "ring-2 ring-primary ring-offset-2" : "hover:-translate-y-0.5"}`}
              >
                <UsersIcon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value.slice(0, 140))} placeholder="What is this group for?" />
        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">Membership</span>
          <SegmentedControl options={Object.values(KIND_LABELS)} value={KIND_LABELS[kind]} onChange={(l) => setKind(l === KIND_LABELS.smart ? "smart" : "manual")} />
        </div>

        {kind === "smart" ? (
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Rule</span>
            <Select wrapperClassName="block w-full" value={rule} onChange={(e) => setRule(e.target.value)} className="w-full rounded-full border border-text/12 bg-surface px-4 py-3 pr-10 text-sm text-text">
              {SMART_RULES.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </Select>
            <p className="mt-2 text-xs text-muted">Matches <span className="font-semibold text-text">{smartCount}</span> student{smartCount === 1 ? "" : "s"} right now. Membership updates automatically.</p>
          </div>
        ) : (
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-text">Members <span className="text-muted">({members.length} selected)</span></span>
              <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                <button type="button" onClick={() => setMembers(Array.from(new Set([...members, ...filtered.map((p) => p.id)])))} className="rounded-full px-2.5 py-1 hover:bg-primary/[0.07]">Select shown</button>
                <button type="button" onClick={() => setMembers([])} className="rounded-full px-2.5 py-1 hover:bg-primary/[0.07]">Clear</button>
              </div>
            </div>
            <div className="relative mb-2">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search students…" className="w-full rounded-full border border-text/12 bg-surface py-2.5 pl-10 pr-4 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15" />
            </div>
            <div className="max-h-56 overflow-y-auto rounded-2xl border border-text/10 bg-white p-1.5">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted">No students match "{query}".</p>
              ) : (
                filtered.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-bg">
                    <Checkbox
                      className="min-w-0 flex-1 items-center"
                      checked={members.includes(p.id)}
                      onChange={() => setMembers((prev) => (prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]))}
                      label={
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Avatar name={p.name} size="xs" />
                          <span className="min-w-0 flex-1 truncate text-sm text-text">{p.name}</span>
                        </span>
                      }
                    />
                    <span className="hidden shrink-0 text-[11px] text-muted sm:inline">{p.primaryCourseTitle}</span>
                  </div>
                ))
              )}
            </div>
            {memberError && <p role="alert" className="mt-1.5 text-xs font-medium text-danger">{memberError}</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function BroadcastGroupsTab({ env, onSendToGroup, onToast }) {
  const { groups, saveGroup, deleteGroup } = useMessaging();
  const { pool } = env;
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-5 shadow-soft">
        <div>
          <div className="eyebrow mb-1">Groups</div>
          <p className="text-sm text-muted">Named sets of students you message often. Smart groups update themselves.</p>
        </div>
        <Button fullWidth={false} className="flex items-center gap-1.5 px-5 py-2 text-xs" onClick={() => setEditing({ id: null, name: "", color: "blue", description: "", kind: "manual", rule: "", memberIds: [] })}>
          <PlusIcon className="h-3.5 w-3.5" />
          New group
        </Button>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={UsersIcon} heading="No groups yet" message="Create a group to message the same set of students again and again." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => {
            const count = groupMembers(g, pool).length;
            const rule = SMART_RULES.find((r) => r.key === g.rule);
            return (
              <div key={g.id} className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-soft">
                <div className="flex items-start gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${ICON_TONES[g.color] || ICON_TONES.blue}`}>
                    <UsersIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-text">{g.name}</p>
                    <p className="mt-0.5 text-xs text-muted">{g.kind === "smart" ? `Smart · ${rule?.label || "rule"}` : "Manual group"}</p>
                  </div>
                </div>
                {g.description && <p className="line-clamp-2 text-xs text-muted">{g.description}</p>}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-text">{count} member{count === 1 ? "" : "s"}</span>
                  <span className="text-muted">{g.lastUsedAt ? `Last used ${relativeTime(g.lastUsedAt)}` : "Never used"}</span>
                </div>
                <div className="mt-auto flex items-center gap-1 border-t border-text/[0.07] pt-3">
                  <Button fullWidth={false} className="flex items-center gap-1.5 px-4 py-1.5 text-xs" disabled={count === 0} onClick={() => onSendToGroup(g)}>
                    <MegaphoneIcon className="h-3.5 w-3.5" />
                    Message group
                  </Button>
                  <button type="button" aria-label={`Edit ${g.name}`} title="Edit" onClick={() => setEditing(g)} className="ml-auto rounded-full p-1.5 text-muted hover:bg-bg hover:text-primary">
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label={`Delete ${g.name}`} title="Delete" onClick={() => setDeleteId(g.id)} className="rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <GroupEditor group={editing} pool={pool} onClose={() => setEditing(null)} onSave={(g) => { saveGroup(g); setEditing(null); onToast("Group saved."); }} />
      <ConfirmDialog
        open={Boolean(deleteId)}
        heading="Delete this group?"
        message="Students stay enrolled. Past broadcasts sent to the group aren't affected."
        confirmLabel="Delete group"
        onConfirm={() => { deleteGroup(deleteId); setDeleteId(null); onToast("Group deleted."); }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
