"""Compute derived KPIs from raw report data."""

from __future__ import annotations

from collections import Counter

from .models import (
    BanditSeverity,
    ContributorOut,
    CoverageFile,
    DeltaIndicator,
    DuplicateSegment,
    FixRateOut,
    KpiCard,
    NotebookSourceSplit,
    OverviewOut,
    OwaspCategory,
    PylintBreakdown,
    QualityGrade,
    RecurringViolation,
    ScanDetailOut,
    ScanStatus,
    ScanSummaryOut,
    SecurityOverviewOut,
    SparklinePoint,
    TeamHealthOut,
    TechnicalDebt,
    TestResults,
    ToolFinding,
    TrendPoint,
    TrendSeries,
    TrendsOut,
)
from .owasp import get_owasp_category
from .rule_names import get_rule_name


# ── Per-KLOC ──


def bugs_per_kloc(report: dict) -> float | None:
    total_lines = report.get("jscpd", {}).get("total_lines", 0)
    if total_lines == 0:
        return None
    bugs = report.get("semgrep", {}).get("count", 0)
    return round((bugs / total_lines) * 1000, 2)


def vulns_per_kloc(report: dict) -> float | None:
    total_lines = report.get("jscpd", {}).get("total_lines", 0)
    if total_lines == 0:
        return None
    vulns = report.get("bandit", {}).get("count", 0)
    return round((vulns / total_lines) * 1000, 2)


# ── Technical Debt Ratio ──

_REMEDIATION_WEIGHTS = {
    "pylint_conventions": 5,
    "pylint_warnings": 15,
    "pylint_errors": 30,
    "ruff_warnings": 2,
    "ruff_errors": 10,
    "semgrep": 30,
    "bandit": 45,
}


def compute_technical_debt(report: dict) -> TechnicalDebt:
    s = report.get("summary", {})
    pl = report.get("pylint", {})

    remediation = (
        pl.get("conventions", 0) * _REMEDIATION_WEIGHTS["pylint_conventions"]
        + pl.get("warnings", 0) * _REMEDIATION_WEIGHTS["pylint_warnings"]
        + pl.get("errors", 0) * _REMEDIATION_WEIGHTS["pylint_errors"]
        + s.get("ruff_warnings", 0) * _REMEDIATION_WEIGHTS["ruff_warnings"]
        + s.get("ruff_errors", 0) * _REMEDIATION_WEIGHTS["ruff_errors"]
        + report.get("semgrep", {}).get("count", 0) * _REMEDIATION_WEIGHTS["semgrep"]
        + report.get("bandit", {}).get("count", 0) * _REMEDIATION_WEIGHTS["bandit"]
    )

    loc = report.get("jscpd", {}).get("total_lines", 0)
    dev_cost = loc * 0.06 * 8 * 60  # 0.06 days per line * 8 hours * 60 min
    ratio = (remediation / dev_cost * 100) if dev_cost > 0 else 0.0

    if ratio <= 5:
        grade = QualityGrade.A
    elif ratio <= 10:
        grade = QualityGrade.B
    elif ratio <= 20:
        grade = QualityGrade.C
    elif ratio <= 50:
        grade = QualityGrade.D
    else:
        grade = QualityGrade.E

    return TechnicalDebt(
        ratio_pct=round(ratio, 2),
        grade=grade,
        remediation_minutes=round(remediation, 1),
        development_minutes=round(dev_cost, 1),
    )


# ── Quality Grade ──


def _reliability_score(report: dict) -> float:
    bugs = report.get("semgrep", {}).get("count", 0)
    if bugs == 0:
        return 100
    if bugs <= 3:
        return 80
    if bugs <= 10:
        return 50
    return 20


def _security_score(report: dict) -> float:
    bd = report.get("bandit", {})
    gl = report.get("gitleaks", {})
    if bd.get("high", 0) > 0 or gl.get("count", 0) > 0:
        return 20
    if bd.get("medium", 0) > 0:
        return 60
    if bd.get("low", 0) > 0:
        return 80
    return 100


def _maintainability_score(report: dict) -> float:
    td = compute_technical_debt(report)
    scores = {"A": 100, "B": 80, "C": 60, "D": 40, "E": 20}
    return scores.get(td.grade.value, 20)


def _duplication_score(report: dict) -> float:
    dup = report.get("jscpd", {}).get("percentage", 0)
    if dup == 0:
        return 100
    if dup <= 3:
        return 80
    if dup <= 5:
        return 60
    if dup <= 10:
        return 40
    return 20


