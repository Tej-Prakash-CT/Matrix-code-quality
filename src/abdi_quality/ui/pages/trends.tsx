import { useEffect, useState, useMemo } from "react";
import { api, type TrendsOut, type TrendSeries } from "@/lib/api";
import { formatDateShort } from "@/lib/formatters";
import { useT } from "@/lib/i18n";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

const METRIC_COLORS: Record<string, string> = {
  bugs: "#ef4444",
  security: "#f97316",
  secrets: "#ec4899",
  duplication: "#9f7aea",
  hotspots: "#eab308",
  tests_total: "#3b82f6",
  quality_grade: "#14b8a6",
  bugs_per_kloc: "#ef4444",
  vulns_per_kloc: "#f97316",
};

const DEFAULT_COLOR = "#6366f1";

function getColorForMetric(metric: string): string {
  return METRIC_COLORS[metric] || DEFAULT_COLOR;
}

export default function TrendsPage() {
  const t = useT();
  const [data, setData] = useState<TrendsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(
    new Set(["bugs", "security", "duplication"])
  );
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    setLoading(true);
    api
      .getTrends(limit)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [limit]);

  const toggleMetric = (metric: string) => {
    setSelectedMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(metric)) {
        next.delete(metric);
      } else {
        next.add(metric);
      }
      return next;
    });
  };

  // Exclude removed metrics (coverage, tests) from the entire trends view.
  // Matches both legacy keys from older reports and the current backend keys.
  const visibleSeries = useMemo(() => {
    if (!data) return [];
    const hidden = new Set(["coverage", "coverage_pct", "tests"]);
    return data.series.filter((s) => !hidden.has(s.metric));
  }, [data]);

  // Merge all series into a single dataset keyed by pr_number
  const mergedData = useMemo(() => {
    const map = new Map<
      string,
      Record<string, string | number>
    >();

    visibleSeries.forEach((series) => {
      series.data.forEach((point) => {
        const key = `${point.pr_number}-${point.timestamp}`;
        if (!map.has(key)) {
          map.set(key, {
            pr_number: point.pr_number,
            timestamp: point.timestamp,
            label: `#${point.pr_number}`,
          });
        }
        map.get(key)![series.metric] = point.value;
      });
    });

    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(a.timestamp as string).getTime() -
        new Date(b.timestamp as string).getTime()
    );
  }, [visibleSeries]);

  const selectedSeries = useMemo(() => {
    return visibleSeries.filter((s) => selectedMetrics.has(s.metric));
  }, [visibleSeries, selectedMetrics]);

  // Returns true when all data points in a series have the same value (flat / tool disabled)
  function isFlat(series: TrendSeries): boolean {
    if (series.data.length === 0) return true;
    const first = series.data[0].value;
    return series.data.every((p) => p.value === first);
  }

  if (loading) return <TrendsSkeleton />;
  if (error)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive font-medium">Failed to load trends</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  if (!data || visibleSeries.length === 0)
    return (
      <p className="text-muted-foreground">
        No trend data available. Run more scans to generate trends.
      </p>
    );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t("trends.title")}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {t("trends.subtitle", { n: data.scans_included })}
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Scans:</label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="text-sm bg-card border border-border rounded-md px-2 py-1"
          >
            <option value={20}>Last 20</option>
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
          </select>
        </div>

        <div className="border-l border-border pl-3 flex flex-wrap gap-2">
          {visibleSeries.map((series) => (
            <button
              key={series.metric}
              onClick={() => toggleMetric(series.metric)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                selectedMetrics.has(series.metric)
                  ? "border-transparent text-white"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              style={
                selectedMetrics.has(series.metric)
                  ? { backgroundColor: getColorForMetric(series.metric) }
                  : {}
              }
            >
              {series.label}
            </button>
          ))}
        </div>
      </div>

      {/* Multi-metric Line Chart */}
      <div className="bg-card rounded-lg p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">{t("trends.metricComparison")}</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mergedData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                stroke="var(--color-muted-foreground)"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                stroke="var(--color-muted-foreground)"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "0.375rem",
                  color: "var(--color-foreground)",
                }}
                labelFormatter={(label) => `PR ${label}`}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              {selectedSeries.map((series) => (
                <Line
                  key={series.metric}
                  type={isFlat(series) ? "linear" : "monotone"}
                  dataKey={series.metric}
                  name={series.label}
                  stroke={getColorForMetric(series.metric)}
                  strokeWidth={isFlat(series) ? 1.5 : 2}
                  strokeDasharray={isFlat(series) ? "4 4" : undefined}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Individual Metric Sparklines */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleSeries.map((series) => {
          const sorted = [...series.data].sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          const latest = sorted[sorted.length - 1];
          const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;
          const flat = isFlat(series);
          const allZero = flat && latest?.value === 0;
          const delta = (!flat && prev) ? latest.value - prev.value : null;

          return (
            <div key={series.metric} className="bg-card rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {series.label}
                </span>
                {delta !== null ? (
                  <span
                    className={`text-xs ${
                      delta > 0 ? "text-red-500" : delta < 0 ? "text-green-500" : "text-muted-foreground"
                    }`}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(1)}
                  </span>
                ) : null}
              </div>
              <div className={`text-xl font-bold mb-2 ${allZero ? "text-muted-foreground" : ""}`}>
                {allZero ? "N/A" : latest ? latest.value.toFixed(1) : "\u2014"}
              </div>
              <div className="h-12">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sorted}>
                    <Line
                      type={flat ? "linear" : "monotone"}
                      dataKey="value"
                      stroke={allZero ? "var(--color-border)" : getColorForMetric(series.metric)}
                      strokeWidth={1.5}
                      strokeDasharray={allZero ? "4 4" : undefined}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>
                  {sorted.length > 0
                    ? formatDateShort(sorted[0].timestamp)
                    : ""}
                </span>
                <span>
                  {sorted.length > 0
                    ? formatDateShort(sorted[sorted.length - 1].timestamp)
                    : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendsSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      <div>
        <div className="h-7 w-40 bg-muted rounded mb-2" />
        <div className="h-4 w-64 bg-muted rounded" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-20 bg-muted rounded-full" />
        ))}
      </div>
      <div className="bg-card rounded-lg p-4 shadow-sm h-80 bg-muted" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card rounded-lg p-4 shadow-sm h-32 bg-muted" />
        ))}
      </div>
    </div>
  );
}
