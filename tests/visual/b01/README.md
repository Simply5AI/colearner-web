# Isolated B01 browser fixtures

This Vite harness imports the actual role shell, navigation configuration, design components and CSS. Next Link/pathname are replaced only in this harness with an in-memory navigation adapter. Parent/school-admin/researcher destinations here are explicit visual fixtures, not published application routes or authorization evidence. No roles, credentials or API bypasses are added to the application.

From the web root: `node tests/visual/b01/serve.cjs` (uses the already installed Vite dependency of Vitest). Open `http://localhost:3103/tests/visual/b01/` with query parameters `role`, `band`, `path`, `dir=rtl`, `long=1`, or `theme=dark` to qualify layout variants. Real protected student/teacher/admin adapters retain their existing auth gates and are checked with focused tests. Browser review must supplement these fixtures with the actual Next public/authentication pages.

`mock-api.cjs` is an isolated localhost-only auth-outcome fixture for Next browser checks. It rejects login/registration and returns generic forgot/reset confirmation, sends no email and persists no data. Run `node tests/visual/b01/mock-api.cjs` on port 3102 and point a process-scoped test Next server at it; never configure a deployed application to use it. Test credentials/tokens must be fictional. No Google provider login is simulated by these fixtures.
