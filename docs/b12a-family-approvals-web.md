# B12A web: guardian approval of pending enrolments

Contract: `colearner-workspace/Learning App Redesign/Implementation Plan/agents/contracts/B12A-guardian-enrolment-approval.md`.
Features: F-P4-01, F-P4-03 (approve/decline), F-P4-04, F-P4-05, F-P4-06, F-P4-08. Deferred: F-P4-02, F-P4-07.

## Routes and files
- `/family/approvals` (Pending / History tabs) and `/family/approvals/[requestId]` (who / what / why / what changes / history).
- `components/family/approvals/**`, `lib/api/family-approvals.ts` (Zod schemas, client, `IntentKeys`), BFF `app/api/family-approvals/[[...path]]` (handler in `lib/api/family-approvals-route.ts`).
- `/family` shows a "Requests and approvals" link with the pending count (`approvals-entry.tsx`).
- Learner: `pendingEnrollments[].status` may be `DECLINED`; the overview shows "Your parent said no to this plan" with no link.
- Dev harness: `/dev/family/approvals?scenario=default|empty|denied|unavailable|invalid|flaky-decision|already-decided|policy-blocked|superseded-on-decide|not-found&screen=list|detail|entry&dir=rtl` (development only).

## BFF
Exact allowlist: GET list (`state=pending|history`), `summary`, `:uuid`; POST `:uuid/decision` and `:uuid/revoke`. Token comes from the Auth.js session server side. POST needs same-origin and an `Idempotency-Key` (8-128 chars), forwarded to `/api/v1/family/approvals/...`. Errors relay only `code` and, for 409, the recorded `request`.

## Idempotency
One key per (request, intent), kept across retries of a failed send and dropped only after a definitive answer.

## Checks
`pnpm type-check`, `pnpm lint` (0 errors), `vitest run tests/unit/b12a tests/integration/b12a-*.test.tsx`, `playwright test -c tests/visual/b12a/approvals-playwright.config.ts` (system Chrome, dev server :3001), real API: `B12_REAL_API=1 B12_REUSE_AUTH=1 pnpm exec playwright test -c playwright.b12-real.config.ts`.
