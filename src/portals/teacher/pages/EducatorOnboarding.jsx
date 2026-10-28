// /teacher/onboarding: the educator application, full page (no portal
// chrome). Five steps, each saved on the server (educator_save_onboarding_step)
// so a refresh resumes where the educator left off:
//   1 personal and contact, 2 qualifications and experience,
//   3 subjects / languages / bio, 4 ID verification (front, back, selfie,
//   optional certificates), 5 review and submit (educator_submit_onboarding).
// Only editable applications (draft, changes requested, rejected) can be
// changed; anything else goes back to /teacher, where the gate shows the status.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import ChipInput from "../../../components/ui/ChipInput";
import ProgressSteps from "../../../components/ui/ProgressSteps";
import RouteFallback from "../../../components/common/RouteFallback";
import { BrandMark, AUTH_THEME_VARS } from "../../../auth/components/AuthKit";
import { useAuth } from "../../../hooks/useAuth";
import { homePathForUser } from "../../../utils/roles";
import { educatorApi } from "../services/educatorApi";
import {
  CERTIFICATE_TYPES, IMAGE_TYPES, ONBOARDING_STEPS, REQUIRED_DOCUMENTS, certificateSlug, fieldErrorsFrom,
  missingRequiredDocuments, resumeStep, stepData, validateOnboarding,
} from "../utils/onboarding";

const FIELD_STEP = { full_name: 1, phone: 1, location: 1, qualifications: 2, experience_years: 2, subjects: 3, languages: 3, bio: 3, documents: 4 };
const CERT_LABEL = {
  degree_certificate: "Degree certificate", teaching_license: "Teaching licence",
  experience_letter: "Experience letter", subject_certificate: "Subject certificate",
};

function FieldError({ id, message }) {
  if (!message) return null;
  return <span id={id} className="mt-1.5 block text-xs text-danger">{message}</span>;
}

// One upload slot: the current file (or a preview of the one just picked),
// progress while uploading, Replace / Remove, and the error if it failed.
export function DocumentSlot({ label, required, accept, document, upload, onPick, onRemove, disabled }) {
  const inputRef = useRef(null);
  const busy = upload?.status === "uploading";
  const inputId = `doc-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="rounded-2xl border border-text/10 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-text">{label} {required ? <span className="text-danger">*</span> : <span className="text-xs font-normal text-text/50">(optional)</span>}</p>
          {document && !busy && (
            <p className="text-xs text-text/60">
              {document.file_name} · {document.status === "pending" ? "uploaded" : document.status}
              {document.note ? ` · ${document.note}` : ""}
            </p>
          )}
          {!document && !busy && <p className="text-xs text-text/50">Not uploaded yet</p>}
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={accept}
            className="sr-only"
            disabled={disabled || busy}
            onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) onPick(file); }}
          />
          <Button type="button" variant="secondary" fullWidth={false} className="!px-4 !py-2" disabled={disabled || busy} onClick={() => inputRef.current?.click()} aria-controls={inputId}>
            {document ? "Replace" : "Choose file"}
          </Button>
          {document && <Button type="button" variant="social" fullWidth={false} className="!px-4 !py-2" disabled={disabled || busy} onClick={onRemove}>Remove</Button>}
        </div>
      </div>
      {upload?.preview && (
        <img src={upload.preview} alt={`Preview of ${label}`} className="mt-3 max-h-40 rounded-xl border border-text/10 object-contain" />
      )}
      {busy && (
        <div className="mt-3" role="status" aria-live="polite">
          <div className="h-2 w-full overflow-hidden rounded-full bg-text/10" aria-hidden="true">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${upload.progress || 0}%` }} />
          </div>
          <span className="text-xs text-text/60">Uploading… {upload.progress || 0}%</span>
        </div>
      )}
      {upload?.status === "error" && <p role="alert" className="mt-2 text-xs text-danger">{upload.error}</p>}
    </div>
  );
}

