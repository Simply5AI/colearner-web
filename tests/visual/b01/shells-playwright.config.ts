import { defineConfig } from '@playwright/test'

/** The parent run owns the existing isolated fixture server. */
export default defineConfig({
  testDir: '.', testMatch: 'role-shell-inset-review.spec.ts',
  reporter: [['list']], retries: 0, fullyParallel: true,
  use: { baseURL: 'http://localhost:3103', browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  outputDir: '../../../test-results/b01-shell-insets',
})
