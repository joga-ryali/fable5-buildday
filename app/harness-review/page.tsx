"use client";
import { useEffect, useState } from "react";

interface Case {
  test_case_id: string;
  source_filing: string;
  source_url: string;
  original_text: string;
  modified_text: string;
  claim: string;
  citation_as_written: string;
  hallucination_type: string | null;
  severity: string;
  subtlety_rating: number;
  expected_verdict: string;
  notes: string;
  report: string;
  flagged: boolean;
  validation: { validation_status: string; failed_checks: string[] } | null;
  latest_feedback: { review_status: string } | null;
}

const FEEDBACK_TYPES = [
  "too_obvious",
  "too_subtle",
  "wrong_type",
  "wrong_verdict",
  "unrealistic",
  "other",
];

export default function HarnessReview() {
  const [cases, setCases] = useState<Case[]>([]);
  const [accepted, setAccepted] = useState(0);
  const [i, setI] = useState(0);
  const [feedbackType, setFeedbackType] = useState(FEEDBACK_TYPES[0]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [finish, setFinish] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const res = await fetch("/api/cases");
    const data = await res.json();
    setCases(data.cases);
    setAccepted(data.accepted);
    setLoaded(true);
  }
  useEffect(() => {
    load();
  }, []);

  const c = cases[i];
  const reviewed = cases.filter((x) => x.latest_feedback).length;

  function finishReview() {
    const unreviewed = cases.filter((x) => !x.latest_feedback);
    if (unreviewed.length > 0) {
      setFinish({
        ok: false,
        text: `You still have ${unreviewed.length} case(s) without any feedback: ${unreviewed
          .map((x) => x.test_case_id)
          .join(", ")}. Jumping to the first one.`,
      });
      const firstIdx = cases.findIndex((x) => !x.latest_feedback);
      if (firstIdx >= 0) setI(firstIdx);
      return;
    }
    setFinish({
      ok: true,
      text: `Review complete — all ${cases.length} cases reviewed (${accepted} accepted, ${
        cases.length - accepted
      } iterate/reject). Accepted cases are locked into the corpus.`,
    });
  }

  async function act(review_status: string) {
    if (!c) return;
    setFinish(null);
    setBusy(true);
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        test_case_id: c.test_case_id,
        review_status,
        feedback_type: review_status === "iterate" ? feedbackType : null,
        comment: comment || null,
      }),
    });
    setComment("");
    await load();
    setBusy(false);
    if (i < cases.length - 1) setI(i + 1);
  }

  if (!loaded)
    return (
      <main className="wide">
        <p className="muted">Loading cases…</p>
      </main>
    );

  if (cases.length === 0)
    return (
      <main className="wide">
        <p className="muted"><a href="/">← home</a></p>
        <h1>Harness review</h1>
        <p className="muted">No test cases generated yet.</p>
      </main>
    );

  return (
    <main className="wide">
      <p className="muted"><a href="/">← home</a></p>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Harness review</h1>
        <span className="row" style={{ gap: 8 }}>
          <span className="badge v-supported bg-supported">
            {accepted} accepted
          </span>
          <span className="muted">
            {reviewed} / {cases.length} reviewed
          </span>
        </span>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button
          className="secondary-btn"
          onClick={() => setI(Math.max(0, i - 1))}
          disabled={i === 0}
        >
          ← prev
        </button>
        <span className="muted">
          case {i + 1} / {cases.length}
        </span>
        <button
          className="secondary-btn"
          onClick={() => setI(Math.min(cases.length - 1, i + 1))}
          disabled={i === cases.length - 1}
        >
          next →
        </button>
        <button onClick={finishReview} style={{ marginLeft: "auto" }}>
          Finish review
        </button>
      </div>
      {finish && (
        <div className={`banner ${finish.ok ? "ok" : "flag"}`} style={{ marginTop: 12 }}>
          {finish.ok ? "✓ " : "⚠ "}
          {finish.text}
        </div>
      )}

      {c && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="mono muted">{c.test_case_id}</span>
            <span>
              {c.latest_feedback && (
                <span
                  className={`badge ${
                    c.latest_feedback.review_status === "accepted"
                      ? "v-supported bg-supported"
                      : c.latest_feedback.review_status === "rejected"
                      ? "v-unsupported bg-unsupported"
                      : "v-partially_supported bg-partially_supported"
                  }`}
                >
                  {c.latest_feedback.review_status}
                </span>
              )}
            </span>
          </div>

          {c.flagged && c.validation && (
            <div className="banner flag">
              ⚠ Flagged by validation: {c.validation.failed_checks.join(", ") || "see validation"}
            </div>
          )}

          <div className="detail">
            <div className="kv"><span className="k">Type</span><span className="mono">{c.hallucination_type ?? "control"}</span></div>
            <div className="kv"><span className="k">Severity / subtlety</span><span className="mono">{c.severity} / {c.subtlety_rating}</span></div>
            <div className="kv"><span className="k">Expected verdict</span><span className="mono">{c.expected_verdict}</span></div>
            <div className="kv"><span className="k">Source</span><span>{c.source_filing}{" "}<a href={c.source_url} target="_blank" rel="noreferrer">↗</a></span></div>
          </div>

          <h3>Report as shown</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{c.report || c.modified_text}</p>

          <h3>Original source text</h3>
          <p className="muted">“{c.original_text}”</p>

          <div className="detail">
            <div className="kv"><span className="k">Note</span><span>{c.notes}</span></div>
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <label>Comment (optional)</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <div className="row">
            <label className="muted">iterate reason:</label>
            <select value={feedbackType} onChange={(e) => setFeedbackType(e.target.value)}>
              {FEEDBACK_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="btn-row">
            <button onClick={() => act("accepted")} disabled={busy}>Accept</button>
            <button className="iterate-btn" onClick={() => act("iterate")} disabled={busy}>Iterate</button>
            <button className="reject-btn" onClick={() => act("rejected")} disabled={busy}>Reject</button>
          </div>
        </div>
      )}
    </main>
  );
}
