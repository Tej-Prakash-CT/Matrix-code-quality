"""
.github/scripts/merge_ai_review.py
Merges ai-review.json into combined-report.json under the ai_review key.
"""
import json
from pathlib import Path

report = json.loads(Path("combined-report.json").read_text())
try:
    ai = json.loads(Path("ai-review.json").read_text())
    print(f"[OK] AI review loaded — {ai.get('count', 0)} findings reviewed")
except Exception as e:
    print(f"[WARN] ai-review.json missing or invalid: {e} — continuing without AI review")
    ai = {
        "findings": [], "summary": "", "generated_at": "",
        "model": "", "count": 0, "error": str(e),
    }

report["ai_review"] = ai
Path("combined-report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
print("[OK] combined-report.json updated with ai_review block")