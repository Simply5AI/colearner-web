import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: '.', testMatch: 'materials-review.spec.ts', timeout: 120000, expect: { timeout: 20000 }, workers: 1, retries: 0, reporter: [['list']], use: { baseURL: process.env.B06_BROWSER_BASE_URL ?? 'http://localhost:3201', browserName: 'chromium', extraHTTPHeaders: { 'Accept-Encoding': 'identity' }, trace: 'retain-on-failure', screenshot: 'only-on-failure' } })

