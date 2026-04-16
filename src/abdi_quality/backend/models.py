from __future__ import annotations

from enum import Enum

from pydantic import BaseModel


class ScanStatus(str, Enum):
    PASS = "pass"
    FAIL = "fail"


class QualityGrade(str, Enum):
    A = "A"
    B = "B"
    C = "C"
    D = "D"
    E = "E"


class DeltaIndicator(BaseModel):
    current: float
    previous: float | None = None
    delta: float | None = None
    direction: str | None = None  # "up", "down", "flat"


class SparklinePoint(BaseModel):
    timestamp: str
    value: float


class KpiCard(BaseModel):
    label: str
    value: str
    raw_value: float
    status: str  # "good", "warning", "danger"
    tooltip: str
    delta: DeltaIndicator | None = None
    sparkline: list[SparklinePoint] = []


# --- List view (ScanSummaryOut) ---
class ScanSummaryOut(BaseModel):
    pr_number: str
    commit_sha: str
    branch: str
    author: str
    timestamp: str
    status: ScanStatus
    coverage_pct: float
    bugs: int
    security: int
    secrets: int
    hotspots: int
    duplication: float
    tests_total: int
    quality_grade: QualityGrade
    bugs_per_kloc: float | None = None
    vulns_per_kloc: float | None = None


# --- Tool findings ---
class ToolFinding(BaseModel):
    rule_id: str = ""
    rule_name: str = ""
    file: str = ""
    line: int = 0
    message: str = ""
    severity: str = ""
    source: str = "python"


class DuplicateSegment(BaseModel):
    file1: str = ""
    start1: int = 0
    end1: int = 0
    file2: str = ""
    start2: int = 0
    end2: int = 0
    lines: int = 0
    tokens: int = 0


# --- Breakdowns ---
class PylintBreakdown(BaseModel):
    errors: int = 0
    warnings: int = 0
    conventions: int = 0
    refactors: int = 0
    nb_count: int = 0
    py_count: int = 0


class BanditSeverity(BaseModel):
    high: int = 0
    medium: int = 0
    low: int = 0
    notebook_count: int = 0


class TestResults(BaseModel):
    passed: int = 0
    failed: int = 0
    error: int = 0
    skipped: int = 0
    total: int = 0
    duration: float = 0.0
    failures: list[dict] = []


class CoverageFile(BaseModel):
    file: str
    statements: int = 0
    covered: int = 0
    missing: int = 0
    coverage_pct: float = 0.0


class TechnicalDebt(BaseModel):
    ratio_pct: float
    grade: QualityGrade
    remediation_minutes: float
    development_minutes: float


class NotebookSourceSplit(BaseModel):
    tool: str
    notebook_count: int = 0
    python_count: int = 0


class OwaspCategory(BaseModel):
    category: str
    category_id: str
    count: int
    findings: list[ToolFinding] = []


class RecurringViolation(BaseModel):
    rule_id: str
    rule_name: str = ""
    tool: str
    count: int
    severity: str = ""


# --- Detail view (ScanDetailOut) ---
class ScanDetailOut(BaseModel):
    pr_number: str
    pr_title: str
    pr_author: str
    workflow_url: str
    branch: str
    commit_sha: str
    repo: str
    timestamp: str
    status: ScanStatus
    quality_grade: QualityGrade
    technical_debt: TechnicalDebt
    bugs_per_kloc: float | None = None
    vulns_per_kloc: float | None = None
    loc: int = 0
    kpi_cards: list[KpiCard] = []
    pylint_breakdown: PylintBreakdown = PylintBreakdown()
    bandit_severity: BanditSeverity = BanditSeverity()
    coverage_files: list[CoverageFile] = []
    test_results: TestResults = TestResults()
    notebook_source_split: list[NotebookSourceSplit] = []
    gitleaks_findings: list[ToolFinding] = []
    semgrep_findings: list[ToolFinding] = []
    bandit_findings: list[ToolFinding] = []
    pylint_findings: list[ToolFinding] = []
    ruff_findings: list[ToolFinding] = []
    sqlfluff_findings: list[ToolFinding] = []
    jscpd_duplicates: list[DuplicateSegment] = []
    ai_review: dict | None = None
    duplication_pct: float = 0.0
    total_issues: int = 0
    # Number of findings hidden by the admin severity filter, per tool.
    # Lets the UI show "N findings hidden below min severity" banners.
    hidden_pylint_count: int = 0
    hidden_bandit_count: int = 0


# --- Trend models ---
class TrendPoint(BaseModel):
    timestamp: str
    pr_number: str
    value: float


class TrendSeries(BaseModel):
    metric: str
    label: str
    data: list[TrendPoint]


class TrendsOut(BaseModel):
    series: list[TrendSeries]
    scans_included: int


# --- Team models ---
class ContributorOut(BaseModel):
    author: str
    total_prs: int
    pass_rate: float
    avg_coverage: float
    total_bugs: int
    total_security: int
    pass_count: int
    fail_count: int


class TeamHealthOut(BaseModel):
    total_scans: int
    pass_rate: float
    failing_prs: int
    avg_coverage: float
    active_authors: int
    contributors: list[ContributorOut]
    recent_scans: list[ScanSummaryOut]


# --- Security models ---
class SecurityOverviewOut(BaseModel):
    owasp_categories: list[OwaspCategory]
    bandit_severity: BanditSeverity
    total_vulnerabilities: int
    total_secrets: int
    top_recurring: list[RecurringViolation]


# --- Fix rate ---
class FixRateOut(BaseModel):
    pr_number: str
    previous_pr: str | None = None
    fix_rate_pct: float | None = None
    violations_current: int = 0
    violations_previous: int | None = None


# --- Overview ---
class OverviewOut(BaseModel):
    quality_grade: QualityGrade
    kpi_cards: list[KpiCard]
    recent_activity: list[ScanSummaryOut]
    top_recurring_violations: list[RecurringViolation]
