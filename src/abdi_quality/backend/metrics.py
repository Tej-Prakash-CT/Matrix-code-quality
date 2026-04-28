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
from .admin_config import AdminConfig, load_config, rule_allowed, severity_passes
from .owasp import get_owasp_category
from .rule_names import get_rule_name


def _filter_findings(findings: list, cfg: AdminConfig, severity_key: str = "severity", rule_keys: tuple = ("rule_id", "test_id", "message_id")) -> list:
    """Drop findings below min severity or whose rule id is in ignored_rules."""
    out = []
    for f in findings:
        sev = f.get(severity_key, "") or ""
        # Some tools use 'type' instead of severity (pylint)
        if not sev:
            sev = f.get("type", "") or ""
        rid = next((f.get(k, "") for k in rule_keys if f.get(k)), "")
        if sev and not severity_passes(sev, cfg):
            continue
        if rid and not rule_allowed(rid, cfg):
            continue
        out.append(f)
    return out


def _tool_enabled(tool: str, cfg: AdminConfig) -> bool:
    tc = cfg.tools.get(tool)
    return True if tc is None else tc.enabled


# ── Per-KLOC ──


def bugs_per_kloc(report: dict, cfg: AdminConfig | None = None) -> float | None:
    if cfg is not None and not _tool_enabled("semgrep", cfg):
        return None
    # Use jscpd total_lines only if jscpd tool is enabled (or no cfg provided)
    if cfg is not None and not _tool_enabled("jscpd", cfg):
        return None
    total_lines = report.get("jscpd", {}).get("total_lines", 0)
    if total_lines == 0:
        return None
    # Use severity-filtered count so KPI matches the visible findings table
    if cfg is not None:
        bugs = len(_filter_findings(report.get("semgrep", {}).get("findings", []), cfg))
    else:
        bugs = report.get("semgrep", {}).get("count", 0)
    return round((bugs / total_lines) * 1000, 2)


def vulns_per_kloc(report: dict, cfg: AdminConfig | None = None) -> float | None:
    if cfg is not None and not _tool_enabled("bandit", cfg):
        return None
    if cfg is not None and not _tool_enabled("jscpd", cfg):
        return None
    total_lines = report.get("jscpd", {}).get("total_lines", 0)
    if total_lines == 0:
        return None
    # Use severity-filtered count so KPI matches the visible findings table
    if cfg is not None:
        vulns = len(_filter_findings(report.get("bandit", {}).get("findings", []), cfg))
    else:
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


def _ruff_score(report: dict) -> float:
    errors = report.get("summary", {}).get("ruff_errors", 0)
    if errors == 0:
        return 100
    if errors <= 3:
        return 80
    if errors <= 10:
        return 50
    return 20


def _grade_from_score(score: float) -> QualityGrade:
    if score >= 95:
        return QualityGrade.A
    if score >= 85:
        return QualityGrade.B
    if score >= 70:
        return QualityGrade.C
    if score >= 50:
        return QualityGrade.D
    return QualityGrade.E


# Failing PRs are floored at this grade regardless of weighted score, so a
# non-technical reader never sees a failing PR labelled "Excellent" / "Good".
FAIL_GRADE_CAP: QualityGrade = QualityGrade.D


