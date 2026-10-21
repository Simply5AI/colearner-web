import { test, expect, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createCoMock, type CoMock, type MockOptions } from '../../../components/co/dev/co-mock'
import { createLessonMock, type LessonMock } from '../../../components/lesson/dev/lesson-mock'
import { guidanceText, topics, voiceReason } from '../../../components/co/dev/co-fixtures'

/**
 * UI-only qualification of the real B10 Ask Co panel through /dev/co. The Ask Co endpoints are answered with page.route by the
 * same test double the integration tests use (the platform co module was built in parallel), and /api/auth/session is mocked.
 * No API, model, database or real voice is involved: speech is a fake local voice.
 */
const output = process.env.B10_OUTPUT_DIR ? path.resolve(process.env.B10_OUTPUT_DIR) : path.resolve('output/b10')
type Band = 'kids' | 'tweens' | 'teens'
const widths: [number, Band][] = [[390, 'kids'], [1024, 'tweens'], [1440, 'teens']]
const minTarget: Record<Band, number> = { kids: 64, tweens: 48, teens: 44 }
type Scenario = Partial<Omit<MockOptions, 'band'>> & { band: Band; speech?: 'fake' | 'none'; dir?: 'rtl'; opener?: 'material' | 'lesson'; open?: boolean; pollMs?: number; slowMs?: number; parent?: 'full' | 'summary' }
let mock: CoMock
const records: unknown[] = []

async function prepare(page: Page) {
  // Buffer/retry the real development layout chunk after observed local aborted asset responses (as B06 to B09).
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
  await page.route('**/api/learn/co/**', route => {
    const request = route.request()
    const url = new URL(request.url())
    const raw = request.postData()
    const reply = mock.handle(request.method(), url.pathname + url.search, raw ? JSON.parse(raw) : undefined)
    return route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body) })
  })
}
async function open(page: Page, scenario: Scenario) {
  const { band, speech = 'fake', dir, opener = 'lesson', open: auto, pollMs = 150, slowMs, parent, ...options } = scenario
  mock = createCoMock({ band, ...options, mode: parent === 'summary' ? 'SUMMARY' : parent === 'full' ? 'FULL' : undefined })
  const query = new URLSearchParams({ mock: 'network', band, state: options.state ?? 'fresh', speech, opener, pollMs: String(pollMs) })
  if (dir) query.set('dir', dir)
  if (auto) query.set('open', '1')
  if (slowMs) query.set('slowMs', String(slowMs))
  await page.goto(`/dev/co?${query}`)
  // A modal dialog makes the page behind it inert, so look past that for the notice.
  await expect(page.getByRole('note', { includeHidden: true }).first()).toContainText('synthetic fixtures only')
}
const dialogOf = (page: Page) => page.getByRole('dialog', { name: 'Ask Co' })
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(output, `${name}.png`), fullPage: false })
const textbox = (page: Page) => dialogOf(page).getByRole('textbox')
const sendName = (band: Band) => band === 'kids' ? 'Ask' : 'Send'
async function openAndWait(page: Page, scenario: Scenario) {
  await open(page, { ...scenario, open: true })
  await expect(dialogOf(page)).toBeVisible()
  await expect(textbox(page)).toBeVisible()
}
async function ask(page: Page, band: Band, text: string) {
  await textbox(page).fill(text)
  await dialogOf(page).getByRole('button', { name: sendName(band), exact: true }).click()
}
async function expectFits(page: Page, width: number, label: string) {
  const sizes = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]')
    const box = dialog?.getBoundingClientRect()
    return { page: document.documentElement.scrollWidth, width: innerWidth, dialog: dialog ? { scrollWidth: dialog.scrollWidth, clientWidth: dialog.clientWidth, left: box!.left, right: box!.right, top: box!.top, bottom: box!.bottom, innerHeight } : null }
  })
  expect(sizes.page, `${label} overflows the page at ${width}`).toBeLessThanOrEqual(width)
  if (sizes.dialog) {
    expect(sizes.dialog.scrollWidth, `${label} overflows the panel at ${width}`).toBeLessThanOrEqual(sizes.dialog.clientWidth)
    expect(sizes.dialog.left, `${label} panel starts on screen`).toBeGreaterThanOrEqual(-1)
    expect(sizes.dialog.right, `${label} panel ends on screen`).toBeLessThanOrEqual(width + 1)
    expect(sizes.dialog.bottom, `${label} panel fits the height`).toBeLessThanOrEqual(sizes.dialog.innerHeight + 1)
  }
  return sizes
}
async function expectTargets(page: Page, band: Band, names: (string | RegExp)[], label: string) {
  for (const name of names) {
    const control = dialogOf(page).getByRole('button', { name }).first()
    const box = await control.boundingBox()
    expect(box, `${label}: ${String(name)} is visible`).not.toBeNull()
    expect(box!.height, `${label}: ${String(name)} target height`).toBeGreaterThanOrEqual(minTarget[band] - 1)
  }
}

