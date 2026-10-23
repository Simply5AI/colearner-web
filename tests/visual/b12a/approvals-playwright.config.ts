import { defineConfig } from '@playwright/test'
import path from 'node:path'
/**
 * B12A guardian approvals review. Runs against `/dev/family/approvals` on the running development server (default :3001);
 * the page answers /api/family-approvals itself (mock=page), so no API, database or real child is involved.
 * Uses the installed system Chrome. Artifacts go outside the project root so writing them cannot trigger a Next rebuild.
 */
const out = process.env.B12A_OUTPUT_DIR ? path.resolve(process.env.B12A_OUTPUT_DIR) : path.join(process.env.TMPDIR ?? '/tmp', 'colearner-b12a')
export default defineConfig({
  testDir: '.', testMatch: 'approvals-review.spec.ts', timeout: 120000, expect: { timeout: 20000 }, workers: 1, retries: 0, reporter: [['list']],
  outputDir: path.join(out, '_results'),
  use: { baseURL: process.env.B12A_BASE_URL ?? 'http://localhost:3001', channel: 'chrome', trace: 'off', screenshot: 'only-on-failure' },
})
