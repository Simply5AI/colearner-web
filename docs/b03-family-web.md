# B03 guardian consent, shared-device access and school rules

This slice implements the A3–A5 supplied Welcome prototype using B01 Co artwork, local typography, warm white/lilac surfaces and orange actions. S3 guardian details and S6 policies extend B02’s actual school shell; those screens had no independent supplied mockup. No prototype people, progress scores, fake device state, role switch or cloud voice runtime was introduced.

**Paused on 15 October 2026; resumed and re-verified on 19 October 2026.** Focused tests, full TypeScript, scoped lint and the real browser review now pass against the current source; see "Browser acceptance — 19 October 2026" at the end. The 15 October text below is retained as history.

## Actual routes and feature ownership

| Route | B03 behavior |
| --- | --- |
| `/signup`, `/login` | F-A2-05,07: minimal email/password account, no child name or school collection; safe callbacks to age/consent/invitation; shared-device and guardian entry links |
| `/age` | F-A3-01–07: authenticated DOB-only server age check, under-six unavailable, adult workspace handoff, guardian-present/send-link, masked address, resend/change, real pending/expired/approved state and manual/polled approval checks |
| `/consent` | F-A4-01–08: current email verification; exact child-bound school invitation; adult DOB declaration plus school evidence; exact version/hash notice and visible legal-review-pending label; optional voice/sharing initially off; post-consent nickname, Co colour, CBSE/ICSE Classes 1–10 and school-derived context; initial time/quiet/material/import rules; picture PIN or teen personal-email invitation; add-child and family handoff |
| `/student-invite` | Verified matching student email consumes the exact school-authorized teen invitation; no account merge or browser-selected child binding |
| `/profiles` | F-A5-01–07: real eligible profile tiles, school choice, 9-picture/3-sequence PIN, optional strictly local device speech, wrong-PIN help, server lockouts and fresh adult sign-in for parent/add-profile actions |
| `/learner` | Scoped opaque child-session context and live restrictions; eligible personal teen login separately lists only actually bound profiles and requires explicit profile choice. Full learning workspace remains a later batch |
| `/family` | B03 family-access hub: actual verified child links, consent withdrawal/review, effective restrictions and reason explanations, PIN reset, under 14 authorized access vs teen summaries and audited reasoned safety access. No fabricated conversation history or future P1 progress dashboard |
| `/org/[schoolId]/students` | F-S3-03: independent per-child guardians/invitations, school evidence reference, one-time secure-distribution code, revoke and explicit existing student-account binding. Each sibling requires its own invitation |
| `/org/[schoolId]/policies` | F-S6-01–04: school time/timezone/quiet hours, visibility scopes and separate SNAP/PDF/YOUTUBE/WEB/TEXT/DOCUMENT/AUDIO/VIDEO permissions, voice/groups, actual approved education versions, optimistic revision and unavailable-capability explanations |

All 29 B03-owned feature IDs have an actual UI/API behavior. Current parent verification is a dated adult declaration, verified current email and school-recorded authority evidence, not government identity verification. Legal text is a deployment-versioned placeholder and stays visibly pending legal review; production enablement needs the reviewed notice and legal approval. A child’s handoff email requests help and does not grant guardian authority. Approval requires the authenticated learner’s actual matching roster/profile/DOB and current canonical consent.

## Authentication and browser boundaries

Canonical family response types come from portable `@colearner/api-client` 0.4.0. Small compatible changes remain on API v1. Authenticated account operations resolve the current Auth.js session before every request and never replay writes after a rejection. Device and child operations go through an explicit same-origin allowlist in `/api/family-access/[...operation]`; this is credential transport, not a second business runtime. Mutation requests require a matching Origin. Opaque device/child tokens are HttpOnly, SameSite=Lax, production-Secure cookies and never enter session JSON, browser storage or URLs.

