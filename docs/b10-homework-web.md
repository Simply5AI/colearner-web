# B10 web guided homework help (W2) and the co client and BFF

Implementation date: 21 October 2026. API stays **/api/v1**. The platform `co` and `co-homework` modules (agents CD1 and CD2) and the AI pack were being built in parallel, so this slice is written to `agents/contracts/B10-contracts.md` and verified with **mocked HTTP only** (a test double that follows the contract). No git commit, migration, deployment or model call was made, and nothing here proves the live platform, permissions or Co's behaviour. The Ask Co panel (`components/co/**`) belongs to agent W1 and imports `lib/api/co.ts` from here; the parent view and school controls belong to W3.

## Routes

| Route | What it does | Code |
|---|---|---|
| `/learn/homework` | L18 entry: type a problem (band limit, live count), the disabled "Snap the problem" card with the server's photo reason, the parent-visibility notice, the AI label, earlier sessions. | `components/homework/homework-entry.tsx` (`HomeworkEntryScreen`, `HomeworkEntryView`) |
| `/learn/homework/[sessionId]` | The guided session in a focused frame (navigation hidden): Capture, Restate, Steps, Final, Checked, Done. Resumes from the server after a refresh. | `homework-session-screen.tsx` (`HomeworkSessionScreen`), `homework-view.tsx` (`HomeworkSessionView`) |
| `/dev/homework` | Development-only harness (see below). | `app/dev/homework/page.tsx`, `components/homework/dev/*` |

Both sit in the `(learn)` group, so the server layout still repeats `requireLearnerAccess()`. Navigation is untouched. The entry point is a **Homework help card** on the learn home (`HomeworkHelpCard` in `components/learn/learn-home.tsx`, one additive component and one line per band layout): kids "Co helps you work it out", tweens "Co guides you step by step. You find the answer.", teens "Stuck on a problem? Co guides you; you work out the answer."

## `lib/api/co.ts` (client, W1 imports it)

Local interfaces mirror the contract; every Zod schema `satisfies` its interface. `SafetyReasonCode`, `CoDisposition`, `CoSource`, `CoReply`, `CoTurnView`, `CoContext`, the context answer, conversation, detail and history page, the homework session, steps and final, the request bodies, `coApi` (context, openConversation, history, conversation, sendTurn, turn, retryTurn, cancelTurn), `homeworkApi` (list, create, session, restatement, updateProblem, step, hint, final, finalPhase, finish, abandon), `pollDelay` (800 ms, 1.2 s, 1.6 s, 2 s ... capped at 4 s), `newClientId` (a UUID v4, with a fallback where `crypto.randomUUID` does not exist), `isSafetyReply`, `leaksAnswerKey`.

- **A reply is strict.** `CoReply`, its `safety`, `sources` and `generatedBy` reject unknown keys. A payload carrying a field named `answer`, `solution`, `key`, `rubric` (or `answerKey`, `correctAnswer`, `finalAnswer`, `modelAnswer`, `workedSolution`, ... compared without case, `_` and `-`) at any depth is refused whole, so an answer key never reaches a component. The same guard covers the homework session apart from `final.answer`, which is the learner's OWN typed answer.
- **No partial text.** A `CoTurnView` that is not READY must have `reply: null`; a READY one must carry a reply. `beyondNote` is only valid with `beyondMaterial`.
- Bodies are checked before they leave the browser (final answer at most 200 characters, hint level 1 to 3, unknown fields refused).

`lib/api/learn-request.ts` gained safe copy for `CO_UNAVAILABLE`, `CO_DISABLED_BY_POLICY`, `CONTEXT_NOT_READY`, `CONTEXT_NOT_FOUND`, `TURN_PENDING`, `TURN_LIMIT_REACHED`, `MESSAGE_INVALID`, `TURN_CONFLICT`, `CONVERSATION_NOT_FOUND`, `HOMEWORK_UNAVAILABLE`, `HOMEWORK_PHASE_INVALID`, `HINTS_DISABLED`, `FINAL_ATTEMPTS_EXHAUSTED`, `PROBLEM_INVALID` (`HINT_OUT_OF_ORDER` is shared with practice). `POLICY_BLOCKED` is still the only code whose server text is shown.

