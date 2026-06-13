#!/usr/bin/env python3
"""
verifier/verify.py — Batch runner for the Citation Faithfulness pipeline.

Contract: SCHEMA.md. Reads accepted ground-truth cases, runs lib/verifier.verify_claim
on each, writes APPEND-ONLY result + run-summary files.

Usage:
  python verifier/verify.py                       # run all ACCEPTED cases
  python verifier/verify.py --case tc_001         # run specific case(s)
  python verifier/verify.py --include-unaccepted  # also run not-yet-accepted cases
  python verifier/verify.py --prompt-version v2 --change "fixed caveat handling"
"""

from __future__ import annotations

import os
import re
import sys
import glob
import json
import argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "lib"))

from lib.verifier import verify_claim, now_iso, HAIKU, SONNET  # noqa: E402

APP_VERSION = "0.1.0"
GT_DIR = os.path.join(ROOT, "ground_truth")
REPORTS_DIR = os.path.join(ROOT, "reports")
RESULTS_DIR = os.path.join(ROOT, "results")
RUNS_DIR = os.path.join(ROOT, "runs")


def _read_json(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


def latest_feedback_status(tc_id: str) -> str | None:
    """Return review_status of the highest-iteration feedback file, or None."""
    fbs = glob.glob(os.path.join(GT_DIR, f"{tc_id}_feedback_*.json"))
    if not fbs:
        return None
    def it_num(p):
        m = re.search(r"_feedback_(\d+)\.json$", p)
        return int(m.group(1)) if m else 0
    latest = max(fbs, key=it_num)
    return _read_json(latest).get("review_status")


def load_cases(only: list[str] | None, include_unaccepted: bool) -> list[dict]:
    cases = []
    for path in sorted(glob.glob(os.path.join(GT_DIR, "tc_*.json"))):
        base = os.path.basename(path)
        if "_validation" in base or "_feedback_" in base:
            continue
        tc = _read_json(path)
        tc_id = tc["test_case_id"]
        if only and tc_id not in only:
            continue
        if not include_unaccepted and not only:
            if latest_feedback_status(tc_id) != "accepted":
                continue
        cases.append(tc)
    return cases


def next_run_id() -> str:
    existing = glob.glob(os.path.join(RUNS_DIR, "run_*_summary.json"))
    nums = []
    for p in existing:
        m = re.search(r"run_(\d+)_summary\.json$", os.path.basename(p))
        if m:
            nums.append(int(m.group(1)))
    return f"run_{(max(nums) + 1) if nums else 1:03d}"


def result_path(tc_id: str, run_id: str) -> str:
    # APPEND ONLY: result files are unique per (case, run); never overwrite.
    return os.path.join(RESULTS_DIR, f"{tc_id}_{run_id}.json")


def filing_period_from_url(url: str | None) -> str | None:
    """Parse the SEC primary-doc period-end date from the filename, e.g.
    '.../aapl-20230930.htm' -> '2023-09-30'. This is the resolved filing's actual
    period — what citation resolution returns — used to catch wrong-year/wrong-
    period attribution in the claim (partial_citation_corruption)."""
    if not url:
        return None
    m = re.search(r"-(\d{8})\.htm", url)
    if not m:
        return None
    d = m.group(1)
    return f"{d[:4]}-{d[4:6]}-{d[6:]}"


def resolved_source_label(tc: dict) -> str:
    label = tc.get("source_filing") or ""
    period = filing_period_from_url(tc.get("source_url"))
    if period:
        return f"{label} (resolved filing period ending {period})"
    return label


def report_text_for(tc: dict) -> str:
    p = os.path.join(REPORTS_DIR, f"{tc['test_case_id']}.txt")
    if os.path.exists(p):
        with open(p) as f:
            return f.read()
    # fallback: synthesize a minimal report line from the case
    return f"{tc.get('modified_text', tc.get('claim',''))} ({tc.get('citation_as_written','')})"


def best_previous_run() -> dict | None:
    summaries = glob.glob(os.path.join(RUNS_DIR, "run_*_summary.json"))
    best, best_rate = None, -1.0
    for p in summaries:
        s = _read_json(p)
        if s.get("pass_rate", -1) > best_rate:
            best, best_rate = s, s["pass_rate"]
    return best


def run(only, include_unaccepted, prompt_version, change, stage1_model):
    cases = load_cases(only, include_unaccepted)
    if not cases:
        print("No matching cases. (Are any accepted? use --include-unaccepted.)")
        return 1

    run_id = next_run_id()
    print(f"=== {run_id}: verifying {len(cases)} case(s), prompt={prompt_version} ===")

    results = []
    for tc in cases:
        tc_id = tc["test_case_id"]
        # The faithfulness check reasons over the TRUE filing passage when one
        # exists (original_text). total_citation_fabrication has original_text=""
        # and a fake URL -> resolution 404s -> cannot_verify (no Prompt B).
        # partial_citation_corruption HAS a real passage + real URL -> we feed it
        # so Prompt B catches the wrong-year/attribution contradiction (-> unsupported).
        ot = tc.get("original_text")
        source_excerpt = ot if ot else None
        r = verify_claim(
            claim=tc["claim"],
            citation=tc.get("citation_as_written"),
            source_url=tc.get("source_url"),
            source_excerpt=source_excerpt,
            source_label=resolved_source_label(tc),
            stage1_model=stage1_model,
            do_resolve=True,
        )
        gt = tc["expected_verdict"]
        record = {
            "test_case_id": tc_id,
            "run_id": run_id,
            "timestamp": now_iso(),
            "app_version": APP_VERSION,
            **r,
            "ground_truth_verdict": gt,
            "pass": r["verdict"] == gt,
            "prompt_version": prompt_version,
            "hallucination_type": tc.get("hallucination_type"),
            "domain": tc.get("domain", "corporate_filings"),
        }
        with open(result_path(tc_id, run_id), "w") as f:
            json.dump(record, f, indent=2)
        results.append(record)
        mark = "PASS" if record["pass"] else "FAIL"
        print(f"  {tc_id}: {r['verdict']:<22} gt={gt:<16} [{mark}] "
              f"(res={r['citation_resolution_status']})")

    # summary
    total = len(results)
    passed = sum(1 for r in results if r["pass"])
    failed = total - passed
    pass_rate = round(passed / total, 4) if total else 0.0

    by_type: dict[str, dict] = {}
    for r in results:
        t = r.get("hallucination_type") or "control"
        by_type.setdefault(t, {"total": 0, "passed": 0, "failed": 0})
        by_type[t]["total"] += 1
        by_type[t]["passed" if r["pass"] else "failed"] += 1

    prev_best = best_previous_run()
    regressions = []
    if prev_best:
        prev_failed = set(prev_best.get("failed_cases", []))
        now_failed = {r["test_case_id"] for r in results if not r["pass"]}
        # regression = case that passed in best run but fails now
        prev_passed = {r for r in
                       (rr["test_case_id"] for rr in results)} - prev_failed
        regressions = sorted(now_failed & prev_passed)

    best_run_id = run_id
    if prev_best and prev_best.get("pass_rate", 0) >= pass_rate:
        best_run_id = prev_best.get("best_run_id", prev_best["run_id"])

    summary = {
        "run_id": run_id,
        "timestamp": now_iso(),
        "app_version": APP_VERSION,
        "prompt_version": prompt_version,
        "change_from_previous": change or ("initial run" if not prev_best else ""),
        "total": total,
        "passed": passed,
        "failed": failed,
        "pass_rate": pass_rate,
        "by_hallucination_type": by_type,
        "failed_cases": sorted(r["test_case_id"] for r in results if not r["pass"]),
        "regressions_from_best_run": regressions,
        "best_run_id": best_run_id,
        "stage1_model": stage1_model,
        "sonnet_model": SONNET,
    }
    with open(os.path.join(RUNS_DIR, f"{run_id}_summary.json"), "w") as f:
        json.dump(summary, f, indent=2)

    print(f"--- {run_id}: {passed}/{total} passed (pass_rate={pass_rate}) ---")
    if regressions:
        print(f"  REGRESSIONS: {regressions}")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--case", action="append", help="specific test_case_id(s)")
    ap.add_argument("--include-unaccepted", action="store_true")
    ap.add_argument("--prompt-version", default="v1")
    ap.add_argument("--change", default="")
    ap.add_argument("--stage1-model", default=HAIKU)
    args = ap.parse_args()
    sys.exit(run(args.case, args.include_unaccepted, args.prompt_version,
                 args.change, args.stage1_model))


if __name__ == "__main__":
    main()