def _test_score(report: dict) -> float:
    pt = report.get("pytest", {})
    total = pt.get("total", 0)
    if total == 0:
        return 50  # neutral if no tests
    passed = pt.get("passed", 0)
    rate = passed / total * 100 if total else 0
    if rate == 100:
        return 100
    if rate >= 90:
        return 80
    if rate >= 70:
        return 50
    return 20


def compute_quality_grade(report: dict) -> QualityGrade:
    cov = report.get("coverage", {}).get("total_pct", 0)

    weighted = (
        _reliability_score(report) * 0.25
        + _security_score(report) * 0.25
        + _maintainability_score(report) * 0.20
        + min(cov, 100) * 0.15
        + _duplication_score(report) * 0.10
        + _test_score(report) * 0.05
    )

    if weighted >= 85:
        return QualityGrade.A
    if weighted >= 70:
        return QualityGrade.B
    if weighted >= 55:
        return QualityGrade.C
    if weighted >= 40:
        return QualityGrade.D
    return QualityGrade.E


# ── Delta Indicators ──


def compute_delta(current: float, previous: float | None) -> DeltaIndicator:
    if previous is None:
        return DeltaIndicator(current=current)
    delta = round(current - previous, 2)
    direction = "up" if delta > 0 else ("down" if delta < 0 else "flat")
    return DeltaIndicator(current=current, previous=previous, delta=delta, direction=direction)


# ── Sparklines ──


def build_sparkline(reports: list[dict], metric_fn) -> list[SparklinePoint]:
    """Build sparkline from last 20 reports for a given metric extractor function."""
    points = []
    for entry in reversed(reports[:20]):  # oldest first for chart
        data = entry["data"]
        val = metric_fn(data)
        if val is not None:
            points.append(SparklinePoint(timestamp=data.get("timestamp", ""), value=val))
    return points


# ── KPI Cards ──


def _kpi_status(good: bool, danger: bool) -> str:
    if danger:
        return "danger"
    if not good:
        return "warning"
    return "good"


