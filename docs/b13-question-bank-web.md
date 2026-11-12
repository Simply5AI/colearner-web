# B13 W1: teacher question bank (web)

Routes (teacher shell, `TeachingWorkspace` guard): `/teacher/questions` (list), `/teacher/questions/new?planId&topicId`, `/teacher/questions/[questionId]`, `/teacher/questions/review/[batchId]`. Nav entry "Question bank" in `components/roles/role-config.ts`. Import (`/teacher/questions/import`) and worksheets belong to W2; the list only links to the import page.

Code: `lib/api/teaching/{question-schema,questions,co-drafts}.ts` (local Zod mirror of contract sections 5, 6.1-6.3; `satisfies` against local interfaces because api-client 0.10.0 is not vendored, the web pins 0.4.0), `components/teacher/questions/{question-bank-list,question-editor,question-fields,question-flags,question-provenance,co-draft-dialog,co-review-queue,use-question-apis}`. Legacy `question-form`, `questions-list-view`, `ai-coauthor-modal`, `bulk-import-modal` are untouched.

Dev harness (synthetic fixtures, development only): `/dev/teacher/questions?view=list|editor|new|review&state=default|empty|denied|error|co-unavailable|conflict|batch-running|batch-failed|slow`, with `question=q-1`, `batch=batch-101`, `plan=plan-fractions`. The "Co" drafts there are hand-written fixtures.

Tests: `pnpm exec vitest run tests/integration/b13-question-*` (helper `b13-question-helpers.tsx`).

Known gaps against the contract (see handoff): flag ids are optional in the schema; the shared transport drops 422 `details`.
