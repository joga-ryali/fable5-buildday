# HHEM scoring endpoint (Modal)

Self-hosts **Vectara HHEM-2.1-Open** (Apache-2.0, CPU-only, ~600 MB) as an authenticated
`POST /score` endpoint on Modal, scale-to-zero. Build-day faithfulness scorer + the product path.

## Setup (your account + billing — the human step)

1. **Create a Modal account:** https://modal.com (free; includes monthly credits).
2. **Install + auth the CLI** (locally):
   ```bash
   pip install modal
   modal setup        # opens a browser to authenticate the CLI to your account
   ```
3. **Create the auth token** (also used by the caller). Generate one and store it as a Modal secret:
   ```bash
   TOKEN=$(openssl rand -hex 24)
   echo "save this: $TOKEN"
   modal secret create hhem-token HHEM_TOKEN=$TOKEN
   ```
4. **Deploy:**
   ```bash
   modal deploy app.py
   ```
   Modal prints a public URL like `https://<workspace>--hhem-hhem-score.modal.run`. Copy it.

## Tie into Vercel

In the Vercel project (`fable5-buildday`) → Settings → Environment Variables, add:
- `HHEM_ENDPOINT_URL` = the `https://...modal.run` URL from deploy
- `HHEM_ENDPOINT_TOKEN` = the same `$TOKEN` from step 3

Redeploy → the connectivity probe on the home page goes **green** (it does a GET → sees HTTP 405
from the POST-only endpoint → still proves reachability).

## Test scoring directly

```bash
curl -sX POST "<your-modal-url>" \
  -H 'content-type: application/json' \
  -d '{"token":"<TOKEN>","pairs":[
        ["The capital of France is Paris.","Paris is the capital of France."],
        ["The capital of France is Paris.","Berlin is the capital of France."]
      ]}'
# expect: {"scores":[<high>, <low>]}  e.g. ~[0.9x, 0.0x]
```

## Status — DEPLOYED & SMOKE-TESTED (2026-06-12)
- Live URL: `https://joga-ryali--hhem-hhem-score.modal.run`
- Verified: faithful pair → ~0.70, contradiction → ~0.01; wrong token → 401.

## Notes / gotchas (already resolved in app.py)
- **`transformers` MUST be pinned to `4.44.2`** — latest transformers throws
  `'HHEMv2ForSequenceClassification' object has no attribute 'all_tied_weights_keys'`
  (HHEM's trust_remote_code model predates the tied-weights refactor).
- **`fastapi[standard]` must be in the image** — newer Modal no longer auto-installs it for `@modal.fastapi_endpoint`.
- **CPU-only torch** (`index_url=https://download.pytorch.org/whl/cpu`) — HHEM needs no GPU; much smaller/faster build.
- First request after idle **cold-starts** (~30–60 s); subsequent calls are fast.
- HHEM score calibration runs lowish even for clear paraphrases (0.70 here) — the **contrast** is what matters;
  threshold tuning is build-day work. Argument order is `(premise=source, hypothesis=claim)`.
- The actual per-claim scoring calls are coded by Fable 5 during the build; this endpoint + contract is the target.
