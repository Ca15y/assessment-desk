# AssessmentDesk — Iganmu

Local print-test prototype for Best of Judgement letters, Notes to Assessment, Demand Notices and Assessment Notices. Best of Judgement, Notes to Assessment and Assessment Notices keep all amounts manual. Demand Notices calculate a fixed 10% penalty, then one-time 21% interest on principal plus penalty, rounding each charge upward to the next kobo. Development levy is excluded from the total. Every PDF must fit on one portrait A4 page. Letters use preprinted stationery; notes use plain paper.

Repository: [Ca15y/assessment-desk](https://github.com/Ca15y/assessment-desk).

## Run locally

Use Node 22.12 or newer and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Load an example or clear the form. Update the preview after changing fields, then download the PDF. Select A4 and Actual size / 100% on the station printer.

Save project downloads an editable JSON file. Open project restores it. Generated PDFs and project files are different: keep the project to change details later, and keep the original PDF for identical historical printing.

Choose Demand Notice to enter outstanding principal and the current station manager's name. Penalty, interest and total are calculated; the manager name is editable and prints at the bottom. Saved demand projects preserve the input and calculation-rule version. Station codes and references remain explicit inputs. The supplied wording is retained pending future owner corrections.

Choose Assessment Notice to manually enter one tax liability amount, repeated in the notice's assessment and payment text. The sample agency and revenue codes are editable defaults. The station manager name is editable. The source letterhead, stamp and watermark are not included in the PDF.

Both letter templates start with the agency and revenue codes shown in the Iganmu sample. They remain editable, and Clear form restores those defaults. Opening a saved project preserves the codes in that file.

## Verify and build

```sh
npm run check
npm run build
```

With Google Chrome installed, also run the browser file checks:

```sh
npx playwright test
```

This starts the local server on port 5173 and checks PDF downloads, project save/reopen, manual-value preservation, invalid imports, overflow blocking and the phone layout. Fictional PDFs, JSON files and screenshots are written under the ignored `test-results/` directory, which is replaced on the next run. These checks do not verify physical printer alignment.

The build output is `dist/`, ready for future static hosting. No backend, keys or paid AI API are required for this milestone. No public deployment has been performed.

## What exists now

- Four responsive document forms; Best of Judgement, Note to Assessment and Assessment Notice retain manual amounts.
- A prescribed Excel batch workbook for Notes to Assessment only, with row-specific validation and all-or-nothing combined PDF or individual PDF ZIP exports.
- Demand Notice calculations with upward rounding and an editable station manager.
- Assessment Notice with a manually entered liability amount, editable sample codes and station manager.
- An actual generated PDF preview and download.
- Exact A4 dimensions and page-count-based overflow blocking.
- Adjustable top/bottom/side spacing for physical calibration.
- Schema-validated save/open project files, with values preserved.
- Fictional examples and portable automated checks.

## What still follows

Physical printer verification, editor authentication and template publication. Ordinary staff accounts, subscriptions and further calculations are later scope. The app does not validate tax law or derive principal tax assessments from income.

Provisional font: built-in Helvetica, 9 pt, instead of the reference's Century Gothic. Printer clearances are starting test values. Confirm physical output before operational use. The source letter wording is retained as supplied; do not treat this prototype as approval to issue it.

No original taxpayer records are included. Files are processed locally and not automatically retained in browser storage. Use fictional data for demonstration until the station has settled its data policy.

## AI handover

Read `AGENTS.md`, `docs/product.md` and `docs/handoff.md`. `CLAUDE.md` imports the same instructions. Code, requirements and test evidence are the handover record; the original chat is not required to run the project.
