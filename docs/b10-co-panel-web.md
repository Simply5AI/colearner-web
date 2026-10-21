# B10 web: the Ask Co panel (W1)

Implementation date: 21 October 2026. API stays **/api/v1**. The platform `co` module (agent CD1) and the AI pack were built in parallel, so this slice is written to `agents/contracts/B10-contracts.md` and verified with **mocked HTTP only** (a test double that follows the contract). No git commit, migration, deployment or model call was made, and nothing here proves the live platform, the safety layers or model behaviour. Homework help (W2) and the family and school views (W3) are separate; this file covers `components/co/**` only.

## Where Ask Co opens

| From | How | Code |
|---|---|---|
| Lesson player | The Ask Co control is a real button **only when `detail.askCo.status === 'AVAILABLE'`**. It opens the panel with `{ kind: 'LESSON', lessonId, stepIndex }` for the step on screen (the id comes from `askCo.context`, else the lesson itself). `/` focuses the control and opens it. While the panel is open, Esc, the arrows and `/` belong to the panel (the lesson ignores them) and the lesson's read-aloud stops. `UNAVAILABLE` keeps the B08 behaviour exactly: a focusable `aria-disabled` control with the server's reason. | `components/lesson/lesson-player.tsx` (additive), `lib/api/lesson.ts` (`askCo.context`, `reason` may be `null`) |
| Library item (reader) | `AskCoEntry` asks `GET co/context?materialId=` first. Available: a real control. Unavailable: the server reason and an inert control. Loading, or a context that cannot be read: **nothing is shown**, so the page never claims more than it knows. Only for a READY material. | `components/materials/material-reader.tsx` (one additive line), `components/co/co-launcher.tsx` |
| Standalone | There is no stand-alone entry without a material: a panel with no material context says so and links to the library instead of offering an ungrounded chat. | `CoUnavailableState` |

The library list does not get a per-card control (one context request per card would be wasteful); the reader is the library item.

## Flow

`GET co/context` (availability, reason, source, **code-owned suggestions**, open conversation, parent visibility, voice reason) → on the first message `POST co/conversations` (idempotent get-or-create, lazy so opening the panel never creates an empty chat) → `POST …/turns` with a client-generated uuid `clientTurnId` → poll `GET …/turns/:id` with the fast backoff (800 ms, 1.2 s, 1.6 s, 2 s … cap 4 s) → render `CoReply`. Reopening loads `GET co/conversations/:id` (the history of this conversation); a turn still being answered is polled again.

- **Never double-send** (`turn-sender.ts`): one message owns one `clientTurnId`, stored in sessionStorage and **reused, with the same text, for every re-send** (a lost answer, a failed conversation lookup, a refresh). A new id exists only after the server took the message or definitely refused it. While a message is unconfirmed the field is locked to it and the button reads "Send again". The sender is one instance per panel (a regression test covers the real sessionStorage path).
- **One pending turn per conversation**: Send and the suggestion bubbles wait while Co works; the learner can keep writing the next question. 409 `TURN_PENDING` (another tab) reloads the conversation so that turn is shown and polled. After 20 s a calm "Stop waiting" calls `…/cancel`.
- **No fake delay, never partial text**: the pending state is the real `QUEUED`/`RUNNING` state (Co thinking pose, "Co is thinking" for kids, "Co is checking your material" for others). The client schema refuses a reply on an unfinished turn.
- Retry and cancel answers are not trusted: the turn is read again afterwards. A failed turn offers "Try again" (`…/retry`, the same turn) when `failure.retryable`, otherwise "ask something else".

## What a reply shows (`co-model.ts → replyView`, unit-tested)

