import { test, expect, type Page, type Route } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHomeworkMock, type HomeworkMock, type HomeworkMockOptions, type HomeworkSeed } from '../../../components/homework/dev/homework-mock'
import { scripts } from '../../../components/homework/dev/homework-fixtures'

/**
 * UI-only qualification of the real B10 guided homework screens (L18) through /dev/homework. The co and homework endpoints are
 * answered with page.route by the same test double the integration tests use (the platform co-homework module was built in
 * parallel), and /api/auth/session is mocked. No API, model, database or real voice is involved: speech is a fake local voice.
 * The coach wording is canned; nothing here proves Co's behaviour.
 */
const output = process.env.B10_OUTPUT_DIR ? path.resolve(process.env.B10_OUTPUT_DIR) : path.resolve('output/b10')
type Band = 'kids' | 'tweens' | 'teens'
const widths: [number, Band][] = [[390, 'kids'], [1024, 'tweens'], [1440, 'teens']]
const minTarget: Record<Band, number> = { kids: 64, tweens: 48, teens: 44 }
type Scenario = Partial<Omit<HomeworkMockOptions, 'band' | 'seed'>> & { band: Band; seed?: HomeworkSeed; screen?: 'entry' | 'session'; dir?: 'rtl'; speech?: 'fake' | 'none'; extra?: Record<string, string> }
let mock: HomeworkMock
const records: unknown[] = []
const problems: string[] = []
const forbidden = /worked solution|full solution|show (me )?the (full )?(answer|solution)|correct answer|the answer is/i

