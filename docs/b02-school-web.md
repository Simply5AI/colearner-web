# B02 school membership and academic screens

B02 adds real school workspace selection, invitation and verified-email entry, school-admin academic/roster/staff screens and a scoped teacher assignment landing. It reuses the B01 white/lilac surfaces, orange actions, local Nunito/Geist typography, adult presentation band and responsive role shell. S2–S4 had no individual supplied prototypes; their school workflows use that shared foundation. No prototype data, UI-only role switch, prices, independent tutor registration or AI inference was introduced.

## Actual routes and feature ownership

| Route | Delivered behavior |
| --- | --- |
| `/workspaces` | Authenticated, server-listed active school memberships; verified selection and paginated chooser; email verification request/confirmation; invitation entry; truthful retained personal account route |
| `/invite` | Sign-in required; opaque code entered in the form, accepted only through verified-email/backend identity checks; acceptance grants membership, not guardian access |
| `/org/[schoolId]/academics` | S2: years and terms with dates, CBSE/ICSE grades1–10/sections, class create/archive/restore, roster/assignment links and non-mutating promotion preview |
| `/org/[schoolId]/students` | S3 B02: manual school-local student records, optional explicit verified membership link, CSV file/paste preview with row errors and atomic commit, roster archive/restore and same-school transfer; guardian and identity states remain truthful |
| `/org/[schoolId]/staff` | S4: bound teacher invitations, pending status/revocation, membership suspend/reactivate/archive and class/subject assignment/revocation; no school-admin/platform role self-grant |
| `/org/[schoolId]/classroom` | Active selected teacher membership, own active class/subject assignments only; school teacher authoring and learner workflows belong to later batches |
| `/login` | A2 role entry explanations for student, teacher, school admin and parent; school/invitation callbacks preserve normalized same-origin destinations |
| `/teacher/signup` | Replaces unrestricted promotion with invited school-teacher entry and truthful independent-tutor later notice |

F-A2-01/F-A2-06 and F-S2-01–04/F-S3-01–02,04–05/F-S4-01–04 are covered here. F-S3-03 verified guardian invitations, relationships and siblings belong to B03. School PARENT/STUDENT membership can be accepted and listed, but the chooser does not invent their consent-dependent dashboards. An unclaimed school record provisions no account, login credential, learner session, verified relationship or chat access. Legacy adult signup remains its existing truthful path.

## Membership and session boundary

`selectSchoolWorkspace` is a server action. It uses the current authenticated session and calls the backend's verified selection endpoint before writing an HttpOnly, SameSite=Lax, production-Secure `colearner-school-membership` preference cookie. The preference contains one membership ID and grants no authority. Every protected school server layout/page calls `requireSchoolWorkspace`, re-reads the descriptor from the backend and matches active status, URL school ID and allowed role. A forged ID, another school, revoked membership or guardian/student selection cannot grant school-admin access. API operations independently recheck live membership and resource scope.

No school selection rewrites `User.orgId`, global roles, backend credentials or Auth.js claims. Browser `update` role/lifetime assertions remain untrusted. School teacher entry calls `/my-teaching-assignments`, never the legacy single-organization teacher APIs. The retained personal workspace is a separate existing account path.

Browser review exposed a pre-existing Credentials handoff that discarded the backend `expiresIn` and forced a 60-second refresh threshold. Credentials now carries the validated server expiry and private operation ID into `acceptSessionPair`, which still validates the pair against the backend. Invalid/missing lifetime responses fail closed. `/`, `/workspaces`, `/invite` and `/org/:path*` are covered by Auth.js middleware so navigation can persist refreshed cookies before server rendering. Root's server membership lookup chooses schools before falling back to existing personal routes. The refresh replay policy and deduplication window were not weakened.

## API and interaction behavior

`lib/api/school.ts` reexports the canonical portable SDK0.2 school contract types and uses the canonical `/api/v1` base, current bearer credential, no-store requests and bounded timeout. Own-teacher class projections, school terms and issued invitation responses use their distinct portable types. The Auth.js browser adapter remains outside the portable package. Requests unwrap the existing data envelope and expose safe status-specific error text. Backend validation remains authoritative. New public APIs are additive v1 contracts; small web changes do not create new API majors.