def compute_quality_grade_breakdown(
    report: dict,
    status: ScanStatus,
    cfg: AdminConfig | None = None,
) -> "GradeBreakdownOut":
    """Per-dimension breakdown of the weighted grade, including the fail-cap.
    Returned on /scans/{pr} so the UI can show *why* a PR landed in a grade.
    """
    from .models import GradeBreakdownOut, GradeDimensionOut  # avoid circular

    if cfg is None:
        cfg = load_config()
    gw = cfg.grade_weights

    cov_pct = report.get("coverage", {}).get("total_pct", 0)
    cov_score = min(cov_pct, 100)
    bugs = report.get("semgrep", {}).get("count", 0)
    bd = report.get("bandit", {})
    gl = report.get("gitleaks", {})
    td = compute_technical_debt(report)
    dup_pct = report.get("jscpd", {}).get("percentage", 0)
    ruff_errs = report.get("summary", {}).get("ruff_errors", 0)

    rel = _reliability_score(report)
    sec = _security_score(report)
    maint = _maintainability_score(report)
    dupl = _duplication_score(report)
    ruff = _ruff_score(report)

    dims = [
        GradeDimensionOut(
            name="Reliability",
            raw_value=f"{bugs} Semgrep bug(s)",
            score=rel,
            weight=gw.reliability,
            contribution=rel * gw.reliability,
        ),
        GradeDimensionOut(
            name="Security",
            raw_value=(
                f"{bd.get('high', 0)} high · {bd.get('medium', 0)} medium · "
                f"{bd.get('low', 0)} low Bandit + {gl.get('count', 0)} secret(s)"
            ),
            score=sec,
            weight=gw.security,
            contribution=sec * gw.security,
        ),
        GradeDimensionOut(
            name="Maintainability",
            raw_value=f"Tech debt {td.grade.value} ({td.percentage:.1f}%)",
            score=maint,
            weight=gw.maintainability,
            contribution=maint * gw.maintainability,
        ),
        GradeDimensionOut(
            name="Coverage",
            raw_value=f"{cov_pct:.1f}%",
            score=cov_score,
            weight=gw.coverage,
            contribution=cov_score * gw.coverage,
        ),
        GradeDimensionOut(
            name="Duplication",
            raw_value=f"{dup_pct:.1f}%",
            score=dupl,
            weight=gw.duplication,
            contribution=dupl * gw.duplication,
        ),
        GradeDimensionOut(
            name="Ruff",
            raw_value=f"{ruff_errs} error(s)",
            score=ruff,
            weight=gw.ruff,
            contribution=ruff * gw.ruff,
        ),
    ]

    weighted = sum(d.contribution for d in dims)
    base_grade = _grade_from_score(weighted)

    # Floor failing PRs to the cap grade so a non-tech reader never sees a
    # failing PR with an A/B label.
    fail_cap_applied = False
    final_grade = base_grade
    if status == ScanStatus.FAIL:
        order = ["A", "B", "C", "D", "E"]
        if order.index(base_grade.value) < order.index(FAIL_GRADE_CAP.value):
            final_grade = FAIL_GRADE_CAP
            fail_cap_applied = True

    return GradeBreakdownOut(
        dimensions=dims,
        weighted_total=weighted,
        base_grade=base_grade,
        final_grade=final_grade,
        fail_cap_applied=fail_cap_applied,
        cap_grade=FAIL_GRADE_CAP,
    )


def compute_quality_grade(
    report: dict,
    cfg: AdminConfig | None = None,
    status: ScanStatus | None = None,
) -> QualityGrade:
    """Letter grade for a PR. Pass `status` (pre-computed) to apply the
    fail-cap; if omitted, status is recomputed from current admin thresholds.
    """
    if cfg is None:
        cfg = load_config()
    if status is None:
        status = _evaluate_scan_status(report, cfg)
    return compute_quality_grade_breakdown(report, status, cfg).final_grade


