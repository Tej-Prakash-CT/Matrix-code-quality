const API_BASE = "/api";

async function fetchApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `API error: ${res.status}`);
  }
  return res.json();
}

export const ADMIN_TOKEN_KEY = "matrix_admin_token";

function adminHeaders(): HeadersInit {
  // Use a custom header (not Authorization) because the Databricks Apps
  // reverse proxy strips/overwrites Authorization for its own OAuth flow.
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem(ADMIN_TOKEN_KEY)
      : null;
  return token ? { "X-Admin-Token": token } : {};
}

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders(),
      ...(init.headers || {}),
    },
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
    throw new Error("Not authenticated");
  }
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `API error: ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

// Types matching backend models
export interface DeltaIndicator {
  current: number;
  previous: number | null;
  delta: number | null;
  direction: string | null;
}

export interface SparklinePoint {
  timestamp: string;
  value: number;
}

export interface KpiCard {
  label: string;
  value: string;
  raw_value: number;
  status: string;
  tooltip: string;
  delta: DeltaIndicator | null;
  sparkline: SparklinePoint[];
}

export interface ScanSummaryOut {
  pr_number: string;
  commit_sha: string;
  branch: string;
  author: string;
  timestamp: string;
  status: "pass" | "fail";
  coverage_pct: number;
  bugs: number;
  security: number;
  secrets: number;
  hotspots: number;
  duplication: number;
  tests_total: number;
  quality_grade: string;
  bugs_per_kloc: number | null;
  vulns_per_kloc: number | null;
}

export interface ToolFinding {
  rule_id: string;
  rule_name: string;
  file: string;
  line: number;
  message: string;
  severity: string;
  source: string;
}

export interface DuplicateSegment {
  file1: string;
  start1: number;
  end1: number;
  file2: string;
  start2: number;
  end2: number;
  lines: number;
  tokens: number;
}

export interface PylintBreakdown {
  errors: number;
  warnings: number;
  conventions: number;
  refactors: number;
  nb_count: number;
  py_count: number;
}

export interface BanditSeverity {
  high: number;
  medium: number;
  low: number;
  notebook_count: number;
}

export interface TestResults {
  passed: number;
  failed: number;
  error: number;
  skipped: number;
  total: number;
  duration: number;
  failures: Record<string, unknown>[];
}

export interface CoverageFile {
  file: string;
  statements: number;
  covered: number;
  missing: number;
  coverage_pct: number;
}

export interface TechnicalDebt {
  ratio_pct: number;
  grade: string;
  remediation_minutes: number;
  development_minutes: number;
}

export interface NotebookSourceSplit {
  tool: string;
  notebook_count: number;
  python_count: number;
}

export interface OwaspCategory {
  category: string;
  category_id: string;
  count: number;
  findings: ToolFinding[];
}

export interface RecurringViolation {
  rule_id: string;
  rule_name: string;
  tool: string;
  count: number;
  severity: string;
}

export interface ScanDetailOut {
  pr_number: string;
  pr_title: string;
  pr_author: string;
  workflow_url: string;
  branch: string;
  commit_sha: string;
  repo: string;
  timestamp: string;
  status: "pass" | "fail";
  quality_grade: string;
  technical_debt: TechnicalDebt;
  bugs_per_kloc: number | null;
  vulns_per_kloc: number | null;
  loc: number;
  kpi_cards: KpiCard[];
  pylint_breakdown: PylintBreakdown;
  bandit_severity: BanditSeverity;
  coverage_files: CoverageFile[];
  test_results: TestResults;
  notebook_source_split: NotebookSourceSplit[];
  gitleaks_findings: ToolFinding[];
  semgrep_findings: ToolFinding[];
  bandit_findings: ToolFinding[];
  pylint_findings: ToolFinding[];
  ruff_findings: ToolFinding[];
  sqlfluff_findings: ToolFinding[];
  jscpd_duplicates: DuplicateSegment[];
  ai_review: Record<string, unknown> | null;
  duplication_pct: number;
  total_issues: number;
  hidden_pylint_count: number;
  hidden_bandit_count: number;
}

export interface TrendPoint {
  timestamp: string;
  pr_number: string;
  value: number;
}

export interface TrendSeries {
  metric: string;
  label: string;
  data: TrendPoint[];
}

export interface TrendsOut {
  series: TrendSeries[];
  scans_included: number;
}

export interface ContributorOut {
  author: string;
  total_prs: number;
  pass_rate: number;
  avg_coverage: number;
  total_bugs: number;
  total_security: number;
  pass_count: number;
  fail_count: number;
}

export interface TeamHealthOut {
  total_scans: number;
  pass_rate: number;
  failing_prs: number;
  avg_coverage: number;
  active_authors: number;
  contributors: ContributorOut[];
  recent_scans: ScanSummaryOut[];
}

export interface SecurityOverviewOut {
  owasp_categories: OwaspCategory[];
  bandit_severity: BanditSeverity;
  total_vulnerabilities: number;
  total_secrets: number;
  top_recurring: RecurringViolation[];
}

export interface FixRateOut {
  pr_number: string;
  previous_pr: string | null;
  fix_rate_pct: number | null;
  violations_current: number;
  violations_previous: number | null;
}

export interface OverviewOut {
  quality_grade: string;
  kpi_cards: KpiCard[];
  recent_activity: ScanSummaryOut[];
  top_recurring_violations: RecurringViolation[];
}

// ── Admin types ─────────────────────────────────────────────────────────────

export interface ToolConfig {
  enabled: boolean;
  display_name: string;
  description: string;
}

export interface ThresholdConfig {
  coverage_target_pct: number;
  duplication_warning_pct: number;
  duplication_fail_pct: number;
  bugs_per_kloc_warning: number;
  bugs_per_kloc_danger: number;
  vulns_per_kloc_warning: number;
  vulns_per_kloc_danger: number;
  hotspots_warning: number;
  hotspots_danger: number;
  tech_debt_ratio_warning_pct: number;
  tech_debt_ratio_danger_pct: number;
}

export interface GradeWeights {
  reliability: number;
  security: number;
  maintainability: number;
  coverage: number;
  duplication: number;
  tests: number;
}

export interface SeverityFilter {
  min_severity: string[];
  fail_on: string[];
}

export interface AdminConfig {
  tools: Record<string, ToolConfig>;
  thresholds: ThresholdConfig;
  grade_weights: GradeWeights;
  severity_filter: SeverityFilter;
  ignored_rules: string[];
}

// API fetch functions
export const api = {
  getOverview: () => fetchApi<OverviewOut>("/overview"),
  listScans: (opts?: { author?: string; status?: "pass" | "fail"; limit?: number }) => {
    const params = new URLSearchParams();
    params.set("limit", String(opts?.limit ?? 200));
    if (opts?.author) params.set("author", opts.author);
    if (opts?.status) params.set("status", opts.status);
    return fetchApi<ScanSummaryOut[]>(`/scans?${params.toString()}`);
  },
  getScan: (prNumber: string) => fetchApi<ScanDetailOut>(`/scans/${prNumber}`),
  getTrends: (limit = 50) => fetchApi<TrendsOut>(`/trends?limit=${limit}`),
  getTeamHealth: () => fetchApi<TeamHealthOut>("/team"),
  getSecurityOverview: () => fetchApi<SecurityOverviewOut>("/security"),
  getFixRate: (prNumber: string) => fetchApi<FixRateOut>(`/scans/${prNumber}/fix-rate`),
};

export const adminApi = {
  login: (username: string, password: string) =>
    fetchApi<{ token: string }>("/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
  logout: () =>
    adminFetch<{ ok: boolean }>("/admin/logout", { method: "POST" }),
  getConfig: () => adminFetch<AdminConfig>("/admin/config"),
  saveConfig: (cfg: AdminConfig) =>
    adminFetch<AdminConfig>("/admin/config", {
      method: "PUT",
      body: JSON.stringify(cfg),
    }),
  changePassword: (username: string, new_password: string) =>
    adminFetch<{ ok: boolean }>("/admin/password", {
      method: "POST",
      body: JSON.stringify({ username, new_password }),
    }),
};

export function hasAdminToken(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(ADMIN_TOKEN_KEY));
}

export function setAdminToken(token: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
  }
}

export function clearAdminToken(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}
