// /results — technical pass-rate dashboard (judge-facing).
import { getLatestRun, getResultsForRun, getRuns } from "../_lib/data";
import ExportButton from "../_components/ExportButton";

export const dynamic = "force-dynamic";

function rateClass(rate: number) {
  if (rate >= 0.8) return "rate-green";
  if (rate >= 0.6) return "rate-yellow";
  return "rate-red";
}

export default function Results() {
  const run = getLatestRun();
  const allRuns = getRuns();

  if (!run) {
    return (
      <main className="wide">
        <p className="muted"><a href="/">← home</a></p>
        <h1>Results</h1>
        <p className="muted">No verification runs yet. Run <code>python verifier/verify.py</code>.</p>
      </main>
    );
  }

  const results = getResultsForRun(run.run_id);
  const types = Object.entries(run.by_hallucination_type);

  return (
    <main className="wide">
      <p className="muted"><a href="/">← home</a></p>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Results</h1>
        <ExportButton data={{ run, results }} filename={`${run.run_id}.json`} />
      </div>
      <p className="muted">
        {run.run_id} · prompt {run.prompt_version} · {allRuns.length} run(s) total
        {run.change_from_previous ? ` · ${run.change_from_previous}` : ""}
      </p>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ gap: 28, alignItems: "flex-end" }}>
          <div>
            <div className={`passrate ${rateClass(run.pass_rate)}`}>
              {Math.round(run.pass_rate * 100)}%
            </div>
            <div className="score-band">
              pass rate · {run.passed}/{run.total} cases
              {" "}(green ≥80 · yellow 60–79 · red &lt;60)
            </div>
          </div>
          {run.regressions_from_best_run.length > 0 && (
            <div className="banner flag" style={{ margin: 0 }}>
              ⚠ {run.regressions_from_best_run.length} regression(s) from best run:{" "}
              {run.regressions_from_best_run.join(", ")}
            </div>
          )}
        </div>
      </div>

      <h3 style={{ marginTop: 28 }}>By hallucination type</h3>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Passed</th>
            <th>Total</th>
            <th style={{ width: 160 }}>Rate</th>
          </tr>
        </thead>
        <tbody>
          {types.map(([type, s]) => {
            const r = s.total ? s.passed / s.total : 0;
            return (
              <tr key={type}>
                <td className="mono">{type}</td>
                <td>{s.passed}</td>
                <td>{s.total}</td>
                <td>
                  <div className="row" style={{ gap: 8 }}>
                    <div className="bar">
                      <span
                        style={{
                          width: `${r * 100}%`,
                          background:
                            r === 0
                              ? "var(--unsupported)"
                              : r < 1
                              ? "var(--partial)"
                              : "var(--supported)",
                        }}
                      />
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
        Per-case results {run.failed > 0 && <span className="v-unsupported">· {run.failed} failed</span>}
      </h3>
      <table>
        <thead>
          <tr>
            <th>Case</th>
            <th>Type</th>
            <th>Expected</th>
            <th>Actual</th>
            <th>Resolution</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.test_case_id}>
              <td className="mono">{r.test_case_id}</td>
              <td className="mono">{r.hallucination_type ?? "control"}</td>
              <td className="mono">{r.ground_truth_verdict}</td>
              <td className="mono">
                <span className={`v-${r.verdict}`}>{r.verdict}</span>
              </td>
              <td className="mono">{r.citation_resolution_status}</td>
              <td>
                {r.pass ? (
                  <span className="v-supported">PASS</span>
                ) : (
                  <span className="v-unsupported">FAIL</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