def _evaluate_scan_status(report: dict, cfg: AdminConfig) -> ScanStatus:
    """
    Re-evaluate pass/fail using current admin thresholds.
    Respects: tool toggles, thresholds, severity fail_on list, tech debt thresholds.
    """
    thr = cfg.thresholds
    sf = cfg.severity_filter
    s = report.get("summary", {})

    # ── jscpd: duplication ──────────────────────────────────────────────────
    if _tool_enabled("jscpd", cfg):
        dup = report.get("jscpd", {}).get("percentage", 0)
        if dup > thr.duplication_fail_pct:
            return ScanStatus.FAIL

    # ── coverage/pytest ─────────────────────────────────────────────────────
    if _tool_enabled("coverage", cfg) and _tool_enabled("pytest", cfg):
        cov = report.get("coverage", {}).get("total_pct", 0)
        tests = report.get("pytest", {}).get("total", 0)
        if tests > 0 and cov < thr.coverage_target_pct:
            return ScanStatus.FAIL

    # ── semgrep: bugs/kloc ──────────────────────────────────────────────────
    if _tool_enabled("semgrep", cfg):
        bkloc = bugs_per_kloc(report, cfg)
        if bkloc is not None and bkloc > thr.bugs_per_kloc_danger:
            return ScanStatus.FAIL

    # ── bandit: vulns/kloc + severity fail_on ───────────────────────────────
    if _tool_enabled("bandit", cfg):
        vkloc = vulns_per_kloc(report, cfg)
        if vkloc is not None and vkloc > thr.vulns_per_kloc_danger:
            return ScanStatus.FAIL
        # Severity-based fail: check if any bandit finding severity is in fail_on
        bd = report.get("bandit", {})
        for sev in sf.fail_on:
            if severity_passes(sev, cfg) and bd.get(sev.lower(), 0) > 0:
                return ScanStatus.FAIL

    # ── gitleaks: secrets + severity fail_on ────────────────────────────────
    if _tool_enabled("gitleaks", cfg):
        if "high" in sf.fail_on and report.get("gitleaks", {}).get("count", 0) > 0:
            return ScanStatus.FAIL

    # ── ruff: any error fails (mirrors the CI Quality Gate exactly) ────────
    # The CI pipeline blocks a PR on ruff_errors > 0, so the dashboard must
    # report the same verdict. A separate hotspots threshold would let PRs
    # that failed CI show up as PASS here, which is the mismatch we hit on
    # PR #176 (1 Ruff error → CI fail, dashboard pass).
    if _tool_enabled("ruff", cfg) and s.get("ruff_errors", 0) > 0:
        return ScanStatus.FAIL

    # ── tech debt ────────────────────────────────────────────────────────────
    td = compute_technical_debt(report)
    if td.ratio_pct > thr.tech_debt_ratio_danger_pct:
        return ScanStatus.FAIL

    return ScanStatus.PASS


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


