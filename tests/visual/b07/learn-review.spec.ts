import { test, expect, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * UI-only qualification of the real B07 views through /dev/learn. Data is synthetic and no request
 * reaches an API, model or database. This does not qualify the platform contract or live permissions.
 */
const output = path.resolve('output/b07')
type Band = 'kids' | 'tweens' | 'teens'
const widths: [number, Band][] = [[390, 'kids'], [1024, 'tweens'], [1440, 'teens']]
const screens: { screen: 'home' | 'learn' | 'plan'; state: string; expect: (band: Band) => RegExp }[] = [
  { screen: 'home', state: 'default', expect: band => band === 'kids' ? /Hi Aarav! Let.s finish Parts of a plant!/ : band === 'tweens' ? /Adding fractions/ : /Board exams in 142 days/ },
  { screen: 'home', state: 'first-time', expect: () => /Bring something to learn/ },
  { screen: 'home', state: 'limit-reached', expect: () => /All done for today!|reached today.s learning time/ },
  { screen: 'home', state: 'loading', expect: () => /Loading your home/ },
  { screen: 'learn', state: 'default', expect: band => band === 'kids' ? /Pick an adventure!/ : /Your own plans and plans from your teachers/ },
  { screen: 'learn', state: 'empty', expect: () => /Nothing here yet/ },
  { screen: 'learn', state: 'join-code', expect: () => /Class code/ },
  { screen: 'learn', state: 'approval-pending', expect: band => band === 'teens' ? /Waiting for your parent or guardian to approve/ : /Waiting for your parent to say yes/ },
  { screen: 'plan', state: 'default', expect: band => band === 'kids' ? /Your adventure map/ : /Chapters|Levels/ },
  { screen: 'plan', state: 'topic-expanded', expect: () => /Lessons open when the lesson player ships/ },
  { screen: 'plan', state: 'no-sources', expect: () => /No sources yet/ },
  { screen: 'plan', state: 'locked', expect: () => /controls the (steps|levels) of this plan/ },
]
const records: unknown[] = []

async function prepare(page: Page) {
  // Buffer/retry the real development layout chunk after observed local aborted asset responses (as B06).
  await page.route('**/_next/static/chunks/app/layout.js', async route => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await route.fetch({ maxRetries: 2 })
        await route.fulfill({ status: response.status(), headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' }, body: await response.body() })
        return
      } catch (error) { if (attempt === 2) throw error }
    }
  })
  await page.route('**/api/auth/session', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({}) }))
}
const open = async (page: Page, screen: string, band: Band, state: string, extra = '') => {
  await page.goto(`/dev/learn?screen=${screen}&band=${band}&state=${state}${extra}`)
  // A modal dialog hides the rest of the page from the accessibility tree, so look past that for the notice.
  await expect(page.getByRole('note', { includeHidden: true }).first()).toContainText('synthetic fixtures only')
}
const overflow = (page: Page) => page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))

for (const [width, band] of widths) {
  test(`L1-L3 states fit ${band} at ${width}px`, async ({ page }) => {
    await mkdir(output, { recursive: true })
    await prepare(page)
    await page.setViewportSize({ width, height: 1000 })
    for (const item of screens) {
      await open(page, item.screen, band, item.state)
      await expect(page.getByText(item.expect(band)).first()).toBeVisible()
      const dimensions = await overflow(page)
      expect(dimensions.scrollWidth, `${item.screen}/${item.state} overflows at ${width}`).toBeLessThanOrEqual(width)
      await page.screenshot({ path: path.join(output, `${item.screen}-${item.state}-${band}-${width}.png`), fullPage: true })
      records.push({ screen: item.screen, state: item.state, band, ...dimensions })
    }
    await writeFile(path.join(output, `viewport-${band}-${width}.json`), JSON.stringify({ date: '2026-10-19', kind: 'development-only-ui-with-synthetic-fixtures-no-api-model-or-database', records: records.filter(record => (record as { width: number }).width === width) }, null, 2))
  })
}

