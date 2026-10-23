import { defineConfig } from '@playwright/test'
import path from 'node:path'
// Artifacts stay outside the Next root so the dev server never rebuilds because of a screenshot.
const out = path.resolve(process.env.B12_W2_OUTPUT_DIR ?? '/tmp/colearner-b12-w2-web')
export default defineConfig({
  testDir: '.', testMatch: /(t2|t3|learner)-.*\.spec\.ts$/, timeout: 90000, expect: { timeout: 15000 }, workers: 1, retries: 0,
  reporter: [['list']], outputDir: path.join(out, '_results'),
  use: { baseURL: process.env.B12_W2_BASE_URL ?? 'http://localhost:3001', browserName: 'chromium', channel: process.env.B12_W2_CHANNEL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
})
