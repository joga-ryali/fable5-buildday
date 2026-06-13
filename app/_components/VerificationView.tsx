"use client";
import { useState } from "react";
import ExportButton from "./ExportButton";

export interface VItem {
  test_case_id: string;
  report: string;
  highlight: string; // substring of report to color by verdict
  claim: string;
  citation_as_written: string;
  verdict: string;
  confidence: string;
  source_excerpt: string;
  notes: string;
  citation_resolution_status: string;
  citation_match_verdict: string;
}

const LABEL: Record<string, string> = {
  supported: "supported",
  partially_supported: "partial",
  unsupported: "unsupported",
  cannot_verify: "cannot verify",
};

function Highlighted({ item, onClick }: { item: VItem; onClick: () => void }) {
  const idx = item.highlight ? item.report.indexOf(item.highlight) : -1;
  if (idx === -1) {
    return <p>{item.report}</p>;
  }
  const before = item.report.slice(0, idx);
  const mid = item.report.slice(idx, idx + item.highlight.length);
  const after = item.report.slice(idx + item.highlight.length);
  return (
    <p style={{ whiteSpace: "pre-wrap" }}>
      {before}
      <span
        className={`hl v-${item.verdict} bg-${item.verdict}`}
        onClick={onClick}
        title="click for verdict detail"
      >
        {mid}
      </span>
      {after}
    </p>
  );
}

export default function VerificationView({
  items,
  runId,
}: {
  items: VItem[];
  runId: string;
}) {
  const [open, setOpen] = useState<string | null>(items[0]?.test_case_id ?? null);

  return (
    <main className="wide">
      <p className="muted"><a href="/">← home</a></p>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Verification</h1>
        <ExportButton data={items} filename={`verification_${runId}.json`} />
      </div>
      <p className="tagline">
        Each report claim is color-coded by how faithfully it represents its cited
        SEC source. Click a highlighted claim for the verdict detail.{" "}
        <span className="badge v-supported bg-supported">supported</span>{" "}
        <span className="badge v-partially_supported bg-partially_supported">partial</span>{" "}
        <span className="badge v-unsupported bg-unsupported">unsupported</span>{" "}
        <span className="badge v-cannot_verify bg-cannot_verify">cannot verify</span>
      </p>

      {items.map((item) => {
        const isOpen = open === item.test_case_id;
        return (
          <div className="card" key={item.test_case_id} style={{ marginBottom: 16 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted mono">{item.test_case_id}</span>
              <span className={`badge v-${item.verdict} bg-${item.verdict}`}>
                {LABEL[item.verdict] ?? item.verdict}
              </span>
            </div>
            <Highlighted
              item={item}
              onClick={() => setOpen(isOpen ? null : item.test_case_id)}
            />
            <button
              className="secondary-btn"
              onClick={() => setOpen(isOpen ? null : item.test_case_id)}
            >
              {isOpen ? "Hide detail" : "Show detail"}
            </button>
            {isOpen && (
              <div className="detail">
                <div className="kv">
                  <span className="k">Claim</span>
                  <span>{item.claim}</span>
                </div>
                <div className="kv">
                  <span className="k">Citation</span>
                  <span className="mono">{item.citation_as_written}</span>
                </div>
                <div className="kv">
                  <span className="k">Citation match</span>
                  <span className="mono">{item.citation_match_verdict}</span>
                </div>
                <div className="kv">
                  <span className="k">Resolution</span>
                  <span className="mono">{item.citation_resolution_status}</span>
                </div>
                <div className="kv">
                  <span className="k">Confidence</span>
                  <span className="mono">{item.confidence}</span>
                </div>
                {item.source_excerpt && (
                  <div className="kv">
                    <span className="k">Source anchor</span>
                    <span>“{item.source_excerpt}”</span>
                  </div>
                )}
                <div className="kv">
                  <span className="k">Reasoning</span>
                  <span>{item.notes}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </main>
  );
}
