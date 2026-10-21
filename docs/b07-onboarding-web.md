# B07 web: A6 "Meet Co" onboarding and S5 curriculum screen (W2)

Date: 19 October 2026. API stays `/api/v1`. Written to `Learning App Redesign/Implementation Plan/agents/contracts/B07-contracts.md`; the backend is built in parallel, so every server shape below is validated by local Zod schemas and exercised only against mocked HTTP. Nothing here claims a live backend pass.

## A6 `/onboarding/meet-co`

| Feature | State |
| --- | --- |
| F-A6-01 band introduction, short steps | Done for kids (6-9), tweens (10-13), teens (14-17). Adult variant deferred to B24. |
| F-A6-02 contexts | SCHOOL only (shown selected, not toggleable). University, personal, research are deferred to B24 and the screen says they are not available yet. |
| F-A6-03 subjects, grade, board, goal, date | Subjects come from `curriculumSubjects` (server mapping). Board (CBSE/ICSE) and class 1-10 are chosen by tweens/teens only when no school preload exists. Own subjects (tweens/teens), goal and exam date (teens). IB/State/Other are not in the contract and are not offered. |
| F-A6-04 Co personalisation | Kids/tweens: four recoloured themes (`sunrise`, `ocean`, `galaxy`, `leaf`) and nickname. Teens: presence (Avatar/Minimal) and voice preference. `HIDDEN` presence is adult-only and not offered. Voice only saves a preference. |
| F-A6-05 first import | Links to `/learn/snap` and `/learn/import` only (existing B06 pages). Completion is recorded first (`POST complete`); "Later" follows the server `nextRoute` (`IMPORT` to `/learn/import`, `HOME` to `/learn/home`). |
| F-A6-06 back, skip, resume | Back persists the earlier step. Skip is shown only when the server's `skipAllowed` is true and never for kids; a server `SKIP_NOT_ALLOWED` is shown without leaving. Resume reads `GET /learn/onboarding` (saved step and draft), with a "Welcome back" note. A completed learner sees destinations instead of repeating setup. |
| F-A6-07 roster preload | `preload` board/grade are shown as "Set by your school" (kids: "Set by your grown-up") and are never sent back. This applies to every band, a deliberate choice since the school roster is authoritative (the contract only mandates read-only for 6-9). |
| F-A6-08 adult/research | Deferred (B24). |

Kids rules: no skip, one sentence per line (<= 8 words, unit-tested in `tests/unit/b07-meet-co-logic.test.ts`), every line has a `ReadAloudText` control backed by browser speech (nothing autoplays; where the browser has no speech engine the design-system control stays disabled), the context step is replaced by the Co line "Your grown-up says you're in Grade N!", and board/grade are read-only. The "You can change this later in Settings." note appears on teens steps 2-4; a Co settings surface is not built by B07 (dependency).

