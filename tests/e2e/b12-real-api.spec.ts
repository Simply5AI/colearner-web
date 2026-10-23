import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type Browser, type BrowserContext, type Page, type Response } from '@playwright/test'

/**
 * B12 end to end against the REAL platform API and the running web dev server. Skipped unless B12_REAL_API=1.
 *
 *   B12_REAL_API=1 pnpm exec playwright test -c playwright.b12-real.config.ts
 *
 * Needs the local dev stack (API :3000, web :3001) with the seeded B03 personas from
 * colearner-platform/docs/local-development.md. Every run uses unique titles, so reruns do not collide.
 * Published and assigned plans cannot be deleted through the API, so a run leaves its plan behind.
 */
const enabled = process.env.B12_REAL_API === '1'
const SCHOOL_NAME = 'Review School A'
const PASSWORD = process.env.B12_SEED_PASSWORD ?? 'B03Review!Pass2026'
const TEACHER = process.env.B12_TEACHER_EMAIL ?? 'teacher@b03.example.test'
// The seeded Student (age 8, Class 3) has no login of their own: a guardian sets a picture PIN and the child opens the shared device.
const PARENT = process.env.B12_PARENT_EMAIL ?? 'parent@b03.example.test'
const RUN = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
const PLAN_TITLE = `B12 E2E Fractions ${RUN}`
const MATERIAL_TITLE = `B12 E2E link ${RUN}`
const LESSON_TITLE = `B12 E2E lesson ${RUN}`
const PHASE = `Phase ${RUN}`
const TOPIC = `Topic ${RUN}`

test.skip(!enabled, 'Set B12_REAL_API=1 with the local API (:3000) and web (:3001) running.')

interface Seen { method: string; status: number; url: string; body: string | null }

