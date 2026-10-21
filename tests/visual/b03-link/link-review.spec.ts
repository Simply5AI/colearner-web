import { test, expect, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { linkStatusFixture, pendingInvitationFixture } from '../../../components/learn/dev/learn-link-fixtures'
import type { LinkStage } from '../../../lib/api/learn-link'

/**
 * UI-only qualification of /learn/link through /dev/learn-link. The real fetching screen runs; the two
 * HTTP endpoints it touches (/api/auth/session and /api/learn/link-status) are answered by page.route
 * with synthetic data. No API, database, school record or guardian is involved.
 */
const output = path.resolve('output/b03-link')
type Band = 'kids' | 'tweens' | 'teens'
const widths: [number, Band][] = [[390, 'kids'], [1024, 'tweens'], [1440, 'teens']]
const stages: LinkStage[] = ['READY', 'NEEDS_ROSTER_LINK', 'NEEDS_GUARDIAN', 'NEEDS_GUARDIAN_CONSENT', 'PROFILE_NOT_BOUND', 'CONSENT_WITHDRAWN', 'AGE_OUT_OF_SCOPE', 'SCHOOL_INACTIVE']
const headings: Record<LinkStage, RegExp> = {
  READY: /You are all set|Your account is ready/,
  NEEDS_ROSTER_LINK: /Your school needs to find you|Your school has not matched your account yet/,
  NEEDS_GUARDIAN: /Your school will ask your (grown-up|parent)|Your school still needs to invite/,
  NEEDS_GUARDIAN_CONSENT: /needs to say yes|needs to give consent/,
  PROFILE_NOT_BOUND: /One more step for your school|needs to connect your account/,
  CONSENT_WITHDRAWN: /Learning is paused/,
  AGE_OUT_OF_SCOPE: /not (ready for you yet|available for your age yet|available for this age yet)/,
  SCHOOL_INACTIVE: /school space is (closed|not open)|school workspace is not active/,
}
const records: unknown[] = []

type Answer = { status?: number; body?: unknown; delay?: Promise<void> }
async function prepare(page: Page, answer: () => Answer) {
  // Buffer/retry the real development layout chunk after observed local aborted asset responses (as B06/B07).
  await page.route('**/_next/static/chunks/app/layout.js', async route => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await route.fetch({ maxRetries: 2 })
        await route.fulfill({ status: response.status(), headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' }, body: await response.body() })
        return
      } catch (error) { if (attempt === 2) throw error }
    }
  })
  await page.route('**/api/auth/session', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ expires: '2030-01-01T00:00:00Z', accessToken: 'b03-link-fixture-session', user: { id: 'b03-link-learner', name: 'B03 link fixture', email: 'fixture@example.invalid', onboardingCompleted: true } }) }))
  await page.route('**/api/learn/link-status', async route => {
    const next = answer()
    await next.delay
    await route.fulfill({ status: next.status ?? 200, contentType: 'application/json', body: JSON.stringify(next.body ?? {}) })
  })
}
const ok = (data: unknown): Answer => ({ body: { statusCode: 200, data, timestamp: '2026-10-19T09:30:00Z' } })
const open = async (page: Page, band: Band, stage: LinkStage | 'none', state = 'default', extra = '') => {
  await page.goto(`/dev/learn-link?band=${band}&stage=${stage === 'none' ? 'NEEDS_ROSTER_LINK' : stage}&state=${state}${extra}`)
  await expect(page.getByRole('note', { includeHidden: true }).first()).toContainText('synthetic fixtures only')
}
const overflow = (page: Page) => page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))

