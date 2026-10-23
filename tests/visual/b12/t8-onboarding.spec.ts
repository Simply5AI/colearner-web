import { expect, test } from '@playwright/test'

const current = (page: import('@playwright/test').Page) => page.getByTestId('t8-progress').locator('[aria-current="step"]')

test('full manual path with keyboard-friendly controls: profile, plan, skip material, publish, assign, finish', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/dev/teacher/onboarding')
  await expect(page.getByTestId('t8-profile-form')).toBeVisible()
  await expect(page.getByTestId('t8-photo')).toBeVisible()
  await expect(page.getByTestId('t8-skip')).toHaveCount(0)
  await page.getByLabel('Name students will see').fill('Daniel Okafor')
  await page.getByLabel('Add a subject').fill('Mathematics')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('t8-subjects')).toContainText('Mathematics')
  await page.getByLabel('Grade 6').check()
  await page.screenshot({ path: test.info().outputPath('t8-profile-1440.png'), fullPage: true })
  await page.getByRole('button', { name: 'Save and continue' }).click()
  await expect(current(page)).toContainText('First plan')

  // W2's real NewPlanOptions, against the fixture server.
  await page.getByLabel('Plan title').fill('Class 6 Fractions')
  await page.getByTestId('create-plan').click()
  await expect(page.getByTestId('t8-first-plan-saved')).toContainText('Class 6 Fractions')
  await expect(page.getByTestId('t8-first-plan-saved')).toContainText('Draft')
  await page.getByTestId('t8-first-plan-saved').getByRole('button', { name: 'Continue' }).click()

  await expect(current(page)).toContainText('Material')
  await page.getByTestId('t8-skip').click()
  await expect(current(page)).toContainText('Students')
  await expect(page.getByTestId('t8-invite-needs-publish')).toBeVisible()
  await page.getByTestId('fixture-publish').click()
  await expect(page.getByTestId('t8-roster-count')).toContainText('28')
  await page.screenshot({ path: test.info().outputPath('t8-invite-1440.png'), fullPage: true })
  await page.getByTestId('t8-to-done').click()
  await expect(current(page)).toContainText('Done')
  await expect(page.getByTestId('t8-done-title')).toHaveText('Published. Students will see it once you assign it to a class')
  await page.getByRole('button', { name: 'Finish setup' }).click()
  await expect(page.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute('href', '/teacher/dashboard')
})

for (const [state, title] of [
  ['done-not-published', 'Your plan is saved as a draft'],
  ['done-published', 'Published. Students will see it once you assign it to a class'],
  ['done-pending', 'Assigned. Students appear once their guardians approve'],
  ['done-live', 'Your plan is live'],
] as const) {
  test(`Done copy for ${state}`, async ({ page }) => {
    await page.goto(`/dev/teacher/onboarding?state=${state}`)
    await expect(page.getByTestId('t8-done-title')).toHaveText(title)
    if (state !== 'done-live') await expect(page.getByTestId('t8-done')).not.toContainText(/is live/i)
    await page.screenshot({ path: test.info().outputPath(`t8-${state}.png`), fullPage: true })
  })
}

test('refresh resumes at the saved step and skip exists only on steps 3 and 4', async ({ page }) => {
  await page.goto('/dev/teacher/onboarding?state=material')
  await expect(page.getByTestId('t8-material')).toBeVisible()
  await expect(current(page)).toContainText('Material')
  await expect(page.getByTestId('t8-skip')).toBeVisible()
  await page.reload()
  await expect(current(page)).toContainText('Material')
  await page.getByTestId('t8-progress').getByRole('button').first().click()
  await expect(page.getByTestId('t8-profile-form')).toBeVisible()
  await expect(page.getByTestId('t8-skip')).toHaveCount(0)
  await expect(page.getByTestId('t8-progress').getByRole('button').nth(4)).toBeDisabled()
})

test('profile conflict keeps the draft; photo hidden without storage', async ({ page }) => {
  await page.goto('/dev/teacher/onboarding?conflict=1&photo=off')
  await expect(page.getByTestId('t8-photo')).toHaveCount(0)
  await page.getByLabel('Name students will see').fill('Daniel')
  await page.getByLabel('Add a subject').fill('Science')
  await page.getByLabel('Grade 7').check()
  await page.getByRole('button', { name: 'Save and continue' }).click()
  await expect(page.getByTestId('t8-profile-failure')).toContainText('kept')
  await expect(page.getByLabel('Name students will see')).toHaveValue('Daniel')
})

test('material step: invalid link is refused, valid link is added', async ({ page }) => {
  await page.goto('/dev/teacher/onboarding?state=material')
  await page.getByRole('button', { name: 'Add a link' }).click()
  await page.getByLabel('Title').fill('Fractions video')
  await page.getByLabel('Link (https)').fill('http://plain.example')
  await page.getByRole('button', { name: 'Add material' }).click()
  await expect(page.getByTestId('t8-material-error')).toContainText('https://')
  await page.getByLabel('Link (https)').fill('https://example.org/fractions')
  await page.getByRole('button', { name: 'Add material' }).click()
  await expect(page.getByTestId('t8-material-added')).toContainText('Fractions video')
})

for (const [state, text] of [['denied', 'Teaching access denied'], ['unavailable', 'unavailable'], ['malformed', 'This did not load']] as const) {
  test(`${state} state`, async ({ page }) => {
    await page.goto(`/dev/teacher/onboarding?state=${state}`)
    await expect(page.getByTestId('t8-failure')).toContainText(text)
  })
}

test('no class state explains instead of offering a form', async ({ page }) => {
  await page.goto('/dev/teacher/onboarding?state=no-class')
  await expect(page.getByTestId('t8-no-class')).toContainText('No class is assigned')
  await expect(page.getByTestId('create-plan')).toHaveCount(0)
})

test('mobile 390 RTL profile step has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/dev/teacher/onboarding?dir=rtl')
  await expect(page.getByTestId('t8-profile-form')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('t8-rtl-390.png'), fullPage: true })
})
