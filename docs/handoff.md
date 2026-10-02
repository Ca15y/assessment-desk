# Handoff — updated 2 October 2026

## Current project

AssessmentDesk is the Iganmu station document preparation prototype. Read `docs/product.md` for accepted requirements and `AGENTS.md` for implementation rules.

Working features: four individual document forms, PDF preview/download, editable printer clearances, explicit JSON project save/open, and prescribed Excel batches for Notes to Assessment only. All processing runs locally in browser memory. No backend, analytics, automatic browser storage, credentials or real taxpayer records are included.

Best of Judgement, Note to Assessment and Assessment Notice amounts remain manually entered. Demand Notice alone calculates the owner-confirmed fixed 10% penalty and one-time 21% interest on principal plus rounded penalty, rounding each charge upward to the next kobo. Development levy remains code-only. Station manager names are editable inputs.

Every single-document export must be exactly one portrait A4 page. Excel batch export is all-or-nothing: invalid input, generation failure or overflow in any row blocks both combined PDF and individual PDF ZIP exports. The interface identifies affected spreadsheet rows. Legacy letter workbooks are rejected with guidance to use Single document. Version-1 Note to Assessment workbooks remain compatible.

## Verification carried forward

The current application passed `npm run check` (24 tests), `npm run build`, and `npx playwright test` (19 Chrome tests) on 2 October 2026 before public-release preparation. Checks cover manual-value preservation, demand arithmetic, saved-project round trips, one-page A4 output, overflow blocking, batch row order and all-or-nothing exports. Build output has known bundle-size and ineffective dynamic-import warnings.

Public-release preparation changes documentation and Git metadata only. Application source, package versions and lockfile are unchanged. The reviewed snapshot excludes the personal source-file path and uses a fresh history with GitHub's noreply commit identity. The original commit history is retained in a separate private archive. The public repository starts with this reviewed snapshot and a fresh commit history. Never merge or push the original private history into the public repository.

## Remaining milestones

Physical station-printer verification remains pending. Helvetica 9 pt is provisional and printer clearances require physical calibration. Source legal wording has not been independently revalidated. Editor authentication and template publication remain subsequent milestones; no pretend login control should be added. Ordinary staff accounts and subscriptions are later scope.

Run `npm ci` then `npm run dev`. No API key or paid AI service is required. No public application deployment has been performed.
