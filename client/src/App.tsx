import { BrowserRouter, Route, Routes } from "react-router";
import RootPage from "./pages/Root.tsx";
import NewPage from "./pages/New.tsx";
import CreateDonePage from "./pages/eventId/CreateDone.tsx";
import SubmissionPage from "./pages/eventId/submit/Submission.tsx";
import SubmissionDonePage from "./pages/eventId/submit/SubmissionDone.tsx";
import EditPage from "./pages/eventId/Edit.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route index element={<RootPage />} />
        <Route path="new" element={<NewPage />} />
        <Route path=":eventId">
          <Route index element={<CreateDonePage />} />
          <Route path="edit" element={<EditPage />} />
          <Route path="submit">
            <Route index element={<SubmissionPage />} />
            <Route path="done" element={<SubmissionDonePage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
