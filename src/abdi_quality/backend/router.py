"""FastAPI router for MATRIX Code Quality Dashboard."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .admin_auth import (
    change_password,
    create_session_token,
    revoke_token,
    validate_token,
    verify_credentials,
)
from .admin_config import AdminConfig, load_config, save_config
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
from .report_loader import get_all_reports, get_report_by_pr, invalidate_cache


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


# ── Admin ──────────────────────────────────────────────────────────────────


class LoginIn(BaseModel):
    username: str
    password: str


class LoginOut(BaseModel):
    token: str


class ChangePasswordIn(BaseModel):
    username: str
    new_password: str


def require_admin(authorization: str = Header(default="")) -> None:
    """Dependency: validates 'Authorization: Bearer <token>' against active sessions."""
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    if not validate_token(token):
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@api.post("/admin/login", response_model=LoginOut, operation_id="adminLogin")
async def admin_login(body: LoginIn) -> LoginOut:
    if not verify_credentials(body.username, body.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return LoginOut(token=create_session_token())


@api.post("/admin/logout", operation_id="adminLogout")
async def admin_logout(authorization: str = Header(default="")) -> dict:
    if authorization.lower().startswith("bearer "):
        revoke_token(authorization.split(" ", 1)[1].strip())
    return {"ok": True}


@api.post("/admin/password", operation_id="adminChangePassword", dependencies=[Depends(require_admin)])
async def admin_change_password(body: ChangePasswordIn) -> dict:
    if not body.new_password or len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    change_password(body.username, body.new_password)
    return {"ok": True}


@api.get(
    "/admin/config",
    response_model=AdminConfig,
    operation_id="adminGetConfig",
    dependencies=[Depends(require_admin)],
)
async def admin_get_config() -> AdminConfig:
    return load_config()


@api.put(
    "/admin/config",
    response_model=AdminConfig,
    operation_id="adminSaveConfig",
    dependencies=[Depends(require_admin)],
)
async def admin_save_config(body: AdminConfig) -> AdminConfig:
    save_config(body)
    # Force metrics to recompute with new config on next request
    invalidate_cache()
    return load_config()


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

    # Serve built frontend static files with SPA fallback for client-side routes
    dist_dir = Path(__file__).resolve().parents[2] / "dist"
    if dist_dir.exists():
        index_file = dist_dir / "index.html"
        # Mount hashed assets (JS/CSS) at /assets so they're served as files, not SPA fallback.
        assets_dir = dist_dir / "assets"
        if assets_dir.exists():
            app.mount(
                "/assets",
                StaticFiles(directory=str(assets_dir)),
                name="assets",
            )

        @app.get("/{full_path:path}", include_in_schema=False)
        async def spa_fallback(full_path: str):
            # API routes are handled by the router above and never reach this.
            # For everything else, prefer the exact file if it exists (favicon, etc),
            # otherwise return index.html so React Router can take over.
            candidate = dist_dir / full_path
            if full_path and candidate.is_file():
                return FileResponse(str(candidate))
            return FileResponse(str(index_file))

    return app


app = create_app()
