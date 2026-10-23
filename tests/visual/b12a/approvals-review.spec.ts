import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

const out = process.env.B12A_OUTPUT_DIR ? path.resolve(process.env.B12A_OUTPUT_DIR) : path.join(process.env.TMPDIR ?? '/tmp', 'colearner-b12a')
const widths = [390, 768, 1280]
const url = (scenario: string, extra = '') => `/dev/family/approvals?scenario=${scenario}${extra}`
const calls = (page: Page) => page.evaluate(() => (window as unknown as { __approvalCalls: { method: string; path: string; key: string | null; body: unknown }[] }).__approvalCalls)

async function open(page: Page, target: string) {
  await page.route('**/api/auth/session', route => route.fulfill({ contentType: 'application/json', body: '{}' }))
  await page.goto(target, { waitUntil: 'domcontentloaded' })
  if (await page.getByText('Something went wrong').isVisible().catch(() => false)) await page.reload({ waitUntil: 'domcontentloaded' })
}
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)

test('pending list at phone, tablet and desktop widths: no horizontal scroll, 44px targets, screenshots', async ({ page }) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    await open(page, url('default'))
    await expect(page.getByTestId('approval-card')).toHaveCount(2)
    expect(await noOverflow(page), `overflow at ${width}`).toBe(true)
    for (const button of await page.getByRole('button', { name: /^(Approve|Decline) / }).all()) {
      const box = (await button.boundingBox())!
      expect(box.height, `target height at ${width}`).toBeGreaterThanOrEqual(43.5)
    }
    await page.screenshot({ path: path.join(out, `pending-${width}.png`), fullPage: true })
  }
})

test('approve: confirm dialog, focus returns, one keyed POST, card leaves Pending and shows in History', async ({ page }) => {
  await open(page, url('default'))
  const approve = page.getByRole('button', { name: 'Approve Fractions plan 1 for Student' })
  await approve.click()
  const dialog = page.getByTestId('approval-confirm')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('right away')
  await page.screenshot({ path: path.join(out, 'confirm-approve.png') })
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  expect((await calls(page)).filter(call => call.method === 'POST')).toHaveLength(0)
  await approve.click()
  await page.getByRole('button', { name: 'Yes, approve' }).click()
  await expect(page.getByTestId('approval-notice')).toContainText('Approved. Student can now open')
  await expect(page.getByTestId('approval-card')).toHaveCount(1)
  const posts = (await calls(page)).filter(call => call.method === 'POST')
  expect(posts).toHaveLength(1)
  expect(posts[0]!.key).toMatch(/^[0-9a-f-]{36}$/)
  await page.getByRole('tab', { name: 'History' }).click()
  await expect(page.getByTestId('approval-card').filter({ hasText: 'Fractions plan 1' })).toHaveAttribute('data-state', 'APPROVED')
})

test('failed send keeps the dialog and the retry reuses the Idempotency-Key', async ({ page }) => {
  await open(page, url('flaky-decision'))
  await page.getByRole('button', { name: 'Decline Fractions plan 1 for Student' }).click()
  await page.getByRole('button', { name: 'Yes, decline' }).click()
  await expect(page.getByTestId('approval-error')).toContainText('not decide twice')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByTestId('approval-notice')).toContainText('Declined.')
  const posts = (await calls(page)).filter(call => call.method === 'POST')
  expect(posts).toHaveLength(2)
  expect(posts[1]!.key).toBe(posts[0]!.key)
})

test('history revoke states that access is lost now', async ({ page }) => {
  await open(page, url('default'))
  await page.getByRole('tab', { name: 'History' }).click()
  await page.getByRole('button', { name: 'Remove access Earlier plan for Student' }).click()
  await expect(page.getByTestId('approval-confirm')).toContainText('immediately')
  await page.screenshot({ path: path.join(out, 'confirm-revoke.png') })
  await page.getByRole('button', { name: 'Yes, remove access now' }).click()
  await expect(page.getByTestId('approval-notice')).toContainText('Access removed.')
  await expect(page.getByTestId('approval-card').filter({ hasText: 'Earlier plan' })).toHaveAttribute('data-state', 'REVOKED')
})

for (const [scenario, heading] of [['empty', 'Nothing is waiting for you'], ['denied', 'Approvals need a verified guardian'], ['unavailable', 'Approvals unavailable'], ['invalid', 'Approvals unavailable']] as const) {
  test(`${scenario} state`, async ({ page }) => {
    await open(page, url(scenario))
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    await page.screenshot({ path: path.join(out, `state-${scenario}.png`) })
  })
}

test('already decided by another guardian shows the recorded decision', async ({ page }) => {
  await open(page, url('already-decided'))
  await page.getByRole('button', { name: 'Approve Fractions plan 1 for Student' }).click()
  await page.getByRole('button', { name: 'Yes, approve' }).click()
  await expect(page.getByTestId('approval-notice')).toContainText('approved by Other Guardian')
})

test('detail page, and rtl layout without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await open(page, url('default', '&screen=detail&dir=rtl'))
  await expect(page.getByTestId('approval-detail')).toBeVisible()
  expect(await noOverflow(page)).toBe(true)
  await page.screenshot({ path: path.join(out, 'detail-rtl-390.png'), fullPage: true })
})

test('keyboard: dialog keeps focus away from the page behind and returns it to the trigger', async ({ page }) => {
  await open(page, url('default'))
  const trigger = page.getByRole('button', { name: 'Approve Fractions plan 1 for Student' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('approval-confirm')).toBeVisible()
  for (let i = 0; i < 6; i += 1) { await page.keyboard.press('Tab'); const where = await page.evaluate(() => { const el = document.activeElement; return { inside: !!el?.closest('[data-testid="approval-confirm"]'), tag: el?.tagName, label: el?.getAttribute('aria-label') ?? el?.textContent?.slice(0, 30), guard: el?.hasAttribute('data-base-ui-focus-guard') } }); // Tabbing past the last control may pass through the browser chrome (body); it must never land on page content behind the dialog.
    expect(where.inside || where.guard || where.tag === 'BODY', JSON.stringify(where)).toBe(true) }
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})
