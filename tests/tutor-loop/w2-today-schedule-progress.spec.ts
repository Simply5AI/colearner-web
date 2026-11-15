import { expect, test } from '@playwright/test'
import { getTutorFixture } from '@/lib/api/tutor-loop/fixtures'

/**
 * Sara journey, Today part: open Today, read the suggestion, take a short-on-time suggestion,
 * preview and move an item in This week, then open Progress. Runs against contract fixtures by
 * answering the BFF routes in the browser. Needs a signed-in learner session (dev seed persona):
 * set E2E_TUTOR_W2=1 with the stack up. Not run in the W2 session (no stack/session available).
 * Run with: npx playwright test --config=<config whose testDir is tests/tutor-loop> w2-today-schedule-progress
 */
test.skip(!process.env.E2E_TUTOR_W2, 'needs a signed-in learner on the running stack')

test('Today, This week and Progress against fixtures', async ({ page }) => {
  const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  await page.route('**/api/learn/tutor-loop/today*', (r) => r.fulfill(json(getTutorFixture('today'))))
  await page.route('**/api/learn/tutor-loop/schedule?*', (r) => r.fulfill(json(getTutorFixture('schedule'))))
  await page.route('**/api/learn/tutor-loop/schedule/move-preview', (r) => r.fulfill(json(getTutorFixture('schedulePreview'))))
  await page.route('**/api/learn/tutor-loop/schedule/previews/*/apply', (r) => r.fulfill(json(getTutorFixture('scheduleApplied'))))
  await page.route('**/api/learn/tutor-loop/progress', (r) => r.fulfill(json(getTutorFixture('progress'))))

  await page.goto('/learn/today')
  await expect(page.getByTestId('today-briefing')).toContainText('Practise acids and bases')
  await page.getByRole('button', { name: '15 min' }).click()
  await page.getByRole('tab', { name: 'This week' }).click()
  await expect(page).toHaveURL(/tab=week/)
  await page.getByTestId('schedule-item').first().click()
  await page.getByRole('button', { name: 'Sun' }).click()
  await expect(page.getByTestId('move-consequence')).toBeVisible()
  await page.getByRole('button', { name: 'Move' }).click()
  await expect(page.getByTestId('schedule-notice')).toContainText('Moved')
  await page.getByRole('tab', { name: 'Progress' }).click()
  await expect(page.getByTestId('progress-readiness')).toContainText('60%')
})
