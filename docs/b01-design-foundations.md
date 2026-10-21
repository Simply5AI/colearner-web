# B01 design foundations handoff

Status: foundation implementation ready for integrated browser review. This document does not mark the whole B01 batch verified.

## Completed shared learning presentation (F-DS4)

`components/design-system/learning-primitives.tsx` adds `QuestionOptionTile`, `HintLadder`, `AnswerFeedback`, `RewardBadge`, `CoDock`, `SpeechBubble` and `ReadAloudText`, exported with typed props through the shared barrel. Controlled examples exist only in `tests/visual/b01/main.tsx`, above its preserved final fixture action. This completes B01's shared learning presentation surface alongside DS1–3 and CO1–2. Runtime lesson integration belongs to B08/B09/B10; reward/customisation and voice preferences remain B17; AI policy remains B04.

The existing `components/recall/mcq-question.tsx`, `components/recall/answer-feedback.tsx`, `components/questions/QuestionRenderer.tsx` and teacher MCQ renderer were inspected. Their answer-result, scoring, review schedule and teacher-question types make them domain integrations rather than reusable presentation primitives. They remain intact. The new primitives accept caller-provided choices, content and feedback; they compute no answer, grade, reward entitlement, memory, speech stream or persistence.

- `QuestionOptionTile` uses native radios, a required shared group name, explicit accessible option text and optional native picture/alt content. Caller supplies checked state and selection callback; unavailable selections are disabled. Callers provide the surrounding fieldset/legend and unique group names.
- `HintLadder` requests exactly the next of three controlled rungs, clamps malformed reveal counts, labels Nudge/Hint/Similar example and disables further reveal after three. Caller supplies approved hints and owns hint retrieval/content policy.
- `AnswerFeedback` presents supplied correct/incorrect/partial outcomes with kind-specific icon/text and encouraging Co. `RewardBadge` presents a caller label/icon/lock state.
- `CoDock` adapts Co presence by band and sends Ask/Hide/Show callbacks. Adult hiding is controlled; child Co remains visible. Available controls require a callback and no preference is stored by the component.
- `SpeechBubble` and `ReadAloudText` enable reading only with both explicit capability availability and a callback. Current-word highlight uses the supplied valid integer word index; invalid indices highlight nothing. No browser speech API or provider is invoked.

Verification for this addition:

- `node node_modules/vitest/vitest.mjs run tests/unit/learning-primitives.test.tsx tests/unit/design-foundations.test.tsx`: **43 passed** across two files, comprising **18 new learning-widget tests** and 25 existing foundation checks. Covers native radio keyboard/caller control, picture labelling, sequential reveal/bounds, status feedback, locked reward label, adult controlled hide/show, child visibility and disabled unavailable voice.
- TypeScript: **passed** locally after the widget/fixture addition; root also reported the pinned package type-check passed.
- `node node_modules/eslint/bin/eslint.js components/design-system/learning-primitives.tsx tests/unit/learning-primitives.test.tsx tests/visual/b01/main.tsx tests/visual/b01/design-foundations-review.spec.ts`: **passed**, no diagnostics.
- Targeted real Chromium `--grep "controlled learning widgets"` with the existing foundations review config: **1 passed** (6.3 seconds), exercising **2 phone layouts** (kids and adults, 390px), controlled radio selection, all three hints, disabled unavailable voice, adult Hide/Show and no document overflow. The first fixture attempt failed to render after importing a Next-specific image component; replacing that dependency with native picture/img restored the portable fixture and the targeted browser test passed. Failed attempts are not counted as passing checks.
- Root owns the final combined review rerun and screenshot refresh for these added widgets. Earlier screenshot/test counts below describe the pre-widget pass; final refreshed evidence is recorded in the batch handoff.

## Implementation and source precedence

