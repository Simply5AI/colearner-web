import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type Browser, type BrowserContext, type Page, type Response } from '@playwright/test'

/**
 * B13 end to end against the REAL platform API and the running web dev server. Skipped unless B13_REAL_API=1.
 *
 *   B13_REAL_API=1 pnpm exec playwright test -c playwright.b13-real.config.ts
 *
 * Needs the local dev stack (API :3000, web :3001, TEACHING_QUESTIONS_ENABLED=true) and the seeded B03 personas from
 * colearner-platform/docs/local-development.md. Reuse a saved login with B13_REUSE_AUTH=1 (the platform throttles
 * /auth/login for about 13 minutes after a few attempts). Every run uses unique titles. Published questions and final
 * worksheets cannot be deleted, so a run leaves them behind in the seeded plan.
 */
const enabled = process.env.B13_REAL_API === '1'
const SCHOOL_NAME = 'Review School A'
const PASSWORD = process.env.B13_SEED_PASSWORD ?? 'B03Review!Pass2026'
const TEACHER = process.env.B13_TEACHER_EMAIL ?? 'teacher@b03.example.test'
const TEEN = process.env.B13_TEEN_EMAIL ?? 'teen@b03.example.test'
const PLAN_TITLE = process.env.B13_PLAN_TITLE ?? 'Dev Mathematics - Grade 3'
const RUN = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
const PROMPT = `B13 e2e which is the half ${RUN}`
const SHEET = `B13 e2e worksheet ${RUN}`

test.skip(!enabled, 'Set B13_REAL_API=1 with the local API (:3000) and web (:3001) running.')

