import { test, expect, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { answerKeys, lessonContentFixture } from '../../../components/lesson/dev/lesson-fixtures'
import { createLessonMock, type LessonMock, type MockOptions } from '../../../components/lesson/dev/lesson-mock'

/**
 * UI-only qualification of the real B08 lesson screens through /dev/lesson. The lesson endpoints are answered with
 * page.route by the same test double the integration tests use (the platform lesson module was built in parallel),
 * and /api/auth/session is mocked. No API, model, database or real voice is involved: speech is a fake local voice.
 */
const output = process.env.B08_OUTPUT_DIR ? path.resolve(process.env.B08_OUTPUT_DIR) : path.resolve('output/b08')
type Band = 'kids' | 'tweens' | 'teens'
const widths: [number, Band][] = [[390, 'kids'], [1024, 'tweens'], [1440, 'teens']]
const minTarget: Record<Band, number> = { kids: 64, tweens: 48, teens: 44 }
type Scenario = Partial<Omit<MockOptions, 'band'>> & { band: Band; speech?: 'fake' | 'none'; dir?: 'rtl'; view?: 'start' }
let mock: LessonMock
const records: unknown[] = []

async function prepare(page: Page) {
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
  await page.route('**/api/auth/session', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({}) }))
  await page.route('**/api/learn/lessons**', route => {
    const request = route.request()
    const url = new URL(request.url())
    const raw = request.postData()
    const reply = mock.handle(request.method(), url.pathname + url.search, raw ? JSON.parse(raw) : undefined)
    if (reply.status === 204) return route.fulfill({ status: 204 })
    return route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body) })
  })
}
async function open(page: Page, scenario: Scenario) {
  const { band, speech = 'fake', dir, view, ...options } = scenario
  mock = createLessonMock({ band, ...options })
  const query = new URLSearchParams({ mock: 'network', band, state: options.state ?? 'ready', speech, pollMs: '250' })
  if (dir) query.set('dir', dir)
  if (view) query.set('view', view)
  await page.goto(`/dev/lesson?${query}`)
  // A modal dialog or the inert page behind the lesson hides the notice from the accessibility tree, so look past that.
  await expect(page.getByRole('note', { includeHidden: true }).first()).toContainText('synthetic fixtures only')
}
const frameOverflow = (page: Page) => page.evaluate(() => {
  const frame = document.querySelector('[data-lesson-frame]')
  return { frame: frame ? { scrollWidth: frame.scrollWidth, clientWidth: frame.clientWidth } : null, width: innerWidth, scrollWidth: document.documentElement.scrollWidth }
})
const heading = (page: Page, title: string) => page.getByRole('heading', { level: 2, name: title })
const shot = (page: Page, name: string, fullPage = true) => page.screenshot({ path: path.join(output, `${name}.png`), fullPage })
async function expectNoOverflow(page: Page, width: number, label: string) {
  const dimensions = await frameOverflow(page)
  expect(dimensions.scrollWidth, `${label} overflows the page at ${width}`).toBeLessThanOrEqual(width)
  if (dimensions.frame) expect(dimensions.frame.scrollWidth, `${label} overflows the lesson at ${width}`).toBeLessThanOrEqual(dimensions.frame.clientWidth)
  return dimensions
}
async function answer(page: Page, band: Band, right: boolean) {
  const key = answerKeys[band]
  const option = key.options.find(item => (item.id === key.correctOptionId) === right)!
  await page.getByRole('radio', { name: option.text }).check()
  await page.getByRole('button', { name: /^Check/ }).click()
  await expect(page.getByText(option.feedback)).toBeVisible()
}

