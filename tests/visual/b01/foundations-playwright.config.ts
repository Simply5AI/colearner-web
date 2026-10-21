import path from 'node:path'
import { defineConfig } from '@playwright/test'
import base from '../../../playwright.config'

/** Review uses the already-running root server; never start a second Next writer. */
export default defineConfig({
  ...base,
  testDir: path.resolve(__dirname, '../..'),
  testMatch: ['e2e/design-foundations-responsive.spec.ts', 'visual/b01/design-foundations-review.spec.ts'],
  reporter: [['list']],
  retries: 0,
  workers: 1,
  use: { ...base.use, baseURL: 'http://localhost:3101' },
  webServer: undefined,
})
