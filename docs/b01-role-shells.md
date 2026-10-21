# B01 — Shared role shells

Status: code complete; focused verification passed. Integrated browser screenshots and width/RTL verification are owned by the parent B01 run and recorded in its handoff.

## Implemented presentation boundary

`components/roles/role-shell.tsx` exports `RoleShell` and `RoleNavigation`. `RoleShell` takes a canonical role, age band, host-supplied navigation groups, a real home route, children and optional identity/workspace name/account actions/footer/quick navigation. It provides no role switcher and does not authorize resources.

The supplied redesign hosts are the layout reference: `CoLearner v2.dc.html`, `Tutor.dc.html` and `Parent.dc.html` use desktop header navigation; `Admin.dc.html` uses a desktop sidebar. The shared defaults follow those patterns. School administration uses the sidebar foundation until its later screens and membership routes are implemented. A `navigationStyle` override is available to an authorized host.

Desktop uses header navigation or the scrollable sidebar; below 1024px the navigation drawer exposes every supplied route and fixed quick navigation offers the first group's entries. Header variants keep the drawer available at desktop widths for utility routes. Safe-area padding protects phone content. Quick navigation is measured with ResizeObserver plus a resize fallback; main reserves its real border-box height, including safe-area padding, so longer translations and changed fonts cannot hide final page controls. Desktop padding remains zero. Both observer and event listener are cleaned up on unmount. Browser review found a short kids brand/skip target; these links now explicitly inherit the active age target (64px kids, 48px tweens, 44px older bands). The 38 focused tests and full typecheck passed again after that correction. Logical start/end borders, spacing and drawer placement follow document direction. Animation is restricted to `motion-safe` transitions. Base UI's modal drawer handles focus containment, Escape and focus restoration; a skip link focuses the main landmark. Page headings remain the page's responsibility. Shared error recovery wraps page children while navigation remains available.

## Mounted routes and retained adapters

| Host | Mounted shell | Real destinations |
| --- | --- | --- |
| Existing dashboard group | Student, presentation derived from current profile date of birth | `/dashboard`, `/roadmaps`, `/capture`, `/practice`, `/settings`; utilities `/learn/enrolled`, `/progress`, `/trophies`, `/dashboard/history`, eligible known-age `/pods` |
| Existing teacher group | Teacher | `/teacher/dashboard`, `/teacher/plans`, `/teacher/students`, `/teacher/analytics` |
| Existing admin group after its existing session checks | Platform administrator | Dashboard, health, users, organizations, roles, learning, extraction/library/pods content, billing/subscriptions and AI usage routes retained |
| Future parent, school administrator, researcher hosts | Foundation role variants only | No new route, page, role gate or invitation exposed |

Student primary navigation uses the designed five labels for known older bands. Kids get four picture-oriented entries: Adventures, My pages, Play, My World. `My pages` links to the existing capture/library flow; B01 does not claim a camera implementation. All current utility routes remain available in the drawer. Groups are absent for kids, tweens and unknown ages; known teens/adults retain the existing link. `CommandSearch` consumes the same configuration and preserves keyboard opening, filtering and router navigation.

Date-of-birth calculation is strictly presentation. It rejects malformed dates, unsupported under-6 ages and future dates, and honors birthday boundaries. Missing/invalid ages use the teens presentation with Groups hidden. Profile edits cannot grant backend resource permissions. Consent, age verification, membership management, child policy and all redesigned product page contents remain later batches.

The dashboard route-group server layout checks a real access-token session before mounting. It repeats existing teacher, SUPER_ADMIN and onboarding redirects because middleware does not match every route-group descendant. Six async-layout tests verify those gates and retained gamification mounting. Student/teacher consumer sign-out still uses Auth.js. Administrator logout still uses the separate administrator session API; `AdminReauthProvider`, `AdminIdleGuard`, server SUPER_ADMIN checks and administrator cookie/TOTP checks are retained. Per-user learning paths activate Learning instead of Users. Source-progress display handles zero required attempts and cannot show negative remaining counts. Global gamification events remain mounted.

## Verification

- `node node_modules/vitest/vitest.mjs run tests/integration/role-shell.test.tsx tests/integration/admin-shell.test.tsx tests/integration/role-search.test.tsx tests/integration/role-layout-gates.test.tsx`: **38 tests passed** across four files.
- Tests cover actual keyboard drawer entry/containment/Escape/restoration, navigation closure, main focus, one page h1, nested active routes, future role presentation without invented links, mounted profile-derived band and consumer sign-out adapters, age boundaries, unavailable Groups, and search filtering/router behavior.
- `node node_modules/typescript/bin/tsc --noEmit`: **passed after final shell/layout changes**.
- Focused ESLint for shell, shared-search, layout and their tests: **passed**.
- Sandbox Vite transform-cache rename failed on the first test attempt before any tests ran. Retrying with process-local TEMP/TMP set to `.cache/b01-shell-tests` succeeded. This did not alter application configuration.
- JSDOM reported its known document navigation limitation when exercising a real Next link. Drawer close/focus assertions passed; integrated browser navigation/viewport coverage remains in the parent handoff.

## Fixed navigation browser regression

`tests/visual/b01/role-shell-inset-review.spec.ts` uses the existing parent-owned Vite fixture at `http://localhost:3103/tests/visual/b01/` through the separate `shells-playwright.config.ts`; it starts no server and exposes no application route.

- **2 real Chromium tests passed**: kids/student and adults/researcher at 390px, RTL and extended labels.
- Asserted main padding is at least the measured quick-nav height and the final main action remains entirely above the nav after scrolling to page bottom.
- Increased nav label font to 24px without a viewport event and verified ResizeObserver updates the inset.
- Repeated the visibility check at 360px; at 1024px quick navigation hides and main padding becomes 0px.
- 38 focused component/layout tests and the full typecheck passed again after the adaptive inset change.
- The initial sandbox browser run could not find the sandbox-local browser cache; pointing to the existing user browser cache launched Chromium, but localhost network access was denied. The authorized escalated run against the same isolated fixture passed. No browsers were installed and no application configuration was changed.

## Boundary and rollback

No backend, API schema, API major, SDK, database, AI execution or package version changes are introduced by this shell slice. Existing API v1 and authentication contracts are reused. No deployments, migrations, remote issues or PRs were created.

Rollback restores this batch's role components, dashboard layout, AppSidebar/CommandSearch and teacher/admin shell adapters to their pre-B01 state. Preserve pre-existing B00A changes and unrelated files. Parent-owned design assets/theme and other B01 slices are rolled back independently.




