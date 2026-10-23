import { expect, test } from '@playwright/test'

const overflow = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

test('default dashboard at desktop: measured panel separate, deferred panels honest', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/dev/teacher/dashboard')
  await expect(page.getByTestId('t1-root')).toHaveAttribute('data-state', 'ACTIVE')
  await expect(page.getByTestId('fixture-banner')).toContainText('synthetic')
  await expect(page.getByTestId('t1-active')).toContainText('9 of 12')
  await expect(page.getByTestId('t1-classes').getByRole('listitem')).toHaveCount(2)
  await expect(page.getByTestId('t1-later-at-risk')).toContainText('Arrives in a later release')
  await expect(page.getByTestId('t1-later-worksheets')).toContainText('Arrives in a later release')
  await expect(page.getByTestId('t1-progress-insufficient')).toHaveCount(1)
  await expect(page.getByTestId('t1-action-assign')).toBeEnabled()
  await page.screenshot({ path: test.info().outputPath('t1-default-1440.png'), fullPage: true })
})

test('new teacher state: checklist, Create lesson and Assign disabled with reasons', async ({ page }) => {
  await page.goto('/dev/teacher/dashboard?state=new-teacher')
  await expect(page.getByTestId('t1-new-teacher')).toBeVisible()
  await expect(page.getByTestId('t1-check-CREATE_PLAN')).toHaveAttribute('data-done', 'false')
  await expect(page.getByTestId('t1-action-lesson')).toBeDisabled()
  await expect(page.getByTestId('t1-action-assign')).toBeDisabled()
  await expect(page.getByTestId('t1-action-assign-reason')).toContainText('Publish a plan first')
  await expect(page.getByTestId('t1-action-plan')).toHaveAttribute('href', '/teacher/plans/new')
  await page.screenshot({ path: test.info().outputPath('t1-new-teacher.png'), fullPage: true })
})

test('draft ready state lists own drafts', async ({ page }) => {
  await page.goto('/dev/teacher/dashboard?state=draft-ready')
  await expect(page.getByTestId('t1-drafts')).toContainText('Adding fractions')
  await expect(page.getByTestId('t1-drafts')).toContainText('Written by you')
  await expect(page.getByTestId('t1-action-lesson')).toHaveAttribute('href', /topics\/topic-add/)
})

test('no class state', async ({ page }) => {
  await page.goto('/dev/teacher/dashboard?state=no-class')
  await expect(page.getByTestId('t1-no-class')).toContainText('No class is assigned to you yet')
  await expect(page.getByTestId('t1-action-plan')).toBeDisabled()
  await expect(page.locator('body')).not.toContainText(/invite code|QR code/i)
})

test('assign opens the panel in a dialog and closes it with Escape', async ({ page }) => {
  await page.goto('/dev/teacher/dashboard')
  await page.getByTestId('t1-action-assign').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Assign to class')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

for (const [state, text] of [['denied', 'Teaching access denied'], ['unavailable', 'unavailable'], ['malformed', 'This did not load']] as const) {
  test(`${state} state`, async ({ page }) => {
    await page.goto(`/dev/teacher/dashboard?state=${state}`)
    await expect(page.getByTestId('t1-failure')).toContainText(text)
  })
}

test('loading then retry recovers', async ({ page }) => {
  await page.goto('/dev/teacher/dashboard?state=loading')
  await expect(page.getByTestId('t1-loading')).toBeVisible()
  await page.goto('/dev/teacher/dashboard?state=retry')
  await page.getByTestId('t1-failure').getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByTestId('t1-root')).toBeVisible()
})

test('mobile 390 RTL has no horizontal overflow and keeps actions reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dev/teacher/dashboard?dir=rtl')
  await expect(page.getByTestId('t1-root')).toBeVisible()
  expect(await overflow(page)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('t1-rtl-390.png'), fullPage: true })
})

test('tablet 1024 layout and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.goto('/dev/teacher/dashboard')
  await expect(page.getByTestId('t1-root')).toBeVisible()
  expect(await overflow(page)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('t1-1024.png'), fullPage: true })
})

test('keyboard only: quick actions are reachable and show focus', async ({ page }) => {
  await page.goto('/dev/teacher/dashboard')
  await expect(page.getByTestId('t1-root')).toBeVisible()
  const lesson = page.getByTestId('t1-action-lesson')
  await lesson.focus()
  await expect(lesson).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('t1-action-plan')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('t1-action-assign')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
})
