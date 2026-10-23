# B11 teach-back and progress (web)

School routes: `/learn/teach?practiceSessionId=…` (or `materialId=…`), `/learn/teach/[sessionId]`, `/learn/progress`. Adult F-L12-07 / F-L13-04 remain deferred to B24. This is an additive `/api/v1` integration; web transports through its authenticated same-origin `/api/learn` allowlist. No internal job routes are exposed. The existing adult `lib/api/progress.ts` remains separate from school `lib/api/learn-progress.ts`.

## Behavior

L12 has typed explanation, code-owned tap prompts for kids/tweens, one optional follow-up, and saved feedback. Voice is unavailable and repeats the server reason; no recording or listening control exists. Pending turns show Co thinking and never partial text. Polling uses 800/1200/1600 ms then 400 ms steps capped at 4 s; three transport failures stop polling with Check again. Terminal results never regress to pending from a late snapshot. An ambiguous send retains the original text/clientTurnId in actor/session-scoped sessionStorage and reuses both on retry; a definite refusal releases the id. Session creation also preserves its clientSessionId, and duplicate presses are locked. No auth credentials are stored by these components.

Kids see covered ticks and the server-owned Taught it! label, never a missed list. Tweens receive ticks and the follow-up. Teens receive covered/missed points, exam tip, and a practice link only when supplied by the server. Generated feedback is labelled AI; code-owned safety guidance is not labelled model output. Failed closed sessions keep the explanation visible; there is no invented retry endpoint.

L13 kids garden uses mastery stages without percentages or failure counts. Tween subject cards show seven days of completed practice-session activity and explicitly unavailable levels/badges (`Levels and badges arrive in a later release`, B17). Teen readiness is rendered only when supplied with ENOUGH evidence, otherwise the insufficient-evidence message appears. Mastery uses colour, icon and words. Practicing concepts form the measured weak spots, sorted by server rate, with optional server-owned practice targets. Co suggests is a separate card and unavailable suggestions preserve the server reason. Empty progress links to the library. CSV is visible only for teens with `export.available`; its header is checked before download. The API remains responsible for first-attempt selection, sample formula, consent, ownership and CSV authorisation.

## Contracts

`lib/api/teach-back.ts` validates literal false voice availability, READY-only reply data, uppercase disposition, generatedBy provenance, saved rubric partition, a maximum of one follow-up phase, and feedback with a saved result. Non-learning output has empty coverage and null follow-up. `lib/api/learn-progress.ts` rejects unexpected kids numeric fields and kid model percentages/failure counts, accepts teen attempt/rate evidence, and rejects readiness without sufficient evidence. `kids-metrics.ts` distinguishes learner text from model/product copy.

Platform DTO reconciliation was performed against the actual teach-back/progress service presenters, with additive server-owned fields coordinated with the platform owner. Missing source/practice targets are nullable and are never invented by the client. A null practice target suppresses that action; production practice navigation requires the platform to provide a valid scoped link.

## Development review

`/dev/teach?band=kids|tweens|teens&state=prompt|pending|follow-up|feedback|denied` and `/dev/progress?band=kids|tweens|teens&state=ready|insufficient|empty|suggestions|denied`. Add `dir=rtl` for direction review. These routes return 404 outside development. Their fixtures intercept only learner API transport and call no backend or model. They use the real screens, React Query hooks and validators. The harness displays all four approved Co identities through the existing state-to-variant mapping.

Playwright cases: `tests/visual/b11/teach-progress.spec.ts`, config `tests/visual/b11/b11-playwright.config.ts`. Run against an existing dev server with `B11_BASE_URL=http://localhost:3001 node node_modules/@playwright/test/cli.js test --config tests/visual/b11/b11-playwright.config.ts`. Output defaults to `/tmp/colearner-b11-web` (outside the Next root); override with an absolute `B11_OUTPUT_DIR`. Nine cases cover three bands, pending, follow-up, kid garden, tween activity/rewards, teen CSV/suggestions, and mobile RTL/empty/denied.

## Verification evidence

| Check | Evidence |
|---|---|
| Full Vitest regression (`node node_modules/vitest/vitest.mjs run --maxWorkers=2`) | **92 files / 1690 passed**, after a portability-only fix to two B07 complete-date assertions. Production formatting was unchanged. Log: `/tmp/colearner-b11-web-vitest-full.log`. |
| Final B11 checks | **4 files / 31 passed** after the last isolated entry-idempotency, source-evidence, fixture and strict-schema refinements. This overlaps the full run, rather than adding 31 to its total. |
| Types/lint | Full TypeScript and focused ESLint passed after the final B11 changes. |
| Backend wire review | Three passing source-transcribed presenter-boundary tests. They are not captured live API responses. Server-owned source/practice targets are accepted; null targets suppress actions. |
| Browser | Root manually exercised synthetic dev fixtures through CUA at 390×844, 768×1024 and 1280×900, including mobile RTL. Prompt/follow-up to saved feedback, source expansion, complete kid/partial teen feedback, no-partial-text pending, garden expansion, tween activity/rewards, teen readiness/suggestions and empty/denied/insufficient states passed. Root recorded 12 observations, including repeats after fixes, with zero console errors. |
| CSV scope | Export UI activated; downloaded-file completion was not independently captured. Client/header/proxy/schema tests passed. |
| Authored Playwright | Nine cases exist; the Playwright CLI suite was **not executed** in this turn. Manual CUA evidence is separate. |

Root evidence and screenshots: `colearner-workspace/Learning App Redesign/Implementation Plan/agents/evidence/B11/`, particularly `browser-checks.json`. The final integrated handoff is `agents/handoffs/B11-teach-back-progress-and-measurable-readiness.md` in the same plan.

The pnpm shim could not bootstrap its package-manager lockfile/identity in the restricted shell; installed local Node tool entry points ran the checks. The owned review server was stopped and its automatic tsconfig additions were removed. `.next-b11-review` is ignored to prevent Tailwind recursively scanning generated binary build artifacts.

Final review fixes preserved terminal merge semantics and gave the synthetic follow-up a distinct second turn. Fixtures now use complete kids/tweens coverage with Taught it and partial teen coverage with null effort; the client refuses Taught it while rubric points are missing. The learner interface keeps AI disclosure and current source evidence, with pack/prompt versions retained only in API audit state.

No real model, target database/worker/consent journey, production migration, deployment, commit, push or secret edit was performed. Live qualification remains a separate gate.
