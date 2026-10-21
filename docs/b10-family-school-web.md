# B10 parent conversations view and school Ask Co / homework policy controls

Agent W3 of batch B10 (21 October 2026). Web only; the platform side (agent PV) widens `GET /family/profiles/:profileId/conversations` and adds the three policy flags concurrently. The web was coded to `agents/contracts/B10-contracts.md` and does not edit the vendored `@colearner/api-client` 0.4.0 tarball.

## Parent view (`components/family/conversation-access.tsx`, `conversation-list.tsx`, `conversation-transcript.tsx`)

The strict local schema is `lib/api/family-conversations.ts`; the vendored `FamilyConversationAccess` (`items: never[]`) is no longer used for this response.

| Access | Who | What renders |
| --- | --- | --- |
| `FULL` | Under 14 (6-9, 10-13) | List of conversations (title, Ask Co or Homework help, date, turn count, homework phase and hints used, safety flag badge). Each expands (button with `aria-expanded`/`aria-controls`, Enter or Space) to a read-only transcript: learner and Co bubbles, disposition label, "Beyond your material" tag, "Safety check" marker, code-owned safety guidance, and "Co is an AI helper". "Load more" follows `nextCursor`; a polite live region announces it. Privacy note: "Only you and your child can see this." |
| `SUMMARIES` | 14-17 | One row per conversation (title, kind, date, turn count, homework phase and hints used, safety flag count) and a "Safety alerts" section (classification label and date only). No message text anywhere. |
| `FULL` after a grant | 14-17 | The existing audited form (reason of at least 20 characters, password or server-checked recent sign-in) is unchanged. A returned grant refetches with `safetyGrantId`; transcripts appear for that profile with a 15-minute notice. A timer drops the grant at `expiresAt` ("Safety access has ended"), and "End safety access now" drops it early and removes the cached transcripts. |

States kept from B03: loading ("Checking your family access…"), denied/unavailable with "Try again", and the audited-form feedback. The old "No school-scoped conversations are available yet" placeholder is replaced by "No chats with Co yet" when `items` is empty (the platform may still send the compatibility `reason`). If loading more fails the loaded rows stay and a retry is offered.

### Privacy and safety rules enforced in the client

- Strictness: `z.strictObject` everywhere, no `.passthrough()`, discriminated on `access`. A SUMMARIES item that carries `turns`, `text`, `preview` or any other key makes the whole response invalid (safe error, nothing rendered). A FULL response cannot carry SUMMARIES items and vice versa.
- Defence: a 14-17 profile without a grant refuses a `FULL` response even if well formed (`parseFamilyConversationsFor`).
- Message text is rendered as plain text (never HTML or markdown). Co replies are always labelled "Co · AI helper".
- Transcript queries use their own key (`family-conversations`), so unrelated family actions never re-read (and re-audit) transcripts; focus refetch is off.
- Compatibility: `safetyAlerts` defaults to `[]` when absent (pre-B10 platform answers with an empty list, which still parses as the honest empty state).

### Assumed wire shape (flag to PV)

`{profileId, access, items, safetyAlerts, nextCursor, reason?}`; FULL item `{id, kind:'CHAT'|'HOMEWORK', title, startedAt (ISO with offset), turnCount, turns:[{ordinal, role:'learner'|'co', text, disposition:'LEARNING'|'CLARIFY'|'SAFE_REDIRECT'|'TRUSTED_ADULT'|null, beyondMaterial, safety?: boolean | {redirected, reasonCodes?, guidance?, classification?} | null}], homework?, safetyFlagCount?}`; SUMMARIES item `{id, kind, title, startedAt, turnCount, homework?:{phase, hintsUsed}, safetyFlagCount}`; `SafetyAlert {id, createdAt, classification, reasonCodes[], conversationId|null}`. Query parameters: `safetyGrantId` (existing), `cursor` and `limit` (assumed; the web sends `limit=20`). The `safety` field on a turn was not specified; the schema accepts a boolean or a small strict object. Alert `classification` is a free string (known values `content_risk`, `distress`, `privacy_risk`, `human_review`, `SAFE_REDIRECT`, `TRUSTED_ADULT` get labels; anything else shows "Safety check").

## School policy controls (S6, `components/family/policy-form.tsx`)

The S6 screen (`components/school/policy-screen.tsx`) renders the shared `PolicyForm`, so the new fieldset "Ask Co and homework help" lives there: "Allow Ask Co questions" (`askCoAllowed`), "Allow homework help" (`homeworkHelpAllowed`) and "Hints per homework problem" (`homeworkHintsMax`, 0-3 select, disabled while homework help is off). Copy: "If a parent turns this off it stays off for that child; the lower hint limit wins." The guardian preferences form shows the same controls with the mirrored sentence. Saving uses the existing `PUT .../learning-policy` (or `/preferences`) with `expectedRevision`; there is no separate update call in `lib/api/school.ts` (the school policy write has always gone through `PolicyForm`).

Compatibility with older rows and platforms: the three keys are optional. Absent means the defaults (allowed, 3 hints) in the UI, and a key is only sent when the loaded row already had it or the user edited it, so a platform that has not added the flags still accepts a save. After a save the screen shows "School rules saved." (the form remounts on the new revision, so the status lives in the screen). A 409 keeps the full draft, as in B03. The effective policy view shows "Ask Co" and "Homework help" rows only when the platform sends the flags (top level or in `settings`).

## Harness and tests

- `app/dev/family-conversations/page.tsx` (development only) with `components/family/dev/conversation-{fixtures,mock,harness}`. Parameters: `screen=conversations|policy`, `scenario=under14|teen|empty|teen-empty|denied|error|page-error|teen-leak|grant-denied`, `teen=1|0`, `policy=default|set`, `grantMinutes`, `dir=rtl`, `mock=page|network`.
- `tests/unit/api/b10-family-conversations.test.ts`: schema accept/reject, the no-text rule, teen-without-grant refusal, paths, labels, pre-B10 compatibility.
- `tests/integration/b10-family-school-web.test.tsx`: 21 RTL cases per access mode and state, keyboard, grant, expiry, policy form.
- `tests/visual/b10/family-review.spec.ts` + `family-playwright.config.ts`: 24 cases (390/1024/1440, LTR and RTL) with `page.route` mocks. Run against `COLEARNER_REVIEW_DIST_DIR=.next-b10w3 NEXT_PUBLIC_API_URL=http://localhost:3213 next dev -p 3213` with `B10_OUTPUT_DIR` outside the project, then copy to `output/b10`.

Updated retained tests: `tests/integration/b03-family-web.test.tsx` (mock answers the conversations endpoint; asserts the new empty state) and `tests/visual/b03/family-review.spec.ts` (teen summary case expects "No chats with Co yet").

## Not claimed

No real platform response was exercised (PV was in progress); the real-backend B03 review was not rerun. Voice, photo and teacher conversation access are not part of this view. Retention, export and deletion remain decision Q06 (B20).