The root and legacy onboarding/dashboard layouts first read the minimal live `/family/access-status` decision. Unknown ages and minors cannot render the legacy name or school forms; an old `onboardingCompleted` claim cannot bypass this check. School administration and teacher workspaces retain their independent verified-membership gates. The grown-up-present action signs the child account out before a distinct adult sign-in, retaining only a nonsecret age-check reference. Google requests only openid/email identity; provider name/photo defaults are discarded, and only a matching verified application profile can restore an existing stored name/avatar.

Device enrollment verifies a fresh password or server-recorded recent sign-in, then the backend revokes the originating adult JWT/refresh session. The browser response removes every Auth.js session-cookie chunk and selected-school preference. Both enrollment and child unlock first revoke any separate platform administrator session through the existing authenticated logout boundary and clear its session/preauthentication cookies. A failed administrator revocation blocks child-mode entry. If a parent signed back into the account after enrollment, unlock also revokes that new account session before creating child access. PIN unlock creates a distinct opaque child token and removes any stale adult cookies again. Parent/add-profile uses a new real account sign-in. Recent OAuth/password freshness can be requested by omitting a password; only the server’s original login record decides whether it is fresh, never client time or a checkbox assertion. Password refresh does not renew the original login freshness.

Picture sequences stay in component memory and are submitted only to the backend verifier. Exactly nine labelled pictures and three ordered choices are supported, including repeats. Actual incorrect codes count toward UI help; outages/consent denial do not masquerade as wrong PINs. Server-wide lockouts cannot be reset by navigating back, changing devices or selecting another school. Read-aloud explicitly selects only a `localService` speech voice, otherwise shows a written-instruction fallback; no microphone, remote voice or AI inference is used.

Mail credentials use fragments, are removed from browser history after reading and are never written to storage. Anonymous invitation entry asks the user to sign in and reopen their email; it does not persist a one-use credential across login. School guardian issuance returns a code once for secure distribution and never claims mail delivery. Learner handoff and teen invitation success are displayed only after the backend delivery operation succeeds. The registration proxy uses the canonical v1 base and no longer logs registration payloads or token-bearing backend responses.

## Policy and interaction states

React Query owns server state; query keys include the current account or scoped credential context. Mutations disable automatic retries. Every server-backed screen provides pending, safe error/denied, empty and manual retry states; drafts survive failures. Policy writes carry the reviewed revision and preserve drafts after conflicts. Visibility scopes (`school`, `class`, `learner_private`) remain distinct from import media (`SNAP`, `PDF`, `YOUTUBE`, `WEB`, `TEXT`, `DOCUMENT`, `AUDIO`, `VIDEO`). New parent settings start at 45 minutes and SNAP only; the effective result can be stricter. Timezone must be explicitly chosen. Missing school policy, consent or approved capability is shown truthfully. Permission controls do not claim that an import processor is ready; actual import entry points check their processor independently.

Profiles never combine child records across schools. School administrators cannot grant guardian consent or browse conversations. Family conversation endpoints return a truthful empty state until school-scoped conversations are implemented; a teen safety grant is audited, scoped, expiring and requires a fresh password or server-recorded recent sign-in plus a specific reason. No legacy cross-school conversation data is exposed.

## Verification

The earlier focused run passed **139 distinct tests across 11 files** on 15 October 2026 with one worker: **72 new cases and 67 adapted retained regressions**. Full web TypeScript and scoped ESLint also passed against the installed canonical SDK 0.4.0. These results precede the subsequent safe POST/hydration safeguards and scoped family-access 401 fix; they are not final qualification of the current source. Unit/UI tests use fictional in-memory responses, not a production API claim.

| File under `tests/` | Passed | Scope |
| --- | ---: | --- |
| `integration/b03-family-web.test.tsx` | 24 | New family forms, consent, wrong PIN, outage and adult handoff |
| `unit/api/b03-family-client.test.ts` | 14 | New credential resolution and safe transport |
| `unit/api/b03-family-bff.test.ts` | 16 | New cookie separation, administrator/account revocation and fail-closed entry |
| `unit/api/b03-family-entry.test.tsx` | 16 | New live age/consent gate before legacy identity forms |
| `integration/b01-public-auth.test.tsx` | 12 | Retained, minimal-signup expectation adapted |
| `integration/b01-recaptcha.test.tsx` | 6 | Retained, minimal-signup expectation adapted |
| `integration/b02-school-web.test.tsx` | 15 | Retained actual school forms and scope |
| `unit/api/b02-session-routing.test.ts` | 12 | Retained refresh/session boundaries |
| `integration/b01-public-routing.test.tsx` | 12 | Retained routes with explicit authoritative adult fixture |
| `integration/role-layout-gates.test.tsx` | 6 | Retained personal/role shell gates |
| `unit/api/auth-callbacks.test.ts` | 6 | Four retained and two new provider-privacy cases |

