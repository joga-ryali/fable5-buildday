// Server-only data access for dashboard routes. Reads the committed JSON
// corpus from the repo root at runtime. SCHEMA.md is the contract.
import "server-only";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const dir = (d: string) => path.join(ROOT, d);

export type Verdict =
  | "supported"
  | "partially_supported"
  | "unsupported"
  | "cannot_verify";

export interface TestCase {
  test_case_id: string;
  domain?: string;
  source_filing: string;
  source_url: string;
  original_text: string;
  modified_text: string;
  claim: string;
  citation_as_written: string;
  hallucination_type: string | null;
  severity: string;
  subtlety_rating: number;
  citation_intact: boolean;
  expected_verdict: Verdict;
  notes: string;
}

export interface Validation {
  test_case_id: string;
  validation_status: "pass" | "flagged" | "fail";
  consistency_checks: Record<string, boolean>;
  classification_checks: Record<string, boolean>;
  failed_checks: string[];
  notes: string;
}

export interface Feedback {
  test_case_id: string;
  iteration_number: number;
  review_status: "accepted" | "iterate" | "rejected";
  feedback_type: string | null;
  comment: string | null;
}

export interface ResultRecord {
  test_case_id: string;
  run_id: string;
  timestamp: string;
  citation_resolution_status: string;
  citation_match_verdict: string;
  verdict: Verdict;
  defect_type?: string;
  confidence: string;
  source_excerpt: string;
  caveat_preserved: boolean;
  notes: string;
  ground_truth_verdict: Verdict;
  pass: boolean;
  prompt_version: string;
  hallucination_type: string | null;
  domain?: string;
}

export const DOMAINS = [
  { key: "corporate_filings", label: "Corporate Filings" },
  { key: "legal", label: "Law" },
];
export function domainOf(x: { domain?: string }): string {
  return x.domain ?? "corporate_filings";
}

export interface RunSummary {
  run_id: string;
  timestamp: string;
  prompt_version: string;
  change_from_previous: string;
  total: number;
  passed: number;
  failed: number;
  pass_rate: number;
  by_hallucination_type: Record<
    string,
    { total: number; passed: number; failed: number }
  >;
  failed_cases: string[];
  regressions_from_best_run: string[];
  best_run_id: string;
}

function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

function listJson(d: string): string[] {
  try {
    return fs
      .readdirSync(dir(d))
      .filter((f) => f.endsWith(".json"))
      .sort();
  } catch {
    return [];
  }
}

export function getCases(): TestCase[] {
  return listJson("ground_truth")
    .filter((f) => /^tc_\d+\.json$/.test(f))
    .map((f) => readJson<TestCase>(path.join(dir("ground_truth"), f)))
    .filter((c): c is TestCase => c !== null);
}

export function getValidation(tcId: string): Validation | null {
  return readJson<Validation>(
    path.join(dir("ground_truth"), `${tcId}_validation.json`)
  );
}

export function getLatestFeedback(tcId: string): Feedback | null {
  const fbs = listJson("ground_truth").filter((f) =>
    new RegExp(`^${tcId}_feedback_\\d+\\.json$`).test(f)
  );
  if (fbs.length === 0) return null;
  const latest = fbs.sort((a, b) => {
    const n = (s: string) => parseInt(s.match(/_feedback_(\d+)/)?.[1] ?? "0");
    return n(a) - n(b);
  })[fbs.length - 1];
  return readJson<Feedback>(path.join(dir("ground_truth"), latest));
}

export function getReport(tcId: string): string {
  try {
    return fs.readFileSync(path.join(dir("reports"), `${tcId}.txt`), "utf8");
  } catch {
    return "";
  }
}

export function getRuns(): RunSummary[] {
  return listJson("runs")
    .filter((f) => /^run_\d+_summary\.json$/.test(f))
    .map((f) => readJson<RunSummary>(path.join(dir("runs"), f)))
    .filter((r): r is RunSummary => r !== null)
    .sort((a, b) => a.run_id.localeCompare(b.run_id));
}

export function getLatestRun(): RunSummary | null {
  const runs = getRuns();
  return runs.length ? runs[runs.length - 1] : null;
}

export function getResultsForRun(runId: string): ResultRecord[] {
  return listJson("results")
    .filter((f) => f.endsWith(`_${runId}.json`))
    .map((f) => readJson<ResultRecord>(path.join(dir("results"), f)))
    .filter((r): r is ResultRecord => r !== null)
    .sort((a, b) => a.test_case_id.localeCompare(b.test_case_id));
}
