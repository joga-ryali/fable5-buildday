#!/usr/bin/env python3
"""Resolve real EDGAR 10-K primary-document URLs for a set of companies.

Uses data.sec.gov submissions API (no key; needs a descriptive User-Agent).
Verifies each URL resolves (HTTP 200) and writes harness/filings.json — the
verified pool of real filings the corpus generator draws passages from.

NEVER invents SEC data: only emits URLs that returned 200.
"""
import os
import sys
import json
import time

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = os.environ.get("SEC_USER_AGENT", "Fable5 BuildDay joga@numici.com")
HEADERS = {"User-Agent": UA}

# CIK -> friendly name (well-known large filers, diverse sectors)
COMPANIES = {
    "0000320193": "Apple Inc.",
    "0000789019": "Microsoft Corporation",
    "0000019617": "JPMorgan Chase & Co.",
    "0000104169": "Walmart Inc.",
    "0000078003": "Pfizer Inc.",
    "0000021344": "The Coca-Cola Company",
    "0001018724": "Amazon.com, Inc.",
    "0000200406": "Johnson & Johnson",
}


def latest_10k(cik: str):
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    r = requests.get(url, headers=HEADERS, timeout=20)
    r.raise_for_status()
    recent = r.json()["filings"]["recent"]
    forms = recent["form"]
    for i, form in enumerate(forms):
        if form == "10-K":
            accession = recent["accessionNumber"][i].replace("-", "")
            doc = recent["primaryDocument"][i]
            fdate = recent["filingDate"][i]
            cik_int = int(cik)
            doc_url = (f"https://www.sec.gov/Archives/edgar/data/"
                       f"{cik_int}/{accession}/{doc}")
            return doc_url, fdate
    return None, None


def main():
    out = []
    for cik, name in COMPANIES.items():
        try:
            doc_url, fdate = latest_10k(cik)
            time.sleep(0.3)
            if not doc_url:
                print(f"  {name}: no 10-K found", file=sys.stderr)
                continue
            resp = requests.get(doc_url, headers=HEADERS, timeout=20, stream=True)
            code = resp.status_code
            resp.close()
            status = "resolved ✓" if code == 200 else f"HTTP {code}"
            print(f"  {name}: {status}  {doc_url}")
            if code == 200:
                out.append({
                    "company": name,
                    "cik": cik,
                    "filing": f"{name} 10-K (filed {fdate})",
                    "filing_date": fdate,
                    "source_url": doc_url,
                })
            time.sleep(0.3)
        except Exception as e:
            print(f"  {name}: ERROR {e}", file=sys.stderr)
    with open(os.path.join(ROOT, "harness", "filings.json"), "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nWrote {len(out)} verified filings to harness/filings.json")


if __name__ == "__main__":
    main()
