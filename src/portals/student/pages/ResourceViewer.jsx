// PDF / resource viewer
// Jira: Day 7 — PDF / resource viewer
// Doc reference: Sec 5.5, 10.1
//
// TODO: build this screen here. Keep any screen-specific pieces
// (small sub-components, local hooks) inside this same portal folder.
// Only promote something to /src/components if 2+ portals need it.
import BackButton from "../../../components/common/BackButton";

export default function ResourceViewer() {
  return (
    <div className="p-6">
      <BackButton fallback="/student/courseplayer" className="mb-4" />
      <h1 className="text-2xl font-semibold text-slate-900">PDF / resource viewer</h1>
      <p className="mt-2 text-slate-500">TODO: implement — Sec 5.5, 10.1</p>
    </div>
  );
}
