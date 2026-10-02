# Assessment Notice implementation plan

Status: owner decisions confirmed; implementation, build, automated PDF checks and Chrome save/reopen verification completed on 29 September 2026. Physical printing remains pending.

Source: an owner-supplied one-page scanned Assessment Notice, retained outside the repository. No scanned taxpayer identifiers, name, address, reference or amounts have been copied into this repository.

## Source review

- Heading: “PERSONAL INCOME TAX MATTERS” and “ASSESSMENT NOTICE FOR [income year] INCOME YEAR”.
- Header fields: document reference and date; taxpayer name and address; payer ID; income year.
- Body: assessment narrative refers to Section 54 of PITA and Section 34(4) of NTAA 2025. It states a tax-liability amount and repeats that same amount in the payment instruction with a 30-day payment period.
- Payment details: “Agency Code” is shown as `4250196 / 13054` for Iganmu Tax Office. A single Direct Assessment revenue code is shown as `4010002 / 32102`. This sample has no Development Levy amount or revenue-code line.
- Remaining wording discusses failure to comply, interest and penalty, the right to object, additional assessments, false declarations, and a final priority request. These statements have no input-based formula in the sample and should be transcribed without adding calculations or rewriting them.
- Closing: “Yours faithfully,” followed by a named person and “STATION MANAGER.” The existing project requirement that signatories be explicit inputs applies; use an editable station manager name, not the sample person's identity or signature stamp.
- The scan includes Lagos State branding, a background watermark, an ink stamp/signature and a footer. Per project rules, export only the letter content onto preprinted letterhead; do not embed these scanned images or reproduce the stamp/signature. Use one portrait A4 page and block overflow without clipping or shrinking.
- The source is a raster scan, so its PDF page-box dimensions are scan-pixel dimensions rather than reliable evidence of the physical paper size or printer alignment.

## Owner decisions

1. Owner confirmed that staff manually enter the one assessed tax-liability amount. The app prints that same entered amount in both places, with no calculation.
2. Owner confirmed the sample revenue codes should behave like the defaults on the earlier templates: keep them as shown and editable. This template starts with agency code `4250196 / 13054` and Direct Assessment revenue code `4010002 / 32102`; Clear form restores these defaults. The sample has no Development Levy line.

## Implementation sequence after confirmation

1. Add the fourth template and a strict versioned data schema while preserving all existing saved projects.
2. Add fields for reference, date, income year, taxpayer name/address, payer ID, assessed tax amount, agency/revenue codes and station manager name. Initialize only confirmed code defaults; keep the reference, taxpayer data and manager name blank on a cleared form. Keep the manager name editable. Store values only through the explicit project download; no automatic persistence.
3. Reproduce the complete supplied notice wording around the single entered tax amount. Do not calculate anything. Apply the project’s default codes only after owner confirmation.
4. Render content only, leaving actual logo, footer, watermark and signature stamp to preprinted stationery. Enforce exactly one portrait A4 page at fixed font size; block overflow.
5. Check schema/import compatibility and save/reopen behavior, produce a fictional one-page PDF, inspect the full rendering, and verify exact A4 page size and value preservation. Update the handoff with tested results and keep physical printer alignment pending.

## Implementation status

Implemented as the fourth template with manual amount entry, strict saved-project validation, sample code defaults, editable station manager, and sample legal text. The PDF excludes the sample letterhead, watermark, ink stamp and footer and uses the shared portrait A4 overflow gate. The example uses fictional values. `npm run build`, `npm run check` (17 passed), and `npx playwright test` (15 passed) succeeded. Chrome save/reopen preserved entered values; the downloaded notice contains the same liability twice and is exactly one portrait A4 page (595.28 × 841.89 pt). The PDF was visually inspected. Clear form restores the confirmed sample codes. Physical printing is pending.
