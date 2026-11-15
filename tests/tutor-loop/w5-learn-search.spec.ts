import { test } from '@playwright/test'

// Playwright path (run against the stack with TUTOR_LOOP_USE_FIXTURES=true): sign in, open /learn?tab=plan,
// pick a goal, switch to Library and back (goal stays selected), open Search from the header, find "acid", open the topic.
test.skip('Learn plan, library and search journey against fixtures', async () => {})
