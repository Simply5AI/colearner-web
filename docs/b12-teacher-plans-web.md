# B12 web: teacher plans, material and lessons (W2)

Dated 22 October 2026. Scope: T2 (plan list and new plan), T3 (two-pane plan editor, material, lessons, student preview, worksheet placeholder), the assign-to-class panel (contract 6.10) and the learner-side teacher lesson reader. Contract: `agents/contracts/B12-contracts.md` sections 1, 5, 6.3 to 6.7, 6.10, 7, 8, 10, 11.

**Verified only against mocks.** The platform routes (`/api/v1/schools/:schoolId/teaching/*` and the two learn routes) were being built in parallel. Every behaviour below was exercised against an in-memory fixture shaped like the contract (`app/dev/teacher/plans/mock-server.ts`) or a stubbed `fetch`. Nothing here proves the real API, real RLS, real storage or real guardian-approval flow.

## Routes

| Route | Screen |
|---|---|
| `/teacher/plans` | T2 list (cards or table, status tabs, class filter, search, cursor "Load more") with the New plan dialog |
| `/teacher/plans/new` | The same list with the New plan dialog open |
| `/teacher/plans/[planId]` | T3 editor. `?topic=` selects a topic, `?assign=1` opens the Assign to class panel |
| `/teacher/plans/[planId]/topics/[topicId]` | The topic workspace on its own page (materials, lesson, preview, worksheet) |
| `/teacher/plans/[planId]/topics/[topicId]/materials` | Redirects to the topic page |
| `/learn/plans/[planId]` | Existing learner plan; a topic with a published teacher lesson shows "From your teacher" with an Open lesson button |
| `/dev/teacher/plans`, `/dev/learn/teacher-lesson` | Development fixtures only; both call `notFound()` outside development |

Pages are thin server wrappers. Data is fetched in the browser through `useTeaching().request` (W1), parsed with Zod, and cached with React Query under `['teaching', schoolId, ...]`.

## Files

- `lib/api/teaching/`: `plans.ts` (schemas, error reading, `IntentKey`, outline check), `topics.ts`, `materials.ts` (file and link checks, presigned upload), `lessons.ts`, `lesson-schema.ts` (lesson Zod, strict learner schema, band lint), `assignments.ts`.
- `components/teacher/plans/`: `new-plan-options.tsx`, `new-plan-dialog.tsx`, `teaching-plans-list.tsx`, `plan-workspace.tsx`, `plan-tree-pane.tsx` + `tree-model.ts`, `topic-workspace.tsx`, `lesson-tab.tsx` + `lesson-draft.ts` (autosave hook) + `lesson-editor.tsx` + `lesson-block-editors.tsx` + `lesson-lint-panel.tsx` + `lesson-preview.tsx` + `lesson-publish-dialog.tsx`, `publish-review-dialog.tsx`, `plan-details-dialog.tsx`, `assign-class-panel.tsx`, `plan-topic-screen.tsx`, helpers.
- `components/teacher/materials/`: `topic-materials-panel.tsx`, `add-material-form.tsx`, `linked-questions-panel.tsx`.
- `components/learn/teacher-lesson-reader.tsx` (reader, panel, lesson link); additive edits to `components/learn/learn-plan.tsx`, `lib/api/learn.ts` and `app/api/learn/[[...path]]/route.ts`.

The old single-form plan editor, create form, list and materials list files in these folders are no longer referenced by any page. They were left in place (not deleted) because B22 retires them; `plans-list-view.tsx` still carries one unused-variable lint error that predates this batch.

## Exported contracts

- `NewPlanOptions({ onCreated(plan: TeachingPlanDetail), defaultClassId? })` in `components/teacher/plans/new-plan-options.tsx`.
- `AssignClassPanel({ planId, defaultClassId?, onAssigned(a: PlanAssignment) })` in `components/teacher/plans/assign-class-panel.tsx`. `PlanAssignment` is exported from `lib/api/teaching/assignments.ts`.

## Behaviour decisions