`components/design-system/index.ts` exports age data/scope, CoCharacter, BrandMark, ThemeToggle, Button, Card, Input, Select, Checkbox, Toggle, ProgressBar, MasteryPill, ParentLockBadge, EmptyState, ErrorState, LoadingState, Skeleton and FoundationErrorBoundary. The existing Base UI/shadcn primitives remain available for dialogs, drawers, tooltips, menus and toast delivery; the role shell uses that accessible dialog foundation. This batch adds presentation primitives, not lesson, voice or AI execution logic.

Source references are `Learning App Redesign/Design System.dc.html`, `Welcome.dc.html`, `uploads/01-design-system.md`, `uploads/02-character.md` and `co-placeholder.svg`. The rendered prototype's inline palette overrides its bundled organic reference: white background, pale lilac `#f5f5f9` surfaces, `#1c1b29` text and orange accents. Do not treat the alternate `_ds` bundle as the rendered product palette.

Prototype orange `#cf5d0b` remains in portable palette data. Action surfaces use the deeper source tone `#b4500a` for white text contrast. Text/background ratios calculated from sRGB luminance: primary white/action **5.13:1**, muted text/light surface **5.99:1**, error/white **6.57:1**, dark primary text/action **7.76:1**, dark muted text/surface **8.83:1**. Meaningful control borders and focus rings have separate input/ring tones; decorative card borders are lighter. Mastery includes an icon and label as well as colour.

| Band | Body | H1/H2/H3 | Radius | Minimum target | Co default |
|---|---|---|---|---|---|
| kids, ages 6–9 | 22px | 46/30/24px | 28px | 64px | 220px full body |
| tweens, ages 10–13 | 18px | 40/27/21px | 22px | 48px | 120px half body |
| teens, ages 14–17 | 16px | 36/24/19px | 18px | 44px | 56px head avatar |
| adults | 15px | 32/22/18px | 14px | 44px | 24px dot |

The body targets match the written brief. The implemented radii follow the final prototype (28/22/18/14) rather than the earlier prompt (24/18/14/10). The adult prototype target was 40px; this implementation raises it to 44px. Large H1 text shrinks with viewport width, while body copy retains its age target. Root supplies locally bundled Nunito/Geist fonts and licenses; this foundation introduces no font CDN. Nunito headings apply across bands, Nunito body for kids/tweens and Geist for teens/adults.

`AgeBandScope` or `data-age-band` sets inherited presentation tokens: `--ds-body`, `--ds-small`, `--ds-caption`, `--ds-h1`–`--ds-h3`, `--ds-display`, `--ds-target` (alias `--ds-tap`), `--radius` (alias `--ds-radius`), `--ds-gap` and `--ds-body-font`. Portals need their own scope because they are outside the original DOM ancestry. Age scope does not determine authorisation or policy; callers must use validated learner data. There is no production age or direction toolbar.

## Co provenance and usage

Original source preserved byte-for-byte at `public/co/co-original.svg`; both source and copy SHA-256:

`B8E5FF081668F964ADD27EB5EFCF832C1CCF4A2BCC726830D7EB5DDC6317C2B0`

`CoCharacter` derives its vector body, glow, face and arms from that SVG. No replacement raster was generated. Poses are idle, waving, listening, thinking, reading, explaining, asking, hinting, encouraging, celebrating, curious and sleepy. State decorations/arm/eye poses add source-specified expression. Sleepy dims Co and closes the eyes; encouraging stays friendly. Gradient ids are unique per rendered instance. These are placeholder vector poses, not final commissioned Rive animation or speech/AI runtime.

Props: `band?: AgeBand`, `state?: CoState`, `size?: number`, `decorative?: boolean`, `label?: string`, `className?: string`. Use `decorative` when nearby copy already explains the state; otherwise provide useful localised state text through `label`. Adult dot deliberately has minimal expression, pulsing only for thinking/listening. Co is a visual, not a button; wrap it in an actual labelled button for a future authorised action. All continuous movement, wave previews, loading spins and shimmer stop under reduced motion; static poses remain visible.

## Accessibility and verification

