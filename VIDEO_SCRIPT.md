# Numici — 1-Minute Demo Script

**Format:** screen walkthrough of the live app + voiceover. ~150 words ≈ 60s.
Numbers below reflect the canonical run; adjust if a relabel shifts them.

---

### 0:00–0:12 — The goal + scope  ·  ON SCREEN: landing page (`/`)
> "If I'm an analyst putting my name on a report built with AI research, I need
> to be confident every claim is accurate. **Numici verifies that each claim
> faithfully matches the source it cites** — we check fidelity *to* the source,
> **not whether the source itself is true** — that's out of scope."

### 0:08–0:26 — The engine, live  ·  ON SCREEN: `/live`, paste a claim + source, submit
> "Here's the engine. I paste a claim and the real source it cites. **Two
> sequential Claude Sonnet passes — citation match, then faithfulness** — return
> a verdict with reasoning. This claim says sales *rose*; the source says they
> *fell* — flagged **unsupported**, defect: **contradiction**."

### 0:26–0:40 — Verdicts + defects at scale  ·  ON SCREEN: `/verification`, then `/results`
> "Across a whole report, each claim is color-coded — supported, partial,
> unsupported, or cannot-verify — and tagged with its specific defect. The
> results summary shows pass rates and the **iteration history** that earned
> them — no curation."

### 0:40–0:52 — Domain-agnostic  ·  ON SCREEN: domain selector → switch tabs
> "The same engine is **domain-agnostic** — it verifies **SEC filings, real case
> law, and government statistics**. Every test case is built from a real, fetched
> source and human-reviewed before it counts."

### 0:52–1:00 — Did we meet the goal?  ·  ON SCREEN: `/results` headline pass rates
> "On our test corpus the engine scores **100% on SEC filings** and high-80s on
> the tougher legal and statistics domains. **The result: an analyst can put
> their name on AI-assisted research and stand behind every cited claim.**"

---

## Pre-record checklist
- [ ] Deploy the multi-domain build (push to `main`) so the **live** URL has all
      three domains + the domain selector (currently live = Corporate Filings only).
- [ ] Use the **production** Vercel URL, not a pinned-hash deployment URL.
- [ ] Pre-load a crisp `/live` example (claim + source) so the verdict returns fast.
- [ ] Have `/verification` and `/results` already on the **Corporate Filings** tab
      (cleanest story) before switching tabs on camera.

## If you have a few extra seconds (optional adds)
- "Each verdict shows the exact source sentence the model anchored on."
- "When a source host blocks automated fetch, the analyst can upload it."
- "Built two ways with Claude: Sonnet runs the verification; the test corpus was
  generated and validated by Claude agents from real public filings."
