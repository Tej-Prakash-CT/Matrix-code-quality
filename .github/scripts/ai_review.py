"""
.github/scripts/ai_review.py
AI-powered code review using Claude — reads combined-report.json,
reviews real bugs/errors with code context, writes ai-review.json.
"""
import json
import os
from pathlib import Path
from datetime import datetime, timezone

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("[WARN] google-genai not installed — pip install google-genai")
    raise

MODEL         = "gemini-2.0-flash"
MAX_FINDINGS  = 15
CONTEXT_LINES = 12
MAX_TOKENS    = 500
REPORT        = "combined-report.json"
OUTPUT        = "ai-review.json"

DATABRICKS_BUILTINS = {
    "dbutils", "spark", "display", "displayHTML",
    "sc", "sqlContext", "glueContext",
}
PYLINT_FP = {"E0001", "E0401", "R0801"}


def get_snippet(file_path: str, line: int, context: int = CONTEXT_LINES) -> str:
    """Find a file anywhere under cwd and return line context."""
    candidates = [Path(file_path)]
    candidates += list(Path(".").rglob(Path(file_path).name))
    for path in candidates:
        if path.exists():
            try:
                src_lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
                start = max(0, line - context - 1)
                end   = min(len(src_lines), line + context)
                return "\n".join(
                    f"{'>>>' if (start + i + 1) == line else '   '} {start + i + 1:4d} | {ln}"
                    for i, ln in enumerate(src_lines[start:end])
                )
            except Exception as e:
                return f"# Error reading {path}: {e}"
    return f"# File not found: {file_path}"


def review_finding(model: "genai.Client", finding: dict, snippet: str) -> dict:
    prompt = (
        "You are a senior Python engineer reviewing Databricks/PySpark production code.\n\n"
        f"Static analysis finding:\n"
        f"- Tool:  {finding.get('source', '')}\n"
        f"- Rule:  {finding.get('rule', '')}\n"
        f"- File:  {finding.get('file', '')}\n"
        f"- Line:  {finding.get('line', 0)}\n"
        f"- Issue: {finding.get('message', '')}\n\n"
        f"Code context (>>> = flagged line):\n"
        f"```python\n{snippet}\n```\n\n"
        "Reply ONLY with a JSON object, no markdown, no extra text:\n"
        '{"explanation":"1-2 sentence plain English explanation of what is wrong",'
        '"fix":"corrected code snippet (1-6 lines)",'
        '"impact":"LOW|MEDIUM|HIGH",'
        '"effort":"MINUTES|HOURS|DAYS"}'
    )
    try:
        resp = model.models.generate_content(model=MODEL, contents=prompt)
        text = resp.text.strip()
        # Strip accidental markdown fences
        if text.startswith("```"):
            lines_list = text.splitlines()
            text = "\n".join(lines_list[1:] if lines_list[0].startswith("```") else lines_list)
        if text.endswith("```"):
            text = text[: text.rfind("```")]
        text = text.strip()
        return json.loads(text)
    except json.JSONDecodeError:
        try:
            s, e = text.index("{"), text.rindex("}") + 1
            return json.loads(text[s:e])
        except Exception:
            pass
        return {"explanation": f"Parse error: {text[:80]}", "fix": "", "impact": "UNKNOWN", "effort": "UNKNOWN"}
    except Exception as exc:
        return {"explanation": f"AI unavailable: {exc}", "fix": "", "impact": "UNKNOWN", "effort": "UNKNOWN"}


