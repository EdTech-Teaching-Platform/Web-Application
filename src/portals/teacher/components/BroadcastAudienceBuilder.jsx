import { useMemo, useState } from "react";
import Chip from "../../../components/ui/Chip";
import ProgressRing from "../../../components/ui/ProgressRing";
import { Avatar } from "./BroadcastShared";
import { AlertTriangleIcon, ChevronDownIcon, UsersIcon, XIcon } from "../../../components/ui/icons";
import { LARGE_AUDIENCE, MENTORSHIP_AUDIENCES, SEGMENTS, emptyAudience, resolveAudience } from "../data/messagingData";

function toggle(list, value) {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function ChipRow({ label, children, empty }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-muted">{label}</p>
      {empty ? <p className="text-xs text-muted">{empty}</p> : <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

const chipCls = "px-3.5 py-1.5 text-xs";

// AudienceBuilder — multi-select audience with a live recipient counter.
// Every include (course, cohort, test series, mentorship, segment, group,
// picked students) is a union; "Don't send to…" exclusions are subtracted.
export default function BroadcastAudienceBuilder({ audience, onChange, env }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const { courses, pool, cohorts, seriesList, mentorships, groups } = env;
  const a = audience;

  const recipients = useMemo(() => resolveAudience(a, env), [a, env]);
  const total = pool.length;
  const pct = total ? Math.round((recipients.length / total) * 100) : 0;
  const eligibleCourses = courses.filter((c) => c.students.length > 0);
  const hasMentees = mentorships.length > 0;
  const exclusionCount = a.exclude.segments.length + a.exclude.courseIds.length + a.exclude.groupIds.length;

  function set(patch) {
    onChange({ ...a, ...patch });
  }
  function setExclude(patch) {
    onChange({ ...a, exclude: { ...a.exclude, ...patch } });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4 rounded-2xl bg-bg p-4">
        <ProgressRing value={pct} size={72} tone="brand" label={`${recipients.length} of ${total} students`} />
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none text-text">{recipients.length}</p>
          <p className="mt-1 text-xs text-muted">
            recipient{recipients.length === 1 ? "" : "s"} of {total} student{total === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPreviewOpen((v) => !v)}
          disabled={recipients.length === 0}
          aria-expanded={previewOpen}
          className="ml-auto flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/[0.07] disabled:text-muted disabled:hover:bg-transparent"
        >
          {previewOpen ? "Hide" : "Preview"} list
          <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${previewOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {recipients.length === 0 && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-danger/[0.07] px-3.5 py-2.5 text-xs font-medium text-danger">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          This audience has no recipients yet. Pick at least one course, segment, group or "All my students".
        </div>
      )}
      {recipients.length > LARGE_AUDIENCE && (
        <div className="flex items-start gap-2.5 rounded-xl bg-warning/10 px-3.5 py-2.5 text-xs font-medium text-warning">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          This is a very large audience ({recipients.length} students). You'll be asked to confirm before sending.
        </div>
      )}

      {previewOpen && recipients.length > 0 && (
        <div className="rounded-2xl border border-text/10 bg-white p-2">
          <div className="grid max-h-56 grid-cols-1 gap-0.5 overflow-y-auto sm:grid-cols-2">
            {recipients.slice(0, 60).map((s) => (
              <div key={s.id} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5">
                <Avatar name={s.name} size="xs" />
                <span className="min-w-0 flex-1 truncate text-sm text-text">{s.name}</span>
                <span className="shrink-0 text-[11px] text-muted">{s.progress}%</span>
              </div>
            ))}
          </div>
          {recipients.length > 60 && <p className="px-2.5 pt-1 text-[11px] text-muted">+{recipients.length - 60} more not shown</p>}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <ChipRow label="Everyone">
          <Chip active={a.everyone} onClick={() => set({ everyone: !a.everyone })} className={chipCls}>
            All my students
          </Chip>
        </ChipRow>

        {a.studentIds.length > 0 && (
          <ChipRow label="Added from another screen">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white">
              <UsersIcon className="h-3.5 w-3.5" />
              {a.studentIds.length} selected student{a.studentIds.length === 1 ? "" : "s"}
              {a.studentSource ? ` · ${a.studentSource.replace(/-/g, " ")}` : ""}
              <button type="button" aria-label="Remove selected students" onClick={() => set({ studentIds: [], studentSource: "" })} className="rounded-full p-0.5 hover:bg-white/20">
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          </ChipRow>
        )}

        <ChipRow label="By course" empty={eligibleCourses.length ? null : "No courses with students yet."}>
          {eligibleCourses.map((c) => (
            <Chip key={c.id} active={a.courseIds.includes(c.id)} onClick={() => set({ courseIds: toggle(a.courseIds, c.id) })} className={chipCls}>
              {c.title}
            </Chip>
          ))}
        </ChipRow>

        <ChipRow label="By batch / cohort" empty={cohorts.length ? null : "No cohorts yet."}>
          {cohorts.map((c) => (
            <Chip key={c.id} active={a.cohortIds.includes(c.id)} onClick={() => set({ cohortIds: toggle(a.cohortIds, c.id) })} className={chipCls}>
              {c.label}
            </Chip>
          ))}
        </ChipRow>

        <ChipRow label="By test series enrolment" empty={seriesList.length ? null : "No test series yet."}>
          {seriesList.map((s) => (
            <Chip key={s.id} active={a.seriesIds.includes(s.id)} onClick={() => set({ seriesIds: toggle(a.seriesIds, s.id) })} className={chipCls}>
              {s.title}
            </Chip>
          ))}
        </ChipRow>

        <ChipRow label="By mentorship program" empty={hasMentees ? null : "No mentees yet."}>
          {MENTORSHIP_AUDIENCES.map((m) => (
            <Chip key={m.key} active={a.mentorship.includes(m.key)} onClick={() => set({ mentorship: toggle(a.mentorship, m.key) })} className={chipCls}>
              {m.label}
            </Chip>
          ))}
        </ChipRow>

        <ChipRow label="By student segment">
          {SEGMENTS.map((s) => (
            <Chip key={s.key} active={a.segments.includes(s.key)} onClick={() => set({ segments: toggle(a.segments, s.key) })} className={chipCls}>
              {s.label}
            </Chip>
          ))}
        </ChipRow>

        <ChipRow label="By custom group" empty={groups.length ? null : "Create a group in the Groups tab."}>
          {groups.map((g) => (
            <Chip key={g.id} active={a.groupIds.includes(g.id)} onClick={() => set({ groupIds: toggle(a.groupIds, g.id) })} className={chipCls}>
              {g.name}
            </Chip>
          ))}
        </ChipRow>
      </div>

      <details className="group rounded-2xl border border-text/10 bg-bg" open={exclusionCount > 0}>
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-text">
          Don't send to…
          <span className="text-xs font-medium text-muted">{exclusionCount > 0 ? `${exclusionCount} excluded` : "Optional"}</span>
        </summary>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <ChipRow label="Segments">
            {SEGMENTS.map((s) => (
              <Chip key={s.key} active={a.exclude.segments.includes(s.key)} onClick={() => setExclude({ segments: toggle(a.exclude.segments, s.key) })} className={chipCls}>
                {s.label}
              </Chip>
            ))}
          </ChipRow>
          <ChipRow label="Courses" empty={eligibleCourses.length ? null : "No courses with students yet."}>
            {eligibleCourses.map((c) => (
              <Chip key={c.id} active={a.exclude.courseIds.includes(c.id)} onClick={() => setExclude({ courseIds: toggle(a.exclude.courseIds, c.id) })} className={chipCls}>
                {c.title}
              </Chip>
            ))}
          </ChipRow>
          <ChipRow label="Groups" empty={groups.length ? null : "No groups yet."}>
            {groups.map((g) => (
              <Chip key={g.id} active={a.exclude.groupIds.includes(g.id)} onClick={() => setExclude({ groupIds: toggle(a.exclude.groupIds, g.id) })} className={chipCls}>
                {g.name}
              </Chip>
            ))}
          </ChipRow>
        </div>
      </details>

      {JSON.stringify(a) !== JSON.stringify(emptyAudience()) && (
        <button type="button" onClick={() => onChange(emptyAudience())} className="self-start text-xs font-semibold text-primary hover:underline">
          Clear audience
        </button>
      )}
    </div>
  );
}
