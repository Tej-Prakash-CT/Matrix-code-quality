import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  api,
  type ScanDetailOut,
  type ScanSummaryOut,
  type ToolFinding,
  type GradeBreakdownOut,
} from "@/lib/api";
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
import { DownloadReportButton } from "@/components/ui/download-report-button";
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
  Info,
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
  countLabel,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  count: number;
  /** Override the default "{n} items" label — e.g. to emphasize blocking errors. */
  countLabel?: React.ReactNode;
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
        <span className="ml-auto text-sm">
          {countLabel ?? (
            <span className="text-muted-foreground">
              {count} {count === 1 ? "item" : "items"}
            </span>
          )}
        </span>
      </button>
      {open && <div className="border-t border-border p-4">{children}</div>}
    </div>
  );
}

function GradeBreakdownPanel({
  breakdown,
  status,
}: {
  breakdown: GradeBreakdownOut;
  status: "pass" | "fail";
}) {
  const visible = breakdown.dimensions.filter((d) => d.weight > 0);
  return (
    <div className="bg-card rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
        <div>
          <h2 className="text-lg font-semibold">Grade Breakdown</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            How this PR's letter grade is calculated. Each dimension contributes
            <span className="font-mono"> score × weight</span>; the sum maps to a
            grade (A ≥ 95, B ≥ 85, C ≥ 70, D ≥ 50, E &lt; 50).
            {" "}
            <strong>Failing PRs are floored at grade {breakdown.cap_grade}</strong>
            {" "}so a failing PR can never be labelled Excellent or Good.
          </p>
        </div>
        <div className="flex items-center gap-3 text-right">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Weighted total
            </div>
            <div className="text-xl font-semibold font-mono">
              {breakdown.weighted_total.toFixed(1)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Grade
            </div>
            <div
              className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-white font-bold ${getGradeColor(breakdown.final_grade)}`}
            >
              {breakdown.final_grade}
            </div>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="pb-2 font-medium">Dimension</th>
              <th className="pb-2 font-medium">Raw value</th>
              <th className="pb-2 font-medium text-right">Score</th>
              <th className="pb-2 font-medium text-right">Weight</th>
              <th className="pb-2 font-medium text-right">Contribution</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((d) => (
              <tr key={d.name} className="border-b border-border/50">
                <td className="py-2 font-medium">{d.name}</td>
                <td className="py-2 text-muted-foreground">{d.raw_value}</td>
                <td className="py-2 text-right font-mono">{d.score.toFixed(0)}</td>
                <td className="py-2 text-right font-mono">{(d.weight * 100).toFixed(0)}%</td>
                <td className="py-2 text-right font-mono">{d.contribution.toFixed(1)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-2" colSpan={4}>
                Weighted total
              </td>
              <td className="py-2 text-right font-mono">
                {breakdown.weighted_total.toFixed(1)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {breakdown.fail_cap_applied && (
        <div className="mt-3 text-xs rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-3 py-2">
          <strong>Fail cap applied:</strong> weighted score is{" "}
          <span className="font-mono">{breakdown.weighted_total.toFixed(1)}</span>
          {" "}(would be grade {breakdown.base_grade}), but this PR is{" "}
          <span className="font-semibold">{status.toUpperCase()}</span>, so the grade
          is floored to {breakdown.cap_grade}.
        </div>
      )}
    </div>
  );
}

// Canonical severity rank — matches backend admin_config._SEVERITY_RANK so the
// UI can sort and filter consistently across tools with different vocabularies
// (bandit: low/medium/high; pylint: convention/refactor/warning/error).
const SEVERITY_RANK: Record<string, number> = {
  error: 3, fatal: 3, critical: 3, high: 3,
  warning: 2, medium: 2,
  convention: 1, refactor: 1, info: 1, low: 1,
};

function severityRank(s: string): number {
  return SEVERITY_RANK[(s || "").toLowerCase()] ?? 0;
}

function FindingsTable({
  findings,
  defaultFilter,
}: {
  findings: ToolFinding[];
  /** Preselect a severity filter (e.g. "error" for pylint so the 6 blocking
   *  errors are visible immediately without scrolling the full list). */
  defaultFilter?: string;
}) {
  // Build counts and the set of distinct severities present.
  const { counts, severities } = (() => {
    const c: Record<string, number> = {};
    for (const f of findings) {
      const s = (f.severity || "unknown").toLowerCase();
      c[s] = (c[s] || 0) + 1;
    }
    const sevs = Object.keys(c).sort(
      (a, b) => severityRank(b) - severityRank(a)
    );
    return { counts: c, severities: sevs };
  })();

  // If the requested default filter has no findings, fall back to "all" so the
  // section doesn't look empty.
  const safeDefault =
    defaultFilter && counts[defaultFilter.toLowerCase()]
      ? defaultFilter.toLowerCase()
      : "all";
  const [filter, setFilter] = useState<string>(safeDefault);
  const [groupByFile, setGroupByFile] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const filtered = (() => {
    const list =
      filter === "all"
        ? findings
        : findings.filter(
            (f) => (f.severity || "").toLowerCase() === filter
          );
    // Always highest severity first, then file, then line — stable + useful.
    return [...list].sort((a, b) => {
      const r = severityRank(b.severity) - severityRank(a.severity);
      if (r !== 0) return r;
      const fc = (a.file || "").localeCompare(b.file || "");
      if (fc !== 0) return fc;
      return (a.line || 0) - (b.line || 0);
    });
  })();

  // Group findings by file path, sorted by count descending.
  const fileGroups = (() => {
    if (!groupByFile) return [];
    const groups: Record<string, ToolFinding[]> = {};
    for (const f of filtered) {
      const key = f.file || "(unknown)";
      (groups[key] ??= []).push(f);
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  })();

  const toggleFile = (file: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  };

  if (findings.length === 0)
    return (
      <p className="text-sm text-muted-foreground">No findings in this category.</p>
    );

  return (
    <div className="space-y-3">
      {/* Severity filter pills + group-by-file toggle */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setFilter("all")}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            filter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          All <span className="opacity-70">({findings.length})</span>
        </button>
        {severities.map((s) => {
          const active = filter === s;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                active
                  ? getSeverityColor(s) + " ring-2 ring-offset-1 ring-current/40"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {s} <span className="opacity-70 ml-1">({counts[s]})</span>
            </button>
          );
        })}

        {/* Separator + group toggle */}
        <span className="mx-1 text-border">|</span>
        <button
          onClick={() => {
            setGroupByFile((v) => !v);
            setExpandedFiles(new Set());
          }}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            groupByFile
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          <FileCode className="h-3 w-3" />
          Group by file
        </button>
      </div>

      {/* Grouped view */}
      {groupByFile ? (
        <div className="space-y-1">
          {fileGroups.map(([file, items]) => {
            const isOpen = expandedFiles.has(file);
            // Build a mini severity summary for the file header
            const sevSummary: Record<string, number> = {};
            for (const f of items) {
              const s = (f.severity || "unknown").toLowerCase();
              sevSummary[s] = (sevSummary[s] || 0) + 1;
            }
            return (
              <div key={file} className="border border-border/50 rounded-md">
                <button
                  onClick={() => toggleFile(file)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/50 transition-colors"
                >
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="font-mono text-xs truncate flex-1">
                    {file}
                  </span>
                  <span className="shrink-0 flex items-center gap-1.5">
                    {Object.entries(sevSummary)
                      .sort(
                        (a, b) => severityRank(b[0]) - severityRank(a[0])
                      )
                      .map(([sev, count]) => (
                        <span
                          key={sev}
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${getSeverityColor(sev)}`}
                        >
                          {count} {sev}
                        </span>
                      ))}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-3 pb-2 max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-background">
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="pb-1.5 pt-1.5 font-medium text-xs">Rule</th>
                          <th className="pb-1.5 pt-1.5 font-medium text-xs">Severity</th>
                          <th className="pb-1.5 pt-1.5 font-medium text-xs text-right">Line</th>
                          <th className="pb-1.5 pt-1.5 font-medium text-xs">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items
                          .sort((a, b) => (a.line || 0) - (b.line || 0))
                          .map((f, i) => (
                            <tr
                              key={`${f.rule_id}-${f.line}-${i}`}
                              className="border-b border-border/30 align-top"
                            >
                              <td className="py-1 text-xs">
                                <span className="font-medium">
                                  {f.rule_name || f.rule_id}
                                </span>
                                {f.rule_name && f.rule_name !== f.rule_id && (
                                  <span className="ml-1 text-muted-foreground font-mono">
                                    ({f.rule_id})
                                  </span>
                                )}
                              </td>
                              <td className="py-1">
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getSeverityColor(f.severity)}`}
                                >
                                  {f.severity || "unknown"}
                                </span>
                              </td>
                              <td className="py-1 text-right font-mono text-xs">
                                {f.line}
                              </td>
                              <td className="py-1 text-xs whitespace-normal break-words">
                                {f.message}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          {fileGroups.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              No findings match the "{filter}" filter.
            </p>
          )}
        </div>
      ) : (
        /* Flat table view — wrapped in a vertically-scrollable container
           (max-height: ~24rem) so a long findings list scrolls within the
           section instead of extending the whole page. The thead is sticky
           so column labels stay visible while scrolling. */
        <div className="max-h-96 overflow-y-auto overflow-x-auto rounded-md border border-border/50">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 pt-2 px-2 font-medium">Rule</th>
                <th className="pb-2 pt-2 px-2 font-medium">Severity</th>
                <th className="pb-2 pt-2 px-2 font-medium">File</th>
                <th className="pb-2 pt-2 px-2 font-medium text-right">Line</th>
                <th className="pb-2 pt-2 px-2 font-medium">Message</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => (
                <tr
                  key={`${f.rule_id}-${f.file}-${f.line}-${i}`}
                  className="border-b border-border/50 align-top"
                >
                  <td className="py-1.5 px-2 text-xs">
                    <span className="font-medium">{f.rule_name || f.rule_id}</span>
                    {f.rule_name && f.rule_name !== f.rule_id && (
                      <span className="ml-1 text-muted-foreground font-mono">({f.rule_id})</span>
                    )}
                  </td>
                  <td className="py-1.5 px-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getSeverityColor(f.severity)}`}
                    >
                      {f.severity || "unknown"}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 font-mono text-xs max-w-[220px] break-all">
                    {f.file}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-xs">
                    {f.line}
                  </td>
                  {/* Message wraps so long text is fully readable; break-words
                      handles very long unbroken tokens (e.g. identifiers). */}
                  <td className="py-1.5 px-2 text-xs whitespace-normal break-words">
                    {f.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              No findings match the "{filter}" filter.
            </p>
          )}
        </div>
      )}
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
    { name: "Ruff", value: data.ruff_findings.length, color: "#9f7aea" },
    { name: "Bandit", value: data.bandit_findings.length, color: "#ef4444" },
    { name: "Semgrep", value: data.semgrep_findings.length, color: "#f97316" },
    { name: "Gitleaks", value: data.gitleaks_findings.length, color: "#ec4899" },
  ].filter((d) => d.value > 0);

  const visibleKpiCards = data.kpi_cards.filter(
    (k) => !k.label.toLowerCase().includes("coverage")
  );

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
            <DownloadReportButton
              variant="compact"
              source={{ kind: "pr", prNumber: data.pr_number, prefetched: data }}
            />
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

      {/* Grade Breakdown \u2014 shows the math behind the letter grade so a
          non-tech reader can answer "why is this PR in grade X?". Hidden if
          the backend hasn't shipped breakdown data yet (older deployments). */}
      {data.grade_breakdown && (
        <GradeBreakdownPanel breakdown={data.grade_breakdown} status={data.status} />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {visibleKpiCards.map((card) => (
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* Collapsible Findings Sections */}
      <div className="space-y-3">
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
          {data.hidden_bandit_count > 0 && (
            <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 mb-3 text-xs text-blue-700 dark:text-blue-300">
              <Info className="h-3.5 w-3.5 shrink-0" />
              {data.hidden_bandit_count} finding{data.hidden_bandit_count === 1 ? "" : "s"} hidden
              below min severity threshold (admin setting).
            </div>
          )}
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
