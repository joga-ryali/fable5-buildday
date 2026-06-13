// POST /api/live — stateless faithfulness check for the /live demo route.
// Calls claude-sonnet-4-6 (Prompt B) directly. No persistence.
import { NextResponse } from "next/server";
import { faithfulnessCheck } from "../_lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { claim, source } = await req.json();
    if (!claim || typeof claim !== "string") {
      return NextResponse.json({ error: "claim is required" }, { status: 400 });
    }
    const result = await faithfulnessCheck(claim, source ?? "");
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