def build_kpi_cards(report: dict, prev_report: dict | None, all_reports: list[dict]) -> list[KpiCard]:
    """Build 8 KPI cards for overview/detail."""
    s = report.get("summary", {})
    cov = report.get("coverage", {}).get("total_pct", 0)
    dup = report.get("jscpd", {}).get("percentage", 0)
    bugs = report.get("semgrep", {}).get("count", 0)
    vulns = report.get("bandit", {}).get("count", 0)
    secrets = report.get("gitleaks", {}).get("count", 0)
    tests = report.get("pytest", {}).get("total", 0)
    hotspots = s.get("pylint_errors", 0) + s.get("ruff_errors", 0) + s.get("sqlfluff_errors", 0)
    bkloc = bugs_per_kloc(report)
    vkloc = vulns_per_kloc(report)

    prev = prev_report or {}
    prev_s = prev.get("summary", {})

    cards = [
        KpiCard(
            label="Coverage",
            value=f"{cov}%" if tests > 0 else "N/A",
            raw_value=cov,
            status=_kpi_status(cov >= 80, cov < 50) if tests > 0 else "good",
            tooltip="Percentage of codebase verified by automated tests.",
            delta=compute_delta(cov, prev.get("coverage", {}).get("total_pct")) if prev else None,
            sparkline=build_sparkline(all_reports, lambda d: d.get("coverage", {}).get("total_pct", 0)),
        ),
        KpiCard(
            label="Duplication",
            value=f"{dup}%",
            raw_value=dup,
            status=_kpi_status(dup <= 5, dup > 10),
            tooltip="Percentage of identical code blocks repeated across the project.",
            delta=compute_delta(dup, prev.get("jscpd", {}).get("percentage")) if prev else None,
            sparkline=build_sparkline(all_reports, lambda d: d.get("jscpd", {}).get("percentage", 0)),
        ),
        KpiCard(
            label="Bugs / KLOC",
            value=f"{bkloc:.1f}" if bkloc is not None else "N/A",
            raw_value=bkloc or 0,
            status=_kpi_status((bkloc or 0) < 1, (bkloc or 0) > 5),
            tooltip="Bug density: semgrep findings per 1,000 lines of code.",
            delta=compute_delta(bkloc or 0, bugs_per_kloc(prev)) if prev and bkloc is not None else None,
            sparkline=build_sparkline(all_reports, lambda d: bugs_per_kloc(d) or 0),
        ),
        KpiCard(
            label="Vulns / KLOC",
            value=f"{vkloc:.1f}" if vkloc is not None else "N/A",
            raw_value=vkloc or 0,
            status=_kpi_status((vkloc or 0) < 1, (vkloc or 0) > 3),
            tooltip="Vulnerability density: bandit findings per 1,000 lines of code.",
            delta=compute_delta(vkloc or 0, vulns_per_kloc(prev)) if prev and vkloc is not None else None,
            sparkline=build_sparkline(all_reports, lambda d: vulns_per_kloc(d) or 0),
        ),
        KpiCard(
            label="Hotspots",
            value=f"{hotspots}",
            raw_value=float(hotspots),
            status=_kpi_status(hotspots == 0, hotspots > 10),
            tooltip="Sum of pylint errors, ruff errors, and sqlfluff errors.",
            delta=compute_delta(
                float(hotspots),
                float(prev_s.get("pylint_errors", 0) + prev_s.get("ruff_errors", 0) + prev_s.get("sqlfluff_errors", 0))
                if prev_s
                else None,
            )
            if prev
            else None,
            sparkline=build_sparkline(
                all_reports,
                lambda d: float(
                    d.get("summary", {}).get("pylint_errors", 0)
                    + d.get("summary", {}).get("ruff_errors", 0)
                    + d.get("summary", {}).get("sqlfluff_errors", 0)
                ),
            ),
        ),
        KpiCard(
            label="Secrets",
            value=f"{secrets}",
            raw_value=float(secrets),
            status=_kpi_status(secrets == 0, secrets > 0),
            tooltip="Hardcoded passwords, API keys, or credentials in code.",
            delta=compute_delta(float(secrets), float(prev.get("gitleaks", {}).get("count", 0))) if prev else None,
            sparkline=build_sparkline(all_reports, lambda d: float(d.get("gitleaks", {}).get("count", 0))),
        ),
        KpiCard(
            label="Tests",
            value=f"{tests}" if tests > 0 else "N/A",
            raw_value=float(tests),
            status="good",
            tooltip="Total number of automated unit tests run.",
            delta=compute_delta(float(tests), float(prev.get("pytest", {}).get("total", 0))) if prev else None,
            sparkline=build_sparkline(all_reports, lambda d: float(d.get("pytest", {}).get("total", 0))),
        ),
        KpiCard(
            label="Tech Debt",
            value=compute_technical_debt(report).grade.value,
            raw_value=compute_technical_debt(report).ratio_pct,
            status=_kpi_status(
                compute_technical_debt(report).grade in (QualityGrade.A, QualityGrade.B),
                compute_technical_debt(report).grade in (QualityGrade.D, QualityGrade.E),
            ),
            tooltip="Technical debt ratio: estimated remediation cost vs development cost.",
            delta=compute_delta(
                compute_technical_debt(report).ratio_pct,
                compute_technical_debt(prev).ratio_pct if prev else None,
            )
            if prev
            else None,
            sparkline=build_sparkline(all_reports, lambda d: compute_technical_debt(d).ratio_pct),
        ),
    ]
    return cards


# ── Summary builder ──


def build_scan_summary(entry: dict, report: dict) -> ScanSummaryOut:
    s = report.get("summary", {})
    pylint_findings = report.get("pylint", {}).get("findings", [])
    pylint_errors = sum(1 for f in pylint_findings if f.get("type", "").lower() in ("error", "fatal"))

    return ScanSummaryOut(
        pr_number=str(report.get("pr_number", "")),
        commit_sha=str(report.get("commit_sha", ""))[:7],
        branch=report.get("branch", "unknown"),
        author=report.get("pr_author", "unknown"),
        timestamp=report.get("timestamp", ""),
        status=ScanStatus(s.get("status", "fail")),
        coverage_pct=report.get("coverage", {}).get("total_pct", 0),
        bugs=report.get("semgrep", {}).get("count", 0),
        security=report.get("bandit", {}).get("count", 0),
        secrets=report.get("gitleaks", {}).get("count", 0),
        hotspots=pylint_errors + s.get("ruff_errors", 0) + s.get("sqlfluff_errors", 0),
        duplication=report.get("jscpd", {}).get("percentage", 0),
        tests_total=report.get("pytest", {}).get("total", 0),
        quality_grade=compute_quality_grade(report),
        bugs_per_kloc=bugs_per_kloc(report),
        vulns_per_kloc=vulns_per_kloc(report),
    )


