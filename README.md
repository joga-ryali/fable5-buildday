# Numici — Citation Faithfulness Verification

Verifies whether the claims in a research report — **AI-assisted or
human-written** — **faithfully represent their cited sources**, and flags the
specific way each claim departs from its source. Built for analysts and
researchers who put their name on a report and need every cited claim to hold up.
(AI synthesis makes these errors constantly — but so do humans; the tool doesn't
care who wrote the draft.)

> **Why this matters.** LLM research output looks authoritative but routinely
> misrepresents sources: fabricated citations, attributions to the wrong
> author/year/filing, inverted findings, fabricated or miscalculated numbers,
> stripped caveats, and over-generalized conclusions. Numici checks each claim
> against the source it cites and tells the analyst *whether* it holds up and
> *how* it fails.

---

## What it does

For every (claim, citation) pair in a report, Numici runs a two-stage pipeline:

1. **Extraction + citation resolution** (`claude-haiku-4-5`): pull the
   (claim, citation) pairs, resolve the cited source URL, and record a resolution
   status — `resolved` / `404` / `paywalled` / `blocked` / `timeout` / `malformed`.
   (`blocked` = the host refused the automated fetch, e.g. legal databases that
   block bots.)
2. **Faithfulness judgment** (`claude-sonnet-4-6`, two sequential prompts — never
   combined):
   - **Prompt A — citation match:** is this citation the right source for this claim?
   - **Prompt B — faithfulness:** is the claim **supported / partially supported /
     unsupported / cannot verify** by the source, with reasoning, the exact source
     sentence it anchored on, and a **defect type**.

Sonnet's semantic judgment is the core capability — it reconciles numbers
(including *derived* figures like a % change computed from base values), tracks
modality (a "could" hedge asserted as fact), and handles **multi-claim sentences
whose supporting evidence is spread far apart in the source** — a case where
embedding-similarity scorers reliably false-negative.

### Verdict vs. defect (two orthogonal axes)

- **Verdict** = *degree* of support: `supported` · `partially_supported` ·
  `unsupported` · `cannot_verify`.
- **Defect type** = *kind* of distortion: `numeric_mismatch` ·
  `wrong_directionality` · `wrong_attribution` · `overstatement` ·
  `scope_expansion` · `unsupported_addition` · `fabricated_citation` · `none`.

So a claim renders as, e.g., **"partially supported · overstatement"** — the
reasoning is always shown, never just a label.

---

## Domains (the engine is domain-agnostic)

The verifier takes *(claim, cited source, source identity)* and judges
faithfulness regardless of subject matter. Each domain is just a corpus of real
test cases plus **domain-calibrated expected verdicts**:

| Domain | Ground truth | Status |
|---|---|---|
| **Corporate Filings** | SEC EDGAR 10-Ks (Apple, Microsoft, Amazon, …) | **Live**, 37 cases, 37/37 |
| **Law** | U.S. case law (CourtListener / Caselaw Access Project / Cornell LII) | In review, 16 cases |
| **Government Statistics** | BLS / BEA / Census / FRED official releases | In review, 19 cases |

**Domain calibration matters.** A dropped hedge in a 10-K is `partially_supported`;
*misstating a court's holding* — over-generalizing its scope or asserting an
absolute rule where the holding is qualified — is `unsupported`, because in law a
holding-misstatement is material. The harness labels expected verdicts using the
standard a domain expert would apply.

---

## The test harness

A verification tool is only as credible as the corpus it's measured against, so
the harness is a first-class part of the project:

- **Real sources only.** Every case is built from a real, fetched source passage
  (SEC EDGAR, court opinions, official statistics) — never invented.
- **Typed hallucinations.** Each case injects one defect type at a calibrated
  subtlety (1–5), with a known `expected_verdict`.
- **Validation.** Generated cases are pre-screened by a *different* model
  (consistency + classification checks) and a Haiku "sensitivity probe" that flags
  cases solvable *without* the source (too obvious).
- **Human review before lock.** Cases are accepted / iterated / rejected in the
  `/harness-review` UI before they count. The engine never sees the
  `expected_verdict` — it's used only to score after the fact.

The engine was hardened through a documented self-correcting loop (run_005 → 010:
91% → 100% on Corporate Filings) with principled prompt changes each round
(attribution detection, modality handling, the numeric and multi-claim rules).

---

## Web app (4 routes, at the repo root)

- **`/live`** — paste a claim + its source; get a real-time faithfulness verdict,
  defect chip, and reasoning from `claude-sonnet-4-6`. Stateless.
- **`/verification`** — demo view: report claims highlighted inline by verdict, each
  expandable to source anchor + reasoning. Domain selector.
- **`/results`** — Test Results Summary: per-domain pass rate, by-type breakdown,
  iteration history, `cannot_verify` abstention count, click-through drill-down, JSON
  export.
- **`/harness-review`** — human review of test cases (accept / iterate / reject),
  showing expected vs. engine verdict. Read-only on the public deployment; review is
  performed locally by the team.

---

## Architecture

```
/ (Next.js 16 App Router, repo root)
  app/                  routes + API handlers (/api/live, /api/cases, /api/feedback)
  lib/verifier.py       verification core (Stage 1 + Stage 2, never-silent failures)
  verifier/verify.py    append-only batch runner
  harness/              corpus generation + staged domain corpora
  ground_truth/         tc_*.json (cases) + validation + human feedback
  reports/              report excerpts shown to the verifier
  results/ runs/        append-only verification results + run summaries
  manage_keys.py        encrypted API-key loader (keys never in the repo)
  scripts/run_web.py    local launcher (loads keys into the Node env)
```

**Models:** faithfulness reasoning is `claude-sonnet-4-6` (non-negotiable);
extraction/resolution is `claude-haiku-4-5`. **Sources:** SEC EDGAR (no key),
CourtListener / Caselaw Access Project, BLS / BEA / Census / FRED — all public.

## Local development

```bash
npm install
export BUILD_PASSPHRASE='…'                 # decrypts API keys via manage_keys.py
python scripts/run_web.py dev               # web app at http://localhost:3000
python verifier/verify.py --include-unaccepted   # run the verification batch
```

The deployed app needs `ANTHROPIC_API_KEY` set in Vercel env vars (never in git).
Push to `main` → Vercel auto-redeploys.

---

## Status & deliverables

- **Corporate Filings** is live on Vercel at 37/37.
- **Law** and **Government Statistics** corpora are generated and in human review;
  they ship behind the domain selector after review.
- Roadmap: when a source host blocks automated retrieval (`blocked`), let the
  analyst upload a copy they have access to, then run the faithfulness check.

---

Copyright © 2026 Vidi Vici Technologies, Inc. (Numici). All rights reserved.
