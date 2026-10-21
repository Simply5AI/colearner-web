# B01 public overview and authentication UI handoff

Prepared 14 October 2026. This document covers the public/auth slice only. Root owns integrated screenshots, acceptance and planning/task status. No production deployment, DB migration, live OAuth/account calls, commits, PRs or external issue updates were performed.

## Source and feature coverage

Source: `Learning App Redesign/Welcome.dc.html` A1 landing / A2 signup and the corresponding plan screen briefs. Uses the shared source-derived Co component, palette, Nunito heading variable, theme toggle and age scopes; original prototypes remain untouched. Pale-lilac hero, original “Bring anything. Learn it with Co.” headline, rounded cards, learning loop and age preview composition are retained. Source prices and unsupported local-model/privacy guarantees are replaced with truthful school scope and availability information. No prototype toolbar or fictional scores/AI answers are exposed.

| Feature | Result |
|---|---|
| F-A1-01 | Brand/navigation/login and school exploration action at anonymous `/`; verified existing role sessions retain their server-side root redirects. |
| F-A1-02 | Import → Learn → Practice → Review overview, explicitly product direction rather than live capability claims. |
| F-A1-03 | Four keyboard-operable age preview selections, with pressed state, live preview text and source age scopes; no learner data. |
| F-A1-04 | School/guardian consent and policy direction with age-aware parent visibility; honest rollout availability. |
| F-A1-05 | Adult/researcher direction remains visible as later roadmap scope. |
| F-A1-06 | Semantic native FAQ, accessible header/footer/skip links, functional `/privacy`, `/terms`, `/contact`, English footer/Hindi planned. No inactive language selector. |
| F-A1-07 | School product overview replaces consumer placeholder prices; commercial plans explicitly pending. |
| F-A2-02 | Real B00A email/password/Google Auth.js flows, real existing signup/reset services, pending/error/retry states. Google provider and UI use the same complete server configuration. |
| F-A2-03 | Keyboard-accessible show/hide, password strength text, matching, notices checkbox, visible labels/linked errors/focus, duplicate-submit guard. No fabricated client attempt counter or indefinite lockout. |
| F-A2-04 | Actual forgot/reset calls; masked entered address with conditional wording; unavailable requests never reveal account existence; missing/used/expired link recovery; API-confirmed password-reset success. |
| F-A2-07 | The redesigned legacy signup surface asks only an adult account holder's name after explicit adult confirmation and prohibits child/school details in its instructions. Full enforced age/guardian/consent boundary is deferred to B02/B03. |

F-A2-01 role-specific account entry, F-A2-05 family profiles/PIN and F-A2-06 school-only invitation/workspace enforcement remain B02/B03. The existing adult registration API is retained; the adult confirmation here is a presentation guard, not verified age or guardian consent. There is no new role assignment, school membership or authorization mechanism in this slice. Unrestricted teacher signup is no longer promoted by the redesigned login page, but its backend/legacy route enforcement is a later batch.

## Routes and implementation

- `app/page.tsx`: real server `auth()` check, then existing post-login resolver redirects verified role sessions; anonymous/invalid sessions render A1. Middleware does not match root, so redirects do not depend solely on its callback.
- `components/landing/`: public header/footer/overview, interactive age previews, shared information-page frame.
- `app/privacy`, `app/terms`, `app/contact`: review notices and school support instructions. Operator/retention/processors/jurisdiction/support-channel/commercial details are unknown and require owner review before school rollout; no unsupported guarantees or enquiry API.
- `app/(auth)/`: responsive brand/layout/form pages. Historical `/callback` now redirects to root rather than spinning indefinitely; actual provider completion remains Auth.js `/api/auth`.
- `components/auth/`: real login/signup/reset forms, reusable accessible password field, strength meter, configured Google pending/failure handling and compact mobile Co header.
- `lib/auth/config.ts`: only anonymous-root allowance and explicit configured Google-provider options were changed after B00A. All JWT/provider-evidence/session-pair/role authority/refresh/security logic is retained.
- `lib/auth/google-provider.server.ts`: `.server` helper plus browser guard, used only by server page/config imports. Prefer complete `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET`; otherwise use complete `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`. Never mix incomplete pairs. Without a complete pair, provider is not registered and buttons are hidden. Client props contain only the configured boolean. Backend Google audience must match the selected web client as documented in B00A.
- `components/auth/use-optional-recaptcha.ts`: missing optional site key skips the actual library default thrower. Configured verification requires a ready executor and a nonempty successful token; not-ready/rejected/empty results show verification-specific retry feedback and never call the product API. Backend enforcement is unchanged.
- `lib/auth/post-login.ts`: callback paths reject backslashes/ASCII controls and are URL-normalized against a fixed origin before browser navigation; verified existing role defaults and normal relative query/fragment destinations remain unchanged.
- Tests: `tests/integration/b01-public-auth.test.tsx`, `b01-public-routing.test.tsx`, `b01-recaptcha.test.tsx` (actual unmocked library/context), `tests/unit/api/google-provider-config.test.ts`, `post-login.test.ts`. B00A `auth-callbacks.test.ts` changes only its Google-provider mock from object to callable to match explicit provider options.

