import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  Home,
  LayoutDashboard,
  Users,
  TrendingUp,
  Shield,
  Moon,
  Sun,
  Settings,
} from "lucide-react";
import { useState, useEffect } from "react";
import { hasAdminToken } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { DownloadReportButton } from "@/components/ui/download-report-button";

export function SidebarLayout() {
  const location = useLocation();
  const t = useT();
  const navItems = [
    { to: "/", labelKey: "nav.home", icon: Home, end: true },
    { to: "/overview", labelKey: "nav.overview", icon: LayoutDashboard },
    { to: "/team", labelKey: "nav.team", icon: Users },
    { to: "/trends", labelKey: "nav.trends", icon: TrendingUp },
    { to: "/security", labelKey: "nav.security", icon: Shield },
  ];
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });
  const [isAdmin, setIsAdmin] = useState<boolean>(() => hasAdminToken());

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Re-read token on route changes so the Admin link appears right after login.
  useEffect(() => {
    setIsAdmin(hasAdminToken());
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-card p-4 flex flex-col">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight">MATRIX</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("app.subtitle")}
          </p>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map(({ to, labelKey, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`
              }
            >
              <Icon size={16} />
              {t(labelKey)}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`
              }
            >
              <Settings size={16} />
              {t("nav.admin")}
            </NavLink>
          )}
        </nav>

        {/* Bottom controls: download report, theme */}
        <div className="mt-auto pt-2 border-t border-border space-y-1">
          <DownloadReportButton source={{ kind: "dashboard" }} />
          <button
            onClick={() => setDark((d) => !d)}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
            {dark ? t("ui.lightMode") : t("ui.darkMode")}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-background p-6">
        <Outlet />
      </main>
    </div>
  );
}
