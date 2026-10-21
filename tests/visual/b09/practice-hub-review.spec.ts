import { test, expect, type Page, type Route } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createPracticeMock, type PracticeMock, type PracticeMockOptions } from '../../../components/practice/dev/practice-mock'

/**
 * UI-only qualification of the real B09 hub (L9), start flow, summary (L11) and answer sheet through /dev/practice. The
 * practice endpoints are answered with page.route by the same test double the integration tests use (the platform
 * practice module was built in parallel), and /api/auth/session is mocked. No API, model, database or real voice is
 * involved. The session player (L10) is W1's and is not exercised here.
 */
const output = process.env.B09_OUTPUT_DIR ? path.resolve(process.env.B09_OUTPUT_DIR) : path.resolve('output/b09')
type Band = 'kids' | 'tweens' | 'teens'
const widths: [number, Band][] = [[390, 'kids'], [1024, 'tweens'], [1440, 'teens']]
const minTarget: Record<Band, number> = { kids: 64, tweens: 48, teens: 44 }
type Scenario = Partial<Omit<PracticeMockOptions, 'band'>> & { band: Band; screen?: 'hub' | 'start' | 'summary' | 'sheet'; dir?: 'rtl'; tab?: 'past'; extra?: Record<string, string> }
let mock: PracticeMock
const records: unknown[] = []
let abortFirstSession = false
let sessionPosts: unknown[] = []

async function prepare(page: Page) {
  abortFirstSession = false
  sessionPosts = []
  // Buffer/retry the real development layout chunk after observed local aborted asset responses (as B06/B07/B08).
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
  await page.route('**/api/learn/practice**', (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const raw = request.postData()
    const body = raw ? JSON.parse(raw) : undefined
    if (request.method() === 'POST' && url.pathname === '/api/learn/practice/sessions') {
      sessionPosts.push(body)
      if (abortFirstSession && sessionPosts.length === 1) return route.abort('failed')
    }
    if (mock.options.loading) return new Promise<void>(() => undefined)
    const reply = mock.handle(request.method(), url.pathname + url.search, body)
    return route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body) })
  })
}
async function open(page: Page, scenario: Scenario) {
  const { band, screen = 'hub', dir, tab, extra = {}, ...options } = scenario
  mock = createPracticeMock({ band, ...options })
  const query = new URLSearchParams({ mock: 'network', band, screen, pollMs: '250', ...extra })
  if (options.hub) query.set('state', options.hub)
  if (options.summary) query.set('state', options.summary)
  if (dir) query.set('dir', dir)
  if (tab) query.set('tab', tab)
  await page.goto(`/dev/practice?${query}`)
  // A modal dialog or inert page hides the notice from the accessibility tree, so look past that.
  await expect(page.getByRole('note', { includeHidden: true }).first()).toContainText('synthetic fixtures only')
}
const overflow = (page: Page) => page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
async function expectNoOverflow(page: Page, width: number, label: string) {
  const dimensions = await overflow(page)
  expect(dimensions.scrollWidth, `${label} overflows the page at ${width}`).toBeLessThanOrEqual(width)
  return dimensions
}
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true })
const text = (page: Page) => page.locator('body').innerText()
const forbiddenRewards = /\bXP\b|sticker|league|\bquests?\b|readiness|\blevel\b/i

