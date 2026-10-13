import Switch from "../../../components/ui/Switch";
import IconBadge from "../../../components/ui/IconBadge";
import BundleEditor from "./BundleEditor";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import { emptyBundle } from "../data/bundleData";
import { PackageIcon, TrendingUpIcon, UsersIcon, LayersIcon } from "../../../components/ui/icons";

const BENEFITS = [
  { label: "Higher average order value", Icon: TrendingUpIcon, tone: "bg-pastel-sage text-pastel-sage-ink" },
  { label: "Better student outcomes", Icon: UsersIcon, tone: "bg-pastel-blue text-pastel-blue-ink" },
  { label: "Cross-sell your catalog", Icon: LayersIcon, tone: "bg-pastel-orange text-pastel-orange-ink" },
];

// BundlingStep — Pricing step 4. Reads/writes the educator's bundle for the
// course being edited straight through TeacherCoursesContext, so the draft
// persists across steps and shows up in My Courses > Bundles, the course
// details page and Publish Review without any extra save step.
export default function BundlingStep({ course, locked = false }) {
  const { courses, bundles, saveBundle } = useTeacherCourses();
  const bundle = bundles.find((b) => b.courseIds[0] === course.id);
  const enabled = Boolean(bundle?.enabled);

  function toggle(on) {
    if (on) saveBundle(bundle ? { ...bundle, enabled: true } : emptyBundle(course));
    else if (bundle) saveBundle({ ...bundle, enabled: false });
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-soft sm:p-7">
      <div className="mb-5">
        <span className="eyebrow">Step 4</span>
        <h2 className="mt-1 text-lg font-bold text-text">Bundling</h2>
        <p className="mt-1 text-sm text-muted">Sell this course alongside your other published courses at a combined price.</p>
      </div>

      <Switch
        checked={enabled}
        onChange={toggle}
        disabled={locked}
        label="Offer this course in a bundle"
        description={locked ? "Bundles can't be changed while this course is under review." : "Create a discounted multi-course package that includes this course"}
      />

      {!enabled && (
        <div className="mt-5 flex flex-col gap-5 rounded-3xl bg-gradient-to-br from-pastel-lavender to-pastel-pink/60 p-6 sm:flex-row sm:items-center">
          <IconBadge icon={PackageIcon} tone="maroonSolid" size="lg" />
          <div className="min-w-0">
            <h3 className="text-base font-bold text-text">Bundles turn one sale into several</h3>
            <p className="mt-1 text-sm text-text/70">
              Pair this course with others in your catalog, offer students a saving, and watch your average order grow.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {BENEFITS.map(({ label, Icon, tone }) => (
                <span key={label} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${tone}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {enabled && bundle && (
        <div className="mt-6 border-t border-line pt-6">
          <BundleEditor bundle={bundle} onChange={saveBundle} courses={courses} disabled={locked} />
        </div>
      )}
    </section>
  );
}
