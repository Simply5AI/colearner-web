# B09 practice session player and question renderers (W1)

Implementation: 19 to 20 October 2026. API stays **/api/v1**. Written to `agents/contracts/B09-contracts.md` and, on 20 October, compared with the platform's `practice-sessions.{contracts,controller,service}.ts` (see "Platform comparison"). Verified with a **contract-faithful test double** (mock fetch, `page.route`); nothing here was run against the live platform, a database or a model. No git commit was made. The hub, start flow, summary and answer sheet belong to W2 (`docs/b09-practice-web.md`).

## Route and components

`/learn/practice/session/[sessionId]` (L10, in the `(learn)` group, so `requireLearnerAccess()` still runs; child cookie wins). Code:

| Piece | File |
|---|---|
| Page, loading, error | `app/(learn)/learn/practice/session/[sessionId]/{page,loading,error}.tsx` |
| Loads the session state (so a refresh resumes), handles denied / expired / unavailable | `components/practice/session/practice-session-screen.tsx` |
| Focused frame (reuses `LessonFocusFrame`), header, progress, timer, exit dialog, finish | `practice-player.tsx` |
| One item: Question, hint ladder, receipt, retry, skip, Next | `practice-item.tsx` |
| Idempotent submission (framework-free class + hook) | `submission.ts`, `session-hooks.ts` |
| Hint ladder | `session-hints.tsx` |
| Receipt rules (pure) | `receipt-model.ts`; copy, clock, read-aloud script, error text in `session-model.ts` |
| Calls (all through W2's `practiceApi`, Zod-parsed) | `session-api.ts` |
| Seven renderers, answer building/validation, tile marks | `components/practice/questions/{choice,cloze,matching,ordering,short-answer}-question.tsx`, `question-renderer.tsx`, `answers.ts`, `marks.ts`, `question-shared.tsx` |
| Dev harness, mock server, fixtures | `app/dev/practice-session/page.tsx`, `components/practice/session/dev/*` |

## Flow

Question -> (optional hints) -> Check -> receipt (correct, partly right, not yet, Co is checking, could not be checked, or "answer saved" in EXAM) -> optional retry -> Next. The question of an item is fetched when the learner reaches it, never ahead. The last item's button is Finish: it calls `complete` once (a lock stops a double press) and opens `/learn/practice/summary/[sessionId]`. Exit and Esc ask first (focus is trapped in the dialog); the place is already on the server, so `GET sessions/:id` resumes at the first open question. If every question already has an attempt the player opens on a "finish" card instead of a closed question (see platform notes). Focus moves to the question heading when a question opens and to the receipt heading after a check; a polite live region announces results, matches, moves and the clock (5 and 1 minute only).

## Idempotency and replay

One logical submission owns one `clientAttemptId` (a UUID made when Check is pressed, kept in memory and in `sessionStorage` under `colearner:practice:submission:<session>:<index>`; blocked storage is tolerated). The id is **reused with the identical answer** for every re-send:

- Lost reply, timeout, network failure, 5xx, 408, 429, or an unreadable reply: the answer is locked, "We could not tell if your answer arrived" is shown, and **Send again** re-sends the same id. The server replays the stored attempt (`replay: true`): no second attempt, schedule update or reward.
- A typed refusal (400/403/404/409/410/422) is definite: the next Check is a new submission with a new id.
- A new attempt after a retry always gets a new id. A double press sends one request.
- After a reload the stored submission is restored, the draft is rebuilt from it, and Send again repeats the same request.
- **Polling "Co is checking..."** re-sends the same submission (same `clientAttemptId`, same answer) with growing gaps (1.5 s, cap 8 s, give up at 90 s, after which the learner can check again by hand) and adopts the state of the replayed receipt. There is no attempt GET, so every poll is a replay (`replay: true` is normal). The learner may carry on to the next question while Co is checking.

## Reveal rules

- "Correct" comes only from the server's `result.correct`; the web never grades.
- The right answer is drawn only when the receipt says `correctAnswerRevealed` (after a correct pick, or when the tries are used up in PRACTICE/REVIEW). `revealedAnswer` is read in the shape of the item's own `PracticeAnswer`; anything unreadable is ignored, never guessed. A receipt that carries `revealedAnswer` without `correctAnswerRevealed` is refused by W2's schema.
- Before that a wrong pick is "tried" (no reveal). Partial credit on multi-select keeps the answer hidden and offers a retry.
- A question that carries any key-like field (answer key, accepted, rubric, explanation, hints) is refused whole by W2's `questionViewSchema`, so a key is never held in memory.
- Hint text is requested one rung at a time (level N only after N-1), only on press; the ladder never offers "show the answer".

## EXAM rules

EXAM (a "Test" in words, from the server's `mode`): the timer shows from the server `remainingSec`; no hints, no skip, no retry, no feedback. The button says Save / Save answer, the receipt says "Answer saved", and **whatever the server sends in `result` is ignored** until completion (tested with a misbehaving server). When the server ends the time the learner is told once and can open the summary. Local countdown reaching zero re-reads the session; only the server ends the time.

## Band behaviour

| | Kids (6-9) | Tweens (10-13) | Teens (14-17) |
|---|---|---|---|
| Touch targets | tiles and buttons at least 64 px | at least 48 px | at least 44 px |
| Words | short, warm; hint rungs "A little help / More help / Look at this"; a wrong pick is "Almost! Let us look again." with no counts of failures or tries | "Nudge / Hint / Similar example"; tries left shown | same, plus written answers |
| Timer | EXAM only | shown (10-17) | shown |
| Read aloud | "Read to me" reads the prompt and choices (device voice, never autoplays, highlights the spoken word, stops on the next question); absent without a voice, with a note | - | - |
| Matching | tap an item, then its match (also keyboard) | one labelled `<select>` per item | same |
| Kinds served | MCQ, TRUE_FALSE, MATCHING, ORDERING, CLOZE | plus MULTI_SELECT | plus SHORT_ANSWER |

SHORT_ANSWER shows "Co is checking..." (PENDING_FEEDBACK) and an honest "Co could not check this one just now" for FEEDBACK_UNAVAILABLE: nothing is scored and the learner can continue. RTL is supported with logical classes and mirrored arrows.

## Keyboard and accessibility

Choice tiles are native radios/checkboxes (arrow keys, Space; Enter on a chosen tile sends the answer). Matching has one labelled select per item (announces "matched with") and the tap-pair UI, plus optional drag. Ordering has Move up / Move down buttons that keep focus on the same button and announce "moved to position n", plus optional drag. CLOZE blanks are labelled "Blank n of N". SHORT_ANSWER has a character count. Tab never leaves the player. Reduced motion: see below. Every non-text state (correct, tried, wrong) is also written in words.

## Reduced motion

The design system (`app/globals.css`) collapses motion with `animation-duration/transition-duration: .01ms !important` and `animation: none` on `.ds-co`, `.ds-spinner`, `.ds-skeleton`. The session adds no animation of its own. The one thing Chromium still reports as "running" is the `.ds-button` `background-color` transition at the `.01ms` the design system sets (it exists for a single frame after Check enables the button). The review therefore asserts that Co and the spinner have `animation-name: none`, that no running animation lasts longer than 1 ms, and that nothing at all is running after the frame has passed (the earlier "5 running animations" was this same sample, taken before the frame passed, plus transitions of an earlier build). It is not a product defect.

## Dev harness and fixtures

`/dev/practice-session?mock=page|network&band=kids|tweens|teens&mode=PRACTICE|REVIEW|EXAM&state=ready|loading|unavailable|denied|expired|abandoned&speech=fake|none&pollMs=&dir=rtl` (development only, banner "synthetic fixtures only"). The mock server (`practice-mock.ts`) follows the contract and the platform: no key in the payload, hint text only from the hint endpoint one rung at a time, reveal only after a correct answer or exhausted tries, EXAM hides results until completion, replay by `clientAttemptId`, written answers go PENDING_FEEDBACK then GRADED or FEEDBACK_UNAVAILABLE, `answered` counts attempted items only and `currentIndex` is clamped to the last question. Fixtures are synthetic.

## Platform comparison (20 October 2026)

Compared against `apps/api/src/modules/practice/practice-sessions.{contracts,controller,service}.ts`, `practice-contracts.ts`, `practice-content.ts`.

Matches: routes and verbs; item index is **0-based** and web uses 0-based; `QuestionView.attemptNo` is **1-based** (`min(used + 1, allowed)`, service:187); answer body `{clientAttemptId, answer, timeSpentMs}` (clientAttemptId 8 to 100 chars of `[A-Za-z0-9_.:-]`, a UUID fits); hint body `{level}`; skip and complete bodies `{}` (strict empty object); receipt fields and statuses; `revealedAnswer` is a `PracticeAnswer` (CLOZE option blanks give the option id, text blanks give `accepted[0]`, SHORT_ANSWER gives `{kind, text: modelAnswer}`), which is exactly what `marks.ts` reads; every CLOZE blank and every MATCHING left item must be answered (the web requires both before Check); a replay of the same id with the same answer returns the stored attempt's current state (service:561 and 612), so polling by re-sending works; EXAM receipts are `RECORDED` with `result: null`; polling a pending answer is not blocked by `ATTEMPT_PENDING` because the replay check comes first (service:561 before 600).

Fixed on the web in this pass:
1. **Hint receipt `sourceLink` was dropped.** The platform returns `{ level, text, sourceLink }`; for a teacher question the only rung is "look back at the material" and its question view has `sourceLink: null` (service:191 to 192, 726 to 728), so the link was lost. `session-api.ts` now parses the hint through `hintReceiptSchema` (W2's `hintResultSchema` extended) and the source chip uses it.
2. **Resume when every question is attempted.** `state()` clamps `currentIndex` to `itemCount - 1` (service:515), so the old "index === total" resume was unreachable and the learner would be put back on a closed question. The player now opens on the finish card when `progress.answered >= total`; `ITEM_CLOSED` from an answer, hint or skip re-reads the session and, if the place did not move, moves on.
3. Safe copy for platform codes the shared copy does not know: `ITEM_CLOSED`, `ITEM_NOT_FOUND`, `ATTEMPT_PENDING`, `ATTEMPT_CONFLICT`, `HINT_UNAVAILABLE`, `SKIP_DISABLED_IN_EXAM` (kept in `session-model.ts`; W2's `learn-request.ts` was not touched).

Platform items for the owner (not edited): (a) `progress.answered` counts attempted items only, so a session whose last item was skipped cannot be told apart from "on the last question"; the web handles it through `ITEM_CLOSED`, but a `currentIndex` that may equal `itemCount` (or an `allDone` flag) would be cleaner. (b) `practiceAnswerSchema` limits MULTI_SELECT to 5, MATCHING to 5 pairs and ORDERING to 3 to 6 items (`practice-contracts.ts` around lines 268 to 292), the web accepts 10 and 2; fine for generated sets, but a teacher ORDERING question of 2 items or a larger set would be refused with `ANSWER_INVALID`. (c) `HintReceipt.level` for the teacher look-back rung is always 1 whatever was asked, which the web tolerates. (d) `SESSION_NOT_COMPLETED`, `EXAM_NOT_AVAILABLE`, `TOPIC_NOT_FOUND`, `CONSENT_REQUIRED`, `CHILD_PROFILE_REQUIRED`, `SESSION_CONFLICT`, `SET_NOT_FOUND` are emitted by the platform and have no dedicated W2 copy (generic fallback by status).

## Deviations and assumptions

1. **Polling by re-sending** the same `clientAttemptId` (no attempt GET exists): confirmed workable against the platform (above).
2. **`skip` and `complete` bodies are `{}`** and their replies are not read (`z.unknown()`); the web moves on by itself (skip) and by the session summary route (complete). The platform's `SkipReceipt.nextIndex` is not used.
3. **`revealedAnswer` shape** is the `PracticeAnswer` of the item's kind (confirmed). A shape the web cannot read is ignored (the explanation and tile marks still show, no answer is drawn). A free CLOZE blank with several accepted variants only marks the first accepted text, so a learner's other valid variant in a partly right answer can be marked "not right yet" for that blank.
4. **Per-question `timeLimitSec` is ignored.** The only clock is the session's `remainingSec` (EXAM, or any session the server times), shown for ages 10 to 17 and EXAM. The server alone ends time.
5. Hints for kinds the server calls unavailable simply do not appear (`hintsAvailable: 0`); EXAM forces 0 on the client too.
6. Unavailable kinds (CODE, VOICE, picture choice) are never rendered; a question of an unknown kind makes W2's schema refuse the whole item (a safe load error).
7. Read aloud uses only the device voice (no server TTS, B08/B24); no speech recognition, so no spoken answers (F-L10-03 voice part deferred, F-L10-07 deferred).
8. Drag for matching and ordering is optional; buttons and selects are the complete path.
9. `.next-b09w1/` was added to `.gitignore` (same pattern as the other review dist dirs). Tailwind v4 scans every non-ignored file, and it was reading binary dev-cache files of this server, producing an intermittent "Parsing CSS source code failed" in `app/globals.css`. Use a gitignored dist dir for any review server.

## Feature status (ids from `03-feature-catalog.md`)

F-L10-01 done (focused sequence, submit/next/exit, timer for 10 to 17 and EXAM from the server clock). F-L10-02 done for the seven served kinds; **picture choice deferred** (no approved image assets; kids get large-tile MCQ and true/false). F-L10-03 free text (rubric) and choice answers done; **code and voice deferred** (no execution sandbox, no speech recognition). F-L10-04 done (three sequential rungs asked one at a time, the web adds nothing of its own, never a "show answer", hidden in EXAM). F-L10-05 done on the web side: the ladder can only show what the server sends, and the server never reveals the answer in a hint. F-L10-06 done (kind feedback, explanation only when the server sends it, source chips including the teacher look-back). **F-L10-07 deferred** (transcript preview needs speech recognition). F-L10-08 done on the web side (one idempotent attempt per `clientAttemptId`, retries tolerated, polling by replay); the spaced-review update is the server's. F-L10-09: the completion summary and rewards are W2's; this player only completes the session and opens it.

Everything above is verified against the contract-faithful double and a read of the platform code, **not against a running platform**.

## Verification

Unit `tests/unit/practice-session/` (answers, receipt and reveal rules, session model, submission, hint receipt); integration `tests/integration/b09-practice-session.test.tsx` (every kind and band, hints, replay, polling, EXAM, timer, read aloud, RTL, resume); Playwright `tests/visual/b09/practice-session-review.spec.ts` with `practice-session-playwright.config.ts` against `COLEARNER_REVIEW_DIST_DIR=.next-b09w1 next dev -p 3209` (override `B09_BASE_URL`); set `B09_OUTPUT_DIR` to a folder outside the project root, then copy `practice-*.png` and `viewport-{kids-390,tweens-1024,teens-1440}.json` to `output/b09`. See the handoff report for exact results.
