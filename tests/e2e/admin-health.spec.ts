import { test, expect } from '@playwright/test'

test.describe('Admin system health', () => {
  test('health overview route responds for unauthenticated visitors', async ({ page }) => {
    const response = await page.goto('/admin/health')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('body')).toBeVisible()
  })
})