// GET /api/cases — feeds the /harness-review client UI. Flagged cases first.
import { NextResponse } from "next/server";
import {
  getCases,
  getValidation,
  getLatestFeedback,
  getReport,
  getLatestRun,
  getResultsForRun,
} from "../../_lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const run = getLatestRun();
  const resultsByCase = Object.fromEntries(
    (run ? getResultsForRun(run.run_id) : []).map((r) => [r.test_case_id, r])
  );

  const cases = getCases().map((c) => {
    const validation = getValidation(c.test_case_id);
    const feedback = getLatestFeedback(c.test_case_id);
    const result = resultsByCase[c.test_case_id] ?? null;
    return {
      ...c,
      report: getReport(c.test_case_id),
      validation,
      latest_feedback: feedback,
      flagged: validation?.validation_status === "flagged",
      app_result: result
        ? {
            verdict: result.verdict,
            defect_type: result.defect_type ?? "none",
            citation_resolution_status: result.citation_resolution_status,
            confidence: result.confidence,
            pass: result.pass,
            run_id: result.run_id,
          }
        : null,
    };
  });
  // flagged first, then by id
  cases.sort((a, b) => {
    if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
    return a.test_case_id.localeCompare(b.test_case_id);
  });
  const accepted = cases.filter(
    (c) => c.latest_feedback?.review_status === "accepted"
  ).length;
  return NextResponse.json({ cases, accepted, total: cases.length });
}