def build_kpi_cards(report: dict, prev_report: dict | None, all_reports: list[dict], cfg: AdminConfig | None = None) -> list[KpiCard]:
    """Build 8 KPI cards for overview/detail using admin config thresholds and tool toggles."""
    if cfg is None:
        cfg = load_config()
    thr = cfg.thresholds

    s = report.get("summary", {})
    prev = prev_report or {}
    prev_s = prev.get("summary", {})

    # ── Coverage (respect tool toggles) ─────────────────────────────────────
    cov_enabled = _tool_enabled("coverage", cfg) and _tool_enabled("pytest", cfg)
    cov = report.get("coverage", {}).get("total_pct", 0) if cov_enabled else 0
    tests = report.get("pytest", {}).get("total", 0) if _tool_enabled("pytest", cfg) else 0
    cov_good = cov >= thr.coverage_target_pct
    cov_danger = cov < 50

    # ── Duplication (jscpd) ──────────────────────────────────────────────────
    dup_enabled = _tool_enabled("jscpd", cfg)
    dup = report.get("jscpd", {}).get("percentage", 0) if dup_enabled else 0
    dup_good = dup <= thr.duplication_warning_pct
    dup_danger = dup > thr.duplication_fail_pct

    # ── Bugs/KLOC (semgrep) ──────────────────────────────────────────────────
    bkloc = bugs_per_kloc(report, cfg)
    bkloc_good = (bkloc or 0) <= thr.bugs_per_kloc_warning
    bkloc_danger = (bkloc or 0) > thr.bugs_per_kloc_danger

    # ── Vulns/KLOC (bandit) ──────────────────────────────────────────────────
    vkloc = vulns_per_kloc(report, cfg)
    vkloc_good = (vkloc or 0) <= thr.vulns_per_kloc_warning
    vkloc_danger = (vkloc or 0) > thr.vulns_per_kloc_danger

    # ── Hotspots (pylint + ruff, respect toggles) ─────────────────────────────
    hotspots = 0
    if _tool_enabled("pylint", cfg):
        hotspots += s.get("pylint_errors", 0)
    if _tool_enabled("ruff", cfg):
        hotspots += s.get("ruff_errors", 0)
    hs_good = hotspots <= thr.hotspots_warning
    hs_danger = hotspots > thr.hotspots_danger

    # ── Secrets (gitleaks) ───────────────────────────────────────────────────
    secrets = report.get("gitleaks", {}).get("count", 0) if _tool_enabled("gitleaks", cfg) else 0
    prev_secrets = float(prev.get("gitleaks", {}).get("count", 0)) if _tool_enabled("gitleaks", cfg) else 0.0

    # ── Tech Debt (use admin thresholds) ─────────────────────────────────────
    td = compute_technical_debt(report)
    td_good = td.ratio_pct <= thr.tech_debt_ratio_warning_pct
    td_danger = td.ratio_pct > thr.tech_debt_ratio_danger_pct

    # Prev hotspots (respect toggles)
    prev_hotspots = 0.0
    if _tool_enabled("pylint", cfg):
        prev_hotspots += prev_s.get("pylint_errors", 0)
    if _tool_enabled("ruff", cfg):
        prev_hotspots += prev_s.get("ruff_errors", 0)

    # Helper: returns empty sparkline when tool disabled, real data when enabled
    def _spark(enabled: bool, fn) -> list:
        return build_sparkline(all_reports, fn) if enabled else []

    # Hotspot sparkline only counts enabled linters
    def _hotspot_fn(d: dict) -> float:
        total = 0.0
        if _tool_enabled("pylint", cfg):
            total += d.get("summary", {}).get("pylint_errors", 0)
        if _tool_enabled("ruff", cfg):
            total += d.get("summary", {}).get("ruff_errors", 0)
        return total

    cards = [
        KpiCard(
            label="Code Coverage",
            value=f"{cov}%" if (cov_enabled and tests > 0) else "N/A",
            raw_value=cov,
            status=_kpi_status(cov_good, cov_danger) if (cov_enabled and tests > 0) else "good",
            tooltip=f"Percentage of pipeline code exercised by framework validation tests (Pytest). Target: {thr.coverage_target_pct}%"
                    + (" [tool disabled]" if not cov_enabled else ""),
            delta=compute_delta(cov, prev.get("coverage", {}).get("total_pct")) if (prev and cov_enabled) else None,
            sparkline=_spark(cov_enabled, lambda d: d.get("coverage", {}).get("total_pct", 0)),
        ),
        KpiCard(
            label="Duplication",
            value=f"{dup}%" if dup_enabled else "N/A",
            raw_value=dup,
            status=_kpi_status(dup_good, dup_danger) if dup_enabled else "good",
            tooltip=f"Code duplication. Warn: {thr.duplication_warning_pct}%, Fail: {thr.duplication_fail_pct}%"
                    + (" [tool disabled]" if not dup_enabled else ""),
            delta=compute_delta(dup, prev.get("jscpd", {}).get("percentage")) if (prev and dup_enabled) else None,
            sparkline=_spark(dup_enabled, lambda d: d.get("jscpd", {}).get("percentage", 0)),
        ),
        KpiCard(
            label="Bugs / KLOC",
            value=f"{bkloc:.2f}" if bkloc is not None else "N/A",
            raw_value=bkloc or 0,
            status=_kpi_status(bkloc_good, bkloc_danger) if bkloc is not None else "good",
            tooltip=f"Bug density (semgrep). Warn: {thr.bugs_per_kloc_warning}, Fail: {thr.bugs_per_kloc_danger}"
                    + (" [tool disabled]" if not _tool_enabled("semgrep", cfg) else ""),
            delta=compute_delta(bkloc or 0, bugs_per_kloc(prev, cfg)) if (prev and bkloc is not None) else None,
            sparkline=_spark(_tool_enabled("semgrep", cfg), lambda d: bugs_per_kloc(d, cfg) or 0),
        ),
        KpiCard(
            label="Vulns / KLOC",
            value=f"{vkloc:.2f}" if vkloc is not None else "N/A",
            raw_value=vkloc or 0,
            status=_kpi_status(vkloc_good, vkloc_danger) if vkloc is not None else "good",
            tooltip=f"Vuln density (bandit). Warn: {thr.vulns_per_kloc_warning}, Fail: {thr.vulns_per_kloc_danger}"
                    + (" [tool disabled]" if not _tool_enabled("bandit", cfg) else ""),
            delta=compute_delta(vkloc or 0, vulns_per_kloc(prev, cfg)) if (prev and vkloc is not None) else None,
            sparkline=_spark(_tool_enabled("bandit", cfg), lambda d: vulns_per_kloc(d, cfg) or 0),
        ),
        KpiCard(
            label="Hotspots",
            value=str(hotspots),
            raw_value=float(hotspots),
            status=_kpi_status(hs_good, hs_danger),
            tooltip=f"Errors from enabled linters (pylint/ruff). Warn: {thr.hotspots_warning}, Fail: {thr.hotspots_danger}",
            delta=compute_delta(float(hotspots), prev_hotspots) if prev else None,
            # Always show hotspot sparkline, but only counting enabled tools
            sparkline=build_sparkline(all_reports, _hotspot_fn),
        ),
        KpiCard(
            label="Secrets",
            value=str(secrets) if _tool_enabled("gitleaks", cfg) else "N/A",
            raw_value=float(secrets),
            status=_kpi_status(secrets == 0, secrets > 0) if _tool_enabled("gitleaks", cfg) else "good",
            tooltip="Hardcoded passwords, API keys, or credentials in code."
                    + (" [tool disabled]" if not _tool_enabled("gitleaks", cfg) else ""),
            delta=compute_delta(float(secrets), prev_secrets) if prev else None,
            sparkline=_spark(_tool_enabled("gitleaks", cfg), lambda d: float(d.get("gitleaks", {}).get("count", 0))),
        ),
        KpiCard(
            label="Validation Tests",
            value=str(tests) if _tool_enabled("pytest", cfg) else "N/A",
            raw_value=float(tests),
            status="good",
            tooltip="Framework validation tests (Pytest) that verify pipeline logic, transformations, and data quality rules."
                    + (" [tool disabled]" if not _tool_enabled("pytest", cfg) else ""),
            delta=compute_delta(float(tests), float(prev.get("pytest", {}).get("total", 0))) if prev else None,
            sparkline=_spark(_tool_enabled("pytest", cfg), lambda d: float(d.get("pytest", {}).get("total", 0))),
        ),
        KpiCard(
            label="Tech Debt",
            value=td.grade.value,
            raw_value=td.ratio_pct,
            status=_kpi_status(td_good, td_danger),
            tooltip=f"Tech debt ratio. Warn: {thr.tech_debt_ratio_warning_pct}%, Fail: {thr.tech_debt_ratio_danger_pct}%",
            delta=compute_delta(
                td.ratio_pct,
                compute_technical_debt(prev).ratio_pct if prev else None,
            )
            if prev
            else None,
            # Tech Debt is derived (pylint + ruff + semgrep + bandit), always show
            sparkline=build_sparkline(all_reports, lambda d: compute_technical_debt(d).ratio_pct),
        ),
    ]
    return cards


