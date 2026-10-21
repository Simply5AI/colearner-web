import { test, expect, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fixtureQuestion, servedKinds, allKinds } from '../../../components/practice/session/dev/practice-fixtures'
import { createPracticeMock, type PracticeMock, type PracticeMockOptions } from '../../../components/practice/session/dev/practice-mock'
import type { QuestionKind } from '../../../components/practice/session/practice-types'

/**
 * UI-only qualification of the real B09 session player through /dev/practice-session. The practice endpoints are answered with
 * page.route by the same test double the integration tests use (the platform practice module was built in parallel), and
 * /api/auth/session is mocked. No API, model, database or real voice is involved: speech is a fake local voice.
 */
const output = process.env.B09_OUTPUT_DIR ? path.resolve(process.env.B09_OUTPUT_DIR) : path.resolve('output/b09')
type Band = 'kids' | 'tweens' | 'teens'
const widths: [number, Band][] = [[390, 'kids'], [1024, 'tweens'], [1440, 'teens']]
const minTarget: Record<Band, number> = { kids: 64, tweens: 48, teens: 44 }
type Scenario = Partial<Omit<PracticeMockOptions, 'band'>> & { band: Band; speech?: 'fake' | 'none'; dir?: 'rtl' }
let mock: PracticeMock
let loading = false
const records: unknown[] = []
const problems: string[] = []

async function prepare(page: Page) {
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`))
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource|favicon|net::ERR|Download the React DevTools/.test(message.text())) problems.push(`console: ${message.text()}`) })
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
  await page.route('**/api/learn/practice/**', route => {
    const request = route.request()
    const url = new URL(request.url())
    const raw = request.postData()
    // The loading state is a request that never answers.
    if (loading) return new Promise<void>(() => undefined)
    const reply = mock.handle(request.method(), url.pathname + url.search, raw ? JSON.parse(raw) : undefined)
    return route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body) })
  })
}
async function open(page: Page, scenario: Scenario) {
  const { band, speech = 'fake', dir, ...options } = scenario
  mock = createPracticeMock({ band, ...options })
  loading = options.state === 'loading'
  const query = new URLSearchParams({ mock: 'network', band, mode: options.mode ?? 'PRACTICE', state: options.state ?? 'ready', speech, pollMs: '250' })
  if (dir) query.set('dir', dir)
  await page.goto(`/dev/practice-session?${query}`)
  // A modal dialog or the inert page behind the player hides the notice from the accessibility tree, so look past that.
  await expect(page.getByRole('note', { includeHidden: true }).first()).toContainText('synthetic fixtures only')
}
const frameOverflow = (page: Page) => page.evaluate(() => {
  const frame = document.querySelector('[data-lesson-frame]')
  return { frame: frame ? { scrollWidth: frame.scrollWidth, clientWidth: frame.clientWidth } : null, width: innerWidth, scrollWidth: document.documentElement.scrollWidth }
})
const prompt = (band: Band, kind: QuestionKind) => fixtureQuestion(band, kind).view.prompt
const heading = (page: Page, band: Band, kind: QuestionKind) => page.getByRole('heading', { level: 2, name: prompt(band, kind) })
const shot = (page: Page, name: string, fullPage = true) => page.screenshot({ path: path.join(output, `${name}.png`), fullPage })
async function expectNoOverflow(page: Page, width: number, label: string) {
  const dimensions = await frameOverflow(page)
  expect(dimensions.scrollWidth, `${label} overflows the page at ${width}`).toBeLessThanOrEqual(width)
  if (dimensions.frame) expect(dimensions.frame.scrollWidth, `${label} overflows the player at ${width}`).toBeLessThanOrEqual(dimensions.frame.clientWidth)
  return dimensions
}
const checkName = (band: Band) => band === 'kids' ? 'Check!' : 'Check my answer'
const optionText = (list: unknown, id: string) => (list as { id: string; text: string }[]).find(entry => entry.id === id)!.text

/** Answers a question through the real controls: right or wrong. */
async function respond(page: Page, band: Band, kind: QuestionKind, right: boolean) {
  const question = fixtureQuestion(band, kind)
  const view = question.view as Record<string, unknown>
  const key = question.key
  switch (key.kind) {
    case 'MCQ': {
      const options = view.options as { id: string; text: string }[]
      const pick = right ? key.optionId : options.find(option => option.id !== key.optionId)!.id
      await page.getByRole('radio', { name: optionText(options, pick), exact: true }).check()
      break
    }
    case 'TRUE_FALSE': await page.getByRole('radio', { name: (right ? key.value : !key.value) ? 'True' : 'False', exact: true }).check(); break
    case 'MULTI_SELECT': {
      const options = view.options as { id: string; text: string }[]
      const ids = right ? key.optionIds : options.filter(option => !key.optionIds.includes(option.id)).map(option => option.id).concat(key.optionIds.slice(0, 1))
      for (const id of ids) await page.getByRole('checkbox', { name: optionText(options, id), exact: true }).check()
      break
    }
    case 'CLOZE': {
      const parts = view.parts as { type: string; id?: string; options?: { id: string; text: string }[] | null }[]
      const blanks = parts.filter(part => part.type === 'blank')
      for (const [index, blank] of blanks.entries()) {
        const target = key.blanks.find(entry => entry.blankId === blank.id)!
        const field = page.getByLabel(`Blank ${index + 1} of ${blanks.length}`)
        if (blank.options) await field.selectOption(right ? target.accepted[0]! : blank.options.find(option => option.id !== target.accepted[0])!.id)
        else await field.fill(right ? target.accepted[0]! : 'nothing')
      }
      break
    }
    case 'MATCHING': {
      const left = view.left as { id: string; text: string }[]
      const rightList = view.right as { id: string; text: string }[]
      const pairs = key.pairs.map((pair, index) => right ? pair : { leftId: pair.leftId, rightId: key.pairs[(index + 1) % key.pairs.length]!.rightId })
      for (const pair of pairs) {
        const leftText = optionText(left, pair.leftId), rightText = optionText(rightList, pair.rightId)
        if (band === 'kids') {
          await page.getByRole('button', { name: new RegExp(`^${leftText}`) }).click()
          await page.getByRole('button', { name: new RegExp(`^${rightText}`) }).click()
        } else await page.getByRole('combobox', { name: leftText, exact: true }).selectOption(pair.rightId)
      }
      break
    }
    case 'ORDERING': {
      const items = view.items as { id: string; text: string }[]
      const target = right ? key.order : [...key.order].reverse()
      for (let position = 0; position < target.length; position++) {
        const id = target[position]!
        for (let guard = 0; guard < 10; guard++) {
          const order = await page.locator('[data-item]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-item')))
          const at = order.indexOf(id)
          if (at <= position) break
          await page.getByRole('button', { name: new RegExp(`^Move ${optionText(items, id).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')} up`) }).click()
        }
      }
      break
    }
    case 'SHORT_ANSWER': await page.getByRole('textbox').fill(right ? `The answer covers ${key.keywords.join(' and ')}.` : 'I am not sure at all.'); break
  }
}