for (const [width, band] of widths) {
  const topic = topics[band]
  test(`the ${band} panel fits ${width}px through suggestions, thinking, a sourced answer, beyond, safety and failure`, async ({ page }) => {
    await mkdir(output, { recursive: true })
    await prepare(page)
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await openAndWait(page, { band, polls: 7, parent: band === 'teens' ? 'summary' : 'full' })
    const dialog = dialogOf(page)

    // Suggestions: Co, the AI label, big taps, the voice note instead of a microphone, the parent note.
    await expect(dialog.getByTestId('co-empty')).toBeVisible()
    await expect(dialog.getByText('Co is an AI helper').first()).toBeVisible()
    await expect(dialog.getByTestId('co-voice-note')).toContainText(voiceReason)
    await expect(dialog.getByTestId('co-grounding-note')).toBeVisible()
    await expect(dialog.getByRole('button', { name: /mic|microphone|record/i })).toHaveCount(0)
    const parent = band === 'kids' ? 'Your grown-up can see your chats with Co.' : band === 'tweens' ? 'Your parent can see your chats with Co.' : 'Your parent can see a summary of your chats with Co and any safety alerts.'
    await expect(dialog.getByTestId('co-parent-note')).toHaveText(parent)
    await expectFits(page, width, 'suggestions')
    await expectTargets(page, band, [...topic.suggestions.slice(0, 3).map(text => new RegExp(`^${text.replace(/[?]/g, '\\?')}$`)), sendName(band), 'Close Ask Co'], 'suggestions')
    await shot(page, `co-suggestions-${band}-${width}`)

    // Thinking: a real pending state, no partial text.
    await dialog.getByRole('button', { name: topic.suggestions[0]! }).click()
    await expect(dialog.getByTestId('co-pending')).toBeVisible()
    await expect(dialog.getByTestId('co-pending')).toContainText(band === 'kids' ? 'Co is thinking' : 'Co is checking your material')
    await expect(dialog.getByTestId('co-reply-text')).toHaveCount(0)
    await expect(dialog.locator('[data-co-state="thinking"]').first()).toBeVisible()
    await expectFits(page, width, 'thinking')
    await shot(page, `co-thinking-${band}-${width}`)

    // Sourced answer with a source chip that opens the library item.
    const reply = dialog.getByTestId('co-reply').first()
    await expect(reply).toBeVisible()
    await expect(reply.getByTestId('co-reply-text')).toHaveText(topic.answer)
    const chip = reply.getByTestId('co-sources').getByRole('link').first()
    await expect(chip).toHaveText(`From ${topic.source.label}`)
    await expect(chip).toHaveAttribute('href', '/learn/library/material-fixture')
    await expect(reply.getByTestId('co-beyond')).toHaveCount(0)
    await expect(dialog.getByTestId('co-announcer')).toContainText('Co answered.')
    await expectFits(page, width, 'answer')
    await shot(page, `co-answer-${band}-${width}`)

    // Beyond your material, only when the server says so.
    await ask(page, band, 'And what is beyond that?')
    await expect(dialog.getByTestId('co-beyond')).toHaveCount(1)
    await expect(dialog.getByTestId('co-beyond')).toContainText('Beyond your material')
    await expect(dialog.getByTestId('co-beyond-note')).toHaveText(topic.beyondNote)
    await expectFits(page, width, 'beyond')
    await shot(page, `co-beyond-${band}-${width}`)

    // Safety: shield, "Safety check", the code-owned guidance, verbatim.
    await ask(page, band, 'I want to hurt myself')
    const safety = dialog.getByTestId('co-safety')
    await expect(safety).toBeVisible()
    await expect(safety.getByTestId('co-safety-label')).toHaveText('Safety check')
    await expect(safety.getByTestId('co-reply-text')).toHaveText(guidanceText[band].TRUSTED_ADULT)
    await expect(safety.getByTestId('co-sources')).toHaveCount(0)
    await expectFits(page, width, 'safety')
    await shot(page, `co-safety-${band}-${width}`)

    // Explicit failure with retry.
    await ask(page, band, 'please fail this')
    const failed = dialog.getByTestId('co-failed')
    await expect(failed).toContainText('Co could not answer that.')
    await expectFits(page, width, 'failed')
    await shot(page, `co-failed-${band}-${width}`)
    await failed.getByRole('button', { name: 'Try again' }).click()
    await expect(dialog.getByTestId('co-failed')).toHaveCount(0)
    await expect(dialog.getByTestId('co-reply')).toHaveCount(3)
    records.push({ screen: 'panel', band, width, ok: true })
    await writeFile(path.join(output, `viewport-${band}-${width}.json`), JSON.stringify({ date: '2026-10-21', kind: 'development-only-ui-with-test-double-no-api-model-or-database', records: records.filter(record => (record as { band: Band }).band === band) }, null, 2))
  })

  test(`unavailable, policy, not-ready, no-context, denied, ended and unreachable fit ${band} at ${width}px`, async ({ page }) => {
    await mkdir(output, { recursive: true })
    await prepare(page)
    await page.setViewportSize({ width, height: 800 })
    const cases: { state: NonNullable<MockOptions['state']>; text: RegExp }[] = [
      { state: 'unavailable', text: /Ask Co is not switched on for you yet\./ },
      { state: 'disabled', text: /Your school or family settings do not allow Ask Co right now\./ },
      { state: 'not-ready', text: /Your material is still being read\./ },
      { state: 'no-context', text: /Pick something to ask about/ },
      { state: 'denied', text: /You cannot open this/ },
      { state: 'ended', text: /Your learning session ended/ },
      { state: 'unreachable', text: /Ask Co could not load/ },
      { state: 'history-failed', text: /Ask Co could not load/ },
    ]
    for (const item of cases) {
      await open(page, { band, state: item.state, open: true })
      await expect(dialogOf(page).getByText(item.text).first()).toBeVisible()
      await expectFits(page, width, item.state)
      await shot(page, `co-state-${item.state}-${band}-${width}`)
      records.push({ screen: 'state', state: item.state, band, width })
    }
  })
}

