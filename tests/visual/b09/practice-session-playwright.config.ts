import { defineConfig } from '@playwright/test'
import path from 'node:path'
/**
 * B09 practice session review (agent W1). Runs against `/dev/practice-session` on a development server (default port 3209)
 * and answers the practice endpoints with page.route, so no API, model or database is involved. Artifacts go to B09_OUTPUT_DIR
 * when set (use a folder outside the project root so writing screenshots cannot trigger a Next rebuild mid-run).
 */
const out = process.env.B09_OUTPUT_DIR ? path.resolve(process.env.B09_OUTPUT_DIR) : path.resolve('output/b09')
export default defineConfig({
  testDir: '.', testMatch: 'practice-session-review.spec.ts', timeout: 240000, expect: { timeout: 20000 }, workers: 1, retries: 0, reporter: [['list']],
  outputDir: path.join(out, '_results'),
  use: { baseURL: process.env.B09_BASE_URL ?? 'http://localhost:3209', browserName: 'chromium', extraHTTPHeaders: { 'Accept-Encoding': 'identity' }, trace: 'off', screenshot: 'only-on-failure' },
})
