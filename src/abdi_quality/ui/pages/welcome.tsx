import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Shield,
  FileSearch,
  Bug,
  Gauge,
  BarChart3,
  ShieldCheck,
  GitPullRequest,
  ArrowRight,
  Activity,
  Target,
  Layers,
} from "lucide-react";

const pages = [
  {
    to: "/overview",
    icon: LayoutDashboard,
    color: "from-blue-500 to-indigo-600",
    bgLight: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    title: "Overview Dashboard",
    description:
      "Bird's-eye view of your codebase health with the latest quality grade, KPI cards, and recent scan activity.",
    highlights: [
      { icon: Target, text: "Quality Grade (A-E)" },
      { icon: Gauge, text: "8 KPI cards with sparkline trends" },
      { icon: Activity, text: "Delta indicators (improvement/regression)" },
      { icon: BarChart3, text: "Top recurring violations" },
    ],
  },
  {
    to: "/team",
    icon: Users,
    color: "from-emerald-500 to-teal-600",
    bgLight: "bg-emerald-50 dark:bg-emerald-950/30",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    title: "Team Health",
    description:
      "Contributor-level insights showing who is submitting code, their pass rates, and team-wide quality metrics.",
    highlights: [
      { icon: Users, text: "Per-author pass rate & bug density" },
      { icon: BarChart3, text: "Pass/Fail breakdown by contributor" },
      { icon: GitPullRequest, text: "Recent scan history" },
      { icon: Target, text: "Team KPIs: scans, pass rate, active authors" },
    ],
  },
  {
    to: "/trends",
    icon: TrendingUp,
    color: "from-violet-500 to-purple-600",
    bgLight: "bg-violet-50 dark:bg-violet-950/30",
    borderColor: "border-violet-200 dark:border-violet-800",
    title: "Trend Analysis",
    description:
      "Track how code quality evolves over time across bugs, duplication, security issues, and technical debt.",
    highlights: [
      { icon: TrendingUp, text: "Multi-metric time-series charts" },
      { icon: Layers, text: "Bugs, duplication, hotspots" },
      { icon: Activity, text: "Tech debt ratio trend" },
      { icon: Target, text: "Scan-over-scan comparison" },
    ],
  },
  {
    to: "/security",
    icon: Shield,
    color: "from-rose-500 to-red-600",
    bgLight: "bg-rose-50 dark:bg-rose-950/30",
    borderColor: "border-rose-200 dark:border-rose-800",
    title: "Security Dashboard",
    description:
      "OWASP Top 10 mapping, vulnerability severity breakdown, secret detection, and recurring security violations.",
    highlights: [
      { icon: ShieldCheck, text: "OWASP Top 10 category mapping" },
      { icon: Bug, text: "Severity distribution (High/Medium/Low)" },
      { icon: FileSearch, text: "Filterable findings table" },
      { icon: BarChart3, text: "Top recurring security violations" },
    ],
  },
  {
    to: "/pr/42",
    icon: GitPullRequest,
    color: "from-amber-500 to-orange-600",
    bgLight: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800",
    title: "PR Detail View",
    description:
      "Deep dive into any pull request: certification status, per-tool findings, severity breakdowns, and AI review.",
    highlights: [
      { icon: Target, text: "Pass/Fail certification with quality grade" },
      { icon: Gauge, text: "Issues donut & severity breakdowns" },
      { icon: Layers, text: "Ruff & Bandit breakdowns" },
      { icon: FileSearch, text: "Expandable finding details per tool" },
    ],
  },
];

const toolsBadges = [
  { name: "Gitleaks", desc: "Secret Detection" },
  { name: "jscpd", desc: "Code Duplication" },
  { name: "Semgrep", desc: "Bug Detection" },
  { name: "Bandit", desc: "Security Analysis" },
  { name: "Ruff", desc: "Fast Linting + Pylint rules" },
];

