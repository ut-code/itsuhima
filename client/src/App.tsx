import { BrowserRouter, Outlet, Route, Routes } from "react-router";
import SubmissionPage from "./pages/eventId/Submission.tsx";
import HomePage from "./pages/Home.tsx";
import LandingPage from "./pages/Landing.tsx";
import NotFoundPage from "./pages/NotFound.tsx";
import ProjectPage from "./pages/Project.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route index element={<LandingPage />} />
        <Route path="home" element={<HomePage />} />
        <Route path="new" element={<ProjectPage />} />
        <Route path=":eventId" element={<Outlet />}>
          <Route index element={<SubmissionPage />} />
          <Route path="edit" element={<ProjectPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
