import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type TeamHealthOut } from "@/lib/api";
import {
  formatDate,
  formatPercentage,
  getStatusColor,
  getGradeColor,
} from "@/lib/formatters";
import { Users, CheckCircle, XCircle, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

type Drilldown = { author: string; status: "pass" | "fail" } | null;

export default function TeamPage() {
  const [data, setData] = useState<TeamHealthOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<Drilldown>(null);

  useEffect(() => {
    api
      .getTeamHealth()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <TeamSkeleton />;
  if (error)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive font-medium">Failed to load team data</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  if (!data)
    return <p className="text-muted-foreground">No team data available.</p>;

  // Stacked bar data for pass/fail by author
  const authorBarData = data.contributors.map((c) => ({
    author: c.author,
    Pass: c.pass_count,
    Fail: c.fail_count,
  }));

  // Radar data for top contributors (normalized 0-100)
  const radarData = data.contributors.slice(0, 5).map((c) => ({
    author: c.author,
    "Pass Rate": c.pass_rate,
    "PR Count": Math.min((c.total_prs / Math.max(...data.contributors.map((x) => x.total_prs))) * 100, 100),
    "Bug-Free": Math.max(0, 100 - c.total_bugs * 10),
    "Sec-Clean": Math.max(0, 100 - c.total_security * 10),
  }));

  const kpiCards = [
    {
      label: "Total Scans",
      value: data.total_scans.toString(),
      icon: BarChart3,
      color: "border-blue-500",
    },
    {
      label: "Pass Rate",
      value: formatPercentage(data.pass_rate),
      icon: CheckCircle,
      color:
        data.pass_rate >= 80
          ? "border-green-500"
          : data.pass_rate >= 50
            ? "border-yellow-500"
            : "border-red-500",
    },
    {
      label: "Failing PRs",
      value: data.failing_prs.toString(),
      icon: XCircle,
      color: data.failing_prs === 0 ? "border-green-500" : "border-red-500",
    },
    {
      label: "Active Authors",
      value: data.active_authors.toString(),
      icon: Users,
      color: "border-purple-500",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Team Health</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Contributor metrics and team-wide quality trends
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pass/Fail by Author */}
        <div className="bg-card rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Pass / Fail by Author</h2>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={authorBarData}
                margin={{ top: 5, right: 10, left: 0, bottom: 30 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                />
                <XAxis
                  dataKey="author"
                  tick={{ fontSize: 10 }}
                  stroke="var(--color-muted-foreground)"
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="var(--color-muted-foreground)"
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "0.375rem",
                    color: "var(--color-foreground)",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar
                  dataKey="Pass"
                  stackId="a"
                  fill="#4caf50"
                  radius={[0, 0, 0, 0]}
                  style={{ cursor: "pointer" }}
                  onClick={(p) => {
                    const author = (p as { author?: string })?.author;
                    if (!author) return;
                    setDrilldown((cur) =>
                      cur && cur.author === author && cur.status === "pass"
                        ? null
                        : { author, status: "pass" },
                    );
                  }}
                />
                <Bar
                  dataKey="Fail"
                  stackId="a"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                  style={{ cursor: "pointer" }}
                  onClick={(p) => {
                    const author = (p as { author?: string })?.author;
                    if (!author) return;
                    setDrilldown((cur) =>
                      cur && cur.author === author && cur.status === "fail"
                        ? null
                        : { author, status: "fail" },
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Click a Pass or Fail segment to see the PRs.
          </p>
        </div>

        {/* Radar Chart */}
        {radarData.length > 0 && (
          <div className="bg-card rounded-lg p-4 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">
              Top Contributors Radar
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={[
                  { metric: "Pass Rate", ...Object.fromEntries(radarData.map((r) => [r.author, r["Pass Rate"]])) },
                  { metric: "PR Count", ...Object.fromEntries(radarData.map((r) => [r.author, r["PR Count"]])) },
                  { metric: "Bug-Free", ...Object.fromEntries(radarData.map((r) => [r.author, r["Bug-Free"]])) },
                  { metric: "Sec-Clean", ...Object.fromEntries(radarData.map((r) => [r.author, r["Sec-Clean"]])) },
                ]}>
                  <PolarGrid stroke="var(--color-border)" />
                  <PolarAngleAxis
                    dataKey="metric"
                    tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fontSize: 9 }}
                  />
                  {radarData.map((r, i) => (
                    <Radar
                      key={r.author}
                      name={r.author}
                      dataKey={r.author}
                      stroke={
                        ["#6366f1", "#14b8a6", "#f97316", "#ec4899", "#eab308"][
                          i % 5
                        ]
                      }
                      fill={
                        ["#6366f1", "#14b8a6", "#f97316", "#ec4899", "#eab308"][
                          i % 5
                        ]
                      }
                      fillOpacity={0.15}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Drill-down panel: PRs filtered by clicked author + status */}
      {drilldown && (
        <div className="bg-card rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">
                {drilldown.status === "pass" ? "Passed" : "Failed"} PRs
              </h2>
              <span className="text-sm text-muted-foreground">
                by <span className="font-medium">{drilldown.author}</span>
              </span>
            </div>
            <button
              onClick={() => setDrilldown(null)}
              className="text-xs px-2.5 py-1 rounded-full border border-border hover:bg-accent transition-colors"
            >
              Clear filter
            </button>
          </div>
          {(() => {
            const filtered = data.recent_scans.filter(
              (s) => s.author === drilldown.author && s.status === drilldown.status,
            );
            if (filtered.length === 0) {
              return (
                <p className="text-sm text-muted-foreground">
                  No {drilldown.status === "pass" ? "passed" : "failed"} PRs by{" "}
                  {drilldown.author} in recent scans.
                </p>
              );
            }
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="pb-2 font-medium">PR</th>
                      <th className="pb-2 font-medium">Branch</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Grade</th>
                      <th className="pb-2 font-medium text-right">Bugs</th>
                      <th className="pb-2 font-medium text-right">Security</th>
                      <th className="pb-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((scan) => (
                      <tr
                        key={`${scan.pr_number}-${scan.commit_sha}`}
                        className="border-b border-border/50 hover:bg-accent/50 transition-colors"
                      >
                        <td className="py-2">
                          <Link
                            to={`/pr/${scan.pr_number}`}
                            className="text-primary hover:underline font-medium"
                          >
                            #{scan.pr_number}
                          </Link>
                        </td>
                        <td className="py-2 font-mono text-xs">{scan.branch}</td>
                        <td className="py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(scan.status)}`}
                          >
                            {scan.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${getGradeColor(scan.quality_grade)}`}
                          >
                            {scan.quality_grade}
                          </span>
                        </td>
                        <td className="py-2 text-right">{scan.bugs}</td>
                        <td className="py-2 text-right">{scan.security}</td>
                        <td className="py-2 text-muted-foreground text-xs">
                          {formatDate(scan.timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* Contributor Table */}
      <div className="bg-card rounded-lg p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Contributors</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 font-medium">Author</th>
                <th className="pb-2 font-medium text-right">PRs</th>
                <th className="pb-2 font-medium text-right">Pass Rate</th>
                <th className="pb-2 font-medium text-right">Bugs</th>
                <th className="pb-2 font-medium text-right">Security</th>
                <th className="pb-2 font-medium text-right">Pass</th>
                <th className="pb-2 font-medium text-right">Fail</th>
              </tr>
            </thead>
            <tbody>
              {data.contributors.map((c) => (
                <tr
                  key={c.author}
                  className="border-b border-border/50 hover:bg-accent/50 transition-colors"
                >
                  <td className="py-2 font-medium">{c.author}</td>
                  <td className="py-2 text-right">{c.total_prs}</td>
                  <td className="py-2 text-right">
                    <span
                      className={
                        c.pass_rate >= 80
                          ? "text-green-500"
                          : c.pass_rate >= 50
                            ? "text-yellow-500"
                            : "text-red-500"
                      }
                    >
                      {formatPercentage(c.pass_rate)}
                    </span>
                  </td>
                  <td className="py-2 text-right">{c.total_bugs}</td>
                  <td className="py-2 text-right">{c.total_security}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      disabled={c.pass_count === 0}
                      onClick={() =>
                        setDrilldown((cur) =>
                          cur && cur.author === c.author && cur.status === "pass"
                            ? null
                            : { author: c.author, status: "pass" },
                        )
                      }
                      className="text-green-500 font-medium enabled:hover:underline enabled:cursor-pointer disabled:opacity-60 disabled:cursor-default"
                      title={
                        c.pass_count > 0
                          ? "Click to view passed PRs by this author"
                          : undefined
                      }
                    >
                      {c.pass_count}
                    </button>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      disabled={c.fail_count === 0}
                      onClick={() =>
                        setDrilldown((cur) =>
                          cur && cur.author === c.author && cur.status === "fail"
                            ? null
                            : { author: c.author, status: "fail" },
                        )
                      }
                      className="text-red-500 font-medium enabled:hover:underline enabled:cursor-pointer disabled:opacity-60 disabled:cursor-default"
                      title={
                        c.fail_count > 0
                          ? "Click to view failed PRs by this author"
                          : undefined
                      }
                    >
                      {c.fail_count}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Scans Table */}
      <div className="bg-card rounded-lg p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Recent Scans</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 font-medium">PR</th>
                <th className="pb-2 font-medium">Author</th>
                <th className="pb-2 font-medium">Branch</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Grade</th>
                <th className="pb-2 font-medium text-right">Bugs</th>
                <th className="pb-2 font-medium text-right">Security</th>
                <th className="pb-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_scans.map((scan) => (
                <tr
                  key={`${scan.pr_number}-${scan.commit_sha}`}
                  className="border-b border-border/50 hover:bg-accent/50 transition-colors"
                >
                  <td className="py-2">
                    <Link
                      to={`/pr/${scan.pr_number}`}
                      className="text-primary hover:underline font-medium"
                    >
                      #{scan.pr_number}
                    </Link>
                  </td>
                  <td className="py-2">{scan.author}</td>
                  <td className="py-2 font-mono text-xs">{scan.branch}</td>
                  <td className="py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(scan.status)}`}
                    >
                      {scan.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${getGradeColor(scan.quality_grade)}`}
                    >
                      {scan.quality_grade}
                    </span>
                  </td>
                  <td className="py-2 text-right">{scan.bugs}</td>
                  <td className="py-2 text-right">{scan.security}</td>
                  <td className="py-2 text-muted-foreground text-xs">
                    {formatDate(scan.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TeamSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      <div>
        <div className="h-7 w-36 bg-muted rounded mb-2" />
        <div className="h-4 w-56 bg-muted rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-card rounded-lg p-4 shadow-sm border-b-4 border-muted"
          >
            <div className="h-3 w-20 bg-muted rounded mb-2" />
            <div className="h-7 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-lg p-4 shadow-sm h-72 bg-muted" />
        <div className="bg-card rounded-lg p-4 shadow-sm h-72 bg-muted" />
      </div>
      <div className="bg-card rounded-lg p-4 shadow-sm">
        <div className="h-5 w-32 bg-muted rounded mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 bg-muted rounded mb-2" />
        ))}
      </div>
    </div>
  );
}