Browser qualification remains **0 accepted cases / 7 planned cases and 0 accepted / 18 planned viewport records**. Interrupted and failed runs exposed cold compilation, helper readiness/selection races, localhost IPv6 transport, recurrent development-script parsing failures, and a real collision between expected device 401 responses and the global adult sign-out handler. Helpers now use actual revisions, completed workspace selection, enabled verified-email controls and same-origin browser fetch. Product forms use POST and keep sensitive controls disabled until hydration. Device/child transport labels its own credential failures so they cannot sign an unrelated adult account out; ordinary account-session 401 handling remains. Existing profile regressions were updated to use the actual global QueryProvider, but have not yet rerun. Failed-script capture and zero-page-error assertions are preserved. The requested trace-off comparison, final seven browser cases, 18 viewport records and all checks of the latest source remain pending after the explicit pause. No interrupted case is counted as a pass.

The private Playwright review lives at `tests/visual/b03`. It uses real local Next/Auth.js, Nest controllers, PostgreSQL and Redis with synthetic users and an explicitly captured private mailbox. It must refuse a missing B03 review-health marker and must never use a configured project database. Review mail capture does not verify real mail delivery, Google, deployment configuration or a production migration. Root owns fixture lifecycle and final acceptance.

## Release and rollback

Enable only with the reviewed B03 platform schema/API, retained B00A auth/session configuration and legal release gates. No persistent project database migration, deployment or destructive cleanup is performed by this slice. Roll back B03-owned family routes/BFF/components and documented signup/school-navigation integration while retaining additive identity/consent/audit data. Never restore adult credentials inside child sessions or remove school/guardian verification as a rollback shortcut. B06 learning and later parent progress/conversation experiences remain their own authorized batches.

## Browser acceptance — 19 October 2026

Scope: private synthetic fixture only (Next dev/webpack on `http://localhost:3101` with `.next-b03-review`, a freshly compiled private Nest fixture on `127.0.0.1:3102`, PostgreSQL `b03_review` and Redis on loopback 25432/25479, fictional `b03.example.test` accounts, captured private mailbox). It does not verify production AppModule startup, real mail, live OAuth, target-database migration/RLS or deployment. No `.env` file was edited and nothing was committed.

**Results (final source, two consecutive full runs plus a separate strict first-case run with `--trace off`):**

| Check | Result |
| --- | --- |
| Strict first case, trace recording off, CDP failed-script capture and zero-page-error assertion retained | Passed (1/1) |
| Full suite, run 1 | 7 passed, 0 failed (3.0 min) |
| Full suite, run 2 (API restarted, fresh synthetic accounts) | 7 passed, 0 failed (3.1 min) |
| Viewport records (`viewport-results.json`, dated 2026-10-19) | 18/18 recorded, none with horizontal overflow or controls outside the viewport (policies/consent/PIN x 1440/1024/390 x LTR/RTL) |
| Focused web tests (11 files) | 140 passed (139 earlier + 1 new regression) |
| `tsc --noEmit` (web) | Passed, exit 0 |
| Scoped ESLint (83 B03/family files plus the new route module, visual specs and warm script) | 0 errors, 0 warnings |

