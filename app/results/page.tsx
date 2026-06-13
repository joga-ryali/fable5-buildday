// /results — technical pass-rate summary (per domain). Judge-facing.
import { getLatestRun, getResultsForRun, getRuns, getCases, domainOf } from "../_lib/data";
import ExportButton from "../_components/ExportButton";
import DomainTabs from "../_components/DomainTabs";
import ResultsTable, { ResultRow } from "../_components/ResultsTable";

export const dynamic = "force-dynamic";

function rateClass(rate: number) {
  if (rate >= 0.8) return "rate-green";
  if (rate >= 0.6) return "rate-yellow";
  return "rate-red";
}

export default async function Results({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const sp = await searchParams;
  const domain = sp.domain ?? "corporate_filings";
  const run = getLatestRun();
  const allRuns = getRuns();

  if (!run) {
    return (
      <main className="wide">
        <p className="muted"><a href="/">← home</a></p>
        <h1>Test Results Summary</h1>
        <p className="muted">No verification runs yet. Run <code>python verifier/verify.py</code>.</p>
      </main>
    );
  }

  // filter the latest run's results to the selected domain; compute stats from those
  const results = getResultsForRun(run.run_id).filter(
    (r) => domainOf(r) === domain
  );
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const failed = total - passed;
  const passRate = total ? passed / total : 0;

  // by defect (what the engine actually flagged), and per-type pass rate by ground-truth type
  const byType: Record<string, { passed: number; total: number }> = {};
  for (const r of results) {
    const t = r.hallucination_type ?? "control";
    byType[t] ??= { passed: 0, total: 0 };
    byType[t].total += 1;
    if (r.pass) byType[t].passed += 1;
  }
  const abstentions = results.filter((r) => r.verdict === "cannot_verify").length;

  // join results with ground-truth case detail for the drill-down modal
  const caseMap = Object.fromEntries(getCases().map((c) => [c.test_case_id, c]));
  const rows: ResultRow[] = results.map((r) => {
    const c = caseMap[r.test_case_id];
    return {
      test_case_id: r.test_case_id,
      hallucination_type: r.hallucination_type,
      ground_truth_verdict: r.ground_truth_verdict,
      verdict: r.verdict,
      defect_type: r.defect_type,
      citation_resolution_status: r.citation_resolution_status,
      confidence: r.confidence,
      pass: r.pass,
      claim: c?.claim ?? "",
      original_text: c?.original_text ?? "",
      source_filing: c?.source_filing ?? "",
      citation_as_written: c?.citation_as_written ?? "",
      citation_match_verdict: r.citation_match_verdict,
      source_excerpt: r.source_excerpt,
      notes: r.notes,
    };
  });

  return (
    <main className="wide">
      <p className="muted"><a href="/">← home</a></p>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Test Results Summary</h1>
        <ExportButton data={{ run_id: run.run_id, domain, results }} filename={`${run.run_id}_${domain}.json`} />
      </div>
      <DomainTabs current={domain} basePath="/results" />
      <p className="muted">
        {run.run_id} · prompt {run.prompt_version} · {allRuns.length} run(s) total
        {run.change_from_previous ? ` · ${run.change_from_previous}` : ""}
      </p>

      {total === 0 ? (
        <p className="muted">No verified cases in this domain yet.</p>
      ) : (
        <>
          <div className="card" style={{ marginTop: 8 }}>
            <div className="row" style={{ gap: 28, alignItems: "flex-end" }}>
              <div>
                <div className={`passrate ${rateClass(passRate)}`}>
                  {Math.round(passRate * 100)}%
                </div>
                <div className="score-band">
                  pass rate · {passed}/{total} cases
                  {" "}(green ≥80 · yellow 60–79 · red &lt;60)
                </div>
              </div>
              <div className="score-band">
                {abstentions > 0
                  ? `${abstentions} case(s) the engine correctly abstained on (cannot_verify) — it returns "I can't verify this" rather than guessing.`
                  : ""}
              </div>
            </div>
          </div>

          <h3 style={{ marginTop: 28 }}>By hallucination type</h3>
          <table>
            <thead>
              <tr><th>Type</th><th>Passed</th><th>Total</th><th style={{ width: 160 }}>Rate</th></tr>
            </thead>
            <tbody>
              {Object.entries(byType).map(([type, s]) => {
                const r = s.total ? s.passed / s.total : 0;
                return (
                  <tr key={type}>
                    <td className="mono">{type}</td>
                    <td>{s.passed}</td>
                    <td>{s.total}</td>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <div className="bar">
                          <span style={{ width: `${r * 100}%`, background: r === 0 ? "var(--unsupported)" : r < 1 ? "var(--partial)" : "var(--supported)" }} />
                        </div>
                        <span className="mono">{Math.round(r * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h3 style={{ marginTop: 28 }}>
            Per-case results {failed > 0 && <span className="v-unsupported">· {failed} failed</span>}
            <span className="muted" style={{ fontWeight: 400 }}> · click a row for detail</span>
          </h3>
          <ResultsTable rows={rows} />
        </>
      )}
    </main>
  );
}