for (const [width, band] of widths) {
  test.describe(`${band} at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await mkdir(output, { recursive: true })
      await prepare(page)
      await page.setViewportSize({ width, height: width === 390 ? 1500 : 1100 })
    })

    test('hub default: bands, honest content, recall and mock test are distinct, targets are large enough', async ({ page }) => {
      await open(page, { band })
      await expect(page.getByRole('heading', { level: 1, name: band === 'kids' ? 'Play' : 'Practice' })).toBeVisible()
      await expect(page.getByTestId('practice-set').first()).toBeVisible()
      const dimensions = await expectNoOverflow(page, width, 'hub')
      // F-L9-08: the timed test is written as a different thing, not only coloured differently.
      const exam = page.getByTestId('exam-card').first()
      await expect(exam).toContainText(band === 'kids' ? 'Big test' : 'Mock test')
      await expect(exam).toContainText(/Timed/)
      await expect(exam).toContainText(/no hints/)
      await expect(page.getByTestId('practice-set').first()).toContainText(band === 'kids' ? 'Play' : 'Practice')
      await expect(page.getByTestId('practice-set').first()).not.toContainText(/no hints/)
      // Unavailable kinds are named, with the server's reason.
      await expect(page.getByTestId('unavailable-kinds')).toContainText('Code questions')
      await expect(page.getByTestId('unavailable-kinds')).toContainText('Spoken answers')
      // No invented rewards or readiness.
      expect(await text(page)).not.toMatch(forbiddenRewards)
      const review = page.getByTestId('due-card').getByRole('link').first()
      await expect(review).toHaveAttribute('href', '/learn/practice/start?scope=DUE')
      const box = await review.boundingBox()
      expect(box!.height, 'review start target').toBeGreaterThanOrEqual(minTarget[band] - 1)
      const set = page.getByTestId('practice-set').first().getByRole('link', { name: band === 'kids' ? 'Play!' : 'Practise' })
      await expect(set).toHaveAttribute('href', '/learn/practice/start?scope=SET&id=set-fractions')
      expect((await set.boundingBox())!.height, 'set start target').toBeGreaterThanOrEqual(minTarget[band] - 1)
      await expect(exam.getByRole('link')).toHaveAttribute('href', '/learn/practice/start?scope=PLAN_EXAM&id=plan-exam')
      if (band === 'kids') {
        await expect(page.getByTestId('games').getByText(/failed|wrong|missed/i)).toHaveCount(0)
        await expect(page.getByTestId('practice-set').first().getByRole('img', { name: '2 of 3 stars' })).toBeVisible()
      }
      if (band === 'teens') await expect(page.getByTestId('weak-spots')).toContainText('will show here once Co can measure them')
      if (band === 'tweens') await expect(page.getByTestId('due-estimate')).toHaveText('5 cards, about 4 minutes')
      await shot(page, `hub-default-${band}-${width}`)
      records.push({ screen: 'hub', state: 'default', band, ...dimensions })
    })

    test('hub states: caught up, no content, weak spots, sets pending, denied, unavailable, loading', async ({ page }) => {
      const cases: { name: string; options: Partial<PracticeMockOptions>; expectText: RegExp }[] = [
        { name: 'caught-up', options: { hub: 'caught-up' }, expectText: /All caught up!/ },
        { name: 'no-content', options: { hub: 'no-content' }, expectText: band === 'kids' ? /Nothing to play yet/ : /Nothing to practise yet/ },
        { name: 'sets-pending', options: { hub: 'sets-pending' }, expectText: /Co could not make these questions/ },
        { name: 'denied', options: { hubStatus: 403 }, expectText: /You cannot open this/ },
        { name: 'unavailable', options: { hubStatus: 503 }, expectText: /This could not load/ },
        { name: 'loading', options: { loading: true }, expectText: /Getting your practice ready/ },
      ]
      if (band === 'teens') cases.push({ name: 'weak-spots', options: { hub: 'weak-spots' }, expectText: /Balancing equations/ })
      for (const item of cases) {
        await open(page, { band, ...item.options })
        await expect(page.getByText(item.expectText).first()).toBeVisible()
        const dimensions = await expectNoOverflow(page, width, item.name)
        if (item.name === 'caught-up') await expect(page.getByRole('link', { name: 'Learn something new' })).toBeVisible()
        if (item.name === 'denied') await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
        if (item.name === 'unavailable') await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
        await shot(page, `hub-state-${item.name}-${band}-${width}`)
        records.push({ screen: 'hub', state: item.name, band, ...dimensions })
      }
    })

    test('past sessions: kids see a star timeline, tweens a list, teens a table with answer sheets; show more pages', async ({ page }) => {
      await open(page, { band, tab: 'past' })
      if (band === 'kids') {
        const timeline = page.getByTestId('kids-history')
        await expect(timeline).toBeVisible()
        expect(await timeline.innerText()).not.toMatch(/\d+ of \d+|right|wrong|missed|answer sheet/i)
        await expect(page.getByRole('link', { name: 'Answer sheet' })).toHaveCount(0)
        await expect(timeline.getByRole('img', { name: '3 of 3 stars' })).toBeVisible()
        await expect(timeline.getByRole('link', { name: 'Keep playing' })).toHaveAttribute('href', '/learn/practice/session/session-3')
      } else if (band === 'tweens') {
        await expect(page.getByTestId('session-list')).toBeVisible()
        await expect(page.getByTestId('session-list').getByText('7 of 8 right')).toBeVisible()
      } else {
        const table = page.getByTestId('session-table')
        await expect(table.getByRole('columnheader')).toHaveText(['Date', 'Session', 'Score', 'Duration', 'Answers'])
        await expect(table.getByRole('link', { name: 'Answer sheet' }).first()).toHaveAttribute('href', '/learn/practice/answer-sheet/session-1')
        await expect(table.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/learn/practice/session/session-3')
      }
      expect(await text(page)).not.toMatch(forbiddenRewards)
      await expectNoOverflow(page, width, 'past')
      await shot(page, `hub-past-${band}-${width}`)
      await page.getByRole('button', { name: 'Show more' }).click()
      await expect(page.getByText('Older practice')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Show more' })).toHaveCount(0)
      expect(mock.calls.filter(call => call.path.startsWith('/practice/sessions?') && call.path.includes('cursor=cursor-2'))).toHaveLength(1)
      records.push({ screen: 'hub', state: 'past', band, ...(await overflow(page)) })
    })

    test('start flow: a set is made (polling), then one session is created and the player is opened', async ({ page }) => {
      await open(page, { band, screen: 'start', start: 'generating', generatingPolls: 3, extra: { scope: 'MATERIAL', id: 'material-fractions' } })
      await expect(page.getByText(/Co is making your (game|questions)/).first()).toBeVisible()
      await expectNoOverflow(page, width, 'generating')
      await shot(page, `start-generating-${band}-${width}`)
      await expect(page.getByTestId('harness-started')).toContainText('session-1')
      expect(mock.calls.filter(call => call.method === 'POST' && call.path === '/practice/sets')).toHaveLength(1)
      const sessions = mock.calls.filter(call => call.method === 'POST' && call.path === '/practice/sessions')
      expect(sessions).toHaveLength(1)
      expect(sessions[0]!.body).toMatchObject({ mode: 'PRACTICE', scope: { kind: 'SET', id: 'set-fractions' } })
      expect((sessions[0]!.body as { clientSessionId: string }).clientSessionId.length).toBeGreaterThanOrEqual(8)
    })

    test('start flow states: failed (retry), final failure, stopped (make again), and typed refusals', async ({ page }) => {
      await open(page, { band, screen: 'start', start: 'failed', extra: { scope: 'LESSON', id: 'lesson-1' } })
      await expect(page.getByText('Co could not make these questions')).toBeVisible()
      await expectNoOverflow(page, width, 'failed')
      await shot(page, `start-failed-${band}-${width}`)
      await page.getByRole('button', { name: 'Try again' }).click()
      await expect(page.getByTestId('harness-started')).toBeVisible()
      expect(mock.calls.filter(call => call.path.endsWith('/retry'))).toHaveLength(1)

      await open(page, { band, screen: 'start', start: 'failed-final', extra: { scope: 'MATERIAL', id: 'material-fractions' } })
      await expect(page.getByText(/not enough in this material/)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)

      await open(page, { band, screen: 'start', start: 'cancelled', extra: { scope: 'MATERIAL', id: 'material-fractions' } })
      await expect(page.getByText('These questions were stopped')).toBeVisible()
      await shot(page, `start-cancelled-${band}-${width}`)
      await page.getByRole('button', { name: 'Make them again' }).click()
      await expect(page.getByTestId('harness-started')).toBeVisible()

      for (const [code, title] of [['POLICY_BLOCKED', 'Not right now'], ['DAILY_PRACTICE_LIMIT', 'That is enough question sets for today'], ['CONSENT_REQUIRED', 'A grown-up needs to help first']] as const) {
        await open(page, { band, screen: 'start', setError: code, extra: { scope: 'MATERIAL', id: 'material-fractions' } })
        await expect(page.getByRole('heading', { name: title })).toBeVisible()
        await expectNoOverflow(page, width, code)
        if (code === 'POLICY_BLOCKED') await expect(page.getByText(/paused until tomorrow/)).toBeVisible()
        if (code === 'DAILY_PRACTICE_LIMIT') await shot(page, `start-limit-${band}-${width}`)
      }
      await open(page, { band, screen: 'start', sessionError: 'NO_QUESTIONS_AVAILABLE', extra: { scope: 'DUE' } })
      await expect(page.getByRole('heading', { name: 'Nothing to practise right now' })).toBeVisible()
      await open(page, { band, screen: 'start', extra: { scope: 'PLAN_EXAM', id: 'plan-exam' } })
      await expect(page.getByTestId('harness-started')).toBeVisible()
      expect(mock.calls.find(call => call.method === 'POST' && call.path === '/practice/sessions')!.body).toMatchObject({ mode: 'EXAM', scope: { kind: 'PLAN_EXAM', id: 'plan-exam' } })
      await open(page, { band, screen: 'start', extra: { scope: 'NOPE' } })
      await expect(page.getByText('Choose what to practise').first()).toBeVisible()
    })

    test('summary: great and tough, honest rewards, feedback unavailable, teach-back disabled', async ({ page }) => {
      for (const state of ['great', 'tough', 'feedback-unavailable'] as const) {
        await open(page, { band, screen: 'summary', summary: state })
        const heading = page.getByRole('heading', { level: 1 })
        await expect(heading).toBeVisible()
        await expect(heading).toBeFocused()
        const tough = state === 'tough'
        await expect(page.locator(`[data-state="${tough ? 'tough' : 'great'}"]`)).toBeVisible()
        const body = await text(page)
        expect(body).not.toMatch(forbiddenRewards)
        if (band === 'kids') {
          // F-L11-01: stars and warm words only; no counts of misses, no scores.
          expect(body).not.toMatch(/\b\d+ of \d+\b|missed|wrong|incorrect|score|accuracy|%/i)
          await expect(heading).toHaveText(tough ? 'That was a tricky one!' : 'You did it!')
          await expect(page.getByRole('img', { name: tough ? '1 of 3 stars' : '3 of 3 stars' })).toBeVisible()
          await expect(page.getByRole('link', { name: tough ? 'Look again' : 'Play again' })).toBeVisible()
          expect((await page.getByRole('link', { name: tough ? 'Later' : 'Home' }).boundingBox())!.height).toBeGreaterThanOrEqual(63)
        } else {
          await expect(page.getByTestId('missed')).toBeVisible()
          await expect(page.getByRole('link', { name: 'Review it' }).first()).toBeVisible()
          await expect(page.getByTestId('teach-back').getByRole('button', { name: 'Teach it back to Co' })).toBeDisabled()
          await expect(page.getByText('Teach it back to Co opens with the progress release.')).toBeVisible()
          await expect(page.getByText(tough ? '2 of 8' : '7 of 8').first()).toBeVisible()
          if (band === 'teens') await expect(page.locator('[data-stat="accuracy"]')).toContainText(tough ? '25%' : '88%')
          if (tough) {
            await expect(page.getByRole('link', { name: 'Quick recap' })).toHaveAttribute('href', '/learn/lesson/new?materialId=material-fractions')
            await expect(page.getByRole('link', { name: 'Try again later' })).toBeVisible()
          }
        }
        if (state === 'feedback-unavailable') {
          await expect(page.locator('[data-state="feedback-unavailable"]')).toBeVisible()
          if (band !== 'kids') await expect(page.locator('[data-state="feedback-unavailable"]')).toContainText('2 written answers')
          else await expect(page.locator('[data-state="feedback-unavailable"]')).not.toContainText(/\d/)
        }
        await expectNoOverflow(page, width, `summary ${state}`)
        await shot(page, `summary-${state}-${band}-${width}`)
        records.push({ screen: 'summary', state, band, ...(await overflow(page)) })
      }
      // Rewards are drawn exactly as returned; a number of XP, level or readiness appears only when the server sends one.
      await open(page, { band, screen: 'summary', summary: 'later-release' })
      if (band !== 'kids') { await expect(page.locator('[data-stat="xp"]')).toContainText('+80'); await expect(page.locator('[data-stat="readiness"]')).toContainText('65%') }
      await open(page, { band, screen: 'summary', summary: 'no-reward' })
      await expect(page.getByTestId('reward')).toHaveCount(0)
      await open(page, { band, screen: 'summary', summaryStatus: 409 })
      await expect(page.getByText('This practice is not finished yet')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Keep going' })).toHaveAttribute('href', '/learn/practice/session/session-1')
      await open(page, { band, screen: 'summary', summaryStatus: 403 })
      await expect(page.getByText('You cannot open this')).toBeVisible()
      await open(page, { band, screen: 'summary', loading: true })
      await expect(page.getByRole('status', { name: /Co is counting your stars|Adding up your answers/ })).toBeVisible()
      await shot(page, `summary-loading-${band}-${width}`)
    })

    test('answer sheet: marks are written, feedback is labelled, a regrade is asked once', async ({ page }) => {
      await open(page, { band, screen: 'sheet' })
      await expect(page.getByTestId('answer-item')).toHaveCount(5)
      await expect(page.locator('[data-mark="correct"]')).toHaveCount(2)
      await expect(page.locator('[data-mark="unchecked"]')).toHaveCount(1)
      await expect(page.getByTestId('correct-answer').first()).toBeVisible()
      await expect(page.locator('[data-kind="co-feedback"]')).toContainText('Co says')
      expect(await text(page)).not.toMatch(forbiddenRewards)
      if (band === 'kids') expect(await text(page)).not.toMatch(/Wrong|Incorrect|Not right yet|\d+ of \d+ right/)
      await expectNoOverflow(page, width, 'answer sheet')
      await shot(page, `answer-sheet-${band}-${width}`)
      await page.getByRole('button', { name: 'Ask Co to check again' }).click()
      await expect(page.getByText(/Asked\. Co will check it again/)).toBeVisible()
      expect(mock.calls.filter(call => call.path === '/practice/attempts/attempt-9/regrade')).toHaveLength(1)
    })
  })
}

test('start: the same client session id survives a refresh and is forgotten once the session starts', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 1024, height: 900 })
  abortFirstSession = true
  await open(page, { band: 'tweens', screen: 'start', extra: { scope: 'SET', id: 'set-fractions' } })
  // The first create request is lost in transit; the page shows the failure and keeps its id.
  await expect.poll(() => sessionPosts.length).toBe(1)
  await expect(page.getByText('This could not load')).toBeVisible()
  const key = await page.evaluate(() => Object.keys(sessionStorage).find(name => name.startsWith('colearner.practice-start')) ?? null)
  expect(key).not.toBeNull()
  await page.reload()
  await expect(page.getByTestId('harness-started')).toBeVisible()
  expect(sessionPosts).toHaveLength(2)
  expect((sessionPosts[1] as { clientSessionId: string }).clientSessionId).toBe((sessionPosts[0] as { clientSessionId: string }).clientSessionId)
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(name => name.startsWith('colearner.practice-start')))).toEqual([])
})

test('RTL: logical layout, no overflow and mirrored controls', async ({ page }) => {
  await prepare(page)
  for (const [width, band] of [[390, 'kids'], [390, 'teens'], [1024, 'tweens']] as [number, Band][]) {
    await page.setViewportSize({ width, height: width === 390 ? 1500 : 1100 })
    await open(page, { band, dir: 'rtl' })
    await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('rtl')
    await expect(page.getByTestId('practice-set').first()).toBeVisible()
    await expectNoOverflow(page, width, `rtl hub ${band}`)
    const first = await page.getByRole('button', { name: band === 'kids' ? 'Games' : 'Today', exact: true }).boundingBox()
    const second = await page.getByRole('button', { name: band === 'kids' ? 'My rounds' : 'Past sessions', exact: true }).boundingBox()
    expect(first!.x, 'the first tab sits at the inline start (right) in RTL').toBeGreaterThan(second!.x)
    await shot(page, `rtl-hub-${band}-${width}`)
    await open(page, { band, dir: 'rtl', screen: 'summary', summary: 'tough' })
    await expect(page.locator('[data-state="tough"]')).toBeVisible()
    await expectNoOverflow(page, width, `rtl summary ${band}`)
    await shot(page, `rtl-summary-${band}-${width}`)
    await open(page, { band, dir: 'rtl', screen: 'sheet' })
    await expect(page.getByTestId('answer-item').first()).toBeVisible()
    await expectNoOverflow(page, width, `rtl sheet ${band}`)
  }
})

test('reduced motion stops Co, the spinner and transitions', async ({ page }) => {
  await prepare(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1024, height: 900 })
  await open(page, { band: 'tweens', hub: 'caught-up' })
  await expect(page.getByText('All caught up!')).toBeVisible()
  const names = await page.evaluate(() => [...document.querySelectorAll('.ds-co, .ds-co *, .ds-spinner')].map(node => getComputedStyle(node).animationName))
  expect(names.length).toBeGreaterThan(0)
  expect(names.every(name => name === 'none')).toBe(true)
})

test('keyboard: every control is reachable, tabs toggle with Enter and Space, the table region is focusable', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await open(page, { band: 'teens' })
  await expect(page.getByTestId('due-card')).toBeVisible()
  const seen = new Set<string>()
  for (let index = 0; index < 45; index++) {
    await page.keyboard.press('Tab')
    const label = await page.evaluate(() => {
      const active = document.activeElement
      return active?.getAttribute('aria-label') ?? active?.textContent?.trim().slice(0, 40) ?? ''
    })
    seen.add(label)
  }
  for (const label of ['Today', 'Past sessions', 'Start review', 'Practise', 'Start mock test']) expect([...seen].some(entry => entry.includes(label)), `${label} is reachable by Tab`).toBe(true)
  const past = page.getByRole('button', { name: 'Past sessions', exact: true })
  await past.focus()
  await page.keyboard.press('Enter')
  await expect(past).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('session-table')).toBeVisible()
  await page.getByRole('button', { name: 'Today', exact: true }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Today', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('due-card')).toBeVisible()
  await page.getByRole('button', { name: 'Past sessions', exact: true }).click()
  await page.getByRole('region', { name: 'Past practice sessions' }).focus()
  await expect(page.getByRole('region', { name: 'Past practice sessions' })).toBeFocused()
})

test.afterAll(async () => {
  await mkdir(output, { recursive: true })
  await writeFile(path.join(output, 'viewport-records.json'), JSON.stringify({ date: '2026-10-19', kind: 'development-only-ui-with-test-double-no-api-model-or-database', records }, null, 2))
})
