import {
  api,
  type OverviewOut,
  type TeamHealthOut,
  type SecurityOverviewOut,
  type ScanDetailOut,
  type ToolFinding,
  type ScanSummaryOut,
} from "./api";
import { translate, type Lang } from "./i18n";

const FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
`;

const REPORT_CSS = `
${FONT_CSS}
*, *::before, *::after { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  color: #0f172a;
  font-family: 'Inter', 'Noto Sans JP', system-ui, -apple-system, sans-serif;
  font-size: 11px;
  line-height: 1.45;
}
.report { max-width: 780px; margin: 0 auto; padding: 24px 28px; }
section { margin-top: 24px; }
section:first-of-type { margin-top: 0; }
section.page-break { margin-top: 36px; }
section + section { margin-top: 28px; }
h1 { font-size: 22px; margin: 0 0 4px; font-weight: 700; }
h2 { font-size: 16px; margin: 0 0 8px; font-weight: 600; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
h3 { font-size: 13px; margin: 14px 0 6px; font-weight: 600; }
p  { margin: 4px 0; }
table + h3 { margin-top: 18px; }

@media print {
  /* @page already provides side margins — drop the in-doc padding so the
     content area uses the full printable width. */
  .report { padding: 0; max-width: none; margin: 0; }
  /* Use point units for print so the result is at standard document size
     instead of CSS-pixel-converted-to-pt (which shrinks ~25%). */
  body { font-size: 10pt; line-height: 1.4; }
  h1 { font-size: 18pt; }
  h2 { font-size: 13pt; }
  h3 { font-size: 11pt; }
  table { font-size: 9pt; }
  .small, .muted.small { font-size: 8pt; }
  .kpi-label { font-size: 7.5pt; }
  .kpi-value { font-size: 14pt; }
  .badge { font-size: 7.5pt; }
  /* Print-only page breaks; remove on-screen vertical gap they add. */
  section.page-break { page-break-before: always; break-before: page; margin-top: 0; }
  section { margin-top: 0; }
  /* Avoid orphan headings at page bottom. */
  h1, h2, h3 { page-break-after: avoid; break-after: avoid; }
  table { page-break-inside: auto; }
  tr    { page-break-inside: avoid; break-inside: avoid; }
  thead { display: table-header-group; }
}
.muted { color: #64748b; }
.small { font-size: 10px; }
.mono  { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
.right { text-align: right; }

/* Numeric / mono cells must never break or get auto-spaced. JP locale
   browsers otherwise insert ideographic gaps between Latin punctuation
   and digits, which is what produced the "11. 1%" rendering bug. */
td.mono, td.right.mono, .kpi-value {
  white-space: nowrap;
  font-feature-settings: "palt" 0;
  text-spacing-trim: space-all;
}
/* Keep table column headers on a single line so JP labels like ステータス
   don't break mid-word when columns are tight. */
th { white-space: nowrap; }

.header {
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px;
}
.brand { font-weight: 700; font-size: 14px; letter-spacing: 0.5px; }
.brand-sub { font-size: 10px; color: #64748b; }
.meta { text-align: right; font-size: 10px; color: #475569; }

.summary {
  display: grid; grid-template-columns: 64px 1fr; gap: 12px;
  align-items: center; margin: 8px 0 16px;
}
.grade-badge {
  width: 56px; height: 56px; border-radius: 50%;
  color: #fff; font-weight: 700; font-size: 24px;
  display: flex; align-items: center; justify-content: center;
}
.grade-A { background: #22c55e; }
.grade-B { background: #84cc16; }
.grade-C { background: #eab308; }
.grade-D { background: #f97316; }
.grade-E { background: #ef4444; }
.grade-default { background: #94a3b8; }

.kpi-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  margin: 10px 0 14px;
}
.kpi {
  border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; background: #fff;
  border-bottom: 3px solid #cbd5e1;
}
.kpi.good    { border-bottom-color: #22c55e; }
.kpi.warning { border-bottom-color: #eab308; }
.kpi.danger  { border-bottom-color: #ef4444; }
.kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
.kpi-value { font-size: 18px; font-weight: 700; margin-top: 2px; }

/* JP locale tweaks: uppercase + letter-spacing look broken on kanji, and
   tighter padding/line-height claws back enough vertical space to keep the
   report at the same page count as the EN version. */
:lang(ja) .kpi-label { text-transform: none; letter-spacing: 0; }
:lang(ja) body, :lang(ja) { line-height: 1.35; }
:lang(ja) table { font-size: 9.5px; }
:lang(ja) th, :lang(ja) td { padding: 3.5px 5px; }
@media print {
  :lang(ja) table { font-size: 8.5pt; }
  :lang(ja) body { line-height: 1.3; }
}

table { width: 100%; border-collapse: collapse; font-size: 10px; }
th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
th { color: #64748b; font-weight: 600; background: #f8fafc; }
td.right, th.right { text-align: right; }

.badge {
  display: inline-block; padding: 1px 7px; border-radius: 999px;
  font-size: 9px; font-weight: 600; text-transform: capitalize;
}
.badge-pass { background: #dcfce7; color: #166534; }
.badge-fail { background: #fee2e2; color: #991b1b; }
.badge-high   { background: #fee2e2; color: #991b1b; }
.badge-medium { background: #ffedd5; color: #9a3412; }
.badge-low    { background: #fef9c3; color: #854d0e; }
.badge-error  { background: #fee2e2; color: #991b1b; }
.badge-warning{ background: #ffedd5; color: #9a3412; }
.badge-info   { background: #dbeafe; color: #1e40af; }

.callout {
  background: #f1f5f9; border-left: 3px solid #6366f1;
  padding: 8px 10px; border-radius: 4px; margin: 8px 0;
}

footer.footer {
  margin-top: 36px; padding-top: 12px; border-top: 1px solid #e2e8f0;
  font-size: 9px; color: #64748b; display: flex; justify-content: space-between;
}

@page { size: A4; margin: 10mm 10mm 12mm 10mm; }
`;

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function gradeClass(g: string): string {
  return ["A", "B", "C", "D", "E"].includes(g) ? `grade-${g}` : "grade-default";
}

function statusBadge(status: string, t: (k: string) => string): string {
  const cls = status === "pass" ? "badge-pass" : "badge-fail";
  const label = t(`status.${status}`) || status.toUpperCase();
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
}

function severityBadge(sev: string, t: (k: string) => string): string {
  const s = (sev || "").toLowerCase();
  const known = ["high", "medium", "low", "error", "warning"];
  const cls = known.includes(s) ? `badge-${s}` : "badge-info";
  const label = t(`severity.${s}`) || sev || "—";
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
}

function fmtDate(iso: string, lang: Lang): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(lang === "ja" ? "ja-JP" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtNum(n: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === "ja" ? "ja-JP" : "en-US").format(n);
}

const FINDINGS_LIMIT = 25;

function findingsTable(
  findings: ToolFinding[],
  t: (k: string) => string,
): string {
  if (!findings.length) {
    return `<p class="muted small">—</p>`;
  }
  const shown = findings.slice(0, FINDINGS_LIMIT);
  const rows = shown
    .map(
      (f) => `
      <tr>
        <td>${escapeHtml(f.rule_name || f.rule_id)}</td>
        <td>${severityBadge(f.severity, t)}</td>
        <td class="mono">${escapeHtml(f.file)}</td>
        <td class="right mono">${escapeHtml(f.line ?? "")}</td>
        <td>${escapeHtml(f.message)}</td>
      </tr>`,
    )
    .join("");
  const overflow =
    findings.length > FINDINGS_LIMIT
      ? `<p class="muted small">${escapeHtml(
          translate("en", "report.tooMany", { n: findings.length - FINDINGS_LIMIT }).replace(
            "+",
            "+",
          ),
        )}</p>`
      : "";
  return `
    <table>
      <thead>
        <tr>
          <th>${t("table.rule")}</th>
          <th>${t("table.severity")}</th>
          <th>${t("table.file")}</th>
          <th class="right">${t("table.line")}</th>
          <th>${t("table.message")}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>${overflow}
  `;
}

interface BuildContext {
  lang: Lang;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

function makeT(lang: Lang) {
  return (key: string, vars?: Record<string, string | number>) =>
    translate(lang, key, vars);
}

// ── Section renderers ───────────────────────────────────────────────────────

function renderHeader(ctx: BuildContext, subtitle: string): string {
  const { t, lang } = ctx;
  return `
    <div class="header">
      <div>
        <div class="brand">MATRIX</div>
        <div class="brand-sub">${t("app.subtitle")}</div>
      </div>
      <div class="meta">
        <div><strong>${t("report.title")}</strong></div>
        <div>${escapeHtml(subtitle)}</div>
        <div>${t("report.generated")}: ${fmtDate(new Date().toISOString(), lang)}</div>
      </div>
    </div>
  `;
}

function renderFooter(ctx: BuildContext): string {
  return `
    <footer class="footer">
      <span>${ctx.t("report.footer")}</span>
      <span>${fmtDate(new Date().toISOString(), ctx.lang)}</span>
    </footer>
  `;
}

// KPI cards arrive from the backend with hardcoded English labels (see
// metrics.py build_kpi_cards). Translate them at render time so the JP
// report doesn't show English tile labels alongside Japanese section
// headers. Keys are matched case-insensitively against the canonical labels.
const KPI_LABEL_JA: Record<string, string> = {
  "code coverage": "カバレッジ",
  "duplication": "重複率",
  "bugs / kloc": "バグ / KLOC",
  "vulns / kloc": "脆弱性 / KLOC",
  "hotspots": "ホットスポット",
  "secrets": "シークレット",
  "validation tests": "検証テスト",
  "tech debt": "技術的負債",
};

function localizeKpiLabel(label: string, lang: Lang): string {
  if (lang !== "ja") return label;
  return KPI_LABEL_JA[label.toLowerCase()] ?? label;
}

function renderOverviewSection(
  ctx: BuildContext,
  data: OverviewOut,
  allScans: ScanSummaryOut[],
  totalScansInSystem: number,
): string {
  const { t, lang } = ctx;
  const visibleKpis = data.kpi_cards.filter(
    (k) => !k.label.toLowerCase().includes("coverage"),
  );
  const kpis = visibleKpis
    .map(
      (k) => `
      <div class="kpi ${escapeHtml(k.status)}">
        <div class="kpi-label">${escapeHtml(localizeKpiLabel(k.label, lang))}</div>
        <div class="kpi-value">${escapeHtml(k.value)}</div>
      </div>`,
    )
    .join("");

  // Display the true PR count from the /team endpoint (no cap), but compute
  // grade counts from whatever rows /scans returned (capped at the server's
  // listScans `le`). If the dataset exceeds that cap, the bar counts are a
  // sample — raise the backend cap or add an aggregate endpoint to fix.
  const totalPrs = totalScansInSystem || allScans.length;
  const dist = ["A", "B", "C", "D", "E"].map((g) => ({
    g,
    count: allScans.filter((s) => s.quality_grade === g).length,
  }));
  const distRows = dist
    .map(
      (d) => `
      <tr>
        <td><span class="badge ${gradeClass(d.g)}" style="color:#fff">${d.g}</span> ${escapeHtml(t(`grade.${d.g}`))}</td>
        <td class="right">${d.count}</td>
      </tr>`,
    )
    .join("");

  return `
    <section>
      <h2>${t("report.section.overview")}</h2>
      <div class="summary">
        <div class="grade-badge ${gradeClass(data.quality_grade)}">${escapeHtml(data.quality_grade)}</div>
        <div>
          <h1 style="margin:0">${t("overview.title")}</h1>
          <div class="muted">${t("overview.subtitle")}</div>
        </div>
      </div>
      <div class="kpi-grid">${kpis}</div>
      <h3>${t("overview.gradeDistribution")}</h3>
      <p class="muted small">${escapeHtml(t("report.gradeDistExplainer", { n: totalPrs }))}</p>
      <table>
        <thead><tr><th>${t("table.grade")}</th><th class="right">${t("table.prCount")}</th></tr></thead>
        <tbody>${distRows}</tbody>
      </table>
    </section>
  `;
}

function renderTeamSection(ctx: BuildContext, data: TeamHealthOut): string {
  const { t, lang } = ctx;
  const kpis = `
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">${t("team.totalScans")}</div><div class="kpi-value">${data.total_scans}</div></div>
      <div class="kpi ${data.pass_rate >= 80 ? "good" : data.pass_rate >= 50 ? "warning" : "danger"}"><div class="kpi-label">${t("team.passRate")}</div><div class="kpi-value">${data.pass_rate.toFixed(1)}%</div></div>
      <div class="kpi ${data.failing_prs === 0 ? "good" : "danger"}"><div class="kpi-label">${t("team.failingPrs")}</div><div class="kpi-value">${data.failing_prs}</div></div>
      <div class="kpi"><div class="kpi-label">${t("team.activeAuthors")}</div><div class="kpi-value">${data.active_authors}</div></div>
    </div>
  `;

  const contributors = data.contributors
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.author)}</td>
        <td class="right">${c.total_prs}</td>
        <td class="right">${c.pass_rate.toFixed(1)}%</td>
        <td class="right">${c.total_bugs}</td>
        <td class="right">${c.total_security}</td>
        <td class="right">${c.pass_count}</td>
        <td class="right">${c.fail_count}</td>
      </tr>`,
    )
    .join("");

  const recent = data.recent_scans
    .map(
      (s) => `
      <tr>
        <td>#${escapeHtml(s.pr_number)}</td>
        <td>${escapeHtml(s.author)}</td>
        <td class="mono">${escapeHtml(s.branch)}</td>
        <td>${statusBadge(s.status, t)}</td>
        <td><span class="badge ${gradeClass(s.quality_grade)}" style="color:#fff">${escapeHtml(s.quality_grade)}</span></td>
        <td class="right">${s.bugs}</td>
        <td class="right">${s.security}</td>
        <td>${escapeHtml(fmtDate(s.timestamp, lang))}</td>
      </tr>`,
    )
    .join("");

  return `
    <section class="page-break">
      <h1>${t("team.title")}</h1>
      <p class="muted">${t("team.subtitle")}</p>
      ${kpis}
      <h3>${t("team.contributors")}</h3>
      <table>
        <thead>
          <tr>
            <th>${t("table.author")}</th>
            <th class="right">${t("table.prCount")}</th>
            <th class="right">${t("team.passRate")}</th>
            <th class="right">${t("table.bugs")}</th>
            <th class="right">${t("table.security")}</th>
            <th class="right">${t("table.passCount")}</th>
            <th class="right">${t("table.failCount")}</th>
          </tr>
        </thead>
        <tbody>${contributors}</tbody>
      </table>
      <h3>${t("team.recentScans")}</h3>
      <table>
        <thead>
          <tr>
            <th>${t("table.pr")}</th>
            <th>${t("table.author")}</th>
            <th>${t("table.branch")}</th>
            <th>${t("table.status")}</th>
            <th>${t("table.grade")}</th>
            <th class="right">${t("table.bugs")}</th>
            <th class="right">${t("table.security")}</th>
            <th>${t("table.date")}</th>
          </tr>
        </thead>
        <tbody>${recent}</tbody>
      </table>
    </section>
  `;
}

function renderSecuritySection(
  ctx: BuildContext,
  data: SecurityOverviewOut,
): string {
  const { t } = ctx;
  const kpis = `
    <div class="kpi-grid">
      <div class="kpi ${data.total_vulnerabilities === 0 ? "good" : "danger"}"><div class="kpi-label">${t("security.totalVulns")}</div><div class="kpi-value">${data.total_vulnerabilities}</div></div>
      <div class="kpi ${data.total_secrets === 0 ? "good" : "danger"}"><div class="kpi-label">${t("security.totalSecrets")}</div><div class="kpi-value">${data.total_secrets}</div></div>
      <div class="kpi ${data.bandit_severity.high === 0 ? "good" : "danger"}"><div class="kpi-label">${t("security.highSeverity")}</div><div class="kpi-value">${data.bandit_severity.high}</div></div>
      <div class="kpi"><div class="kpi-label">${t("security.owaspCategories")}</div><div class="kpi-value">${data.owasp_categories.length}</div></div>
    </div>
  `;

  const banditRows = `
    <tr><td>${severityBadge("high", t)}</td><td class="right">${data.bandit_severity.high}</td></tr>
    <tr><td>${severityBadge("medium", t)}</td><td class="right">${data.bandit_severity.medium}</td></tr>
    <tr><td>${severityBadge("low", t)}</td><td class="right">${data.bandit_severity.low}</td></tr>
  `;

  const owaspRows = data.owasp_categories
    .map(
      (c) => `
      <tr>
        <td class="mono">${escapeHtml(c.category_id)}</td>
        <td>${escapeHtml(c.category)}</td>
        <td class="right">${c.count}</td>
      </tr>`,
    )
    .join("");

  // The security section is for security-grade findings only — Ruff lint
  // hits (style, complexity) are not security violations and would mislead
  // readers when the real security counters are all 0.
  const SECURITY_TOOLS = new Set(["bandit", "semgrep", "gitleaks"]);
  const recurringRows = data.top_recurring
    .filter((r) => SECURITY_TOOLS.has((r.tool || "").toLowerCase()))
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.rule_name || r.rule_id)}</td>
        <td>${severityBadge(r.severity, t)}</td>
        <td>${escapeHtml(r.tool)}</td>
        <td class="right">${r.count}</td>
      </tr>`,
    )
    .join("");

  return `
    <section class="page-break">
      <h1>${t("security.title")}</h1>
      <p class="muted">${t("security.subtitle")}</p>
      ${kpis}
      <h3>${t("security.banditDistribution")}</h3>
      <table>
        <thead><tr><th>${t("table.severity")}</th><th class="right">${t("table.bugs")}</th></tr></thead>
        <tbody>${banditRows}</tbody>
      </table>
      <h3>${t("security.owaspCategories")}</h3>
      <table>
        <thead><tr><th>ID</th><th>${t("security.owaspCategories")}</th><th class="right">${escapeHtml(t("table.count"))}</th></tr></thead>
        <tbody>${owaspRows || `<tr><td colspan="3" class="muted">—</td></tr>`}</tbody>
      </table>
      ${
        recurringRows
          ? `<h3>${escapeHtml(t("security.topRecurring"))}</h3>
            <table>
              <thead><tr><th>${t("table.rule")}</th><th>${t("table.severity")}</th><th>${escapeHtml(t("report.benchmarks.tool"))}</th><th class="right">${escapeHtml(t("table.count"))}</th></tr></thead>
              <tbody>${recurringRows}</tbody>
            </table>`
          : ""
      }
    </section>
  `;
}

// Order matters: linting, security, bugs, secrets, duplication.
const SCANNERS: { name: string; role: { en: string; ja: string }; notes?: { en: string; ja: string } }[] = [
  {
    name: "Ruff",
    role: { en: "Python linting", ja: "Python リンティング" },
    notes: {
      en: "Fast Python linter — flags style, errors, and complexity issues across the codebase.",
      ja: "高速な Python リンター — コード全体のスタイル、エラー、複雑度の問題を検出。",
    },
  },
  {
    name: "Bandit",
    role: { en: "Python security analysis", ja: "Python セキュリティ解析" },
    notes: {
      en: "Scans Python source for common security issues — hardcoded credentials, weak crypto, unsafe deserialization.",
      ja: "Python ソースの一般的なセキュリティ問題 (ハードコードされた認証情報、弱い暗号、安全でないデシリアライゼーション) を検出。",
    },
  },
  {
    name: "Semgrep",
    role: { en: "Bug / pattern detection", ja: "バグ / パターン検出" },
    notes: {
      en: "Multi-language pattern-based static analysis — surfaces bugs, anti-patterns, and risky API usage.",
      ja: "多言語対応のパターンベース静的解析 — バグ、アンチパターン、危険な API 利用を検出。",
    },
  },
  {
    name: "Gitleaks",
    role: { en: "Secret detection", ja: "シークレット検出" },
    notes: {
      en: "Detects secrets, API keys, tokens, and credentials accidentally committed to the repository.",
      ja: "リポジトリに誤ってコミットされたシークレット、API キー、トークン、認証情報を検出。",
    },
  },
  {
    name: "JSCPD",
    role: { en: "Code duplication", ja: "コード重複" },
    notes: {
      en: "Copy-paste detector — reports duplicated code blocks across files to surface refactor candidates.",
      ja: "コピー＆ペースト検出 — ファイル間の重複コードブロックを報告し、リファクタ候補を可視化。",
    },
  },
];

function renderScannerStack(ctx: BuildContext): string {
  const { t, lang } = ctx;
  const rows = SCANNERS.map(
    (s) => `
      <tr>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td>${escapeHtml(s.role[lang])}</td>
        <td class="muted">${s.notes ? escapeHtml(s.notes[lang]) : ""}</td>
      </tr>`,
  ).join("");
  return `
    <section>
      <h2>${t("report.section.scanners")}</h2>
      <p class="muted small">${escapeHtml(t("report.scanners.intro"))}</p>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t("report.benchmarks.tool"))}</th>
            <th>${escapeHtml(t("table.source"))}</th>
            <th>${escapeHtml(t("table.notes"))}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

// Industry benchmarks below are commonly cited norms — SonarQube SQALE for
// tech-debt grading, OWASP and peer-reviewed empirical studies for bug/vuln
// densities, SonarQube default for duplication, generally accepted ≥ 80%
// coverage standard. "Our threshold" mirrors admin_config defaults.
interface BenchmarkRow {
  /** Candidate kpi_cards labels to match (case-insensitive, normalized).
   *  First exact match wins. The backend currently emits exactly the first
   *  entry in each list (see metrics.py). Aliases handle drift over time. */
  labels: string[];
  metric: { en: string; ja: string };
  tool: string;
  ourThreshold: { en: string; ja: string };
  industry: { en: string; ja: string };
}

// Thresholds mirror the deployed admin config (see backend/admin_config.json).
// Update both places in lock-step if the platform's defaults change.
const BENCHMARKS: BenchmarkRow[] = [
  {
    labels: ["Bugs / KLOC", "Bugs/KLOC"],
    metric: { en: "Bugs / KLOC", ja: "バグ / KLOC" },
    tool: "Semgrep",
    ourThreshold: { en: "Danger ≥ 0", ja: "要対応 ≥ 0" },
    industry: { en: "World-class ≤ 1.0; average 5–15", ja: "優秀 ≤ 1.0、平均 5〜15" },
  },
  {
    labels: ["Vulns / KLOC", "Vulns/KLOC", "Vulnerabilities / KLOC"],
    metric: { en: "Vulnerabilities / KLOC", ja: "脆弱性 / KLOC" },
    tool: "Bandit",
    ourThreshold: { en: "Danger ≥ 0", ja: "要対応 ≥ 0" },
    industry: { en: "Good ≤ 0.5; concern > 2.0", ja: "良好 ≤ 0.5、要注意 > 2.0" },
  },
  {
    labels: ["Tech Debt", "Tech Debt Ratio", "Technical Debt"],
    metric: { en: "Tech Debt Ratio", ja: "技術的負債比率" },
    tool: "Weighted",
    ourThreshold: {
      en: "SQALE: A ≤ 5%, B ≤ 10%, C ≤ 20%, D ≤ 50%, E > 50%",
      ja: "SQALE: A ≤ 5%、B ≤ 10%、C ≤ 20%、D ≤ 50%、E > 50%",
    },
    industry: {
      en: "SQALE: A ≤ 5%, B ≤ 10%, C ≤ 20%, D ≤ 50%, E > 50%",
      ja: "SQALE: A ≤ 5%、B ≤ 10%、C ≤ 20%、D ≤ 50%、E > 50%",
    },
  },
  {
    labels: ["Duplication", "Code Duplication"],
    metric: { en: "Code Duplication", ja: "コード重複" },
    tool: "JSCPD",
    ourThreshold: { en: "Danger ≥ 20%", ja: "要対応 ≥ 20%" },
    industry: { en: "Industry standard ≥ 20% ", ja: "業界標準 ≥ 20%" },
  },
  {
    labels: ["Hotspots"],
    metric: { en: "Hotspots (Ruff errors)", ja: "ホットスポット (Ruff エラー)" },
    tool: "Ruff",
    ourThreshold: { en: "Danger ≥ 0", ja: "要対応 ≥ 0" },
    industry: { en: "Internal — keep at 0 for clean PRs", ja: "社内基準 — クリーン PR では 0 を維持" },
  },
  {
    // No backing kpi_card — current value column will render "—" but the row
    // documents how the weighted grade maps to letter grades for readers.
    labels: ["Quality Grade"],
    metric: { en: "Quality Grade Distribution", ja: "品質グレード分布" },
    tool: "Weighted",
    ourThreshold: {
      en: "A ≥ 95, B ≥ 85, C ≥ 70, D ≥ 50, E < 50 · failing PRs floored at D",
      ja: "A ≥ 95、B ≥ 85、C ≥ 70、D ≥ 50、E < 50 ・ 失敗 PR は最高 D",
    },
    industry: {
      en: "A: Excellent · B: Good · C: Fair · D: Poor · E: Critical (weighted across reliability, security, maintainability, duplication, hotspots)",
      ja: "A: 優秀・B: 良好・C: 普通・D: 不良・E: 重大（信頼性、セキュリティ、保守性、重複、ホットスポットの加重平均）",
    },
  },
];

function renderBenchmarks(ctx: BuildContext, overview: OverviewOut): string {
  const { t, lang } = ctx;
  // Normalize "Bugs / KLOC" → "bugskloc" so spacing/punctuation differences
  // between backend labels and our match keys don't break the lookup.
  const norm = (s: string) => s.toLowerCase().replace(/[\s_/\-()]+/g, "");

  const cards = overview.kpi_cards;
  function findKpi(candidates: string[]): { value: string; status: string } | null {
    // 1. Exact case-insensitive match on raw labels.
    for (const c of candidates) {
      const hit = cards.find((k) => k.label.toLowerCase() === c.toLowerCase());
      if (hit) return { value: hit.value, status: hit.status };
    }
    // 2. Normalized match (drops spaces, slashes, parens).
    for (const c of candidates) {
      const target = norm(c);
      const hit = cards.find((k) => norm(k.label) === target);
      if (hit) return { value: hit.value, status: hit.status };
    }
    return null;
  }

  function statusLabel(s: string): string {
    if (s === "good") return t("report.benchmarks.statusGood");
    if (s === "warning") return t("report.benchmarks.statusWarning");
    if (s === "danger") return t("report.benchmarks.statusDanger");
    return "—";
  }
  function statusBadgeCls(s: string): string {
    if (s === "good") return "badge-pass";
    if (s === "warning") return "badge-warning";
    if (s === "danger") return "badge-fail";
    return "badge-info";
  }

  const rows = BENCHMARKS.map((b) => {
    const kpi = findKpi(b.labels);
    const value = kpi?.value ?? "—";
    const status = kpi?.status ?? "";
    const badge = status
      ? `<span class="badge ${statusBadgeCls(status)}">${escapeHtml(statusLabel(status))}</span>`
      : "—";
    return `
      <tr>
        <td><strong>${escapeHtml(b.metric[lang])}</strong></td>
        <td>${escapeHtml(b.tool)}</td>
        <td>${escapeHtml(b.ourThreshold[lang])}</td>
        <td>${escapeHtml(b.industry[lang])}</td>
        <td class="right mono">${escapeHtml(value)}</td>
        <td>${badge}</td>
      </tr>`;
  }).join("");

  return `
    <section>
      <h2>${t("report.section.benchmarks")}</h2>
      <p class="muted small">${escapeHtml(t("report.benchmarks.intro"))}</p>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t("report.benchmarks.metric"))}</th>
            <th>${escapeHtml(t("report.benchmarks.tool"))}</th>
            <th>${escapeHtml(t("report.benchmarks.ourThreshold"))}</th>
            <th>${escapeHtml(t("report.benchmarks.industry"))}</th>
            <th class="right">${escapeHtml(t("report.benchmarks.current"))}</th>
            <th>${escapeHtml(t("table.status"))}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function renderGradeBreakdown(ctx: BuildContext, data: ScanDetailOut): string {
  const { t } = ctx;
  const b = data.grade_breakdown;
  if (!b) return "";
  const visible = b.dimensions.filter((d) => d.weight > 0);
  const rows = visible
    .map(
      (d) => `
      <tr>
        <td><strong>${escapeHtml(d.name)}</strong></td>
        <td>${escapeHtml(d.raw_value)}</td>
        <td class="right mono">${d.score.toFixed(0)}</td>
        <td class="right mono">${(d.weight * 100).toFixed(0)}%</td>
        <td class="right mono">${d.contribution.toFixed(1)}</td>
      </tr>`,
    )
    .join("");
  const cap = b.fail_cap_applied
    ? `<p class="callout small"><strong>${escapeHtml(t("report.gradeBreakdown.failCapTitle"))}:</strong>
         ${escapeHtml(t("report.gradeBreakdown.failCapBody", {
           total: b.weighted_total.toFixed(1),
           base: b.base_grade,
           cap: b.cap_grade,
         }))}</p>`
    : "";
  return `
    <h3>${escapeHtml(t("report.gradeBreakdown.title"))}</h3>
    <p class="muted small">${escapeHtml(t("report.gradeBreakdown.intro", { cap: b.cap_grade }))}</p>
    <table>
      <thead>
        <tr>
          <th>${escapeHtml(t("report.gradeBreakdown.dimension"))}</th>
          <th>${escapeHtml(t("report.gradeBreakdown.rawValue"))}</th>
          <th class="right">${escapeHtml(t("report.gradeBreakdown.score"))}</th>
          <th class="right">${escapeHtml(t("report.gradeBreakdown.weight"))}</th>
          <th class="right">${escapeHtml(t("report.gradeBreakdown.contribution"))}</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr>
          <td colspan="4"><strong>${escapeHtml(t("report.gradeBreakdown.weightedTotal"))}</strong></td>
          <td class="right mono"><strong>${b.weighted_total.toFixed(1)}</strong></td>
        </tr>
      </tbody>
    </table>
    ${cap}
  `;
}

function renderPrSection(ctx: BuildContext, data: ScanDetailOut): string {
  const { t, lang } = ctx;
  const visibleKpis = data.kpi_cards.filter(
    (k) => !k.label.toLowerCase().includes("coverage"),
  );
  const kpis = visibleKpis
    .map(
      (k) => `
      <div class="kpi ${escapeHtml(k.status)}">
        <div class="kpi-label">${escapeHtml(localizeKpiLabel(k.label, lang))}</div>
        <div class="kpi-value">${escapeHtml(k.value)}</div>
      </div>`,
    )
    .join("");

  const debt = `
    <table>
      <thead>
        <tr>
          <th>${t("pr.technicalDebt")}</th>
          <th>${t("pr.remediation")}</th>
          <th>${t("pr.development")}</th>
          <th>${t("pr.loc")}</th>
          <th>${t("pr.bugsPerKloc")}</th>
          <th>${t("pr.vulnsPerKloc")}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(data.technical_debt.grade)} (${data.technical_debt.ratio_pct.toFixed(1)}%)</td>
          <td>${data.technical_debt.remediation_minutes}m</td>
          <td>${fmtNum(data.technical_debt.development_minutes, lang)}m</td>
          <td>${fmtNum(data.loc, lang)}</td>
          <td>${data.bugs_per_kloc !== null ? data.bugs_per_kloc.toFixed(2) : "—"}</td>
          <td>${data.vulns_per_kloc !== null ? data.vulns_per_kloc.toFixed(2) : "—"}</td>
        </tr>
      </tbody>
    </table>
  `;

  const dupRows = data.jscpd_duplicates
    .slice(0, FINDINGS_LIMIT)
    .map(
      (d) => `
      <tr>
        <td class="mono">${escapeHtml(d.file1)}</td>
        <td>${d.start1}-${d.end1}</td>
        <td class="mono">${escapeHtml(d.file2)}</td>
        <td>${d.start2}-${d.end2}</td>
        <td class="right">${d.lines}L</td>
        <td class="right">${d.tokens}T</td>
      </tr>`,
    )
    .join("");

  return `
    <section class="page-break">
      <h2>${t("report.section.prDetail")} — PR #${escapeHtml(data.pr_number)}</h2>
      <h1 style="margin-top:8px">PR #${escapeHtml(data.pr_number)} — ${escapeHtml(data.pr_title || "")}</h1>
      <p class="muted">
        ${escapeHtml(data.pr_author)} · <span class="mono">${escapeHtml(data.branch)}</span> ·
        ${escapeHtml(data.commit_sha.slice(0, 8))} · ${escapeHtml(fmtDate(data.timestamp, lang))}
      </p>
      <div class="summary">
        <div class="grade-badge ${gradeClass(data.quality_grade)}">${escapeHtml(data.quality_grade)}</div>
        <div>
          <div>${statusBadge(data.status, t)} &nbsp; <strong>${t("report.qualityGrade")}:</strong> ${escapeHtml(data.quality_grade)} (${escapeHtml(t(`grade.${data.quality_grade}`))})</div>
          <div class="muted small">${escapeHtml(data.repo)}</div>
        </div>
      </div>
      <div class="kpi-grid">${kpis}</div>
      ${debt}
      ${renderGradeBreakdown(ctx, data)}

      <h3>${t("findings.ruff")}</h3>
      ${findingsTable(data.ruff_findings, t)}

      <h3>${t("findings.bandit")}</h3>
      ${findingsTable(data.bandit_findings, t)}

      <h3>${t("findings.semgrep")}</h3>
      ${findingsTable(data.semgrep_findings, t)}

      <h3>${t("findings.gitleaks")}</h3>
      ${findingsTable(data.gitleaks_findings, t)}

      <h3>${t("findings.jscpd")}</h3>
      ${
        data.jscpd_duplicates.length === 0
          ? `<p class="muted small">—</p>`
          : `<table>
              <thead>
                <tr>
                  <th>${t("table.file")} 1</th><th>${t("table.line")}</th>
                  <th>${t("table.file")} 2</th><th>${t("table.line")}</th>
                  <th class="right">${escapeHtml(t("table.size"))}</th><th class="right">${escapeHtml(t("table.tokens"))}</th>
                </tr>
              </thead>
              <tbody>${dupRows}</tbody>
            </table>`
      }
    </section>
  `;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface DashboardReportData {
  overview: OverviewOut;
  team: TeamHealthOut;
  security: SecurityOverviewOut;
  /** All PRs in the system, not just the /overview endpoint's recent slice.
   *  Used so the report's grade distribution is holistic. */
  allScans: ScanSummaryOut[];
}

export async function fetchDashboardData(): Promise<DashboardReportData> {
  const [overview, team, security, allScans] = await Promise.all([
    api.getOverview(),
    api.getTeamHealth(),
    api.getSecurityOverview(),
    api.listScans({ limit: 1000 }),
  ]);
  return { overview, team, security, allScans };
}

export function buildDashboardHtml(
  data: DashboardReportData,
  lang: Lang,
): string {
  const t = makeT(lang);
  const ctx: BuildContext = { lang, t };
  const subtitle = `${t("report.section.overview")} · ${t("report.section.team")} · ${t("report.section.security")}`;

  // Per-PR table is intentionally omitted from the dashboard report — at
  // hundreds of rows it bloats the PDF without adding insight beyond what the
  // grade distribution already shows. Per-PR detail lives in the per-PR report.
  const allScans = data.allScans;
  const tocItems = [
    t("report.section.scanners"),
    t("report.section.benchmarks"),
    t("report.section.overview"),
    t("report.section.team"),
    t("report.section.security"),
  ];
  const toc = `
    <div class="callout">
      <strong>${t("report.toc")}</strong>
      <ol style="margin:4px 0 0 18px;padding:0">
        ${tocItems.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}
      </ol>
    </div>
  `;

  return wrapHtml(
    `${renderHeader(ctx, subtitle)}
     ${toc}
     ${renderScannerStack(ctx)}
     ${renderBenchmarks(ctx, data.overview)}
     ${renderOverviewSection(ctx, data.overview, allScans, data.team.total_scans)}
     ${renderTeamSection(ctx, data.team)}
     ${renderSecuritySection(ctx, data.security)}
     ${renderFooter(ctx)}`,
    lang,
    t("report.title"),
  );
}

export interface PrReportContext {
  pr: ScanDetailOut;
  /** Optional dashboard context. When provided the per-PR report includes
   *  Scanner Stack, Industry Benchmarks, Overview, Team, Security
   *  sections as context, then the PR's full per-tool detail at the end. */
  dashboard?: DashboardReportData;
}

export function buildPrHtml(ctxData: PrReportContext, lang: Lang): string {
  const t = makeT(lang);
  const ctx: BuildContext = { lang, t };
  const data = ctxData.pr;
  const dashboard = ctxData.dashboard;
  const subtitle = `PR #${data.pr_number} · ${data.pr_author}`;

  const tocItems = [
    ...(dashboard
      ? [
          t("report.section.scanners"),
          t("report.section.benchmarks"),
          t("report.section.overview"),
          t("report.section.team"),
          t("report.section.security"),
        ]
      : []),
    t("report.section.prDetail"),
  ];
  const toc = `
    <div class="callout">
      <strong>${t("report.toc")}</strong>
      <ol style="margin:4px 0 0 18px;padding:0">
        ${tocItems.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}
      </ol>
    </div>
  `;

  const contextSections = dashboard
    ? `${renderScannerStack(ctx)}
       ${renderBenchmarks(ctx, dashboard.overview)}
       ${renderOverviewSection(ctx, dashboard.overview, dashboard.allScans, dashboard.team.total_scans)}
       ${renderTeamSection(ctx, dashboard.team)}
       ${renderSecuritySection(ctx, dashboard.security)}`
    : "";

  return wrapHtml(
    `${renderHeader(ctx, subtitle)}
     ${toc}
     ${contextSections}
     ${renderPrSection(ctx, data)}
     ${renderFooter(ctx)}`,
    lang,
    `${t("report.title")} · PR #${data.pr_number}`,
  );
}

function wrapHtml(body: string, lang: Lang, title: string): string {
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${REPORT_CSS}</style>
</head>
<body>
  <div class="report">${body}</div>
</body>
</html>`;
}

// ── Download helpers ────────────────────────────────────────────────────────

export function downloadHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".html") ? filename : `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// PDF generation uses the browser's native print engine instead of canvas
// rasterization. This keeps text vector (sharp, selectable, searchable),
// renders Japanese fonts perfectly (the browser handles font fallback), and
// removes any html2canvas / iframe-cross-document blank-output issues.
// UX cost: user clicks "Save as PDF" in the print dialog.

/**
 * Open the print window. MUST be called synchronously from a user gesture
 * (the click handler), before any await — otherwise Chrome/Edge silently
 * block the popup as "not user-initiated" even with no popup blocker on.
 * Returns the open Window (with a placeholder loading page) or null if
 * the browser blocked it.
 */
export function openPdfWindow(): Window | null {
  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) return null;
  // Placeholder so the new tab isn't blank while data is fetched.
  win.document.open();
  win.document.write(
    `<!doctype html><html><head><title>Generating report…</title>
     <style>
       body { font-family: system-ui, sans-serif; padding: 40px; color: #475569; }
       .spinner { width: 24px; height: 24px; border: 3px solid #e2e8f0;
         border-top-color: #0f172a; border-radius: 50%;
         animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
       @keyframes spin { to { transform: rotate(360deg); } }
       .center { text-align: center; }
     </style></head>
     <body>
       <div class="center">
         <div class="spinner"></div>
         <div>Generating report…</div>
       </div>
     </body></html>`,
  );
  win.document.close();
  return win;
}

/**
 * Write the report into a pre-opened window and trigger the print dialog
 * once fonts are ready. The window must come from openPdfWindow(), called
 * synchronously inside the click handler.
 */
export function writePdfToWindow(
  win: Window,
  html: string,
  filename: string,
): void {
  const cleanName = filename.endsWith(".pdf") ? filename.slice(0, -4) : filename;
  // Auto-print after fonts load so Japanese glyphs render correctly.
  const printScript = `
    <script>
      (function () {
        function go() {
          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () {
              setTimeout(function () { window.focus(); window.print(); }, 200);
            });
          } else {
            setTimeout(function () { window.focus(); window.print(); }, 400);
          }
        }
        if (document.readyState === 'complete') go();
        else window.addEventListener('load', go);
      })();
    </script>
  `;
  const titled = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${cleanName}</title>`,
  );
  const withScript = titled.replace("</body>", `${printScript}</body>`);

  win.document.open();
  win.document.write(withScript);
  win.document.close();
}

export function reportFilename(prefix: string, lang: Lang): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  return `matrix-${prefix}-${lang}-${stamp}`;
}