# ── Detail builder ──


def build_scan_detail(report: dict, prev_report: dict | None, all_reports: list[dict]) -> ScanDetailOut:
    s = report.get("summary", {})
    pl = report.get("pylint", {})
    bd = report.get("bandit", {})

    # Build tool findings
    def to_findings(items: list, default_severity: str = "") -> list[ToolFinding]:
        findings = []
        for f in items:
            rid = f.get("rule_id", f.get("test_id", f.get("message_id", "")))
            # For pylint, prefer the symbol field as rule_name if available
            name = f.get("symbol", "") or get_rule_name(rid)
            if name == rid and f.get("symbol"):
                name = f["symbol"].replace("-", " ").replace("_", " ").title()
            findings.append(
                ToolFinding(
                    rule_id=rid,
                    rule_name=name,
                    file=f.get("file", f.get("path", "")),
                    line=f.get("line", f.get("line_start", 0)),
                    message=f.get("message", f.get("description", "")),
                    severity=f.get("severity", default_severity),
                    source=f.get("source", "python"),
                )
            )
        return findings

    # Notebook/source split
    nb_split = []
    for tool_name, tool_data in [("pylint", pl), ("bandit", bd)]:
        findings = tool_data.get("findings", [])
        nb = sum(1 for f in findings if f.get("source") == "notebook")
        nb_split.append(NotebookSourceSplit(tool=tool_name, notebook_count=nb, python_count=len(findings) - nb))

    # Coverage files
    cov_files = [CoverageFile(**cf) for cf in report.get("coverage", {}).get("files", [])]

    # Jscpd duplicates
    jscpd_dups = [DuplicateSegment(**d) for d in report.get("jscpd", {}).get("duplicates", [])]

    return ScanDetailOut(
        pr_number=str(report.get("pr_number", "")),
        pr_title=report.get("pr_title", ""),
        pr_author=report.get("pr_author", "unknown"),
        workflow_url=report.get("workflow_url", ""),
        branch=report.get("branch", "unknown"),
        commit_sha=str(report.get("commit_sha", "")),
        repo=report.get("repo", ""),
        timestamp=report.get("timestamp", ""),
        status=ScanStatus(s.get("status", "fail")),
        quality_grade=compute_quality_grade(report),
        technical_debt=compute_technical_debt(report),
        bugs_per_kloc=bugs_per_kloc(report),
        vulns_per_kloc=vulns_per_kloc(report),
        loc=report.get("jscpd", {}).get("total_lines", 0),
        kpi_cards=build_kpi_cards(report, prev_report, all_reports),
        pylint_breakdown=PylintBreakdown(
            errors=pl.get("errors", 0),
            warnings=pl.get("warnings", 0),
            conventions=pl.get("conventions", 0),
            refactors=pl.get("refactors", 0),
            nb_count=pl.get("nb_count", 0),
            py_count=pl.get("py_count", 0),
        ),
        bandit_severity=BanditSeverity(
            high=bd.get("high", 0),
            medium=bd.get("medium", 0),
            low=bd.get("low", 0),
            notebook_count=bd.get("notebook_count", 0),
        ),
        coverage_files=cov_files,
        test_results=TestResults(
            passed=report.get("pytest", {}).get("passed", 0),
            failed=report.get("pytest", {}).get("failed", 0),
            error=report.get("pytest", {}).get("error", 0),
            skipped=report.get("pytest", {}).get("skipped", 0),
            total=report.get("pytest", {}).get("total", 0),
            duration=report.get("pytest", {}).get("duration", 0),
            failures=report.get("pytest", {}).get("failures", []),
        ),
        notebook_source_split=nb_split,
        gitleaks_findings=to_findings(report.get("gitleaks", {}).get("findings", [])),
        semgrep_findings=to_findings(report.get("semgrep", {}).get("findings", [])),
        bandit_findings=to_findings(report.get("bandit", {}).get("findings", [])),
        pylint_findings=to_findings(pl.get("findings", [])),
        ruff_findings=to_findings(report.get("ruff", {}).get("findings", [])),
        sqlfluff_findings=to_findings(report.get("sqlfluff", {}).get("findings", [])),
        jscpd_duplicates=jscpd_dups,
        ai_review=report.get("ai_review"),
        duplication_pct=report.get("jscpd", {}).get("percentage", 0),
        total_issues=s.get("total_issues", 0),
    )


