import { BrowserRouter, Outlet, Route, Routes } from "react-router";
import RootPage from "./pages/Root.tsx";
import ProjectPage from "./pages/Project.tsx";
import SubmissionPage from "./pages/eventId/Submission.tsx";
import NotFoundPage from "./pages/NotFound.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route index element={<RootPage />} />
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