## Coordinator decisions applied (21 October 2026, after the first hand-off)

The platform agents implement these; the web is coded to them. `CoTurnView.kind` and the session's `conversationId` are now REQUIRED by the schemas. The session state carries `hints: [{ level, text, stepNumber }]` (rungs already served) and `finalAttempts` (0 to 3), both required and read from the top of the state or from `session` (either place works); resume uses them, so hint texts and the try count survive a refresh. `POST restatement` takes `{ clientTurnId, confirmed }` (idempotent). "Not quite" (`confirmed: false`) only moves the session back to CAPTURE (no model call); the learner then edits the problem and `PUT homework/sessions/:id/problem { clientTurnId, problem }` replaces the text and queues a new restate turn, on the same session (no new session, no abandon). The earlier-session list is `GET homework/sessions?cursor&limit` (`{ items: [{ id, conversationId, phase, problemPreview, stepNumber, hintsUsed, startedAt, finalVerdict }], nextCursor }`). `POST .../finish` ends a checked session ("Finish" / "Finish for now"); the platform also moves to DONE by itself on an on-track verdict or after three tries. `POST .../final-phase` is kept in the allowlist (it was in the contract text; the decision list did not repeat it): if the platform drops it, the "I am ready to answer the problem" button will answer 404 with the generic copy and should be removed.

## BFF allowlist

`app/api/learn/[[...path]]/route.ts` gained exactly these pairs. GET: `co/context`, `co/conversations`, `co/conversations/:id`, `co/conversations/:id/turns/:turnId`, `homework/sessions` (the list), `homework/sessions/:id`. POST: `co/conversations`, `co/conversations/:id/turns`, `co/conversations/:id/turns/:turnId/{retry,cancel}`, `homework/sessions`, `homework/sessions/:id/{restatement,steps,hint,final,final-phase,finish,abandon,retry}`. PUT: `homework/sessions/:id/problem` (the only new PUT; the B08 lesson progress PUT is unchanged). Nothing else under `co/` or `homework/` exists (no worker or internal route, no DELETE): any other path or method is a 404 before a credential is read. Query strings are forwarded only for `co/context` (`lessonId`, `materialId`, `stepIndex`), `co/conversations` and `homework/sessions` (`cursor`, `limit`). Same-origin writes, child cookie precedence, membership header and error hiding are unchanged.

## Behaviour (F-L18)

