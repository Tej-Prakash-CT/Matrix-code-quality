import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, type ScanDetailOut, type ScanSummaryOut, type ToolFinding } from "@/lib/api";
import {
  formatDate,
  getGradeColor,
  getGradeTextColor,
  getStatusColor,
  getKpiStatusBorder,
  formatDelta,
  formatPercentage,
  formatNumber,
  getSeverityColor,
} from "@/lib/formatters";
import { Sparkline } from "@/components/charts/sparkline";
import {
  ArrowUp,
  ArrowDown,
  Minus,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ArrowLeft,
  Bug,
  Shield,
  Code,
  Copy,
  FileCode,
  TestTube,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  Legend,
} from "recharts";

const SEVERITY_COLORS: Record<string, string> = {
  high: "#ef4444",
  medium: "#f97316",
  low: "#eab308",
  error: "#ef4444",
  errors: "#ef4444",
  warnings: "#f97316",
  conventions: "#3b82f6",
  refactors: "#9f7aea",
};

const ISSUE_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#3b82f6",
  "#9f7aea",
  "#ec4899",
];

function DeltaArrow({
  direction,
  delta,
}: {
  direction: string | null;
  delta: number | null;
}) {
  if (!direction || delta === null)
    return <span className="text-xs text-muted-foreground">{"\u2014"}</span>;
  const isDown = direction === "down";
  const color = isDown
    ? "text-green-500"
    : direction === "up"
      ? "text-red-500"
      : "text-muted-foreground";
  const Icon =
    direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;
  return (
    <span className={`flex items-center gap-0.5 text-xs ${color}`}>
      <Icon size={12} /> {formatDelta(delta)}
    </span>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card rounded-lg shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/50 transition-colors"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <Icon size={16} />
        <span className="font-semibold">{title}</span>
        <span className="ml-auto text-sm text-muted-foreground">
          {count} {count === 1 ? "item" : "items"}
        </span>
      </button>
      {open && <div className="border-t border-border p-4">{children}</div>}
    </div>
  );
}