async function prepare(page: Page) {
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`))
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource|favicon|net::ERR|Download the React DevTools/.test(message.text())) problems.push(`console: ${message.text()}`) })
  // Buffer/retry the real development layout chunk after observed local aborted asset responses (as B06/B07/B08/B09).
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
  const answer = (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const raw = request.postData()
    if (mock.options.loading) return new Promise<void>(() => undefined)
    const reply = mock.handle(request.method(), url.pathname + url.search, raw ? JSON.parse(raw) : undefined)
    return route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body) })
  }
  await page.route('**/api/learn/homework**', answer)
  await page.route('**/api/learn/co/**', answer)
}
async function open(page: Page, scenario: Scenario) {
  const { band, seed = 'new', screen, dir, speech = 'fake', extra = {}, ...options } = scenario
  mock = createHomeworkMock({ band, seed, ...options })
  const query = new URLSearchParams({ mock: 'network', band, seed, speech, pollMs: '250', ...extra })
  if (screen) query.set('screen', screen)
  if (dir) query.set('dir', dir)
  await page.goto(`/dev/homework?${query}`)
  // A focused frame makes the page behind it inert, which hides the notice from the accessibility tree, so look past that.
  await expect(page.getByRole('note', { includeHidden: true }).first()).toContainText('synthetic fixtures only')
}
const frameOverflow = (page: Page) => page.evaluate(() => {
  const frame = document.querySelector('[data-lesson-frame]')
  return { frame: frame ? { scrollWidth: frame.scrollWidth, clientWidth: frame.clientWidth } : null, width: innerWidth, scrollWidth: document.documentElement.scrollWidth }
})
async function expectNoOverflow(page: Page, width: number, label: string) {
  const dimensions = await frameOverflow(page)
  expect(dimensions.scrollWidth, `${label} overflows the page at ${width}`).toBeLessThanOrEqual(width)
  if (dimensions.frame) expect(dimensions.frame.scrollWidth, `${label} overflows its frame at ${width}`).toBeLessThanOrEqual(dimensions.frame.clientWidth)
  return dimensions
}
async function expectTargets(page: Page, band: Band, label: string) {
  const boxes = await page.evaluate(() => [...document.querySelectorAll('button:not([disabled]), a.ds-button, input:not([type=hidden]), textarea')].filter(node => {
    const rect = node.getBoundingClientRect(); const style = getComputedStyle(node)
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && !node.closest('[inert]') && !!node.closest('[data-age-band]')
  }).map(node => ({ name: (node.getAttribute('aria-label') ?? node.textContent ?? node.getAttribute('placeholder') ?? '').trim().slice(0, 40), height: node.getBoundingClientRect().height, width: node.getBoundingClientRect().width })))
  for (const box of boxes) {
    expect(box.height, `${label}: target "${box.name}" is ${box.height}px high`).toBeGreaterThanOrEqual(minTarget[band] - 1)
    expect(box.width, `${label}: target "${box.name}" is ${box.width}px wide`).toBeGreaterThanOrEqual(Math.min(minTarget[band], 44) - 1)
  }
}
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true })
const text = (page: Page) => page.locator('body').innerText()
async function expectNoSolution(page: Page, band: Band) {
  // The learner's own typed answer is theirs to see; everything Co wrote must be free of the expected answer.
  const own = await page.getByTestId('your-answer').allInnerTexts()
  let body = (await text(page)).replace(scripts[band].problem, '')
  for (const entry of own) body = body.replace(entry, '')
  expect(body).not.toMatch(forbidden)
  for (const answer of scripts[band].expected.all) expect(body.toLowerCase(), `the expected answer "${answer}" must not be shown`).not.toContain(answer.toLowerCase())
}
const hintCalls = () => mock.calls.filter(call => call.method === 'POST' && call.path.endsWith('/hint')).map(call => (call.body as { level: number }).level)

const sessionSeeds: [HomeworkSeed, string][] = [
  ['restate-pending', 'thinking-title'], ['restate', 'restatement'], ['capture', 'problem-card-or-capture'], ['steps', 'step-prompt'], ['steps-2', 'step-trail'], ['steps-hint1', 'hint-ladder'],
  ['steps-hint3', 'hint-unavailable'], ['thinking', 'thinking-title'], ['final', 'final-line'], ['checked-on-track', 'checked-title'], ['checked-not-yet', 'checked-title'],
  ['checked-unclear', 'checked-title'], ['checked-exhausted', 'tries-used'], ['done', 'done-title'], ['done-neutral', 'done-neutral'], ['abandoned', 'abandoned'],
  ['safety', 'safety-guidance'], ['safety-trusted', 'safety-guidance'], ['failed', 'failed'], ['failed-final', 'failed'],
]
const settle = async (page: Page, id: string) => {
  if (id === 'problem-card-or-capture') return expect(page.getByRole('heading', { name: /fix the problem/i })).toBeVisible()
  if (id === 'abandoned') return expect(page.getByText('This homework help was closed')).toBeVisible()
  if (id === 'failed') return expect(page.getByRole('heading', { name: 'Co could not finish that' })).toBeVisible()
  return expect(page.getByTestId(id)).toBeVisible()
}

for (const [width, band] of widths) {
  test.describe(`${band} at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await mkdir(output, { recursive: true })
      await prepare(page)
      await page.setViewportSize({ width, height: width === 390 ? 1500 : 1100 })
    })

    test('entry: typed problem, disabled Snap card with the server reason, parent notice, earlier sessions', async ({ page }) => {
      await open(page, { band })
      await expect(page.getByRole('heading', { level: 1, name: 'Homework help' })).toBeVisible()
      await expect(page.getByTestId('snap-reason')).toContainText('not available yet')
      await expect(page.getByRole('button', { name: 'Snap the problem' })).toBeDisabled()
      await expect(page.getByTestId('ai-label')).toHaveText('Co is an AI helper')
      await expect(page.getByTestId('parent-notice')).toContainText(band === 'kids' ? 'Your grown-up can see your homework help.' : band === 'tweens' ? 'Your parent can see your homework help sessions.' : 'Your parent can see a summary of your homework help and any safety alerts.')
      await expect(page.getByTestId('earlier-session')).toHaveCount(3)
      await expect(page.getByTestId('help-me')).toBeDisabled()
      await page.getByTestId('problem-input').fill('x'.repeat(2000))
      expect((await page.getByTestId('problem-input').inputValue()).length).toBe({ kids: 300, tweens: 600, teens: 1000 }[band])
      await expectNoOverflow(page, width, `entry ${band}`)
      await expectTargets(page, band, `entry ${band}`)
      records.push({ screen: 'entry', band, ...(await frameOverflow(page)) })
      await shot(page, `homework-entry-${band}-${width}`)
    })

    test('entry states: no history, history error, photo unavailable', async ({ page }) => {
      for (const [name, scenario, expectation] of [
        ['empty-history', { historyCount: 0 }, (p: Page) => expect(p.locator('[data-state="history-empty"]')).toBeVisible()],
        ['history-error', { historyStatus: 503 }, (p: Page) => expect(p.locator('[data-state="history-error"]')).toBeVisible()],
        // The entry page makes no context call (the platform has none for homework): the photo reason is always the truthful default.
        ['photo-unavailable', {}, (p: Page) => expect(p.getByTestId('snap-reason')).toContainText('not available yet')],
      ] as const) {
        await open(page, { band, ...scenario })
        await expectation(page)
        await expectNoOverflow(page, width, `entry ${name}`)
        records.push({ screen: 'entry', state: name, band, ...(await frameOverflow(page)) })
        await shot(page, `homework-entry-${name}-${band}-${width}`)
      }
    })

    test('every phase and state: nothing overflows, targets are large enough, no solution anywhere', async ({ page }) => {
      for (const [seed, id] of sessionSeeds) {
        await open(page, { band, seed })
        await settle(page, id)
        await page.waitForTimeout(150)
        await expectNoOverflow(page, width, `${seed} ${band}`)
        await expectTargets(page, band, `${seed} ${band}`)
        await expectNoSolution(page, band)
        await expect(page.getByTestId('ai-label')).toHaveText('Co is an AI helper')
        records.push({ screen: 'session', state: seed, band, ...(await frameOverflow(page)) })
        await shot(page, `homework-${seed}-${band}-${width}`)
      }
    })

    test('the whole journey from the typed problem to a celebration, with the requests in order', async ({ page }) => {
      const s = scripts[band]
      await open(page, { band })
      await page.getByTestId('problem-input').fill(s.problem)
      await page.getByTestId('help-me').click()
      await expect(page.getByTestId('thinking-title')).toBeVisible()
      await expect(page.getByTestId('restatement')).toContainText(s.restatement.slice(0, 20))
      await shot(page, `homework-journey-1-restate-${band}-${width}`)
      await page.getByTestId('restate-yes').click()
      await expect(page.getByTestId('step-title')).toHaveText('Step 1')
      await expect(page.getByTestId('step-title')).toBeFocused()
      for (let index = 0; index < s.steps.length; index++) {
        await expect(page.getByTestId('step-prompt')).toHaveText(s.steps[index]!.prompt)
        if (index === 0) {
          await page.getByTestId('hint-button').click()
          await expect(page.getByTestId('hint-ladder')).toHaveAttribute('data-hints-shown', '1')
          await shot(page, `homework-journey-2-hint-${band}-${width}`)
        }
        await page.getByLabel('Your answer to this step').fill(`my idea ${index + 1}`)
        await page.getByTestId('step-send').click()
        await expect(page.getByTestId('thinking-title')).toBeVisible()
      }
      await expect(page.getByTestId('final-line')).toBeVisible()
      await page.getByTestId('final-input').fill(band === 'kids' ? 'carrot, potato, radish, beetroot' : band === 'tweens' ? '7/8' : 'NaOH + HCl -> NaCl + H2O')
      await page.getByTestId('final-check').click()
      await expect(page.getByTestId('thinking-title')).toBeVisible()
      await expect(page.getByTestId('done-title')).toContainText(/did it|looks right/)
      await shot(page, `homework-journey-3-celebration-${band}-${width}`)
      await expectNoOverflow(page, width, `journey ${band}`)
      const sequence = mock.calls.filter(call => call.method === 'POST').map(call => call.path.replace(/hw-\d+/, 'hw'))
      expect(sequence).toEqual([
        '/homework/sessions', '/homework/sessions/hw/restatement', '/homework/sessions/hw/hint', ...s.steps.map(() => '/homework/sessions/hw/steps'), '/homework/sessions/hw/final',
      ])
      await page.getByRole('button', { name: 'New problem' }).click()
      await expect(page.getByRole('heading', { level: 1, name: 'Homework help' })).toBeVisible()
    })

    test('the hint ladder is asked for one rung at a time, in order, and the unavailable state says why', async ({ page }) => {
      await open(page, { band, seed: 'steps' })
      await expect(page.getByTestId('hint-ladder')).toBeVisible()
      await page.waitForTimeout(800)
      expect(hintCalls()).toEqual([])
      for (let level = 1; level <= 3; level++) {
        await page.getByTestId('hint-button').click()
        await expect(page.getByTestId('hint-ladder')).toHaveAttribute('data-hints-shown', String(level))
        expect(hintCalls()).toEqual([1, 2, 3].slice(0, level))
      }
      await expect(page.getByTestId('hint-unavailable')).toContainText('all three hints')
      await expect(page.getByTestId('hint-unavailable').getByRole('button')).toBeDisabled()
      await expectNoSolution(page, band)
      await open(page, { band, seed: 'steps', hintsMax: 1 })
      await page.getByTestId('hint-button').click()
      await expect(page.getByTestId('hint-unavailable')).toContainText('your school allows')
    })

    test('a lost reply sends the same client id again and never makes a second step', async ({ page }) => {
      await open(page, { band, seed: 'steps', dropReplies: 1 })
      await page.getByLabel('Your answer to this step').fill('my first idea')
      await page.getByTestId('step-send').click()
      await expect(page.getByTestId('step-title')).toHaveText('Step 2')
      const steps = mock.calls.filter(call => call.method === 'POST' && call.path.endsWith('/steps'))
      expect(steps).toHaveLength(1)
      expect(mock.sessions.get('hw-1')!.steps).toHaveLength(2)
    })
  })
}

