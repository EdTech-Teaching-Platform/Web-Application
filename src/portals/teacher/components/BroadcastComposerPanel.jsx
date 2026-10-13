import { useEffect, useMemo, useRef, useState } from "react";
import Button from "../../../components/ui/Button";
import Chip from "../../../components/ui/Chip";
import Switch from "../../../components/ui/Switch";
import Select from "../../../components/ui/Select";
import Input from "../../../components/ui/Input";
import Modal from "../../../components/ui/Modal";
import Checkbox from "../../../components/ui/Checkbox";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import RichTextEditor from "../../../components/ui/RichTextEditor";
import FileDropzone from "../../../components/ui/FileDropzone";
import AutoSaveIndicator from "../../../components/ui/AutoSaveIndicator";
import ConfirmationCard from "../../../components/ui/ConfirmationCard";
import { useMessaging } from "../context/MessagingContext";
import BroadcastAudienceBuilder from "./BroadcastAudienceBuilder";
import { AudienceChips, ChannelIcons, SectionCard, TypePill, CHANNEL_ICONS } from "./BroadcastShared";
import { AlertTriangleIcon, CheckIcon, FileGenericIcon, SendIcon, ArrowRightIcon } from "../../../components/ui/icons";
import {
  ATTACHMENT_EXTENSIONS,
  BODY_MAX,
  CHANNELS,
  LARGE_AUDIENCE,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MERGE_TAGS,
  MESSAGE_TYPES,
  PRIORITIES,
  SUBJECT_MAX,
  audienceLabels,
  composeIsBlank,
  countdownLabel,
  estimateDelivery,
  excludeLabels,
  formatDateTime,
  formatSize,
  nowMs,
  relativeTime,
  renderMergeTags,
  resolveAudience,
  sampleValues,
  stripHtml,
  timezoneLabel,
  unresolvedTags,
} from "../data/messagingData";