for (const [width, band] of widths) {
  test(`all five steps of the ${band} lesson fit ${width}px and behave (check, hints, notes, citations)`, async ({ page }) => {
    await mkdir(output, { recursive: true })
    await prepare(page)
    await page.setViewportSize({ width, height: width === 390 ? 1500 : 1100 })
    await open(page, { band })
    const content = lessonContentFixture(band)
    for (let index = 0; index < 5; index++) {
      const step = content.steps[index]!
      await expect(heading(page, step.title)).toBeVisible()
      await expect(heading(page, step.title)).toBeFocused()
      await expect(page.getByTestId('lesson-step')).toContainText(`Step ${index + 1} of 5`)
      if (step.sources.length > 0) await expect(page.getByTestId('source-chips').getByRole('link').first()).toBeVisible()
      if (index === 2) {
        await shot(page, `lesson-step3-check-${band}-${width}`)
        await page.getByRole('button', { name: 'Need help?' }).click()
        await page.getByRole('button', { name: 'Show next hint' }).click()
        await answer(page, band, false)
        await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
        await shot(page, `lesson-step3-wrong-hints-${band}-${width}`)
        await answer(page, band, true)
        await expect(page.getByText('That is the right one')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled()
      }
      const dimensions = await expectNoOverflow(page, width, `step ${index + 1}`)
      const box = await page.getByRole('button', { name: index === 4 ? 'Finish' : 'Next', exact: true }).boundingBox()
      expect(box!.height, 'Next target size').toBeGreaterThanOrEqual(minTarget[band] - 1)
      await shot(page, `lesson-step${index + 1}-${step.kind.toLowerCase()}-${band}-${width}`)
      records.push({ screen: 'step', step: index + 1, band, ...dimensions })
      if (index < 4) await page.getByRole('button', { name: 'Next', exact: true }).click()
    }
    await page.getByRole('button', { name: 'Finish' }).click()
    await expect(page.getByRole('heading', { name: 'Lesson done!' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Practice now' })).toBeDisabled()
    await expect(page.getByText('Practice opens when practice ships.')).toBeVisible()
    expect(await page.locator('body').innerText()).not.toMatch(/\bXP\b|sticker|streak|readiness|league/i)
    await expectNoOverflow(page, width, 'completion')
    await shot(page, `lesson-complete-${band}-${width}`)
    // Progress was persisted by the mock server through the real client (PUT) and completion was recorded once.
    expect(mock.calls.filter(call => call.method === 'POST' && call.path.endsWith('/complete'))).toHaveLength(1)
    expect(mock.detail.progress.completedSteps).toEqual([0, 1, 2, 3, 4])
    await writeFile(path.join(output, `viewport-${band}-${width}.json`), JSON.stringify({ date: '2026-10-19', kind: 'development-only-ui-with-test-double-no-api-model-or-database', records: records.filter(record => (record as { band: Band }).band === band) }, null, 2))
  })

  test(`generating, failed, hidden, stopped, denied and unavailable states fit ${band} at ${width}px`, async ({ page }) => {
    await prepare(page)
    await page.setViewportSize({ width, height: 1000 })
    const cases: { state: NonNullable<MockOptions['state']>; text: RegExp; name: string }[] = [
      { state: 'generating', text: /Co is making your lesson/, name: 'generating' },
      { state: 'failed', text: /Co could not make this lesson/, name: 'failed' },
      { state: 'failed-final', text: /not enough in this material/, name: 'failed-final' },
      { state: 'cancelled', text: /This lesson was stopped/, name: 'cancelled' },
      { state: 'access-changed', text: /This lesson is hidden for now/, name: 'access-changed' },
      { state: 'done', text: /Lesson done!/, name: 'done' },
      { state: 'denied', text: /You cannot open this/, name: 'denied' },
      { state: 'unavailable', text: /This could not load/, name: 'unavailable' },
    ]
    for (const item of cases) {
      await open(page, { band, state: item.state, generatingPolls: 400 })
      await expect(page.getByText(item.text).first()).toBeVisible()
      const dimensions = await expectNoOverflow(page, width, item.name)
      await shot(page, `lesson-state-${item.name}-${band}-${width}`)
      records.push({ screen: 'state', state: item.name, band, ...dimensions })
    }
  })
}

test('start screen: typed refusals are plain, and a good start opens the lesson', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 390, height: 1000 })
  for (const [code, title] of [['CONSENT_REQUIRED', 'A grown-up needs to help first'], ['POLICY_BLOCKED', 'Not right now'], ['DAILY_LESSON_LIMIT', 'That is enough lessons for today'], ['MATERIAL_NOT_READY', 'This material is not ready yet']] as const) {
    await open(page, { band: 'kids', view: 'start', startError: code })
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    expect((await frameOverflow(page)).scrollWidth).toBeLessThanOrEqual(390)
    if (code === 'POLICY_BLOCKED') await expect(page.getByText(/paused until tomorrow/)).toBeVisible()
    await shot(page, `lesson-start-${code.toLowerCase()}-kids-390`)
  }
  await open(page, { band: 'tweens', view: 'start' })
  await expect(heading(page, 'Pieces of a whole')).toBeVisible()
  expect(mock.calls.filter(call => call.method === 'POST' && call.path === '/lessons')).toHaveLength(1)
})

test('read-aloud: absent without a voice, never autoplays, highlights the spoken word and stops on step change', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 390, height: 1400 })
  await open(page, { band: 'kids', speech: 'none' })
  await expect(heading(page, 'Meet the plant')).toBeVisible()
  await expect(page.getByRole('button', { name: /Read to me|Listen|Stop/ })).toHaveCount(0)
  await expect(page.getByText('Your device cannot read out loud. You can read along!')).toBeVisible()
  await shot(page, 'lesson-speech-unavailable-kids-390')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(heading(page, 'What each part does')).toBeVisible()

  await open(page, { band: 'kids', speech: 'fake' })
  await expect(heading(page, 'Meet the plant')).toBeVisible()
  const read = page.getByRole('button', { name: 'Read to me' })
  await expect(read).toBeVisible()
  const box = await read.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(63)
  await page.waitForTimeout(1200)
  expect(await page.evaluate(() => (window as unknown as { __lessonSpeech: { spoken: string[] } }).__lessonSpeech.spoken.length)).toBe(0)
  await shot(page, 'lesson-speech-ready-kids-390')
  await read.click()
  await expect(page.locator('mark[aria-current="true"]').first()).toBeVisible()
  await shot(page, 'lesson-speech-highlight-kids-390')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(heading(page, 'What each part does')).toBeVisible()
  await expect(page.locator('mark')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __lessonSpeech: { spoken: string[]; current: () => unknown } }).__lessonSpeech.current())).toBeNull()
  expect(await page.evaluate(() => (window as unknown as { __lessonSpeech: { spoken: string[] } }).__lessonSpeech.spoken.length)).toBe(1)
})

