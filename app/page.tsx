// Nav landing for the Citation Faithfulness Verification System.
export const dynamic = "force-dynamic";

const routes = [
  {
    href: "/live",
    title: "Live check →",
    desc: "Paste a claim and its source excerpt; get a faithfulness verdict from claude-sonnet-4-6 with reasoning.",
  },
  {
    href: "/verification",
    title: "Verification →",
    desc: "Demo-facing: report excerpts with each claim highlighted by verdict — supported, partial, unsupported, cannot-verify.",
  },
  {
    href: "/results",
    title: "Test results summary →",
    desc: "Technical: overall pass rate, accuracy by defect type, failed cases, regressions across runs.",
  },
  {
    href: "/harness-review",
    title: "Harness review →",
    desc: "Human review of generated test cases before the corpus is locked. Accept / iterate / reject.",
  },
];

export default function Home() {
  return (
    <main className="wide">
      <h1>Citation Faithfulness Verification</h1>
      <p className="tagline">
        Does a research report — AI-assisted or human-written — faithfully
        represent its cited sources, across SEC filings, case law, and government
        statistics? Two sequential{" "}
        <code>claude-sonnet-4-6</code> passes per claim — citation match, then
        faithfulness — grade each claim <strong>supported / partially supported /
        unsupported / cannot&nbsp;verify</strong> and name the specific defect:
        fabricated citations, wrong attributions, contradictions, numeric
        mismatches, overstatements, scope expansions, and unsupported additions.
      </p>
      <div className="nav-grid">
        {routes.map((r) => (
          <a key={r.href} className="nav-card" href={r.href}>
            <h3>{r.title}</h3>
            <p>{r.desc}</p>
          </a>
        ))}
      </div>
    </main>
  );
}