for (const [width, band] of widths) {
  test(`every question kind the ${band} band is served fits ${width}px, shows its receipt and is operable`, async ({ page }) => {
    await mkdir(output, { recursive: true })
    await prepare(page)
    await page.setViewportSize({ width, height: width === 390 ? 1500 : 1100 })
    const kinds = [...servedKinds[band]]
    await open(page, { band, kinds, gradingPolls: 2 })
    for (const [index, kind] of kinds.entries()) {
      await expect(heading(page, band, kind)).toBeVisible()
      await expect(heading(page, band, kind)).toBeFocused()
      await expect(page.getByTestId('question-count')).toContainText(`Question ${index + 1} of ${kinds.length}`)
      const dimensions = await expectNoOverflow(page, width, `${kind} question`)
      // Touch targets: every visible button, select, text field and tile is at least the band minimum high.
      const small = await page.evaluate(min => [...document.querySelectorAll('[data-lesson-frame] button:not([disabled]), [data-lesson-frame] select, [data-lesson-frame] input:not([type=radio]):not([type=checkbox]), [data-lesson-frame] label.ds-question-option')]
        .filter(node => (node as HTMLElement).offsetParent !== null).map(node => ({ name: (node.getAttribute('aria-label') ?? node.textContent ?? '').trim().slice(0, 30), height: node.getBoundingClientRect().height }))
        .filter(entry => entry.height < min - 1), minTarget[band])
      expect(small, `${kind} controls under ${minTarget[band]}px at ${width}`).toEqual([])
      await shot(page, `practice-${kind.toLowerCase()}-question-${band}-${width}`)
      records.push({ screen: 'question', kind, band, ...dimensions })
      await respond(page, band, kind, true)
      await page.getByRole('button', { name: checkName(band) }).click()
      await expect(page.getByTestId('receipt')).toBeVisible()
      if (kind === 'SHORT_ANSWER') await expect(page.getByTestId('receipt')).toHaveAttribute('data-feedback-kind', 'correct')
      await expect(page.getByTestId('receipt')).toHaveAttribute('data-feedback-kind', 'correct')
      await expectNoOverflow(page, width, `${kind} receipt`)
      await shot(page, `practice-${kind.toLowerCase()}-correct-${band}-${width}`)
      const last = index === kinds.length - 1
      await page.getByRole('button', { name: last ? (band === 'kids' ? 'All done!' : 'Finish') : (band === 'kids' ? 'Next' : 'Next question'), exact: true }).click()
    }
    await expect(page.getByTestId('harness-outcome')).toContainText('Session finished')
    expect(mock.status).toBe('COMPLETED')
    expect(mock.attempts.map(list => list.length)).toEqual(kinds.map(() => 1))
    await writeFile(path.join(output, `viewport-${band}-${width}.json`), JSON.stringify({ date: '2026-10-19', kind: 'development-only-ui-with-test-double-no-api-model-or-database', records: records.filter(record => (record as { band: Band }).band === band) }, null, 2))
  })

  test(`incorrect with a retry, the revealed answer, hints and the pending states fit ${band} at ${width}px`, async ({ page }) => {
    await prepare(page)
    await page.setViewportSize({ width, height: width === 390 ? 1500 : 1100 })
    const kind: QuestionKind = 'MCQ'
    // Hint ladder open, then a wrong answer with a retry (never revealing), then the tries used up (revealed).
    await open(page, { band, kinds: [kind, 'MATCHING'], attemptsAllowed: 2 })
    await expect(heading(page, band, kind)).toBeVisible()
    const labels = band === 'kids' ? ['A little help', 'More help', 'Look at this'] : ['Need help?', 'Show next hint', 'Show a similar example']
    for (const [index, label] of labels.entries()) {
      await page.getByRole('button', { name: label, exact: true }).click()
      await expect(page.locator('[data-testid="hint-ladder"] li')).toHaveCount(index + 1)
    }
    await expectNoOverflow(page, width, 'hint ladder')
    await shot(page, `practice-hints-open-${band}-${width}`)
    await respond(page, band, kind, false)
    await page.getByRole('button', { name: checkName(band) }).click()
    await expect(page.getByTestId('receipt')).toHaveAttribute('data-feedback-kind', 'incorrect')
    await expect(page.getByTestId('revealed-answer')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expectNoOverflow(page, width, 'incorrect receipt')
    await shot(page, `practice-incorrect-retry-${band}-${width}`)
    await page.getByRole('button', { name: 'Try again' }).click()
    await respond(page, band, kind, false)
    await page.getByRole('button', { name: checkName(band) }).click()
    await expect(page.getByTestId('revealed-answer')).toBeVisible()
    await expect(page.locator('[data-option-state="correct"]')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
    await shot(page, `practice-incorrect-revealed-${band}-${width}`)
    if (band === 'kids') expect(await page.getByTestId('receipt').innerText()).not.toMatch(/wrong|incorrect|fail|tries/i)

    // Co is checking -> graded, and feedback unavailable (written answers: teens are served them).
    if (band === 'teens') {
      await open(page, { band, kinds: ['SHORT_ANSWER'], gradingPolls: 4 })
      await respond(page, band, 'SHORT_ANSWER', true)
      await page.getByRole('button', { name: checkName(band) }).click()
      await expect(page.getByTestId('receipt')).toHaveAttribute('data-feedback-kind', 'pending')
      await shot(page, `practice-pending-${band}-${width}`)
      await expect(page.getByTestId('receipt')).toHaveAttribute('data-feedback-kind', 'correct')
      await open(page, { band, kinds: ['SHORT_ANSWER'], feedbackUnavailable: true })
      await respond(page, band, 'SHORT_ANSWER', true)
      await page.getByRole('button', { name: checkName(band) }).click()
      await expect(page.getByTestId('receipt')).toHaveAttribute('data-feedback-kind', 'unavailable')
      await expectNoOverflow(page, width, 'feedback unavailable')
      await shot(page, `practice-feedback-unavailable-${band}-${width}`)
    }
  })

  test(`EXAM shows the timer and no results, and the session states fit ${band} at ${width}px`, async ({ page }) => {
    await prepare(page)
    await page.setViewportSize({ width, height: width === 390 ? 1300 : 1000 })
    await open(page, { band, mode: 'EXAM', kinds: ['MCQ', 'TRUE_FALSE'], remainingSec: 900 })
    await expect(heading(page, band, 'MCQ')).toBeVisible()
    await expect(page.getByTestId('session-timer')).toBeVisible()
    await expect(page.getByRole('button', { name: /Need help|A little help/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Skip/ })).toHaveCount(0)
    await expectNoOverflow(page, width, 'exam question')
    await shot(page, `practice-exam-question-${band}-${width}`)
    await respond(page, band, 'MCQ', false)
    await page.getByRole('button', { name: band === 'kids' ? 'Save' : 'Save answer' }).click()
    await expect(page.getByTestId('receipt')).toHaveAttribute('data-feedback-kind', 'recorded')
    expect(await page.locator('body').innerText()).not.toMatch(/Right answer|Not this one|Try again|Nice work|Good try/)
    await shot(page, `practice-exam-recorded-${band}-${width}`)

    const states: { state: NonNullable<PracticeMockOptions['state']>; text: RegExp; name: string }[] = [
      { state: 'expired', text: /time is up|Time is up/i, name: 'expired' },
      { state: 'denied', text: /You cannot open this/, name: 'denied' },
      { state: 'unavailable', text: /This could not load/, name: 'unavailable' },
      { state: 'abandoned', text: /This practice was closed/, name: 'abandoned' },
      { state: 'loading', text: /Opening your practice/, name: 'loading' },
    ]
    for (const item of states) {
      await open(page, { band, state: item.state })
      await expect(page.getByText(item.text).first()).toBeVisible()
      const dimensions = await expectNoOverflow(page, width, item.name)
      await shot(page, `practice-state-${item.name}-${band}-${width}`)
      records.push({ screen: 'state', state: item.name, band, ...dimensions })
    }
  })
}

test('every kind in every band renders at 390, 1024 and 1440 without overflow', async ({ page }) => {
  await prepare(page)
  for (const band of ['kids', 'tweens', 'teens'] as Band[]) {
    for (const width of [390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1200 })
      await open(page, { band, kinds: [...allKinds] })
      for (const [index, kind] of allKinds.entries()) {
        await expect(heading(page, band, kind)).toBeVisible()
        await expectNoOverflow(page, width, `${band} ${kind} at ${width}`)
        if (width === 390 || band === 'tweens') await shot(page, `practice-matrix-${kind.toLowerCase()}-${band}-${width}`)
        if (index < allKinds.length - 1) await page.getByRole('button', { name: /^Skip/ }).click()
      }
    }
  }
})

test('keyboard only: choose, check, read the receipt, move on, leave with confirmation', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await open(page, { band: 'teens', kinds: ['MCQ', 'MATCHING', 'ORDERING'] })
  await expect(heading(page, 'teens', 'MCQ')).toBeFocused()
  // Tab to the answer tiles (past the read-aloud button), arrow to the right one, then Enter sends it.
  const options = (fixtureQuestion('teens', 'MCQ').view as unknown as { options: { id: string; text: string }[] }).options
  const right = optionText(options, 'ph')
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press('Tab')
    if (await page.evaluate(() => document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'radio')) break
  }
  const here = () => page.evaluate(() => document.activeElement?.closest('label')?.textContent ?? '')
  for (let index = 0; index < 4 && !(await here()).includes(right); index++) await page.keyboard.press('ArrowDown')
  expect(await here()).toContain(right)
  await page.keyboard.press('Space')
  await expect(page.getByRole('radio', { name: right })).toBeChecked()
  await page.keyboard.press('Enter')
  const card = page.getByTestId('receipt')
  await expect(card).toHaveAttribute('data-feedback-kind', 'correct')
  await expect(card.getByRole('heading')).toBeFocused()
  await page.getByRole('button', { name: 'Next question' }).focus()
  await page.keyboard.press('Enter')
  await expect(heading(page, 'teens', 'MATCHING')).toBeFocused()
  // Matching: every select is reachable by Tab and set with the keyboard.
  const first = page.getByRole('combobox').first()
  await first.focus()
  await page.keyboard.press('ArrowDown')
  await expect(first).not.toHaveValue('')
  await expect(page.getByTestId('practice-announcer')).toContainText('matched with')
  await page.getByRole('button', { name: 'Skip for now' }).focus()
  await page.keyboard.press('Enter')
  await expect(heading(page, 'teens', 'ORDERING')).toBeFocused()
  // Ordering: Enter on a move button reorders, announces it and keeps focus on the button.
  const move = page.getByRole('button', { name: /^Move Bleach down/ })
  await move.focus()
  const before = await page.locator('[data-item]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-item')))
  await page.keyboard.press('Enter')
  const after = await page.locator('[data-item]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-item')))
  if (before.indexOf('bleach') < before.length - 1) expect(after.indexOf('bleach')).toBe(before.indexOf('bleach') + 1)
  await expect(page.getByTestId('practice-announcer')).toContainText('moved to position')
  await expect(page.getByRole('button', { name: /^Move Bleach down/ })).toBeFocused()
  // Escape asks first, the dialog holds focus, Keep practising returns to the question.
  await page.keyboard.press('Escape')
  const dialog = page.getByRole('dialog', { name: 'Leave this practice?' })
  await expect(dialog).toBeVisible()
  for (let index = 0; index < 4; index++) {
    await page.keyboard.press('Tab')
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), { message: `focus left the dialog on Tab ${index + 1}`, timeout: 2000 }).toBe(true)
  }
  await shot(page, 'practice-exit-confirm-teens-1440', false)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(heading(page, 'teens', 'ORDERING')).toBeVisible()
  // Nothing outside the player ever takes focus.
  for (let index = 0; index < 40; index++) {
    await page.keyboard.press('Tab')
    const inside = await page.evaluate(() => { const active = document.activeElement; return !active || active === document.body || active.tagName === 'NEXTJS-PORTAL' || !!active.closest('[data-lesson-frame]') })
    expect(inside, `Tab ${index + 1} left the player`).toBe(true)
  }
})

