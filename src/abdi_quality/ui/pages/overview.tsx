import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type OverviewOut } from "@/lib/api";
import {
  formatDate,
  getGradeColor,
  getStatusColor,
  getKpiStatusBorder,
  formatDelta,
} from "@/lib/formatters";
import { Sparkline } from "@/components/charts/sparkline";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

const GRADE_ORDER = ["A", "B", "C", "D", "E"] as const;
const GRADE_COLORS: Record<string, string> = {
  A: "#22c55e",
  B: "#84cc16",
  C: "#eab308",
  D: "#f97316",
  E: "#ef4444",
};
const GRADE_LABELS: Record<string, { title: string; desc: string }> = {
  A: { title: "Excellent", desc: "Meets all quality gates" },
  B: { title: "Good", desc: "Minor issues, safe to ship" },
  C: { title: "Fair", desc: "Noticeable issues, review advised" },
  D: { title: "Poor", desc: "Multiple failing checks" },
  E: { title: "Critical", desc: "Blocking issues, needs rework" },
};

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

export default function OverviewPage() {
  const [data, setData] = useState<OverviewOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);

  useEffect(() => {
    api
      .getOverview()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <OverviewSkeleton />;
  if (error)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive font-medium">Failed to load data</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  if (!data)
    return <p className="text-muted-foreground">No data available.</p>;

  const visibleKpiCards = data.kpi_cards.filter(
    (card) => !card.label.toLowerCase().includes("coverage")
  );

  const gradeDistribution = GRADE_ORDER.map((grade) => ({
    grade,
    count: data.recent_activity.filter((s) => s.quality_grade === grade).length,
    fill: GRADE_COLORS[grade],
  })).filter((d) => d.count > 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header with grade */}
      <div className="flex items-center gap-4">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl ${getGradeColor(data.quality_grade)}`}
        >
          {data.quality_grade}
        </div>
        <div>
          <h1 className="text-2xl font-bold">Code Quality Overview</h1>
          <p className="text-muted-foreground text-sm">
            Latest scan analysis across all pull requests
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
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

      {/* Quality Grade Distribution */}
      {gradeDistribution.length > 0 && (
        <div className="bg-card rounded-lg p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Quality Grade Distribution</h2>
              <p className="text-xs text-muted-foreground">
                PRs by quality grade across recent scans &mdash; click a bar to
                view PRs in that grade
              </p>
            </div>
            {selectedGrade && (
              <button
                onClick={() => setSelectedGrade(null)}
                className="text-xs px-2.5 py-1 rounded-full border border-border hover:bg-accent transition-colors"
              >
                Clear filter
              </button>
            )}
          </div>

          {/* Grade legend */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {GRADE_ORDER.map((g) => (
              <div
                key={g}
                className="flex items-center gap-2 p-2 rounded-md bg-secondary/40 border border-border/50"
              >
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: GRADE_COLORS[g] }}
                >
                  {g}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold leading-tight">
                    {GRADE_LABELS[g].title}
                  </div>
                  <div className="text-[10px] text-muted-foreground leading-tight truncate">
                    {GRADE_LABELS[g].desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="h-72 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={gradeDistribution}
                margin={{ left: 10, right: 20, top: 10, bottom: 5 }}
              >
                <XAxis
                  dataKey="grade"
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
                  formatter={(value: number) => [`${value} PRs`, "Count"]}
                  labelFormatter={(label: string) =>
                    `Grade ${label} \u2014 ${GRADE_LABELS[label]?.title ?? ""} (click to filter)`
                  }
                />
                <Bar
                  dataKey="count"
                  radius={[6, 6, 0, 0]}
                  onClick={(payload) => {
                    const grade = (payload as { grade?: string })?.grade;
                    if (!grade) return;
                    setSelectedGrade((cur) => (cur === grade ? null : grade));
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {gradeDistribution.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.fill}
                      fillOpacity={
                        selectedGrade && selectedGrade !== d.grade ? 0.35 : 1
                      }
                      stroke={
                        selectedGrade === d.grade
                          ? "var(--color-foreground)"
                          : undefined
                      }
                      strokeWidth={selectedGrade === d.grade ? 2 : 0}
                    />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="top"
                    style={{ fontSize: 11, fill: "var(--color-foreground)" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Drill-down: PRs for the selected grade */}
          {selectedGrade && (
            <div className="mt-4 border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: GRADE_COLORS[selectedGrade] }}
                >
                  {selectedGrade}
                </span>
                <h3 className="text-sm font-semibold">
                  {GRADE_LABELS[selectedGrade].title} &mdash; PRs in grade {selectedGrade}
                </h3>
              </div>
              {(() => {
                const filtered = data.recent_activity.filter(
                  (s) => s.quality_grade === selectedGrade,
                );
                if (filtered.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground">
                      No PRs in this grade.
                    </p>
                  );
                }
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="pb-2 font-medium">PR</th>
                          <th className="pb-2 font-medium">Author</th>
                          <th className="pb-2 font-medium">Branch</th>
                          <th className="pb-2 font-medium">Status</th>
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
                            <td className="py-2">{scan.author}</td>
                            <td className="py-2 font-mono text-xs">
                              {scan.branch}
                            </td>
                            <td className="py-2">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(scan.status)}`}
                              >
                                {scan.status.toUpperCase()}
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
        </div>
      )}

      {/* Recent Activity Table */}
      <div className="bg-card rounded-lg p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
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
              {data.recent_activity.map((scan) => (
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

function OverviewSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-muted" />
        <div>
          <div className="h-7 w-56 bg-muted rounded mb-2" />
          <div className="h-4 w-72 bg-muted rounded" />
        </div>
      </div>
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
      <div className="bg-card rounded-lg p-4 shadow-sm h-72 bg-muted rounded" />
      <div className="bg-card rounded-lg p-4 shadow-sm">
        <div className="h-5 w-32 bg-muted rounded mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 bg-muted rounded mb-2" />
        ))}
      </div>
    </div>
  );
}
