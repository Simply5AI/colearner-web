import os from 'node:os'
import path from 'node:path'
import { defineConfig } from '@playwright/test'

// Real-API B13 end to end. Reuses the running web (:3001) and platform API (:3000).
// Artifacts live outside the Next root so the dev server never rebuilds because of them.
const artifacts = process.env.B13_E2E_ARTIFACTS ?? path.join(os.tmpdir(), 'colearner-b13-question-bank')

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /b13-question-bank\.real\.spec\.ts/,
  outputDir: path.join(artifacts, 'results'),
  timeout: 300_000,
  globalTimeout: 420_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: path.join(artifacts, 'report') }]],
  use: {
    baseURL: process.env.B13_WEB_URL ?? 'http://localhost:3001',
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