test.describe('cross-cutting behaviour', () => {
  test.beforeEach(async ({ page }) => { await mkdir(output, { recursive: true }); await prepare(page) })

  test('right-to-left mirrors the layout at 1024', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 1000 })
    for (const seed of ['steps', 'final', 'safety'] as const) {
      await open(page, { band: 'tweens', seed, dir: 'rtl' })
      await expect(page.locator('[data-lesson-frame]')).toBeVisible()
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).direction)).toBe('rtl')
      const items = page.getByTestId('journey').locator('li')
      const first = (await items.first().boundingBox())!; const last = (await items.last().boundingBox())!
      expect(first.x, `${seed}: the first journey stop is on the right in RTL`).toBeGreaterThan(last.x)
      await expectNoOverflow(page, 1024, `rtl ${seed}`)
      await shot(page, `homework-rtl-${seed}-tweens-1024`)
    }
    await open(page, { band: 'tweens', dir: 'rtl' })
    await expect(page.getByTestId('snap-card')).toBeVisible()
    await expectNoOverflow(page, 1024, 'rtl entry')
    await shot(page, 'homework-rtl-entry-tweens-1024')
  })

  test('reduced motion stops Co and the spinner while Co thinks and celebrates', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1024, height: 900 })
    for (const seed of ['thinking', 'done'] as const) {
      await open(page, { band: 'tweens', seed })
      await expect(page.getByTestId(seed === 'thinking' ? 'thinking-title' : 'done-title')).toBeVisible()
      const names = await page.evaluate(() => [...document.querySelectorAll('.ds-co, .ds-co *, .ds-spinner')].map(node => getComputedStyle(node).animationName))
      expect(names.length).toBeGreaterThan(0)
      expect(names.every(name => name === 'none')).toBe(true)
      await page.waitForTimeout(300)
      const running = await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').map(animation => Number(animation.effect?.getComputedTiming().duration ?? 0)))
      expect(running.filter(duration => duration > 1)).toEqual([])
    }
  })

  test('keyboard only: restate, step, hint and answer without a mouse, with focus on each new heading', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await open(page, { band: 'teens', seed: 'restate' })
    await expect(page.getByTestId('restatement')).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Check that Co understood' })).toBeFocused()
    const reach = async (name: RegExp | string, limit = 20) => {
      for (let index = 0; index < limit; index++) {
        await page.keyboard.press('Tab')
        const label = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim() ?? '')
        if (typeof name === 'string' ? label.includes(name) : name.test(label)) return
      }
      throw new Error(`could not reach ${String(name)} by Tab`)
    }
    await reach('Yes')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('step-title')).toHaveText('Step 1')
    await expect(page.getByTestId('step-title')).toBeFocused()
    await reach('Need a hint?')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('hint-ladder')).toHaveAttribute('data-hints-shown', '1')
    await page.getByLabel('Your answer to this step').focus()
    await page.keyboard.type('A neutralisation reaction')
    await reach('Send')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('step-title')).toHaveText('Step 2')
    await expect(page.getByTestId('homework-announcer')).toContainText('Step 2.')
    await reach('Leave homework help', 30).catch(() => undefined)
    await shot(page, 'homework-keyboard-teens-1440')
  })

  test('read-aloud: absent without a voice, never autoplays, speaks Co\'s words when pressed', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1400 })
    await open(page, { band: 'kids', seed: 'restate', speech: 'none' })
    await expect(page.getByTestId('restatement')).toBeVisible()
    await expect(page.getByRole('button', { name: /Read to me|Listen|Stop/ })).toHaveCount(0)
    await open(page, { band: 'kids', seed: 'restate', speech: 'fake' })
    await expect(page.getByRole('button', { name: 'Read to me' }).first()).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __homeworkSpeech: { spoken: string[] } }).__homeworkSpeech.spoken)).toEqual([])
    await page.getByRole('button', { name: 'Read to me' }).first().click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { __homeworkSpeech: { spoken: string[] } }).__homeworkSpeech.spoken)).toEqual([`${scripts.kids.restatement} Is that right?`])
  })

  test('safety redirect pauses the session and a trusted-adult redirect cannot be dismissed', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await open(page, { band: 'tweens', seed: 'safety' })
    await expect(page.getByRole('heading', { level: 2, name: 'Safety check' })).toBeFocused()
    await expect(page.getByRole('textbox')).toHaveCount(0)
    await page.getByRole('button', { name: 'Go back to my problem' }).click()
    await expect(page.getByLabel('Your answer to this step')).toBeVisible()
    await open(page, { band: 'tweens', seed: 'safety-trusted' })
    await expect(page.getByRole('button', { name: 'Go back to my problem' })).toHaveCount(0)
  })

  test('failed turn: Try again retries it through the turn endpoint and continues', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await open(page, { band: 'tweens', seed: 'failed' })
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByTestId('restatement')).toBeVisible()
    expect(mock.calls.filter(call => call.path.endsWith('/retry'))).toHaveLength(1)
  })

  test('Not quite goes back to the problem, and the new text replaces it with a PUT on the same session', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await open(page, { band: 'tweens', seed: 'restate' })
    await page.getByTestId('restate-no').click()
    await expect(page.getByRole('heading', { name: /fix the problem/i })).toBeVisible()
    await shot(page, 'homework-not-quite-capture-tweens-1024')
    await page.getByRole('textbox', { name: 'The problem' }).fill('Add 3/4 and 1/8')
    await page.getByRole('button', { name: 'Check again' }).click()
    await expect(page.getByTestId('restatement')).toBeVisible()
    const puts = mock.calls.filter(call => call.method === 'PUT')
    expect(puts.map(call => call.path)).toEqual(['/homework/sessions/hw-1/problem'])
    expect(mock.calls.filter(call => call.method === 'POST' && call.path === '/homework/sessions')).toHaveLength(0)
    expect(mock.sessions.get('hw-1')!.problem).toBe('Add 3/4 and 1/8')
  })

  test('the learn home offers Homework help', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    for (const band of ['kids', 'tweens', 'teens'] as const) {
      await page.goto(`/dev/learn?screen=home&band=${band}&state=default`)
      await expect(page.getByTestId('homework-help-card')).toHaveAttribute('href', '/learn/homework')
      await expect(page.getByTestId('homework-help-card')).toContainText('Homework help')
    }
  })

  test.afterAll(async () => {
    expect(problems, `console and page errors: ${problems.join(' | ')}`).toEqual([])
    await mkdir(output, { recursive: true })
    await writeFile(path.join(output, 'viewport-records-homework.json'), JSON.stringify({ date: '2026-10-21', kind: 'development-only-ui-with-test-double-no-api-model-or-database', records }, null, 2))
  })
})