test('resume after a reload: the session reopens at the first open question, answers kept', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 1024, height: 1000 })
  await open(page, { band: 'tweens', kinds: ['MCQ', 'TRUE_FALSE', 'MULTI_SELECT'] })
  await respond(page, 'tweens', 'MCQ', true)
  await page.getByRole('button', { name: checkName('tweens') }).click()
  await expect(page.getByTestId('receipt')).toBeVisible()
  await page.getByRole('button', { name: 'Next question' }).click()
  await expect(heading(page, 'tweens', 'TRUE_FALSE')).toBeVisible()
  await page.reload()
  await expect(heading(page, 'tweens', 'TRUE_FALSE')).toBeVisible()
  await expect(page.getByTestId('question-count')).toContainText('Question 2 of 3')
  expect(mock.attempts[0]).toHaveLength(1)
  expect(mock.itemStates).toEqual(['ANSWERED', 'PENDING', 'PENDING'])
})

test('a lost reply is re-sent with the same id: one attempt on the server', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 1024, height: 1000 })
  await open(page, { band: 'tweens', kinds: ['MCQ'], dropReplies: 1 })
  await respond(page, 'tweens', 'MCQ', true)
  await page.getByRole('button', { name: checkName('tweens') }).click()
  await expect(page.getByTestId('answer-error')).toContainText('We could not tell if your answer arrived')
  await shot(page, 'practice-send-again-tweens-1024')
  await page.getByRole('button', { name: 'Send again' }).click()
  await expect(page.getByTestId('receipt')).toHaveAttribute('data-feedback-kind', 'correct')
  const ids = mock.calls.filter(call => call.path.endsWith('/answer')).map(call => (call.body as { clientAttemptId: string }).clientAttemptId)
  expect(ids).toHaveLength(2)
  expect(new Set(ids).size).toBe(1)
  expect(mock.attempts[0]).toHaveLength(1)
})

