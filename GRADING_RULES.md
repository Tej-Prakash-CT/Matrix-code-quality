# MATRIX Quality Grading Rules

How a scan's letter grade and PASS/FAIL status are calculated. This document is the single source of truth for stakeholders, reviewers, and engineers working on the dashboard.

Implementation lives in:
- `src/abdi_quality/backend/metrics.py` — scoring functions, fail-cap, status evaluation
- `src/abdi_quality/backend/admin_config.json` — weights and thresholds

---

## 1. The two outputs

Every scan produces **two independent verdicts**:

1. **Status** — `PASS` or `FAIL`. Mirrors the CI Quality Gate (hard thresholds).
2. **Grade** — `A`, `B`, `C`, `D`, `E`. A weighted score across 5 dimensions, then floored to `D` if the scan FAILed.

Read them together: a scan can be **PASS + C** (passed CI but has noticeable issues) or **FAIL + D** (CI blocked).

---

## 2. The 5 grading dimensions

Each dimension scores **100** (clean) or **0** (has issue). Duplication has a soft middle band — it's the only graded dimension. All weights are equal at **0.20** (coverage is unused, weight 0).

| # | Dimension       | Source tool(s)             | Weight |
|---|-----------------|----------------------------|-------:|
| 1 | Reliability     | Semgrep                    | 0.20   |
| 2 | Security        | Bandit + Gitleaks          | 0.20   |
| 3 | Maintainability | Pylint/Ruff (tech debt)    | 0.20   |
| 4 | Duplication     | jscpd                      | 0.20   |
| 5 | Ruff (Hotspots) | Ruff lint errors           | 0.20   |
|   | Coverage        | pytest + coverage          | 0.00   |

### 2.1 Reliability — Semgrep
- 0 bugs → **100**
- ≥ 1 bug → **0**

### 2.2 Security — Bandit + Gitleaks
- 0 Bandit findings (any severity) AND 0 Gitleaks secrets → **100**
- Otherwise → **0**

### 2.3 Maintainability — Tech Debt
Tech debt grade comes from `compute_technical_debt()` (remediation minutes / development minutes).
- Tech debt grade = **A** → score **100**
- Tech debt grade B/C/D/E → score **0**

### 2.4 Duplication — jscpd (the only tiered dimension)

| Duplication % | Score | Comment |
|---------------|------:|---------|
| 0% – 15%      | 100   | Clean. Calibrated to Teradata → Databricks codegen's irreducible structural duplication. |
| 15% – 25%     | 50    | Soft penalty. Lands in B. |
| 25% – 35%     | 0     | Lands in C. |
| > 35%         | 0     | Trips the FAIL threshold. Status = FAIL → grade D via fail-cap. |

### 2.5 Ruff (Hotspots)
- 0 errors → **100**
- ≥ 1 error → **0**
- **Also triggers status FAIL** (mirrors CI Quality Gate — Ruff errors hard-block the pipeline).

---

## 3. Weighted score → letter grade

Each dimension contributes `score × weight`. Sum across dimensions = weighted total.

| Weighted total | Grade | Label     |
|---------------:|:-----:|-----------|
| ≥ 95           | **A** | Excellent |
| ≥ 85           | **B** | Good      |
| ≥ 70           | **C** | Fair      |
| ≥ 50           | **D** | Poor      |
| < 50           | **E** | Critical  |

### 3.1 Issue count → grade (the practical rule)

Because scoring is binary (with one tiered exception), the grade reflects the **count of distinct issue dimensions**:

| # of dimensions with issues | Weighted total | Grade |
|----------------------------:|---------------:|:-----:|
| 0                           | 100            | **A** |
| 1                           | 80             | **C** |
| 2                           | 60             | **D** |
| 3                           | 40             | **E** |
| 4                           | 20             | **E** |
| 5                           | 0              | **E** |

Note: with all binary dims, **B is only reachable via the duplication soft band** (score 50). E.g., a scan with 18% duplication and everything else clean = 90 → B.

---

## 4. Status: PASS vs. FAIL

A scan is FAIL if **any** of these triggers fire (in order). Otherwise PASS.

