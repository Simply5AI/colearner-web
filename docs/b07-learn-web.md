# B07 web learner home, learn and plan screens (W1)

Implementation date: 19 October 2026. API stays **/api/v1**. The platform learn endpoints were being built in parallel, so this slice is written against `B07-contracts.md` and verified with mocked HTTP only. No git commit, migration, deployment or model call was made.

## Routes

| Route | Screen | Component |
|---|---|---|
| `/learn/home` | L1 Home and next action | `components/learn/learn-home.tsx` |
| `/learn` | L2 subjects, personal and assigned plans, join with a code | `learn-overview.tsx`, `learn-join-dialog.tsx` |
| `/learn/plans/[planId]` | L3 plan detail | `learn-plan.tsx` |

They live in the new `app/(learn)/` group. Its server layout calls `requireLearnerAccess()` (`lib/auth/learner-access.ts`), which mirrors `requireMaterialAccess` and adds the dashboard group's family age/child-profile gate. A selected child cookie always wins and never falls back to an adult session; an empty or revoked child redirects to `/profiles?denied=1`. Only a nonsecret cache scope (and the server-checked band for a child) reaches the browser. `/learn/library|import|snap` stay in `(materials)` untouched.

## BFF and client

`app/api/learn/[[...path]]/route.ts` is transport only: allowlist `GET home | overview | plans/:id` and `POST enrollments/join`; same-origin POST; child cookie precedence with no `X-School-Membership-Id`; account token plus selected membership otherwise; overview query keys limited to `q, subjectId, kind, status, cursor, limit`; no mutation replay; backend errors never leak. `lib/api/learn.ts` holds the contract interfaces and Zod schemas (each `satisfies` its interface, to be swapped for `@colearner/api-client` types when the tarball lands). `learn-request.ts` unwraps `{data}`, maps errors to safe messages (CODE_INVALID, CODE_EXPIRED, ALREADY_ENROLLED, POLICY_BLOCKED with the server's safe reason, PLAN_STRUCTURE_LOCKED) and throws `LearnSessionError` (not `ApiError`) on 401 so a child or expired session never triggers the adult global sign-out.

## Truthfulness rules implemented

- A control is a working link only when the server says `enabled` **and** the web has a real route (`linkHref`: plan, library item, import, snap, assignment-to-plan). `LESSON` and `PRACTICE` have no web route until B08/B09, so they render as a disabled control with the server's `disabledReason` as visible text (a generic message if the server wrongly says enabled).
- Nothing is invented: no XP, league, quest or readiness percentage. Streak, time pill, exam countdown, subject cards, mastery, weak concepts and recent material appear only when the server sends data; `masteryPercent: null` shows no mastery.
- Co's recommendation (home) and suggested resources (plan) render only when `status === 'AVAILABLE'` with items, labelled "Co's suggestion" with a note, visually separate from the "Measured progress"/"Your progress" tags. UNAVAILABLE renders nothing. External suggestion links accept http(s) only and open with `rel="noopener noreferrer"`.
- The UI contains no structure-editing controls for any plan. Locked (assigned) plans show who controls them, the teacher note, and no attach/import action when `canAttachMaterial` is false. The server remains the gate (`PLAN_STRUCTURE_LOCKED`).
- Join with a code: typed code survives failures, a decided code is never re-sent from the dialog, a double press sends one request (server is also idempotent), and a minor's `PENDING_GUARDIAN_APPROVAL` is shown as "Waiting for your parent to say yes" and never as enrolment.
- States: loading skeleton with Co thinking, empty, first time, limit reached, denied (403/404 with no retry and no detail), session ended, unavailable with retry.

## Band presentation

Kids (6-9): Co, speech bubble (read-aloud button stays disabled; no TTS exists), one giant next card, stepping-stone dots, no percentages, picture tiles for Snap and Play, adventure-map path with the current stone and Co. Tweens (10-13): daily plan, assignment card, levels. Teens (14-17): exam countdown, subject cards, chapters with mastery only when measured, mock-test action, weak concepts. Adult/research variants (F-L1-05, F-L2-05, F-L3-05) are deferred to B24.

## Navigation

`studentNavigation`: Home → `/learn/home` (also highlighted on `/dashboard`), Learn → `/learn` (also on `/learn/plans/*` and `/roadmaps*`), kids Adventures → `/learn`. `StudentShell` brand link → `/learn/home`. The legacy `/dashboard` and `/roadmaps` pages remain until B22. New plan links to the retained `/roadmaps` creation flow. Selected children get `ChildLearnShell` (Home, Learn, Library, Switch learner).

## Development harness and fixtures

`/dev/learn?screen=home|learn|plan&band=kids|tweens|teens&state=…&dir=rtl` (`app/dev/learn`, development only, banner states "synthetic fixtures only", makes no request). States: home default, first-time, limit-reached, loading, denied, unavailable; learn default, empty, join-code, approval-pending, unavailable-join; plan default, topic-expanded, no-sources, locked. Fixtures live only in `components/learn/dev/learn-fixtures.ts`.

## Deferred or open

- Class filter (F-L2-06): search `q` is sent to the server; a dedicated class selector needs a `classId` overview parameter and class list in the contract.
- `PlanDetail.band`: not in the contract; accepted when present, otherwise the page uses the child scope band, then the profile date-of-birth band, then teens. Recommend adding `band` to the contract.
- Lesson/review/practice/mock-test controls stay disabled until B08/B09. Plan structure editing UI is not part of B07.
- CoDock was not used: its "Ask Co" button has no backing feature yet, so a permanently disabled button would clutter the screen.
- Live permission, database and model behaviour are not qualified here.

## Verification

See the handoff report for exact results. Focused tests: `tests/unit/api/{learn,learn-bff,learner-access}`, `tests/integration/b07-learn.test.tsx`. Visual: `tests/visual/b07/learn-review.spec.ts` with `tests/visual/b07/learn-playwright.config.ts` against a dev server (`COLEARNER_REVIEW_DIST_DIR=.next-b06-review next dev -p 3207`, override `B07_LEARN_BASE_URL`); screenshots in `output/b07`.
