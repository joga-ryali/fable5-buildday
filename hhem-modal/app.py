# Serves Vectara HHEM-2.1-Open (Apache-2.0) as an authenticated scoring endpoint on Modal.
#
# One-time setup (see README.md in this folder):
#   pip install modal
#   modal setup                                  # auth the CLI to your account (opens browser)
#   modal secret create hhem-token HHEM_TOKEN=<your-random-token>
#   modal deploy app.py                          # prints the public https://...modal.run URL
#
# Contract (the scoring call Fable 5 will code tomorrow):
#   POST <url>   body: {"token": "<same token>", "pairs": [["premise","hypothesis"], ...]}
#   ->           {"scores": [0.0..1.0, ...]}   (higher = more faithful/grounded)
#
# The Vercel connectivity probe does a GET; this endpoint is POST-only, so the probe will
# see HTTP 405 — that still proves reachability and shows GREEN. That's expected.

import modal

MODEL = "vectara/hallucination_evaluation_model"


def _download():
    # Runs at image-build time so model weights are baked in → fast cold starts.
    from transformers import AutoModelForSequenceClassification

    AutoModelForSequenceClassification.from_pretrained(MODEL, trust_remote_code=True)


image = (
    modal.Image.debian_slim(python_version="3.11")
    # CPU-only torch (HHEM needs no GPU) — far smaller/faster than the default CUDA build.
    .pip_install("torch", index_url="https://download.pytorch.org/whl/cpu")
    # Pin transformers: HHEM's trust_remote_code model predates the newer tied-weights
    # refactor (the `all_tied_weights_keys` AttributeError on latest transformers).
    .pip_install("transformers==4.44.2", "sentencepiece", "fastapi[standard]")
    .run_function(_download)
)

app = modal.App("hhem")


@app.cls(
    image=image,
    cpu=2,
    memory=4096,
    secrets=[modal.Secret.from_name("hhem-token")],
    # Modal scales to zero automatically after idle (no GPU; CPU-only model).
)
class HHEM:
    @modal.enter()
    def load(self):
        from transformers import AutoModelForSequenceClassification

        self.model = AutoModelForSequenceClassification.from_pretrained(
            MODEL, trust_remote_code=True
        )

    @modal.fastapi_endpoint(method="POST")
    def score(self, data: dict):
        import os
        from fastapi import HTTPException

        if data.get("token") != os.environ["HHEM_TOKEN"]:
            raise HTTPException(status_code=401, detail="unauthorized")

        pairs = [(p[0], p[1]) for p in data.get("pairs", [])]
        if not pairs:
            return {"scores": []}

        scores = self.model.predict(pairs)
        return {"scores": [float(s) for s in scores]}
