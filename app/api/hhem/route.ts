import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// Server-side proxy to the HHEM endpoint — keeps HHEM_ENDPOINT_TOKEN off the client.
// Diagnostic only; the real per-claim scoring is built by Fable 5 during the build.
export async function POST(req: NextRequest) {
  const url = process.env.HHEM_ENDPOINT_URL;
  const token = process.env.HHEM_ENDPOINT_TOKEN;
  if (!url || !token) {
    return Response.json(
      { error: "HHEM_ENDPOINT_URL / HHEM_ENDPOINT_TOKEN not configured." },
      { status: 500 }
    );
  }

  let body: { premise?: string; hypothesis?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad JSON." }, { status: 400 });
  }

  const premise = (body.premise ?? "").trim();
  const hypothesis = (body.hypothesis ?? "").trim();
  if (!premise || !hypothesis) {
    return Response.json(
      { error: "Provide both the source (premise) and the claim (hypothesis)." },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, pairs: [[premise, hypothesis]] }),
      cache: "no-store",
    });
    if (!res.ok) {
      return Response.json(
        { error: `HHEM endpoint returned HTTP ${res.status}.` },
        { status: 502 }
      );
    }
    const data = (await res.json()) as { scores?: number[] };
    const score = Array.isArray(data.scores) ? data.scores[0] : undefined;
    if (typeof score !== "number") {
      return Response.json({ error: "Unexpected HHEM response shape." }, { status: 502 });
    }
    return Response.json({ score });
  } catch {
    return Response.json(
      { error: "Request to HHEM failed (endpoint may be cold — retry)." },
      { status: 502 }
    );
  }
}
