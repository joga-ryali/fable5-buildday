// POST /api/feedback — writes a human-review feedback file (SCHEMA §4).
// Local-only: writes to ground_truth/. (Vercel fs is read-only; judges use
// /live and /verification, not this route.)
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GT = path.join(process.cwd(), "ground_truth");

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { test_case_id, review_status } = body;
    if (!test_case_id || !["accepted", "iterate", "rejected"].includes(review_status)) {
      return NextResponse.json({ error: "bad payload" }, { status: 400 });
    }
    // next iteration number
    const existing = fs
      .readdirSync(GT)
      .filter((f) => new RegExp(`^${test_case_id}_feedback_\\d+\\.json$`).test(f));
    const nextIt =
      existing.reduce((mx, f) => {
        const n = parseInt(f.match(/_feedback_(\d+)/)?.[1] ?? "0");
        return Math.max(mx, n);
      }, 0) + 1;

    const record = {
      test_case_id,
      iteration_number: nextIt,
      review_status,
      reviewer: "joga",
      timestamp: new Date().toISOString(),
      feedback_type: body.feedback_type ?? null,
      subtlety_rating_override: body.subtlety_rating_override ?? null,
      comment: body.comment ?? null,
    };
    fs.writeFileSync(
      path.join(GT, `${test_case_id}_feedback_${nextIt}.json`),
      JSON.stringify(record, null, 2)
    );
    return NextResponse.json({ ok: true, iteration_number: nextIt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
