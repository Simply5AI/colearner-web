# B13 W2: CSV import and worksheets (web)

Routes: `/teacher/questions/import?planId&importId`, `/teacher/plans/[planId]/worksheets`, `.../[worksheetId]`, `.../print`, `.../answer-key`. Dev harness: `/dev/teacher/worksheets?view=import|list|builder|print|answer-key&state=default|empty|denied|unavailable|slow|expired|conflict&ws=ws-final` (labelled fixtures only).
API: `lib/api/teaching/question-imports.ts` (includes `uploadTeachingFile` multipart helper), `lib/api/teaching/worksheets.ts`. Print CSS: `styles/print-a4.css`.
Policy shown to teachers: D10 VALID_ROWS_ONLY; fill-for-me is a deterministic rule (D6), not AI.
