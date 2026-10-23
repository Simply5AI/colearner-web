import { expect, test, type Page } from '@playwright/test'

/** All data is the development fixture (app/dev/teacher/plans/mock-server.ts); nothing here proves the real platform. */
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

test('plan list shows cards with measured values kept apart, status in words and a table view', async ({ page }) => {
  await page.goto('/dev/teacher/plans?view=list')
  const cards = page.getByTestId('plan-card')
  await expect(cards).toHaveCount(2)
  const published = cards.filter({ hasText: 'Grade 6 Fractions' })
  await expect(published).toContainText('Published'); await expect(published).toContainText('54% average'); await expect(published).toContainText('Ages 10-13')
  await expect(published.getByText('Measured').first()).toBeVisible()
  await expect(cards.filter({ hasText: 'Algebra Basics' })).toContainText('Draft')
  await expect(cards.filter({ hasText: 'Algebra Basics' }).getByTestId('progress-insufficient')).toHaveText('Not enough data yet')
  await page.getByRole('button', { name: 'Table' }).click()
  await expect(page.getByTestId('plan-table')).toBeVisible(); await expect(page.getByTestId('plan-row')).toHaveCount(2)
  await page.screenshot({ path: test.info().outputPath('t2-list-table.png'), fullPage: true })
  await page.getByRole('button', { name: 'Cards' }).click()
  await page.getByTestId('tab-draft').click()
  await expect(page.getByTestId('plan-card')).toHaveCount(1)
  await page.getByTestId('tab-all').click()
  await page.getByLabel('Search your plans').fill('fractions')
  await expect(page.getByTestId('plan-card')).toHaveCount(1)
  await page.getByLabel('Search your plans').fill('nothing matches this')
  await expect(page.getByTestId('plans-empty')).toContainText('No plans match')
})

test('new plan dialog: three tiles, Co is unavailable with its reason, band defaults from the grade', async ({ page }) => {
  await page.goto('/dev/teacher/plans?view=list')
  await page.getByTestId('new-plan').click()
  const dialog = page.getByTestId('new-plan-dialog')
  await expect(dialog.getByTestId('tile-scratch')).toBeVisible(); await expect(dialog.getByTestId('tile-source')).toBeVisible()
  await expect(dialog.getByTestId('tile-co')).toHaveAttribute('aria-disabled', 'true')
  await expect(dialog.getByTestId('co-unavailable')).toHaveText('Unavailable'); await expect(dialog.getByTestId('co-reason')).toContainText('not available yet')
  await expect(dialog.getByText(/Co is (generating|drafting)/i)).toHaveCount(0)
  await expect(dialog.getByTestId('field-band')).toHaveValue('10-13')
  await dialog.getByTestId('field-class').selectOption('class-3a')
  await expect(dialog.getByTestId('field-band')).toHaveValue('6-9')
  await dialog.getByTestId('field-band').selectOption('14-17')
  await expect(dialog.getByTestId('band-mismatch')).toContainText('nothing is blocked')
  await page.screenshot({ path: test.info().outputPath('t2-new-plan-dialog.png') })
})

test('from an outline: the bad line is named, then the draft plan is created once', async ({ page }) => {
  await page.goto('/dev/teacher/plans?view=new')
  await page.getByTestId('tile-source').click()
  await expect(page.getByTestId('source-curriculum')).toBeEnabled()
  await page.getByLabel('Plan title').fill('Outline plan')
  await page.getByTestId('source-outline').check()
  await page.getByRole('textbox', { name: 'Outline' }).fill('  - orphan')
  await page.getByTestId('create-plan').click()
  await expect(page.getByTestId('outline-error')).toContainText('Line 1')
  await page.getByRole('textbox', { name: 'Outline' }).fill('Fractions\n  - Parts of a whole\n  - Adding\nDecimals\n  - Tenths')
  await page.getByTestId('create-plan').click()
  await expect(page.getByTestId('created-plan')).toBeVisible()
})

test('curriculum choice is disabled with the server reason when it is not loaded', async ({ page }) => {
  await page.goto('/dev/teacher/plans?view=new&state=no-curriculum')
  await page.getByTestId('tile-source').click()
  await expect(page.getByTestId('source-curriculum')).toBeDisabled()
  await expect(page.getByTestId('curriculum-reason')).toContainText('No curriculum has been loaded')
  await expect(page.getByRole('textbox', { name: 'Outline' })).toBeVisible()
})

for (const [state, testId] of [['unavailable', 'plans-error'], ['denied', 'plans-denied'], ['no-class', 'plans-no-class'], ['empty', 'plans-empty']] as const) {
  test(`list state ${state}`, async ({ page }) => {
    await page.goto(`/dev/teacher/plans?view=list&state=${state}`)
    await expect(page.getByTestId(testId)).toBeVisible()
    if (state === 'unavailable') await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
    if (state === 'no-class') await expect(page.getByTestId('new-plan')).toBeDisabled()
  })
}

test('phone width and RTL keep the list and dialog inside the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dev/teacher/plans?view=list&dir=rtl')
  await expect(page.getByTestId('plan-card')).toHaveCount(2)
  expect(await noOverflow(page)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('t2-list-rtl-390.png'), fullPage: true })
  await page.getByTestId('new-plan').click()
  await expect(page.getByTestId('new-plan-dialog')).toBeVisible()
  expect(await noOverflow(page)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('t2-dialog-rtl-390.png') })
})

test('reduced motion and 1024 width', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1024, height: 800 })
  await page.goto('/dev/teacher/plans?view=list')
  await expect(page.getByTestId('plan-card')).toHaveCount(2)
  expect(await noOverflow(page)).toBe(true)
})