function FindingsTable({ findings }: { findings: ToolFinding[] }) {
  if (findings.length === 0)
    return (
      <p className="text-sm text-muted-foreground">No findings in this category.</p>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="pb-2 font-medium">Rule</th>
            <th className="pb-2 font-medium">Severity</th>
            <th className="pb-2 font-medium">File</th>
            <th className="pb-2 font-medium text-right">Line</th>
            <th className="pb-2 font-medium">Message</th>
          </tr>
        </thead>
        <tbody>
          {findings.map((f, i) => (
            <tr
              key={`${f.rule_id}-${f.file}-${f.line}-${i}`}
              className="border-b border-border/50"
            >
              <td className="py-1.5 text-xs">
                <span className="font-medium">{f.rule_name || f.rule_id}</span>
                {f.rule_name && f.rule_name !== f.rule_id && (
                  <span className="ml-1 text-muted-foreground font-mono">({f.rule_id})</span>
                )}
              </td>
              <td className="py-1.5">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getSeverityColor(f.severity)}`}
                >
                  {f.severity}
                </span>
              </td>
              <td className="py-1.5 font-mono text-xs max-w-[200px] truncate">
                {f.file}
              </td>
              <td className="py-1.5 text-right font-mono text-xs">
                {f.line}
              </td>
              <td className="py-1.5 text-xs max-w-[300px] truncate">
                {f.message}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrDetailPage() {
  const { prNumber } = useParams<{ prNumber: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ScanDetailOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prList, setPrList] = useState<ScanSummaryOut[]>([]);

  useEffect(() => {
    if (!prNumber) return;
    setLoading(true);
    api
      .getScan(prNumber)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [prNumber]);

  // Load the list of PRs once for the switcher.
  useEffect(() => {
    api
      .listScans()
      .then((scans) => {
        // Dedupe by pr_number, keeping the latest (the list is sorted desc).
        const seen = new Set<string>();
        const unique: ScanSummaryOut[] = [];
        for (const s of scans) {
          if (seen.has(s.pr_number)) continue;
          seen.add(s.pr_number);
          unique.push(s);
        }
        setPrList(unique);
      })
      .catch(() => setPrList([]));
  }, []);

  if (loading) return <PrDetailSkeleton />;
  if (error)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive font-medium">Failed to load scan</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Link to="/" className="text-primary hover:underline text-sm mt-2 inline-block">
            Back to overview
          </Link>
        </div>
      </div>
    );
  if (!data) return <p className="text-muted-foreground">Scan not found.</p>;

  // Prepare chart data
  const issueDonutData = [
    { name: "Pylint", value: data.pylint_findings.length, color: "#3b82f6" },
    { name: "Ruff", value: data.ruff_findings.length, color: "#9f7aea" },
    { name: "Bandit", value: data.bandit_findings.length, color: "#ef4444" },
    { name: "Semgrep", value: data.semgrep_findings.length, color: "#f97316" },
    { name: "SQLFluff", value: data.sqlfluff_findings.length, color: "#14b8a6" },
    { name: "Gitleaks", value: data.gitleaks_findings.length, color: "#ec4899" },
  ].filter((d) => d.value > 0);

  const coverageGaugeData = [
    {
      name: "Coverage",
      value: data.kpi_cards.find((k) => k.label.toLowerCase().includes("coverage"))
        ?.raw_value ?? 0,
      fill: "#4caf50",
    },
  ];

  const pylintBarData = [
    { name: "Errors", value: data.pylint_breakdown.errors, fill: SEVERITY_COLORS.errors },
    { name: "Warnings", value: data.pylint_breakdown.warnings, fill: SEVERITY_COLORS.warnings },
    { name: "Conventions", value: data.pylint_breakdown.conventions, fill: SEVERITY_COLORS.conventions },
    { name: "Refactors", value: data.pylint_breakdown.refactors, fill: SEVERITY_COLORS.refactors },
  ];

  const banditBarData = [
    { name: "High", value: data.bandit_severity.high, fill: SEVERITY_COLORS.high },
    { name: "Medium", value: data.bandit_severity.medium, fill: SEVERITY_COLORS.medium },
    { name: "Low", value: data.bandit_severity.low, fill: SEVERITY_COLORS.low },
  ];

  const notebookSourceData = data.notebook_source_split.map((ns) => ({
    tool: ns.tool,
    Notebooks: ns.notebook_count,
    "Python Files": ns.python_count,
  }));

  const testData = [
    { name: "Passed", value: data.test_results.passed, fill: "#4caf50" },
    { name: "Failed", value: data.test_results.failed, fill: "#ef4444" },
    { name: "Error", value: data.test_results.error, fill: "#f97316" },
    { name: "Skipped", value: data.test_results.skipped, fill: "#a3a3a3" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Back link + PR switcher + Header */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} /> Back to overview
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Currently viewing:
            </span>
            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold">
              PR #{data.pr_number}
            </span>
            <label className="text-xs text-muted-foreground ml-2">
              Switch PR:
            </label>
            <select
              value={data.pr_number}
              onChange={(e) => navigate(`/pr/${e.target.value}`)}
              className="text-sm bg-card border border-border rounded-md px-2 py-1 max-w-[320px]"
            >
              {prList.length === 0 && (
                <option value={data.pr_number}>#{data.pr_number}</option>
              )}
              {prList.map((s) => (
                <option key={s.pr_number} value={s.pr_number}>
                  #{s.pr_number} — {s.author} — {s.status.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl ${getGradeColor(data.quality_grade)}`}
          >
            {data.quality_grade}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">PR #{data.pr_number}</h1>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(data.status)}`}
              >
                {data.status.toUpperCase()}
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              {data.pr_title} &mdash; {data.pr_author}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
              <span className="font-mono">{data.branch}</span>
              <span>{data.commit_sha.slice(0, 8)}</span>
              <span>{formatDate(data.timestamp)}</span>
              {data.workflow_url && (
                <a
                  href={data.workflow_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Workflow <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Technical Debt bar */}
      <div className="bg-card rounded-lg p-4 shadow-sm flex items-center gap-6">
        <div>
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            Technical Debt
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-2xl font-bold ${getGradeTextColor(data.technical_debt.grade)}`}
            >
              {data.technical_debt.grade}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatPercentage(data.technical_debt.ratio_pct)} ratio
            </span>
          </div>
        </div>
        <div className="border-l border-border pl-6">
          <span className="text-xs text-muted-foreground">Remediation</span>
          <p className="font-semibold">
            {data.technical_debt.remediation_minutes}m
          </p>
        </div>
        <div className="border-l border-border pl-6">
          <span className="text-xs text-muted-foreground">Development</span>
          <p className="font-semibold">
            {formatNumber(data.technical_debt.development_minutes)}m
          </p>
        </div>
        <div className="border-l border-border pl-6">
          <span className="text-xs text-muted-foreground">LOC</span>
          <p className="font-semibold">{formatNumber(data.loc)}</p>
        </div>
        <div className="border-l border-border pl-6">
          <span className="text-xs text-muted-foreground">Bugs/kLOC</span>
          <p className="font-semibold">
            {data.bugs_per_kloc !== null ? data.bugs_per_kloc.toFixed(2) : "\u2014"}
          </p>
        </div>
        <div className="border-l border-border pl-6">
          <span className="text-xs text-muted-foreground">Vulns/kLOC</span>
          <p className="font-semibold">
            {data.vulns_per_kloc !== null
              ? data.vulns_per_kloc.toFixed(2)
              : "\u2014"}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.kpi_cards.map((card) => (
          <div
            key={card.label}
            className={`bg-card rounded-lg p-4 shadow-sm ${getKpiStatusBorder(card.status)}`}
            title={card.tooltip}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {card.label}
              </span>
              {card.delta && (
                <DeltaArrow
                  direction={card.delta.direction}
                  delta={card.delta.delta}
                />
              )}
            </div>
            <div className="text-2xl font-bold">{card.value}</div>
            {card.sparkline.length > 0 && (
              <div className="mt-2 h-8">
                <Sparkline data={card.sparkline} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Issues Donut */}
        <div className="bg-card rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Issues by Tool</h3>
          {issueDonutData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={issueDonutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {issueDonutData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "0.375rem",
                      color: "var(--color-foreground)",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px" }}
                    formatter={(value: string) => (
                      <span className="text-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">
              No issues found
            </p>
          )}
          <p className="text-center text-sm text-muted-foreground mt-1">
            {data.total_issues} total issues
          </p>
        </div>

        {/* Coverage Gauge */}
        <div className="bg-card rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Test Coverage</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="90%"
                barSize={12}
                data={coverageGaugeData}
                startAngle={180}
                endAngle={0}
              >
                <RadialBar
                  dataKey="value"
                  cornerRadius={6}
                  background={{ fill: "var(--color-muted)" }}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-2xl font-bold -mt-16">
            {formatPercentage(coverageGaugeData[0].value)}
          </p>
          <p className="text-center text-xs text-muted-foreground mt-1">
            {data.coverage_files.length} files analyzed
          </p>
        </div>

        {/* Test Results */}
        <div className="bg-card rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Test Results</h3>
          {testData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={testData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {testData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "0.375rem",
                      color: "var(--color-foreground)",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px" }}
                    formatter={(value: string) => (
                      <span className="text-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">
              No test data
            </p>
          )}
          <div className="text-center text-xs text-muted-foreground mt-1">
            {data.test_results.total} tests in {data.test_results.duration.toFixed(1)}s
          </div>
        </div>

        {/* Pylint Severity */}
        <div className="bg-card rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">
            Pylint Breakdown
            <span className="text-xs text-muted-foreground ml-2">
              ({data.pylint_breakdown.nb_count} notebooks, {data.pylint_breakdown.py_count} py files)
            </span>
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pylintBarData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "0.375rem",
                    color: "var(--color-foreground)",
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {pylintBarData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bandit Severity */}
        <div className="bg-card rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">
            Bandit Security
            <span className="text-xs text-muted-foreground ml-2">
              ({data.bandit_severity.notebook_count} notebooks)
            </span>
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={banditBarData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "0.375rem",
                    color: "var(--color-foreground)",
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {banditBarData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Notebook vs Source */}
        {notebookSourceData.length > 0 && (
          <div className="bg-card rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-semibold mb-3">
              Notebook vs Python Source
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={notebookSourceData}>
                  <XAxis dataKey="tool" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "0.375rem",
                      color: "var(--color-foreground)",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="Notebooks" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey="Python Files"
                    fill="#14b8a6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Coverage File Table */}
      {data.coverage_files.length > 0 && (
        <div className="bg-card rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Coverage by File</h3>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 font-medium">File</th>
                  <th className="pb-2 font-medium text-right">Statements</th>
                  <th className="pb-2 font-medium text-right">Covered</th>
                  <th className="pb-2 font-medium text-right">Missing</th>
                  <th className="pb-2 font-medium text-right">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {data.coverage_files.map((cf) => (
                  <tr
                    key={cf.file}
                    className="border-b border-border/50"
                  >
                    <td className="py-1.5 font-mono text-xs max-w-[300px] truncate">
                      {cf.file}
                    </td>
                    <td className="py-1.5 text-right">{cf.statements}</td>
                    <td className="py-1.5 text-right">{cf.covered}</td>
                    <td className="py-1.5 text-right">{cf.missing}</td>
                    <td className="py-1.5 text-right font-semibold">
                      <span
                        className={
                          cf.coverage_pct >= 80
                            ? "text-green-500"
                            : cf.coverage_pct >= 50
                              ? "text-yellow-500"
                              : "text-red-500"
                        }
                      >
                        {formatPercentage(cf.coverage_pct)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Collapsible Findings Sections */}
      <div className="space-y-3">
        <CollapsibleSection
          title="Pylint Findings"
          icon={Code}
          count={data.pylint_findings.length}
        >
          <FindingsTable findings={data.pylint_findings} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Ruff Findings"
          icon={Code}
          count={data.ruff_findings.length}
        >
          <FindingsTable findings={data.ruff_findings} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Bandit Security Findings"
          icon={Shield}
          count={data.bandit_findings.length}
        >
          <FindingsTable findings={data.bandit_findings} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Semgrep Findings"
          icon={Bug}
          count={data.semgrep_findings.length}
        >
          <FindingsTable findings={data.semgrep_findings} />
        </CollapsibleSection>

        <CollapsibleSection
          title="SQLFluff Findings"
          icon={FileCode}
          count={data.sqlfluff_findings.length}
        >
          <FindingsTable findings={data.sqlfluff_findings} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Secret Detection (Gitleaks)"
          icon={Shield}
          count={data.gitleaks_findings.length}
        >
          <FindingsTable findings={data.gitleaks_findings} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Code Duplication (JSCPD)"
          icon={Copy}
          count={data.jscpd_duplicates.length}
        >
          {data.jscpd_duplicates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No duplicate code segments detected.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Duplication: {formatPercentage(data.duplication_pct)}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="pb-2 font-medium">File 1</th>
                      <th className="pb-2 font-medium">Lines</th>
                      <th className="pb-2 font-medium">File 2</th>
                      <th className="pb-2 font-medium">Lines</th>
                      <th className="pb-2 font-medium text-right">Size</th>
                      <th className="pb-2 font-medium text-right">Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.jscpd_duplicates.map((dup, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/50"
                      >
                        <td className="py-1.5 font-mono text-xs max-w-[180px] truncate">
                          {dup.file1}
                        </td>
                        <td className="py-1.5 text-xs">
                          {dup.start1}-{dup.end1}
                        </td>
                        <td className="py-1.5 font-mono text-xs max-w-[180px] truncate">
                          {dup.file2}
                        </td>
                        <td className="py-1.5 text-xs">
                          {dup.start2}-{dup.end2}
                        </td>
                        <td className="py-1.5 text-right">{dup.lines}L</td>
                        <td className="py-1.5 text-right">{dup.tokens}T</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CollapsibleSection>

        {data.test_results.failures.length > 0 && (
          <CollapsibleSection
            title="Test Failures"
            icon={TestTube}
            count={data.test_results.failures.length}
          >
            <div className="space-y-2">
              {data.test_results.failures.map((failure, i) => (
                <div
                  key={i}
                  className="bg-red-50 dark:bg-red-950 rounded-md p-3 text-sm"
                >
                  <pre className="whitespace-pre-wrap text-xs font-mono">
                    {JSON.stringify(failure, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {data.ai_review && Object.keys(data.ai_review).length > 0 && (
          <CollapsibleSection
            title="AI Code Review"
            icon={Code}
            count={Object.keys(data.ai_review).length}
          >
            <pre className="text-sm font-mono whitespace-pre-wrap bg-muted/50 p-3 rounded-md">
              {JSON.stringify(data.ai_review, null, 2)}
            </pre>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}

function PrDetailSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="h-4 w-32 bg-muted rounded mb-3" />
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-muted" />
        <div className="flex-1">
          <div className="h-7 w-40 bg-muted rounded mb-2" />
          <div className="h-4 w-64 bg-muted rounded mb-1" />
          <div className="h-3 w-80 bg-muted rounded" />
        </div>
      </div>
      <div className="h-20 bg-card rounded-lg shadow-sm bg-muted" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-card rounded-lg p-4 shadow-sm border-b-4 border-muted"
          >
            <div className="h-3 w-20 bg-muted rounded mb-2" />
            <div className="h-7 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card rounded-lg p-4 shadow-sm h-64 bg-muted" />
        ))}
      </div>
    </div>
  );
}
