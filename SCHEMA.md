# SCHEMA.md — The Contract

**This file is the single source of truth.** Every agent reads it before writing any
code or file. No agent deviates from it. If something must change, change it here
first, then propagate.

Project: **Citation Faithfulness Verification System** — verifies whether claims in
AI-generated research reports faithfully represent their cited SEC sources.

---

## 0. Repo layout (ACTUAL — not the prompt's `/web/`)

The Next.js app lives at the **repo root** (App Router, Next 16 + React 19). Vercel is
wired to the root. Do **not** create a `/web/` directory.

```
/                       Next.js app root (app/, package.json, tsconfig.json)
  app/
    page.tsx            nav landing (the 4 routes)
    harness-review/     route: human review of test cases
    results/            route: technical pass-rate dashboard
    verification/       route: demo-facing per-claim verdicts
    live/               route: paste claim+source -> live Sonnet verdict
    api/                Next route handlers (server-side Anthropic calls)
    hhem-test/          PRE-EXISTING, unrelated (HHEM). Leave untouched. Not used.
    api/hhem/           PRE-EXISTING, unrelated (HHEM). Leave untouched. Not used.
  SCHEMA.md             this file
  manage_keys.py        key loader (already present)
  conductor_log.json    phase-transition log
  .env.example
  vercel.json
  reports/              tc_*.txt          (report text shown to the verifier)
  ground_truth/         tc_*.json, tc_*_validation.json, tc_*_feedback_*.json
  results/              tc_*_run_*.json   (APPEND ONLY, never overwrite)
  runs/                 run_*_summary.json (APPEND ONLY, never overwrite)
  harness/              corpus generation code
  verifier/             verify.py (batch runner / CLI)
  lib/                  verifier.py (shared verification core, imported by verify.py)
```

`app_version` for all result/run files this build: **`0.1.0`**.

---

## 1. Model assignments (NON-NEGOTIABLE)

| Task | Model | Notes |
|---|---|---|
| Faithfulness judgment (semantic) | `claude-sonnet-4-6` | The core capability. Locked. |
| Citation→claim match (Prompt A) | `claude-sonnet-4-6` | Sequential, separate from B. |
| Faithfulness check (Prompt B) | `claude-sonnet-4-6` | Never combined with A into one prompt. |
| Claim extraction / citation resolution | `claude-haiku-4-5-20251001` (default) OR Perplexity `sonar`/`sonar-pro` | Choose per task. **On ANY Perplexity friction → switch to Haiku immediately.** |
| Validation (pre-screen) | `claude-sonnet-4-6` | Must differ from generation model instance. |
| Validation sensitivity probe | `claude-haiku-4-5-20251001` | If Haiku spots the hallucination WITHOUT the source → subtlety too low. |

**Two Sonnet calls per claim, sequential: Prompt A then Prompt B. Never merged.**

Record the model string actually used for Stage-1 in the result file's `haiku_model`
field (even if Perplexity was used — store the real model string, e.g. `sonar`).

Env keys (load via `from manage_keys import load_keys_for_agent; load_keys_for_agent()`):
`ANTHROPIC_API_KEY` ✓, `PERPLEXITY_API_KEY` ✓. **Never log key values — log presence only.**

---

## 2. Verdict vocabulary (exact strings)

**Faithfulness `verdict`:** `supported` | `partially_supported` | `unsupported` | `cannot_verify`

UI color mapping:
- `supported` → green
- `partially_supported` → yellow
- `unsupported` → red
- `cannot_verify` → orange

**`citation_match_verdict`:** `correct_citation` | `mismatch` | `cannot_determine`

**`citation_resolution_status`:** `resolved` | `404` | `paywalled` | `timeout` | `malformed`

**`confidence`:** `high` | `medium` | `low`

**`expected_verdict`** (ground truth) uses the faithfulness vocabulary above.

**`severity`:** `high` | `medium` | `low`

---

## 3. Hallucination types (exact strings) + target distribution

| `hallucination_type` | Count | Example |
|---|---|---|
| `quantitative_fabrication` | 8 | Revenue grew 8% → 18% |
| `stripped_caveat` | 6 | "may improve margins" → "will improve margins" |
| `wrong_directionality` | 5 | Decreased → Increased |
| `overstated_confidence` | 5 | "preliminary results suggest" → "studies confirm" |
| `partial_citation_corruption` | 4 | Real filing, wrong year/author |
| `total_citation_fabrication` | 4 | Plausible citation that does not exist |
| `scope_expansion` | 3 | Subset finding presented as universal |

A test case may also be a **control** (no hallucination, `expected_verdict: supported`,
`hallucination_type: null`) — include a few so the verifier isn't biased toward "unsupported".

Subtlety distribution (`subtlety_rating` 1–5): 8 cases at 1–2 (obvious), 15 at 3
(needs comparison), 12 at 4–5 (requires source).

---

## 4. File schemas (exact field names)

### `ground_truth/tc_{NNN}.json`
```json
{
  "test_case_id": "tc_001",
  "source_filing": "Apple 10-K FY2023 p.12",
  "source_url": "https://www.sec.gov/...",
  "original_text": "verbatim passage from filing",
  "modified_text": "passage as it appears in test report",
  "claim": "the specific claim being tested",
  "citation_as_written": "verbatim citation string from report",
  "hallucination_type": "quantitative_fabrication",
  "severity": "high",
  "subtlety_rating": 3,
  "citation_intact": true,
  "expected_verdict": "unsupported",
  "notes": "Changed 8% to 18%"
}
```
`citation_intact`: false when the citation itself is corrupted/fabricated
(`partial_citation_corruption`, `total_citation_fabrication`), true otherwise.

