# Accepted prototype scope

## Excel batch scope correction — 1 October 2026

The owner corrected the batch scope: Excel workbooks are needed only for Note to Assessment. Best of Judgement letters, Demand Notices and Assessment Notices remain available through their individual forms and PDF exports. Remove their workbook downloads and reject their legacy Excel workbooks with guidance to use Single document. The existing version-1 Note to Assessment workbook remains compatible.

Provide the prescribed Note to Assessment workbook and both export choices: combined PDF or individual PDFs in a ZIP. Export is all-or-nothing. Any invalid document, generation failure or document exceeding one portrait A4 page blocks both export choices for the whole batch until corrected and successfully revalidated. Identify affected spreadsheet rows and explain each error. Do not silently omit records or offer valid-rows-only export. All note figures remain manually entered, including gross income, tax, balances and totals. Preserve the existing single-document and saved-project workflows for all four templates.

Each populated spreadsheet row is one note. No fixed row cap is imposed; technical workbook size and ZIP safeguards apply. Formula cells are rejected. Physical station printing remains unverified. Business decisions not established by these requirements must be clarified with the owner before implementation.

The project is named AssessmentDesk, with the initial station shown as Iganmu. The owner requested that the all-four-template batch version be uploaded to GitHub before this correction, then the correction committed separately.

## Existing document requirements

Confirmed 28 September 2026: Best of Judgement letter and Note to Assessment; Iganmu; portrait A4; exactly one page per document; staff manually enter ALL amounts, including totals. These two templates remain fully manual.

Demand Notice is the third implemented template. Staff enter outstanding principal; penalty is a fixed 10% of principal, rounded upward to the next kobo; interest is a fixed 21% of principal plus the rounded penalty, applied once and rounded upward again. Total is principal plus the two rounded charges. Development levy remains code-only and is excluded from principal, charges and total. The station manager's name is editable per document and is preserved in saved projects. Supplied wording is retained until the owner provides corrections. See `docs/demand-notice-plan.md` for the confirmed rules and implementation record.

Assessment Notice is the fourth template, from a separate scanned sample. Staff manually enter one tax-liability amount; the same entered value appears twice and no calculations are performed. The agency and Direct Assessment revenue codes start with the sample values (`4250196 / 13054`, `4010002 / 32102`), remain editable, and return to those values on Clear form. Station manager name is editable. The scan's legal wording is transcribed; letterhead, watermark, ink stamp and footer are not embedded. See `docs/assessment-notice-plan.md`.

Demand principal accepts non-negative decimal amounts with up to two decimal places and optional correctly grouped commas. Blank, NIL, negative amounts, scientific notation and fractional-kobo inputs cannot be calculated or exported. The original entered principal is preserved in projects; its PDF representation is formatted to two decimal places. Calculated outputs are read-only. Years and assessment issue dates are explicit text inputs supporting multiple years/dates; the same entered years appear throughout the letter. Those inputs do not determine interest duration or legal eligibility.

This implementation includes working forms, actual PDF previews/downloads, downloadable project files, overflow detection, and the confirmed Excel batch imports/exports. Named editor accounts and template publishing remain required for the complete pilot. Ordinary staff accounts and payments remain later commercial features.

The source letter's legal wording is retained as supplied, with variable fields substituted. It has not been legally revalidated. The prototype uses built-in Helvetica as a portable provisional font; the source uses Century Gothic 9 pt. Font fidelity and physical printer offsets require owner review. Starting letter clearance is an adjustable prototype setting, not a measured guarantee.

The original source files remain outside the repository. Their identifying details must not be copied into fixtures. Notes may contain case-specific brief/company/conclusion text as explicit fields. Approved template wording is not casually editable in this prototype.

Blank, NIL and zero are distinct in the manual templates. No sums, tax rates or subtraction apply to those templates. The Demand Notice exception is limited to the confirmed formula above. No inferred agency codes or generated official reference numbers apply to any template. All six rows of the note's year table are entered by staff. Years are also entered, not fixed to the source examples.

Both letter templates start with the agency and revenue codes supplied in the Iganmu sample (13054, 4010002 / 32102, 4010014 / 32114). The fields remain editable, and Clear form restores these starter values. Opening a saved project preserves its saved codes. These defaults do not supply a document reference or signatory. Other demo values are fictional. Saved work stays a downloaded JSON project, with no automatic localStorage persistence. Final PDF export requires all required fields and exactly one rendered A4 page.

Acceptance: all four fictional examples export as one A4 page; long content blocks block export; the three manual templates preserve amounts without recomputation; Demand Notice preserves inputs and calculation-rule version and reproduces the same results on reopen; untrusted imports fail schema validation; changing forms invalidates a stale preview; physical station-printer alignment is a separate next step.
