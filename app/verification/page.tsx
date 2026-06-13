// /verification — demo-facing per-claim verdict view.
import {
  getLatestRun,
  getResultsForRun,
  getCases,
  getReport,
} from "../_lib/data";
import VerificationView, { VItem } from "../_components/VerificationView";

export const dynamic = "force-dynamic";

export default function Verification() {
  const run = getLatestRun();
  if (!run) {
    return (
      <main className="wide">
        <p className="muted"><a href="/">← home</a></p>
        <h1>Verification</h1>
        <p className="muted">
          No verification runs yet. Run <code>python verifier/verify.py</code>.
        </p>
      </main>
    );
  }

  const cases = Object.fromEntries(getCases().map((c) => [c.test_case_id, c]));
  const items: VItem[] = getResultsForRun(run.run_id).map((r) => {
    const c = cases[r.test_case_id];
    return {
      test_case_id: r.test_case_id,
      report: getReport(r.test_case_id) || c?.modified_text || r.notes,
      highlight: c?.modified_text ?? c?.claim ?? "",
      claim: c?.claim ?? "",
      citation_as_written: c?.citation_as_written ?? "",
      verdict: r.verdict,
      defect_type: r.defect_type,
      confidence: r.confidence,
      source_excerpt: r.source_excerpt,
      notes: r.notes,
      citation_resolution_status: r.citation_resolution_status,
      citation_match_verdict: r.citation_match_verdict,
    };
  });

  return <VerificationView items={items} runId={run.run_id} />;
}
