import { useEffect, useState } from "react";
import { api, type SecurityOverviewOut, type ToolFinding } from "@/lib/api";
import { formatNumber, getSeverityColor } from "@/lib/formatters";
import { Shield, AlertTriangle, Lock, Bug } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

const SEVERITY_COLORS: Record<string, string> = {
  high: "#ef4444",
  medium: "#f97316",
  low: "#eab308",
};

export default function SecurityPage() {
  const [data, setData] = useState<SecurityOverviewOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOwasp, setExpandedOwasp] = useState<string | null>(null);
  const findingsFilter = "high";
  // Selected severity bar in the Bandit Severity Distribution chart — clicking
  // a bar toggles an inline drill-down panel grouped by file.
  const [selectedBanditSeverity, setSelectedBanditSeverity] =
    useState<string | null>(null);

  useEffect(() => {
    api
      .getSecurityOverview()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SecuritySkeleton />;
  if (error)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive font-medium">
            Failed to load security data
          </p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  if (!data)
    return (
      <p className="text-muted-foreground">No security data available.</p>
    );

  // Bandit severity distribution — rendered as a clickable bar chart.
  // Each bar carries both the severity key (lowercase, used for lookups
  // into allFindings) and a display name.
  const banditBarData = [
    { severity: "high",   name: "High",   count: data.bandit_severity.high,   fill: SEVERITY_COLORS.high   },
    { severity: "medium", name: "Medium", count: data.bandit_severity.medium, fill: SEVERITY_COLORS.medium },
    { severity: "low",    name: "Low",    count: data.bandit_severity.low,    fill: SEVERITY_COLORS.low    },
  ].filter((d) => d.count > 0);

  // Collect all findings from OWASP categories for the findings table
  const allFindings: (ToolFinding & { owasp_category: string })[] =
    data.owasp_categories.flatMap((cat) =>
      cat.findings.map((f) => ({ ...f, owasp_category: cat.category_id }))
    );

  const filteredFindings = allFindings.filter(
    (f) => f.severity.toLowerCase() === findingsFilter,
  );

  const kpiCards = [
    {
      label: "Total Vulnerabilities",
      value: formatNumber(data.total_vulnerabilities),
      icon: Bug,
      color:
        data.total_vulnerabilities === 0
          ? "border-green-500"
          : "border-red-500",
    },
    {
      label: "Total Secrets",
      value: formatNumber(data.total_secrets),
      icon: Lock,
      color:
        data.total_secrets === 0 ? "border-green-500" : "border-red-500",
    },
    {
      label: "High Severity",
      value: formatNumber(data.bandit_severity.high),
      icon: AlertTriangle,
      color:
        data.bandit_severity.high === 0
          ? "border-green-500"
          : "border-red-500",
    },
    {
      label: "OWASP Categories",
      value: data.owasp_categories.length.toString(),
      icon: Shield,
      color: "border-purple-500",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Security Overview</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Vulnerability analysis, secret detection, and OWASP categorization
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className={`bg-card rounded-lg p-4 shadow-sm border-b-4 ${card.color}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <card.icon size={14} className="text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {card.label}
              </span>
            </div>
            <div className="text-2xl font-bold">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Bandit Severity Distribution — clickable bar chart. Clicking a bar
          selects that severity and opens an inline drill-down grouped by
          file so reviewers can see exactly where the issues live.
          (Top Recurring Violations and the OWASP Categories bar chart were
          removed from this page to avoid leading with negative messaging.) */}
      <div className="bg-card rounded-lg p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <div>
            <h2 className="text-lg font-semibold">
              Bandit Severity Distribution
              <span className="text-xs text-muted-foreground ml-2">
                ({data.bandit_severity.notebook_count} notebooks scanned)
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Click a bar to see which files contain findings at that severity.
            </p>
          </div>
          {selectedBanditSeverity && (
            <button
              onClick={() => setSelectedBanditSeverity(null)}
              className="text-xs px-2.5 py-1 rounded-full border border-border hover:bg-accent transition-colors"
            >
              Clear selection
            </button>
          )}
        </div>

        {banditBarData.length > 0 ? (
          <>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={banditBarData}
                  margin={{ left: 10, right: 20, top: 10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fontWeight: 600 }}
                    stroke="var(--color-muted-foreground)"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    stroke="var(--color-muted-foreground)"
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-accent)", opacity: 0.2 }}
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "0.375rem",
                      color: "var(--color-foreground)",
                    }}
                    formatter={(value: number) => [`${value} findings`, "Count"]}
                    labelFormatter={(label: string) =>
                      `${label} severity — click to view files`
                    }
                  />
                  <Bar
                    dataKey="count"
                    radius={[6, 6, 0, 0]}
                    onClick={(payload) => {
                      const sev = (payload as { severity?: string })?.severity;
                      if (!sev) return;
                      setSelectedBanditSeverity((cur) =>
                        cur === sev ? null : sev
                      );
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    {banditBarData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.fill}
                        fillOpacity={
                          selectedBanditSeverity &&
                          selectedBanditSeverity !== d.severity
                            ? 0.35
                            : 1
                        }
                        stroke={
                          selectedBanditSeverity === d.severity
                            ? "var(--color-foreground)"
                            : undefined
                        }
                        strokeWidth={
                          selectedBanditSeverity === d.severity ? 2 : 0
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Drill-down: files contributing to the selected severity.
                Built from allFindings (OWASP-mapped) filtered by severity.
                Medium/Low findings may not appear here if the admin severity
                policy filters them out server-side — in that case we show a
                short note so the user isn't left wondering. */}
            {selectedBanditSeverity && (() => {
              const sev = selectedBanditSeverity;
              const rows = allFindings.filter(
                (f) => f.severity.toLowerCase() === sev
              );
              const fileGroups = (() => {
                const g: Record<string, typeof rows> = {};
                for (const r of rows) (g[r.file || "(unknown)"] ??= []).push(r);
                return Object.entries(g).sort((a, b) => b[1].length - a[1].length);
              })();
              const totalAtSeverity =
                sev === "high"
                  ? data.bandit_severity.high
                  : sev === "medium"
                  ? data.bandit_severity.medium
                  : data.bandit_severity.low;

              return (
                <div className="mt-4 border border-border/50 rounded-md">
                  <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 border-b border-border/50">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getSeverityColor(sev)}`}
                    >
                      {sev}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {rows.length} of {totalAtSeverity} finding
                      {totalAtSeverity !== 1 ? "s" : ""} across{" "}
                      {fileGroups.length} file
                      {fileGroups.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {rows.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-3 py-3">
                      No individual findings available for this severity.
                      {sev !== "high" &&
                        " The admin severity policy may be filtering low/medium details out of the API response."}
                    </p>
                  ) : (
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-background">
                          <tr className="border-b border-border text-left text-muted-foreground">
                            <th className="pb-1.5 pt-1.5 px-3 font-medium text-xs">
                              File
                            </th>
                            <th className="pb-1.5 pt-1.5 px-3 font-medium text-xs text-right">
                              Findings
                            </th>
                            <th className="pb-1.5 pt-1.5 px-3 font-medium text-xs">
                              Lines
                            </th>
                            <th className="pb-1.5 pt-1.5 px-3 font-medium text-xs">
                              Top rule
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {fileGroups.map(([file, items]) => {
                            const lines = items
                              .map((i) => i.line)
                              .filter(Boolean)
                              .sort((a, b) => a - b)
                              .slice(0, 5)
                              .join(", ");
                            const topRule =
                              items[0]?.rule_name || items[0]?.rule_id || "";
                            return (
                              <tr
                                key={file}
                                className="border-b border-border/30 align-top"
                              >
                                <td className="py-1.5 px-3 font-mono text-xs break-all">
                                  {file}
                                </td>
                                <td className="py-1.5 px-3 text-right font-mono text-xs">
                                  {items.length}
                                </td>
                                <td className="py-1.5 px-3 font-mono text-xs text-muted-foreground">
                                  {lines || "—"}
                                </td>
                                <td className="py-1.5 px-3 text-xs">
                                  {topRule}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        ) : (
          <div className="h-40 flex items-center justify-center">
            <p className="text-muted-foreground">No security findings detected</p>
          </div>
        )}
      </div>

      {/* OWASP Category Expandable Details */}
      {data.owasp_categories.length > 0 && (
        <div className="bg-card rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">
            OWASP Category Details
          </h2>
          <div className="space-y-2">
            {data.owasp_categories.map((cat) => (
              <div key={cat.category_id} className="border border-border rounded-md">
                <button
                  onClick={() =>
                    setExpandedOwasp(
                      expandedOwasp === cat.category_id
                        ? null
                        : cat.category_id
                    )
                  }
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold bg-muted px-2 py-0.5 rounded">
                      {cat.category_id}
                    </span>
                    <span className="text-sm font-medium">{cat.category}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {cat.count} finding{cat.count !== 1 ? "s" : ""}
                  </span>
                </button>
                {expandedOwasp === cat.category_id && (
                  <div className="border-t border-border p-3">
                    {cat.findings.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No individual findings.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-left text-muted-foreground">
                              <th className="pb-2 font-medium">Rule</th>
                              <th className="pb-2 font-medium">Severity</th>
                              <th className="pb-2 font-medium">Source</th>
                              <th className="pb-2 font-medium">File</th>
                              <th className="pb-2 font-medium text-right">
                                Line
                              </th>
                              <th className="pb-2 font-medium">Message</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cat.findings.map((f, i) => (
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
                                <td className="py-1.5 text-xs">{f.source}</td>
                                <td className="py-1.5 font-mono text-xs max-w-[200px] truncate">
                                  {f.file}
                                </td>
                                <td className="py-1.5 text-right font-mono text-xs">
                                  {f.line}
                                </td>
                                <td className="py-1.5 text-xs max-w-[250px] truncate">
                                  {f.message}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Findings Table with Filter */}
      {allFindings.length > 0 && (
        <div className="bg-card rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">All Security Findings</h2>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 font-medium">OWASP</th>
                  <th className="pb-2 font-medium">Rule</th>
                  <th className="pb-2 font-medium">Severity</th>
                  <th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 font-medium">File</th>
                  <th className="pb-2 font-medium text-right">Line</th>
                  <th className="pb-2 font-medium">Message</th>
                </tr>
              </thead>
              <tbody>
                {filteredFindings.map((f, i) => (
                  <tr
                    key={`${f.owasp_category}-${f.rule_id}-${f.file}-${f.line}-${i}`}
                    className="border-b border-border/50"
                  >
                    <td className="py-1.5 font-mono text-xs font-bold">
                      {f.owasp_category}
                    </td>
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
                    <td className="py-1.5 text-xs">{f.source}</td>
                    <td className="py-1.5 font-mono text-xs max-w-[180px] truncate">
                      {f.file}
                    </td>
                    <td className="py-1.5 text-right font-mono text-xs">
                      {f.line}
                    </td>
                    <td className="py-1.5 text-xs max-w-[250px] truncate">
                      {f.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SecuritySkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      <div>
        <div className="h-7 w-44 bg-muted rounded mb-2" />
        <div className="h-4 w-72 bg-muted rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-card rounded-lg p-4 shadow-sm border-b-4 border-muted"
          >
            <div className="h-3 w-24 bg-muted rounded mb-2" />
            <div className="h-7 w-12 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-lg p-4 shadow-sm h-72 bg-muted" />
        <div className="bg-card rounded-lg p-4 shadow-sm h-72 bg-muted" />
      </div>
      <div className="bg-card rounded-lg p-4 shadow-sm h-72 bg-muted" />
    </div>
  );
}
