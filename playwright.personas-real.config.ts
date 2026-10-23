import os from 'node:os'
import path from 'node:path'
import { defineConfig } from '@playwright/test'

// Real-API persona matrix. Reuses the running web (:3001) and platform API (:3000).
// Artifacts (results, HTML report, matrix.json) live outside the Next root so the dev server never rebuilds because of them.
const artifacts = process.env.PERSONAS_E2E_ARTIFACTS ?? path.join(os.tmpdir(), 'colearner-personas-real-api')

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /personas-real-api\.spec\.ts/,
  outputDir: path.join(artifacts, 'results'),
  timeout: 420_000,
  globalTimeout: 1_800_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: path.join(artifacts, 'report') }]],
  use: {
    baseURL: process.env.PERSONAS_WEB_URL ?? 'http://localhost:3001',
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