test('notes: kids have none; tweens and teens can save and see them', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 1024, height: 1100 })
  await open(page, { band: 'kids' })
  await expect(heading(page, 'Meet the plant')).toBeVisible()
  await expect(page.getByRole('button', { name: /notes/i })).toHaveCount(0)
  await open(page, { band: 'tweens', notes: true })
  await expect(heading(page, 'Pieces of a whole')).toBeVisible()
  await page.getByRole('button', { name: /My notes/ }).click()
  await page.getByLabel('Write a note about step 1').fill('Same size pieces add up.')
  await page.getByRole('button', { name: 'Save note' }).click()
  await expect(page.getByRole('list', { name: 'Your notes' })).toContainText('Same size pieces add up.')
  await shot(page, 'lesson-notes-tweens-1024')
  await page.setViewportSize({ width: 1440, height: 1100 })
  await open(page, { band: 'teens', step: 1, completed: [0] })
  await expect(heading(page, 'Indicators and their colours')).toBeVisible()
  await page.getByRole('button', { name: 'Save to revision notes: Salt' }).click()
  await page.getByRole('button', { name: /^Save to revision notes\s*\d*$/ }).click()
  await expect(page.getByRole('list', { name: 'Your notes' })).toContainText('Salt: A compound formed when an acid reacts with a base.')
  await shot(page, 'lesson-notes-teens-1440')
})

test('RTL: logical layout, no overflow, mirrored navigation and arrow keys', async ({ page }) => {
  await prepare(page)
  for (const [width, band] of [[390, 'kids'], [390, 'teens'], [1024, 'tweens']] as [number, Band][]) {
    await page.setViewportSize({ width, height: width === 390 ? 1500 : 1100 })
    await open(page, { band, dir: 'rtl', step: 1, completed: [0] })
    await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('rtl')
    await expect(heading(page, lessonContentFixture(band).steps[1]!.title)).toBeVisible()
    await expectNoOverflow(page, width, `rtl ${band}`)
    const back = await page.getByRole('button', { name: 'Back', exact: true }).boundingBox()
    const next = await page.getByRole('button', { name: 'Next', exact: true }).boundingBox()
    expect(back!.x, 'Back sits at the inline start (right) in RTL').toBeGreaterThan(next!.x)
    await shot(page, `lesson-rtl-${band}-${width}`)
    // In RTL the left arrow moves forward.
    await page.keyboard.press('ArrowLeft')
    await expect(heading(page, lessonContentFixture(band).steps[2]!.title)).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await expect(heading(page, lessonContentFixture(band).steps[1]!.title)).toBeVisible()
  }
})

