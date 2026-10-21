# B06 web material workspace

Implementation date: 15 October 2026. Public API major stays **v1**. The locally packaged portable contract SDK is **@colearner/api-client 0.4.0**; its complete 0.3.0 auth, school and family clients are retained. No registry publish, deployment or database migration was performed by this web slice.

## Routes and product boundaries

- `/learn/library`: current authorized library, source/subject/status/search filters, card/list presentation, metadata and source icons, pagination, retry explanations, and permission-dependent bulk add-to-plan/delete with explicit deletion confirmation.
- `/learn/import`: configured source availability and reasons, current quota and file/text limits, subject and editable-plan choices, text and ordered multipart file requests. Accepted import IDs persist in the URL; reopening them polls product job records without submitting another import. Stable import/retry keys survive a failed request while the draft is unchanged. Unsent drafts stay in component memory and are not retained through a page reload.
- `/learn/snap`: explicit device-camera permission, environment-facing preference, upload fallback, manual page guide, locally measured brightness hint, real canvas crop/rotation, retake/accept, ordered multipage review and accessible reorder/delete controls. Camera tracks and object URLs are released on exit. Photos remain on the device until sending is permitted and requested.
- `/learn/library/:id`: current authorized source text and source-version metadata, with validated concept metadata kept separate from the original source.
- `/capture` and `/extract`: redirect into the new import flow. The learner navigation now opens the new library.
- Legacy public `/api/transcript` and `/api/article-text` POSTs return content-free **410** with the new import path. They make no external fetch and have no silent fallback. Their old callers remain in the retired capture components for later deletion; `/api/tutor` belongs to a later batch.

Only the new material pages use the `(materials)` route group. Existing dashboard, assigned-plan and teacher route gates are preserved. Server entry rechecks a selected B03 opaque child cookie through the real family child-context boundary, or applies the existing account entry gates. Child-cookie presence takes precedence; an empty/revoked selection never falls back to an adult session. Child shell navigation is limited to material tools and switching learner. Only a nonsecret school/profile cache scope reaches the browser. The B03 learner entry links the currently permitted profile to its material library.

`/api/materials/[[...path]]` is a transport-only Next.js boundary. It forwards only the allowlisted material operations to the fixed platform base URL, preserves multipart bytes/order, enforces same-origin writes and does not replay mutations. It reads the account credential and selected membership from existing server cookies, or forwards the selected opaque child credential with **no school selector**. Device/adult opaque credentials do not become child authority. The product API independently verifies every actor, school, learner, source, quota and action. Browser code receives no workload secret, execution grant or provider selector.

Response data is checked with local Zod boundary schemas that satisfy the portable SDK material interfaces. The SDK exports public configuration, source/status/stage, reader, import/retry and bulk request/receipt types. It imports no framework, provider, database or FormData runtime.

The SDK build and `packages/api-client/tsconfig.materials.json` consumer type fixtures pass from the platform workspace; the fixtures check a read-only view and reject learner/task selectors. The web consumes the local 0.4.0 vendor tarball with matching lock integrity. Existing auth, school and family runtime exports remain present.

## Truthful capability gates

Analysis readiness means the source and key ideas are ready. No lesson or practice control is enabled from that state; actual server artifact links are required. No browser inference, OCR, STT, direct model call or canned learning result is added.

Image/audio/external-link processing remains unavailable while the product/runtime qualification gates are closed. The UI shows the server's reason and refuses sending. Automatic face blurring is explicitly **unavailable**, rather than claimed from the camera preview. The page outline is a manual guide; the brightness hint does not claim automatic document detection or readability. Audio recording/transcription is not claimed available. Current school curriculum bands are kids, tweens and teens; no adult-production cohort is invented.

## Verification and local browser evidence

Focused tests live in `tests/integration/b06-materials.test.tsx`, `tests/unit/material-image.test.ts`, and `tests/unit/api/{materials,material-bff,material-access,b06-retired-sources}.test.ts`. Shared learner navigation and layout regressions are included in the final verification report.

After child-cookie support, the focused set has **26 distinct passing checks** across six files: the final serial aggregate passed 25 with one initial-load wait exceeding the default async threshold; the affected six-test UI file then passed fully with a bounded 10-second async wait. Earlier pre-child B06 plus shared-navigation regression passed **56/56**. A later broad run under process pressure had worker-start and old five-second shared-test timeouts; it is not counted as a passing aggregate. Opaque child/BFF precedence tests are among the passing focused checks.

Final whole-project web TypeScript checking and focused material ESLint pass after the child boundary and late B03 SDK export were reconciled. The SDK build/type fixtures also pass. Stale generated validators for the previous route-group location were removed from the verified generated cache path; no source page was weakened to satisfy those stale imports. A full production build and real authenticated browser/model journey are not claimed by this UI-only qualification.

Browser qualification is explicitly **UI-only**: `app/dev/materials` is unavailable outside development, displays an unavoidable synthetic-fixture notice, and needs Playwright HTTP fixtures. It does not qualify a live database, identity record or model. `tests/visual/b06` drives the actual components, including real browser canvas editing. `output/b06` contains phone/tablet/desktop screenshots and machine-readable viewport checks. All nine screen/viewport cases passed across focused runs (390/kids, 1024/tweens, 1440/teens). Leave/return, failed-request draft/key preservation, camera permission denial, upload/edit/reorder/delete and unavailable send controls also passed. Initial complete runs encountered local development asset aborts/invalid eval responses; the fixture runner buffers and bounds retries for the **unchanged real** large layout chunk. It does not replace application JavaScript. Those failed attempts are not reported as passing aggregates.

Use `COLEARNER_REVIEW_DIST_DIR=.next-b06-review` with the local dev server to isolate its generated files from concurrent review servers. The allowlist retains the existing B03 review directory. Generated directories are ignored; Next.js adds their generated-type includes. The local B06 browser server is stopped after qualification.

The platform/root handoff owns actual database/current-permission/provider qualification, app-owned job settlement, migration/rollback evidence and final batch status. This document does not turn UI fixtures or unavailable processors into production proof.