# ── Summary builder ──


def build_scan_summary(entry: dict, report: dict, cfg: AdminConfig | None = None) -> ScanSummaryOut:
    if cfg is None:
        cfg = load_config()
    s = report.get("summary", {})
    pylint_findings = report.get("pylint", {}).get("findings", [])
    pylint_errors = sum(1 for f in pylint_findings if f.get("type", "").lower() in ("error", "fatal"))

    # Re-evaluate status against current admin thresholds instead of using stale CI value
    live_status = _evaluate_scan_status(report, cfg)

    return ScanSummaryOut(
        pr_number=str(report.get("pr_number", "")),
        commit_sha=str(report.get("commit_sha", ""))[:7],
        branch=report.get("branch", "unknown"),
        author=report.get("pr_author", "unknown"),
        timestamp=report.get("timestamp", ""),
        status=live_status,
        coverage_pct=report.get("coverage", {}).get("total_pct", 0),
        bugs=len(_filter_findings(report.get("semgrep", {}).get("findings", []), cfg)),
        security=len(_filter_findings(report.get("bandit", {}).get("findings", []), cfg)),
        secrets=report.get("gitleaks", {}).get("count", 0),
        hotspots=pylint_errors + s.get("ruff_errors", 0),
        duplication=report.get("jscpd", {}).get("percentage", 0),
        tests_total=report.get("pytest", {}).get("total", 0),
        quality_grade=compute_quality_grade(report, cfg, status=live_status),
        bugs_per_kloc=bugs_per_kloc(report, cfg),
        vulns_per_kloc=vulns_per_kloc(report, cfg),
    )