/** Records every platform call the page makes, so a Zod/shape mismatch shows up as a failed assertion with context. */
function watch(page: Page) {
  const calls: Seen[] = []
  const problems: string[] = []
  page.on('response', async (response: Response) => {
    const url = response.url()
    if (!url.includes('/api/v1/') && !url.includes('/api/learn/') && !url.includes('/api/family-approvals')) return
    let body: string | null = null
    // Only JSON bodies are read; streaming or binary responses would otherwise hold the browser context open.
    if ((response.headers()['content-type'] ?? '').includes('json')) {
      try { body = await response.text() } catch { body = null }
    }
    calls.push({ method: response.request().method(), status: response.status(), url, body })
  })
  page.on('console', message => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (/ZodError|invalid_type|useTeaching must|could not load/i.test(text)) problems.push(text.slice(0, 400))
  })
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`.slice(0, 400)))
  return { calls, problems }
}

const artifacts = process.env.B12_E2E_ARTIFACTS ?? path.join(os.tmpdir(), 'colearner-b12-real-api')

/**
 * Logs in through the real login form. The platform throttles /auth/login per client (a 429 carries Retry-After, about 13 minutes
 * after a handful of attempts), so the signed-in state is also saved and B12_REUSE_AUTH=1 reuses it on a rerun instead of
 * logging in again.
 */
async function signedInContext(browser: Browser, role: 'teacher' | 'student', email: string): Promise<BrowserContext> {
  const stateFile = path.join(artifacts, `auth-${role}.json`)
  if (process.env.B12_REUSE_AUTH === '1' && fs.existsSync(stateFile)) {
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

async function login(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).first().fill(PASSWORD)
  await page.getByRole('button', { name: /log in/i }).first().click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20_000 }).catch(async error => {
    const shown = await page.getByText(/could not sign you in/i).isVisible().catch(() => false)
    throw new Error(shown ? 'Login was refused ("could not sign you in"). The platform throttles /auth/login per client (429, about 13 minutes); wait and rerun, or use B12_REUSE_AUTH=1 for the teacher.' : String(error))
  })
  // The post-login redirect chain can still be in flight; wait for it so the next goto is not aborted.
  await page.waitForLoadState('load')
}

/** goto that survives a post-login redirect still being in flight (the first navigation is then aborted). */
async function open(page: Page, url: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try { await page.goto(url, { waitUntil: 'domcontentloaded' }); return } catch (error) { if (attempt === 3) throw error; await page.waitForTimeout(1000) }
  }
}

async function openSchool(page: Page) {
  // A redirect from the login can still be in flight and abort this navigation once; retry it.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { await page.goto('/workspaces'); break } catch (error) { if (attempt === 2) throw error }
  }
  const row = page.getByText(SCHOOL_NAME, { exact: true }).locator('xpath=ancestor::*[.//button[normalize-space()="Open workspace"]][1]')
  await row.getByRole('button', { name: 'Open workspace' }).click()
  await page.waitForURL(/\/org\/[0-9a-f-]+\//, { timeout: 45_000 })
}

const log = (message: string) => console.log(`[b12-e2e] ${new Date().toISOString().slice(11, 19)} ${message}`)

test.describe.configure({ mode: 'serial' })

test('B12 teacher authoring to learner reading on the real API', async ({ browser }) => {
  const teacherContext = await signedInContext(browser, 'teacher', TEACHER)
  const page = await teacherContext.newPage()
  const teacher = watch(page)

  await test.step('teacher logs in and picks the school; the classroom page links to the teacher workspace', async () => {
    log('teacher logs in and picks the school; the classroom page links to the teacher workspace')
    await openSchool(page)
    await expect(page.getByRole('link', { name: 'Open teacher dashboard' })).toHaveAttribute('href', '/teacher/dashboard')
    await expect(page.getByRole('link', { name: 'Open my plans' })).toHaveAttribute('href', '/teacher/plans')
    await expect(page.getByText('follows in the teacher rollout')).toHaveCount(0)
  })

  await test.step('dashboard loads from /teaching/dashboard', async () => {
    log('dashboard loads from /teaching/dashboard')
    await page.getByRole('link', { name: 'Open teacher dashboard' }).click()
    await expect(page).toHaveURL(/\/teacher\/dashboard/)
    await expect(page.getByText('Hello, Review teacher')).toBeVisible()
    await expect(page.getByText('This view could not load')).toHaveCount(0)
    await expect(page.getByTestId('t1-classes').getByText('Class 3 B03')).toBeVisible()
  })

  await test.step('plans list shows the two seeded published plans', async () => {
    log('plans list shows the two seeded published plans')
    await page.goto('/teacher/plans')
    await expect(page.getByTestId('plans-screen')).toBeVisible()
    await expect(page.getByText('This view could not load')).toHaveCount(0)
    await expect(page.getByText('Dev Mathematics - Grade 3')).toBeVisible()
    await expect(page.getByText('Dev Science - Grade 10')).toBeVisible()
  })

  let planUrl = ''
  await test.step('creates a plan from scratch for Class 3 Mathematics', async () => {
    log('creates a plan from scratch for Class 3 Mathematics')
    await page.getByTestId('new-plan').click()
    const dialog = page.getByTestId('new-plan-dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Plan title').fill(PLAN_TITLE)
    await dialog.getByTestId('field-class').selectOption({ label: 'Class 3 B03' })
    await dialog.getByTestId('field-subject').selectOption('Mathematics')
    await dialog.getByTestId('create-plan').click()
    await page.waitForURL(/\/teacher\/plans\/[0-9a-f-]+/, { timeout: 45_000 })
    planUrl = page.url().split('?')[0]!
    await expect(page.getByTestId('plan-title')).toHaveText(PLAN_TITLE)
    await expect(page.getByTestId('plan-workspace')).toHaveAttribute('data-plan-status', 'DRAFT')
  })

  await test.step('edits the tree: adds a phase and a topic', async () => {
    log('edits the tree: adds a phase and a topic')
    await page.getByRole('button', { name: 'Add phase' }).click()
    await page.getByLabel('New phase name').fill(PHASE)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('[data-testid="tree-node"][data-kind="module"]').filter({ hasText: PHASE })).toBeVisible()
    await expect(page.getByTestId('plan-failure')).toHaveCount(0)
    await page.getByRole('button', { name: 'Add Topic' }).or(page.getByRole('button', { name: /^Add (topic|Topic)$/ })).first().click()
    await page.getByLabel('New topic name').fill(TOPIC)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('[data-testid="tree-node"][data-kind="topic"]').filter({ hasText: TOPIC })).toBeVisible()
    await expect(page.getByTestId('plan-failure')).toHaveCount(0)
    await expect(page.getByTestId('topic-workspace')).toBeVisible({ timeout: 30_000 })
  })

  await test.step('adds an https link material', async () => {
    log('adds an https link material')
    await page.getByTestId('topic-tab-material').click()
    await page.getByTestId('material-mode-link').click()
    await page.getByLabel('Link', { exact: true }).fill('https://example.org/fractions-intro')
    await page.getByLabel('Title', { exact: true }).fill(MATERIAL_TITLE)
    await page.getByTestId('add-material-submit').click()
    await expect(page.getByTestId('materials-panel').getByText(MATERIAL_TITLE).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('add-material-failure')).toHaveCount(0)
  })

  await test.step('writes and saves a lesson draft', async () => {
    log('writes and saves a lesson draft')
    await page.getByTestId('topic-tab-lesson').click()
    await page.getByTestId('start-lesson').click()
    await page.getByLabel('Lesson title', { exact: true }).fill(LESSON_TITLE)
    await page.getByRole('textbox', { name: 'Objective 1' }).fill('Name the parts of a fraction.')
    await page.getByLabel('Step title', { exact: true }).first().fill('Parts of a fraction')
    await page.getByLabel('Text', { exact: true }).first().fill('A fraction has a top number. It also has a bottom number.')
    // A check step makes the answer key part of the lesson, so the learner payload below is a real test of it.
    await page.getByLabel('New step', { exact: true }).selectOption('CHECK')
    await page.getByTestId('add-step').click()
    await page.getByLabel('Step title', { exact: true }).first().fill('Check the parts')
    await page.getByLabel('Question', { exact: true }).fill('Which number is on the top of a fraction?')
    await page.getByLabel('Answer 1', { exact: true }).fill('The numerator')
    await page.getByLabel('Feedback for answer 1').fill('Yes, the top number is the numerator.')
    await page.getByLabel('Answer 2', { exact: true }).fill('The denominator')
    await page.getByLabel('Feedback for answer 2').fill('The denominator is the bottom number.')
    await expect(page.getByTestId('save-status')).toContainText(/Saved/, { timeout: 30_000 })
    await expect(page.getByTestId('lesson-save-error')).toHaveCount(0)
  })

  await test.step('previews the lesson in a band', async () => {
    log('previews the lesson in a band')
    await page.getByTestId('open-preview').click()
    await expect(page.getByTestId('lesson-preview')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('preview-error')).toHaveCount(0)
    await page.getByTestId('preview-band-6-9').click()
    await expect(page.getByTestId('lesson-preview')).toContainText('Parts of a fraction')
    await expect(page.getByTestId('preview-error')).toHaveCount(0)
  })

  await test.step('publishes the plan', async () => {
    log('publishes the plan')
    await page.getByTestId('review-publish').click()
    await expect(page.getByTestId('publish-dialog')).toBeVisible()
    await page.getByTestId('confirm-publish').click()
    await expect(page.getByTestId('publish-success')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('publish-dialog').getByRole('button', { name: 'Done' }).click()
    await expect(page.getByTestId('plan-workspace')).toHaveAttribute('data-plan-status', 'PUBLISHED')
  })

  await test.step('publishes the lesson', async () => {
    log('publishes the lesson')
    await page.getByTestId('topic-tab-lesson').click()
    // After the plan publish the tab may show the saved draft in the editor again.
    await page.getByTestId('publish-lesson').click()
    await expect(page.getByTestId('lesson-publish-dialog')).toBeVisible()
    await page.getByTestId('confirm-publish-lesson').click()
    await expect(page.getByTestId('lesson-notice')).toContainText(/Lesson published|already published/, { timeout: 30_000 })
    await expect(page.getByTestId('lesson-published-card')).toBeVisible({ timeout: 30_000 })
  })

  await test.step('assigns the plan to Class 3', async () => {
    log('assigns the plan to Class 3')
    await page.getByTestId('open-assign').click()
    const panel = page.getByTestId('assign-panel')
    await expect(panel).toBeVisible()
    await expect(page.getByTestId('assign-blocked')).toHaveCount(0)
    await panel.getByTestId('assign-class').selectOption({ label: 'Class 3 B03' })
    await panel.getByTestId('assign-submit').click()
    await expect(page.getByTestId('assign-notice')).toContainText(/Assigned to|already had/, { timeout: 30_000 })
    await expect(page.getByTestId('assign-failure')).toHaveCount(0)
    await expect(page.getByTestId('assign-latest')).toBeVisible()
  })

  await test.step('the teacher calls all succeeded and nothing logged a schema failure', async () => {
    log('the teacher calls all succeeded and nothing logged a schema failure')
    const failed = teacher.calls.filter(call => call.url.includes('/teaching') && call.status >= 400)
    expect(failed.map(call => `${call.method} ${call.status} ${call.url}`)).toEqual([])
    expect(teacher.problems).toEqual([])
    expect(planUrl).toMatch(/\/teacher\/plans\//)
  })
  await teacherContext.close()

  // Learner side
  const studentContext = await browser.newContext()
  const student = await studentContext.newPage()
  const learner = watch(student)

  // B12A: the assigned minor is held at PENDING_GUARDIAN_APPROVAL until a verified guardian decides. The parent signs in once per run
  // (the shared-device enrolment below revokes the adult session, so a saved parent state cannot be reused).
  await test.step('the parent finds the pending request at /family/approvals', async () => {
    log('parent signs in and finds the pending request at /family/approvals')
    await login(student, PARENT)
    await open(student, '/family')
    await expect(student.getByTestId('approvals-entry')).toHaveAttribute('href', '/family/approvals')
    await open(student, '/family/approvals')
    const card = student.getByTestId('approval-card').filter({ hasText: PLAN_TITLE })
    await expect(card).toBeVisible({ timeout: 45_000 })
    await expect(card).toContainText('Student')
    await expect(card).toContainText('Review teacher')
    await expect(card).toContainText('What the teacher will not see')
  })

  await test.step('parent approves the request; it moves to History as Approved', async () => {
    log('parent approves the request')
    const card = student.getByTestId('approval-card').filter({ hasText: PLAN_TITLE })
    await card.getByRole('button', { name: `Approve ${PLAN_TITLE} for Student` }).click()
    await student.getByRole('button', { name: 'Yes, approve' }).click()
    await expect(student.getByTestId('approval-notice')).toContainText(/Approved\./, { timeout: 30_000 })
    await student.getByRole('tab', { name: 'History' }).click()
    await expect(student.getByTestId('approval-card').filter({ hasText: PLAN_TITLE })).toHaveAttribute('data-state', 'APPROVED', { timeout: 30_000 })
    expect(learner.calls.filter(call => call.url.includes('/api/family-approvals') && call.status >= 400).map(call => `${call.method} ${call.status} ${call.url}`)).toEqual([])
    expect(learner.problems).toEqual([])
  })

  await test.step('guardian sets the picture PIN and the child opens the shared device', async () => {
    log('guardian sets the picture PIN and the child opens the shared device')
    await open(student, '/family')
    await student.getByRole('button', { name: /^Student · Review School A/ }).click()
    const pinCard = student.getByRole('heading', { name: 'Set or reset the picture PIN' }).locator('xpath=ancestor::*[.//button[normalize-space()="Save new picture PIN"]][1]')
    for (const picture of ['Star', 'Rocket', 'Apple']) await pinCard.getByRole('button', { name: picture, exact: true }).click()
    await pinCard.getByLabel('Your adult password to change this PIN').fill(PASSWORD)
    await pinCard.getByRole('button', { name: 'Save new picture PIN' }).click()
    await expect(pinCard.getByRole('status', { name: '0 of 3 pictures selected' })).toBeVisible({ timeout: 30_000 })
    await open(student, '/profiles')
    await student.getByLabel('Your adult password to enroll this device').fill(PASSWORD)
    await student.getByRole('button', { name: 'Enroll device and sign out adult' }).click()
    await student.getByRole('button', { name: /^Student/ }).click()
    for (const picture of ['Star', 'Rocket', 'Apple']) await student.getByRole('button', { name: picture, exact: true }).click()
    await student.getByRole('button', { name: 'Open my profile', exact: true }).click()
    await expect(student).toHaveURL(/\/learner/, { timeout: 30_000 })
  })

  await test.step('the approved plan opens for the student, with the teacher lesson and its check', async () => {
    log('the student opens the approved plan, the teacher lesson and answers the check')
    await student.goto('/learn', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(student).toHaveURL(/\/learn$/)
    // The first dev compile of a learner route can answer once with the generic error page; a reload recovers.
    if (await student.getByText('Something went wrong').isVisible().catch(() => false)) await student.reload({ waitUntil: 'domcontentloaded' })
    await expect(student.getByText(PLAN_TITLE).first()).toBeVisible({ timeout: 45_000 })
    // Older runs leave other plans waiting in the dev DB, so only this run's plan is asserted to have left the waiting list.
    await expect(student.getByTestId('pending-enrollment').filter({ hasText: PLAN_TITLE })).toHaveCount(0)
    await student.getByRole('link', { name: `Open ${PLAN_TITLE}` }).click()
    await expect(student).toHaveURL(/\/learn\/plans\/[0-9a-f-]+/, { timeout: 30_000 })
    await expect(student.getByText(PLAN_TITLE).first()).toBeVisible({ timeout: 30_000 })
    await student.getByRole('button', { name: new RegExp(TOPIC) }).first().click()
    await student.getByTestId('teacher-lesson-link').getByRole('button', { name: /Open (the )?lesson/ }).click()
    const lesson = student.getByTestId('teacher-lesson')
    await expect(lesson).toBeVisible({ timeout: 30_000 })
    await expect(lesson.getByTestId('from-teacher')).toBeVisible()
    // Before any correct check, the teacher-lesson JSON carries no answer-key fields.
    const beforeCheck = learner.calls.filter(call => call.method === 'GET' && /\/teacher-lesson$/.test(call.url))
    expect(beforeCheck.length).toBeGreaterThan(0)
    for (const call of beforeCheck) expect(call.body, call.url).not.toMatch(/correctOptionId|isCorrect|"correct"|answerKey|"answer"/i)
    const check = lesson.getByTestId('lesson-check')
    for (let step = 0; step < 4 && !(await check.isVisible()); step += 1) await lesson.getByTestId('lesson-next').click()
    await check.getByRole('radio', { name: 'The numerator' }).check()
    await check.getByRole('button', { name: 'Check my answer' }).click()
    await expect(check.getByTestId('check-result')).toHaveAttribute('data-correct', 'true', { timeout: 30_000 })
    const checks = learner.calls.filter(call => call.method === 'POST' && /\/teacher-lesson\/check$/.test(call.url))
    expect(checks.map(call => call.status)).toEqual([200])
  })

  await test.step('no answer key is present in any learner response', async () => {
    log('no answer key is present in any learner response')
    expect(learner.problems).toEqual([])
    const bodies = learner.calls.filter(call => call.body && /\/api\/learn\//.test(call.url))
    expect(bodies.length).toBeGreaterThan(0)
    expect(learner.calls.filter(call => call.status >= 500).map(call => `${call.status} ${call.url}`)).toEqual([])
    // The check result (after the learner answered) legitimately says whether the answer was correct; every other payload must not.
    for (const call of bodies.filter(call => !/\/teacher-lesson\/check$/.test(call.url))) {
      expect(call.body, `${call.method} ${call.url}`).not.toMatch(/correctOptionId|isCorrect|"correct"|answerKey|"answer"/i)
    }
  })
  await studentContext.close()
})
