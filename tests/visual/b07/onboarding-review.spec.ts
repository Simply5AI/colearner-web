import { test, expect, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { applyFixtureSave, onboardingFixture, type OnboardingScenario } from '../../../components/onboarding/meet-co/fixtures'

/**
 * UI-only qualification of A6 "Meet Co" against the development harness (/dev/onboarding)
 * with synthetic HTTP fixtures. No database, school record, identity or model is involved.
 */
const output = path.resolve('output/b07')
type Band = 'kids' | 'tweens' | 'teens'
interface Mock { state: ReturnType<typeof onboardingFixture>; saves: unknown[]; completes: number; skips: number; failSaves: number }

async function fixtures(page: Page, band: Band, scenario: OnboardingScenario = 'default', options: { failSaves?: number; step?: Parameters<typeof onboardingFixture>[0]['step'] } = {}): Promise<Mock> {
  // The real development layout chunk is aborted intermittently by the local dev server (see B06);
  // buffer and retry it. Application code and fixture data are never replaced here.
  await page.route('**/_next/static/chunks/app/layout.js', async route => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await route.fetch({ maxRetries: 2 })
        await route.fulfill({ status: response.status(), headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' }, body: await response.body() })
        return
      } catch (error) { if (attempt === 2) throw error }
    }
  })
  const mock: Mock = { state: onboardingFixture({ band, scenario, ...(options.step ? { step: options.step } : {}) }), saves: [], completes: 0, skips: 0, failSaves: options.failSaves ?? 0 }
  await page.route('**/api/auth/session', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ expires: '2030-01-01T00:00:00Z', accessToken: 'b07-browser-fixture-session', user: { id: 'b07-browser-learner', name: 'B07 browser fixture', email: 'fixture@example.invalid', onboardingCompleted: true } }) }))
  await page.route('**/api/onboarding**', async route => {
    const request = route.request(), url = new URL(request.url())
    const reply = (data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status < 300 ? { data } : data) })
    if (url.pathname.endsWith('/complete')) { mock.completes++; return reply({ nextRoute: 'IMPORT' }) }
    if (url.pathname.endsWith('/skip')) { mock.skips++; return mock.state.skipAllowed ? reply({}) : reply({ code: 'SKIP_NOT_ALLOWED', message: 'no' }, 400) }
    if (request.method() === 'PUT') {
      const body = request.postDataJSON()
      mock.saves.push(body)
      if (mock.failSaves > 0) { mock.failSaves--; return reply({ message: 'Unavailable synthetic fixture' }, 503) }
      mock.state = applyFixtureSave(mock.state, body)
      return reply(mock.state)
    }
    return reply(mock.state)
  })
  return mock
}
const open = (page: Page, band: Band, scenario: OnboardingScenario = 'default', extra = '') => page.goto(`/dev/onboarding?band=${band}&scenario=${scenario}${extra}`)
const heading = (page: Page) => page.locator('[data-step-heading]')
async function overflow(page: Page, width: number) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  expect(dimensions.scrollWidth, `no horizontal page scroll at ${width}px`).toBeLessThanOrEqual(width)
  return dimensions
}
async function targets(page: Page, minimum: number) {
  const sizes = await page.locator('.ds-button:visible, [role="switch"]:visible').evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { label: (node.textContent ?? '').trim() || node.getAttribute('aria-label') || '', height: Math.round(box.height), width: Math.round(box.width) } }))
  for (const size of sizes) expect(size.height, `${size.label} height`).toBeGreaterThanOrEqual(minimum)
  return sizes.length
}
const choose = (page: Page, role: 'radio' | 'checkbox', name: string) => page.getByRole(role, { name, exact: true }).locator('xpath=ancestor::label').click()
const next = (page: Page) => page.getByRole('button', { name: /^(Next|Let’s go)$/ }).first().click()