# ── Trends ──


def build_trends(reports: list[dict], limit: int = 50) -> TrendsOut:
    entries = reports[:limit]

    metric_extractors = {
        "coverage": ("Coverage %", lambda d: d.get("coverage", {}).get("total_pct", 0)),
        "bugs": ("Bugs", lambda d: float(d.get("semgrep", {}).get("count", 0))),
        "duplication": ("Duplication %", lambda d: d.get("jscpd", {}).get("percentage", 0)),
        "security": ("Security Issues", lambda d: float(d.get("bandit", {}).get("count", 0))),
        "secrets": ("Secrets", lambda d: float(d.get("gitleaks", {}).get("count", 0))),
        "tests": ("Tests", lambda d: float(d.get("pytest", {}).get("total", 0))),
        "hotspots": (
            "Hotspots",
            lambda d: float(
                d.get("summary", {}).get("pylint_errors", 0)
                + d.get("summary", {}).get("ruff_errors", 0)
                + d.get("summary", {}).get("sqlfluff_errors", 0)
            ),
        ),
        "tech_debt": ("Tech Debt %", lambda d: compute_technical_debt(d).ratio_pct),
    }

    series = []
    for metric, (label, fn) in metric_extractors.items():
        points = []
        for entry in reversed(entries):  # oldest first
            data = entry["data"]
            points.append(
                TrendPoint(
                    timestamp=data.get("timestamp", ""),
                    pr_number=str(data.get("pr_number", "")),
                    value=fn(data),
                )
            )
        series.append(TrendSeries(metric=metric, label=label, data=points))

    return TrendsOut(series=series, scans_included=len(entries))


# ── Team Health ──


def build_team_health(reports: list[dict]) -> TeamHealthOut:
    if not reports:
        return TeamHealthOut(
            total_scans=0,
            pass_rate=0,
            failing_prs=0,
            avg_coverage=0,
            active_authors=0,
            contributors=[],
            recent_scans=[],
        )

    all_data = [e["data"] for e in reports]
    total = len(all_data)
    failing = sum(1 for d in all_data if d.get("summary", {}).get("status") != "pass")
    pass_rate = round(((total - failing) / total) * 100, 1) if total else 0
    avg_cov = round(sum(d.get("coverage", {}).get("total_pct", 0) for d in all_data) / total, 1) if total else 0
    authors = set(d.get("pr_author", "unknown") for d in all_data)

    contributors = []
    for author in authors:
        auth_data = [d for d in all_data if d.get("pr_author") == author]
        auth_total = len(auth_data)
        passes = sum(1 for d in auth_data if d.get("summary", {}).get("status") == "pass")
        contributors.append(
            ContributorOut(
                author=author,
                total_prs=auth_total,
                pass_rate=round((passes / auth_total) * 100, 1) if auth_total else 0,
                avg_coverage=round(sum(d.get("coverage", {}).get("total_pct", 0) for d in auth_data) / auth_total, 1)
                if auth_total
                else 0,
                total_bugs=sum(d.get("semgrep", {}).get("count", 0) for d in auth_data),
                total_security=sum(d.get("bandit", {}).get("count", 0) for d in auth_data),
                pass_count=passes,
                fail_count=auth_total - passes,
            )
        )
    contributors.sort(key=lambda c: c.total_prs, reverse=True)

    recent = [build_scan_summary(e, e["data"]) for e in reports[:10]]

    return TeamHealthOut(
        total_scans=total,
        pass_rate=pass_rate,
        failing_prs=failing,
        avg_coverage=avg_cov,
        active_authors=len(authors),
        contributors=contributors,
        recent_scans=recent,
    )


# ── Security Overview ──


