import os from 'node:os'
import path from 'node:path'
import { defineConfig } from '@playwright/test'

// Real-API Tutor Loop journey (Rohan, the seeded B03 Teen; Sara for the Adult checks). Reuses the running web (:3001) and
// platform API (:3000) started by ./dev.sh with TUTOR_LOOP_ENABLED, TUTOR_ADULT_ENABLED, TUTOR_LOCAL_SEED_ENABLED (and
// TUTOR_AI_ENABLED / TUTOR_MOCK_ENABLED for the AI steps). Artifacts live outside the Next root so the dev server never rebuilds.
//
//   TUTOR_REAL_API=1 TUTOR_SEED_PASSWORD=<b03 seed password> TUTOR_SARA_PASSWORD=<sara password> \
//     pnpm exec playwright test -c playwright.tutor-rohan-real.config.ts
//
// TUTOR_EVIDENCE_DIR sets where screenshots go (default: the OS temp dir).
const artifacts = process.env.TUTOR_E2E_ARTIFACTS ?? path.join(os.tmpdir(), 'colearner-tutor-rohan')

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /tutor-rohan\.real\.spec\.ts/,
  outputDir: path.join(artifacts, 'results'),
  timeout: 600_000,
  globalTimeout: 900_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: path.join(artifacts, 'report.json') }]],
  use: {
    baseURL: process.env.TUTOR_WEB_URL ?? 'http://localhost:3001',
    channel: 'chrome',
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