Cases: (1) school-admin child-bound invitation UI, guardian verification, exact consent, profile, restrictions, PIN, adult JWT 200 before enrollment and 401 afterward, child-cookie isolation, consent withdrawal; (2) wrong-PIN lockout across navigation; (3) DOB-only handoff approved only after school-linked consent; (4) 18 viewport records; (5) phone keyboard, reduced motion, retained draft and retry after an explicit test-only 503; (6) grown-up-present handoff with distinct adult sign-in; (7) teen personal invitation, summary privacy and no legacy history. Case 3 reached the approved state through the page's 15 s polling before the manual "Check approval" button was needed, so the manual button path was not exercised in the passing runs.

**Failures found while resuming, root causes, changes (none left unresolved):**

1. Intermittent `SyntaxError: Invalid or unexpected token` (previously unexplained). Captured scripts were `/_next/static/chunks/app/layout.js` cut at exactly 393,216 / 458,752 bytes (multiples of 64 KiB) of a 3,012,251-byte file. Writing any file under the project root (the harness's own screenshots and failure artifacts under `output/`) made Next dev rebuild and rewrite that chunk while the browser was loading it (verified: touching a file in `output/` changed the chunk's `Last-Modified` within seconds). Trace recording was not a factor. Fix (harness): `B03_REVIEW_OUTPUT_DIR` writes artifacts outside the project while running; plus `tests/visual/b03/warm-routes.mjs`. No product change. After the fix no page error occurred in any run.
2. Product defect: `app/api/family-access/[...operation]/route.ts` exported a non-method symbol (`familyAccessRoute`), which fails Next's generated route type validation (`tsc` reported TS2344 against `.next-b03-review/dev/types`, and Next's own route type check would be expected to reject it in `next build`, which was not run). Fix: handler moved to `lib/api/family-access-route.ts`; the route file now exports only `GET`, `POST`, `DELETE`. Regression: `tests/unit/api/b03-family-bff.test.ts` asserts the route module's exports are exactly those three. No runtime behavior change.
3. Harness expectation errors (product behavior correct): `/api/auth/session` returns `null` after enrollment, so the spec now reads `session?.accessToken`; after a real consent withdrawal the opaque child session is revoked by the API (`revokeAuthority`), so `/api/family-access/child` is 401, not 403 (403 occurs only for a still-valid session denied by policy, as in the backend integration test that edits the consent row directly); `getByRole('alert')` also matched Next's empty route announcer and is now filtered by text.
4. Harness/fixture: the review-only `/review-mailbox` route was blocked by the learning guard for unknown-age invitees (`SCHOOL_SCOPED_LEARNING_REQUIRED`); it is now marked `@SchoolScopedLearning()` in `apps/api/test/b03-review-server.ts`. Cases 3, 6 and 7 permanently bind seeded accounts, so a rerun on the retained database failed; they now create fresh synthetic accounts through a fixture-only admin route (`POST /review-fixture/accounts`) in the same private server.
5. An unbounded run of reruns hit the production per-IP throttles on device enrollment and PIN save (HTTP 429 shown as the picture-lock message); these are in-memory in the API process and were reset by restarting the private API. Production limits are unchanged.

**Visual review of the generated screenshots** (1440, 1024 and 390; LTR and RTL; PIN, consent, policies, lockout, teen summary, phone retry): layouts hold at every width, the legal-review-pending label, disabled-until-ready controls and lock message render correctly, and no content overflows. Observed minor defects, not fixed: on the school policies page at 1024 and 1440 the "Daily time limit" input is taller and sits about 14 px lower than the adjacent "Timezone" input; at 390 RTL the policy-version select clips the start of its long placeholder text; full-page captures show the fixed mobile bottom navigation and the 900 px-tall sidebar mid-page (capture artifact); with many linked children the `/family` child chips form a long unbounded list (synthetic data accumulated this fixture; no pagination or search). RTL was emulated by setting `dir` on English content, so mirrored punctuation is a test artifact. 1024 pixel screenshots are not produced by the suite; three were captured separately (`output/playwright/b03/s1024-*.png`).

Evidence: `output/playwright/b03/` (screenshots, `viewport-results.json`). Not run: the platform backend suites (platform source changed only in the private test harness `apps/api/test/b03-review-server.ts`, which recompiled cleanly), real mail/OAuth, production build.
