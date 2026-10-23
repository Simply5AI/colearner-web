import { defineConfig } from '@playwright/test'
import path from 'node:path'
const out = path.resolve(process.env.B11_OUTPUT_DIR ?? '/tmp/colearner-b11-web')
export default defineConfig({
  testDir: '.', testMatch: 'teach-progress.spec.ts', timeout: 60000, expect: { timeout: 15000 }, workers: 1, retries: 0,
  reporter: [['list']], outputDir: path.join(out, '_results'),
  use: { baseURL: process.env.B11_BASE_URL ?? 'http://localhost:3001', browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
})
