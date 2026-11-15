import { expect, test } from '@playwright/test'

/**
 * Sara/Rohan journey, Ask Co part. Needs the stack up with TUTOR_LOOP_ENABLED and a seeded Teen persona signed in
 * (see colearner-platform/docs/local-development.md). Not run in this wave: see the W3 handoff.
 */
test('open Ask Co from a topic, ask, see a cited reply, open the source panel', async ({ page }) => {
  await page.goto('/learn/co?kind=GLOBAL&mode=ASK')
  await expect(page.getByTestId('ask-co-page')).toBeVisible()
  await page.getByLabel(/^Message /).fill('What is an acid?')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByTestId('tutor-exchange').first()).toBeVisible()
  await page.getByRole('button', { name: 'Source and notes' }).click()
  await expect(page.getByRole('complementary', { name: 'Source and notes' })).toBeVisible()
})
