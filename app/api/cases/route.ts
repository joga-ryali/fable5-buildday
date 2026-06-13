// GET /api/cases — feeds the /harness-review client UI. Flagged cases first.
import { NextResponse } from "next/server";
import {
  getCases,
  getValidation,
  getLatestFeedback,
  getReport,
} from "../../_lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cases = getCases().map((c) => {
    const validation = getValidation(c.test_case_id);
    const feedback = getLatestFeedback(c.test_case_id);
    return {
      ...c,
      report: getReport(c.test_case_id),
      validation,
      latest_feedback: feedback,
      flagged: validation?.validation_status === "flagged",
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