test('RTL: logical layout, no overflow, mirrored arrows for every kind that has direction', async ({ page }) => {
  await prepare(page)
  for (const [width, band] of [[390, 'kids'], [390, 'teens'], [1024, 'tweens']] as [number, Band][]) {
    await page.setViewportSize({ width, height: width === 390 ? 1500 : 1100 })
    const kinds = band === 'kids' ? (['MCQ', 'MATCHING', 'ORDERING'] as QuestionKind[]) : (['MCQ', 'MATCHING', 'ORDERING', 'CLOZE'] as QuestionKind[])
    await open(page, { band, dir: 'rtl', kinds })
    await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('rtl')
    for (const [index, kind] of kinds.entries()) {
      await expect(heading(page, band, kind)).toBeVisible()
      await expectNoOverflow(page, width, `rtl ${band} ${kind}`)
      await shot(page, `practice-rtl-${kind.toLowerCase()}-${band}-${width}`)
      if (index < kinds.length - 1) await page.getByRole('button', { name: /^Skip/ }).click()
    }
    // Skip sits at the inline start (right edge side) and the primary action at the inline end.
    const skip = await page.getByRole('button', { name: /^Skip/ }).boundingBox().catch(() => null)
    const check = await page.getByRole('button', { name: checkName(band) }).boundingBox()
    if (skip) expect(skip.x, 'Skip sits at the inline start (right) in RTL').toBeGreaterThan(check!.x)
  }
})

