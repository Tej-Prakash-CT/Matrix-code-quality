"""Admin configuration — tool toggles and threshold management."""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel

# Stored next to this file (or override via ADMIN_CONFIG_PATH env var)
_DEFAULT_CONFIG_PATH = Path(__file__).parent / "admin_config.json"


class ToolConfig(BaseModel):
    enabled: bool = True
    display_name: str = ""
    description: str = ""


class ThresholdConfig(BaseModel):
    coverage_target_pct: float = 80.0
    duplication_warning_pct: float = 10.0
    duplication_fail_pct: float = 20.0
    bugs_per_kloc_warning: float = 1.0
    bugs_per_kloc_danger: float = 5.0
    vulns_per_kloc_warning: float = 1.0
    vulns_per_kloc_danger: float = 3.0
    hotspots_warning: int = 5
    hotspots_danger: int = 10
    tech_debt_ratio_warning_pct: float = 10.0
    tech_debt_ratio_danger_pct: float = 50.0


class GradeWeights(BaseModel):
    reliability: float = 0.25
    security: float = 0.25
    maintainability: float = 0.20
    coverage: float = 0.15
    duplication: float = 0.10
    tests: float = 0.05


class SeverityFilter(BaseModel):
    # Findings below this severity are hidden from all dashboards/counts.
    # Accepted values: "high", "medium", "low".
    min_severity: str = "high"
    # Severities that cause a PR to fail.
    fail_on: list[str] = ["high"]


class AdminConfig(BaseModel):
    tools: dict[str, ToolConfig] = {}
    thresholds: ThresholdConfig = ThresholdConfig()
    grade_weights: GradeWeights = GradeWeights()
    severity_filter: SeverityFilter = SeverityFilter()
    ignored_rules: list[str] = []


# Canonical severity rank. Accepts native vocabularies from every tool so
# the filter stays correct regardless of whether a finding uses
#   bandit/generic:   low / medium / high
#   pylint:           convention / refactor / warning / error / fatal
#   ruff / semgrep:   info / warning / error
_SEVERITY_RANK = {
    # low-tier
    "low": 1, "convention": 1, "refactor": 1, "info": 1,
    # medium-tier
    "medium": 2, "warning": 2,
    # high-tier
    "high": 3, "error": 3, "fatal": 3, "critical": 3,
}


def severity_passes(severity: str, cfg: AdminConfig) -> bool:
    """Return True if this severity meets the configured minimum."""
    min_rank = _SEVERITY_RANK.get(cfg.severity_filter.min_severity.lower(), 3)
    sev_rank = _SEVERITY_RANK.get((severity or "").lower(), 0)
    return sev_rank >= min_rank


def rule_allowed(rule_id: str, cfg: AdminConfig) -> bool:
    """Return False if rule is explicitly ignored by admin."""
    return rule_id not in cfg.ignored_rules


def _default_config() -> AdminConfig:
    return AdminConfig(
        tools={
            "gitleaks": ToolConfig(enabled=True, display_name="Gitleaks", description="Secret Detection (credentials, API keys)"),
            "jscpd": ToolConfig(enabled=True, display_name="jscpd", description="Code Duplication Analysis"),
            "semgrep": ToolConfig(enabled=True, display_name="Semgrep", description="Bug & Pattern Detection"),
            "bandit": ToolConfig(enabled=True, display_name="Bandit", description="Python Security Analysis"),
            "pylint": ToolConfig(enabled=True, display_name="Pylint", description="Python Code Quality & Linting"),
            "ruff": ToolConfig(enabled=True, display_name="Ruff", description="Fast Python Linting"),
            "sqlfluff": ToolConfig(enabled=True, display_name="SQLFluff", description="SQL Standards & Style"),
            "pytest": ToolConfig(enabled=True, display_name="Pytest", description="Unit Test Execution"),
            "coverage": ToolConfig(enabled=True, display_name="Coverage.py", description="Test Coverage Measurement"),
        },
        thresholds=ThresholdConfig(),
        grade_weights=GradeWeights(),
    )


def get_config_path() -> Path:
    import os
    custom = os.environ.get("ADMIN_CONFIG_PATH", "")
    return Path(custom) if custom else _DEFAULT_CONFIG_PATH


def load_config() -> AdminConfig:
    path = get_config_path()
    if not path.exists():
        cfg = _default_config()
        save_config(cfg)
        return cfg
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        return AdminConfig(**raw)
    except Exception:
        return _default_config()


def save_config(config: AdminConfig) -> None:
    path = get_config_path()
    path.write_text(
        json.dumps(config.model_dump(), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