test('default screens of every band fit a 390px phone and a 768px tablet', async ({ page }) => {
  await prepare(page)
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 900 })
    for (const band of ['kids', 'tweens', 'teens'] as const) for (const screen of ['home', 'learn', 'plan']) {
      await open(page, screen, band, 'default')
      await expect(page.getByRole('heading').first()).toBeVisible()
      const dimensions = await overflow(page)
      expect(dimensions.scrollWidth, `${screen}/${band} overflows at ${width}`).toBeLessThanOrEqual(width)
      if (width === 390) await page.screenshot({ path: path.join(output, `${screen}-default-${band}-390.png`), fullPage: true })
    }
  }
})

test('RTL: logical layout, no overflow and the join dialog follows direction', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 390, height: 900 })
  await open(page, 'learn', 'teens', 'join-code', '&dir=rtl')
  await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('rtl')
  await expect(page.getByRole('dialog', { name: 'Join with a code' })).toBeVisible()
  const box = await page.getByRole('dialog').boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  await page.screenshot({ path: path.join(output, 'learn-join-code-teens-390-rtl.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await open(page, 'plan', 'kids', 'default', '&dir=rtl')
  expect((await overflow(page)).scrollWidth).toBeLessThanOrEqual(390)
  await page.screenshot({ path: path.join(output, 'plan-default-kids-390-rtl.png'), fullPage: true })
})

test('reduced motion stops Co and skeleton animation', async ({ page }) => {
  await prepare(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1024, height: 900 })
  await open(page, 'home', 'tweens', 'loading')
  const names = await page.evaluate(() => [...document.querySelectorAll('.ds-co, .ds-co *, .ds-skeleton')].map(node => getComputedStyle(node).animationName))
  expect(names.length).toBeGreaterThan(0)
  expect(names.every(name => name === 'none')).toBe(true)
})

test('keyboard: join dialog contains focus, Escape closes it and returns focus', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 1024, height: 900 })
  await open(page, 'learn', 'tweens', 'default')
  const trigger = page.getByRole('button', { name: 'Join with a code' })
  await trigger.focus(); await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Join with a code' })
  await expect(dialog).toBeVisible()
  // Initial focus is applied asynchronously after the dialog mounts.
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)
  // Tab past the last control: Base UI's focus guard must send focus back inside the dialog, never to the page behind.
  const inside = () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))
  for (let index = 0; index < 7; index++) {
    await page.keyboard.press('Tab')
    await expect.poll(inside, { message: `focus left the dialog on Tab ${index + 1}`, timeout: 2000 }).toBe(true)
  }
  await dialog.getByLabel('Class code').fill('PENDING1')
  await page.keyboard.press('Enter')
  await expect(dialog.getByText('Waiting for your parent to say yes')).toBeVisible()
  await page.screenshot({ path: path.join(output, 'learn-join-pending-tweens-1024.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('interaction: kids stones open a lesson panel; teen topics expand and collapse; controls stay unavailable', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 390, height: 900 })
  await open(page, 'plan', 'kids', 'default')
  await page.getByRole('button', { name: 'Leaves, next up' }).click()
  await expect(page.getByTestId('topic-panel').getByText('Leaves make food')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start lesson' }).first()).toBeDisabled()
  await page.screenshot({ path: path.join(output, 'plan-stone-opened-kids-390.png'), fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await open(page, 'plan', 'teens', 'default')
  const topic = page.getByRole('button', { name: /Acids and bases/ })
  await expect(topic).toHaveAttribute('aria-expanded', 'false')
  await topic.click()
  await expect(topic).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText('pH practice')).toBeVisible()
  await topic.click()
  await expect(page.getByText('pH practice')).toBeHidden()
  await expect(page.getByRole('link', { name: /Start lesson|Start next/ })).toHaveCount(0)
})