- Sourced answer with source chips "From page 3" linking to the source's own library link, else the context material; tweens and teens can open the quoted words.
- **"Beyond your material" only when `beyondMaterial` is true**, with `beyondNote` only then (the schema refuses a note without the flag, and the view ignores one anyway).
- Suggestion chips (at most 3, de-duplicated; newest reply only), teen **key points** (at most 4, only when returned), an AI label "Co is an AI helper" (the existing `AiOriginTag`, new `helper` variant; pack and prompt release for screen readers).
- **Safety redirect** (`disposition` SAFE_REDIRECT or TRUSTED_ADULT, or `safety.redirected`): shield icon, "Safety check", and the **code-owned guidance verbatim** (`safety.guidance`, else the server's code-owned `text`). Nothing else is shown: no sources, key points, suggestions or beyond tag, no model text. A `generatedBy: CODE` reply is labelled "Safety message from CoLearner", not as AI. A trusted-adult outcome is a delivered result, not an error.
- Device read-aloud per reply: only with a **local** voice (`useLocalReadAloud`), hidden entirely when unsupported, never autoplays, highlights the spoken word.
- The panel footer always says "Co answers from your material and labels anything beyond it." and the parent-visibility note by band and `context.parentVisibility.mode`: FULL kids "Your grown-up can see your chats with Co.", FULL tweens/teens "Your parent can see your chats with Co.", SUMMARY teens "Your parent can see a summary of your chats with Co and any safety alerts." (kids and tweens with SUMMARY get the same sentence with "grown-up"/"parent").

## Bands

Kids (6-9): a large overlay (full screen on a phone), large Co, big tap suggestion bubbles (64 px), short replies, a prominent "Read to me", typed input with a big "Ask" button (300 letters). Tweens (10-13): a side panel at the inline end, 48 px targets (500 letters). Teens (14-17): the same panel with a **Simple / Exam-style** choice (`style` in the turn body) and key points (1000 letters). Tweens "short illustrated replies" are text with Co poses only: no picture is ever requested or shown.

## Not built, on purpose

- **No microphone, waveform, listening pose or transcript.** One calm note, "Voice isn't available yet", followed by the server's `voice.reason`. The photo reason is homework-only and not shown here.
- No picture replies; no adult history, copy or add-to-review (B24); no cross-conversation history list (the learner's own earlier turns of **this** context are shown).

## States

Loading, available, unavailable (reason as given), `CO_DISABLED_BY_POLICY` ("Not right now"), `CONTEXT_NOT_READY` (with Try again), `CO_UNAVAILABLE`, `TURN_LIMIT_REACHED`, denied (403/404, no existence leak), **session ended** (its own state; it is a `LearnSessionError`, never an `ApiError`, so no adult sign-out can run), unreachable with retry, history failed (the field still works), poll lost ("We cannot reach Co right now" with Check again), message refused (the draft is kept). Server text is shown only for `POLICY_BLOCKED`.

## Accessibility

A modal Base UI dialog: focus trapped, the page behind inert, **Esc closes** (a confirmation, "Close without sending?", only when an unsent question exists; Esc again keeps writing), focus **returns to the opener**, initial focus on the field for tweens and teens and on the heading for kids (so the keyboard stays closed). One polite live region announces working, finished, failed and stopped turns of this visit (never the history, never partial text). Logical properties and `rtl:` mirroring throughout, reduced motion through the design-system rules, touch targets 64/48/44, 390/1024/1440 checked.

## Contract points and assumptions to confirm at integration

- `lib/api/co.ts` is W2's (strict schemas, `coApi`, `pollDelay`, `newClientId`). `components/co/co-client.ts` is a thin adapter over it; `co-types.ts` re-exports its types. **W2's schema now requires `kind` on every turn view** (a coordinator decision after the contract text); the mock sends `kind: 'CHAT'`. If CD1 omits it, every turn would fail to parse.
- The shapes the contract text does not give: the `POST conversations` answer (`{ conversation: { id } }`), the history rows, and the retry/cancel answers (read again via GET). `GET conversations/:id` may carry the pending turn in `pending`, in `turns`, or both (merged by id).
- A conversation is created lazily; `openConversationId` from the context is what reopens history. A stale id (404 `CONVERSATION_NOT_FOUND`) is replaced by a fresh conversation on the next message.
- `stepIndex` is the step open when the panel opened (the lesson cannot move while the modal is open).

## Development harness and fixtures

`/dev/co?band=kids|tweens|teens&state=fresh|history|pending|unavailable|disabled|not-ready|no-context|denied|ended|unreachable|loading|history-failed&opener=lesson|material&open=1&dir=rtl&speech=fake|none|real&parent=full|summary&polls=&pollMs=&slowMs=&delay=&lost=&sendFailures=&pollFailures=&startError=&turnError=&mock=page|network` (development only, banner "synthetic fixtures only"). `components/co/dev/co-mock.ts` is a contract-faithful double: a turn goes QUEUED, RUNNING, READY with the whole reply; idempotent by `clientTurnId` (same body same turn, different body 409); one pending turn (409); message limits by band; a pre-filter hit is READY at once with a code-owned reply; keywords choose the outcome ("beyond", "fail" then a good retry, "forever", "clarify", "hurt myself", "phone number"). Fixtures (`co-fixtures.ts`) are synthetic and respect each band's sentence limit (a unit test checks it). `/dev/lesson?askCo=1` reports Ask Co as AVAILABLE (an additive B08 fixture switch) and answers the Ask Co endpoints too.

## Verification

Tests: `tests/unit/co/{b10-co-model,b10-turn-sender,b10-co-client}.test.ts` (reply rules, beyond tag only with the flag, redirect verbatim, id reuse, backoff, schemas), `tests/integration/{b10-ask-co,b10-ask-co-entries}.test.tsx` (per band and state, keyboard, lesson and reader wiring). Visual: `tests/visual/b10/co-review.spec.ts` with `tests/visual/b10/co-playwright.config.ts` against `COLEARNER_REVIEW_DIST_DIR=.next-b10w1 next dev -p 3212` (override `B10_BASE_URL`); set `B10_OUTPUT_DIR` to a folder outside the project root while running, then copy to `output/b10`. It mocks `/api/auth/session` and `/api/learn/co/**` (and the lesson endpoints for the lesson-player cases) with `page.route`.

## Not run

Any real platform call, live model, the safety layers, real browser voice, a screen-reader pass, or a production build. Everything is mocked HTTP shaped by the contract.
