"""FastAPI router for MATRIX Code Quality Dashboard."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import conf
from .metrics import (
    build_overview,
    build_scan_detail,
    build_scan_summary,
    build_security_overview,
    build_team_health,
    build_trends,
    compute_fix_rate,
)
from .models import (
    FixRateOut,
    OverviewOut,
    ScanDetailOut,
    ScanSummaryOut,
    SecurityOverviewOut,
    TeamHealthOut,
    TrendsOut,
)
from .report_loader import get_all_reports, get_report_by_pr


api = APIRouter(prefix=conf.api_prefix)


# ── Routes ─────────────────────────────────────────────────────────────────


@api.get("/overview", response_model=OverviewOut, operation_id="getOverview")
async def get_overview() -> OverviewOut:
    """Dashboard overview: quality grade, KPI cards with sparklines, recent activity."""
    reports = get_all_reports()
    return build_overview(reports)


@api.get("/scans", response_model=list[ScanSummaryOut], operation_id="listScans")
async def list_scans(
    author: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
) -> list[ScanSummaryOut]:
    """List all scans in summary view with optional filters."""
    reports = get_all_reports()
    summaries = [build_scan_summary(e, e["data"]) for e in reports]

    if author:
        summaries = [s for s in summaries if s.author == author]
    if status:
        summaries = [s for s in summaries if s.status.value == status]

    return summaries[:limit]


@api.get(
    "/scans/{pr_number}",
    response_model=ScanDetailOut,
    operation_id="getScan",
)
async def get_scan(pr_number: str) -> ScanDetailOut:
    """Full detail for the latest scan of a given PR."""
    report = get_report_by_pr(pr_number)
    if not report:
        raise HTTPException(status_code=404, detail=f"No report found for PR #{pr_number}")

    reports = get_all_reports()
    # Find previous report (chronologically next in the sorted-desc list)
    prev_report = None
    for i, entry in enumerate(reports):
        if str(entry["data"].get("pr_number", "")) == str(pr_number):
            if i + 1 < len(reports):
                prev_report = reports[i + 1]["data"]
            break

    return build_scan_detail(report, prev_report, reports)


@api.get("/trends", response_model=TrendsOut, operation_id="getTrends")
async def get_trends(
    limit: int = Query(default=50, le=200),
) -> TrendsOut:
    """Time-series data for trend charts across historical scans."""
    reports = get_all_reports()
    return build_trends(reports, limit)


@api.get("/team", response_model=TeamHealthOut, operation_id="getTeamHealth")
async def get_team_health() -> TeamHealthOut:
    """Team-level KPIs, contributor breakdown, pass/fail by author."""
    reports = get_all_reports()
    return build_team_health(reports)


@api.get(
    "/security",
    response_model=SecurityOverviewOut,
    operation_id="getSecurityOverview",
)
async def get_security_overview() -> SecurityOverviewOut:
    """OWASP mapping, severity distribution, top recurring violations."""
    reports = get_all_reports()
    return build_security_overview(reports)


@api.get(
    "/scans/{pr_number}/fix-rate",
    response_model=FixRateOut,
    operation_id="getFixRate",
)
async def get_fix_rate(pr_number: str) -> FixRateOut:
    """Fix rate comparing current scan vs the previous scan."""
    reports = get_all_reports()
    return compute_fix_rate(reports, pr_number)


# ── App Factory ────────────────────────────────────────────────────────────


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="MATRIX Code Quality Platform",
        version="2.0.0",
        description="Code quality dashboard API for the Autobacs migration project.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api)

    # Serve built frontend static files
    dist_dir = Path(__file__).resolve().parents[2] / "dist"
    if dist_dir.exists():
        app.mount("/", StaticFiles(directory=str(dist_dir), html=True), name="static")

    return app


app = create_app()