const DELIVERY_OPTIONS = { now: "Send now", later: "Schedule later", recurring: "Recurring reminder" };
const MODE_BY_LABEL = { "Send now": "now", "Schedule later": "later", "Recurring reminder": "recurring" };

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function scheduledIso(delivery) {
  if (!delivery.date || !delivery.time) return null;
  const d = new Date(`${delivery.date}T${delivery.time}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function ctaOptions(courses, seriesList) {
  return [
    { group: "Courses", items: courses.map((c) => ({ value: `/teacher/coursemanagement/${c.id}`, label: c.title })) },
    { group: "Live classes", items: [{ value: "/teacher/liveclasses", label: "Live classes" }] },
    { group: "Test series", items: seriesList.map((s) => ({ value: `/teacher/testseries/${s.id}`, label: s.title })) },
  ].filter((g) => g.items.length);
}

function LivePreview({ form, recipients, hasSeries, seriesName }) {
  const [asId, setAsId] = useState("");
  const sample = recipients.find((r) => r.id === asId) || recipients[0] || null;
  const values = useMemo(() => {
    const v = sampleValues(sample, seriesName);
    return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, escapeHtml(val)]));
  }, [sample, seriesName]);
  const subject = renderMergeTags(form.subject, values) || "Your subject appears here";
  const body = renderMergeTags(form.bodyHtml, values);
  const hasBody = Boolean(stripHtml(form.bodyHtml));
  const important = form.priority === "Important";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="eyebrow">Live preview</div>
        {recipients.length > 1 && (
          <Select
            value={sample?.id || ""}
            onChange={(e) => setAsId(e.target.value)}
            aria-label="Preview as student"
            className="rounded-full border border-text/15 bg-white px-3 py-1.5 pr-8 text-xs font-medium text-text"
          >
            {recipients.slice(0, 12).map((r) => (
              <option key={r.id} value={r.id}>
                As {r.firstName}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div className="overflow-hidden rounded-3xl border border-text/10 bg-white shadow-soft">
        {important && (
          <div className="flex items-center gap-2 bg-pastel-orange px-4 py-2 text-xs font-semibold text-pastel-orange-ink">
            <AlertTriangleIcon className="h-3.5 w-3.5" />
            Important · pinned banner in the student portal
          </div>
        )}
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <TypePill type={form.type} />
            <span className="text-[11px] text-muted">Just now</span>
          </div>
          <p className="text-base font-bold leading-snug text-text">{subject}</p>
          {hasBody ? (
            <div className="text-sm leading-relaxed text-text [&_a]:text-primary [&_a]:underline [&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: body }} />
          ) : (
            <p className="text-sm text-muted">Your message body appears here as you type.</p>
          )}
          {form.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {form.attachments.map((f) => (
                <span key={f.name} className="inline-flex items-center gap-1.5 rounded-full bg-bg px-2.5 py-1 text-[11px] font-medium text-muted">
                  <FileGenericIcon className="h-3 w-3" />
                  {f.name}
                </span>
              ))}
            </div>
          )}
          {form.cta.enabled && form.cta.label.trim() && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white">
              {form.cta.label.trim()}
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </span>
          )}
          <div className="flex items-center justify-between border-t border-text/[0.07] pt-3">
            <ChannelIcons channels={form.channels} />
            <span className="text-[11px] text-muted">From {sample ? "Ansh Mehra" : "you"} · replies are off</span>
          </div>
        </div>
      </div>
      {unresolvedTags(form.subject + form.bodyHtml, { hasSeries }).length > 0 && (
        <p className="flex items-start gap-1.5 text-xs font-medium text-warning">
          <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Some merge tags can't be filled. They will show as raw text.
        </p>
      )}
    </div>
  );
}

export default function BroadcastComposerPanel({ env, onGoTab, onToast }) {
  const { compose: form, setCompose, resetCompose, sendBroadcast, scheduleBroadcast, saveDraft, saveTemplate, groups, drafts } = useMessaging();
  const { courses, seriesList, seriesEnrol } = env;

  const editorWrap = useRef(null);
  const [touched, setTouched] = useState(false);
  const [attachError, setAttachError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmLarge, setConfirmLarge] = useState(false);
  const [result, setResult] = useState(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savedAt, setSavedAt] = useState(null);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [, setTick] = useState(0);
  const lastSaved = useRef(null);

  const recipients = useMemo(() => resolveAudience(form.audience, env), [form.audience, env]);
  const labels = useMemo(() => audienceLabels(form.audience, { ...env, groups }), [form.audience, env, groups]);
  const exLabels = useMemo(() => excludeLabels(form.audience, { ...env, groups }), [form.audience, env, groups]);

  const hasSeries = useMemo(() => {
    if (form.audience.seriesIds.length) return true;
    const ids = new Set(Object.values(seriesEnrol).flat());
    return recipients.some((r) => ids.has(r.id));
  }, [form.audience.seriesIds, seriesEnrol, recipients]);
  const seriesName = useMemo(() => {
    const sid = form.audience.seriesIds[0] || seriesList.find((s) => (seriesEnrol[s.id] || []).includes(recipients[0]?.id))?.id;
    return seriesList.find((s) => s.id === sid)?.title || "";
  }, [form.audience.seriesIds, seriesList, seriesEnrol, recipients]);

  const bodyLen = stripHtml(form.bodyHtml).length;
  const tagIssues = unresolvedTags(form.subject + " " + form.bodyHtml, { hasSeries });
  const iso = scheduledIso(form.delivery);
  const mode = form.delivery.mode;

  const errors = {};
  if (!form.subject.trim()) errors.subject = "Add a subject.";
  else if (form.subject.length > SUBJECT_MAX) errors.subject = `Subject must be ${SUBJECT_MAX} characters or fewer.`;
  if (!bodyLen) errors.body = "Write the message body.";
  else if (bodyLen > BODY_MAX) errors.body = `Body must be ${BODY_MAX} characters or fewer.`;
  if (recipients.length === 0) errors.audience = "Choose at least one recipient.";
  if (form.cta.enabled) {
    if (!form.cta.label.trim()) errors.ctaLabel = "Give the button a label.";
    if (!form.cta.link) errors.ctaLink = "Choose where the button links to.";
  }
  if (mode !== "now") {
    if (!form.delivery.date || !form.delivery.time) errors.when = "Pick a date and time.";
    else if (!iso || new Date(iso).getTime() <= nowMs()) errors.when = "Pick a time in the future.";
  }
  if (mode === "recurring") {
    if (!form.delivery.until) errors.until = "Choose when the reminder stops.";
    else if (form.delivery.until < form.delivery.date) errors.until = "End date must be on or after the first send.";
  }
  const valid = Object.keys(errors).length === 0;
  const show = (k) => (touched ? errors[k] : "");

  // Re-render the "Saved just now" label periodically.
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 15000);
    return () => window.clearInterval(t);
  }, []);

  // Autosave: a few seconds after the last change, store/refresh the draft.
  useEffect(() => {
    if (composeIsBlank(form) || form.scheduledId) return undefined;
    const { draftId, editorKey, ...rest } = form;
    const snapshot = JSON.stringify(rest);
    if (lastSaved.current === null && draftId) {
      // Freshly resumed draft: nothing to save until the educator changes it.
      const stored = drafts.find((d) => d.draftId === draftId);
      if (stored) {
        const { draftId: _a, updatedAt: _b, editorKey: _c, ...storedRest } = stored;
        if (JSON.stringify(storedRest) === snapshot) {
          lastSaved.current = snapshot;
          return undefined;
        }
      }
    }
    if (snapshot === lastSaved.current) return undefined;
    setSaveStatus("saving");
    const t = window.setTimeout(() => {
      const id = saveDraft(form);
      lastSaved.current = snapshot;
      if (!form.draftId) setCompose({ draftId: id });
      setSavedAt(new Date().toISOString());
      setSaveStatus("saved");
    }, 3000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  function set(patch) {
    setCompose(patch);
  }

  function insertTag(key) {
    const el = editorWrap.current?.querySelector("[contenteditable]");
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel.rangeCount || !el.contains(sel.anchorNode)) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    document.execCommand("insertText", false, `{{${key}}}`);
    set({ bodyHtml: el.innerHTML });
  }

  function addAttachment(file) {
    setAttachError("");
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!ATTACHMENT_EXTENSIONS.includes(ext)) return setAttachError(`.${ext} files aren't supported. Use ${ATTACHMENT_EXTENSIONS.slice(0, 6).join(", ")} and similar.`);
    if (file.size > MAX_ATTACHMENT_BYTES) return setAttachError(`${file.name} is ${formatSize(file.size)}. The limit is ${formatSize(MAX_ATTACHMENT_BYTES)}.`);
    if (form.attachments.some((f) => f.name === file.name)) return setAttachError(`${file.name} is already attached.`);
    set({ attachments: [...form.attachments, { name: file.name, size: file.size }] });
  }

  function openReview() {
    setTouched(true);
    if (!valid) return;
    setConfirmLarge(false);
    setReviewOpen(true);
  }

  function confirmSend() {
    const count = recipients.length;
    if (mode === "now") {
      sendBroadcast(form, recipients);
      setResult({ kind: "sent", count });
    } else {
      scheduleBroadcast(form, iso);
      setResult({ kind: mode === "recurring" ? "recurring" : "scheduled", count, when: iso, until: form.delivery.until, frequency: form.delivery.frequency });
    }
    lastSaved.current = null;
    resetCompose();
    setTouched(false);
  }

  function closeReview() {
    setReviewOpen(false);
    setResult(null);
  }

  function saveAsTemplate() {
    if (!templateName.trim()) return;
    saveTemplate({ name: templateName.trim(), type: form.type, subject: form.subject, bodyHtml: form.bodyHtml });
    setTemplateOpen(false);
    setTemplateName("");
    onToast("Saved as a template.");
  }

  const estimate = estimateDelivery(recipients.length, form.channels);
  const ctaGroups = ctaOptions(courses, seriesList);
  const needsLargeConfirm = recipients.length > LARGE_AUDIENCE;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        <SectionCard title="Message type">
          <div className="flex flex-wrap gap-2">
            {MESSAGE_TYPES.map((t) => (
              <Chip key={t.key} active={form.type === t.key} onClick={() => set({ type: t.key })} className="px-3.5 py-1.5 text-xs">
                {t.label}
              </Chip>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Audience" hint="Combine as many groups as you like. Students never reply in the app.">
          <BroadcastAudienceBuilder audience={form.audience} onChange={(audience) => set({ audience })} env={{ ...env, groups }} />
          {show("audience") && <p role="alert" className="mt-3 text-xs font-medium text-danger">{show("audience")}</p>}
        </SectionCard>

        <SectionCard title="Message">
          <div className="flex flex-col gap-4">
            <div>
              <Input
                label="Subject"
                value={form.subject}
                onChange={(e) => set({ subject: e.target.value })}
                error={show("subject")}
                placeholder="e.g. Live class moved to Thursday"
                maxLength={SUBJECT_MAX + 20}
              />
              <p className={`mt-1 text-right text-[11px] ${form.subject.length > SUBJECT_MAX ? "font-semibold text-danger" : "text-muted"}`}>
                {form.subject.length}/{SUBJECT_MAX}
              </p>
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-text">Body</span>
              <div ref={editorWrap}>
                <RichTextEditor key={form.editorKey} value={form.bodyHtml} onChange={(html) => set({ bodyHtml: html })} placeholder="Write your message…" minHeight={180} />
              </div>
              <div className="mt-1 flex items-start justify-between gap-3">
                <p role={show("body") ? "alert" : undefined} className="text-xs font-medium text-danger">{show("body")}</p>
                <p className={`shrink-0 text-[11px] ${bodyLen > BODY_MAX ? "font-semibold text-danger" : "text-muted"}`}>
                  {bodyLen}/{BODY_MAX}
                </p>
              </div>
              <div className="mt-2">
                <p className="mb-1.5 text-xs font-semibold text-muted">Insert merge tag</p>
                <div className="flex flex-wrap gap-1.5">
                  {MERGE_TAGS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertTag(t.key)}
                      title={t.label}
                      className="rounded-full border border-primary/25 bg-primary/[0.05] px-3 py-1 font-mono text-[11px] font-semibold text-primary transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary/10"
                    >
                      {`{{${t.key}}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-text">
                Attachments <span className="font-normal text-muted">(up to {MAX_ATTACHMENTS}, {formatSize(MAX_ATTACHMENT_BYTES)} each)</span>
              </span>
              <div className="flex flex-col gap-2">
                {form.attachments.map((f) => (
                  <FileDropzone key={f.name} file={f} onFileSelect={() => set({ attachments: form.attachments.filter((x) => x.name !== f.name) })} />
                ))}
                {form.attachments.length < MAX_ATTACHMENTS && <FileDropzone label="Attach a file" hint="PDF, image, document or spreadsheet" file={null} onFileSelect={addAttachment} />}
              </div>
              {attachError && <p role="alert" className="mt-1.5 text-xs font-medium text-danger">{attachError}</p>}
            </div>

            <div className="rounded-2xl bg-bg p-4">
              <Switch checked={form.cta.enabled} onChange={(v) => set({ cta: { ...form.cta, enabled: v } })} label="Add a call-to-action button" description="Links students to a course, live class or test series." />
              {form.cta.enabled && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input label="Button label" value={form.cta.label} onChange={(e) => set({ cta: { ...form.cta, label: e.target.value.slice(0, 24) } })} error={show("ctaLabel")} placeholder="e.g. Join class" containerClassName="" />
                  <div>
                    <span className="mb-1.5 block text-sm font-medium text-text">Links to</span>
                    <Select
                      wrapperClassName="block w-full"
                      value={form.cta.link}
                      onChange={(e) => set({ cta: { ...form.cta, link: e.target.value } })}
                      className={`w-full rounded-full border bg-surface px-4 py-3 pr-10 text-sm text-text ${show("ctaLink") ? "border-danger" : "border-text/12"}`}
                    >
                      <option value="">Choose a destination…</option>
                      {ctaGroups.map((g) => (
                        <optgroup key={g.group} label={g.group}>
                          {g.items.map((i) => (
                            <option key={i.value} value={i.value}>
                              {i.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                    {show("ctaLink") && <p role="alert" className="mt-1 text-xs font-medium text-danger">{show("ctaLink")}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Channels & priority">
          <div className="flex flex-col gap-3">
            {CHANNELS.map((c) => {
              const Icon = CHANNEL_ICONS[c.key];
              return (
                <div key={c.key} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <Switch
                    className="min-w-0 flex-1"
                    label={c.label}
                    description={c.hint}
                    checked={c.locked ? true : Boolean(form.channels[c.key])}
                    disabled={c.locked}
                    onChange={(v) => set({ channels: { ...form.channels, [c.key]: v } })}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-2xl bg-bg p-3.5">
            <p className="text-xs font-semibold text-text">Estimated delivery</p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {estimate.map((e) => (
                <span key={e.key} className="text-xs text-muted">
                  {e.label}: <span className="font-semibold text-text">~{e.reached}</span>
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted">Estimates based on typical email, push and SMS reach for your students.</p>
          </div>
          <div className="mt-4">
            <span className="mb-1.5 block text-sm font-medium text-text">Priority</span>
            <SegmentedControl options={PRIORITIES} value={form.priority} onChange={(p) => set({ priority: p })} />
            <p className="mt-1.5 text-xs text-muted">{form.priority === "Important" ? "Important messages show as a pinned banner in the student portal until dismissed." : "Normal messages appear in the student's announcements feed."}</p>
          </div>
        </SectionCard>

        <SectionCard title="Delivery">
          <SegmentedControl
            options={Object.values(DELIVERY_OPTIONS)}
            value={DELIVERY_OPTIONS[mode]}
            onChange={(label) => set({ delivery: { ...form.delivery, mode: MODE_BY_LABEL[label] } })}
            className="max-w-full flex-wrap"
          />
          {mode !== "now" && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label={mode === "recurring" ? "First send date" : "Date"} type="date" value={form.delivery.date} onChange={(e) => set({ delivery: { ...form.delivery, date: e.target.value } })} />
              <Input label="Time" type="time" value={form.delivery.time} onChange={(e) => set({ delivery: { ...form.delivery, time: e.target.value } })} />
              {mode === "recurring" && (
                <>
                  <div>
                    <span className="mb-1.5 block text-sm font-medium text-text">Repeat</span>
                    <Select
                      wrapperClassName="block w-full"
                      value={form.delivery.frequency}
                      onChange={(e) => set({ delivery: { ...form.delivery, frequency: e.target.value } })}
                      className="w-full rounded-full border border-text/12 bg-surface px-4 py-3 pr-10 text-sm text-text"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </Select>
                  </div>
                  <Input label="Until" type="date" value={form.delivery.until} onChange={(e) => set({ delivery: { ...form.delivery, until: e.target.value } })} error={show("until")} />
                </>
              )}
              <p className="text-xs text-muted sm:col-span-2">Times are in {timezoneLabel()}.</p>
              {show("when") && <p role="alert" className="text-xs font-medium text-danger sm:col-span-2">{show("when")}</p>}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <div className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-soft sm:p-6">
          <LivePreview form={form} recipients={recipients} hasSeries={hasSeries} seriesName={seriesName} />
          <div className="flex items-center justify-between gap-2 border-t border-text/[0.07] pt-3">
            <AutoSaveIndicator status={saveStatus} timestamp={savedAt ? relativeTime(savedAt) : undefined} />
            <button type="button" onClick={() => { setTemplateName(""); setTemplateOpen(true); }} disabled={!form.subject.trim() && !bodyLen} className="rounded-full px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/[0.07] disabled:text-muted disabled:hover:bg-transparent">
              Save as template
            </button>
          </div>
          <Button className="flex items-center justify-center gap-2" disabled={!valid} onClick={openReview}>
            <SendIcon className="h-4 w-4" />
            {mode === "now" ? "Review & send" : "Review & schedule"}
          </Button>
          {!valid && touched && <p className="text-center text-xs text-muted">Fix the highlighted fields to continue.</p>}
          {!valid && !touched && (
            <button type="button" onClick={() => setTouched(true)} className="self-center text-xs font-semibold text-primary hover:underline">
              What's missing?
            </button>
          )}
          {!composeIsBlank(form) && (
            <button type="button" onClick={() => { lastSaved.current = null; resetCompose(); setTouched(false); }} className="self-center text-xs font-semibold text-muted hover:text-text">
              Start over
            </button>
          )}
        </div>
      </div>

      <Modal
        open={reviewOpen}
        onClose={closeReview}
        title={result ? "" : "Review before sending"}
        size="lg"
        footer={
          result ? null : (
            <>
              <Button fullWidth={false} className="px-6" disabled={needsLargeConfirm && !confirmLarge} onClick={confirmSend}>
                {mode === "now" ? `Send to ${recipients.length}` : mode === "recurring" ? "Schedule reminder" : "Schedule"}
              </Button>
              <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => { onToast("Test sent to you in-app" + (form.channels.email ? " and by email" : "") + "."); }}>
                Send test to myself
              </Button>
              <Button variant="tertiary" fullWidth={false} className="px-5" onClick={closeReview}>
                Back to edit
              </Button>
            </>
          )
        }
      >
        {result ? (
          <ConfirmationCard
            state="success"
            heading={result.kind === "sent" ? `Sent to ${result.count} student${result.count === 1 ? "" : "s"}` : result.kind === "recurring" ? "Recurring reminder scheduled" : "Broadcast scheduled"}
            message={
              result.kind === "sent"
                ? "It's in the student portal now. Delivery results will appear in Sent."
                : result.kind === "recurring"
                ? `Starts ${formatDateTime(result.when)} and repeats ${result.frequency} until ${result.until}.`
                : `Goes out ${formatDateTime(result.when)} (${countdownLabel(result.when)}).`
            }
            primaryAction={<Button onClick={() => { closeReview(); onGoTab(result.kind === "sent" ? "Sent" : "Scheduled"); }}>{result.kind === "sent" ? "View in Sent" : "View in Scheduled"}</Button>}
            secondaryAction={<Button variant="secondary" onClick={closeReview}>Compose another</Button>}
          />
        ) : (
          <div className="flex flex-col gap-4 pb-2">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-[110px_1fr]">
              <dt className="eyebrow pt-1">Subject</dt>
              <dd className="text-sm font-semibold text-text">{form.subject}</dd>
              <dt className="eyebrow pt-1">Audience</dt>
              <dd className="flex flex-col gap-1.5">
                <AudienceChips labels={labels} max={6} />
                <span className="text-xs text-muted">
                  {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
                  {exLabels.length ? ` · excluding ${exLabels.join(", ")}` : ""}
                </span>
              </dd>
              <dt className="eyebrow pt-1">Channels</dt>
              <dd className="flex flex-col gap-1.5">
                <ChannelIcons channels={form.channels} />
                <span className="text-xs text-muted">{estimate.map((e) => `${e.label} ~${e.reached}`).join(" · ")}</span>
              </dd>
              <dt className="eyebrow pt-1">Priority</dt>
              <dd className="text-sm text-text">{form.priority}</dd>
              <dt className="eyebrow pt-1">Schedule</dt>
              <dd className="text-sm text-text">
                {mode === "now" ? "Send immediately" : mode === "later" ? `${formatDateTime(iso)} (${timezoneLabel()})` : `${formatDateTime(iso)}, ${form.delivery.frequency} until ${form.delivery.until}`}
              </dd>
              <dt className="eyebrow pt-1">Merge tags</dt>
              <dd>
                {tagIssues.length === 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                    <CheckIcon className="h-3.5 w-3.5" />
                    All tags will be filled in for every recipient
                  </span>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {tagIssues.map((t) => (
                      <li key={t.tag} className="flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">
                        <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          <span className="font-semibold">Unresolved tag {`{{${t.tag}}}`}</span>: {t.reason}.
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </dl>
            {needsLargeConfirm && (
              <div className="rounded-2xl bg-warning/10 p-3.5">
                <Checkbox checked={confirmLarge} onChange={(e) => setConfirmLarge(e.target.checked)} label={`I understand this will be sent to ${recipients.length} students.`} />
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="Save as template"
        size="sm"
        footer={
          <>
            <Button fullWidth={false} className="px-6" disabled={!templateName.trim()} onClick={saveAsTemplate}>
              Save template
            </Button>
            <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => setTemplateOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        <Input label="Template name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Weekly check-in" autoFocus />
        <p className="mt-2 text-xs text-muted">Saves the type, subject and body. Audience and delivery aren't included.</p>
      </Modal>
    </div>
  );
}