test('reduced motion stops Co, the spinner and transitions in the session', async ({ page }) => {
  await prepare(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1024, height: 900 })
  await open(page, { band: 'tweens', kinds: ['MCQ'] })
  await expect(heading(page, 'tweens', 'MCQ')).toBeVisible()
  await respond(page, 'tweens', 'MCQ', true)
  await page.getByRole('button', { name: checkName('tweens') }).click()
  await expect(page.getByTestId('receipt')).toBeVisible()
  const names = await page.evaluate(() => [...document.querySelectorAll('.ds-co, .ds-co *, .ds-spinner')].map(node => getComputedStyle(node).animationName))
  expect(names.length).toBeGreaterThan(0)
  expect(names.every(name => name === 'none')).toBe(true)
  // Name, target and effective duration of everything the document animates right now.
  const describe = () => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').map(animation => {
    const target = (animation.effect as KeyframeEffect | null)?.target
    return { name: (animation as CSSAnimation).animationName ?? (animation as CSSTransition).transitionProperty ?? 'unknown', target: target instanceof Element ? `${target.tagName}.${target.className}` : '?', duration: Number(animation.effect?.getComputedTiming().duration ?? 0) }
  }))
  // The design system collapses motion to .01ms (globals.css), so a transition can be caught for the one tick it exists. Anything
  // that would be perceivable (longer than one frame) must not run: wait for the tick to pass, then nothing may be running.
  await expect.poll(async () => (await describe()).filter(entry => entry.duration > 1), { message: 'animations still running with reduced motion', timeout: 3000 }).toEqual([])
  await page.waitForTimeout(300)
  expect(await describe(), 'animations still running with reduced motion after settling').toEqual([])
})

