import { useMemo, useState } from "react";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import Select from "../../../components/ui/Select";
import StatusBadge from "../../../components/ui/StatusBadge";
import EmptyState from "../../../components/ui/EmptyState";
import ConfirmationCard from "../../../components/ui/ConfirmationCard";
import { ICON_TONES, toneForKey } from "../../../components/ui/IconBadge";
import { formatMoney } from "../../../utils/formatMoney";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import { seedEarnings } from "../data/earningsData";
import {
  accentFor,
  bundleDisplayStatus,
  bundleLedgerRevenue,
  bundlePricing,
  bundleWarnings,
  countdownInfo,
  emptyBundle,
  validateBundle,
} from "../data/bundleData";
import BundleEditor from "./BundleEditor";
import { AlertTriangleIcon, PackageIcon, PauseIcon, PencilIcon, PlayIcon, PlusIcon, TrashIcon } from "../../../components/ui/icons";

function Avatars({ ids, coursesById }) {
  return (
    <div className="flex -space-x-2">
      {ids.slice(0, 5).map((id) => {
        const c = coursesById[id];
        return (
          <span
            key={id}
            title={c?.title}
            className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-xs font-bold ring-2 ring-white ${ICON_TONES[toneForKey(c?.category || "")]}`}
          >
            {c?.thumbnail ? <img src={c.thumbnail} alt="" className="h-full w-full object-cover" /> : (c?.title || "?").slice(0, 1)}
          </span>
        );
      })}
      {ids.length > 5 && <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bg text-xs font-bold text-muted ring-2 ring-white">+{ids.length - 5}</span>}
    </div>
  );
}

function BundleCard({ bundle, coursesById, revenue, onEdit, onToggle, onDelete }) {
  const accent = accentFor(bundle.accent);
  const pricing = bundlePricing(bundle, coursesById);
  const st = bundleDisplayStatus(bundle, coursesById);
  const warnings = bundleWarnings(bundle, coursesById);
  const countdown = countdownInfo(bundle);
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card">
      <div className={`flex items-end justify-between gap-3 px-5 pb-3 pt-6 ${accent.bg}`}>
        <Avatars ids={bundle.courseIds} coursesById={coursesById} />
        <div className="flex flex-wrap justify-end gap-1.5">
          {bundle.visibility === "unlisted" && <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-text/70">Unlisted</span>}
          <StatusBadge status={st.status} size="sm">{st.label}</StatusBadge>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="text-base font-bold leading-snug text-text">{bundle.name}</h3>
          <p className="mt-0.5 text-xs text-muted">
            {bundle.courseIds.length} courses{countdown ? ` · ${countdown.label}` : ""}
          </p>
        </div>
        {warnings.length > 0 && (
          <StatusBadge status="warning" size="sm" icon={AlertTriangleIcon} className="self-start">
            {warnings.length === 1 ? `${warnings[0].title} is archived` : `${warnings.length} archived courses`}
          </StatusBadge>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xl font-bold text-text">{formatMoney(pricing.final)}</span>
          {pricing.valid && pricing.savings > 0 && (
            <span className="rounded-full bg-secondary/15 px-2.5 py-1 text-[11px] font-bold text-secondary">{pricing.savingsPct}% off</span>
          )}
        </div>
        <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-line pt-3">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Sales</dt>
            <dd className="text-sm font-semibold text-text">{bundle.sales || 0}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Revenue</dt>
            <dd className="text-sm font-semibold text-text">{formatMoney(revenue)}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5 px-4 py-2 text-xs" onClick={onEdit}>
            <PencilIcon className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5 px-4 py-2 text-xs" onClick={onToggle}>
            {bundle.status === "paused" ? <PlayIcon className="h-3.5 w-3.5" /> : <PauseIcon className="h-3.5 w-3.5" />}
            {bundle.status === "paused" ? "Resume" : "Pause"}
          </Button>
          <Button variant="tertiary" fullWidth={false} className="flex items-center gap-1.5 px-4 py-2 text-xs" onClick={onDelete}>
            <TrashIcon className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// BundlesView — My Courses "Bundles" tab. Lists every bundle the educator
// has configured (all read from TeacherCoursesContext), with revenue taken
// from the same earnings ledger Earnings/Analytics use.
export default function BundlesView() {
  const { courses, bundles, saveBundle, deleteBundle } = useTeacherCourses();
  const coursesById = useMemo(() => Object.fromEntries(courses.map((c) => [c.id, c])), [courses]);
  const ledger = useMemo(() => seedEarnings(courses).ledger, [courses]);
  const live = bundles.filter((b) => b.enabled);

  const [editing, setEditing] = useState(null); // draft bundle
  const [deleting, setDeleting] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newPrimary, setNewPrimary] = useState("");

  const primaries = courses.filter((c) => c.status === "published" && !live.some((b) => b.courseIds[0] === c.id));
  const editingValid = editing ? validateBundle(editing, courses).valid : false;
  const editingDirty = editing ? JSON.stringify(editing) !== JSON.stringify(bundles.find((b) => b.id === editing.id)) : false;

  function startCreate() {
    const course = coursesById[newPrimary || primaries[0]?.id];
    if (!course) return;
    setCreating(false);
    setEditing(emptyBundle(course));
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">Multi-course packages you offer at a combined price.</p>
        <Button
          variant="primary"
          fullWidth={false}
          className="flex items-center gap-2 px-5"
          disabled={primaries.length === 0}
          title={primaries.length === 0 ? "Every published course already has a bundle" : undefined}
          onClick={() => {
            setNewPrimary(primaries[0]?.id || "");
            setCreating(true);
          }}
        >
          <PlusIcon className="h-4 w-4" /> New Bundle
        </Button>
      </div>

      <div className="mt-5">
        {live.length === 0 ? (
          <EmptyState icon={PackageIcon} heading="No bundles yet" message="Combine two or more published courses at a discount to lift your average order value." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {live.map((b) => (
              <BundleCard
                key={b.id}
                bundle={b}
                coursesById={coursesById}
                revenue={bundleLedgerRevenue(ledger, b.id)}
                onEdit={() => setEditing(b)}
                onToggle={() => saveBundle({ ...b, status: b.status === "paused" ? "active" : "paused" })}
                onDelete={() => setDeleting(b)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing && bundles.some((b) => b.id === editing.id) ? "Edit bundle" : "New bundle"}
        size="2xl"
        mobileFullScreen
        footer={
          <>
            <Button
              variant="primary"
              fullWidth={false}
              className="px-6"
              disabled={!editingValid || !editingDirty}
              onClick={() => {
                saveBundle(editing);
                setEditing(null);
              }}
            >
              Save bundle
            </Button>
            <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </>
        }
      >
        {editing && <BundleEditor bundle={editing} onChange={setEditing} courses={courses} layout="stacked" />}
      </Modal>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New bundle"
        size="sm"
        footer={
          <>
            <Button variant="primary" fullWidth={false} className="px-6" disabled={!newPrimary} onClick={startCreate}>
              Continue
            </Button>
            <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-text">Bundle's main course</span>
          <Select
            wrapperClassName="block w-full"
            value={newPrimary}
            onChange={(e) => setNewPrimary(e.target.value)}
            className="w-full rounded-full border border-text/15 bg-bg px-4 py-3 pr-9 text-sm text-text"
          >
            {primaries.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </Select>
          <span className="mt-1.5 block text-xs text-muted">It is pinned first in the bundle. Only published courses can be bundled.</span>
        </label>
      </Modal>

      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} size="sm">
        {deleting && (
          <ConfirmationCard
            state="warning"
            heading="Delete this bundle?"
            message={`"${deleting.name}" will stop being sold. Courses and past sales are not affected.`}
            primaryAction={
              <Button
                variant="primary"
                onClick={() => {
                  deleteBundle(deleting.id);
                  setDeleting(null);
                }}
              >
                Delete bundle
              </Button>
            }
            secondaryAction={<Button variant="secondary" onClick={() => setDeleting(null)}>Keep bundle</Button>}
          />
        )}
      </Modal>
    </div>
  );
}
