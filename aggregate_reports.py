#!/usr/bin/env python3
"""
aggregate_reports.py  (v1.2 — adds pylint + notebook source tagging)
----------------------------------------------------------------------
Aggregates Gitleaks, jscpd, Semgrep, Bandit, pytest, coverage.py,
and Pylint JSON reports into a single unified quality report.
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


# ── Loaders ────────────────────────────────────────────────────────────────

def load_json(path: str, default):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception as exc:
        print(f"[WARN] Could not load {path}: {exc}", file=sys.stderr)
        return default


# ── Existing parsers (unchanged) ───────────────────────────────────────────

def parse_gitleaks(raw) -> dict:
    if not isinstance(raw, list):
        raw = []
    findings = []
    for item in raw:
        findings.append({
            "rule_id":     item.get("RuleID", "unknown"),
            "file":        item.get("File", ""),
            "line_start":  item.get("StartLine", 0),
            "line_end":    item.get("EndLine", 0),
            "secret":      (item.get("Secret", "") or "")[:20] + "…",
            "description": item.get("Description", ""),
        })
    return {"count": len(findings), "findings": findings}


def parse_jscpd(raw) -> dict:
    stats = raw.get("statistics", {}).get("total", {})
    duplicates = []
    for dup in (raw.get("duplicates") or [])[:100]:
        first  = dup.get("firstFile",  {})
        second = dup.get("secondFile", {})
        duplicates.append({
            "file1":  first.get("name",  ""),
            "start1": first.get("start", 0),
            "end1":   first.get("end",   0),
            "file2":  second.get("name",  ""),
            "start2": second.get("start", 0),
            "end2":   second.get("end",   0),
            "lines":  dup.get("lines",  0),
            "tokens": dup.get("tokens", 0),
        })
    return {
        "percentage":       round(float(stats.get("percentage",     0)), 2),
        "clones":           int(stats.get("clones",          0)),
        "duplicated_lines": int(stats.get("duplicatedLines", 0)),
        "total_lines":      int(stats.get("lines",           0)),
        "duplicates":       duplicates,
    }

# def parse_jscpd(raw) -> dict:
#     stats = raw.get("statistics", {}).get("total", {})
#     duplicates = []
    
#     # Iterate through clones using the correct flat keys: file1, file2, start1, etc.
#     for dup in (raw.get("duplicates") or [])[:100]:
#         duplicates.append({
#             "file1":  dup.get("file1",  ""),
#             "start1": dup.get("start1", 0),
#             "end1":   dup.get("end1",   0),
#             "file2":  dup.get("file2",  ""),
#             "start2": dup.get("start2", 0),
#             "end2":   dup.get("end2",   0),
#             "lines":  dup.get("lines",  0),
#             "tokens": dup.get("tokens", 0),
#         })
    
#     return {
#         "percentage":       round(float(stats.get("percentage",     0)), 2),
#         "clones":           int(stats.get("clones",          0)),
#         "duplicated_lines": int(stats.get("duplicatedLines", 0)),
#         "total_lines":      int(stats.get("lines",           0)),
#         "duplicates":       duplicates,
#     }


def parse_semgrep(raw) -> dict:
    results  = raw.get("results", [])
    findings = []
    severity_counts: dict[str, int] = {}
    for r in results:
        extra = r.get("extra", {})
        sev   = extra.get("severity", "INFO").upper()
        severity_counts[sev] = severity_counts.get(sev, 0) + 1
        findings.append({
            "rule_id":  r.get("check_id", ""),
            "file":     r.get("path", ""),
            "line":     r.get("start", {}).get("line", 0),
            "message":  extra.get("message", ""),
            "severity": sev,
        })
    return {
        "count":           len(findings),
        "severity_counts": severity_counts,
        "errors_count":    severity_counts.get("ERROR",   0),
        "warning_count":   severity_counts.get("WARNING", 0),
        "info_count":      severity_counts.get("INFO",    0),
        "findings":        findings,
    }


def parse_bandit(raw) -> dict:
    results  = raw.get("results", [])
    findings = []
    for r in results:
        findings.append({
            "test_id":    r.get("test_id",        ""),
            "test_name":  r.get("test_name",      ""),
            "file":       r.get("filename",       ""),
            "line":       r.get("line_number",    0),
            "severity":   r.get("issue_severity", "LOW").upper(),
            "confidence": r.get("issue_confidence","LOW").upper(),
            "message":    r.get("issue_text",     ""),
            "source":     r.get("_source",        "python"),
        })
    high   = sum(1 for f in findings if f["severity"] == "HIGH")
    medium = sum(1 for f in findings if f["severity"] == "MEDIUM")
    low    = sum(1 for f in findings if f["severity"] == "LOW")
    nb_count = sum(1 for f in findings if f["source"] == "notebook")
    return {
        "count":    len(findings),
        "high":     high,
        "medium":   medium,
        "low":      low,
        "notebook_count": nb_count,
        "findings": findings,
    }


def parse_coverage(raw: dict, threshold: int = 80) -> dict:
    totals    = raw.get("totals", {})
    total_pct = round(float(totals.get("percent_covered", 0)), 2)
    files = []
    for filepath, data in raw.get("files", {}).items():
        summary = data.get("summary", {})
        files.append({
            "file":         filepath,
            "statements":   summary.get("num_statements", 0),
            "covered":      summary.get("covered_lines",  0),
            "missing":      summary.get("missing_lines",  0),
            "coverage_pct": round(float(summary.get("percent_covered", 0)), 1),
            "missing_lines":data.get("missing_lines", []),
        })
    files.sort(key=lambda f: f["coverage_pct"])
    return {
        "total_pct":       total_pct,
        "threshold":       threshold,
        "covered_lines":   int(totals.get("covered_lines",  0)),
        "total_lines":     int(totals.get("num_statements", 0)),
        "missing_lines":   int(totals.get("missing_lines",  0)),
        "files":           files,
        "files_count":     len(files),
        "below_threshold": [f for f in files if f["coverage_pct"] < threshold],
    }


def parse_pytest(raw: dict) -> dict:
    summary  = raw.get("summary", {})
    tests    = raw.get("tests",   [])
    failures = []
    for t in tests:
        if t.get("outcome") in ("failed", "error"):
            call = t.get("call", {})
            failures.append({
                "nodeid":   t.get("nodeid", ""),
                "outcome":  t.get("outcome", ""),
                "duration": round(t.get("duration", 0), 3),
                "message":  (call.get("longrepr") or "")[:400],
            })
    return {
        "passed":   summary.get("passed",  0),
        "failed":   summary.get("failed",  0),
        "error":    summary.get("error",   0),
        "skipped":  summary.get("skipped", 0),
        "total":    summary.get("total",   0),
        "duration": round(raw.get("duration", 0), 2),
        "failures": failures,
    }


# ── NEW: Pylint parser ─────────────────────────────────────────────────────

def parse_pylint(raw) -> dict:
    """
    Parse merged pylint JSON report (list of finding dicts).
    Each finding has: type, message-id, symbol, message, path, module, line, column.
    Notebook findings have an additional _source="notebook" key.

    Pylint message types:
      C = convention     (style, minor quality)
      R = refactor       (design suggestion)
      W = warning        (potential bug)
      E = error          (likely bug / wrong code)
      F = fatal          (prevents pylint from running further)
    """
    if not isinstance(raw, list):
        raw = []

    findings = []
    type_counts: dict[str, int] = {}

    for item in raw:
        msg_type = item.get("type", "").lower()
        type_counts[msg_type] = type_counts.get(msg_type, 0) + 1
        findings.append({
            "type":       msg_type,
            "message_id": item.get("message-id", ""),
            "symbol":     item.get("symbol",     ""),
            "message":    item.get("message",    ""),
            "path":       item.get("path",       ""),
            "module":     item.get("module",     ""),
            "line":       item.get("line",       0),
            "column":     item.get("column",     0),
            "source":     item.get("_source",    "python"),
        })

    errors        = type_counts.get("error",      0) + type_counts.get("fatal", 0)
    warnings      = type_counts.get("warning",    0)
    conventions   = type_counts.get("convention", 0)
    refactors     = type_counts.get("refactor",   0)
    nb_count      = sum(1 for f in findings if f["source"] == "notebook")
    py_count      = len(findings) - nb_count

    return {
        "count":       len(findings),
        "errors":      errors,
        "warnings":    warnings,
        "conventions": conventions,
        "refactors":   refactors,
        "type_counts": type_counts,
        "py_count":    py_count,
        "nb_count":    nb_count,
        "findings":    findings,
    }

def parse_ruff(raw):
    if not isinstance(raw, list): raw = []
    findings = []
    errors, warnings = 0, 0
    for r in raw:
        code = r.get("code", "")
        is_error = code.startswith("E") or code.startswith("F") or code.startswith("B")
        if is_error:
            errors += 1
            sev = "ERROR"
        else:
            warnings += 1
            sev = "WARNING"

        findings.append({
            "rule_id":   code,
            "file":      r.get("filename", ""),
            "line":      r.get("location", {}).get("row", 0),
            "message":   r.get("message", ""),
            "severity":  sev
        })

    return {
        "count": len(findings),
        "findings": findings,
        "errors": errors,
        "warnings": warnings
    }

def parse_sqlfluff(raw):
    if not isinstance(raw, list): raw = []
    findings = []
    errors = 0
    for r in raw:
        for v in r.get("violations", []):
            errors += 1
            findings.append({
                "rule_id":   v.get("code", ""),
                "file":      r.get("filepath", ""),
                "line":      v.get("line_no", 0),
                "message":   v.get("description", ""),
                "severity":  "ERROR" 
            })

    return {
        "count": len(findings),
        "findings": findings,
        "errors": errors
    }


# ── Status logic ───────────────────────────────────────────────────────────

def determine_status(gl, jd, sg, bd, cov, pt, pl, rf, sf, cov_threshold: int) -> str:
    """
    Fail the PR if ANY hard threshold is breached.

    Thresholds:
      secrets        : any found             (zero tolerance)
      duplication    : > 10 %
      semgrep        : any ERROR-level
      bandit         : any HIGH severity
      pytest         : any test failure
      coverage       : < cov_threshold %
      pylint         : any ERROR or FATAL
      ruff           : any ERROR
      sqlfluff       : any ERROR
    """
    if gl["count"] > 0:                  return "fail"
    if jd["percentage"] > 20:            return "fail"
    if sg.get("errors_count", 0) > 0:    return "fail"
    if bd.get("high", 0) > 0:            return "fail"
    if pt.get("failed", 0) > 0:          return "fail"
    if cov["total_pct"] < cov_threshold: return "fail"
    if pl.get("errors", 0) > 0:          return "fail"
    if rf.get("errors", 0) > 0:          return "fail"
    if sf.get("errors", 0) > 0:          return "fail"
    return "pass"


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--pr",            required=True)
    p.add_argument("--branch",        required=True)
    p.add_argument("--sha",           required=True)
    p.add_argument("--repo",          required=True)
    p.add_argument("--pr-title",      default="")
    p.add_argument("--pr-author",     default="unknown")
    p.add_argument("--workflow-url",  default="")
    p.add_argument("--gitleaks",      required=True)
    p.add_argument("--jscpd",         required=True)
    p.add_argument("--semgrep",       required=True)
    p.add_argument("--bandit",        required=True)
    p.add_argument("--coverage",      required=True)
    p.add_argument("--pytest",        required=True)
    p.add_argument("--pylint",        required=True, help="Merged pylint JSON (py + notebooks)")
    p.add_argument("--ruff",          default="")
    p.add_argument("--sqlfluff",      default="")
    p.add_argument("--cov-threshold", type=int, default=80)
    p.add_argument("--output",        required=True)
    args = p.parse_args()

    gl  = parse_gitleaks(load_json(args.gitleaks, []))
    jd  = parse_jscpd(   load_json(args.jscpd,    {}))
    sg  = parse_semgrep( load_json(args.semgrep,   {}))
    bd  = parse_bandit(  load_json(args.bandit,    {}))
    cov = parse_coverage(load_json(args.coverage,  {}), args.cov_threshold)
    pt  = parse_pytest(  load_json(args.pytest,    {}))
    pl  = parse_pylint(  load_json(args.pylint,    []))
    rf  = parse_ruff(    load_json(args.ruff,      []))
    sf  = parse_sqlfluff(load_json(args.sqlfluff,  []))

    status = determine_status(gl, jd, sg, bd, cov, pt, pl, rf, sf, args.cov_threshold)

    report = {
        "schema_version": "1.3",
        "pr_number":      args.pr,
        "pr_title":       args.pr_title,
        "pr_author":      args.pr_author,
        "workflow_url":   args.workflow_url,
        "branch":         args.branch,
        "commit_sha":     args.sha,
        "repo":           args.repo,
        "timestamp":      datetime.now(timezone.utc).isoformat(),
        "summary": {
            "status":               status,
            "secrets":              gl["count"],
            "duplication":          jd["percentage"],
            "bugs":                 sg["count"],
            "bugs_error":           sg.get("errors_count", 0),
            "bugs_warning":         sg.get("warning_count", 0),
            "security":             bd["count"],
            "security_high":        bd["high"],
            "coverage_pct":         cov["total_pct"],
            "coverage_threshold":   args.cov_threshold,
            "tests_passed":         pt["passed"],
            "tests_failed":         pt["failed"],
            "tests_total":          pt["total"],
            "pylint_total":         pl["count"],
            "pylint_errors":        pl["errors"],
            "pylint_warnings":      pl["warnings"],
            "pylint_nb_count":      pl["nb_count"],
            "ruff_errors":          rf["errors"],
            "ruff_warnings":        rf["warnings"],
            "sqlfluff_errors":      sf["errors"],
            "total_issues": (
                gl["count"] + jd["clones"] + sg["count"] +
                bd["count"] + pt["failed"] + pl["errors"] + rf["errors"] + sf["errors"]
            ),
        },
        "gitleaks": gl,
        "jscpd":    jd,
        "semgrep":  sg,
        "bandit":   bd,
        "coverage": cov,
        "pytest":   pt,
        "pylint":   pl,
        "ruff":     rf,
        "sqlfluff": sf,
    }

    Path(args.output).write_text(json.dumps(report, indent=2))
    print(
        f"[OK] Report → {args.output}  |  status={status}  |  "
        f"pylint={pl['count']} ({pl['errors']} errors, {pl['nb_count']} from notebooks)  |  "
        f"coverage={cov['total_pct']}%  |  "
        f"tests={pt['passed']}✓ {pt['failed']}✗"
    )


if __name__ == "__main__":
    main()
