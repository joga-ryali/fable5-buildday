"use client";
import { useState } from "react";

interface Result {
  verdict: string;
  confidence: string;
  caveat_preserved: boolean;
  source_excerpt: string;
  notes: string;
  error?: string;
}

const LABEL: Record<string, string> = {
  supported: "Supported",
  partially_supported: "Partially supported",
  unsupported: "Unsupported",
  cannot_verify: "Cannot verify",
};

const EXAMPLE = {
  claim: "Apple's total net sales increased 3% in fiscal 2023 compared to 2022.",
  source:
    "The Company's total net sales decreased 3% or $11.0 billion during 2023 compared to 2022. The weakness in foreign currencies relative to the U.S. dollar accounted for more than the entire year-over-year decrease in total net sales.",
};

export default function Live() {
  const [claim, setClaim] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function submit() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/live", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ claim, source }),
      });
      setResult(await res.json());
    } catch {
      setResult({
        verdict: "",
        confidence: "",
        caveat_preserved: false,
        source_excerpt: "",
        notes: "",
        error: "Request failed",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="wide">
      <p className="muted">
        <a href="/">← home</a>
      </p>
      <h1>Live faithfulness check</h1>
      <p className="tagline">
        Paste a claim and the source passage it cites. <code>claude-sonnet-4-6</code>{" "}
        judges whether the source faithfully supports the claim.{" "}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setClaim(EXAMPLE.claim);
            setSource(EXAMPLE.source);
          }}
        >
          load example
        </a>
      </p>

      <div className="field">
        <label>Claim (as written in the report)</label>
        <textarea value={claim} onChange={(e) => setClaim(e.target.value)} />
      </div>
      <div className="field">
        <label>Source excerpt (the cited passage)</label>
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={{ minHeight: 120 }}
        />
      </div>
      <button onClick={submit} disabled={loading || !claim.trim()}>
        {loading ? "Checking…" : "Check faithfulness"}
      </button>

      {result && (
        <div className="card" style={{ marginTop: 24 }}>
          {result.error ? (
            <p className="v-unsupported">Error: {result.error}</p>
          ) : (
            <>
              <div className="row">
                <span className={`badge v-${result.verdict} bg-${result.verdict}`}>
                  {LABEL[result.verdict] ?? result.verdict}
                </span>
                <span className="muted">confidence: {result.confidence}</span>
                <span className="muted">
                  caveats preserved: {result.caveat_preserved ? "yes" : "no"}
                </span>
              </div>
              <div className="detail" style={{ marginTop: 14 }}>
                <div className="kv">
                  <span className="k">Reasoning</span>
                  <span>{result.notes}</span>
                </div>
                {result.source_excerpt && (
                  <div className="kv">
                    <span className="k">Anchored on</span>
                    <span>“{result.source_excerpt}”</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}
