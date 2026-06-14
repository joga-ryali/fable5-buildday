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

*This is the real ~5,400-character span from Apple's FY2023 10-K. The two facts that
support the claim — "total net sales **decreased** 3%" (first sentence) and "Services
net sales **increased** 9%" (last sentence) — bracket the entire segment, product,
buyback, and regional breakdown. Paste the whole thing; the engine resolves both ends.*

**Claim:**

In fiscal 2023, Apple's total net sales declined while its Services business continued to grow.

**Source:**

total net sales decreased 3% or $11.0 billion during 2023 compared to 2022. The weakness in foreign currencies relative to the U.S. dollar accounted for more than the entire year-over-year decrease in total net sales, which consisted primarily of lower net sales of Mac and iPhone, partially offset by higher net sales of Services. The Company announces new product, service and software offerings at various times during the year. Significant announcements during fiscal year 2023 included the following: First Quarter 2023: iPad and iPad Pro; Next-generation Apple TV 4K; and MLS Season Pass, a Major League Soccer subscription streaming service. Second Quarter 2023: MacBook Pro 14, MacBook Pro 16 and Mac mini; and Second-generation HomePod. Third Quarter 2023: MacBook Air 15, Mac Studio and Mac Pro; Apple Vision Pro, the Company's first spatial computer featuring its new visionOS, expected to be available in early calendar year 2024; and iOS 17, macOS Sonoma, iPadOS 17, tvOS 17 and watchOS 10, updates to the Company's operating systems. Fourth Quarter 2023: iPhone 15, iPhone 15 Plus, iPhone 15 Pro and iPhone 15 Pro Max; and Apple Watch Series 9 and Apple Watch Ultra 2. In May 2023, the Company announced a new share repurchase program of up to $90 billion and raised its quarterly dividend from $0.23 to $0.24 per share beginning in May 2023. During 2023, the Company repurchased $76.6 billion of its common stock and paid dividends and dividend equivalents of $15.0 billion. Macroeconomic Conditions Macroeconomic conditions, including inflation, changes in interest rates, and currency fluctuations, have directly and indirectly impacted, and could in the future materially impact, the Company's results of operations and financial condition. Apple Inc. | 2023 Form 10-K | 20 Segment Operating Performance The following table shows net sales by reportable segment for 2023, 2022 and 2021 (dollars in millions): 2023 Change 2022 Change 2021 Net sales by reportable segment: Americas $ 162,560 (4) % $ 169,658 11 % $ 153,306 Europe 94,294 (1) % 95,118 7 % 89,307 Greater China 72,559 (2) % 74,200 9 % 68,366 Japan 24,257 (7) % 25,977 (9) % 28,482 Rest of Asia Pacific 29,615 1 % 29,375 11 % 26,356 Total net sales $ 383,285 (3) % $ 394,328 8 % $ 365,817 Americas Americas net sales decreased 4% or $7.1 billion during 2023 compared to 2022 due to lower net sales of iPhone and Mac, partially offset by higher net sales of Services. Europe Europe net sales decreased 1% or $824 million during 2023 compared to 2022. The weakness in foreign currencies relative to the U.S. dollar accounted for more than the entire year-over-year decrease in Europe net sales, which consisted primarily of lower net sales of Mac and Wearables, Home and Accessories, partially offset by higher net sales of iPhone and Services. Greater China Greater China net sales decreased 2% or $1.6 billion during 2023 compared to 2022. The weakness in the renminbi relative to the U.S. dollar accounted for more than the entire year-over-year decrease in Greater China net sales, which consisted primarily of lower net sales of Mac and iPhone. Japan Japan net sales decreased 7% or $1.7 billion during 2023 compared to 2022. The weakness in the yen relative to the U.S. dollar accounted for more than the entire year-over-year decrease in Japan net sales, which consisted primarily of lower net sales of iPhone, Wearables, Home and Accessories and Mac. Rest of Asia Pacific Rest of Asia Pacific net sales increased 1% or $240 million during 2023 compared to 2022. The weakness in foreign currencies relative to the U.S. dollar had a significantly unfavorable year-over-year impact on Rest of Asia Pacific net sales. The net sales increase consisted of higher net sales of iPhone and Services, partially offset by lower net sales of Mac and iPad. Apple Inc. | 2023 Form 10-K | 21 Products and Services Performance The following table shows net sales by category for 2023, 2022 and 2021 (dollars in millions): 2023 Change 2022 Change 2021 Net sales by category: iPhone $ 200,583 (2) % $ 205,489 7 % $ 191,973 Mac 29,357 (27) % 40,177 14 % 35,190 iPad 28,300 (3) % 29,292 (8) % 31,862 Wearables, Home and Accessories 39,845 (3) % 41,241 7 % 38,367 Services 85,200 9 % 78,129 14 % 68,425 Total net sales $ 383,285 (3) % $ 394,328 8 % $ 365,817 iPhone iPhone net sales decreased 2% or $4.9 billion during 2023 compared to 2022 due to lower net sales of non-Pro iPhone models, partially offset by higher net sales of Pro iPhone models. Mac Mac net sales decreased 27% or $10.8 billion during 2023 compared to 2022 due primarily to lower net sales of laptops. iPad iPad net sales decreased 3% or $1.0 billion during 2023 compared to 2022 due primarily to lower net sales of iPad mini and iPad Air, partially offset by the combined net sales of iPad 9th and 10th generation. Wearables, Home and Accessories Wearables, Home and Accessories net sales decreased 3% or $1.4 billion during 2023 compared to 2022 due primarily to lower net sales of Wearables and Accessories. Services Services net sales increased 9% or $7.1 billion during 2023 compared to 2022 due to higher net sales across all lines of business.

**Expect:** `supported` · none — *the two supporting facts are ~5,400 characters apart, separated by the full segment/product/buyback breakdown; the engine anchors on both ends and confirms the claim. (This is the case embedding-similarity scorers false-negative on.) Verified `supported` in run_015 as tc_004.*

---

## To show `cannot_verify` ("I don't know" — the honest abstention)

Paste a real claim but a **source that doesn't address it**. The engine returns `cannot_verify` rather than guessing:

**Claim:**

Apple repurchased $90 billion of its common stock in fiscal 2023.

**Source:**

Services net sales increased 9% during 2023 compared to 2022.

**Expect:** `cannot_verify` — *the source says nothing about buybacks.*