test('history: a reopened conversation shows earlier turns, and a pending turn resumes', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 1024, height: 900 })
  await openAndWait(page, { band: 'tweens', state: 'history' })
  const dialog = dialogOf(page)
  await expect(dialog.getByTestId('co-turn')).toHaveCount(2)
  await expect(dialog.getByTestId('co-beyond')).toHaveCount(1)
  await expect(dialog.getByTestId('co-announcer')).toHaveText('')
  await shot(page, 'co-history-tweens-1024')
  await openAndWait(page, { band: 'tweens', state: 'pending', polls: 3 })
  await expect(dialog.getByTestId('co-pending')).toBeVisible()
  await shot(page, 'co-resume-tweens-1024')
  await expect(dialog.getByTestId('co-reply')).toHaveCount(3)
})

test('teens choose Simple or Exam-style and get key points; younger learners have no style choice', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openAndWait(page, { band: 'teens' })
  const dialog = dialogOf(page)
  await expect(dialog.getByRole('radio', { name: 'Simple' })).toBeChecked()
  await dialog.getByRole('radio', { name: 'Exam-style' }).check()
  await ask(page, 'teens', topics.teens.question)
  await expect(dialog.getByTestId('co-key-points')).toContainText(topics.teens.keyPoints[0]!)
  expect(mock.calls.find(call => call.method === 'POST' && call.path.endsWith('/turns'))!.body).toMatchObject({ style: 'EXAM' })
  await shot(page, 'co-exam-teens-1440')
  await openAndWait(page, { band: 'tweens' })
  await expect(dialogOf(page).getByRole('radio')).toHaveCount(0)
})