export default function WelcomePage() {
  return (
    <div className="max-w-6xl mx-auto space-y-10">
      {/* Hero */}
      <div className="text-center space-y-3 pt-4 pb-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
          <Activity size={12} />
          Code Quality Assurance Platform
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          MATRIX
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Comprehensive code quality monitoring for the Autobacs Teradata-to-Databricks migration.
          8 scanning tools, automated PR gates, and actionable insights.
        </p>
      </div>

      {/* Scanner Tools Strip */}
      <div className="bg-card rounded-xl p-5 shadow-sm border border-border">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 text-center">
          Integrated Scanning Tools
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          {toolsBadges.map((tool) => (
            <div
              key={tool.name}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium"
            >
              <span className="font-semibold">{tool.name}</span>
              <span className="text-muted-foreground">{tool.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Page Cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-center">Dashboard Pages</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pages.map((page) => {
            const Icon = page.icon;
            return (
              <Link
                key={page.to}
                to={page.to}
                className={`group block rounded-xl border ${page.borderColor} ${page.bgLight} p-5 transition-all hover:shadow-md hover:scale-[1.01]`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon circle */}
                  <div
                    className={`shrink-0 w-11 h-11 rounded-lg bg-gradient-to-br ${page.color} flex items-center justify-center text-white shadow-sm`}
                  >
                    <Icon size={20} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-base">{page.title}</h3>
                      <ArrowRight
                        size={14}
                        className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                      {page.description}
                    </p>

                    {/* Highlight chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {page.highlights.map((h) => {
                        const HIcon = h.icon;
                        return (
                          <span
                            key={h.text}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background/80 text-xs text-muted-foreground border border-border/50"
                          >
                            <HIcon size={10} />
                            {h.text}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
        <h2 className="text-lg font-semibold mb-4 text-center">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            {
              step: "1",
              title: "PR Opened",
              desc: "Developer opens a pull request in Azure DevOps",
              color: "bg-blue-500",
            },
            {
              step: "2",
              title: "8 Scanners Run",
              desc: "CI pipeline runs Gitleaks, Semgrep, Bandit, Ruff, jscpd",
              color: "bg-violet-500",
            },
            {
              step: "3",
              title: "Report Generated",
              desc: "Results aggregated into unified JSON and uploaded to Databricks UC Volume",
              color: "bg-amber-500",
            },
            {
              step: "4",
              title: "Dashboard Updated",
              desc: "MATRIX reads reports, computes KPIs (bugs/KLOC, TDR, grade), and renders dashboards",
              color: "bg-emerald-500",
            },
          ].map((item) => (
            <div key={item.step} className="text-center space-y-2">
              <div
                className={`w-9 h-9 rounded-full ${item.color} text-white font-bold text-sm flex items-center justify-center mx-auto`}
              >
                {item.step}
              </div>
              <h3 className="font-semibold text-sm">{item.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Legend */}
      <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
        <h2 className="text-lg font-semibold mb-4 text-center">Key Metrics Explained</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Quality Grade",
              desc: "A-E composite score: Reliability (30%), Security (30%), Maintainability (25%), Duplication (15%).",
            },
            {
              label: "Bugs / KLOC",
              desc: "Severity-filtered Semgrep findings per 1,000 lines of code. Only findings at or above the admin min severity are counted. \u2264 0.0 is good, > 5.0 is critical (admin-configurable).",
            },
            {
              label: "Tech Debt Ratio",
              desc: "Estimated remediation cost vs development cost. \u2264 10% is good, > 50% is critical. Based on weighted tool findings (admin-configurable).",
            },
            {
              label: "Vulns / KLOC",
              desc: "Severity-filtered Bandit security findings per 1,000 lines. Only findings at or above the admin min severity are counted. \u2264 0.0 is good, > 3.0 is critical (admin-configurable).",
            },
            {
              label: "Duplication",
              desc: "Percentage of identical code blocks (jscpd). \u2264 20% is good, > 20% needs refactoring (admin-configurable).",
            },
            {
              label: "Hotspots",
              desc: "Sum of Ruff errors (includes ported Pylint PL rules). \u2264 5 is good, > 10 is critical (admin-configurable).",
            },
            {
              label: "OWASP Mapping",
              desc: "Bandit findings mapped to OWASP Top 10 2021 categories for security audit compliance.",
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className="p-3 rounded-lg bg-secondary/50 border border-border/50"
            >
              <h3 className="font-semibold text-sm mb-1">{metric.label}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {metric.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground pb-4">
        MATRIX v2.0 — FastAPI + React + Recharts
      </p>
    </div>
  );
}
