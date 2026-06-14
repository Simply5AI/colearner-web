import { test, expect } from '@playwright/test'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

test.describe('Teacher onboarding', () => {
  test('freelancer path grants TEACHER role and lands on onboarding', async ({ page, request }) => {
    const email = `e2e-teacher-${Date.now()}@example.com`
    const password = 'TestPassword123!'
    const displayName = `E2E School ${Date.now()}`

    const signup = await request.post(`${API_URL}/api/auth/signup`, {
      data: {
        email,
        password,
        name: 'E2E Teacher',
      },
    })

    test.skip(
      signup.status() !== 201,
      'Platform API must be running on NEXT_PUBLIC_API_URL for teacher onboarding e2e',
    )

    await page.goto(`/login?callbackUrl=${encodeURIComponent('/become-teacher')}`)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page).toHaveURL(/\/become-teacher/)
    await page.getByRole('link', { name: 'Get started' }).click()
    await expect(page).toHaveURL(/\/teacher\/org-setup/)

    await page.getByLabel('Organization display name').fill(displayName)
    await page.getByRole('button', { name: 'Create teacher organization' }).click()

    await expect(page).toHaveURL(/\/teacher\/onboarding/, { timeout: 30_000 })
    await expect(page.getByText('Welcome, teacher')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Go to teacher dashboard' })).toBeVisible()

    await page.getByRole('link', { name: 'Go to teacher dashboard' }).click()
    await expect(page).toHaveURL(/\/teacher\/dashboard/)
    await expect(page.getByText('Teacher workspace')).toBeVisible()
  })
})