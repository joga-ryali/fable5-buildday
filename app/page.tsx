// Build-day skeleton. Plumbing only — the real "Research with Receipts" app
// is built by Fable 5 on Saturday and pushed to this same repo.
export const dynamic = "force-dynamic";

export default function Home() {
  // Server-side: confirms the runtime key path without spending a token.
  const keyPresent = Boolean(process.env.ANTHROPIC_API_KEY);

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

      <p className="hint">
        On build day, push the real app to <code>main</code> → Vercel
        auto-redeploys. No setup needed on the day.
      </p>
    </main>
  );
}