- **Entry.** The problem box is limited by band (kids 300, tweens 500, teens 1000) with a live count; the draft survives a refresh and a failed send. The session is created once: the `clientSessionId` (a UUID) is kept in `sessionStorage` and reused when the reply is lost or the button is pressed twice. The "Snap the problem" card is **always disabled** and shows the server's photo reason (the truthful default: the entry page makes NO context call, because the platform's `GET co/context` needs a lessonId or materialId and answers 400 without one). Earlier sessions come from `GET homework/sessions` (newest first, cursor pages, "Show more"); each row shows the problem preview, the date and a short neutral line ("Worked out", "Finished", "On step 2", "Almost there", "Just started", "Closed"), and opens where it was left ("Carry on", or "Look" for a finished or closed one). The hint cap and the parent-visibility snapshot come from the session itself.
- **Capture (after "Not quite").** The learner edits the problem; "Check again" sends `PUT .../problem` (idempotent client id, kept across a refresh) and Co restates the new text on the same session.
- **Restate.** Co's restatement, then "Is that right?" with Yes and Not quite. Both send `{ clientTurnId, confirmed }`; Yes asks for the first step; Not quite only moves back to the problem.
- **Steps.** One guiding step at a time (the server's `steps` and `stepNumber`), the learner's typed response (band limit), a trail of earlier steps, and "I am ready to answer the problem" (`final-phase`). **Hint ladder:** exactly three rungs, requested ONE AT A TIME from the server, only when the learner presses the button, labelled per band (kids "A little help / More help / Look at this"; tweens "A small nudge / A bigger hint / A similar example"; teens "Nudge / Hint / Similar example"); nothing is prefetched; disabled with the reason when `hintsMax` is reached or 0 (`HINTS_DISABLED`). A failed hint never blocks the step; the learner can ask again.
- **Final.** The learner types their OWN answer, at most 200 characters, in the same short text input for every band (big buttons for kids, no picture tiles). Up to three tries; a second try gets a new client id.
- **Checked.** on track (celebration, "New problem"), not yet ("Not quite yet. Check the last step again."), unclear ("I could not tell what you meant"). Co's feedback is shown as received. **The UI never shows or asks for the correct answer.** When the tries are used up (`finalAttempts` is 3, or the server answers `FINAL_ATTEMPTS_EXHAUSTED`) the box is not offered again and the ending is neutral; "Finish" (or "Finish for now" while tries remain) sends `POST .../finish`.
- **Done.** Celebration for on track; for anything else an honest neutral: "Co could not confirm your answer this time. Ask your teacher or a grown-up to look at it with you." No adult worked-solution UI (B24).
- **Pending.** Every model-backed transition shows Co with the thinking pose and "Co is thinking" (`role="status"`), never partial text and never a fake delay. The session is read again with `pollDelay` backoff while a turn is QUEUED or RUNNING (the count starts again for every turn); after 20 seconds a note says it is taking longer and that the place is saved. A failed re-read in the middle keeps the page and shows a quiet note.
- **Failure.** A FAILED turn shows "Co could not finish that" with Try again (only when `failure.retryable`), which calls `POST co/conversations/:conversationId/turns/:turnId/retry` and keeps polling.
- **Safety redirect.** A READY turn whose disposition is `SAFE_REDIRECT` or `TRUSTED_ADULT` (or `safety.redirected`) renders a shield, "Safety check", the code-owned `safety.guidance` verbatim (the reply text only when no guidance was sent), read-aloud, and pauses the session: no input is offered. SAFE_REDIRECT offers "Back to homework help" and "Go back to my problem"; TRUSTED_ADULT offers only the way out.
- **AI and parent notices.** "Co is an AI helper" is on every screen. The parent-visibility notice follows the contract copy (kids "Your grown-up can see your homework help.", tweens "Your parent can see your homework help sessions.", teens "Your parent can see a summary of your homework help and any safety alerts."); when the server snapshot (`FULL`/`SUMMARY`) disagrees with the band, the snapshot wins.
- **Accessibility.** Focused frame (the rest of the page is inert), focus moves to each new panel heading, a polite live region announces Co's turns, every field has a visible label and a live character count, device read-aloud (local voices only, never autoplays, no control at all when unsupported), keyboard-complete, reduced motion, RTL (user-typed text uses `dir="auto"`), 390/1024/1440, targets 64/48/44.

## Idempotency

`components/homework/homework-ids.ts`: one client id per logical action (`create`, `sessionId:restatement:true|false`, `sessionId:problem`, `sessionId:step:n`, `sessionId:hint:level`, `sessionId:final`) kept in `sessionStorage` (memory when blocked), reused while the body is unchanged (30 minutes), replaced when the body changes (the server answers 409 `TURN_CONFLICT` for the same id with another body) and forgotten once the server accepted the action. A lost reply therefore re-sends the same id; the session is read again after every action, success or failure, so the page shows what the server holds. A second press while an action runs is ignored.

## Still assumed (kept tolerant)

1. `POST homework/sessions` is read leniently (`{ session: { id } }` or `{ id }`). Transition POSTs and the PUT are not read at all: the page reads the session afterwards.
2. `final` may be `{ answer, verdict: null, feedback: null }` while the check runs; the verdict is read in either case. The page shows a celebration for on track in CHECKED and in DONE, and the neutral ending for DONE without an on-track verdict.
3. `parentVisibility` may be a string or `{ mode }`; an optional `session.band` is used when present (else the signed-in child's band, then teens).
4. Pending turns are read from `pending`; the session `turns` may or may not include the pending turn (both work).
5. The co conversation history row (used by W1) is lenient: `turnCount` or `count`.

## Development harness and mock

`/dev/homework?band=kids|tweens|teens&seed=…&dir=rtl&mock=page|network` (development only, banner "synthetic fixtures only"). Seeds start a session in a phase: `new` (entry page), `restate-pending`, `restate`, `capture`, `steps`, `steps-2`, `steps-hint1|2|3`, `thinking` (held pending), `final`, `checked-on-track|not-yet|unclear|exhausted`, `done`, `done-neutral`, `abandoned`, `safety`, `safety-trusted`, `failed`, `failed-final`. Other parameters: `hintsMax`, `polls`, `hold=1`, `fail=n`, `failFinal=1`, `failKind=HW_HINT`, `drop=n` (lost replies), `dropCreate=n`, `mode=FULL|SUMMARY`, `photo=none`, `history=n`, `sessionStatus`, `historyStatus`, `contextStatus`, `createError`, `loading=1`, `speech=fake|none`, `pollMs`.

`components/homework/dev/homework-mock.ts` follows the contract: a session starts in RESTATE with a QUEUED turn; turns go QUEUED, RUNNING, READY (or FAILED) as the session is read; a client turn id is idempotent (409 `TURN_CONFLICT` for another body); hints are sequential (`HINT_OUT_OF_ORDER`) and capped (`HINTS_DISABLED`) and listed in `hints`; the restatement, the problem PUT, steps, hints and finals are idempotent by `clientTurnId`; the final answer has three tries (`FINAL_ATTEMPTS_EXHAUSTED`, DONE after the third or an on-track verdict, `finish` from CHECKED); a pre-filter hit returns a READY code-owned redirect and leaves the step open; and **no payload ever contains a solution** (the expected answers live only inside the mock; a test scans the payloads for them). The coach wording in `homework-fixtures.ts` is canned and is not Co's behaviour.

## Not built, by contract

Photo capture of a problem (F-L18-01 capture part: no reading of pictures; the card is disabled with the server's reason), the adult worked solution (F-L18-06, B24), voice input, picture tiles for kids, and any number or answer shown to the learner that the server did not send.

## Feature status

F-L18-01 partial (typed problem and restatement done; photo capture deferred by contract), F-L18-02 done, F-L18-03 done, F-L18-04 done (feedback is Co's, labelled; celebration for on track), F-L18-05 done (no payload or screen carries a solution; checked by schema and tests), F-L18-06 deferred (B24), F-L18-07 done, F-L18-08 done on the web side (every transition is one idempotent request that the server audits; the earlier-session list and each session's resume come from the server).

## Verification

Tests: `tests/unit/api/{co,co-bff,homework-model}.test.ts` (schemas including leak rejection and unknown keys, polling, ids, error copy, API calls, BFF allowlist per route and refused others, view derivation, stable client ids), `tests/integration/b10-homework.test.tsx` (entry, every band and phase, hint order, replay safety, resume, polling backoff, safety, failure, read-aloud, live regions, learn home card). Visual: `tests/visual/b10/homework-review.spec.ts` with `tests/visual/b10/homework-playwright.config.ts` against `COLEARNER_REVIEW_DIST_DIR=.next-b10w2 next dev -p 3211` (override `B10_BASE_URL`); set `B10_OUTPUT_DIR` to a folder outside the project root while running, then copy to `output/b10`. It mocks `/api/auth/session` and `/api/learn/homework**`, `/api/learn/co/**` with `page.route`.


## Integration review (21 October 2026)

- A failed homework turn is retried with `POST homework/sessions/:id/retry` (answers the whole session state). The shared `co/conversations/:id/turns/:turnId/retry` is for Ask Co chat only; it answers 409 `HOMEWORK_CONVERSATION` for a homework conversation. For chat, that route answers 202 with a NEW turn that replaces the failed one in the transcript.
- Typed problem limit by band is the platform's: 300 / 600 / 1000 (a step answer: 300 / 500 / 1000).