const records: unknown[] = []
for (const [width, band, minimum] of [[390, 'kids', 64], [1024, 'tweens', 48], [1440, 'teens', 44]] as const) {
  test(`A6 five steps fit ${band} at ${width}px`, async ({ page }) => {
    await mkdir(output, { recursive: true })
    const mock = await fixtures(page, band, band === 'teens' ? 'suggestions' : 'preload')
    await page.setViewportSize({ width, height: 1000 })
    await open(page, band, band === 'teens' ? 'suggestions' : 'preload')
    await expect(page.getByRole('note')).toContainText('synthetic fixtures')
    const shot = async (step: string) => {
      const dimensions = await overflow(page, width)
      const count = await targets(page, minimum)
      await page.screenshot({ path: path.join(output, `meet-co-${band}-${width}-${step}.png`), fullPage: true, animations: 'disabled' })
      records.push({ band, step, ...dimensions, controls: count })
    }
    await expect(heading(page)).toBeVisible(); await shot('hello')
    if (band === 'kids') await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0)
    else await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible()
    await next(page); await expect(heading(page)).toContainText(band === 'kids' ? 'Your grade' : 'Why are you learning?'); await shot('context')
    await next(page)
    await expect(heading(page)).toContainText(band === 'kids' ? 'What you like to learn' : band === 'tweens' ? 'What do you like to learn?' : 'What are you studying?')
    if (band === 'teens') {
      await choose(page, 'radio', 'ICSE')
      await page.getByLabel('Class', { exact: true }).selectOption('9')
      await expect(page.getByRole('checkbox', { name: 'Science', exact: true })).toBeVisible()
      await expect(page.getByTestId('goal-suggestions')).toContainText('Suggested by Co (AI)')
    }
    await choose(page, 'checkbox', 'Maths'); await shot('subjects')
    await next(page); await expect(heading(page)).toContainText(band === 'teens' ? 'How should Co show up?' : 'Make Co yours')
    if (band === 'teens') await choose(page, 'radio', 'Minimal')
    else { await choose(page, 'radio', 'Ocean teal'); await page.getByRole('textbox').fill('Kiki') }
    await shot('personalise')
    await next(page); await expect(page.getByRole('link', { name: band === 'kids' ? 'Snap a page from your book' : 'Snap a page' })).toBeVisible(); await shot('first-import')
    await expect(page.getByRole('link')).toHaveCount(band === 'kids' ? 1 : band === 'tweens' ? 2 : 3)
    expect(mock.saves.length).toBeGreaterThanOrEqual(4)
    await writeFile(path.join(output, `viewport-meet-co-${band}-${width}.json`), JSON.stringify({ date: '2026-10-19', kind: 'development-only-ui-with-synthetic-http-fixtures-no-model-or-database', records: records.filter(record => (record as { band: string }).band === band) }, null, 2))
  })
}

test('RTL: logical layout, no overflow, Back and Next swap sides', async ({ page }) => {
  await fixtures(page, 'teens', 'preload')
  await page.setViewportSize({ width: 390, height: 900 })
  await open(page, 'teens', 'preload', '&dir=rtl')
  await expect(page.locator('html')).toBeVisible()
  await expect(page.locator('[dir="rtl"]').first()).toBeVisible()
  await next(page); await page.getByRole('button', { name: 'Back' }).waitFor()
  const back = await page.getByRole('button', { name: 'Back' }).boundingBox()
  const forward = await page.getByRole('button', { name: 'Next', exact: true }).boundingBox()
  expect(back!.x, 'Back sits at the inline start (right) in RTL').toBeGreaterThan(forward!.x)
  await overflow(page, 390)
  await page.screenshot({ path: path.join(output, 'meet-co-teens-390-rtl.png'), fullPage: true, animations: 'disabled' })
})

test('reduced motion removes Co and step animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await fixtures(page, 'kids', 'preload')
  await page.setViewportSize({ width: 390, height: 900 })
  await open(page, 'kids', 'preload')
  await expect(heading(page)).toBeAttached()
  const animated = await page.evaluate(() => [...document.querySelectorAll('.ds-co, .ds-co *')].filter(node => getComputedStyle(node).animationName !== 'none').length)
  expect(animated).toBe(0)
  const transition = await page.evaluate(() => getComputedStyle(document.querySelector('ol li')!).transitionDuration)
  expect(['0s', '1e-05s']).toContain(transition)
})

test('a failed save keeps the draft and retries the identical request; skip is absent for kids', async ({ page }) => {
  const mock = await fixtures(page, 'kids', 'preload', { failSaves: 1, step: 'PERSONALISE' })
  await page.setViewportSize({ width: 390, height: 900 })
  await open(page, 'kids', 'preload')
  const nickname = page.getByRole('textbox', { name: 'What should I call myself?' })
  await nickname.fill('Kiki')
  await next(page)
  await expect(page.getByRole('alert').filter({ hasText: 'Your choices are still here' })).toBeVisible()
  await expect(nickname).toHaveValue('Kiki')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('link', { name: 'Snap a page from your book' })).toBeVisible()
  expect(mock.saves).toHaveLength(2)
  expect(mock.saves[1]).toEqual(mock.saves[0])
  await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0)
  expect(mock.skips).toBe(0)
})

test('resume lands on the saved step; completing records once before leaving', async ({ page }) => {
  const mock = await fixtures(page, 'tweens', 'resume')
  await page.setViewportSize({ width: 1024, height: 900 })
  await open(page, 'tweens', 'resume')
  await expect(page.getByText(/Welcome back/)).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Science', exact: true })).toBeChecked()
  mock.state = onboardingFixture({ band: 'tweens', step: 'FIRST_IMPORT', scenario: 'preload' })
  await page.reload()
  await page.getByRole('button', { name: 'Later' }).click()
  await expect.poll(() => mock.completes).toBe(1)
  await page.waitForURL('**/learn/import')
})
