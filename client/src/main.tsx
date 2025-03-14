import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter, Route, Routes } from "react-router";
import EventCreatePage from "./pages/Create.tsx";
import EventCreateDonePage from "./pages/CreateDone.tsx";
import EventSubmissionPage from "./pages/Submission.tsx";
import EventSubmissionDonePage from "./pages/SubmissionDone.tsx";
import EventEditPage from "./pages/Edit.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route index element={<App />} /> {/* ランディングページ */}
        <Route path="new" element={<EventCreatePage />} /> {/* イベント新規作成ページ */}
        <Route path=":eventId">
          <Route index element={<EventCreateDonePage />} /> {/* イベント作成完了ページ (Host用) */}
          <Route path="edit" element={<EventEditPage />} /> {/* イベント編集ページ (Host用) */}
          <Route path="submit">
            <Route index element={<EventSubmissionPage />} /> {/* 日程調整ページ (Guest用) */}
            <Route path="done" element={<EventSubmissionDonePage />} /> {/* 日程調整完了ページ (Guest用) */}
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
