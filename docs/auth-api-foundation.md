# Web auth/API foundation (B00A)

Web authentication now consumes the portable `@colearner/api-client` auth slice from the checked-in `vendor/colearner-api-client-0.1.0.tgz` release. It sends Google `account.id_token` evidence; profile assertions are not identity proof. The backend independently verifies provider evidence before issuing purpose-scoped device sessions.

`lib/api/platform-client.ts` is the web transport/environment adapter. It accepts origin or `/api/v1` base URLs and injects uncached fetch with a ten-second timeout. Other older API wrappers still expect an origin; retain an origin-only deployment environment until their migration.

`lib/auth/session-tokens.ts` validates same-user session pairs, uses actual server lifetimes, single-flights local refreshes and passes a private server-provided operation id for the backend's ten-second atomic duplicate-request window. This id and refresh credentials remain in the encrypted Auth.js cookie; only the existing short-lived access field is exposed in the client session. Existing teacher-bootstrap credentials are retained and now validated, pending later server-only BFF restructuring.

Auth.js rejects old cookies immediately, verifies backend identity before accepting browser session updates, hydrates roles/profile from the backend and uses the verified backend id in `session.user.id`. Sign-out attempts server revocation; an unavailable network/store can prevent revocation even after local cookie removal, so such attempts log a credential-free failure rather than claim success.

Deploy with the matching backend and require re-login. No database migration or deployment was performed. See the backend's `docs/api/auth-api-foundation.md` and exported `auth-health.openapi.json` for complete contracts/configuration/cutover details. The package distribution is local and reproducible; registry publication and OpenAPI-generated wider contracts are later work.

Focused verification: 13 tests across portable-client, session-token and Auth.js-callback suites pass; `pnpm type-check` passes using the pinned package-manager executable. No live school/database/provider or browser E2E journey was tested in this batch.