test('reduced motion stops Co, the spinner and transitions in the lesson', async ({ page }) => {
  await prepare(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1024, height: 900 })
  await open(page, { band: 'tweens' })
  await expect(heading(page, 'Pieces of a whole')).toBeVisible()
  const names = await page.evaluate(() => [...document.querySelectorAll('.ds-co, .ds-co *, .ds-spinner')].map(node => getComputedStyle(node).animationName))
  expect(names.length).toBeGreaterThan(0)
  expect(names.every(name => name === 'none')).toBe(true)
})

test('keyboard: arrows, Escape, slash, focus order and containment', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await open(page, { band: 'teens' })
  await expect(heading(page, 'Why indicators matter')).toBeFocused()
  // Arrow keys move; focus follows the heading and the announcer speaks the step.
  await page.keyboard.press('ArrowRight')
  await expect(heading(page, 'Indicators and their colours')).toBeFocused()
  await expect(page.getByTestId('lesson-announcer')).toHaveText('Step 2 of 5: Explain. Indicators and their colours')
  await page.keyboard.press('ArrowLeft')
  await expect(heading(page, 'Why indicators matter')).toBeFocused()
  // Slash reaches the disabled Ask Co control and its reason is exposed.
  await page.keyboard.press('/')
  const ask = page.getByRole('button', { name: 'Ask Co' })
  await expect(ask).toBeFocused()
  await expect(ask).toHaveAttribute('aria-disabled', 'true')
  await expect(ask).toHaveAccessibleDescription(/coming soon/)
  // Every control is reachable and nothing outside the lesson (or its dialog) ever takes focus.
  await heading(page, 'Why indicators matter').focus()
  const seen = new Set<string>()
  for (let index = 0; index < 30; index++) {
    await page.keyboard.press('Tab')
    const where = await page.evaluate(() => {
      const active = document.activeElement
      // Past the last control focus leaves for the browser itself (body); the Next development overlay is not part of the app.
      const outsideButHarmless = !active || active === document.body || active.tagName === 'NEXTJS-PORTAL'
      return { inside: !!active?.closest('[data-lesson-frame]') || outsideButHarmless, label: active?.getAttribute('aria-label') ?? (active?.tagName === 'BODY' ? 'body' : active?.textContent?.trim().slice(0, 30)) ?? '' }
    })
    expect(where.inside, `Tab ${index + 1} left the lesson (${where.label})`).toBe(true)
    seen.add(where.label)
  }
  for (const label of ['Close lesson', 'Ask Co', 'Next', 'Listen']) expect([...seen].some(entry => entry.includes(label)), `${label} is reachable by Tab`).toBe(true)
  // Escape asks first; the dialog holds focus; Keep learning closes it without leaving.
  await page.keyboard.press('Escape')
  const dialog = page.getByRole('dialog', { name: 'Leave this lesson?' })
  await expect(dialog).toBeVisible()
  for (let index = 0; index < 5; index++) {
    await page.keyboard.press('Tab')
    // Base UI's focus guards hand focus back to the dialog a moment after it reaches the guard (same as the B07 join dialog).
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), { message: `focus left the dialog on Tab ${index + 1}`, timeout: 2000 }).toBe(true)
  }
  await shot(page, 'lesson-exit-confirm-teens-1440', false)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(heading(page, 'Why indicators matter')).toBeVisible()
  // Radio groups keep the arrow keys; Next stays locked until the check is right.
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight')
  await expect(heading(page, 'Quick check')).toBeVisible()
  await page.getByRole('radio').first().focus()
  await page.keyboard.press('ArrowDown')
  await expect(heading(page, 'Quick check')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
})

test('progress survives a reload: the lesson reopens on the saved step', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 1024, height: 1000 })
  await open(page, { band: 'tweens' })
  await expect(heading(page, 'Pieces of a whole')).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(heading(page, 'Same size pieces')).toBeVisible()
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved')
  await page.reload()
  await expect(heading(page, 'Same size pieces')).toBeVisible()
  await expect(page.getByTestId('lesson-step')).toContainText('Step 2 of 5')
  expect(mock.detail.progress).toMatchObject({ currentStep: 1, completedSteps: [0] })
})