test('never double-sends: a lost answer is retried with the same id and the server holds one turn', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 1024, height: 900 })
  await openAndWait(page, { band: 'tweens', lostResponses: 1 })
  const dialog = dialogOf(page)
  await ask(page, 'tweens', 'Why does it work this way?')
  await expect(dialog.getByTestId('co-error')).toContainText('We could not send that')
  await expect(textbox(page)).toHaveAttribute('readonly', '')
  await shot(page, 'co-unconfirmed-tweens-1024')
  await dialog.getByRole('button', { name: 'Send again' }).click()
  await expect(dialog.getByTestId('co-reply')).toBeVisible()
  const posts = mock.calls.filter(call => call.method === 'POST' && call.path.endsWith('/turns'))
  expect(posts).toHaveLength(2)
  expect(posts[1]!.body).toEqual(posts[0]!.body)
  expect(mock.created).toBe(1)
  // One pending turn: the second question waits while the first is being answered.
  await ask(page, 'tweens', 'this takes forever')
  await expect(dialog.getByTestId('co-pending')).toBeVisible()
  await textbox(page).fill('Next question')
  await expect(dialog.getByRole('button', { name: 'Send', exact: true })).toBeDisabled()
})

test('stop waiting is offered when Co is slow, and the learner can ask again', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 1024, height: 900 })
  await openAndWait(page, { band: 'tweens', slowMs: 600 })
  const dialog = dialogOf(page)
  await ask(page, 'tweens', 'this takes forever')
  await dialog.getByRole('button', { name: 'Stop waiting' }).click()
  await expect(dialog.getByTestId('co-stopped')).toBeVisible()
  await shot(page, 'co-stopped-tweens-1024')
  await ask(page, 'tweens', topics.tweens.question)
  await expect(dialog.getByTestId('co-reply')).toBeVisible()
})

test('read-aloud: absent without a voice, never autoplays, speaks and highlights on request', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await openAndWait(page, { band: 'kids', speech: 'none' })
  await ask(page, 'kids', topics.kids.question)
  await expect(dialogOf(page).getByTestId('co-reply')).toBeVisible()
  await expect(dialogOf(page).getByRole('button', { name: /Read to me|Listen|Stop/ })).toHaveCount(0)
  await openAndWait(page, { band: 'kids', speech: 'fake' })
  await ask(page, 'kids', topics.kids.question)
  const read = dialogOf(page).getByRole('button', { name: 'Read to me' })
  await expect(read).toBeVisible()
  expect((await read.boundingBox())!.height).toBeGreaterThanOrEqual(63)
  await page.waitForTimeout(1000)
  expect(await page.evaluate(() => (window as unknown as { __coSpeech: { spoken: string[] } }).__coSpeech.spoken.length)).toBe(0)
  await shot(page, 'co-read-ready-kids-390')
  await read.click()
  await expect(dialogOf(page).locator('mark[aria-current="true"]').first()).toBeVisible()
  await shot(page, 'co-read-highlight-kids-390')
  expect(await page.evaluate(() => (window as unknown as { __coSpeech: { spoken: string[] } }).__coSpeech.spoken)).toEqual([topics.kids.answer])
})

test('RTL: the panel sits at the inline start edge, nothing overflows, text mirrors', async ({ page }) => {
  await prepare(page)
  for (const [width, band] of [[390, 'kids'], [1024, 'tweens'], [1440, 'teens']] as [number, Band][]) {
    await page.setViewportSize({ width, height: 900 })
    await openAndWait(page, { band, dir: 'rtl' })
    await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('rtl')
    const sizes = await expectFits(page, width, `rtl ${band}`)
    if (band !== 'kids') expect(sizes.dialog!.left, 'side panel sits on the left in RTL').toBeLessThanOrEqual(1)
    await ask(page, band, topics[band].question)
    await expect(dialogOf(page).getByTestId('co-reply')).toBeVisible()
    const learner = await dialogOf(page).getByTestId('co-learner').boundingBox()
    const panel = await dialogOf(page).boundingBox()
    // The learner's own bubble hugs the inline end, which is the left in RTL.
    expect(learner!.x - panel!.x, 'learner bubble at the inline end').toBeLessThan(panel!.width / 3)
    await shot(page, `co-rtl-${band}-${width}`)
  }
  // And in LTR the side panel hugs the right edge.
  await page.setViewportSize({ width: 1440, height: 900 })
  await openAndWait(page, { band: 'teens' })
  const ltr = await expectFits(page, 1440, 'ltr teens')
  expect(ltr.dialog!.right).toBeGreaterThanOrEqual(1439)
})