interface Seen { method: string; status: number; url: string; body: string | null }
function watch(page: Page) {
  const calls: Seen[] = []
  const problems: string[] = []
  page.on('response', async (response: Response) => {
    const url = response.url()
    if (!url.includes('/api/')) return
    let body: string | null = null
    if ((response.headers()['content-type'] ?? '').includes('json')) { try { body = await response.text() } catch { body = null } }
    calls.push({ method: response.request().method(), status: response.status(), url, body })
  })
  page.on('console', message => { if (message.type() === 'error' && /ZodError|invalid_type|useTeaching must/i.test(message.text())) problems.push(message.text().slice(0, 400)) })
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`.slice(0, 400)))
  return { calls, problems }
}

const artifacts = process.env.B13_E2E_ARTIFACTS ?? path.join(os.tmpdir(), 'colearner-b13-question-bank')

async function login(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).first().fill(PASSWORD)
  await page.getByRole('button', { name: /log in/i }).first().click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20_000 }).catch(async error => {
    const shown = await page.getByText(/could not sign you in/i).isVisible().catch(() => false)
    throw new Error(shown ? 'Login was refused (throttled: wait about 13 minutes, or use B13_REUSE_AUTH=1).' : String(error))
  })
  await page.waitForLoadState('load')
}

async function signedInContext(browser: Browser, role: string, email: string): Promise<BrowserContext> {
  const stateFile = path.join(artifacts, `auth-${role}.json`)
  if (process.env.B13_REUSE_AUTH === '1' && fs.existsSync(stateFile)) {
    const context = await browser.newContext({ storageState: stateFile })
    const probe = await context.newPage()
    await probe.goto('/workspaces')
    if (!probe.url().includes('/login')) { await probe.close(); return context }
    await context.close()
  }
  const context = await browser.newContext()
  const page = await context.newPage()
  await login(page, email)
  fs.mkdirSync(artifacts, { recursive: true })
  await context.storageState({ path: stateFile })
  await page.close()
  return context
}

async function openSchool(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) { try { await page.goto('/workspaces'); break } catch (error) { if (attempt === 2) throw error } }
  const row = page.getByText(SCHOOL_NAME, { exact: true }).locator('xpath=ancestor::*[.//button[normalize-space()="Open workspace"]][1]')
  await row.getByRole('button', { name: 'Open workspace' }).click()
  await page.waitForURL(/\/org\/[0-9a-f-]+\//, { timeout: 45_000 })
}

const log = (message: string) => console.log(`[b13-e2e] ${new Date().toISOString().slice(11, 19)} ${message}`)
const answerKeyFields = /"correctAnswer"|"rubric"|"teacherAnswerKey"|"acceptedAnswers"/

test.describe.configure({ mode: 'serial' })

test('B13 teacher question bank, CSV import and worksheet on the real API; learners never see answer keys', async ({ browser }) => {
  const teacherContext = await signedInContext(browser, 'teacher', TEACHER)
  const page = await teacherContext.newPage()
  const teacher = watch(page)
  let planId = ''

  await test.step('teacher opens the school and the published seeded plan', async () => {
    log('teacher opens the school and the plan')
    await openSchool(page)
    await page.goto('/teacher/plans')
    await expect(page.getByTestId('plans-screen')).toBeVisible()
    await page.getByText(PLAN_TITLE).first().click()
    await page.waitForURL(/\/teacher\/plans\/[0-9a-f-]+/, { timeout: 45_000 })
    planId = /\/teacher\/plans\/([0-9a-f-]+)/.exec(page.url())![1]!
    await expect(page.getByTestId('plan-workspace')).toHaveAttribute('data-plan-status', 'PUBLISHED')
  })

  await test.step('creates a multiple choice question and publishes it', async () => {
    log('creates and publishes an MCQ')
    await page.goto(`/teacher/questions/new?planId=${planId}`)
    await expect(page.getByTestId('question-editor')).toBeVisible({ timeout: 30_000 })
    const topic = page.getByTestId('field-topic')
    await expect.poll(async () => await topic.locator('option').count(), { timeout: 30_000 }).toBeGreaterThan(1)
    await topic.selectOption({ index: 1 })
    await page.getByTestId('field-prompt').fill(PROMPT)
    const labels = page.getByTestId('option-label')
    const values = ['One half', 'One third', 'One quarter', 'One fifth']
    for (let i = 0; i < 4; i += 1) await labels.nth(i).fill(values[i]!)
    await page.getByTestId('option-correct').first().check()
    await page.getByTestId('field-explanation').fill('Two equal parts make halves.')
    await page.getByTestId('publish').click()
    // Create+publish redirects from /new to the saved question, which can clear the transient status line; the badge is durable.
    await expect(page.getByText(/^Published v\d+$/).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('editor-failure')).toHaveCount(0)
  })

  await test.step('lists the question in the bank with its source and status', async () => {
    log('bank list')
    await page.goto(`/teacher/questions?planId=${planId}`)
    await expect(page.getByTestId('question-table')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('question-table').getByText(PROMPT)).toBeVisible()
  })

  await test.step('imports a 3-row CSV: two rows are ready, the bad row is reported and skipped', async () => {
    log('csv import')
    const csv = [
      'question,a,b,answer',
      `B13 e2e csv one ${RUN},Alpha,Beta,A`,
      `B13 e2e csv two ${RUN},Alpha,Beta,B`,
      `B13 e2e csv bad ${RUN},Alpha,Beta,`,
    ].join('\n')
    await page.goto(`/teacher/questions/import?planId=${planId}`)
    await page.getByTestId('csv-file').setInputFiles({ name: `b13-${RUN}.csv`, mimeType: 'text/csv', buffer: Buffer.from(csv) })
    await page.getByTestId('csv-upload-submit').click()
    await expect(page.getByTestId('csv-mapping')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('map-default-type').selectOption('MCQ')
    const defaultTopic = page.getByTestId('map-default-topic')
    await expect.poll(async () => await defaultTopic.locator('option').count(), { timeout: 30_000 }).toBeGreaterThan(1)
    await defaultTopic.selectOption({ index: 1 })
    await page.getByTestId('map-submit').click()
    await expect(page.getByTestId('csv-preview')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('csv-valid')).toContainText('2 questions ready')
    await expect(page.getByTestId('csv-invalid')).toContainText('1 row')
    // Rows are numbered like the spreadsheet: the header is row 1, so the bad row is row 4.
    await expect(page.locator('[data-testid="csv-row"][data-status="INVALID"]')).toHaveAttribute('data-row', '4')
    await page.getByTestId('csv-commit').click()
    await expect(page.getByTestId('csv-committed')).toContainText('2 questions added as drafts', { timeout: 30_000 })
    await expect(page.getByTestId('csv-skipped')).toContainText('1 row skipped')
  })

  let sheetBase = ''
  await test.step('builds a worksheet, finalises it and opens print and the answer key', async () => {
    log('worksheet')
    await page.goto(`/teacher/plans/${planId}/worksheets`)
    await page.getByTestId('ws-new').click()
    await page.getByTestId('ws-new-title').fill(SHEET)
    await page.getByTestId('ws-create-submit').click()
    await page.waitForURL(/\/worksheets\/[0-9a-f-]+$/, { timeout: 30_000 })
    sheetBase = page.url().split('?')[0]!
    await expect(page.getByTestId('ws-builder')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('bank-search').fill(RUN)
    const add = page.getByTestId('bank-add').first()
    await expect(add).toBeVisible({ timeout: 30_000 })
    await add.click()
    await expect(page.getByTestId('wsb-item')).toHaveCount(1)
    await page.getByTestId('wsb-save').click()
    await expect(page.getByTestId('wsb-notice')).toContainText('Saved.', { timeout: 30_000 })
    await page.getByTestId('wsb-finalize').click()
    await page.getByTestId('wsb-confirm-go').click()
    await expect(page.getByTestId('ws-builder')).toHaveAttribute('data-status', 'FINAL', { timeout: 30_000 })

    await page.goto(`${sheetBase}/print`)
    await expect(page.getByTestId('ws-sheet')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('ws-sheet')).toContainText(PROMPT)
    // The student sheet carries no answer key text.
    await expect(page.getByTestId('ws-sheet')).not.toContainText('Two equal parts make halves.')
    await page.goto(`${sheetBase}/answer-key`)
    await expect(page.getByTestId('ws-key-header')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('ws-sheet')).toContainText('One half')
  })

  await test.step('every teacher call succeeded and nothing logged a schema failure', async () => {
    const failed = teacher.calls.filter(call => call.url.includes('/teaching') && call.status >= 400)
    expect(failed.map(call => `${call.method} ${call.status} ${call.url}`)).toEqual([])
    expect(teacher.problems).toEqual([])
  })
  await teacherContext.close()

  // The teen persona signs in directly; their learn and practice payloads must never carry an answer key.
  const teenContext = await signedInContext(browser, 'teen', TEEN)
  const teen = await teenContext.newPage()
  const learner = watch(teen)
  await test.step('learner payloads carry no answer-key fields', async () => {
    log('teen browses learn and practice')
    // A teen account learns through a profile session: pick the school profile first (DEMO-E flow).
    await teen.goto('/learner', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    const profile = teen.getByRole('button', { name: /Review School A/ })
    if (await profile.waitFor({ timeout: 30_000 }).then(() => true).catch(() => false)) { await profile.click(); await teen.waitForTimeout(3000) }
    for (const route of ['/learn/home', '/learn', '/learn/practice']) {
      await teen.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => undefined)
      await teen.waitForLoadState('networkidle').catch(() => undefined)
    }
    const payloads = learner.calls.filter(call => call.method === 'GET' && call.body && /\/(learn|practice|recall)/.test(call.url))
    expect(payloads.length).toBeGreaterThan(0)
    // The question just published is a draft-free MCQ of the seeded plan; whatever the learner is served, no key fields.
    const leaks = payloads.filter(call => answerKeyFields.test(call.body!))
    expect(leaks.map(call => `${call.method} ${call.url}`)).toEqual([])
    expect(payloads.some(call => call.body!.includes('Two equal parts make halves.') && !/\/(answer|results|summary)/.test(call.url))).toBe(false)
    expect(learner.problems).toEqual([])
  })
  await teenContext.close()
})
