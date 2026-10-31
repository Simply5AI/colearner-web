import os from 'node:os'
import path from 'node:path'
import { defineConfig } from '@playwright/test'

// Weekend-demo student loop against the REAL API (:3000), web (:3001) and AI runtime. Reuses the running dev stack.
//   DEMO_REAL_API=1 pnpm exec playwright test -c playwright.demo-real.config.ts
const artifacts = process.env.DEMO_E2E_ARTIFACTS ?? path.join(os.tmpdir(), 'colearner-demo-real-api')

export default defineConfig({
  testDir: './e2e',
  testMatch: /demo-student-loop\.spec\.ts/,
  outputDir: path.join(artifacts, 'results'),
  timeout: 900_000,
  globalTimeout: 1_000_000,
  expect: { timeout: 20_000 },
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: path.join(artifacts, 'report') }]],
  use: {
    baseURL: process.env.DEMO_WEB_URL ?? 'http://localhost:3001',
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1360, height: 900 },
  },
})
