import { defineConfig } from '@playwright/test'
import path from 'node:path'
/**
 * B09 W2 practice hub / start / summary review. Runs against `/dev/practice` on a development server (default port 3210)
 * and answers the practice endpoints with page.route, so no API, model or database is involved. Artifacts go to
 * B09_OUTPUT_DIR when set (use a folder outside the project root so writing screenshots cannot trigger a Next rebuild
 * mid-run), then copy them to output/b09.
 */
const out = process.env.B09_OUTPUT_DIR ? path.resolve(process.env.B09_OUTPUT_DIR) : path.resolve('output/b09')
export default defineConfig({
  testDir: '.', testMatch: 'practice-hub-review.spec.ts', timeout: 240000, expect: { timeout: 20000 }, workers: 1, retries: 0, reporter: [['list']],
  outputDir: path.join(out, '_results'),
  use: { baseURL: process.env.B09_BASE_URL ?? 'http://localhost:3210', browserName: 'chromium', extraHTTPHeaders: { 'Accept-Encoding': 'identity' }, trace: 'off', screenshot: 'only-on-failure' },
})
