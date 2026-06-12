# Rubric — Research with Receipts

The build is **done** when an answer to a gold-set question satisfies all four
criteria. Criteria 1 is deterministic (a test passes or fails); criteria 2–4 are
graded by an independent verifier sub-agent (fresh context, not the synthesizer).

A claim is any discrete assertion in the answer — a number ("FY2024 revenue was
$X") or a statement ("management cites supply-chain risk").

## 1. Numeric reconciliation — deterministic

- Every quantitative claim must match the company's **XBRL company-facts** value
  **exactly** (after unit normalization, e.g. USD, thousands vs. units).
- Each numeric claim carries the `{concept, fiscalYear/period, accession}` it
  reconciles to.
- **Pass** = the asserted number equals the official XBRL value for that concept
  and period. No tolerance, no LLM judgment. A mismatch fails the build.

## 2. Narrative grounding — verifier sub-agent

- Every non-numeric claim must cite a specific filing passage (sentence- or
  paragraph-level anchor, not a whole document).
- A fresh verifier agent, given only the claim + the cited passage, grades it
  **supported** / **unsupported**.
- **Pass** = supported. Self-grading by the synthesizer does not count.

## 3. No unsupported claims

- Zero claims rendered without a passing receipt (criterion 1 or 2).
- Unverifiable statements are **dropped or flagged ⚠**, never asserted as fact.
- **Pass** = every displayed claim has a ✓; anything unverified is visibly held back.

## 4. Coverage

- The answer actually addresses the question asked (not a tangent).
- Graded against the gold-set question's expected scope.
- **Pass** = the expected facts/topics for that question are present and verified.

## Scoring on the gold set

For each gold question: run the pipeline, then score 1–4. The build's headline
metric: **% of gold-set claims that pass verification** (target: 100%), plus
**% of questions meeting coverage**. The deterministic suite (criterion 1) is the
strongest autonomy signal — it lets the model self-correct without a human.