export default function EducatorOnboarding({ api = educatorApi }) {
  const navigate = useNavigate();
  const { user, loading: authLoading, logout } = useAuth();
  const [state, setState] = useState({ loading: true, error: "", onboarding: null });
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({});
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploads, setUploads] = useState({});
  const [cert, setCert] = useState({ type: CERTIFICATE_TYPES[0], label: "" });
  const previews = useRef([]);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const onboarding = await api.getOnboarding();
      setState({ loading: false, error: "", onboarding });
      setForm({ ...onboarding.data, experience_years: onboarding.data?.experience_years ?? "" });
      setStep(resumeStep(onboarding));
    } catch (error) {
      setState({ loading: false, error: error.message || "We couldn't load your application.", onboarding: null });
    }
  }, [api]);

  useEffect(() => { if (user?.role === "teacher") load(); }, [user?.role, load]);
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL?.(url)), []);

  const documents = state.onboarding?.documents || [];
  const status = state.onboarding?.status;
  const clientErrors = useMemo(() => validateOnboarding(form, step <= 3 ? step : 0), [form, step]);
  const errorFor = (field) => serverErrors[field] || (touched[field] ? clientErrors[field] : undefined);
  const missingDocs = missingRequiredDocuments(documents);

  if (authLoading) return <RouteFallback fullscreen />;
  if (!user) return <Navigate to="/teacher/login" replace />;
  if (user.role !== "teacher") return <Navigate to={homePathForUser(user)} replace />;
  if (state.loading && !state.onboarding) return <RouteFallback fullscreen />;
  if (status && !status.can_edit) return <Navigate to="/teacher" replace />;

  const patch = (p) => { setForm((f) => ({ ...f, ...p })); setServerErrors((e) => { const n = { ...e }; Object.keys(p).forEach((k) => delete n[k]); return n; }); };
  const touch = (field) => setTouched((t) => ({ ...t, [field]: true }));

  const saveAndContinue = async () => {
    const def = ONBOARDING_STEPS.find((s) => s.step === step);
    setTouched((t) => ({ ...t, ...Object.fromEntries(def.fields.map((f) => [f, true])) }));
    if (step <= 3 && Object.keys(clientErrors).length > 0) return;
    if (step === 4 && missingDocs.length > 0) { setMessage(`Upload: ${missingDocs.map((d) => d.label).join(", ")}.`); return; }
    setSaving(true);
    setMessage("");
    try {
      const onboarding = await api.saveStep(step, stepData(form, step));
      setState((s) => ({ ...s, onboarding }));
      setStep(Math.min(step + 1, 5));
      window.scrollTo?.({ top: 0 });
    } catch (error) {
      setServerErrors(fieldErrorsFrom(error));
      setMessage(error.message || "We couldn't save this step.");
    } finally {
      setSaving(false);
    }
  };

  const pick = async (key, docType, docName, file) => {
    const preview = file.type?.startsWith("image/") && URL.createObjectURL ? URL.createObjectURL(file) : null;
    if (preview) previews.current.push(preview);
    setUploads((u) => ({ ...u, [key]: { status: "uploading", progress: 0, preview } }));
    try {
      await api.uploadDocument({
        docType, docName, file,
        onProgress: (progress) => setUploads((u) => ({ ...u, [key]: { ...u[key], progress } })),
      });
      setUploads((u) => ({ ...u, [key]: { status: "done", preview } }));
      const onboarding = await api.getOnboarding();
      setState((s) => ({ ...s, onboarding }));
      return true;
    } catch (error) {
      setUploads((u) => ({ ...u, [key]: { status: "error", error: error.message || "The upload failed.", preview: null } }));
      return false;
    }
  };

  const remove = async (doc, key) => {
    try {
      const onboarding = await api.removeDocument(doc.id);
      setState((s) => ({ ...s, onboarding }));
      setUploads((u) => ({ ...u, [key]: undefined }));
    } catch (error) {
      setUploads((u) => ({ ...u, [key]: { status: "error", error: error.message } }));
    }
  };

  const submit = async () => {
    setSaving(true);
    setMessage("");
    try {
      await api.submitOnboarding();
      navigate("/teacher", { replace: true });
    } catch (error) {
      const fields = fieldErrorsFrom(error);
      setServerErrors(fields);
      const firstStep = Math.min(...Object.keys(fields).map((f) => FIELD_STEP[f] || 5), 5);
      setMessage(error.message || "We couldn't submit your application.");
      if (firstStep < 5) setStep(firstStep);
    } finally {
      setSaving(false);
    }
  };

  const certificates = documents.filter((d) => CERTIFICATE_TYPES.includes(d.doc_type));
  const stepTitle = ONBOARDING_STEPS[step - 1].title;

  return (
    <div style={AUTH_THEME_VARS} className="min-h-screen bg-[#f3f6fd] px-4 py-8 font-body text-text">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandMark className="h-10 w-10" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text/50">Educator application</p>
              <h1 className="font-display text-xl font-bold">{stepTitle}</h1>
            </div>
          </div>
          <Button type="button" variant="social" fullWidth={false} className="!px-4 !py-2" onClick={() => logout()}>Log out</Button>
        </header>

        {state.error && (
          <div role="alert" className="mb-4 rounded-2xl bg-danger/10 p-4 text-sm text-danger">
            {state.error} <button type="button" className="ml-2 font-semibold underline" onClick={load}>Retry</button>
          </div>
        )}
        {status?.status === "changes_requested" && status.note && (
          <div role="status" className="mb-4 rounded-2xl bg-(--lp-yellow)/30 p-4 text-sm"><strong>Changes requested:</strong> {status.note}</div>
        )}
        {status?.status === "rejected" && status.note && (
          <div role="status" className="mb-4 rounded-2xl bg-danger/10 p-4 text-sm"><strong>Previous application not approved:</strong> {status.note}</div>
        )}

        <div className="mb-6 rounded-3xl bg-white p-4 shadow-sm">
          <ProgressSteps steps={ONBOARDING_STEPS.map((s) => s.title)} currentIndex={step - 1} />
        </div>

        <section className="space-y-5 rounded-3xl bg-white p-6 shadow-sm" aria-labelledby="onboarding-step-title">
          <h2 id="onboarding-step-title" className="sr-only">{stepTitle}</h2>
          {message && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{message}</p>}

          {step === 1 && (
            <>
              <Input label="Full name" value={form.full_name || ""} onChange={(e) => patch({ full_name: e.target.value })} onBlur={() => touch("full_name")} error={errorFor("full_name")} autoComplete="name" />
              <Input label="Phone" type="tel" value={form.phone || ""} onChange={(e) => patch({ phone: e.target.value })} onBlur={() => touch("phone")} error={errorFor("phone")} autoComplete="tel" placeholder="+91 98765 43210" />
              <Input label="City / location" value={form.location || ""} onChange={(e) => patch({ location: e.target.value })} onBlur={() => touch("location")} error={errorFor("location")} autoComplete="address-level2" />
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label htmlFor="ob-qualifications" className="mb-1.5 block text-sm font-medium">Qualifications</label>
                <textarea id="ob-qualifications" rows={3} maxLength={500} className="w-full rounded-2xl border border-text/15 bg-bg px-4 py-3 text-sm"
                  value={form.qualifications || ""} onChange={(e) => patch({ qualifications: e.target.value })} onBlur={() => touch("qualifications")}
                  aria-invalid={Boolean(errorFor("qualifications"))} aria-describedby="ob-qualifications-error" placeholder="e.g. MSc Physics, B.Ed" />
                <FieldError id="ob-qualifications-error" message={errorFor("qualifications")} />
              </div>
              <Input label="Years of teaching experience" type="number" min="0" max="60" value={form.experience_years ?? ""}
                onChange={(e) => patch({ experience_years: e.target.value })} onBlur={() => touch("experience_years")} error={errorFor("experience_years")} />
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <ChipInput label="Subjects you teach" values={form.subjects || []} onChange={(subjects) => { patch({ subjects }); touch("subjects"); }} max={20} placeholder="Type a subject and press Enter" />
                <FieldError id="ob-subjects-error" message={errorFor("subjects")} />
              </div>
              <div>
                <ChipInput label="Teaching languages" values={form.languages || []} onChange={(languages) => { patch({ languages }); touch("languages"); }} max={10} placeholder="Type a language and press Enter" />
                <FieldError id="ob-languages-error" message={errorFor("languages")} />
              </div>
              <div>
                <label htmlFor="ob-bio" className="mb-1.5 block text-sm font-medium">Short bio</label>
                <textarea id="ob-bio" rows={5} maxLength={1000} className="w-full rounded-2xl border border-text/15 bg-bg px-4 py-3 text-sm"
                  value={form.bio || ""} onChange={(e) => patch({ bio: e.target.value })} onBlur={() => touch("bio")}
                  aria-invalid={Boolean(errorFor("bio"))} aria-describedby="ob-bio-count ob-bio-error" />
                <span id="ob-bio-count" className="mt-1 block text-right text-xs text-text/50">{String(form.bio || "").trim().length} / 1000 (at least 50)</span>
                <FieldError id="ob-bio-error" message={errorFor("bio")} />
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <p className="text-sm text-text/70">Upload clear pictures (JPEG, PNG or WebP, up to 5 MB). Certificates may also be PDFs. Only our verification team can see them.</p>
              {REQUIRED_DOCUMENTS.map((r) => {
                const key = `${r.docType}:${r.docName}`;
                const doc = documents.find((d) => d.doc_type === r.docType && d.doc_name === r.docName);
                return (
                  <DocumentSlot key={key} label={r.label} required={r.required} accept={IMAGE_TYPES.join(",")} document={doc} upload={uploads[key]}
                    onPick={(file) => pick(key, r.docType, r.docName, file)} onRemove={() => remove(doc, key)} disabled={saving} />
                );
              })}
              <fieldset className="rounded-2xl border border-dashed border-text/15 p-4">
                <legend className="px-1 text-sm font-semibold">Certificates (optional)</legend>
                {certificates.length > 0 && (
                  <ul className="mb-3 space-y-1 text-sm">
                    {certificates.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-2">
                        <span>{CERT_LABEL[d.doc_type]}: {d.doc_name} · {d.status}</span>
                        <button type="button" className="text-xs font-semibold text-danger underline" onClick={() => remove(d, `cert:${d.id}`)}>Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <label className="block text-sm">
                    <span className="mb-1.5 block font-medium">Type</span>
                    <select className="w-full rounded-full border border-text/15 bg-bg px-4 py-3 text-sm" value={cert.type} onChange={(e) => setCert((c) => ({ ...c, type: e.target.value }))}>
                      {CERTIFICATE_TYPES.map((t) => <option key={t} value={t}>{CERT_LABEL[t]}</option>)}
                    </select>
                  </label>
                  <Input label="Name" value={cert.label} onChange={(e) => setCert((c) => ({ ...c, label: e.target.value }))} placeholder="e.g. BSc Physics" />
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-text px-4 py-3 text-sm font-semibold text-white has-[:disabled]:opacity-50">
                    Upload
                    <input type="file" className="sr-only" accept={[...IMAGE_TYPES, "application/pdf"].join(",")} disabled={!cert.label.trim()}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file && await pick("cert:new", cert.type, certificateSlug(cert.label), file)) setCert((c) => ({ ...c, label: "" }));
                      }} />
                  </label>
                </div>
                {uploads["cert:new"]?.status === "uploading" && <p role="status" className="mt-2 text-xs">Uploading… {uploads["cert:new"].progress || 0}%</p>}
                {uploads["cert:new"]?.status === "error" && <p role="alert" className="mt-2 text-xs text-danger">{uploads["cert:new"].error}</p>}
              </fieldset>
              {errorFor("documents") && <p role="alert" className="text-sm text-danger">{errorFor("documents")}</p>}
            </>
          )}

          {step === 5 && (
            <div className="space-y-4 text-sm">
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {[["Name", form.full_name], ["Phone", form.phone], ["Location", form.location], ["Qualifications", form.qualifications],
                  ["Experience", `${form.experience_years ?? "—"} years`], ["Subjects", (form.subjects || []).join(", ")],
                  ["Languages", (form.languages || []).join(", ")]].map(([k, v]) => (
                  <div key={k}><dt className="text-xs text-text/50">{k}</dt><dd className="font-medium">{v || "—"}</dd></div>
                ))}
              </dl>
              <div><p className="text-xs text-text/50">Bio</p><p className="whitespace-pre-line">{form.bio}</p></div>
              <div>
                <p className="text-xs text-text/50">Documents</p>
                <ul className="list-disc pl-5">{documents.map((d) => <li key={d.id}>{d.doc_type.replace(/_/g, " ")} ({d.doc_name})</li>)}</ul>
              </div>
              {Object.keys(serverErrors).length > 0 && (
                <ul className="rounded-xl bg-danger/10 p-3 text-danger" role="alert">
                  {Object.entries(serverErrors).map(([field, msg]) => (
                    <li key={field}>{msg} <button type="button" className="underline" onClick={() => setStep(FIELD_STEP[field] || 1)}>Fix</button></li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-text/10 pt-5">
            <Button type="button" variant="social" fullWidth={false} disabled={step === 1 || saving} onClick={() => setStep(step - 1)}>Back</Button>
            {step < 5 ? (
              <Button type="button" variant="ink" fullWidth={false} onClick={saveAndContinue} disabled={saving} aria-busy={saving}>
                {saving ? "Saving…" : "Save and continue"}
              </Button>
            ) : (
              <Button type="button" variant="ink" fullWidth={false} onClick={submit} disabled={saving || missingDocs.length > 0} aria-busy={saving}>
                {saving ? "Submitting…" : status?.status === "draft" ? "Submit application" : "Resubmit application"}
              </Button>
            )}
          </div>
        </section>
        <p className="mt-6 text-center text-xs text-text/50">Your progress is saved after each step. <Link to="/terms" className="underline">Terms</Link></p>
      </div>
    </div>
  );
}