- **Every mutation sends `Idempotency-Key`** (so the W1 transport also keeps the platform error `code` and `currentRevision`) and, where the contract has one, `expectedRevision`. A retry of the same intent reuses one key (`IntentKey`); a changed body gets a new key.
- **Responses are Zod-parsed.** A mismatch is a 502 "unexpected response", never a half render. The learner lesson view and linked questions use `z.strictObject`, so `correctOptionId`, option `feedback`, `explanation` or `correctAnswer` in a learner or question-list payload fail the parse (tested).
- **Frozen plan.** A PUBLISHED plan shows the tree read-only with the reason, no drag handles and no structure controls. Materials, lessons and due dates stay editable. ARCHIVED is read-only.
- **Tree.** Reorder within one parent by pointer drag, keyboard drag (space, arrows, space) or move buttons, with screen reader announcements and an `aria-grabbed` handle. Edits are optimistic and roll back with a message when the save fails. A removal of a node with material, questions or a lesson asks first and sends `confirmRemoveNodeIds`. Cross-parent moves (indent, outdent, move to another phase) are not offered.
- **Lessons.** One draft per variant, saved automatically after a 1.2 s pause with the draft revision. Same content is never re-sent. A draft that breaks a hard rule is not sent; the missing items are listed and the edits stay. A failed save keeps edits and offers a retry. A revision conflict offers "keep my edits" or "load the saved draft". Publishing is its own dialog showing the learner view and who sees it and when. The band lint (sentence length, tables only for 14-17) is deterministic and never blocks.
- **Preview as student.** Uses `GET .../lessons/:version/preview?band=` and draws the server's `view` with the same `TeacherLessonReader` the learner gets. Three bands only (adult band is B24). A check in a preview gives no feedback because feedback comes from the server for a learner.
- **AI.** "Let Co draft it", "Generate lesson with Co", "Generate worksheet" and "Make easier or harder with Co" render disabled with the server reason as visible text. No spinner or canned result exists in production code. Manual easier or harder copies use `duplicate-as` and are teacher-visible only.
- **Assign to class.** Class picker limited to classes that teach the plan's subject and are not yet assigned; counts only (no student names); admin-created assignments are read-only. Unassign confirmation states who is revoked (pending guardian approval, and active learners who have not started) and who is kept (active learners who have started); the exact numbers returned by the server are shown after.
- **Learner reader.** Plain text only (never HTML), no links in blocks, sources as chips to published material, focus moves to the step heading on step change, native radios and buttons, motion only under `motion-safe`. Labelled "From your teacher", never with the Co or AI badge.

## Gaps and follow-ups (honest list)

1. **Eligibility preview in the New plan dialog** shows the roster size, the grade's usual band and a mismatch note, but not per-band counts: the contract has no pre-create eligibility route. The per-band counts, unknown and outside-target numbers show in Plan details after creation. A `GET /eligibility?classId&band` route would close this.
2. **Unassign confirm** cannot show the exact revoked and retained numbers before the action (the contract returns them only from `DELETE`). It states the rule with the known pending and active counts and shows exact numbers right after. A dry-run count would close this.
3. **Curriculum chapters.** `source.chapterIds` is optional in the contract and there is no chapter list route, so the whole subject curriculum is used.
4. **Cross-parent tree moves** are not offered.
5. **Legacy unscoped master plans** open as "not found" in the new editor (the contract never lists or edits a plan without a scope row). Adoption (`PUT .../scope`) has no UI in B12.
6. **Linked-question authoring and worksheet export** are B13; the panels say so.
7. **Photo capture** needs the server's `features.photoUpload` to be available; otherwise the option is disabled with the reason.

## Verification

See the final report of the W2 run for exact commands and results. Commands:

```
pnpm type-check
npx eslint <W2 files>
npx vitest run tests/unit/b12 tests/integration/b12 tests/unit/api/b12-teacher-lesson-bff.test.ts --maxWorkers=2
B12_W2_CHANNEL=chrome B12_W2_BASE_URL=http://localhost:3001 npx playwright test -c tests/visual/b12/w2-playwright.config.ts
```

`B12_W2_CHANNEL=chrome` uses the installed Google Chrome when the bundled Playwright Chromium is not installed. Artifacts go to `B12_W2_OUTPUT_DIR` (default `/tmp/colearner-b12-w2-web`), outside the Next root.