Not built: the tweens "My tutor shared something" tile (no tutor-share flow exists; join-with-code belongs to W1's L2). Learner name for the greeting comes from the child nickname or the account first name; `OnboardingState` carries none, so the greeting is nameless when absent.

### Files

- `app/(meet-co)/onboarding/meet-co/{layout,page,error}.tsx`: own route group and gate (see "Deviation").
- `lib/auth/onboarding-access.ts`: `requireOnboardingAccess()` (child cookie wins, no adult fallback, no legacy `onboardingCompleted` redirect, adult `AGE_CHECK` to `/age`, `CHILD_PROFILE` to `/learner`) and `onboardingCredential()` for the BFF. `material-access.ts` is untouched.
- `app/api/onboarding/[[...path]]/route.ts`: transport-only BFF. Allowlist: `GET|PUT /learn/onboarding`, `POST /learn/onboarding/complete`, `POST /learn/onboarding/skip`. Everything else 404, wrong methods 405, writes need same-origin and `application/json` (16 KiB cap), child cookie takes precedence and carries no school selector, malformed membership 403, no query string forwarded, no write replay, network failure returns a generic 503.
- `lib/api/onboarding.ts`: local Zod schemas (`satisfies z.ZodType<...>` of the contract types), stricter outbound draft validation, safe error mapping, `OnboardingSessionError` so a revoked child never triggers the account sign-out handler.
- `components/onboarding/meet-co/*`: flow, steps, copy, flow logic, read-aloud hook, fixtures, harness.
- `app/dev/onboarding/page.tsx`: development-only harness (`?band=&scenario=&dir=&mock=local`), 404 outside development, labelled synthetic fixtures.

### Server-backed action behaviour

Load, save, curriculum refresh, skip and completion each have loading, denied, unavailable and retry states. Drafts live in component state, so a failed save, skip or completion keeps every choice and Retry resends the same body. Buttons are disabled while a request is in flight (no double submit). `PUT` is merge/idempotent by contract; completion relies on the server being idempotent per learner (assumption).

### Deviation: route group

The route is `app/(meet-co)/onboarding/meet-co`, not inside `app/(onboarding)`. The legacy group layout requires an adult Auth.js session and cannot admit an opaque child cookie, and a nested layout cannot bypass its parent. The legacy steps and group layout are unmodified and the URL is the specified `/onboarding/meet-co`.

### Blocker for child-cookie learners (not changed here)

`middleware.ts` matches `/onboarding/:path*` and `authorized()` redirects any request without an Auth.js session to `/login`. A child holding only the opaque child cookie therefore never reaches this page in a real browser. Fix owned by the coordinator: in `authorized()`, treat `/onboarding/meet-co` like the `/learn` routes (not login-gated by middleware; the route layout does the gate), or exclude it from the matcher. Account learners (for example school students) work today.

## S5 `/org/[schoolId]/curriculum` (provisional UI)

No school-admin design was supplied (S5 "Design completeness"). This is a functional screen built from design-system primitives and the existing school patterns. It is labelled provisional on the page; layout may change when a design exists.

- Coverage report (F-S5-01/02/04): board, class, subject, chapter/topic counts, version label, source title, reviewer and review date, status `COVERED` / `PARTIAL` / `NOT_LOADED`. An empty catalog renders an explicit "No curriculum is loaded yet" / NOT_LOADED state and no table. The screen states that a board name never implies full curriculum.
- Catalog browser: read-only subject, chapter, topic by board and class, with provenance and a not-loaded state per selection.
- Class to subject mapping: checkbox per catalog subject plus optional teacher (active school teachers from `/memberships`), saved with a single `PUT`. Failed saves keep the draft; Retry resends the same body.
- Class content assignment (F-S5-03): plan, material (by ID) or central topic (chosen from the catalog), optional due date, list and confirmed remove. A duplicate (same kind and reference) is blocked client-side so a retry after a lost response cannot create a second record.
- Access: `requireSchoolWorkspace(schoolId, ['SCHOOL_ADMIN'])`; a "Curriculum & subjects" item was added to `components/school/school-shell.tsx`. `lib/api/school.ts` and `school-browser.ts` only gained `'PUT'` in their method unions.

### Path and shape assumptions (flagged)

Paths follow school-academics (`/schools/:schoolId/...`) via `schoolPath`:
`GET /curriculum/catalog?board&grade`, `GET /curriculum/coverage`, `GET|PUT /classes/:classId/subjects`, `GET|POST /classes/:classId/assignments`, `DELETE /classes/:classId/assignments/:assignmentId`.

The contract defines the coverage row only. Assumed and validated defensively (bare array or `{ items }`): catalog item `{ id, board, grade, key, name, versionLabel?, sourceTitle?, chapters: [{ id, ordinal, title, topics: [{ id, ordinal, title }] }] }` where `id` is the curriculum subject id; class subject `{ curriculumSubjectId, subjectName, teacherUserId }` with `PUT { subjects: [{ curriculumSubjectId, teacherUserId? }] }` replacing the set; assignment `{ id, kind, refId, title?, dueAt, createdAt? }` with `POST { kind, refId, dueAt? }` (`dueAt` is a local end-of-day ISO instant). There is no plan/material picker endpoint, so plan and material assignment takes an ID that the server must validate. These live in `lib/api/curriculum.ts` and are the single place to adjust when the platform DTOs land.

## Verification (19 October 2026)

See the W2 handoff for exact results. Commands:

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run tests/unit/api/b07-onboarding-client.test.ts tests/unit/api/b07-onboarding-bff.test.ts tests/unit/api/b07-onboarding-access.test.ts tests/unit/b07-meet-co-logic.test.ts tests/integration/b07-meet-co.test.tsx tests/integration/b07-curriculum.test.tsx
B07_BROWSER_BASE_URL=http://localhost:<dev-port> node node_modules/@playwright/test/cli.js test -c tests/visual/b07/playwright.config.ts
```

The Playwright spec (`tests/visual/b07/onboarding-review.spec.ts`) drives `/dev/onboarding` with mocked HTTP routes at 390 (kids), 1024 (tweens) and 1440 (teens), one RTL case, reduced motion, failed-save retry and resume. It is UI-only: no database, identity record or model is involved. Screenshots go to `output/b07`.