School data uses React Query. Query keys include the school and current backend user; mutations disable automatic retries. Before every browser read or mutation, `schoolBrowserRequest` calls `getSession({broadcast:false})` to obtain the current verified cookie session; it never sends a stale captured SessionProvider credential. Missing or failed session checks block dispatch. Credential refresh happens before an operation, with no replay after an API rejection. Server gates/actions use server `auth()` directly. Lists expose pagination and every API-backed section has loading, denied/unavailable, empty and manual retry states. User drafts remain after failures; successful creates clear only their own form. Controls are labelled native inputs/selects with touch-sized B01 actions, logical layout and inherited reduced-motion behavior.

CSV header is exactly `externalId,displayName,classId,membershipId`; membershipId can be empty for an unclaimed record. Manual linking uses a named selector populated from active same-school STUDENT memberships. It never infers identity from matching email. The selected class and optional student membership IDs are displayed as read-only import aids. Preview shows validated rows and row-specific errors; errors block commit. A commit uses the byte-identical reviewed CSV and a stable generated operation ID. Failed retries retain both; editing the CSV or choosing an oversized file invalidates preview permission. The server revalidates and atomically commits, and successful UI commits disable duplication. CSV files over128KiB are rejected before reading. This is not a spreadsheet execution or automatic email matching workflow.

Invitation codes are returned once to the issuing school administrator and shown only in its controlled response panel, with a hide action and expiry. They are not placed in URL query strings, browser storage, analytics or client-auth updates. Invitation acceptance receives only `{token}`, never a user-selected role. Email delivery failures remain errors; the interface never claims a code was sent after a failed provider call.

## Verification

Resumed checks on15 October2026 cover **110 distinct tests across ten files**: 55 B02-specific tests (school adapter8, fresh-session browser adapter7, live server access/selection13, actual form/network interactions15, session/middleware12), three additional root membership cases and52 preserved B00A/B01 auth/routing/form tests. The integrated ten-file run passed109; the final15-case form run passed again after adding page-two class navigation coverage. TypeScript passed after the canonical SDK0.2 imports, and scoped ESLint passed after the final navigation correction. Final combined checks, including root-owned browser fixtures, are recorded in the batch handoff. The additional cases cover active-student named selection, oversized-file preview invalidation, keeping invitation entry available to authenticated personal accounts, and following page-two class roster/assignment links without losing the selected class. Initial sandbox transform-cache EPERM failures ran zero tests and are excluded. Tests use fictional in-memory HTTP responses, not production records. The root review separately verifies real Next/Auth.js and disposable local Nest/PostgreSQL/Redis workflows and responsive evidence before final batch acceptance.

```powershell
node node_modules/vitest/vitest.mjs run tests/unit/api/school-access.test.ts tests/unit/api/school-client.test.ts tests/unit/api/school-browser.test.ts tests/unit/api/b02-session-routing.test.ts tests/integration/b02-school-web.test.tsx tests/unit/api/auth-callbacks.test.ts tests/unit/api/post-login.test.ts tests/unit/api/session-tokens.test.ts tests/integration/b01-public-routing.test.tsx tests/integration/b01-public-auth.test.tsx
node node_modules/typescript/bin/tsc --noEmit
```

The school tests cover cross-school/role/revocation denial, failed verification before cookie writes, no child route for unverified guardian membership, server expiry retention and no premature61-second refresh, ignored browser roles/lifetimes, backend unavailable and safe errors, unclaimed manual records, CSV validation/edit/retry identity, code visibility, own teacher endpoint, bound invitation acceptance and failed email delivery. Scoped lint/type-check and root browser evidence are recorded in the final B02 handoff. No live Google flow, deployed database migration, real mail delivery, production build or deployment is claimed by this web slice.

## Cutover and rollback

Apply the reviewed id-preserving platform migration using the repository's user-run migration rules before enabling these routes. The web expects the frozen school identity/academic APIs; it cannot advertise school access without them. Preserve B00A Redis/session/provider configuration and B01 presentation foundations. Roll back only B02-owned school components/routes and the explicitly documented public/auth/middleware adjustments while retaining additive school data and historical global identity. Do not restore unrestricted teacher promotion as a rollback shortcut. Root owns platform-admin school provisioning UI and the combined rollout/task status.
