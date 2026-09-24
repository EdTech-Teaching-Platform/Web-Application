// Course reviews & ratings
// Jira: Day 15 — Course reviews & ratings
// Doc reference: Sec 5.9
//
// TODO: build this screen here. Keep any screen-specific pieces
// (small sub-components, local hooks) inside this same portal folder.
// Only promote something to /src/components if 2+ portals need it.
import BackButton from "../../../components/common/BackButton";

export default function Reviews() {
  return (
    <div className="p-6">
      <BackButton fallback="/student/explore" className="mb-4" />
      <h1 className="text-2xl font-semibold text-slate-900">Course reviews & ratings</h1>
      <p className="mt-2 text-slate-500">TODO: implement — Sec 5.9</p>
    </div>
  );
}
