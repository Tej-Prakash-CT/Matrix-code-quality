import { Outlet, NavLink } from "react-router-dom";
import {
  Home,
  LayoutDashboard,
  Users,
  TrendingUp,
  Shield,
  Moon,
  Sun,
} from "lucide-react";
import { useState, useEffect } from "react";

const navItems = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/team", label: "Team Health", icon: Users },
  { to: "/trends", label: "Trends", icon: TrendingUp },
  { to: "/security", label: "Security", icon: Shield },
];

export function SidebarLayout() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-card p-4 flex flex-col">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight">MATRIX</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Code Quality Platform
          </p>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
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
              {label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={() => setDark((d) => !d)}
          className="mt-auto flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
          {dark ? "Light Mode" : "Dark Mode"}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-background p-6">
        <Outlet />
      </main>
    </div>
  );
}
