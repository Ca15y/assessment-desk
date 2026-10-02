# Demand Notice analysis and implementation plan

Status: source analysis, rule confirmation and implementation completed on 28 September 2026. Browser/PDF evidence and remaining physical printing are recorded in `docs/handoff.md`.

The owner requested adding a calculation-bearing station letter and explicitly requested questions and a plan before execution. The owner subsequently confirmed the formula, fixed rates and one-time application. The existing Best of Judgement letter and Note to Assessment remain manual. The original sample stays outside the repository. This document contains no taxpayer identities, case references, addresses or copied case amounts.

## Source findings

- The supplied Word document contains eleven Demand Notices. Despite its filename referring to assessment notices, the body has no separate Notice of Assessment template; the letters refer to an enclosed assessment notice.
- The document contains literal amounts, not embedded Word calculation fields or mathematical formulas. The calculation rule must be inferred and then confirmed by the owner.
- Eight notices match the candidate formula below. The first three have inconsistencies: the first has a penalty/rate mismatch, an interest mismatch and a total that does not equal its printed components; the second has a penalty inconsistent with its principal although its interest and total match the candidate formula; the third has inconsistent interest and total.
- The first notice uses one income year in its heading and a different year in the total-liability paragraph. Other notices cover consecutive and nonconsecutive years and multiple assessment issue dates.
- The wording first describes the assessment as final and conclusive, then later provides a further objection period. Some assessment issue dates equal the demand-letter date. These are questions for the owner, not permission to rewrite legal wording or infer eligibility rules.
- The source page settings are portrait US Letter (8.5 × 11 inches), not A4. Its top and side margins are 0.5 inch and its bottom margin is 0.4 inch. Most explicit text runs use 10 pt; Century Gothic and Arial appear. These are XML observations, not verified rendered pagination or station-printer clearance.
- No embedded images, tables or tracked changes were found. Source typography and full wording must be evaluated against the A4 requirement before export can be considered ready.

## Owner-confirmed calculation scope

Let P be the principal supplied by staff, r the penalty rate, and i the interest rate.

1. Penalty = P × r.
2. Interest = (P + penalty) × i.
3. Total payable = P + penalty + interest.

The owner confirmed r = 10% and i = 21%, both fixed, with interest applied once. Staff enter the outstanding principal; the app does not derive it from income, assessments or payment allocation. Each charge is rounded upward to the next kobo; interest uses the already-rounded penalty. Development levy remains code-only and is excluded from principal, charges and total. The station manager's name is an editable input and is saved per document. Do not implement a time factor, rate editing, current-rate lookup, recurring compounding or a fixed 1.331 multiplier. Preserve the supplied wording until the owner provides future corrections. These are owner-specified software rules, not independent legal validation.

A fictional illustration is principal NGN 1,000.00, penalty NGN 100.00, interest NGN 231.00 and total NGN 1,331.00. A rounding example is principal NGN 1.01, penalty NGN 0.11, interest NGN 0.24 and total NGN 1.36. Principal NGN 0.39 gives penalty NGN 0.04, interest NGN 0.10 and total NGN 0.53, proving interest uses the rounded penalty.

## Final clarifications resolved

1. The owner chose always upward: a calculated NGN 12.341 becomes NGN 12.35. Principal is entered at a maximum of two decimal places and is not rounded or inferred.
2. The owner chose the sample's code-only development-levy format, excluded from total. No levy amount was invented or copied from another template.
3. The owner explicitly requested an editable station manager name. This prints above the fixed STATION MANAGER and IGANMU TAX STATION lines and survives save/reopen.

Existing requirements continue to apply: one portrait A4 page, preprinted stationery for letters, explicit station codes/references/signatories, local-only processing and no taxpayer records in fixtures. Use the same entered years wherever referenced. Keep calculated outputs read-only within this requested automatic calculation scope; an override workflow or a separate assessment enclosure would require an additional request. No new legal eligibility rules will be inferred from the sample's wording or dates.

## Implementation sequence after clarification

1. Record the accepted scope and calculation specification in product, decisions and architecture documentation. Update AGENTS.md's manual-only rule narrowly for the new template, retaining it for the existing two. Define fictional examples with expected results and boundary cases before coding.
2. Add an isolated Demand Notice model and deterministic calculation function. Use decimal-safe arithmetic, explicit amount/rate validation and the agreed rounding order. Treat missing amounts as missing, not zero. Keep the original manual templates and their saved projects compatible.
3. Add the new form with the agreed inputs, a clear breakdown of principal, penalty, interest and total, and explicit handling of invalid calculations. Reuse one set of results wherever amounts appear in the letter. Invalidate the PDF after any relevant edit.
4. Add the approved wording to the PDF renderer. Use a font that renders the currency symbol correctly. Fit the full content within agreed A4 stationery clearance at a fixed approved font size; block overflow. If the wording does not fit, present that conflict to the owner before changing wording, clearances or font size. Never silently clip, shrink or add another export page.
5. Extend local JSON save/open with a calculation-rule version and all required inputs. Validate imports as data, reject tampered or inconsistent results and unsupported rules, and make calculation changes explicit on reopen. Choose the exact saved-result/recalculation policy in the approved specification so historic work cannot silently change.
6. Test arithmetic using fictional examples, rounding boundaries, missing/invalid values, any approved rate/date cases and save/reopen reproducibility. Run regression tests proving that both existing templates still preserve manual values. Download the new PDF in Chrome, verify text and one portrait A4 page, inspect the full rendering, and test overflow and stale-preview blocking.
7. Update docs/handoff.md after each completed milestone, distinguishing source analysis, approved rules, implementation, automated/browser verification and physical printer validation. Keep physical printing explicitly pending until the owner provides results.

## Implementation result

The new form, integer-kobo calculation, strict saved-project schema with calculation version 1, editable manager name, calculation breakdown and supplied-wording PDF are implemented. The UI and PDF use the same calculation function; computed fields cannot be overridden through an imported project. Existing manual templates and version-1 files are preserved.

The generated sample fits one portrait A4 page using the existing 48 mm top, 24 mm bottom and 14 mm side letter clearances, with Helvetica 9 pt and a local Noto Sans naira glyph. No text was removed and no font was automatically shrunk. Overflow remains blocked. Source text and XML were reviewed; the original DOCX was not visually rendered, and source typography fidelity is not claimed. Generated and browser-downloaded PDFs were rendered for visual inspection. No source records, original uploads or source font files were copied into the repository; the glyph font comes from the official open-source Noto repository with its licence.

See `docs/handoff.md` for current verification counts. Physical station-printer calibration remains pending. Future wording corrections require a new template version and renewed layout/overflow verification.