Native controls keep browser keyboard interaction. Input labels, hints and errors are associated through unique ids. Button loading disables repeated actions and exposes `aria-busy`; progress clamps invalid values and exposes its bounds. Errors use alert semantics, loading uses a polite status, and decorative mascot/skeleton graphics are hidden from assistive technology. Focus rings are visible, spacing uses logical properties, and toggles reverse in RTL. ErrorBoundary contains rendering failures and offers retry without displaying raw error details.

Checks on 14 October 2026:

- `node node_modules/vitest/vitest.mjs run tests/unit/design-foundations.test.tsx`: **25 passed**, 1 file passed. Keyboard input/checkbox/switch controls, descriptions, loading duplicate prevention, progress bounds, mastery labels, live states, rendering-error retry, age/direction scoping, unique SVG ids, band crops and all twelve poses covered.
- `node node_modules/typescript/bin/tsc --noEmit`: **passed** at foundation handoff.
- `node node_modules/eslint/bin/eslint.js components/design-system tests/unit/design-foundations.test.tsx`: **passed**, no diagnostics.
- Initial sandbox Vitest attempts failed before test collection with `EPERM` while renaming a temporary Vite cache file. The same test command outside that temporary-cache restriction passed; no failed attempt is counted as a test pass.
- Original/copy SHA-256 comparison: **identical**.
- Root still owns combined 1440/1024/390 browser, keyboard/drawer, RTL and reduced-motion verification and the final rollout/task status.

Integrated review found that an unlayered `.ds-co { display: inline-block }` overrode Tailwind's layered `hidden lg:block` rules. Both responsive auth mascots participated in phone layout, causing 480px document width at a 390px viewport. The default display rule now belongs to `@layer components`, below utility precedence, while state, adult dot and other vector styling are retained. Added `tests/e2e/design-foundations-responsive.spec.ts` to exercise the actual login page at 390/1024/1440: exactly one responsive waving mascot participates in layout and document width must fit the viewport. Post-fix TypeScript and focused ESLint pass.

`node node_modules/@playwright/test/cli.js test --config tests/visual/b01/foundations-playwright.config.ts --project chromium`: **4 Chromium browser tests passed** (18.4 seconds) after extending the regression. These cover the original **3 auth viewport layouts** (390, 1024, 1440), actual `prefers-reduced-motion: reduce` disabling both Co wave and idle animations, light/dark/light theme switching with rendered source background/text colours, and **4 captured screenshots** with no document overflow. They use root's existing `http://localhost:3101` Next review server and `http://localhost:3103` isolated Vite role fixture. The review config disables Playwright's webServer, so no second server or `.next` writer was started. No live provider, authorised school session, or deployed auth/database integration is claimed by these UI tests.

Root also reported **24 public/auth viewport checks**, **27 role/age viewport checks**, and **6 phone RTL/long-label checks**, all fitting the viewport. These broader review results are recorded separately from the four automated tests above.

Screenshots are local review evidence under `output/playwright/b01/`: `landing-desktop.png` (1440px), `login-phone.png` (390px), `kids-shell-phone.png` (390px student/kids fixture), and `parent-shell-rtl-phone.png` (390px parent/adults RTL fixture with expanded labels). Phone login and kids shell screenshots were visually inspected. The shell image explicitly identifies its isolated fixture status. Development-only Next/React Query indicators may appear in Next screenshots; they are not production product controls.

`node node_modules/eslint/bin/eslint.js tests/e2e/design-foundations-responsive.spec.ts tests/visual/b01/design-foundations-review.spec.ts tests/visual/b01/foundations-playwright.config.ts`: **passed**, no diagnostics after adding the motion/theme/screenshot checks.

No backend, API schema, authentication runtime, AI service, package manifest/lock, production database, deployed service or original design files changed in this foundation slice. API major remains v1; this is a compatible web presentation change. Rollback is reverting these new foundation files and this batch's `app/globals.css` changes alongside its consuming UI, while preserving B00A and other unrelated work.
