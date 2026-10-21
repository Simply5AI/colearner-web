import { defineConfig } from '@playwright/test'
import path from 'node:path'
/**
 * B10 W3 parent conversations / school policy review. Runs against `/dev/family-conversations` on a development server
 * (default port 3213) started with NEXT_PUBLIC_API_URL=http://localhost:3213 so the family and school endpoints are
 * same-origin and answered with page.route; no API, model, database or real child is involved. Artifacts go to
 * B10_OUTPUT_DIR when set (use a folder outside the project root so writing screenshots cannot trigger a Next rebuild
 * mid-run), then copy them to output/b10.
 */
const out = process.env.B10_OUTPUT_DIR ? path.resolve(process.env.B10_OUTPUT_DIR) : path.resolve('output/b10')
export default defineConfig({
  testDir: '.', testMatch: 'family-review.spec.ts', timeout: 240000, expect: { timeout: 20000 }, workers: 1, retries: 0, reporter: [['list']],
  outputDir: path.join(out, '_results'),
  use: { baseURL: process.env.B10_BASE_URL ?? 'http://localhost:3213', browserName: 'chromium', extraHTTPHeaders: { 'Accept-Encoding': 'identity' }, trace: 'off', screenshot: 'only-on-failure' },
})