Forms preserve entered drafts after failures, disable actions while pending and offer appropriate retries/new-reset evidence. Passwords are cleared after successful reset. Reset page declares no-index and no-referrer metadata. Native FAQ and ordinary links work without simulated backend responses. Layouts use responsive grids/flex, logical inset/padding and shared reduced-motion styles. Root verifies browser layouts at 1440/1024/390, keyboard, dark mode, reduced motion and RTL.

## Verification

Passing local checks:

```powershell
# colearner-web, installed repository binaries
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js components/auth app/page.tsx app/privacy app/terms app/contact components/landing 'app/(auth)' lib/auth/google-provider.server.ts tests/integration/b01-public-auth.test.tsx tests/integration/b01-public-routing.test.tsx tests/unit/api/google-provider-config.test.ts
node node_modules/vitest/vitest.mjs run tests/integration/b01-public-auth.test.tsx tests/integration/b01-public-routing.test.tsx tests/unit/api/auth-callbacks.test.ts tests/unit/api/google-provider-config.test.ts tests/unit/api/post-login.test.ts tests/integration/b01-recaptcha.test.tsx
```

62 distinct focused cases: 12 form/age preview, 9 actual root/information route, 4 existing B00A callback, 8 Google complete-pair/browser-guard 23 callback-normalization/role-default and 6 actual-library optional-reCAPTCHA cases. The four-suite run passed 32 cases; the subsequent final Google helper run passed all 8 after adding its browser guard case. The normalization/routing/B00A rerun passed 36 cases (23 + 9 + 4). The actual-library reCAPTCHA/form/B00A rerun passed 22 cases (6 + 12 + 4). Typecheck and focused lint passed. Existing form tests mock Auth.js, product services and reCAPTCHA. The 6 added reCAPTCHA regressions intentionally use the actual installed library/default/context provider, with only product calls isolated; no real accounts, OAuth provider or product backend were used. An initial sandbox Vitest run failed before tests because it could not rename its temporary transform cache; the approved local equivalent passed. That infrastructure failure is not counted as a pass. A new test typing issue and unrelated root visual-fixture typing issue were corrected before the final typecheck.

## Versions, limits and recovery

Application version remains 0.1.0. Public API major stays v1; existing safe reset/register aliases use unchanged request schemas. No OpenAPI, portable SDK, schema or AI-pack release occurred. Explicit Google complete-pair wiring corrects configuration/visibility. Callback normalization is a security correction preventing browser cross-origin redirects through backslashes/control-character normalization. No API version bump, provider-evidence or token verification change is required. The optional-reCAPTCHA correction fixes a client runtime defect and never bypasses configured verification or backend enforcement.

Final enterprise privacy/terms/contact channels, school invitation enforcement, verified learner age/guardian consent and membership remain outstanding rollout work. UI preview checks are not live OAuth/database/tenant/consent verification. Root's integrated screenshot evidence is separate. Roll back this UI slice only if necessary while retaining verified B00A authentication/security and server credential checks. No irreversible data migration needs rollback.


A root browser check found that the library default context supplies a defined throwing executor when no provider/site key exists. The previous mocked undefined executor hid the issue. The new actual-library tests verify no-key forgot/signup API dispatch, configured not-ready signup/forgot blocking, configured executor rejection, empty-token rejection, preserved input and successful retry after verification becomes ready. No remote CAPTCHA script or provider verification was executed in these isolated cases.
