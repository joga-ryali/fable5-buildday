#!/usr/bin/env python3
"""Ingest the corpus-generation workflow result into SCHEMA files.

Input: a JSON file with {"cases":[...], "validations":[...]} (the workflow's
return value). Writes, for each case:
  - ground_truth/tc_NNN.json          (the test case)
  - reports/tc_NNN.txt                (modified_text + citation, the report excerpt)
  - ground_truth/tc_NNN_validation.json (validation, with Haiku sensitivity merged)

Never overwrites tc_001..tc_007 (the pilot + distributed hand-crafted cases) unless
the incoming ids collide — the workflow assigns ids from tc_008 up.

Usage: python harness/ingest_corpus.py <result.json>
"""
import os
import sys
import json
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GT = os.path.join(ROOT, "ground_truth")
REPORTS = os.path.join(ROOT, "reports")

CASE_FIELDS = [
    "test_case_id", "source_filing", "source_url", "original_text",
    "modified_text", "claim", "citation_as_written", "hallucination_type",
    "severity", "subtlety_rating", "citation_intact", "expected_verdict", "notes",
]


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def main():
    if len(sys.argv) < 2:
        print("usage: ingest_corpus.py <result.json>")
        sys.exit(1)
    data = json.load(open(sys.argv[1]))
    cases = data["cases"]
    validations = {v["test_case_id"]: v for v in data.get("validations", [])}

    PROTECTED = {f"tc_{i:03d}" for i in range(1, 8)}  # tc_001..tc_007
    written = 0
    for c in cases:
        tc_id = c["test_case_id"]
        if tc_id in PROTECTED:
            print(f"  skip {tc_id}: protected (hand-crafted)")
            continue
        # ground truth
        gt = {k: c.get(k) for k in CASE_FIELDS}
        with open(os.path.join(GT, f"{tc_id}.json"), "w") as f:
            json.dump(gt, f, indent=2)
        # report excerpt
        report = f"{c['modified_text']} ({c['citation_as_written']})\n"
        with open(os.path.join(REPORTS, f"{tc_id}.txt"), "w") as f:
            f.write(report)
        # validation (merge haiku sensitivity)
        v = validations.get(tc_id)
        if v and v.get("validation"):
            val = v["validation"]
            val.setdefault("classification_checks", {})
            val["classification_checks"]["haiku_spotted_without_source"] = bool(
                v.get("haiku_spotted", False))
            if v.get("haiku_spotted"):
                if "haiku_spotted_without_source" not in val.get("failed_checks", []):
                    val.setdefault("failed_checks", []).append(
                        "haiku_spotted_without_source")
                if val.get("validation_status") == "pass":
                    val["validation_status"] = "flagged"
            record = {
                "test_case_id": tc_id,
                "validator_model": "claude-sonnet-4-6",
                "timestamp": now_iso(),
                **val,
                "haiku_reason": v.get("haiku_reason", ""),
            }
            with open(os.path.join(GT, f"{tc_id}_validation.json"), "w") as f:
                json.dump(record, f, indent=2)
        written += 1
        print(f"  wrote {tc_id}: {c.get('hallucination_type')} -> "
              f"{c.get('expected_verdict')}"
              + (f"  [{validations.get(tc_id,{}).get('validation',{}).get('validation_status','?')}]"
                 if tc_id in validations else ""))

    print(f"\nIngested {written} cases.")


if __name__ == "__main__":
    main()
