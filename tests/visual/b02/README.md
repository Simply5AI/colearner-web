# B02 local school review

This private review uses real Next/Auth.js and Nest auth/session/school controllers against synthetic PostgreSQL/Redis data. It exposes no product role simulator. The Nest profile projection is deliberately limited to fixture account fields; this is not a full production application startup, live provider or target-database release test.

Root's dedicated Docker containers are `colearner-b02-postgres-review` and `colearner-b02-redis-review`, labelled `colearner.review=B02`, with loopback ports 25432 and 25479. Never point tests at a configured project database. Integration suites refuse non-local opt-in URLs. The review server source additionally requires the exact `b02_review` database on 127.0.0.1:25432.

From `colearner-platform`, compile the permanent fixture configuration:

```powershell
node node_modules/typescript/bin/tsc -p apps/api/test/b02-review.tsconfig.json
$env:B02_TEST_DATABASE_URL='postgresql://b02_review:b02_review_local_only@127.0.0.1:25432/b02_review'
$env:B02_REVIEW_ACCESS_SECONDS='20'
$env:NODE_PATH=(Join-Path (Get-Location) 'apps/api/node_modules')+';'+(Join-Path (Get-Location) 'node_modules')
node .cache/b02-review/dist/test/b02-review-server.js
```

The credentials above are fictional and local-only. Initial schema creation uses from-empty SQL only in a new disposable database, followed by the canonical B02 checks. Never apply that full-schema fixture SQL to an existing project database; reviewed production preparation is `docs/migrations/B02-school-identity-additive.sql`. Existing retained fixtures can be restarted rather than recreated. The API seeds synthetic personal accounts and two schools; password reseeding invalidates old review sessions, so start fresh browser contexts.

The private server binds 127.0.0.1:3102. It disables remote mail/inference configuration. Its login IP throttling is skipped only inside this test process to support repeated fictional logins from one loopback IP; actual auth/session validation, live membership checks and other guards remain. Production login metadata remains five requests per 15 minutes and has an explicit contract regression. This browser suite does not claim to verify production ingress or mail delivery.

Start the web dev server on localhost:3101 with process-local `NEXT_PUBLIC_API_URL=http://127.0.0.1:3102`, fictional `AUTH_SECRET`/`NEXTAUTH_SECRET`, `AUTH_URL`/`NEXTAUTH_URL=http://localhost:3101`, `AUTH_TRUST_HOST=true`, and empty Google credential pairs, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, Sentry and PostHog provider settings. Do not edit tracked or local environment files. Only one Next writer may use this checkout.

From `colearner-web`:

```powershell
node node_modules/@playwright/test/cli.js test --config tests/visual/b02/playwright.config.ts
```

Six independent cases cover semantic token expiry and cookie persistence; academic setup/manual/CSV/staff actions; verified-email invitation acceptance; cross-school/teacher/parent denial; 18 actual 1440/1024/390 LTR/RTL viewport records; and phone keyboard/drawer/skip focus, retained drafts after a simulated 503, retry and the final control above fixed navigation. API setup uses authenticated real operations and unique per-case records, not earlier tests' side effects. The expiry case intentionally waits for the fixture credential's actual expiry; UI readiness uses observable navigation and controls.

Screenshots and `viewport-results.json` are written under `output/playwright/b02`. They contain fictional data and may show development tools. The injected 503 is clearly test-only and the retry reaches the real local API. After review, stop only the owned servers/containers; do not stop separately managed AI-platform services.