for (const [width, band] of widths) {
  test(`every stage fits ${band} at ${width}px`, async ({ page }) => {
    await mkdir(output, { recursive: true })
    let current: Answer = ok(linkStatusFixture())
    await prepare(page, () => current)
    await page.setViewportSize({ width, height: 1000 })
    for (const stage of stages) {
      current = ok(linkStatusFixture(stage))
      await open(page, band, stage)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(headings[stage])
      await expect(page.getByTestId('waiting-on')).toBeVisible()
      if (stage === 'READY') await expect(page.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/learn/home')
      else await expect(page.getByRole('link', { name: 'Go to Home' })).toHaveCount(0)
      const dimensions = await overflow(page)
      expect(dimensions.scrollWidth, `${stage} overflows at ${width}`).toBeLessThanOrEqual(width)
      await page.screenshot({ path: path.join(output, `${stage}-${band}-${width}.png`), fullPage: true })
      records.push({ state: stage, band, ...dimensions })
    }
    current = ok(pendingInvitationFixture())
    await open(page, band, 'NEEDS_GUARDIAN_CONSENT', 'invitation')
    await expect(page.getByRole('link', { name: 'Accept your student login' })).toHaveAttribute('href', '/student-invite')
    const dimensions = await overflow(page)
    expect(dimensions.scrollWidth, `invitation overflows at ${width}`).toBeLessThanOrEqual(width)
    await page.screenshot({ path: path.join(output, `invitation-${band}-${width}.png`), fullPage: true })
    records.push({ state: 'invitation', band, ...dimensions })
    await writeFile(path.join(output, `viewport-${band}-${width}.json`), JSON.stringify({ date: '2026-10-19', kind: 'development-only-ui-with-synthetic-fixtures-no-api-or-database', records: records.filter(record => (record as { width: number; band: string }).width === width && (record as { band: string }).band === band) }, null, 2))
  })
}

test('loading, denied, unavailable with retry, and session ended', async ({ page }) => {
  await mkdir(output, { recursive: true })
  let release: () => void = () => undefined
  let current: Answer = { ...ok(linkStatusFixture('NEEDS_GUARDIAN_CONSENT')), delay: new Promise<void>(resolve => { release = resolve }) }
  await prepare(page, () => current)
  await page.setViewportSize({ width: 390, height: 900 })
  await open(page, 'tweens', 'NEEDS_GUARDIAN_CONSENT', 'loading')
  await expect(page.getByLabel('Checking what is needed')).toBeVisible()
  await page.screenshot({ path: path.join(output, 'state-loading-tweens-390.png'), fullPage: true })
  release()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  current = { status: 403, body: { code: 'SCHOOL_REQUIRED', message: 'private server text' } }
  await open(page, 'teens', 'none', 'denied')
  await expect(page.getByText('You cannot open this')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
  await expect(page.getByText('private server text')).toHaveCount(0)
  expect((await overflow(page)).scrollWidth).toBeLessThanOrEqual(390)
  await page.screenshot({ path: path.join(output, 'state-denied-teens-390.png'), fullPage: true })

  let failures = 1
  current = { status: 503, body: { message: 'down' } }
  const requests: string[] = []
  page.on('request', request => { if (request.url().includes('/api/learn/link-status')) requests.push(request.method()) })
  await open(page, 'teens', 'none', 'unavailable')
  await expect(page.getByText('This could not load')).toBeVisible()
  await page.screenshot({ path: path.join(output, 'state-unavailable-teens-390.png'), fullPage: true })
  current = ok(linkStatusFixture('NEEDS_ROSTER_LINK'))
  failures--
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(headings.NEEDS_ROSTER_LINK)
  expect(failures).toBe(0)
  expect(requests.every(method => method === 'GET')).toBe(true)

  current = { status: 401, body: { message: 'expired' } }
  await open(page, 'kids', 'none', 'session-ended')
  await expect(page.getByText('Your learning session ended')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Check learner access' })).toHaveAttribute('href', '/learner')
  // No adult sign-out redirect: we are still on the harness page.
  expect(new URL(page.url()).pathname).toBe('/dev/learn-link')
  await page.screenshot({ path: path.join(output, 'state-session-ended-kids-390.png'), fullPage: true })
})

test('RTL: logical layout and no overflow', async ({ page }) => {
  await mkdir(output, { recursive: true })
  let current: Answer = ok(pendingInvitationFixture())
  await prepare(page, () => current)
  await page.setViewportSize({ width: 390, height: 900 })
  await open(page, 'teens', 'NEEDS_GUARDIAN_CONSENT', 'invitation', '&dir=rtl')
  await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('rtl')
  await expect(page.getByRole('link', { name: 'Accept your student login' })).toBeVisible()
  expect((await overflow(page)).scrollWidth).toBeLessThanOrEqual(390)
  // Heading text starts at the inline-start (right) edge in RTL.
  const align = await page.getByRole('heading', { level: 1 }).evaluate(node => getComputedStyle(node).direction)
  expect(align).toBe('rtl')
  await page.screenshot({ path: path.join(output, 'invitation-teens-390-rtl.png'), fullPage: true })
  current = ok(linkStatusFixture('NEEDS_ROSTER_LINK'))
  await open(page, 'kids', 'NEEDS_ROSTER_LINK', 'default', '&dir=rtl')
  await expect(page.getByTestId('link-journey')).toBeVisible()
  expect((await overflow(page)).scrollWidth).toBeLessThanOrEqual(390)
  await page.screenshot({ path: path.join(output, 'NEEDS_ROSTER_LINK-kids-390-rtl.png'), fullPage: true })
})

test('reduced motion stops Co and skeleton animation', async ({ page }) => {
  let release: () => void = () => undefined
  const current: Answer = { ...ok(linkStatusFixture()), delay: new Promise<void>(resolve => { release = resolve }) }
  await prepare(page, () => current)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1024, height: 900 })
  await open(page, 'tweens', 'none', 'loading')
  await expect(page.getByLabel('Checking what is needed')).toBeVisible()
  const names = await page.evaluate(() => [...document.querySelectorAll('.ds-co, .ds-co *, .ds-skeleton')].map(node => getComputedStyle(node).animationName))
  expect(names.length).toBeGreaterThan(0)
  expect(names.every(name => name === 'none')).toBe(true)
  release()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const after = await page.evaluate(() => [...document.querySelectorAll('.ds-co, .ds-co *')].map(node => getComputedStyle(node).animationName))
  expect(after.every(name => name === 'none')).toBe(true)
})

test('keyboard: focus starts on the heading, Tab reaches Check again with a visible ring, Enter rechecks', async ({ page }) => {
  await mkdir(output, { recursive: true })
  let calls = 0
  let current: Answer = ok(linkStatusFixture('NEEDS_GUARDIAN_CONSENT'))
  await prepare(page, () => { calls++; return current })
  await page.setViewportSize({ width: 1024, height: 900 })
  await open(page, 'tweens', 'NEEDS_GUARDIAN_CONSENT')
  const heading = page.getByRole('heading', { level: 1 })
  await expect(heading).toBeFocused()
  const before = calls
  const button = page.getByRole('button', { name: 'Check again' })
  for (let index = 0; index < 6 && !(await button.evaluate(node => node === document.activeElement)); index++) await page.keyboard.press('Tab')
  await expect(button).toBeFocused()
  const outline = await button.evaluate(node => { const style = getComputedStyle(node); return { width: style.outlineWidth, style: style.outlineStyle, shadow: style.boxShadow } })
  expect(outline.style !== 'none' || outline.shadow !== 'none').toBe(true)
  await page.screenshot({ path: path.join(output, 'focus-check-again-tweens-1024.png'), fullPage: true })
  current = ok(linkStatusFixture('PROFILE_NOT_BOUND'))
  await page.keyboard.press('Enter')
  await expect(heading).toHaveText(headings.PROFILE_NOT_BOUND)
  expect(calls).toBeGreaterThan(before)
  // Disabled while checking, so focus must come back to the button.
  await expect(button).toBeFocused()
})
