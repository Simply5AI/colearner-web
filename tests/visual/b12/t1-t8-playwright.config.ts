import { defineConfig } from '@playwright/test'
import os from 'node:os'
import path from 'node:path'

// Artifacts live outside the Next root so screenshots never trigger a dev-server rebuild.
const out = path.resolve(process.env.B12_W1_OUTPUT_DIR ?? path.join(os.tmpdir(), 'colearner-b12-w1-web'))
export default defineConfig({
  testDir: '.',
  testMatch: ['t1-*.spec.ts', 't8-*.spec.ts'],
  timeout: 60000,
  expect: { timeout: 15000 },
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: path.join(out, '_results'),
  use: { baseURL: process.env.B12_BASE_URL ?? 'http://localhost:3001', browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
})
