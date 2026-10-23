import { expect, test, type Page } from '@playwright/test'

/** The real plan view and reader with synthetic fixtures; nothing here proves the real platform. */
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
async function openLesson(page: Page, band: 'kids' | 'tweens' | 'teens') {
  if (band === 'kids') await page.getByRole('button', { name: /^Leaves/ }).click()
  if (band === 'teens') await page.getByRole('button', { name: /Acids and bases/ }).click()
  await page.getByTestId('teacher-lesson-link').getByRole('button', { name: /Open (the )?lesson/ }).click()
  await expect(page.getByTestId('teacher-lesson')).toBeVisible()
}

for (const band of ['kids', 'tweens', 'teens'] as const) {
  test(`${band}: the lesson opens from the topic, says it is from the teacher, and steps through`, async ({ page }) => {
    await page.goto(`/dev/learn/teacher-lesson?band=${band}`)
    await openLesson(page, band)
    const lesson = page.getByTestId('teacher-lesson')
    await expect(lesson.getByTestId('from-teacher')).toHaveText('From your teacher')
    await expect(page.getByText(/Made by Co with AI|Co made this|Co draft/)).toHaveCount(0)
    await expect(lesson.getByTestId('lesson-progress')).toHaveText('Step 1 of 5')
    await expect(lesson.getByTestId('co-line')).toContainText('Let us share a pizza!')
    await lesson.getByTestId('lesson-next').click()
    await expect(lesson.getByTestId('lesson-progress')).toHaveText('Step 2 of 5')
    await expect(lesson.getByRole('heading', { name: 'Add the tops, keep the bottom' })).toBeFocused()
    await expect(lesson.getByTestId('lesson-sources').getByRole('link', { name: 'Mr. Thomas notes' })).toHaveAttribute('href', '/learn/library/mat-pdf')
    await lesson.getByTestId('lesson-next').click()
    await expect(lesson.getByRole('table')).toBeVisible()
    await page.screenshot({ path: test.info().outputPath(`learner-${band}-table.png`), fullPage: true })
  })
}

test('a check gives feedback, reveals the right answer only when correct, and is not graded', async ({ page }) => {
  await page.goto('/dev/learn/teacher-lesson?band=tweens')
  await openLesson(page, 'tweens')
  const lesson = page.getByTestId('teacher-lesson')
  for (let step = 0; step < 3; step += 1) await lesson.getByTestId('lesson-next').click()
  const check = lesson.getByTestId('lesson-check')
  await check.getByRole('radio', { name: '5/16' }).check()
  await check.getByRole('button', { name: 'Check my answer' }).click()
  await expect(check.getByTestId('check-result')).toHaveAttribute('data-correct', 'false')
  await expect(check.getByTestId('check-result')).toContainText('The bottom number stays 8.')
  await expect(check.getByRole('radio', { name: '5/8' })).toBeEnabled()
  await check.getByRole('button', { name: 'Need a hint?' }).click()
  await expect(check.getByTestId('lesson-hint')).toContainText('Add only the top numbers')
  await check.getByRole('radio', { name: '5/8' }).check()
  await check.getByRole('button', { name: 'Check my answer' }).click()
  await expect(check.getByTestId('check-result')).toHaveAttribute('data-correct', 'true')
  await expect(check).toContainText('not a grade and is not saved')
  await lesson.getByTestId('lesson-next').click()
  await lesson.getByTestId('lesson-finish-step').click()
  await expect(lesson.getByTestId('lesson-done')).toContainText('Key terms')
  await expect(page.locator('body')).not.toContainText('correctOptionId')
})

test('an answer key in the learner payload is refused, never shown', async ({ page }) => {
  await page.goto('/dev/learn/teacher-lesson?band=tweens&state=leak')
  await page.getByTestId('teacher-lesson-link').getByRole('button', { name: 'Open lesson' }).click()
  await expect(page.getByText('The lesson could not load.')).toBeVisible()
  await expect(page.getByText('returned something unexpected')).toBeVisible()
  await expect(page.getByTestId('teacher-lesson')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('an unavailable lesson is a plain message, and a topic without a lesson has no link', async ({ page }) => {
  await page.goto('/dev/learn/teacher-lesson?band=tweens&state=unavailable')
  await page.getByTestId('teacher-lesson-link').getByRole('button', { name: 'Open lesson' }).click()
  await expect(page.getByText('This lesson is not available right now.')).toBeVisible()
  await page.goto('/dev/learn/teacher-lesson?band=tweens&state=no-lesson')
  await expect(page.getByTestId('topic').first()).toBeVisible()
  await expect(page.getByTestId('teacher-lesson-link')).toHaveCount(0)
})

test('phone width, RTL and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dev/learn/teacher-lesson?band=teens&dir=rtl')
  await openLesson(page, 'teens')
  await page.getByTestId('teacher-lesson').getByTestId('lesson-next').click()
  expect(await noOverflow(page)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('learner-teens-rtl-390.png'), fullPage: true })
})
