# Numici — Live Demo Examples (paste into `/live`)

**How to use:** paste the **Claim** into the top box, the **Source** into the bottom box, click **Check faithfulness**. (`/live` judges the claim against the source text you paste — it doesn't fetch — so paste the source.) All sources below are verbatim from real filings / opinions / official releases.

Each example notes the expected **verdict · defect** and what it demonstrates.

---

## Corporate Filings (SEC)

### ✅ Supported — accurate restatement

**Claim:**

Coca-Cola's net operating revenues increased 2% (by $880 million) to $47,941 million in 2025.

**Source:**

Net operating revenues were $47,941 million in 2025, compared to $47,061 million in 2024, an increase of $880 million, or 2%.

**Expect:** `supported` · none — *it confirms accurate claims, not just rejects.*

---

### ❌ Unsupported — numeric reconciliation (it does the math)

**Claim:**

Apple's total net sales declined about 8% in fiscal 2023 compared to 2022.

**Source:**

Total net sales were $383,285 million in fiscal 2023, compared to $394,328 million in fiscal 2022.

**Expect:** `unsupported` · numeric_mismatch — *the source gives only the base numbers; the engine computes (383,285 − 394,328)/394,328 = **−2.8%** and shows the calculation, so it flags the claimed 8%.*

---

### ⭐ Bonus — internal inconsistency

**Claim:**

Apple's Services net sales increased 19% or $7.1 billion in fiscal 2023 compared to 2022.

**Source:**

Services net sales increased 9% or $7.1 billion during 2023 compared to 2022 due to higher net sales across all lines of business.

**Expect:** `unsupported` · numeric_mismatch — *the $7.1B matches, but 19% ≠ 9%; a correct adjacent figure doesn't redeem a wrong headline number.*

---

## Law (case law)

### ✅ Supported — faithful holding

**Claim:**

Mapp v. Ohio held that evidence obtained in violation of the Constitution is inadmissible in state courts, applying the exclusionary rule to the states.

**Source:**

We hold that all evidence obtained by searches and seizures in violation of the Constitution is, by that same authority, inadmissible in a state court.

**Expect:** `supported` · none

---

### ❌ Unsupported — inverted holding (contradiction)

**Claim:**

In Obergefell v. Hodges, the Court held that the Fourteenth Amendment does NOT require states to license or recognize same-sex marriages.

**Source:**

The Fourteenth Amendment requires a State to license a marriage between two people of the same sex and to recognize a marriage between two people of the same sex when their marriage was lawfully licensed and performed out-of-State.

**Expect:** `unsupported` · contradiction — *the claim asserts the opposite of the holding.*

---

### ⭐ Bonus — domain-aware scope (over-generalized holding)

**Claim:**

Brown v. Board held that 'separate but equal' is invalid across all public facilities generally, not just in public education.

**Source:**

We conclude that, in the field of public education, the doctrine of 'separate but equal' has no place. Separate educational facilities are inherently unequal.

**Expect:** `unsupported` · scope_expansion — *in law, over-extending a holding past what the Court decided is material → unsupported, not a soft "partial."*

---

## Government Statistics

### ✅ Supported — accurate figure + period

**Claim:**

Real GDP grew at an annualized rate of 1.6 percent in Q1 2026, per the BEA second estimate.

**Source:**

Real gross domestic product (GDP) increased at an annual rate of 1.6 percent in the first quarter of 2026 (second estimate).

**Expect:** `supported` · none

---

### ❌ Unsupported — wrong direction (contradiction)

**Claim:**

Real GDP fell at an annualized rate of 1.6 percent in Q1 2026.

**Source:**

Real gross domestic product (GDP) increased at an annual rate of 1.6 percent in the first quarter of 2026.

**Expect:** `unsupported` · contradiction — *magnitude right, direction flipped.*

---

### ⭐ Bonus — numeric mismatch

**Claim:**

The U.S. unemployment rate (U-3) was 4.6 percent in May 2026.

**Source:**

Total nonfarm payroll employment increased by 172,000 in May, and the unemployment rate was unchanged at 4.3 percent, the U.S. Bureau of Labor Statistics reported.

**Expect:** `unsupported` · numeric_mismatch — *4.6% ≠ the reported 4.3%.*

---

## Showcase moments (the "wow")

### The subtle one — stripped caveat → partial (not a flat reject)

**Claim:**

Political uncertainty around trade disputes is reducing consumer confidence and spending and is adversely affecting Apple's business.

**Source:**

Political uncertainty surrounding trade and other international disputes could also have a negative effect on consumer confidence and spending, which could adversely affect the Company's business.

**Expect:** `partially_supported` · overstatement — *the source frames it as a possibility ("could"); the claim asserts it as present fact. Topic grounded, modality overstated → partial.*

---

### The HHEM-killer — distributed evidence → supported

**Claim:**

In fiscal 2023, Apple's total net sales declined while its Services business continued to grow.

**Source:**

The Company's total net sales decreased 3% or $11.0 billion during 2023 compared to 2022. iPhone, Mac, and iPad net sales each declined during the period. Services net sales increased 9% or $7.1 billion during 2023 compared to 2022 due to higher net sales across all lines of business.

**Expect:** `supported` · none — *two supporting facts sit apart in the source; the engine resolves both. (Embedding-similarity scorers false-negative here.)*

---

## To show `cannot_verify` ("I don't know" — the honest abstention)

Paste a real claim but a **source that doesn't address it**. The engine returns `cannot_verify` rather than guessing:

**Claim:**

Apple repurchased $90 billion of its common stock in fiscal 2023.

**Source:**

Services net sales increased 9% during 2023 compared to 2022.

**Expect:** `cannot_verify` — *the source says nothing about buybacks.*
