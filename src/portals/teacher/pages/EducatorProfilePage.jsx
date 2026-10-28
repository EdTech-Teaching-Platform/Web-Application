// /teacher/profile: educator_get_profile / educator_update_profile. Only the
// allowed fields are editable (bio, qualifications, experience, subjects,
// languages, phone, location); verification status and document statuses are
// shown read-only (names and statuses, never the files).
import { useCallback, useEffect, useState } from "react";
import Input from "../../../components/ui/Input";
import ChipInput from "../../../components/ui/ChipInput";
import Button from "../../../components/ui/Button";
import { useAuth } from "../../../hooks/useAuth";
import { useRpc } from "../../admin/hooks/useRpc";
import { documentLabel } from "../../admin/services/educatorsApi";
import { educatorApi } from "../services/educatorApi";
import { fieldErrorsFrom, validateOnboarding } from "../utils/onboarding";
import { ErrorState, Loading, PageCard, StatusPill } from "../components/PageState";
import { formatDate } from "../utils/format";

const EDITABLE = ["phone", "location", "qualifications", "experience_years", "subjects", "languages", "bio"];

export default function EducatorProfilePage({ api = educatorApi }) {
  const { logout } = useAuth();
  const request = useCallback(() => api.getProfile(), [api]);
  const { data, loading, error, refetch } = useRpc(request);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (data) setForm(Object.fromEntries(EDITABLE.map((k) => [k, data[k] ?? (k === "subjects" || k === "languages" ? [] : "")])));
  }, [data]);

  if (loading && !data) return <Loading label="Loading your profile…" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch().catch(() => {})} />;
  if (!form) return null;

  const changed = Object.fromEntries(EDITABLE.filter((k) => JSON.stringify(form[k] ?? "") !== JSON.stringify(data[k] ?? (k === "subjects" || k === "languages" ? [] : ""))).map((k) => [k, form[k]]));
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setMessage(""); };

  const save = async (e) => {
    e.preventDefault();
    const all = validateOnboarding({ ...form, full_name: data.full_name }, 0);
    const relevant = Object.fromEntries(Object.entries(all).filter(([k]) => k in changed));
    setErrors(relevant);
    if (Object.keys(relevant).length || Object.keys(changed).length === 0 || saving) return;
    setSaving(true);
    try {
      await api.updateProfile(changed);
      setMessage("Profile saved.");
      await refetch();
    } catch (err) {
      setErrors(fieldErrorsFrom(err));
      setMessage(err.message || "We couldn't save your profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <PageCard title="Your profile" className="lg:col-span-2">
        <form onSubmit={save} className="space-y-4" noValidate>
          {message && <p role="status" className="rounded-2xl bg-(--lp-blue-tint) p-3 text-sm">{message}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full name" value={data.full_name || ""} disabled readOnly />
            <Input label="Email" value={data.email || ""} disabled readOnly />
            <Input label="Phone" type="tel" value={form.phone || ""} onChange={(e) => set({ phone: e.target.value })} error={errors.phone} />
            <Input label="City / location" value={form.location || ""} onChange={(e) => set({ location: e.target.value })} error={errors.location} />
            <Input label="Years of experience" type="number" min="0" max="60" value={form.experience_years ?? ""} onChange={(e) => set({ experience_years: e.target.value })} error={errors.experience_years} />
          </div>
          <div>
            <label htmlFor="pf-qualifications" className="mb-1.5 block text-sm font-medium">Qualifications</label>
            <textarea id="pf-qualifications" rows={2} maxLength={500} className="w-full rounded-2xl border border-text/15 px-4 py-3 text-sm"
              value={form.qualifications || ""} onChange={(e) => set({ qualifications: e.target.value })} aria-invalid={Boolean(errors.qualifications)} aria-describedby="pf-qualifications-error" />
            {errors.qualifications && <span id="pf-qualifications-error" className="text-xs text-danger">{errors.qualifications}</span>}
          </div>
          <div>
            <ChipInput label="Subjects" values={form.subjects || []} onChange={(subjects) => set({ subjects })} max={20} />
            {errors.subjects && <span className="text-xs text-danger">{errors.subjects}</span>}
          </div>
          <div>
            <ChipInput label="Teaching languages" values={form.languages || []} onChange={(languages) => set({ languages })} max={10} />
            {errors.languages && <span className="text-xs text-danger">{errors.languages}</span>}
          </div>
          <div>
            <label htmlFor="pf-bio" className="mb-1.5 block text-sm font-medium">Bio</label>
            <textarea id="pf-bio" rows={5} maxLength={1000} className="w-full rounded-2xl border border-text/15 px-4 py-3 text-sm"
              value={form.bio || ""} onChange={(e) => set({ bio: e.target.value })} aria-invalid={Boolean(errors.bio)} aria-describedby="pf-bio-error" />
            {errors.bio && <span id="pf-bio-error" className="text-xs text-danger">{errors.bio}</span>}
          </div>
          <Button type="submit" variant="ink" fullWidth={false} disabled={saving || Object.keys(changed).length === 0} aria-busy={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </PageCard>

      <div className="space-y-6">
        <PageCard title="Verification">
          <p className="text-sm">Status: <StatusPill status={data.verification_status === "verified" ? "approved" : data.verification_status} label={data.verification_status === "verified" ? "Verified" : data.verification_status} /></p>
          <p className="mt-2 text-xs text-(--lp-muted)">Verified on {formatDate(data.verified_at)} · Educator ID {data.educator_code || "—"}</p>
          <h3 className="mt-4 text-sm font-semibold">Documents</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {(data.documents || []).map((d) => (
              <li key={`${d.doc_type}-${d.doc_name}`} className="flex items-center justify-between gap-2">
                <span>{documentLabel(d.doc_type, d.doc_name)}</span>
                <StatusPill status={d.status === "approved" ? "approved" : d.status} />
              </li>
            ))}
            {(data.documents || []).length === 0 && <li className="text-(--lp-muted)">No documents.</li>}
          </ul>
        </PageCard>
        <PageCard title="Account">
          <p className="text-sm text-(--lp-muted)">Joined {formatDate(data.joined_at)}</p>
          <Button type="button" variant="social" fullWidth={false} className="mt-3" onClick={() => logout()}>Log out</Button>
        </PageCard>
      </div>
    </div>
  );
}
