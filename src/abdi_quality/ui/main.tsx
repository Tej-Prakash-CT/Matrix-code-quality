import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarLayout } from "./routes/layout";
import WelcomePage from "./pages/welcome";
import OverviewPage from "./pages/overview";
import PrDetailPage from "./pages/pr-detail";
import TrendsPage from "./pages/trends";
import TeamPage from "./pages/team";
import SecurityPage from "./pages/security";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<SidebarLayout />}>
          <Route index element={<WelcomePage />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="pr/:prNumber" element={<PrDetailPage />} />
          <Route path="trends" element={<TrendsPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="security" element={<SecurityPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
