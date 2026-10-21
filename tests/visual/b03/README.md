# B03 private browser review

**Status, 19 October 2026: browser acceptance passed against the private synthetic fixture — 7/7 cases and 18/18 viewport records, in two consecutive full runs** (see `docs/b03-family-web.md`, "Browser acceptance — 19 October 2026"). Earlier pause (15 October) and interrupted runs remain excluded. This is a focused Next/Auth.js/Nest/PostgreSQL/Redis review, not production readiness.

**Run rules learned on 19 October (all required for a trustworthy run):**
- Write artifacts OUTSIDE the Next project while the suite runs: set `B03_REVIEW_OUTPUT_DIR` to a directory outside `colearner-web` (the config and spec honour it), then copy the screenshots and `viewport-results.json` into `output/playwright/b03` after the run. Any file written under the project root (including `output/`) makes Next dev (webpack) rebuild and rewrite `app/layout.js` while the browser is fetching it, which delivered a truncated script (cut at a 64 KiB multiple) and produced the intermittent "Invalid or unexpected token" SyntaxError. This was the root cause of the earlier unexplained failures; trace recording was not involved.
- Run `node tests/visual/b03/warm-routes.mjs` once after starting Next so no first-time route compilation happens during a counted case.
- Production per-IP throttles on `POST /family/devices`, `PUT .../pin` (5 per 15 minutes) and unlock (10 per 15 minutes) are in-memory in the API process: a full suite uses at most 3/3/5, so restart the private API before each full rerun.
- Cases that permanently bind an account use fresh synthetic accounts from the fixture-only `POST /review-fixture/accounts` route (admin only), so the suite is rerunnable on the retained database.

Run only against the root-owned B03 fixture: Next on `http://localhost:3101`, Nest on `http://127.0.0.1:3102`, PostgreSQL `b03_review` on loopback 25432 and Redis on loopback 25479. Root’s fixture refuses any other database target. Do not apply its from-empty schema to a configured project database. Real project migrations remain user-run review gates.

The fixture uses synthetic `admin`, `teacher`, `parent`, `student`, `teen`, `teeninvite` and `outsider` accounts at `b03.example.test`, with the fictional password recorded in the private server source. `teeninvite` is initially a verified personal account with no school membership. The authenticated private `/review-mailbox` captures matching synthetic mail only; this is not real mail-delivery verification. No fixture route is added to the public web application.

Root owns starting/stopping this review environment. Use the bounded `COLEARNER_REVIEW_DIST_DIR=.next-b03-review` so it does not collide with another task’s Next output. Exactly one process may write each output directory. No `.env` files need editing. External OAuth/reCAPTCHA/analytics/provider keys remain empty in this review process. Keep separately managed AI-platform or B06 services untouched.

Before qualification, sequentially warm `/login`, `/age`, `/consent`, `/profiles`, `/learner`, `/student-invite` and `/api/auth/session`. Also warm `GET /api/family-access/profiles` to its expected unauthenticated 401: its first cold compilation can exceed the production 15-second browser request deadline. Retain that deadline. Select the school through the real workspace action and wait for its `/academics` URL and heading before entering students or policies. Credential fields and family form controls remain disabled until React attaches their handlers; helpers wait for actual enabled controls and verified-email readiness before typing.

From the web directory:

```powershell
node node_modules/@playwright/test/cli.js test --config tests/visual/b03/playwright.config.ts
```

Seven independent cases use real authenticated operations and unique synthetic roster records. They cover school-admin child-bound invitation UI, guardian verification/exact consent/profile/initial restrictions/PIN, adult-session revocation and child-cookie separation, consent withdrawal, wrong-PIN lockouts across navigation, DOB-only handoff approval only after actual school-linked consent, 18 actual LTR/RTL viewport records at 1440, 1024 and 390 pixels, phone keyboard/reduced-motion/retained-draft retry, distinct child-to-adult handoff, and teen personal invitation acceptance with summary privacy and no legacy conversation history. The explicit 503 in the retry case is test-only and the retry reaches the real local API.

Screenshots and `viewport-results.json` go to `output/playwright/b03`; failure traces go to `output/playwright/b03/failure-artifacts`. Evidence contains fictional names/IDs and may show development tools. A cold Next build interruption or unavailable runtime is a failed/blocked check, never a pass; warm the affected route and rerun the relevant case after fixing the cause.

This is a focused Next/Auth.js/Nest/PostgreSQL/Redis integration review. It does not claim full production AppModule startup, live Google/provider verification, real email delivery, deployed database migration, target-environment RLS or a public deployment.