test('reduced motion stops Co and the spinner in the panel', async ({ page }) => {
  await prepare(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1024, height: 900 })
  await openAndWait(page, { band: 'tweens', polls: 12 })
  await ask(page, 'tweens', topics.tweens.question)
  await expect(dialogOf(page).getByTestId('co-pending')).toBeVisible()
  const names = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] .ds-co, [role="dialog"] .ds-co *, [role="dialog"] .ds-spinner')].map(node => getComputedStyle(node).animationName))
  expect(names.length).toBeGreaterThan(0)
  expect(names.every(name => name === 'none')).toBe(true)
})

test('keyboard: opens from the opener, traps focus, Esc closes, a draft is protected, focus returns', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page, { band: 'teens' })
  const opener = page.getByRole('button', { name: 'Ask Co' })
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = dialogOf(page)
  await expect(dialog).toBeVisible()
  await expect(textbox(page)).toBeFocused()
  // Tab never leaves the panel, and the page behind it cannot be reached. (Send is a disabled button until there is something to send.)
  await textbox(page).fill('x')
  const seen = new Set<string>()
  for (let index = 0; index < 30; index++) {
    await page.keyboard.press('Tab')
    const where = await page.evaluate(() => {
      const active = document.activeElement
      const outsideButHarmless = !active || active === document.body || active.tagName === 'NEXTJS-PORTAL'
      return { inside: !!active?.closest('[role="dialog"]') || outsideButHarmless || !!active?.hasAttribute('data-base-ui-focus-guard'), label: active?.getAttribute('aria-label') ?? (active?.tagName === 'BODY' ? 'body' : active?.textContent?.trim().slice(0, 30)) ?? '' }
    })
    expect(where.inside, `Tab ${index + 1} left the panel (${where.label})`).toBe(true)
    seen.add(where.label)
  }
  for (const label of ['Close Ask Co', 'Send']) expect([...seen].some(entry => entry.includes(label)), `${label} is reachable by Tab`).toBe(true)
  expect([...seen].some(entry => entry.includes('A field behind the panel'))).toBe(false)
  // A draft is never lost to Esc.
  await textbox(page).focus()
  await textbox(page).fill('Half a question')
  await page.keyboard.press('Escape')
  await expect(dialog.getByTestId('co-confirm-close')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Keep writing' })).toBeFocused()
  await shot(page, 'co-confirm-teens-1440')
  await page.keyboard.press('Escape')
  await expect(dialog.getByTestId('co-confirm-close')).toHaveCount(0)
  await expect(textbox(page)).toHaveValue('Half a question')
  // Clear the draft: Esc closes at once and focus returns to the opener.
  await textbox(page).fill('')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
})

test('keyboard: Enter sends, the answer is announced politely, focus stays in the field', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openAndWait(page, { band: 'teens' })
  await textbox(page).fill(topics.teens.question)
  await page.keyboard.press('Enter')
  const announcer = dialogOf(page).getByTestId('co-announcer')
  await expect(announcer).toHaveAttribute('aria-live', 'polite')
  await expect(announcer).toContainText('Co answered.')
  await expect(textbox(page)).toBeFocused()
  await expect(textbox(page)).toHaveValue('')
})

test('library item entry: a real control when available, the reason when not, and focus returns to it', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 1024, height: 900 })
  await open(page, { band: 'tweens', opener: 'material' })
  const entry = page.getByTestId('ask-co-entry')
  await expect(entry).toBeVisible()
  await shot(page, 'co-entry-available-tweens-1024')
  await entry.getByRole('button', { name: 'Ask Co' }).click()
  await expect(dialogOf(page)).toBeVisible()
  await dialogOf(page).getByRole('button', { name: 'Close Ask Co' }).click()
  await expect(dialogOf(page)).toBeHidden()
  await expect(entry.getByRole('button', { name: 'Ask Co' })).toBeFocused()
  await open(page, { band: 'tweens', opener: 'material', state: 'disabled' })
  const off = page.getByTestId('ask-co-unavailable')
  await expect(off).toContainText('Your school or family settings do not allow Ask Co right now.')
  await expect(off.getByRole('button', { name: 'Ask Co' })).toHaveAttribute('aria-disabled', 'true')
  await shot(page, 'co-entry-unavailable-tweens-1024')
})

