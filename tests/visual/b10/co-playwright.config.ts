import { defineConfig } from '@playwright/test'
import path from 'node:path'
/**
 * B10 Ask Co review (agent W1). Runs against `/dev/co` on a development server (default port 3212) and answers the Ask Co
 * endpoints with page.route, so no API, model or database is involved. Artifacts go to B10_OUTPUT_DIR when set (use a folder
 * outside the project root so writing screenshots cannot trigger a Next rebuild mid-run), then are copied to output/b10.
 */
const out = process.env.B10_OUTPUT_DIR ? path.resolve(process.env.B10_OUTPUT_DIR) : path.resolve('output/b10')
export default defineConfig({
  testDir: '.', testMatch: 'co-review.spec.ts', timeout: 240000, expect: { timeout: 20000 }, workers: 1, retries: 0, reporter: [['list']],
  outputDir: path.join(out, '_results'),
  use: { baseURL: process.env.B10_BASE_URL ?? 'http://localhost:3212', browserName: 'chromium', extraHTTPHeaders: { 'Accept-Encoding': 'identity' }, trace: 'off', screenshot: 'only-on-failure' },
})