| # | Trigger                                                                  | Where set |
|---|--------------------------------------------------------------------------|-----------|
| 1 | Duplication > **35%** (`duplication_fail_pct`)                           | admin_config.json |
| 2 | Coverage < target (`coverage_target_pct = 80`) AND tests > 0             | admin_config.json |
| 3 | Bugs/KLOC > danger (`bugs_per_kloc_danger = 5.0`)                        | admin_config.json |
| 4 | Vulns/KLOC > danger (`vulns_per_kloc_danger = 3.0`)                      | admin_config.json |
| 5 | Any Bandit finding at a severity in `severity_filter.fail_on`            | admin_config.json |
| 6 | Any Gitleaks secret (when `"high"` is in `fail_on`)                      | admin_config.json |
| 7 | **Any Ruff error** (`ruff_errors > 0`)                                   | hard-coded — mirrors CI |
| 8 | Tech debt ratio > danger (`tech_debt_ratio_danger_pct = 50`)             | admin_config.json |

---

## 5. The Fail-Cap

Any scan with status FAIL has its grade **floored to D** — regardless of weighted score.

- Constant: `FAIL_GRADE_CAP = QualityGrade.D` in `metrics.py`.
- A failing scan can never display as **Excellent (A)** or **Good (B)**, even if its weighted total is 90+.
- The breakdown UI shows the original weighted total and notes that the cap was applied.

---

## 6. Worked examples

All "everything else clean" scenarios assume Reliability = Security = Maintainability = Ruff = 100.

| Scan profile                                          | Status | Score | Grade |
|-------------------------------------------------------|:------:|------:|:-----:|
| Pristine                                              | PASS   | 100   | **A** |
| 11.1% duplication, else clean                         | PASS   | 100   | **A** |
| 18% duplication, else clean                           | PASS   | 90    | **B** |
| 28% duplication, else clean                           | PASS   | 80    | **C** |
| 40% duplication, else clean                           | **FAIL** | 80  | **D** (capped) |
| 1 Semgrep bug only                                    | PASS   | 80    | **C** |
| 1 Ruff error only                                     | **FAIL** | 80  | **D** (capped) |
| 1 high-severity Bandit finding only                   | **FAIL** | 80  | **D** (capped) |
| 1 bug + 1 high-sev vuln                               | **FAIL** | 60  | **D** (capped — would be D anyway) |
| 1 bug + 1 vuln + 1 Ruff error                         | **FAIL** | 40  | **D** (capped — would be E) |
| Bug + vuln + Ruff + dup > 35% + tech-debt B+          | **FAIL** | 0   | **D** (capped — would be E) |

---

## 7. Why this model (the design rationale)

- **Equal weights + binary scoring** make grade interpretable as "how many dimensions have problems," which is what stakeholders actually ask. Severity within a dimension is communicated by the per-tool detail panels, not by the letter grade.
- **Duplication is the one tiered dimension** because it has continuous nature (a percentage), and a scan at 12.1% is essentially indistinguishable from 12.0% — a hard cliff would punish trivial fluctuations.
- **Ruff auto-FAILs** because it's a CI hard-block: the dashboard verdict must match what CI does, otherwise stakeholders lose trust. We tried softening this once and reverted — a passing scan with Ruff errors confused everyone.
- **Fail-cap to D** ensures non-technical readers never see a failing scan labelled "Excellent" or "Good." It's a presentation safety net layered on top of the math.
- **Duplication clean threshold = 15%** (not 0%) because the Teradata → Databricks codegen produces irreducible structural duplication. This was tuned with the migration team — don't tighten without coordination.

---

## 8. Tunable knobs (in `admin_config.json`)

The numbers below can be changed without touching code. The five score-band cutoffs (the 15 / 25 in `_duplication_score`) **are hard-coded** in `metrics.py` — those need a code change to move.

```json
{
  "thresholds": {
    "coverage_target_pct": 80.0,
    "duplication_warning_pct": 30.0,
    "duplication_fail_pct": 35.0,
    "bugs_per_kloc_warning": 0.0,
    "bugs_per_kloc_danger": 5.0,
    "vulns_per_kloc_warning": 0.0,
    "vulns_per_kloc_danger": 3.0,
    "hotspots_warning": 0,
    "hotspots_danger": 0,
    "tech_debt_ratio_warning_pct": 10.0,
    "tech_debt_ratio_danger_pct": 50.0
  },
  "grade_weights": {
    "reliability": 0.20,
    "security": 0.20,
    "maintainability": 0.20,
    "coverage": 0.0,
    "duplication": 0.20,
    "ruff": 0.20
  },
  "severity_filter": {
    "min_severity": ["high"],
    "fail_on": ["high", "medium", "low"]
  }
}
```