/*
 * The real lesson player: /dev/lesson with askCo=1 reports Ask Co as AVAILABLE (a B08 fixture switch added for B10), so the
 * control, the "/" shortcut, the focused-mode frame and the panel are exercised together in a real browser.
 */
async function openLesson(page: Page, band: Band, extra: Record<string, string> = {}) {
  mock = createCoMock({ band })
  const lessons: LessonMock = createLessonMock({ band, askCo: true })
  await page.route('**/api/learn/lessons**', route => {
    const request = route.request()
    const url = new URL(request.url())
    const raw = request.postData()
    const reply = lessons.handle(request.method(), url.pathname + url.search, raw ? JSON.parse(raw) : undefined)
    if (reply.status === 204) return route.fulfill({ status: 204 })
    return route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body) })
  })
  await page.goto(`/dev/lesson?${new URLSearchParams({ mock: 'network', band, state: 'ready', speech: 'fake', pollMs: '250', askCo: '1', ...extra })}`)
  await expect(page.getByRole('note', { includeHidden: true }).first()).toContainText('synthetic fixtures only')
  return lessons
}

for (const [width, band] of widths) {
  test(`in the lesson player the ${band} Ask Co control opens the panel above the lesson at ${width}px`, async ({ page }) => {
    await mkdir(output, { recursive: true })
    await prepare(page)
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await openLesson(page, band)
    const first = (await import('../../../components/lesson/dev/lesson-fixtures')).lessonContentFixture(band).steps[0]!
    await expect(page.getByRole('heading', { level: 2, name: first.title })).toBeVisible()
    const control = page.getByRole('button', { name: 'Ask Co' })
    await expect(control).not.toHaveAttribute('aria-disabled', 'true')
    const box = await control.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(minTarget[band] - 1)
    await shot(page, `co-lesson-control-${band}-${width}`)
    await control.click()
    const dialog = dialogOf(page)
    await expect(dialog).toBeVisible()
    await expect(textbox(page)).toBeVisible()
    // The panel is on top of the focused lesson and receives the pointer (the frame under it is inert).
    const top = await page.evaluate(() => { const point = document.elementFromPoint(innerWidth - 40, innerHeight - 40); return !!point?.closest('[role="dialog"]') })
    expect(top, 'the panel is the topmost layer').toBe(true)
    await expectFits(page, width, 'lesson panel')
    expect(mock.calls[0]!.path).toBe('/co/context?lessonId=lesson-fixture&stepIndex=0')
    await ask(page, band, topics[band].question)
    await expect(dialog.getByTestId('co-reply')).toBeVisible()
    await shot(page, `co-lesson-answer-${band}-${width}`)
    await dialog.getByRole('button', { name: 'Close Ask Co' }).click()
    await expect(dialog).toBeHidden()
    await expect(control).toBeFocused()
  })
}

test('in the lesson player "/" opens Ask Co, and Esc and the arrows belong to the panel, not the lesson', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openLesson(page, 'teens')
  const first = (await import('../../../components/lesson/dev/lesson-fixtures')).lessonContentFixture('teens').steps[0]!
  await expect(page.getByRole('heading', { level: 2, name: first.title })).toBeFocused()
  await page.keyboard.press('/')
  const dialog = dialogOf(page)
  await expect(dialog).toBeVisible()
  await expect(textbox(page)).toBeFocused()
  // Typing a slash or arrows in the field does not touch the lesson.
  await textbox(page).fill('a/b')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('dialog', { name: 'Leave this lesson?' })).toHaveCount(0)
  await textbox(page).fill('')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('dialog', { name: 'Leave this lesson?' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ask Co' })).toBeFocused()
  await expect(page.getByTestId('lesson-step')).toContainText('Step 1 of 5')
  // With the panel closed the lesson keys work again.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Leave this lesson?' })).toBeVisible()
})

test('in the lesson player Ask Co is asked about the step the learner is on', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 1024, height: 900 })
  await openLesson(page, 'tweens')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByTestId('lesson-step')).toContainText('Step 2 of 5')
  await page.getByRole('button', { name: 'Ask Co' }).click()
  await expect(dialogOf(page)).toBeVisible()
  await expect(textbox(page)).toBeVisible()
  expect(mock.calls[0]!.path).toBe('/co/context?lessonId=lesson-fixture&stepIndex=1')
})
