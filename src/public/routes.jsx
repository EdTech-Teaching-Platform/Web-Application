import { Navigate, Route, useLocation } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import SeriesList from "../portals/student/pages/SeriesList";
import SeriesDetail from "../portals/student/pages/SeriesDetail";

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

const publicRoutes = (
  <>
    <Route path="/" element={<LandingPage />} />
    <Route path="/test-series" element={<SeriesList publicMode />} />
    <Route path="/test-series/:seriesId" element={<SeriesDetail publicMode />} />
    {["/explore", "/course/:courseId", "/live-classes", "/instructors", "/educator"].map((path) => (
      <Route key={path} path={path} element={<ToPublicSeries />} />
    ))}
  </>
);

export default publicRoutes;