### `reports/tc_{NNN}.txt`
Human-readable report excerpt containing `modified_text` + `citation_as_written`
in prose. This is the ONLY thing the verifier sees as "the report".

### `ground_truth/tc_{NNN}_validation.json`
```json
{
  "test_case_id": "tc_001",
  "validator_model": "claude-sonnet-4-6",
  "timestamp": "ISO8601",
  "validation_status": "pass",
  "consistency_checks": {
    "claim_in_report": true,
    "citation_in_report": true,
    "original_matches_source": true,
    "modified_in_report": true,
    "verdict_matches_type": true
  },
  "classification_checks": {
    "type_label_correct": true,
    "subtlety_rating_plausible": true,
    "haiku_spotted_without_source": false
  },
  "failed_checks": [],
  "auto_fixed": false,
  "auto_fix_description": null,
  "notes": "",
  "suggested_correction": null
}
```
`validation_status`: `pass` | `flagged` | `fail`. Consistency checks are auto-fixable;
classification checks are flagged for human review. `haiku_spotted_without_source: true`
means subtlety is too low (flag).

### `ground_truth/tc_{NNN}_feedback_{N}.json`
```json
{
  "test_case_id": "tc_001",
  "iteration_number": 1,
  "review_status": "accepted",
  "reviewer": "joga",
  "timestamp": "ISO8601",
  "feedback_type": null,
  "subtlety_rating_override": null,
  "comment": null
}
```
`review_status`: `accepted` | `iterate` | `rejected`. `feedback_type` (when iterating):
`too_obvious` | `too_subtle` | `wrong_type` | `wrong_verdict` | `unrealistic` | `other`.
**A case is LOCKED into the corpus only when its latest feedback is `accepted`.**

### `results/tc_{NNN}_run_{NNN}.json` — APPEND ONLY
```json
{
  "test_case_id": "tc_001",
  "run_id": "run_001",
  "timestamp": "ISO8601",
  "app_version": "0.1.0",
  "sonnet_model": "claude-sonnet-4-6",
  "haiku_model": "claude-haiku-4-5-20251001",
  "citation_resolution_status": "resolved",
  "citation_match_verdict": "correct_citation",
  "verdict": "unsupported",
  "confidence": "high",
  "source_excerpt": "text Sonnet anchored on",
  "caveat_preserved": false,
  "notes": "Claim states 18% growth; source states 8%",
  "ground_truth_verdict": "unsupported",
  "pass": true,
  "prompt_version": "v1"
}
```

### `runs/run_{NNN}_summary.json` — APPEND ONLY
```json
{
  "run_id": "run_001",
  "timestamp": "ISO8601",
  "app_version": "0.1.0",
  "prompt_version": "v1",
  "change_from_previous": "initial run",
  "total": 35,
  "passed": 28,
  "failed": 7,
  "pass_rate": 0.80,
  "by_hallucination_type": {
    "quantitative_fabrication": {"total": 8, "passed": 7, "failed": 1}
  },
  "failed_cases": ["tc_004", "tc_011"],
  "regressions_from_best_run": [],
  "best_run_id": "run_001"
}
```

---

## 5. Verification pipeline

**Stage 1 — Extraction + citation resolution** (Haiku default, or Perplexity):
extract `(claim, citation)` pairs, return citation verbatim, attempt URL/DOI
resolution, return `citation_resolution_status`.

**Stage 2 — Sonnet, resolved sources only, two sequential prompts:**
- **Prompt A (citation match):** Does this citation logically support this specific
  claim? → `correct_citation` | `mismatch` | `cannot_determine` + one sentence.
- **Prompt B (faithfulness):** supported/unsupported/partial? caveats preserved?
  confidence consistent? what text supports/contradicts? → full result object.

**Failure modes (never silent):**
- `404` → `verdict: cannot_verify`
- `paywalled` → `cannot_verify`
- timeout > 10s → `timeout` → `cannot_verify`
- source too long → chunk around citation anchor; if still fails → `cannot_verify`
- Anthropic rate-limit error → wait 60s, retry once, then `cannot_verify`.

**`pass` rule:** `pass == (verdict == ground_truth_verdict)`.

**Iteration loop exit:** pass_rate ≥ 0.80 AND no hallucination type at 0% AND no
regressions from best run — OR 20 iterations. Fix one failure type per iteration.
Commit after every run.

---

## 6. Web routes (all at repo root, 4 total)

- `/` — nav landing.
- `/harness-review` — one case at a time from `ground_truth/tc_*.json` + `reports/tc_*.txt`;
  flagged cases first with yellow banner of failed checks; Accept / Iterate / Reject;
  writes feedback JSON; progress "N accepted / M total".
- `/results` — technical dashboard: overall pass rate (green ≥0.80 / yellow 0.60–0.79 /
  red <0.60), pass rate by type, failed-case list, regression indicator, JSON export.
- `/verification` — demo-facing: report excerpt with claims highlighted by verdict color;
  expandable per claim (source_excerpt, notes, confidence); JSON export.
- `/live` — claim textarea + source textarea + submit; calls `claude-sonnet-4-6`
  (Prompt B faithfulness) via an API route; returns color-coded verdict + reasoning.
  Stateless, no persistence.

No shared client state between routes.

---

## 7. Immutability & safety (HARD RULES)

1. Never overwrite files in `/results/` or `/runs/`. Append with incremented IDs.
2. Never modify an accepted ground-truth file.
3. Never log API key values — presence only.
4. Commit after every significant step.
5. Never invent SEC data — all filings fetched from real EDGAR URLs
   (`User-Agent: <name> <email>` header required; throttle + cache).
6. Git push to origin ONLY after explicit "yes, deploy" from Joga.
