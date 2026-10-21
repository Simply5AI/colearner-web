import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: '.', testMatch: 'school-review.spec.ts', timeout: 120000, expect: { timeout: 20000 }, workers: 1, retries: 0, reporter: [['list']],
  use: { baseURL: 'http://localhost:3101', browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  outputDir: '../../../test-results/b02-school-review',
})
