# B08 web lesson player and read-aloud (WL)

Implementation date: 19 October 2026. API stays **/api/v1**. The platform lesson module (agents LD/BR) and the AI pack (AI) were being built in parallel, so this slice is written to `agents/contracts/B08-contracts.md` and verified with **mocked HTTP only** (a test double that follows the contract). No git commit, migration, deployment or model call was made, and nothing here proves the live platform, permissions or model behaviour.

## Routes

| Route | What it does | Code |
|---|---|---|
| `/learn/lesson/new?materialId=…[&planItemId=…]` | Asks for the lesson (idempotent get-or-create, one request even under React dev double-mount), then `router.replace` to the lesson. Typed refusals are shown in plain words. | `components/lesson/lesson-screen.tsx` (`LessonStartScreen`), `app/(learn)/learn/lesson/new/page.tsx` |
| `/learn/lesson/[lessonId]` | Loads the lesson, polls with backoff while QUEUED/RUNNING (survives refresh), then shows generating, failed, stopped, hidden, the player, or the finished card. | `LessonScreen`, `LessonView`, `app/(learn)/learn/lesson/[lessonId]/page.tsx` (+ `loading.tsx`, `error.tsx`) |
| `/dev/lesson` | Development-only harness (see below). | `app/dev/lesson/page.tsx` |

Both routes sit in the existing `(learn)` group, so the server layout still repeats `requireLearnerAccess()` (child cookie wins, no fallback to an adult). `linkHref` maps `LESSON` to `/learn/lesson/new?materialId=<id>[&planItemId=<id>]` (ids are validated against `^[a-zA-Z0-9_-]{1,128}$`); `Link` gained an optional `planItemId`. `PRACTICE` still resolves to `null`, so "Practice now" renders disabled with the server's reason.

## BFF and client

`app/api/learn/[[...path]]/route.ts` is still transport only. The allowlist gained exactly: GET `lessons/:id`; POST `lessons`, `lessons/:id/{check,complete,retry,cancel,notes}`; PUT `lessons/:id/progress`; DELETE `lessons/:id/notes/:noteId`. Everything else (any other verb or path) is a 404 before a credential is read; every non-GET needs a same-origin `Origin`; no query string is forwarded on lesson routes; child cookie precedence, membership header and error hiding are unchanged. `lib/api/learn-request.ts` now accepts `PUT`/`DELETE` and treats a 204 as an empty success.

`lib/api/lesson.ts` holds the contract interfaces and Zod schemas (each `satisfies` its interface). Safety checks in the schemas:

- A learner payload containing `correctOptionId`, `answerKey`, `isCorrect`, `correctAnswer` (any depth) or per-option `feedback` inside a check is **refused whole** (surfaces as the generic "unexpected response" error), so an answer key is never held in memory.
- A check result with `correct: false` must carry `correctOptionId: null`.
- Exactly five steps, in order INTRO, EXPLAIN, CHECK, EXAMPLE, RECAP; a `check` only on CHECK; blocks only `TEXT/LIST/TABLE/KEY_TERMS`.

Conformed to the platform's OpenAPI (`colearner-platform/docs/api/lesson.v1.openapi.json`, `docs/B08-lesson.md`, `packages/api-client/src/lesson.ts`) after LD finished: `completion.home` is a `Link` with the new route `HOME` (added additively to the shared `Link` enum; `linkHref` maps it to `/learn/home`); access withdrawal is READY with `content: null` and `failure.code = LESSON_ACCESS_CHANGED`, and every later action answers 403 with the same code (the player reloads and hides the lesson, whichever call hit it); `generatedBy` is empty strings until READY, so the pack and prompt release are never shown before; **retry creates the next version** and answers `{ lesson }`, so the learner is moved to the new id when it differs (otherwise the lesson is refreshed); create answers 201 new / 200 existing; the daily cap is `DAILY_LESSON_LIMIT` (429; `LESSON_LIMIT_REACHED` is still recognised) and `CHECK_LIMIT`, `NOTE_LIMIT_REACHED`, `STEP_ORDER`, `CHECK_REQUIRED` and the rest have their own safe copy, with server text shown only for `POLICY_BLOCKED`. Only `PROGRESS_CONFLICT` triggers reload-and-retry; other 409s are real refusals. `materials.links.lesson` is `{ link, enabled, disabledReason } | null` (the old local route string is still accepted).

Assumptions still open: the lesson id in a LESSON `Link` is the material id and only `planItemId` (not `planId`) is forwarded to the start page; `PUT progress` answers `{ progress }` (a bare progress is also accepted); `complete`, `cancel` and note responses are not trusted (the lesson is refetched; a valid `complete` detail is adopted).

## Player behaviour

