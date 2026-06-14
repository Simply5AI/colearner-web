import { test, expect } from '@playwright/test'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

test.describe('Teacher onboarding', () => {
  test('dedicated teacher signup grants TEACHER role', async ({ page, request }) => {
    const email = `e2e-teacher-${Date.now()}@example.com`
    const password = 'TestPassword123!'
    const displayName = `E2E School ${Date.now()}`

    const signupProbe = await request.post(`${API_URL}/api/auth/signup`, {
      data: {
        email: `probe-${Date.now()}@example.com`,
        password,
        name: 'Probe',
      },
    })

    test.skip(
      signupProbe.status() !== 201,
      'Platform API must be running on NEXT_PUBLIC_API_URL for teacher onboarding e2e',
    )

    await page.goto('/teacher/signup')
    await page.getByLabel('Your name').fill('E2E Teacher')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByLabel('School / organization name').fill(displayName)
    await page.getByRole('button', { name: 'Create teacher account' }).click()

    await expect(page).toHaveURL(/\/teacher\/onboarding/, { timeout: 30_000 })
    await expect(page.getByText('Welcome, teacher')).toBeVisible()
  })

  test('student accounts cannot open teacher signup while signed in', async ({ page, request }) => {
    const email = `e2e-student-${Date.now()}@example.com`
    const password = 'TestPassword123!'

    const signup = await request.post(`${API_URL}/api/auth/signup`, {
      data: { email, password, name: 'E2E Student' },
    })

    test.skip(signup.status() !== 201, 'Platform API must be running')

    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 15_000 })

    await page.goto('/teacher/signup')
    await expect(page).toHaveURL(/\/dashboard/)
  })
})