# ── Detail builder ──


def build_scan_detail(report: dict, prev_report: dict | None, all_reports: list[dict]) -> ScanDetailOut:
    cfg = load_config()  # single load, passed through to all helpers
    s = report.get("summary", {})
    pl = report.get("pylint", {})
    bd = report.get("bandit", {})

    # Build tool findings
    def to_findings(items: list, tool: str, default_severity: str = "") -> list[ToolFinding]:
        if not _tool_enabled(tool, cfg):
            return []
        filtered = _filter_findings(items, cfg)
        findings = []
        for f in filtered:
            rid = f.get("rule_id", f.get("test_id", f.get("message_id", "")))
            # For pylint, prefer the symbol field as rule_name if available
            name = f.get("symbol", "") or get_rule_name(rid)
            if name == rid and f.get("symbol"):
                name = f["symbol"].replace("-", " ").replace("_", " ").title()
            # Pylint findings don't have a `severity` field — they carry `type`
            # ("error" / "warning" / "convention" / "refactor"). Fall back to
            # that so the UI always receives a non-empty severity it can
            # colour-code and filter by.
            sev = f.get("severity") or f.get("type") or default_severity
            findings.append(
                ToolFinding(
                    rule_id=rid,
                    rule_name=name,
                    file=f.get("file", f.get("path", "")),
                    line=f.get("line", f.get("line_start", 0)),
                    message=f.get("message", f.get("description", "")),
                    severity=sev,
                    source=f.get("source", "python"),
                )
            )
        return findings

    # Notebook/source split (only for visible findings)
    nb_split = []
    for tool_name, tool_data in [("pylint", pl), ("bandit", bd)]:
        visible = _filter_findings(tool_data.get("findings", []), cfg) if _tool_enabled(tool_name, cfg) else []
        nb = sum(1 for f in visible if f.get("source") == "notebook")
        nb_split.append(NotebookSourceSplit(tool=tool_name, notebook_count=nb, python_count=len(visible) - nb))

    # Coverage files
    cov_files = [CoverageFile(**cf) for cf in report.get("coverage", {}).get("files", [])]

    # Jscpd duplicates
    jscpd_dups = [DuplicateSegment(**d) for d in report.get("jscpd", {}).get("duplicates", [])]

    # Compute pylint breakdown from severity-filtered findings so the chart
    # matches what the findings table actually displays.
    if _tool_enabled("pylint", cfg):
        filtered_pylint = _filter_findings(pl.get("findings", []), cfg)
        _pl_types = Counter((f.get("type") or "").lower() for f in filtered_pylint)
        pl_errors = _pl_types.get("error", 0) + _pl_types.get("fatal", 0)
        pl_warnings = _pl_types.get("warning", 0)
        pl_conventions = _pl_types.get("convention", 0)
        pl_refactors = _pl_types.get("refactor", 0)
        # Count filtered notebook / py files
        pl_nb = sum(1 for f in filtered_pylint if f.get("source") == "notebook")
        pl_py = len(filtered_pylint) - pl_nb
        # Raw (unfiltered) counts for the hidden-findings banner
        raw_pylint_count = len(pl.get("findings", []))
        hidden_pylint = raw_pylint_count - len(filtered_pylint)
    else:
        pl_errors = pl_warnings = pl_conventions = pl_refactors = 0
        pl_nb = pl_py = 0
        hidden_pylint = 0

    # Hidden bandit findings (filtered out by severity)
    raw_bandit_count = len(bd.get("findings", []))
    if _tool_enabled("bandit", cfg):
        filtered_bandit = _filter_findings(bd.get("findings", []), cfg)
        hidden_bandit = raw_bandit_count - len(filtered_bandit)
    else:
        hidden_bandit = 0

    live_status = _evaluate_scan_status(report, cfg)
    breakdown = compute_quality_grade_breakdown(report, live_status, cfg)

    return ScanDetailOut(
        pr_number=str(report.get("pr_number", "")),
        pr_title=report.get("pr_title", ""),
        pr_author=report.get("pr_author", "unknown"),
        workflow_url=report.get("workflow_url", ""),
        branch=report.get("branch", "unknown"),
        commit_sha=str(report.get("commit_sha", "")),
        repo=report.get("repo", ""),
        timestamp=report.get("timestamp", ""),
        status=live_status,
        quality_grade=breakdown.final_grade,
        grade_breakdown=breakdown,
        technical_debt=compute_technical_debt(report),
        bugs_per_kloc=bugs_per_kloc(report, cfg),
        vulns_per_kloc=vulns_per_kloc(report, cfg),
        loc=report.get("jscpd", {}).get("total_lines", 0),
        kpi_cards=build_kpi_cards(report, prev_report, all_reports, cfg),
        pylint_breakdown=PylintBreakdown(
            errors=pl_errors,
            warnings=pl_warnings,
            conventions=pl_conventions,
            refactors=pl_refactors,
            nb_count=pl_nb,
            py_count=pl_py,
        ),
        bandit_severity=BanditSeverity(
            high=bd.get("high", 0) if severity_passes("high", cfg) else 0,
            medium=bd.get("medium", 0) if severity_passes("medium", cfg) else 0,
            low=bd.get("low", 0) if severity_passes("low", cfg) else 0,
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
        gitleaks_findings=to_findings(report.get("gitleaks", {}).get("findings", []), "gitleaks"),
        semgrep_findings=to_findings(report.get("semgrep", {}).get("findings", []), "semgrep"),
        bandit_findings=to_findings(report.get("bandit", {}).get("findings", []), "bandit"),
        pylint_findings=to_findings(pl.get("findings", []), "pylint"),
        ruff_findings=to_findings(report.get("ruff", {}).get("findings", []), "ruff"),
        sqlfluff_findings=[],
        jscpd_duplicates=jscpd_dups,
        ai_review=report.get("ai_review"),
        duplication_pct=report.get("jscpd", {}).get("percentage", 0),
        total_issues=s.get("total_issues", 0),
        hidden_pylint_count=hidden_pylint,
        hidden_bandit_count=hidden_bandit,
    )


# ── Trends ──


def build_trends(reports: list[dict], limit: int = 50) -> TrendsOut:
    entries = reports[:limit]
    cfg = load_config()

    # Tool-aware extractors: disabled tools always return 0.0 (flat line)
    def _bugs(d: dict) -> float:
        return float(d.get("semgrep", {}).get("count", 0)) if _tool_enabled("semgrep", cfg) else 0.0

    def _dup(d: dict) -> float:
        return float(d.get("jscpd", {}).get("percentage", 0)) if _tool_enabled("jscpd", cfg) else 0.0

    def _security(d: dict) -> float:
        if not _tool_enabled("bandit", cfg):
            return 0.0
        # Respect min severity — only show if high severity passes filter
        return float(d.get("bandit", {}).get("high", 0)) if severity_passes("high", cfg) else 0.0

    def _secrets(d: dict) -> float:
        return float(d.get("gitleaks", {}).get("count", 0)) if _tool_enabled("gitleaks", cfg) else 0.0

    def _hotspots(d: dict) -> float:
        total = 0.0
        if _tool_enabled("ruff", cfg):
            total += d.get("summary", {}).get("ruff_errors", 0)
        return total

    metric_extractors = {
        "bugs":       ("Bugs",                        _bugs),
        "duplication":("Duplication %",               _dup),
        "security":   ("High-Severity Security Issues", _security),
        "secrets":    ("Secrets",                     _secrets),
        "hotspots":   ("Hotspots",                    _hotspots),
        "tech_debt":  ("Tech Debt %",                 lambda d: compute_technical_debt(d).ratio_pct),
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

    cfg = load_config()  # single load for consistent threshold evaluation
    all_data = [e["data"] for e in reports]
    total = len(all_data)
    # Re-evaluate pass/fail using current admin thresholds
    failing = sum(1 for d in all_data if _evaluate_scan_status(d, cfg) != ScanStatus.PASS)
    pass_rate = round(((total - failing) / total) * 100, 1) if total else 0
    avg_cov = round(sum(d.get("coverage", {}).get("total_pct", 0) for d in all_data) / total, 1) if total else 0
    authors = set(d.get("pr_author", "unknown") for d in all_data)

    contributors = []
    for author in authors:
        auth_data = [d for d in all_data if d.get("pr_author") == author]
        auth_total = len(auth_data)
        passes = sum(1 for d in auth_data if _evaluate_scan_status(d, cfg) == ScanStatus.PASS)
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

    recent = [build_scan_summary(e, e["data"], cfg) for e in reports[:10]]

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
    cfg = load_config()
    all_data = [e["data"] for e in reports]

    def _sev_total(tool_key: str, sev: str) -> int:
        if not _tool_enabled(tool_key, cfg) or not severity_passes(sev, cfg):
            return 0
        return sum(d.get(tool_key, {}).get(sev, 0) for d in all_data)

    # Aggregate bandit severity (respecting admin filters)
    total_high = _sev_total("bandit", "high")
    total_med = _sev_total("bandit", "medium")
    total_low = _sev_total("bandit", "low")
    total_nb = sum(d.get("bandit", {}).get("notebook_count", 0) for d in all_data) if _tool_enabled("bandit", cfg) else 0

    # Count only visible (after filter) gitleaks & bandit findings
    def _count_visible(tool_key: str) -> int:
        if not _tool_enabled(tool_key, cfg):
            return 0
        total = 0
        for d in all_data:
            total += len(_filter_findings(d.get(tool_key, {}).get("findings", []), cfg))
        return total

    total_secrets = _count_visible("gitleaks")
    total_vulns = _count_visible("bandit")

    # OWASP mapping
    owasp_findings: dict[str, list[ToolFinding]] = {}
    rule_counter: Counter = Counter()

    for data in all_data:
        if _tool_enabled("bandit", cfg):
            for f in _filter_findings(data.get("bandit", {}).get("findings", []), cfg):
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

        # Also count semgrep and other tools for recurring violations (honor filters)
        if _tool_enabled("semgrep", cfg):
            for f in _filter_findings(data.get("semgrep", {}).get("findings", []), cfg):
                rule_counter[(f.get("rule_id", ""), "semgrep", f.get("severity", ""))] += 1
        if _tool_enabled("ruff", cfg):
            for f in _filter_findings(data.get("ruff", {}).get("findings", []), cfg):
                rule_counter[(f.get("rule_id", ""), "ruff", f.get("severity", ""))] += 1
        if _tool_enabled("pylint", cfg):
            for f in _filter_findings(data.get("pylint", {}).get("findings", []), cfg):
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

    cfg = load_config()  # single load for consistency across all cards + summaries
    latest = reports[0]["data"]
    prev = reports[1]["data"] if len(reports) > 1 else None
    grade = compute_quality_grade(latest, cfg, status=_evaluate_scan_status(latest, cfg))
    cards = build_kpi_cards(latest, prev, reports, cfg)

    recent = [build_scan_summary(e, e["data"], cfg) for e in reports[:10]]

    # Top recurring violations across all reports
    sec = build_security_overview(reports)

    return OverviewOut(
        quality_grade=grade,
        kpi_cards=cards,
        recent_activity=recent,
        top_recurring_violations=sec.top_recurring[:10],
    )
