#!/usr/bin/env python3
"""
lib/verifier.py — Shared verification core for the Citation Faithfulness system.

Contract: SCHEMA.md. Read it before changing anything here.

Pipeline (per SCHEMA §5):
  Stage 1  extract (claim, citation) pairs + resolve citation URL   [Haiku | Perplexity]
  Stage 2  Prompt A: citation<->claim match                          [Sonnet, sequential]
           Prompt B: faithfulness check                              [Sonnet, sequential]

Model assignment is NON-NEGOTIABLE:
  - Faithfulness / citation-match reasoning -> claude-sonnet-4-6
  - Extraction / resolution                 -> claude-haiku-4-5-20251001 (default)
                                               or Perplexity sonar (optional)
  Prompt A and Prompt B are two SEPARATE sequential Sonnet calls. Never merged.

This module never logs key values. It loads keys via manage_keys.load_keys_for_agent().
"""

from __future__ import annotations

import os
import re
import sys
import json
import time
from datetime import datetime, timezone

import requests

# --- key loading -------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from manage_keys import load_keys_for_agent
    load_keys_for_agent()
except Exception as e:  # pragma: no cover - presence only, never values
    print(f"WARNING: key load failed: {e}", file=sys.stderr)

# --- model constants (locked) ------------------------------------------------
SONNET = "claude-sonnet-4-6"
HAIKU = "claude-haiku-4-5-20251001"
PERPLEXITY_MODEL = "sonar"

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions"

SEC_USER_AGENT = os.environ.get("SEC_USER_AGENT", "Fable5 BuildDay joga@numici.com")

RESOLVE_TIMEOUT = 6  # seconds; resolution is informational (we judge against the
# provided source text), so fail fast on slow/blocking hosts to keep batches quick.


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


# --- low-level Anthropic call with one rate-limit retry ----------------------
class VerifierError(RuntimeError):
    pass


