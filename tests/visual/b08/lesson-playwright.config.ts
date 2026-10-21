import { defineConfig } from '@playwright/test'
import path from 'node:path'
/**
 * B08 lesson review. Runs against `/dev/lesson` on a development server (default port 3208) and answers the lesson
 * endpoints with page.route, so no API, model or database is involved. Artifacts go to B08_OUTPUT_DIR when set
 * (use a folder outside the project root so writing screenshots cannot trigger a Next rebuild mid-run).
 */
const out = process.env.B08_OUTPUT_DIR ? path.resolve(process.env.B08_OUTPUT_DIR) : path.resolve('output/b08')
export default defineConfig({
  testDir: '.', testMatch: 'lesson-review.spec.ts', timeout: 240000, expect: { timeout: 20000 }, workers: 1, retries: 0, reporter: [['list']],
  outputDir: path.join(out, '_results'),
  use: { baseURL: process.env.B08_BASE_URL ?? 'http://localhost:3208', browserName: 'chromium', extraHTTPHeaders: { 'Accept-Encoding': 'identity' }, trace: 'off', screenshot: 'only-on-failure' },
})
