"use client";
import { useEffect, useState } from "react";

interface Case {
  test_case_id: string;
  domain?: string;
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
  app_result: {
    verdict: string;
    defect_type: string;
    citation_resolution_status: string;
    confidence: string;
    pass: boolean;
    run_id: string;
  } | null;
}

const FEEDBACK_TYPES = [
  "too_obvious",
  "too_subtle",
  "wrong_type",
  "wrong_verdict",
  "unrealistic",
  "other",
];

// Plain-English explanations of validation checks (no raw field names in UI).
const CHECK_LABELS: Record<string, string> = {
  claim_in_report: "the claim text appears in the report",
  citation_in_report: "the citation appears in the report",
  original_matches_source: "the original_text reads as a verbatim source passage",
  modified_in_report: "the modified text appears in the report",
  verdict_matches_type: "the expected verdict fits the hallucination type",
  type_label_correct: "the labeled hallucination type matches the actual change",
  subtlety_rating_plausible:
    "the difficulty (subtlety) rating may not be plausible for this case",
  haiku_spotted_without_source:
    "a lightweight model spotted the issue WITHOUT the source — the case may be too obvious",
};

const VERDICT_LABEL: Record<string, string> = {
  supported: "supported",
  partially_supported: "partially supported",
  unsupported: "unsupported",
  cannot_verify: "cannot verify",
};

export default function HarnessReview() {
  const [cases, setCases] = useState<Case[]>([]);
  const [domainFilter, setDomainFilter] = useState("corporate_filings");
  const [i, setI] = useState(0);
  const [feedbackType, setFeedbackType] = useState(FEEDBACK_TYPES[0]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [finish, setFinish] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const res = await fetch("/api/cases");
    const data = await res.json();
    setCases(data.cases);
    setReadOnly(Boolean(data.read_only));
    setLoaded(true);
  }
  useEffect(() => {
    load();
  }, []);

  const dom = (x: Case) => x.domain ?? "corporate_filings";
  const filtered = cases.filter((x) => dom(x) === domainFilter);
  const c = filtered[i];
  const reviewed = filtered.filter((x) => x.latest_feedback).length;
  const accepted = filtered.filter(
    (x) => x.latest_feedback?.review_status === "accepted"
  ).length;

  function switchDomain(d: string) {
    setDomainFilter(d);
    setI(0);
    setFinish(null);
  }

  function finishReview() {
    const unreviewed = filtered.filter((x) => !x.latest_feedback);
    if (unreviewed.length > 0) {
      setFinish({
        ok: false,
        text: `You still have ${unreviewed.length} case(s) in this domain without feedback: ${unreviewed
          .map((x) => x.test_case_id)
          .join(", ")}. Jumping to the first one.`,
      });
      const firstIdx = filtered.findIndex((x) => !x.latest_feedback);
      if (firstIdx >= 0) setI(firstIdx);
      return;
    }
    setFinish({
      ok: true,
      text: `Review complete for this domain — all ${filtered.length} cases reviewed (${accepted} accepted, ${
        filtered.length - accepted
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
    if (i < filtered.length - 1) setI(i + 1);
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

  const DOMAINS = [
    { key: "corporate_filings", label: "Corporate Filings" },
    { key: "legal", label: "Law" },
  ];

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
            {reviewed} / {filtered.length} reviewed
          </span>
        </span>
      </div>
      <div className="domain-tabs">
        {DOMAINS.map((d) => (
          <button
            key={d.key}
            className={`domain-tab ${d.key === domainFilter ? "active" : ""}`}
            onClick={() => switchDomain(d.key)}
          >
            {d.label}
          </button>
        ))}
      </div>
      {readOnly && (
        <div className="banner readonly">
          🔒 Read-only public view — case review (accept / iterate / reject) is
          performed locally by the Numici team. You can browse the corpus and the
          engine&apos;s verdicts here.
        </div>
      )}
      {filtered.length === 0 && (
        <p className="muted">No cases in this domain yet.</p>
      )}
      {filtered.length > 0 && (
      <div className="row" style={{ marginTop: 8 }}>
        <button
          className="secondary-btn"
          onClick={() => setI(Math.max(0, i - 1))}
          disabled={i === 0}
        >
          ← prev
        </button>
        <span className="muted">
          case {i + 1} / {filtered.length}
        </span>
        <button
          className="secondary-btn"
          onClick={() => setI(Math.min(filtered.length - 1, i + 1))}
          disabled={i === filtered.length - 1}
        >
          next →
        </button>
        <button onClick={finishReview} style={{ marginLeft: "auto" }}>
          Finish review
        </button>
      </div>
      )}
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
              ⚠ Validation note:{" "}
              {(c.validation.failed_checks || [])
                .map((ch) => CHECK_LABELS[ch] ?? ch)
                .join("; ") || "see validation"}
              . (A flag is a calibration heads-up, not necessarily a correctness problem.)
            </div>
          )}

          <div className="detail">
            <div className="kv"><span className="k">Type</span><span className="mono">{c.hallucination_type ?? "control"}</span></div>
            <div className="kv"><span className="k">Severity / subtlety</span><span className="mono">{c.severity} / {c.subtlety_rating}</span></div>
            <div className="kv"><span className="k">Expected verdict</span><span className="mono">{c.expected_verdict}</span></div>
            <div className="kv"><span className="k">Source</span><span>{c.source_filing}{" "}<a href={c.source_url} target="_blank" rel="noreferrer">↗</a></span></div>
          </div>

          {/* What our engine actually produced for this case (latest run) */}
          <div className="detail" style={{ borderColor: "var(--accent)" }}>
            <div className="kv">
              <span className="k">App verdict</span>
              <span>
                {c.app_result ? (
                  <span className="row" style={{ gap: 8, display: "inline-flex" }}>
                    <span className={`badge v-${c.app_result.verdict} bg-${c.app_result.verdict}`}>
                      {VERDICT_LABEL[c.app_result.verdict] ?? c.app_result.verdict}
                    </span>
                    {c.app_result.defect_type && c.app_result.defect_type !== "none" && (
                      <span className="defect-chip">⚠ {c.app_result.defect_type.replace(/_/g, " ")}</span>
                    )}
                    <span className={c.app_result.verdict === c.expected_verdict ? "v-supported" : "v-unsupported"}>
                      {c.app_result.verdict === c.expected_verdict ? "✓ matches expected" : "✗ differs from expected"}
                    </span>
                  </span>
                ) : (
                  <span className="muted">not yet verified</span>
                )}
              </span>
            </div>
            {c.app_result && (
              <div className="kv">
                <span className="k">Engine detail</span>
                <span className="mono muted">
                  citation resolved: {c.app_result.citation_resolution_status} · confidence:{" "}
                  {c.app_result.confidence} · {c.app_result.run_id}
                </span>
              </div>
            )}
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