test('read-aloud: absent without a voice, never autoplays, highlights the spoken word and stops on the next question', async ({ page }) => {
  await prepare(page)
  await page.setViewportSize({ width: 390, height: 1400 })
  await open(page, { band: 'kids', kinds: ['MCQ', 'TRUE_FALSE'], speech: 'none' })
  await expect(heading(page, 'kids', 'MCQ')).toBeVisible()
  await expect(page.getByRole('button', { name: /Read to me|Listen|Stop/ })).toHaveCount(0)
  await expect(page.getByText('Your device cannot read out loud. You can read along!')).toBeVisible()
  await shot(page, 'practice-speech-unavailable-kids-390')

  await open(page, { band: 'kids', kinds: ['MCQ', 'TRUE_FALSE'], speech: 'fake' })
  await expect(heading(page, 'kids', 'MCQ')).toBeVisible()
  const read = page.getByRole('button', { name: 'Read to me' })
  await expect(read).toBeVisible()
  expect((await read.boundingBox())!.height).toBeGreaterThanOrEqual(63)
  await page.waitForTimeout(1200)
  expect(await page.evaluate(() => (window as unknown as { __practiceSpeech: { spoken: string[] } }).__practiceSpeech.spoken.length)).toBe(0)
  await shot(page, 'practice-speech-ready-kids-390')
  await read.click()
  await expect(page.locator('mark[aria-current="true"]').first()).toBeVisible()
  await shot(page, 'practice-speech-highlight-kids-390')
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(heading(page, 'kids', 'TRUE_FALSE')).toBeVisible()
  await expect(page.locator('mark')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __practiceSpeech: { current: () => unknown } }).__practiceSpeech.current())).toBeNull()
})

test('no console or page errors during the whole review', async () => {
  expect(problems, problems.join('\n')).toEqual([])
})
