import { test, expect } from '@playwright/test'

test('homepage health check', async ({ page }) => {
  // Navigate to the app
  const response = await page.goto('/')
  
  // Basic sanity check to ensure the Next.js app is serving pages (status 200)
  // or redirecting (since it might redirect an unauthenticated user to /login)
  expect(response?.status()).toBeLessThan(400)
})
