// Build-day skeleton. Plumbing only — the real "Research with Receipts" app
// is built by Fable 5 on Saturday and pushed to this same repo.
export const dynamic = "force-dynamic";

// Connectivity probe ONLY. We do not call HHEM's scoring API here — the actual
// (claim, chunk) scoring calls are coded by Fable 5 during the build. This just
// confirms the deployed env can reach the endpoint once it's provisioned.
async function checkHhem(): Promise<{
  state: "ok" | "bad" | "unset";
  label: string;
}> {
  const url = process.env.HHEM_ENDPOINT_URL;
  if (!url) {
    return {
      state: "unset",
      label:
        "HHEM_ENDPOINT_URL not set — add it (and HHEM_ENDPOINT_TOKEN if the endpoint needs auth) once the scoring endpoint is provisioned.",
    };
  }
  const token = process.env.HHEM_ENDPOINT_TOKEN;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    // Any HTTP response (even 401/404/405) proves the host answered → reachable.
    return { state: "ok", label: `HHEM endpoint reachable (HTTP ${res.status}).` };
  } catch {
    return {
      state: "bad",
      label:
        "HHEM endpoint set but unreachable (network error or timeout). A scale-to-zero endpoint may be cold — refresh to retry.",
    };
  }
}

export default async function Home() {
  // Server-side: confirms the runtime key path without spending a token.
  const keyPresent = Boolean(process.env.ANTHROPIC_API_KEY);
  const hhem = await checkHhem();

  return (
    <main>
      <h1>
        Hello, Fable 5! <span aria-hidden>🟢</span>
      </h1>
      <p className="tagline">
        Research with Receipts — build-day skeleton. The deploy pipeline is live.
      </p>

      <div className={`status ${keyPresent ? "ok" : "missing"}`}>
        <span className="dot" aria-hidden />
        {keyPresent
          ? "ANTHROPIC_API_KEY is present in this environment."
          : "ANTHROPIC_API_KEY is not set — add it in Vercel → Settings → Environment Variables, then redeploy."}
      </div>

      <div
        className={`status ${
          hhem.state === "ok" ? "ok" : hhem.state === "bad" ? "bad" : "missing"
        }`}
      >
        <span className="dot" aria-hidden />
        {hhem.label}
      </div>

      <p className="hint">
        On build day, push the real app to <code>main</code> → Vercel
        auto-redeploys. No setup needed on the day. The HHEM line is a
        connectivity probe only — scoring calls are coded during the build.
      </p>
    </main>
  );
}
