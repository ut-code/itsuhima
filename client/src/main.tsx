import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter, Route, Routes } from "react-router";
import Create from "./pages/Create.tsx";
import CreateDone from "./pages/CreateDone.tsx";
import Event from "./pages/Event.tsx";
import EventDone from "./pages/EventDone.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route index element={<App />} />
        <Route path="create">
          <Route index element={<Create />} />
          <Route path="done" element={<CreateDone />} />
        </Route>
        <Route path="events">
          <Route path=":eventId" element={<Event />}>
            <Route path="done" element={<EventDone />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
