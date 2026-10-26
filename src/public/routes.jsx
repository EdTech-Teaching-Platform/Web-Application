import { lazy } from "react";
import { Navigate, Route, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import LandingPage from "./pages/LandingPage";
const SeriesList = lazy(() => import("../portals/student/pages/SeriesList"));
const SeriesDetail = lazy(() => import("../portals/student/pages/SeriesDetail"));

// Public/pre-portal routes — mounted under PublicLayout in
// src/routes/AppRoutes.jsx. Visitors browse published test series through the
// anon RPCs (public_list_series / public_get_series); enrolling and taking a
// test go through /login first.
//
// Course discovery is hidden for now: /explore, /course/:id, /live-classes,
// /instructors and /educator showed mock courses and educators. Their files
// are kept (unmounted) and the routes redirect to the test series list,
// keeping a ?q= search.
function ToPublicSeries() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const q = params.get("q") || params.get("search") || params.get("category") || "";
  return <Navigate to={`/test-series${q ? `?q=${encodeURIComponent(q)}` : ""}`} replace />;
}

// A signed-in student never sees the public chrome: /test-series goes to the
// portal's Test series tab (keeping ?q= etc.) and /test-series/:id to the same
// series inside the portal. Visitors and other roles keep the public pages.
// True when Supabase has a saved session in this browser. Without one the
// visitor is certainly signed out, so there is nothing to wait for.
function hasStoredSession() {
  try {
    return Object.keys(window.localStorage).some((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
  } catch {
    return true; // storage unavailable: keep the old behaviour and wait
  }
}

function StudentAware({ detail = false }) {
  const { user, loading } = useAuth();
  const { search } = useLocation();
  const { seriesId } = useParams();
  if (loading && hasStoredSession()) return null;
  if (user?.role === "student") {
    return <Navigate to={detail ? `/student/test-series/${seriesId}` : `/student/test-series${search}`} replace />;
  }
  return detail ? <SeriesDetail publicMode /> : <SeriesList publicMode />;
}

const publicRoutes = (
  <>
    <Route path="/" element={<LandingPage />} />
    <Route path="/test-series" element={<StudentAware />} />
    <Route path="/test-series/:seriesId" element={<StudentAware detail />} />
    {["/explore", "/course/:courseId", "/live-classes", "/instructors", "/educator"].map((path) => (
      <Route key={path} path={path} element={<ToPublicSeries />} />
    ))}
  </>
);

export default publicRoutes;
