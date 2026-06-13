// Server-side Anthropic Messages API helper. Mirrors lib/verifier.py Prompt B.
// SCHEMA.md: faithfulness reasoning is claude-sonnet-4-6 (NON-NEGOTIABLE).
export const SONNET = "claude-sonnet-4-6";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export const PROMPT_B_SYSTEM = `You are a meticulous faithfulness checker. Given a CLAIM and the SOURCE TEXT it cites, decide whether the source faithfully supports the claim.

The claim may bundle MULTIPLE sub-assertions, and the source may support different parts in DIFFERENT places — evidence can be spread far apart, separated by unrelated text. Credit support found ANYWHERE in the source; never penalize a claim merely because the supporting facts are not adjacent. Evaluate each sub-assertion, then combine.

Check:
1. Is each sub-assertion of the claim supported, unsupported, or partially supported by the source (wherever the evidence sits)?
2. Are all caveats/qualifications in the source preserved (e.g. 'may', 'preliminary', hedges)?
3. Is the claim's confidence level consistent with the source (not overstated)?
4. NUMERIC FAITHFULNESS: every material figure in the claim (percentages, dollar amounts, dates, counts) must match the source. If ANY material figure contradicts the source, the claim is UNSUPPORTED — even if an adjacent figure happens to match. A fabricated headline number is not 'partial' support.
5. MODALITY: if the source frames something as a possibility, risk, or forward-looking hedge ('may', 'could', 'expected to', 'we believe') but the claim asserts it as an actual/present/certain fact, that is a stripped caveat or overstated confidence -> partially_supported (the topic is grounded but the modality is overstated). Do NOT return cannot_verify merely because the source hedges — the hedged source text IS the relevant evidence.
6. Which specific source text supports or contradicts each part?

Verdict rules:
- supported: every sub-assertion is fully and accurately backed by the source, wherever located.
- partially_supported: some sub-assertions are backed but at least one is absent from the source, OR a caveat is stripped / scope is expanded / confidence is overstated — with NO material figure contradicted.
- unsupported: the source contradicts the claim, ANY material number or direction differs, or the claim's central assertion is not in the source.
- cannot_verify: the source text is missing/insufficient to judge.

Return ONLY JSON: {"verdict": one of ["supported","partially_supported","unsupported","cannot_verify"], "confidence": one of ["high","medium","low"], "caveat_preserved": boolean, "source_excerpt": the exact source sentence(s) you anchored on, "notes": one or two sentences explaining the verdict}.`;

export interface FaithfulnessResult {
  verdict: "supported" | "partially_supported" | "unsupported" | "cannot_verify";
  confidence: "high" | "medium" | "low";
  caveat_preserved: boolean;
  source_excerpt: string;
  notes: string;
}

export async function callSonnet(
  system: string,
  user: string,
  maxTokens = 700
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: SONNET,
      max_tokens: maxTokens,
      temperature: 0,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("")
    .trim();
}

function extractJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  let candidate = fenced ? fenced[1] : text;
  if (!fenced) {
    const s = candidate.indexOf("{");
    const e = candidate.lastIndexOf("}");
    if (s === -1 || e === -1) throw new Error("no JSON in model response");
    candidate = candidate.slice(s, e + 1);
  }
  return JSON.parse(candidate);
}

const VERDICTS = ["supported", "partially_supported", "unsupported", "cannot_verify"];
const CONFS = ["high", "medium", "low"];

export async function faithfulnessCheck(
  claim: string,
  source: string
): Promise<FaithfulnessResult> {
  if (!source.trim()) {
    return {
      verdict: "cannot_verify",
      confidence: "high",
      caveat_preserved: false,
      source_excerpt: "",
      notes: "No source text provided to verify against.",
    };
  }
  const user = `CLAIM:\n${claim}\n\nSOURCE TEXT:\n${source}\n\nJudge faithfulness per the rules.`;
  const text = await callSonnet(PROMPT_B_SYSTEM, user, 700);
  const d = extractJson(text);
  const verdict = (VERDICTS.includes(d.verdict as string)
    ? d.verdict
    : "cannot_verify") as FaithfulnessResult["verdict"];
  const confidence = (CONFS.includes(d.confidence as string)
    ? d.confidence
    : "medium") as FaithfulnessResult["confidence"];
  return {
    verdict,
    confidence,
    caveat_preserved: Boolean(d.caveat_preserved),
    source_excerpt: (d.source_excerpt as string) ?? "",
    notes: (d.notes as string) ?? "",
  };
}
