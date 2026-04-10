"""Load quality reports from UC Volume or local mock_volume."""

import json
import os
from pathlib import Path
import re
import time
from typing import Any


VOLUME_PATH_UC = "/Volumes/abs_metadata_dev/code_quality/reports"
MOCK_VOLUME = Path(__file__).resolve().parents[3] / "mock_volume"
REPORT_FILE_RE = re.compile(r"^pr\-(\d+)\-([a-f0-9]+)\.json$")

# Simple cache
_cache: dict[str, Any] = {"reports": None, "timestamp": 0}
_CACHE_TTL = 60


def _get_sdk():
    """Get Databricks WorkspaceClient if running on Databricks."""
    if "DATABRICKS_RUNTIME_VERSION" in os.environ or "DATABRICKS_HOST" in os.environ:
        try:
            from databricks.sdk import WorkspaceClient

            return WorkspaceClient()
        except Exception:
            return None
    return None


def _load_from_volume() -> list[dict]:
    """Load reports from UC Volume via SDK."""
    entries = []
    w = _get_sdk()
    if not w:
        return entries
    try:
        res = w.api_client.do("GET", f"/api/2.0/fs/directories{VOLUME_PATH_UC}")
        filenames = sorted(
            [c["name"] for c in res.get("contents", []) if not c.get("is_directory", False)],
            reverse=True,
        )
        for base in filenames:
            m = REPORT_FILE_RE.match(base)
            if not m:
                continue
            resp = w.files.download(f"{VOLUME_PATH_UC}/{base}")
            data = json.loads(resp.contents.read())
            entries.append({"filename": base, "data": data})
    except Exception:
        pass
    return entries


def _load_from_mock() -> list[dict]:
    """Load reports from local mock_volume directory."""
    entries = []
    MOCK_VOLUME.mkdir(exist_ok=True)
    for f in MOCK_VOLUME.iterdir():
        m = REPORT_FILE_RE.match(f.name)
        if not m:
            continue
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            entries.append({"filename": f.name, "data": data})
        except Exception:
            continue
    return entries


def get_all_reports() -> list[dict]:
    """Get all reports, cached for CACHE_TTL seconds."""
    now = time.time()
    if _cache["reports"] is not None and (now - _cache["timestamp"]) < _CACHE_TTL:
        return _cache["reports"]

    entries = _load_from_volume()
    if not entries:
        entries = _load_from_mock()

    # Sort by timestamp descending
    entries.sort(key=lambda e: e["data"].get("timestamp", ""), reverse=True)
    _cache["reports"] = entries
    _cache["timestamp"] = now
    return entries


def get_report_by_pr(pr_number: str) -> dict | None:
    """Get the latest report for a given PR number."""
    for entry in get_all_reports():
        if str(entry["data"].get("pr_number", "")) == str(pr_number):
            return entry["data"]
    return None


def invalidate_cache():
    """Force cache refresh on next call."""
    _cache["reports"] = None
    _cache["timestamp"] = 0