def call_anthropic(model: str, system: str, user: str,
                   max_tokens: int = 1024, temperature: float = 0.0) -> str:
    """POST to the Anthropic Messages API. One 60s retry on 429/529 (SCHEMA §5).

    Returns the concatenated text content. Raises VerifierError on hard failure.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise VerifierError("ANTHROPIC_API_KEY not set")

    headers = {
        "x-api-key": api_key,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
    }
    body = {
        "model": model,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }

    # Up to 3 attempts. Transient network errors (read timeouts) retry with
    # backoff so infra blips don't masquerade as cannot_verify; rate limits
    # (429/529) wait 60s; other HTTP errors fail fast.
    last_err = "unknown"
    for attempt in (1, 2, 3):
        try:
            resp = requests.post(ANTHROPIC_URL, headers=headers,
                                 json=body, timeout=90)
        except requests.RequestException as e:
            last_err = f"network error: {e}"
            if attempt < 3:
                time.sleep(2 * attempt)
                continue
            break

        if resp.status_code == 200:
            data = resp.json()
            return "".join(
                b.get("text", "") for b in data.get("content", [])
                if b.get("type") == "text"
            ).strip()

        # rate limited / overloaded -> wait 60s and retry (up to the attempt cap)
        if resp.status_code in (429, 529):
            last_err = f"HTTP {resp.status_code}"
            if attempt < 3:
                print(f"  rate-limited ({resp.status_code}) on {model}; waiting 60s",
                      file=sys.stderr)
                time.sleep(60)
                continue
            break

        raise VerifierError(f"Anthropic {model} HTTP {resp.status_code}: "
                            f"{resp.text[:300]}")

    raise VerifierError(f"Anthropic {model} failed after 3 attempts ({last_err})")


def _extract_json(text: str) -> dict:
    """Pull the first JSON object out of a model response (handles ```json fences)."""
    if not text:
        raise VerifierError("empty model response")
    # strip code fences
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    candidate = fenced.group(1) if fenced else text
    # else first balanced-looking object
    if not fenced:
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start == -1 or end == -1:
            raise VerifierError(f"no JSON object in response: {text[:200]}")
        candidate = candidate[start:end + 1]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError as e:
        raise VerifierError(f"bad JSON from model: {e}; raw={text[:200]}")


# --- Stage 1: extraction + citation resolution -------------------------------
EXTRACT_SYSTEM = (
    "You extract (claim, citation) pairs from a research report excerpt. "
    "A claim is a discrete factual assertion. A citation is the verbatim source "
    "reference attached to it (e.g. 'Apple 10-K FY2023, p.12'). "
    "Return ONLY JSON: {\"pairs\": [{\"claim\": str, \"citation\": str}]}. "
    "Return citations exactly as written. Do not judge the claims."
)


def stage1_extract(report_text: str, model: str = HAIKU) -> list[dict]:
    """Extract (claim, citation) pairs. Default Haiku; Perplexity optional.

    On any Perplexity friction, callers should pass model=HAIKU (SCHEMA §1).
    """
    user = f"Report excerpt:\n\n{report_text}\n\nExtract all (claim, citation) pairs."
    if model == PERPLEXITY_MODEL:
        text = _call_perplexity(EXTRACT_SYSTEM, user)
    else:
        text = call_anthropic(model, EXTRACT_SYSTEM, user, max_tokens=1024)
    data = _extract_json(text)
    return data.get("pairs", [])


def _call_perplexity(system: str, user: str) -> str:
    """Optional Stage-1 path. Raises so callers fall back to Haiku on friction."""
    api_key = os.environ.get("PERPLEXITY_API_KEY")
    if not api_key:
        raise VerifierError("PERPLEXITY_API_KEY not set")
    resp = requests.post(
        PERPLEXITY_URL,
        headers={"Authorization": f"Bearer {api_key}",
                 "content-type": "application/json"},
        json={"model": PERPLEXITY_MODEL,
              "messages": [{"role": "system", "content": system},
                           {"role": "user", "content": user}]},
        timeout=60,
    )
    if resp.status_code != 200:
        raise VerifierError(f"Perplexity HTTP {resp.status_code}")
    return resp.json()["choices"][0]["message"]["content"].strip()


def resolve_citation(source_url: str | None) -> str:
    """Attempt to resolve a citation URL. Returns a citation_resolution_status
    string per SCHEMA: resolved | 404 | paywalled | timeout | malformed.
    """
    if not source_url or not isinstance(source_url, str):
        return "malformed"
    if not source_url.lower().startswith(("http://", "https://")):
        return "malformed"
    try:
        resp = requests.get(
            source_url,
            headers={"User-Agent": SEC_USER_AGENT},
            timeout=RESOLVE_TIMEOUT,
            stream=True,
        )
    except requests.Timeout:
        return "timeout"
    except requests.RequestException:
        return "malformed"
    finally:
        pass
    code = resp.status_code
    try:
        resp.close()
    except Exception:
        pass
    if code == 200:
        return "resolved"
    if code == 404:
        return "404"
    if code in (403, 429, 451):
        # host refused the automated fetch (bot-blocked / rate-limited / legal)
        return "blocked"
    if code in (401, 402):
        return "paywalled"
    # any other non-200 host response: treat as malformed/unresolved
    return "malformed"


# --- Stage 2: Sonnet Prompt A (citation match) -------------------------------
PROMPT_A_SYSTEM = (
    "You judge whether a citation logically supports a specific claim — i.e. is "
    "this the RIGHT KIND of source for this claim, and does the cited document "
    "plausibly pertain to it. You are NOT yet judging factual accuracy of the "
    "claim against the source text; only whether the citation is an appropriate "
    "match for the claim. "
    "Return ONLY JSON: {\"verdict\": one of "
    "[\"correct_citation\",\"mismatch\",\"cannot_determine\"], "
    "\"explanation\": one sentence}."
)


def prompt_a_citation_match(claim: str, citation: str,
                            source_excerpt: str | None = None) -> dict:
    parts = [f"Claim: {claim}", f"Citation: {citation}"]
    if source_excerpt:
        parts.append(f"Cited source text:\n{source_excerpt}")
    user = "\n\n".join(parts) + "\n\nDoes this citation support this claim?"
    text = call_anthropic(SONNET, PROMPT_A_SYSTEM, user, max_tokens=300)
    data = _extract_json(text)
    v = data.get("verdict")
    if v not in ("correct_citation", "mismatch", "cannot_determine"):
        v = "cannot_determine"
    return {"verdict": v, "explanation": data.get("explanation", "")}


# --- Stage 2: Sonnet Prompt B (faithfulness) ---------------------------------
PROMPT_B_SYSTEM = (
    "You are a meticulous faithfulness checker. Given a CLAIM and the SOURCE TEXT "
    "it cites, decide whether the source faithfully supports the claim.\n\n"
    "The claim may bundle MULTIPLE sub-assertions, and the source may support "
    "different parts in DIFFERENT places — evidence can be spread far apart, "
    "separated by unrelated text. Credit support found ANYWHERE in the source; "
    "never penalize a claim merely because the supporting facts are not adjacent. "
    "Evaluate each sub-assertion, then combine.\n\n"
    "Check:\n"
    "1. Is each sub-assertion of the claim supported, unsupported, or partially "
    "supported by the source (wherever the evidence sits)?\n"
    "2. Are all caveats/qualifications in the source preserved (e.g. 'may', "
    "'preliminary', hedges)?\n"
    "3. Is the claim's confidence level consistent with the source (not overstated)?\n"
    "4. NUMERIC FAITHFULNESS: every material figure in the claim (percentages, "
    "dollar amounts, dates, counts) must match the source. If ANY material figure "
    "contradicts the source, the claim is UNSUPPORTED — even if an adjacent figure "
    "happens to match. A fabricated headline number is not 'partial' support.\n"
    "4b. NUMERIC RECONCILIATION: if the claim states a DERIVED figure (a % change, "
    "growth rate, margin, ratio, or total) and the source provides the BASE numbers, "
    "COMPUTE the derived value from those base numbers yourself, SHOW the calculation "
    "in your notes (e.g. 'computed (383,285 − 394,328) / 394,328 = -2.8%'), and "
    "compare it to the claim. If the claimed figure does not match your computed "
    "value (beyond rounding), defect=numeric_mismatch and verdict=unsupported; if it "
    "matches, that part is supported.\n"
    "5. MODALITY: if the source frames something as a possibility, risk, or "
    "forward-looking hedge ('may', 'could', 'expected to', 'we believe') but the "
    "claim asserts it as an actual/present/certain fact, that is a stripped caveat "
    "or overstated confidence → partially_supported (the topic is grounded but the "
    "modality is overstated). Do NOT return cannot_verify merely because the source "
    "hedges — the hedged source text IS the relevant evidence. NOTE: asserting the "
    "DIRECT OPPOSITE of a hedge (e.g. source says 'preliminary, subject to change' "
    "but the claim says 'final, will not change') is a CONTRADICTION → unsupported, "
    "not partial.\n"
    "6. ATTRIBUTION: if a RESOLVED SOURCE line is provided and the claim attributes "
    "the information to a different fiscal year, reporting period, filing, author, "
    "or company than the resolved source, that is a citation/attribution mismatch → "
    "unsupported, even if the underlying figures themselves match the source text.\n"
    "7. Which specific source text supports or contradicts each part?\n\n"
    "Verdict rules:\n"
    "- supported: every sub-assertion is fully and accurately backed by the source, "
    "wherever located.\n"
    "- partially_supported: some sub-assertions are backed but at least one is "
    "absent from the source, OR a caveat is stripped / scope is expanded / "
    "confidence is overstated — with NO material figure contradicted.\n"
    "- unsupported: the source contradicts the claim, ANY material number or "
    "direction differs, or the claim's central assertion is not in the source.\n"
    "- cannot_verify: the source text is missing/insufficient to judge.\n\n"
    "Also classify the PRIMARY defect — the main kind of distortion (one only):\n"
    "- none: fully supported, no distortion.\n"
    "- numeric_mismatch: a material figure (%, $, date, count) does not match the source.\n"
    "- contradiction: the claim asserts the opposite of, or is directly contradicted "
    "by, the source — a reversed trend/figure direction, a negated holding, or any X "
    "stated as not-X.\n"
    "- wrong_attribution: attributed to a different year/period/filing/company than the source.\n"
    "- overstatement: the claim is stronger or more certain than the source — a "
    "dropped hedge/qualifier, tentative language stated as certain, or intensified "
    "severity (covers both stripped caveats and overstated confidence).\n"
    "- scope_expansion: a subset/segment/period finding generalized to the whole.\n"
    "- unsupported_addition: a sub-assertion in the claim is absent from the source.\n\n"
    "Use 'none' ONLY when verdict is 'supported'. If verdict is partially_supported, "
    "unsupported, or cannot_verify, defect_type MUST be one of the specific types "
    "above (never 'none') — identify the primary distortion.\n\n"
    "Return ONLY JSON: {\"verdict\": one of "
    "[\"supported\",\"partially_supported\",\"unsupported\",\"cannot_verify\"], "
    "\"defect_type\": one of [\"none\",\"numeric_mismatch\",\"contradiction\","
    "\"wrong_attribution\",\"overstatement\","
    "\"scope_expansion\",\"unsupported_addition\"], "
    "\"confidence\": one of [\"high\",\"medium\",\"low\"], "
    "\"caveat_preserved\": boolean, "
    "\"source_excerpt\": the exact source sentence(s) you anchored on, "
    "\"notes\": one or two sentences explaining the verdict}."
)

DEFECT_TYPES = {
    "none", "numeric_mismatch", "contradiction", "wrong_attribution",
    "overstatement", "scope_expansion",
    "unsupported_addition", "fabricated_citation",
}

# Normalize legacy/variant labels the model may still emit to the current vocabulary.
_DEFECT_ALIAS = {
    "overstated_confidence": "overstatement",
    "stripped_caveat": "overstatement",
    "numeric_error": "numeric_mismatch",
    "wrong_directionality": "contradiction",
}


def prompt_b_faithfulness(claim: str, source_excerpt: str | None,
                          source_label: str | None = None) -> dict:
    if not source_excerpt:
        return {
            "verdict": "cannot_verify",
            "confidence": "high",
            "caveat_preserved": False,
            "source_excerpt": "",
            "notes": "No resolvable source text available to verify against.",
        }
    attribution = (f"RESOLVED SOURCE (the cited filing resolves to): {source_label}\n\n"
                   if source_label else "")
    user = (f"{attribution}CLAIM:\n{claim}\n\nSOURCE TEXT:\n{source_excerpt}\n\n"
            "Judge faithfulness per the rules.")
    text = call_anthropic(SONNET, PROMPT_B_SYSTEM, user, max_tokens=700)
    data = _extract_json(text)
    v = data.get("verdict")
    if v not in ("supported", "partially_supported", "unsupported", "cannot_verify"):
        v = "cannot_verify"
    conf = data.get("confidence")
    if conf not in ("high", "medium", "low"):
        conf = "medium"
    defect = _DEFECT_ALIAS.get(data.get("defect_type"), data.get("defect_type"))
    if defect not in DEFECT_TYPES:
        defect = "none" if v == "supported" else "unsupported_addition"
    if v == "supported":
        defect = "none"
    return {
        "verdict": v,
        "defect_type": defect,
        "confidence": conf,
        "caveat_preserved": bool(data.get("caveat_preserved", False)),
        "source_excerpt": data.get("source_excerpt", "") or "",
        "notes": data.get("notes", "") or "",
    }


# --- Orchestrator: verify one claim ------------------------------------------
def verify_claim(claim: str,
                 citation: str | None,
                 source_url: str | None,
                 source_excerpt: str | None,
                 *,
                 source_label: str | None = None,
                 stage1_model: str = HAIKU,
                 do_resolve: bool = True) -> dict:
    """Run the full pipeline for a single (claim, citation, source) tuple.

    Returns a partial result dict (SCHEMA §4 result file, minus run-level fields
    test_case_id/run_id/timestamp/app_version/ground_truth_verdict/pass which the
    batch runner adds). Failure modes are never silent.

    source_excerpt is the resolved source content the faithfulness check reasons
    over. In the harness this is the true filing passage (ground_truth.original_text)
    for resolvable citations; resolution of the live URL is checked independently to
    catch fabricated/corrupted citations. For /live, the user supplies it directly.
    """
    result = {
        "sonnet_model": SONNET,
        "haiku_model": stage1_model,
        "citation_resolution_status": "resolved",
        "citation_match_verdict": "cannot_determine",
        "verdict": "cannot_verify",
        "defect_type": "none",
        "confidence": "medium",
        "source_excerpt": source_excerpt or "",
        "caveat_preserved": False,
        "notes": "",
    }

    # Stage 1 resolution (real URL check — catches fabricated/corrupt citations).
    # Short-circuit to cannot_verify ONLY when resolution fails AND we have no
    # source text to judge against (true fabrication / unretrievable). When the
    # cited source text IS available, proceed to faithfulness and keep the
    # resolution status as a recorded signal — many real sources (e.g. legal
    # databases) block automated fetches even though the citation is genuine.
    if do_resolve:
        status = resolve_citation(source_url)
        result["citation_resolution_status"] = status
        if status != "resolved" and not source_excerpt:
            result["verdict"] = "cannot_verify"
            result["defect_type"] = (
                "fabricated_citation" if status in ("404", "malformed") else "none"
            )
            result["confidence"] = "high"
            blocked_hint = (
                " The source host blocked automated retrieval; if you have access, "
                "upload the source text to enable the faithfulness check."
                if status == "blocked" else ""
            )
            result["notes"] = (
                f"Citation could not be resolved (status: {status}) and no source "
                f"text is available to verify against.{blocked_hint}"
            )
            return result
    else:
        result["citation_resolution_status"] = "resolved"

    # Stage 2 Prompt A — citation match (Sonnet)
    if citation:
        try:
            a = prompt_a_citation_match(claim, citation, source_excerpt)
            result["citation_match_verdict"] = a["verdict"]
        except VerifierError as e:
            result["notes"] = f"Prompt A error: {e}"
            result["citation_match_verdict"] = "cannot_determine"

    # Stage 2 Prompt B — faithfulness (Sonnet), sequential after A
    try:
        b = prompt_b_faithfulness(claim, source_excerpt, source_label=source_label)
    except VerifierError as e:
        result["verdict"] = "cannot_verify"
        result["confidence"] = "low"
        result["notes"] = f"Prompt B error: {e}"
        return result

    result["verdict"] = b["verdict"]
    result["defect_type"] = b["defect_type"]
    result["confidence"] = b["confidence"]
    result["caveat_preserved"] = b["caveat_preserved"]
    result["source_excerpt"] = b["source_excerpt"] or (source_excerpt or "")
    note = b["notes"]
    if result["citation_match_verdict"] == "mismatch" and result["verdict"] == "supported":
        note = (note + " (Note: Prompt A flagged a citation mismatch.)").strip()
    if result["citation_resolution_status"] != "resolved":
        note = (
            note + f" [Source host restricted automated retrieval (status: "
            f"{result['citation_resolution_status']}); verified against the provided "
            f"source text. In production the analyst can upload the source.]"
        ).strip()
    result["notes"] = note
    return result


if __name__ == "__main__":
    # Smoke test: presence of keys + a trivial faithfulness call.
    print("ANTHROPIC_API_KEY:", "set ✓" if os.environ.get("ANTHROPIC_API_KEY") else "NOT set")
    print("PERPLEXITY_API_KEY:", "set ✓" if os.environ.get("PERPLEXITY_API_KEY") else "NOT set")
    demo = prompt_b_faithfulness(
        claim="Revenue grew 18% year over year.",
        source_excerpt="Total net sales increased 8% in fiscal 2023 compared to fiscal 2022.",
    )
    print(json.dumps(demo, indent=2))