def build_security_overview(reports: list[dict]) -> SecurityOverviewOut:
    all_data = [e["data"] for e in reports]

    # Aggregate bandit severity
    total_high = sum(d.get("bandit", {}).get("high", 0) for d in all_data)
    total_med = sum(d.get("bandit", {}).get("medium", 0) for d in all_data)
    total_low = sum(d.get("bandit", {}).get("low", 0) for d in all_data)
    total_nb = sum(d.get("bandit", {}).get("notebook_count", 0) for d in all_data)
    total_secrets = sum(d.get("gitleaks", {}).get("count", 0) for d in all_data)
    total_vulns = sum(d.get("bandit", {}).get("count", 0) for d in all_data)

    # OWASP mapping
    owasp_findings: dict[str, list[ToolFinding]] = {}
    rule_counter: Counter = Counter()

    for data in all_data:
        for f in data.get("bandit", {}).get("findings", []):
            test_id = f.get("test_id", "")
            cat_id, cat_name = get_owasp_category(test_id)
            key = f"{cat_id}|{cat_name}"
            if key not in owasp_findings:
                owasp_findings[key] = []
            owasp_findings[key].append(
                ToolFinding(
                    rule_id=test_id,
                    rule_name=get_rule_name(test_id),
                    file=f.get("file", ""),
                    line=f.get("line", 0),
                    message=f.get("message", ""),
                    severity=f.get("severity", ""),
                    source=f.get("source", "python"),
                )
            )
            rule_counter[(test_id, "bandit", f.get("severity", ""))] += 1

        # Also count semgrep and other tools for recurring violations
        for f in data.get("semgrep", {}).get("findings", []):
            rule_counter[(f.get("rule_id", ""), "semgrep", f.get("severity", ""))] += 1
        for f in data.get("ruff", {}).get("findings", []):
            rule_counter[(f.get("rule_id", ""), "ruff", f.get("severity", ""))] += 1
        for f in data.get("pylint", {}).get("findings", []):
            rule_counter[(f.get("message_id", ""), "pylint", f.get("type", ""))] += 1

    owasp_cats = []
    for key, findings in sorted(owasp_findings.items(), key=lambda x: len(x[1]), reverse=True):
        cat_id, cat_name = key.split("|", 1)
        owasp_cats.append(
            OwaspCategory(category=cat_name, category_id=cat_id, count=len(findings), findings=findings[:20])
        )

    # Top recurring
    top_recurring = [
        RecurringViolation(
            rule_id=rule_id,
            rule_name=get_rule_name(rule_id),
            tool=tool,
            count=count,
            severity=sev,
        )
        for (rule_id, tool, sev), count in rule_counter.most_common(15)
    ]

    return SecurityOverviewOut(
        owasp_categories=owasp_cats,
        bandit_severity=BanditSeverity(high=total_high, medium=total_med, low=total_low, notebook_count=total_nb),
        total_vulnerabilities=total_vulns,
        total_secrets=total_secrets,
        top_recurring=top_recurring,
    )


# ── Fix Rate ──


def compute_fix_rate(reports: list[dict], pr_number: str) -> FixRateOut:
    """Compute fix rate vs the chronologically previous scan."""
    sorted_reports = reports  # already sorted desc by timestamp
    current = None
    prev = None
    for i, entry in enumerate(sorted_reports):
        if str(entry["data"].get("pr_number", "")) == str(pr_number):
            current = entry["data"]
            if i + 1 < len(sorted_reports):
                prev = sorted_reports[i + 1]["data"]
            break

    if current is None:
        return FixRateOut(pr_number=pr_number)

    curr_issues = current.get("summary", {}).get("total_issues", 0)
    if prev is None:
        return FixRateOut(pr_number=pr_number, violations_current=curr_issues)

    prev_issues = prev.get("summary", {}).get("total_issues", 0)
    rate = round(((prev_issues - curr_issues) / prev_issues) * 100, 1) if prev_issues > 0 else None

    return FixRateOut(
        pr_number=pr_number,
        previous_pr=str(prev.get("pr_number", "")),
        fix_rate_pct=rate,
        violations_current=curr_issues,
        violations_previous=prev_issues,
    )


# ── Overview ──


def build_overview(reports: list[dict]) -> OverviewOut:
    if not reports:
        return OverviewOut(
            quality_grade=QualityGrade.E,
            kpi_cards=[],
            recent_activity=[],
            top_recurring_violations=[],
        )

    latest = reports[0]["data"]
    prev = reports[1]["data"] if len(reports) > 1 else None
    grade = compute_quality_grade(latest)
    cards = build_kpi_cards(latest, prev, reports)

    recent = [build_scan_summary(e, e["data"]) for e in reports[:10]]

    # Top recurring violations across all reports
    sec = build_security_overview(reports)

    return OverviewOut(
        quality_grade=grade,
        kpi_cards=cards,
        recent_activity=recent,
        top_recurring_violations=sec.top_recurring[:10],
    )
