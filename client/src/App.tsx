import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from "react-router";
import SubmissionPage from "./pages/eventId/Submission.tsx";
import HomePage from "./pages/Home.tsx";
import LandingPage from "./pages/Landing.tsx";
import NotFoundPage from "./pages/NotFound.tsx";
import ProjectPage from "./pages/Project.tsx";

/**
 * Nano ID 形式の正規表現。
 * 現在はハイフン・アンダースコアを含まないが、初期は含んでいたため URL の検証時は両方許容する。
 */
const NANOID_REGEX = /^[A-Za-z0-9_-]{21}$/;

/**
 * 旧パス /:eventId から新パス /e/:eventId へのリダイレクト。eventId は Nano ID 形式。
 */
function LegacyEventRedirect() {
  const { eventId } = useParams();
  if (!eventId || !NANOID_REGEX.test(eventId)) {
    return <NotFoundPage />;
  }
  return <Navigate to={`/e/${eventId}`} replace />;
}

/**
 * 旧パス /:eventId/edit から新パス /e/:eventId/edit へのリダイレクト。eventId は Nano ID 形式。
 */
function LegacyEventEditRedirect() {
  const { eventId } = useParams();
  if (!eventId || !NANOID_REGEX.test(eventId)) {
    return <NotFoundPage />;
  }
  return <Navigate to={`/e/${eventId}/edit`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route index element={<LandingPage />} />
        <Route path="home" element={<HomePage />} />
        <Route path="new" element={<ProjectPage />} />

        <Route path="e">
          <Route path=":eventId" element={<Outlet />}>
            <Route index element={<SubmissionPage />} />
            <Route path="edit" element={<ProjectPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>

        {/* /:eventId (旧形式)  を /e/:eventId (新形式) にリダイレクト */}
        <Route path=":eventId" element={<LegacyEventRedirect />} />
        <Route path=":eventId/edit" element={<LegacyEventEditRedirect />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
