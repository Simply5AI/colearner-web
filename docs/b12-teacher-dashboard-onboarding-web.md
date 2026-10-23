# B12 W1: teacher foundation, T1 dashboard, T8 onboarding (web)

Scope: `lib/api/teaching/{core,dashboard,onboarding,profile}.ts`, `lib/auth/teacher-access.ts`, `components/teacher/{teaching-context,teacher-shell}.tsx`, `components/teacher/dashboard/**`, `components/teacher/onboarding/**`, routes `/teacher/dashboard` and `/teacher/onboarding`, harnesses `/dev/teacher/dashboard` and `/dev/teacher/onboarding`.

## Transport
- `teachingRequest` wraps `schoolRequest`. `schoolRequest` carries no custom headers, so a call that passes headers (Idempotency-Key) uses the same fetch contract and status mapping inside `core.ts` and also surfaces the platform error `code` and `currentRevision` (`TeachingApiError`). Calls without headers go through `schoolRequest` unchanged.
- `TeachingProvider` takes an optional `requestImpl` used only by harnesses and tests. `useTeachingResource` is a React Query GET with Zod parse; a response that does not parse becomes a retry state, never a render.

## Access
- `requireTeacherWorkspace()` is a navigation hint (cookie membership checked against `GET /school-identity/workspaces/:id`). The platform authorises every call again.
- `(teacher)/layout.tsx` admits a legacy TEACHER role or a verified teacher workspace. School-only teachers see "Students" and "Insights" as "Arrives with a later release" because those legacy pages need the legacy role (B13/B14).
- Consequence: a legacy-role teacher with no school workspace is sent to `/workspaces?denied=1` from the dashboard and onboarding pages (contract 10.2).

## T1
States: loading, default, new teacher, drafts ready, no class, denied, unavailable, retry. Measured panels (this week, plan progress, recent activity) are separate from everything else; there is no AI text in B12. At-risk, worksheet-draft and extra-practice cards are honest later-release panels showing the server reason. Assign to class opens W2's `AssignClassPanel` for the plan named by the `INVITE_STUDENTS` checklist route, and the success note appears only from the panel's success callback.

## T8
Five steps with a progress list, resume at `state.step` (the URL `?step=` can only go back, never ahead), skip only on Material and Invite. First plan embeds `NewPlanOptions`; Invite embeds `AssignClassPanel`; Material adds a link or a file or photo to the plan's first topic through the section 6.4 routes. Done copy comes from `firstPlan.studentVisibility` and says "live" only for `ASSIGNED`.

## Deferred or partial
- Co draft, syllabus upload: UNAVAILABLE (B12.5). Invite codes, links, QR: later release (B14). Photo field hidden when storage is unavailable.
- Material step: video file upload is not offered here (use the plan editor).
- Only verified against fixtures until the platform P2/P3 routes are live.

## Verify
`pnpm type-check`; `pnpm vitest run tests/unit/b12-w1-teaching-foundation.test.ts tests/integration/b12-w1-*.test.tsx --testTimeout=20000`; with `pnpm dev` on :3001, `npx playwright test -c tests/visual/b12/t1-t8-playwright.config.ts` (artifacts in `B12_W1_OUTPUT_DIR`, default the OS temp directory).
