import { defineConfig } from '@playwright/test'
import path from 'node:path'
/**
 * B10 W2 guided homework help review. Runs against `/dev/homework` on a development server (default port 3211) and answers the
 * co and homework endpoints with page.route, so no API, model or database is involved. Artifacts go to B10_OUTPUT_DIR when set
 * (use a folder outside the project root so writing screenshots cannot trigger a Next rebuild mid-run), then copy them to output/b10.
 */
const out = process.env.B10_OUTPUT_DIR ? path.resolve(process.env.B10_OUTPUT_DIR) : path.resolve('output/b10')
export default defineConfig({
  testDir: '.', testMatch: 'homework-review.spec.ts', timeout: 240000, expect: { timeout: 20000 }, workers: 1, retries: 0, reporter: [['list']],
  outputDir: path.join(out, '_results-homework'),
  use: { baseURL: process.env.B10_BASE_URL ?? 'http://localhost:3211', browserName: 'chromium', extraHTTPHeaders: { 'Accept-Encoding': 'identity' }, trace: 'off', screenshot: 'only-on-failure' },
})
