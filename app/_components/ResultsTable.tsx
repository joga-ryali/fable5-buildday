"use client";
import { useState } from "react";

export interface ResultRow {
  test_case_id: string;
  hallucination_type: string | null;
  ground_truth_verdict: string;
  verdict: string;
  defect_type?: string;
  citation_resolution_status: string;
  confidence: string;
  pass: boolean;
  // detail (from ground truth + result)
  claim: string;
  original_text: string;
  source_filing: string;
  citation_as_written: string;
  citation_match_verdict: string;
  source_excerpt: string;
  notes: string;
}

const VLABEL: Record<string, string> = {
  supported: "supported",
  partially_supported: "partially supported",
  unsupported: "unsupported",
  cannot_verify: "cannot verify",
};

export default function ResultsTable({ rows }: { rows: ResultRow[] }) {
  const [open, setOpen] = useState<ResultRow | null>(null);

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Case</th><th>Type</th><th>Expected</th><th>Actual</th>
            <th>Defect</th><th>Resolution</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.test_case_id} className="clickable" onClick={() => setOpen(r)}>
              <td className="mono">{r.test_case_id}</td>
              <td className="mono">{r.hallucination_type ?? "control"}</td>
              <td className="mono">{r.ground_truth_verdict}</td>
              <td className="mono"><span className={`v-${r.verdict}`}>{r.verdict}</span></td>
              <td className="mono">{r.defect_type && r.defect_type !== "none" ? r.defect_type : "—"}</td>
              <td className="mono">{r.citation_resolution_status}</td>
              <td>{r.pass ? <span className="v-supported">PASS</span> : <span className="v-unsupported">FAIL</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="row" style={{ gap: 8 }}>
                <span className="mono muted">{open.test_case_id}</span>
                <span className={`badge v-${open.verdict} bg-${open.verdict}`}>
                  {VLABEL[open.verdict] ?? open.verdict}
                </span>
                {open.defect_type && open.defect_type !== "none" && (
                  <span className="defect-chip">⚠ {open.defect_type.replace(/_/g, " ")}</span>
                )}
                <span className={open.pass ? "v-supported" : "v-unsupported"}>
                  {open.pass ? "PASS" : "FAIL"}
                </span>
              </div>
              <button className="modal-close" onClick={() => setOpen(null)} aria-label="close">×</button>
            </div>

            <div className="detail" style={{ marginTop: 14 }}>
              <div className="kv"><span className="k">Hallucination type</span><span className="mono">{open.hallucination_type ?? "control"}</span></div>
              <div className="kv"><span className="k">Expected verdict</span><span className="mono">{open.ground_truth_verdict}</span></div>
              <div className="kv"><span className="k">Engine verdict</span><span className="mono">{open.verdict} ({open.confidence})</span></div>
              <div className="kv"><span className="k">Citation match</span><span className="mono">{open.citation_match_verdict}</span></div>
              <div className="kv"><span className="k">Resolution</span><span className="mono">{open.citation_resolution_status}</span></div>
            </div>

            <h3>Claim under test</h3>
            <p>{open.claim}</p>
            <h3>Citation</h3>
            <p className="mono muted">{open.citation_as_written}</p>
            <h3>Cited source ({open.source_filing})</h3>
            <p className="muted">{open.original_text ? `“${open.original_text}”` : "— (no source text; fabricated/unretrievable citation)"}</p>
            {open.source_excerpt && (
              <>
                <h3>Engine anchored on</h3>
                <p className="muted">“{open.source_excerpt}”</p>
              </>
            )}
            <h3>Reasoning</h3>
            <p>{open.notes}</p>
          </div>
        </div>
      )}
    </>
  );
}
