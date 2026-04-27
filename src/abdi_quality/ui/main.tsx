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
import AdminLoginPage from "./pages/admin/login";
import AdminDashboardPage from "./pages/admin/dashboard";
import { I18nProvider } from "./lib/i18n";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          {/* Admin login lives outside the main layout so the sidebar is hidden. */}
          <Route path="admin/login" element={<AdminLoginPage />} />
          <Route element={<SidebarLayout />}>
            <Route index element={<WelcomePage />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="pr/:prNumber" element={<PrDetailPage />} />
            <Route path="trends" element={<TrendsPage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="admin" element={<AdminDashboardPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>
);