def collect_findings(report: dict, max_f: int) -> list[dict]:
    """Collect only real bugs/errors — skip false positives."""
    out = []

    # Pylint: errors and fatals only, skip known FPs
    for f in report.get("pylint", {}).get("findings", []):
        if f.get("type") not in ("error", "fatal"):
            continue
        mid = f.get("message_id", "")
        if mid in PYLINT_FP:
            continue
        msg = f.get("message", "")
        var = msg.split("'")[1] if "'" in msg else ""
        if mid == "E0602" and var in DATABRICKS_BUILTINS:
            continue
        out.append({
            "source":   "pylint",
            "rule":     mid,
            "symbol":   f.get("symbol", ""),
            "message":  msg,
            "file":     f.get("path", ""),
            "line":     f.get("line", 0),
            "priority": 1,
        })

    # Semgrep: ERROR severity only
    for f in report.get("semgrep", {}).get("findings", []):
        if f.get("severity", "").upper() == "ERROR":
            out.append({
                "source":   "semgrep",
                "rule":     f.get("rule_id", "").split(".")[-1],
                "message":  f.get("message", ""),
                "file":     f.get("file", ""),
                "line":     f.get("line", 0),
                "priority": 1,
            })

    # Bandit: HIGH severity only
    for f in report.get("bandit", {}).get("findings", []):
        if f.get("severity", "").upper() == "HIGH":
            out.append({
                "source":   "bandit",
                "rule":     f.get("test_id", ""),
                "message":  f.get("message", ""),
                "file":     f.get("file", ""),
                "line":     f.get("line", 0),
                "priority": 2,
            })

    out.sort(key=lambda x: x["priority"])
    return out[:max_f]


def pr_summary(model: "genai.Client", report: dict) -> str:
    s = report.get("summary", {})
    prompt = (
        "You are a tech lead reviewing a CI/CD quality scan for a Databricks/PySpark migration project. "
        f"Results: secrets={s.get('secrets', 0)}, "
        f"runtime_bugs={s.get('pylint_errors', 0) + s.get('bugs_error', 0)}, "
        f"security_HIGH={s.get('security_high', 0)}, "
        f"test_failures={s.get('tests_failed', 0)}/{s.get('tests_total', 0)}, "
        f"coverage={s.get('coverage_pct', 0)}% (threshold {s.get('coverage_threshold', 80)}%), "
        f"gate={s.get('status', 'unknown').upper()}. "
        "Write a concise 2-3 sentence review a tech lead would post on the PR. "
        "Direct, specific, constructive. Plain text only."
    )
    try:
        return model.models.generate_content(model=MODEL, contents=prompt).text.strip()
    except Exception as exc:
        return f"AI summary unavailable: {exc}"


def main() -> None:
    api_key = os.environ.get("GOOGLE_API_KEY", "")
    empty   = {
        "findings": [], "summary": "", "count": 0,
        "generated_at": "", "model": MODEL,
    }

    if not api_key:
        print("[WARN] GOOGLE_API_KEY not set — writing empty ai-review.json")
        Path(OUTPUT).write_text(json.dumps({**empty, "error": "GOOGLE_API_KEY not set"}, indent=2))
        return

    report_path = Path(REPORT)
    if not report_path.exists():
        print(f"[ERROR] {REPORT} not found")
        Path(OUTPUT).write_text(json.dumps({**empty, "error": f"{REPORT} not found"}, indent=2))
        return

    model = genai.Client(api_key=api_key)
    report   = json.loads(report_path.read_text(encoding="utf-8"))
    findings = collect_findings(report, MAX_FINDINGS)
    print(f"[AI] {len(findings)} findings to review using {MODEL}")

    reviewed = []
    for i, finding in enumerate(findings, 1):
        snippet = get_snippet(finding["file"], finding["line"])
        print(f"[AI] {i}/{len(findings)}  {finding['source']:8s}  {finding.get('rule', ''):12s}  {finding['file']}:{finding['line']}")
        reviewed.append({**finding, "ai": review_finding(model, finding, snippet)})

    print("[AI] Generating PR summary...")
    summary = pr_summary(model, report)

    output = {
        "findings":     reviewed,
        "summary":      summary,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "model":        MODEL,
        "count":        len(reviewed),
    }
    Path(OUTPUT).write_text(json.dumps(output, indent=2, ensure_ascii=False))
    print(f"[OK] {OUTPUT} — {len(reviewed)} findings reviewed")


if __name__ == "__main__":
    main()