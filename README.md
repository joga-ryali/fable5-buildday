# Fable 5 Build Day — Research with Receipts

An AI research tool that answers questions about any public company **with
receipts**: every claim links to the exact supporting passage in a primary SEC
filing, and every number is auto-verified against the company's official XBRL
data.

> **Status: build-day skeleton.** This repo currently holds a minimal Next.js
> app that proves the deploy pipeline (Vercel auto-deploy + `ANTHROPIC_API_KEY`
> env wiring). The real app is built by Fable 5 on **Sat 2026-06-13** and pushed
> to this same repo — `git push` to `main` auto-redeploys on Vercel.

## The goal (paste into Claude Code `/goal` on the day)

> Build a "research with receipts" app: given a public-company ticker, fetch SEC
> XBRL company-facts + relevant filings, synthesize an answer with inline
> citations, then VERIFY — every numeric claim reconciles exactly to XBRL, every
> narrative claim is graded supported by an independent verifier sub-agent, and
> unverified claims are dropped or flagged. Done = on the gold set, 100% of
> displayed claims pass verification and coverage is met, and the live Vercel URL
> answers a free-form ticker query. Hillclimb against `rubric.md`.

## Rubric

See [rubric.md](rubric.md) — four criteria (numeric reconciliation, narrative
grounding, no unsupported claims, coverage). Criterion 1 is a deterministic test;
2–4 are graded by an independent verifier agent.

## Data — SEC EDGAR (no API key)

- **Numbers:** XBRL company-facts (`data.sec.gov/api/xbrl/companyfacts/CIK{}.json`).
- **Narrative:** filing documents / EDGAR full-text search (10-K/10-Q/8-K).
- **Auth:** none — SEC only requires a `User-Agent: Name email` header. Throttle + cache.

## Two uses of Claude (kept separate)

- **Build-time:** Fable 5 in Claude Code builds the app.
- **Runtime:** the deployed app calls the Claude API to synthesize + verify
  (`claude-haiku-4-5` while iterating, `claude-fable-5` for the demo). The key is
  read from `process.env.ANTHROPIC_API_KEY`, set as a Vercel env var — **never** in git.

## Local dev

```bash
npm install
npm run dev            # http://localhost:3000
```

## Deploy (one-time, already wired)

Public GitHub repo → Vercel Import → add `ANTHROPIC_API_KEY` env var → every push
to `main` auto-redeploys.

## Submission deliverables

Live URL · the project brief (tightened) · `rubric.md` · the session log.