- **Focused mode** (`lesson-focus-frame.tsx`): a full-screen overlay (portal) above the learner shell. Everything else on the page is made `inert` while open and restored on close; page scroll is locked. Close × and Esc ask "Leave this lesson?" (Base UI dialog) and the place is already saved.
- **Five steps** with Back/Next/Finish, "2 of 5" and progress dots, focus moved to the step heading on every step, and a polite live region announcing "Step 2 of 5: Explain. …". Check feedback is announced by the design system `AnswerFeedback` (`role="status"`).
- **Progress** (`useLessonProgress`): the learner moves instantly; writes follow with one in flight at a time, debounced for plain moves, immediate for a completion. The revision comes from the last acknowledged write, so a repeated write is byte-identical and the server cannot record a step twice. 409 `PROGRESS_CONFLICT` reloads the server progress and continues; network failure retries three times with backoff, then shows "Retry saving". Leaving flushes best-effort. Resume opens at `currentStep`. A finished lesson opens on the "Lesson done!" card; "Look at the lesson again" is read-only (no writes).
- **Check**: options come from the learner payload; correctness only from `POST check`. Next is locked (button and arrow key) until the server says right. Hint ladder with at most three rungs opened one at a time and never naming the answer: a fixed nudge, the lesson's own `hint` (rung skipped when null), and "Look back at From page 3" built from the step's sources. Not graded, not stored client side.
- **Citations**: every sourced step shows "From page 3" / "From 2:14" / "From section …" chips linking to `/learn/library/<materialId>`; tweens and teens can open the quoted words. INTRO may have none. `unknowns` render as "Not in your material" on the recap.
- **Read-aloud** (`lib/hooks/use-read-aloud.ts`): see below. **Ask Co**: a focusable `aria-disabled` control that never acts and shows the server's reason (kids: large mic button); `/` focuses it. **Keyboard**: ←/→ (mirrored in RTL), Esc, `/`; arrows and `/` stay with radios and text fields.
- **Notes (10 to 17 only)**: "My notes" (tweens) / "Save to revision notes" (teens), free text up to 500 characters (draft kept on failure), per-term save by index into the lesson's key terms, delete, learner-private. Kids never see the control.
- **Completion** (F-L7-08, partial by design): `POST complete` once (guarded double press), "Lesson done!", the objectives covered, disabled "Practice now" with the server reason, "Back home", "Back to my material". No XP, sticker, readiness or review schedule is shown because none exists (B09/B17).

## Band presentation

Kids (6-9): large Co with a speech bubble carrying Co's line, tile lists, 2 to 3 big option tiles, prominent "Read to me", big mic. Tweens (10-13): half-body Co beside the step, tables, key terms, notes. Teens (14-17): Co dock under the step, dense blocks, TABLE and KEY_TERMS, "Save to revision notes". The layout honours the age tokens (target size 64/48/44) and uses logical properties for RTL. Co poses: intro waving/curious, explain explaining/reading, check asking/hinting, example curious/explaining, recap celebrating/encouraging, correct answer celebrating. No image from the model is ever requested.

## Read-aloud (F-L7-05)

`useLocalReadAloud` speaks only when the browser exposes a **local** voice (`localService`) for the page language, and only with that voice, so no text leaves the device. Without a speech engine or a local voice the control does not exist (a plain note says so), never a dead button. It never autoplays, highlights the spoken word through boundary events, stops on step change, close and unmount, and the highlight uses no animation. Server TTS is not built (`readAloud.mode` is always `DEVICE`); `voiceAllowed` is not involved. The onboarding hook cannot select a voice, so the lesson has its own hook; the onboarding hook is re-exported unchanged as `useBasicReadAloud`.

## Materials

`lib/api/materials.ts` (minimal edit, outside the listed paths but required): `config.lessonsAvailable` is now `boolean` (the 0.4.0 type fixed it to `false`, which would reject a real enable), and `links.lesson` accepts the 0.4.0 local route or an actionable `{ link, enabled, disabledReason }`, reduced to a usable route or `null` plus the server reason. The library card and reader show **Start lesson** when the link exists, otherwise the server reason, otherwise nothing new.

## Truthfulness

Generated text is always labelled "Made by Co with AI from your material" (pack and prompt release available to screen readers). Nothing is invented: no reward, no readiness, no hint without a source, no TTS claim, no Ask Co. Disabled capabilities render as disabled with the server's words.

## Development harness and fixtures

`/dev/lesson?band=kids|tweens|teens&state=ready|generating|failed|failed-final|cancelled|access-changed|done|denied|unavailable|loading&step=0..4&completed=0,1&notes=1&view=start&startError=CODE&speech=fake|none|real&dir=rtl&mock=page|network` (development only, banner "synthetic fixtures only"). `mock=page` (default) answers the endpoints inside the page; `mock=network` leaves them to Playwright. Fixtures (`components/lesson/dev/lesson-fixtures.ts`) are synthetic and respect each band's sentence limit (a unit test checks it); the mock server (`lesson-mock.ts`) keeps the answer key server side, supports revision conflicts, progress failures, revoked access and idempotent create; `fake-speech.ts` is a fake local voice with boundary events.

## Verification

See the handoff report for exact results. Tests: `tests/unit/api/{lesson,lesson-bff}.test.ts`, `tests/integration/{b08-lesson,b08-materials-lesson}.test.tsx` (plus the updated `learn.test.ts` and `b07-learn.test.tsx`). Visual: `tests/visual/b08/lesson-review.spec.ts` with `tests/visual/b08/lesson-playwright.config.ts` against `COLEARNER_REVIEW_DIST_DIR=.next-b06-review next dev -p 3208` (override `B08_BASE_URL`); set `B08_OUTPUT_DIR` to a folder outside the project root while running, then copy to `output/b08`. It mocks `/api/auth/session` and `/api/learn/lessons**` with `page.route`.

## Deferred or open

- F-L7-06 Ask Co (B10) and server TTS: not built; honest disabled states only.
- F-L7-08: no reward, readiness or review scheduling (B09, B17).
- Adult/research lesson variants (B24).
- Not run: any real platform call, real browser voice, screen-reader pass, or a production build.
- Not exercised against the real platform: all of the above is mocked HTTP shaped by the OpenAPI.
