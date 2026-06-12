"use client";

import { useState } from "react";

// Throwaway diagnostic: enter a source (premise) + a claim (hypothesis), get the
// HHEM faithfulness score. Lets you build intuition for the scores before the real build.
export default function HhemTest() {
  const [premise, setPremise] = useState(
    "The capital of France is Paris."
  );
  const [hypothesis, setHypothesis] = useState(
    "Paris is the capital of France."
  );
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setScore(null);
    try {
      const res = await fetch("/api/hhem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ premise, hypothesis }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
      else setScore(data.score);
    } catch {
      setError("Request failed.");
    } finally {
      setLoading(false);
    }
  }

  const band =
    score === null
      ? ""
      : score >= 0.5
      ? "leans grounded"
      : score >= 0.2
      ? "weak / check"
      : "likely unsupported";

  return (
    <main>
      <h1>HHEM faithfulness probe</h1>
      <p className="tagline">
        Enter a <strong>source</strong> (premise) and a <strong>claim</strong>{" "}
        (hypothesis). Score 0–1 = how well the source supports the claim.
        Diagnostic only — thresholds are tuned during the build.
      </p>

      <form onSubmit={run}>
        <div className="field">
          <label htmlFor="premise">Source (premise)</label>
          <textarea
            id="premise"
            value={premise}
            onChange={(e) => setPremise(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="hypothesis">Claim (hypothesis)</label>
          <textarea
            id="hypothesis"
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "Scoring…" : "Score"}
        </button>
      </form>

      {error && (
        <div className="status bad" style={{ marginTop: 24 }}>
          <span className="dot" aria-hidden />
          {error}
        </div>
      )}

      {score !== null && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="score-num">{score.toFixed(3)}</div>
          <div className="score-band">{band}</div>
        </div>
      )}

      <p className="hint">
        First score after idle may take ~30–60 s (endpoint cold start). Throwaway
        route — safe to delete before the real build.
      </p>
    </main>
  );
}
