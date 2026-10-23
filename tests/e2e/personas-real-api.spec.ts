import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type Browser, type BrowserContext, type Page, type Response } from '@playwright/test'

/**
 * Persona matrix against the REAL platform API and the running web dev server. Skipped unless PERSONAS_REAL_API=1.
 *
 *   PERSONAS_REAL_API=1 pnpm exec playwright test -c playwright.personas-real.config.ts
 *
 * Needs the local dev stack (API :3000, web :3001) with the seeded B03 personas (colearner-platform/docs/local-development.md),
 * and LOGIN_THROTTLE_LIMIT raised in the API .env (default 5 logins / 15 min). Every persona gets a fresh browser context and a fresh login.
 * Each screen is recorded as PASS / UNAVAILABLE(AI) / BLOCKED(reason) / FAIL in <artifacts>/matrix.json; failures do not stop the persona,
 * they are collected and asserted at the end of each test.
 *
 * Teen invitation (teeninvite): the flow runs only while the invitee is unclaimed. Mail is read from a local Mailpit
 * (PERSONAS_MAILPIT_URL, default http://127.0.0.1:8025; API .env DEV_MAIL_SINK_URL=http://127.0.0.1:8025). To re-arm it for another run:
 *   update child_profiles set learner_id=null where nickname='Invitee';
 *   update school_student_records set membership_id=null where id in (select student_record_id from child_profiles where nickname='Invitee');
 *   delete from school_memberships where user_id=(select id from users where email='teeninvite@b03.example.test');
 *   update users set date_of_birth=null where email='teeninvite@b03.example.test';
 */
const enabled = process.env.PERSONAS_REAL_API === '1'
const PASSWORD = process.env.PERSONAS_SEED_PASSWORD ?? 'B03Review!Pass2026'
const DOMAIN = 'b03.example.test'
const SCHOOL_NAME = 'Review School A'
const SCHOOL_A = process.env.PERSONAS_SCHOOL_ID ?? '4c657397-67c3-4325-b30c-787ebeb7d547'
const MAILPIT = process.env.PERSONAS_MAILPIT_URL ?? 'http://127.0.0.1:8025'
const artifacts = process.env.PERSONAS_E2E_ARTIFACTS ?? path.join(os.tmpdir(), 'colearner-personas-real-api')

test.skip(!enabled, 'Set PERSONAS_REAL_API=1 with the local API (:3000) and web (:3001) running.')

type Result = 'PASS' | 'UNAVAILABLE(AI)' | 'FAIL' | string
interface Row { persona: string; screen: string; result: Result; note: string }
const matrix: Row[] = []
const rec = (persona: string, screen: string, result: Result, note = '') => { matrix.push({ persona, screen, result, note }); console.log(`[persona] ${persona.padEnd(10)} ${result.padEnd(16)} ${screen}${note ? ` - ${note}` : ''}`) }

test.afterAll(() => {
  fs.mkdirSync(artifacts, { recursive: true })
  fs.writeFileSync(path.join(artifacts, 'matrix.json'), JSON.stringify(matrix, null, 2))
})

const ERROR_TEXT = /Something went wrong|This view could not load|Application error|Unhandled Runtime Error|Internal Server Error/i
/** 4xx answers that are part of normal operation (a probe for a child session that does not exist, and so on). */
const EXPECTED_4XX = [/\/api\/family-access\/child$/, /\/api\/family-access\/profiles$/]

function watch(page: Page) {
  let seen: string[] = []
  page.on('response', (response: Response) => {
    const url = response.url()
    if (!/\/api\//.test(url) || response.status() < 400) return
    if (EXPECTED_4XX.some(pattern => pattern.test(url.split('?')[0]!))) return
    seen.push(`${response.status()} ${response.request().method()} ${url.replace(/^https?:\/\/[^/]+/, '')}`)
  })
  page.on('pageerror', error => seen.push(`pageerror ${error.message.slice(0, 160)}`))
  return { drain: () => { const out = seen; seen = []; return out } }
}

/** Runs one screen check. Records the outcome and keeps going; the caller asserts the failure list at the end. */
async function screen(failures: string[], page: Page, persona: string, name: string, fn: () => Promise<Result | void>, opts: { allow?: RegExp } = {}) {
  const watcher = (page as Page & { __w?: ReturnType<typeof watch> }).__w ?? ((page as Page & { __w?: ReturnType<typeof watch> }).__w = watch(page))
  watcher.drain()
  try {
    const result = (await fn()) ?? 'PASS'
    const body = (await page.locator('body').innerText().catch(() => '')).slice(0, 4000)
    if (ERROR_TEXT.test(body) && !opts.allow) throw new Error(`error text on page: ${body.match(ERROR_TEXT)![0]}`)
    const bad = watcher.drain().filter(entry => !(opts.allow && opts.allow.test(entry)))
    if (bad.length) throw new Error(`unexpected API answers: ${bad.slice(0, 4).join(' | ')}`)
    rec(persona, name, result)
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).split('\n')[0]!.slice(0, 300)
    failures.push(`${persona}: ${name}: ${message}`)
    rec(persona, name, 'FAIL', message)
  }
}

async function open(page: Page, url: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 }); break } catch (error) { if (attempt === 3) throw error; await page.waitForTimeout(1000) }
  }
  // The first dev compile of a route can answer once with the generic error page; one reload recovers.
  if (await page.getByText('Something went wrong').isVisible().catch(() => false)) await page.reload({ waitUntil: 'domcontentloaded' })
}

async function login(browser: Browser, persona: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(`${persona}@${DOMAIN}`)
  await page.getByLabel(/password/i).first().fill(PASSWORD)
  await page.getByRole('button', { name: /log in/i }).first().click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 30_000 }).catch(async error => {
    const shown = await page.getByText(/could not sign you in|too many sign-in/i).isVisible().catch(() => false)
    throw new Error(shown ? 'Login refused (throttled?). Raise LOGIN_THROTTLE_LIMIT in the API .env and restart the API.' : String(error))
  })
  await page.waitForLoadState('load')
  return { context, page }
}

async function expectSignedInAs(page: Page, persona: string) {
  await open(page, '/workspaces')
  await expect(page.getByTestId('signed-in-email')).toHaveText(`${persona}@${DOMAIN}`)
}

async function openSchool(page: Page) {
  await open(page, '/workspaces')
  const row = page.getByText(SCHOOL_NAME, { exact: true }).locator('xpath=ancestor::*[.//button[normalize-space()="Open workspace"]][1]')
  await row.getByRole('button', { name: 'Open workspace' }).click()
  await page.waitForURL(/\/org\/[0-9a-f-]+\//, { timeout: 45_000 })
}

const visible = async (page: Page, text: string | RegExp, timeout = 25_000) => expect(page.locator('body')).toContainText(text, { timeout })

/** Learner surfaces shared by the shared-device student (under 14) and the self-service teen (14-17). */
async function learnerSurfaces(failures: string[], page: Page, persona: string, opts: { csv: 'allowed' | 'denied' }) {
  await screen(failures, page, persona, '/learn/home', async () => { await open(page, '/learn/home'); await expect(page).toHaveURL(/\/learn\/home/); await visible(page, /Home for |Today.s plan|Assigned to you/) })
  await screen(failures, page, persona, '/learn (overview)', async () => { await open(page, '/learn'); await expect(page).toHaveURL(/\/learn$/); await visible(page, /Your own plans and plans from your teachers|Learn/) })
  await screen(failures, page, persona, 'assigned plan page (B07)', async () => {
    await open(page, '/learn/home')
    const link = page.getByRole('link', { name: /Open assignment|Open /i }).first()
    await expect(link).toBeVisible({ timeout: 25_000 })
    await link.click()
    await expect(page).toHaveURL(/\/learn\/plans\//, { timeout: 30_000 })
    await visible(page, /Chapters|Set by your teacher|Start next/)
  })
  await screen(failures, page, persona, 'library / import / snap (B06)', async () => {
    await open(page, '/learn/library'); await visible(page, /Your library/)
    await open(page, '/learn/import'); await visible(page, /What do you want to learn/)
    await open(page, '/learn/snap'); await visible(page, /Show Co your page/)
    return 'PASS'
  })
  await screen(failures, page, persona, 'material import (analysis)', async () => {
    await open(page, '/learn/import')
    await visible(page, /Material analysis is currently unavailable|Paste text/)
    return (await page.getByText('Material analysis is currently unavailable').count()) > 0 ? 'UNAVAILABLE(AI)' : 'PASS'
  })
  await screen(failures, page, persona, 'practice session to summary (B09)', async () => {
    await open(page, '/learn/practice')
    await expect(page.getByText('Set by your teacher')).toBeVisible({ timeout: 25_000 })
    await page.getByRole('link', { name: /Practise/ }).first().click().catch(() => page.getByRole('button', { name: /^Practise/ }).first().click())
    await expect(page).toHaveURL(/\/learn\/practice\/session\//, { timeout: 45_000 })
    for (let step = 0; step < 24; step += 1) {
      if (/\/summary\//.test(page.url())) break
      await page.waitForTimeout(700)
      const radios = page.getByRole('radio')
      if (await radios.count()) {
        const index = step % (await radios.count())
        await radios.nth(index).check().catch(() => radios.nth(index).click())
      }
      const button = page.getByRole('button', { name: /Check my answer|Next question|Next|See my results|Finish|Continue|Try again/ }).first()
      if (await button.count()) await button.click().catch(() => undefined)
      else { const skip = page.getByRole('button', { name: /Skip for now/ }); if (await skip.count()) await skip.click().catch(() => undefined) }
    }
    await expect(page).toHaveURL(/\/learn\/practice\/(summary|answer-sheet)\//, { timeout: 45_000 })
  })
  await screen(failures, page, persona, 'teach-back (B11)', async () => {
    await open(page, '/learn/teach')
    await visible(page, /Choose something to teach|Teach it back|Teach Co/)
    return (await page.getByText('Open a page from your library first').count()) > 0 ? 'UNAVAILABLE(AI)' : 'PASS'
  })
  await screen(failures, page, persona, '/learn/progress (B11)', async () => { await open(page, '/learn/progress'); await visible(page, /progress|Progress/) })
  await screen(failures, page, persona, `progress CSV export (${opts.csv})`, async () => {
    const response = await page.request.get('/api/learn/progress/export.csv')
    if (opts.csv === 'allowed') { expect(response.status()).toBe(200); expect(await response.text()).toContain('subject,concept,mastery') } else expect([401, 403, 404]).toContain(response.status())
  }, { allow: /export\.csv/ })
  await screen(failures, page, persona, 'homework help / Ask Co (B10)', async () => {
    await open(page, '/learn/homework')
    await visible(page, /Homework help/)
    await page.getByRole('textbox').first().fill('What is 15 x 4?')
    await page.getByRole('button', { name: /Help me with this/ }).click()
    await expect(page).toHaveURL(/\/learn\/homework\/[0-9a-f-]+/, { timeout: 30_000 })
    const state = page.locator('[data-state]').filter({ has: page.locator('h2') }).first()
    await expect(page.locator('body')).toContainText(/Co is thinking|Problem|Co could not finish|unavailable/i, { timeout: 30_000 })
    void state
    // The AI worker is not provisioned in the dev stack: Co stays at "thinking" (no error page, no crash, place saved).
    return (await page.getByText('Co is thinking').count()) > 0 ? 'UNAVAILABLE(AI)' : 'PASS'
  })
}

test.describe.configure({ mode: 'serial' })

test('admin: school workspace, denied areas, clean account switch', async ({ browser }) => {
  const failures: string[] = []
  const { context, page } = await login(browser, 'admin')
  await screen(failures, page, 'admin', '/workspaces shows who is signed in', async () => { await expectSignedInAs(page, 'admin'); await visible(page, 'School administrator') })
  await screen(failures, page, 'admin', 'open workspace -> /org/<school>/academics', async () => { await openSchool(page); await expect(page).toHaveURL(new RegExp(`/org/${SCHOOL_A}/academics`)); await visible(page, 'Academic structure') })
  await screen(failures, page, 'admin', 'students & guardians', async () => { await open(page, `/org/${SCHOOL_A}/students`); await visible(page, 'Students & guardian links') })
  await screen(failures, page, 'admin', 'teachers & staff (class assignments)', async () => { await open(page, `/org/${SCHOOL_A}/staff`); await visible(page, 'Teachers & staff'); await visible(page, /assign/i) })
  await screen(failures, page, 'admin', 'curriculum & subject mapping (class assignments)', async () => { await open(page, `/org/${SCHOOL_A}/curriculum`); await visible(page, 'Curriculum & subject mapping') })
  await screen(failures, page, 'admin', 'learning & AI policies', async () => { await open(page, `/org/${SCHOOL_A}/policies`); await visible(page, 'Learning & AI policies') })
  await screen(failures, page, 'admin', 'denied: teacher drafts (/teacher/plans)', async () => { await open(page, '/teacher/plans'); await expect(page).toHaveURL(/\/workspaces\?denied=1/); await expect(page.getByTestId('access-denied')).toBeVisible() })
  await screen(failures, page, 'admin', 'denied: teacher classroom page', async () => { await open(page, `/org/${SCHOOL_A}/classroom`); await expect(page).toHaveURL(/\/workspaces\?denied=1/) })
  await screen(failures, page, 'admin', 'sign out clears workspace selection; teacher login is not the admin', async () => {
    await open(page, '/workspaces')
    await page.getByRole('button', { name: /Sign out \/ switch account/ }).click()
    await page.waitForURL(/\/login/, { timeout: 30_000 })
    expect((await context.cookies()).some(cookie => cookie.name === 'colearner-school-membership')).toBe(false)
    await page.getByLabel(/email/i).fill(`teacher@${DOMAIN}`)
    await page.getByLabel(/password/i).first().fill(PASSWORD)
    await page.getByRole('button', { name: /log in/i }).first().click()
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 30_000 }); await page.waitForLoadState('load')
    await expectSignedInAs(page, 'teacher')
    await open(page, `/org/${SCHOOL_A}/academics`)
    await expect(page).toHaveURL(/\/workspaces/)
    await expect(page).not.toHaveURL(/\/academics/)
  })
  await context.close()
  expect(failures).toEqual([])
})

test('teacher: dashboard, onboarding, plans, editor, legacy pages', async ({ browser }) => {
  const failures: string[] = []
  const { context, page } = await login(browser, 'teacher')
  await screen(failures, page, 'teacher', '/workspaces + open School A', async () => { await expectSignedInAs(page, 'teacher'); await openSchool(page); await expect(page).toHaveURL(/\/classroom/); await visible(page, 'My school teaching assignments') })
  await screen(failures, page, 'teacher', 'dashboard (B12)', async () => { await open(page, '/teacher/dashboard'); await visible(page, 'Hello, Review teacher'); await visible(page, 'Class 3 B03') })
  await screen(failures, page, 'teacher', 'onboarding', async () => { await open(page, '/teacher/onboarding'); await visible(page, 'Set up your classroom') })
  await screen(failures, page, 'teacher', 'plans list', async () => { await open(page, '/teacher/plans'); await expect(page.getByTestId('plans-screen')).toBeVisible({ timeout: 30_000 }); await visible(page, 'Dev Science - Grade 10') })
  await screen(failures, page, 'teacher', 'plan editor + topic + lesson tab + assign panel', async () => {
    await open(page, '/teacher/plans')
    await page.getByText('Dev Science - Grade 10').first().click()
    await expect(page).toHaveURL(/\/teacher\/plans\/[0-9a-f-]+/, { timeout: 45_000 })
    await expect(page.getByTestId('plan-workspace')).toBeVisible({ timeout: 30_000 })
    await page.locator('[data-testid="tree-node"][data-kind="topic"]').first().click()
    await expect(page.getByTestId('topic-workspace')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('topic-tab-lesson').click()
    await page.getByTestId('topic-tab-material').click()
    await page.getByTestId('open-assign').click()
    await expect(page.getByTestId('assign-panel')).toBeVisible()
  })
  await screen(failures, page, 'teacher', 'legacy /teacher/students (later-release state)', async () => { await open(page, '/teacher/students'); await visible(page, /not available for school teacher accounts yet|Enrollment roster/) })
  await screen(failures, page, 'teacher', 'legacy /teacher/analytics (later-release state)', async () => { await open(page, '/teacher/analytics'); await visible(page, /not available for school teacher accounts yet|Analytics/) })
  await screen(failures, page, 'teacher', 'denied: school academics (admin only)', async () => { await open(page, `/org/${SCHOOL_A}/academics`); await expect(page).toHaveURL(/\/workspaces\?denied=1/) })
  rec('teacher', 'authoring -> publish lesson -> assign to class (B12)', 'PASS', 'covered end to end by tests/e2e/b12-real-api.spec.ts (B12_REAL_API=1)')
  await context.close()
  expect(failures).toEqual([])
})

test('parent: family, approvals, picture PIN, shared device, then the under-14 student on that device', async ({ browser }) => {
  test.setTimeout(600_000)
  const failures: string[] = []
  const { context, page } = await login(browser, 'parent')
  await screen(failures, page, 'parent', '/workspaces shows who is signed in', async () => { await expectSignedInAs(page, 'parent'); await visible(page, 'Parent / guardian') })
  await screen(failures, page, 'parent', '/family overview lists the children', async () => { await open(page, '/family'); await visible(page, 'Your verified family'); await visible(page, 'Student · Review School A'); await visible(page, 'Teen · Review School A') })
  await screen(failures, page, 'parent', 'child: consent, policy/controls, conversations (under 14)', async () => {
    await open(page, '/family')
    await page.getByRole('button', { name: /^Student · Review School A/ }).click()
    await visible(page, 'Consent is current.')
    await visible(page, /Chats with Co/)
    await visible(page, 'Set or reset the picture PIN')
    await visible(page, /minutes|Daily|daily/)
  })
  await screen(failures, page, 'parent', 'teen: parent sees summaries and safety access only', async () => {
    await open(page, '/family')
    await page.getByRole('button', { name: /^Teen · Review School A/ }).click()
    await visible(page, 'Chats with Co: summaries & safety access')
    await visible(page, /summaries and safety alerts only|Summary access applies/)
    await expect(page.getByTestId('teen-login-invite')).toBeVisible()
  })
  let approvedTitle = ''
  await screen(failures, page, 'parent', '/family/approvals pending list + approve', async () => {
    await open(page, '/family/approvals')
    const cards = page.getByTestId('approval-card')
    await expect(cards.first()).toBeVisible({ timeout: 45_000 })
    const approve = page.getByRole('button', { name: /^Approve .* for Student$/ }).first()
    if (!(await approve.count())) throw new Error('BLOCKED: no pending approval for Student; run tests/e2e/b12-real-api.spec.ts first')
    approvedTitle = ((await approve.getAttribute('aria-label')) ?? '').replace(/^Approve /, '').replace(/ for Student$/, '')
    await approve.click()
    await page.getByRole('button', { name: 'Yes, approve' }).click()
    await expect(page.getByTestId('approval-notice')).toContainText(/Approved\./, { timeout: 30_000 })
  })
  await screen(failures, page, 'parent', 'approvals: decline a second pending request', async () => {
    await open(page, '/family/approvals')
    const decline = page.getByRole('button', { name: /^Decline .* for / }).first()
    if (!(await decline.count())) return 'BLOCKED(no second pending request to decline)'
    await decline.click(); await page.getByRole('button', { name: 'Yes, decline' }).click()
    await expect(page.getByTestId('approval-notice')).toContainText(/Declined\./, { timeout: 30_000 })
    return 'PASS'
  })
  await screen(failures, page, 'parent', 'approvals: history + revoke an older approval', async () => {
    await open(page, '/family/approvals')
    await page.getByRole('tab', { name: 'History' }).click()
    await expect(page.getByTestId('approval-card').first()).toBeVisible({ timeout: 30_000 })
    const revoke = page.getByRole('button', { name: /^Remove access .* for / })
    let target = -1
    const total = await revoke.count()
    for (let i = 0; i < total; i += 1) if (!((await revoke.nth(i).getAttribute('aria-label')) ?? '').includes(approvedTitle)) { target = i; break }
    if (target < 0) return 'BLOCKED(no older approved request to revoke)'
    await revoke.nth(target).click(); await page.getByRole('button', { name: 'Yes, remove access now' }).click()
    await expect(page.getByTestId('approval-notice')).toContainText(/Access removed\./, { timeout: 30_000 })
    return 'PASS'
  })
  await screen(failures, page, 'parent', 'denied: /learn and /teacher/plans', async () => {
    await open(page, '/teacher/plans'); await expect(page).toHaveURL(/\/workspaces\?denied=1/)
    await open(page, '/learn'); await visible(page, /cannot open this|permitted/i)
  }, { allow: /\/api\/learn\// })
  await screen(failures, page, 'parent', 'picture PIN for Student, then enrol this shared device', async () => {
    await open(page, '/family')
    await page.getByRole('button', { name: /^Student · Review School A/ }).click()
    const pinCard = page.getByRole('heading', { name: 'Set or reset the picture PIN' }).locator('xpath=ancestor::*[.//button[normalize-space()="Save new picture PIN"]][1]')
    for (const picture of ['Star', 'Rocket', 'Apple']) await pinCard.getByRole('button', { name: picture, exact: true }).click()
    await pinCard.getByLabel('Your adult password to change this PIN').fill(PASSWORD)
    await pinCard.getByRole('button', { name: 'Save new picture PIN' }).click()
    await expect(pinCard.getByRole('status', { name: '0 of 3 pictures selected' })).toBeVisible({ timeout: 30_000 })
    await open(page, '/profiles')
    await page.getByLabel('Your adult password to enroll this device').fill(PASSWORD)
    await page.getByRole('button', { name: 'Enroll device and sign out adult' }).click()
    await page.getByRole('button', { name: /^Student/ }).click()
    for (const picture of ['Star', 'Rocket', 'Apple']) await page.getByRole('button', { name: picture, exact: true }).click()
    await page.getByRole('button', { name: 'Open my profile', exact: true }).click()
    await expect(page).toHaveURL(/\/learner/, { timeout: 30_000 })
  })
  await screen(failures, page, 'student', '/learner as the child (shared device)', async () => { await visible(page, 'Hello, Student') })
  await learnerSurfaces(failures, page, 'student', { csv: 'denied' })
  await context.close()

  // The same under-14 student signing in directly with their own account.
  const direct = await login(browser, 'student')
  await screen(failures, direct.page, 'student', 'direct login: lands on a clear "learn on your grown-up\'s device" screen', async () => {
    await open(direct.page, '/learner')
    await expect(direct.page.getByTestId('shared-device-only')).toBeVisible({ timeout: 25_000 })
    await visible(direct.page, 'You learn on your grown-up’s device')
    await visible(direct.page, /picture PIN/)
    await expect(direct.page.getByTestId('signed-in-email')).toHaveText(`student@${DOMAIN}`)
  })
  await screen(failures, direct.page, 'student', 'direct login: /learn/home does not self-serve (under-14 rule kept)', async () => {
    await open(direct.page, '/learn/home'); await expect(direct.page).toHaveURL(/\/learner/)
    await expect(direct.page.getByTestId('shared-device-only')).toBeVisible()
  })
  await screen(failures, direct.page, 'student', 'direct login: no dead end (sign out / switch account works)', async () => {
    await direct.page.getByRole('button', { name: /Sign out \/ switch account/ }).click()
    await direct.page.waitForURL(/\/login/, { timeout: 30_000 })
  })
  await direct.context.close()
  expect(failures).toEqual([])
})

test('teen (15): own login, school profile, every learner surface, CSV export', async ({ browser }) => {
  test.setTimeout(420_000)
  const failures: string[] = []
  const { context, page } = await login(browser, 'teen')
  await screen(failures, page, 'teen', '/workspaces shows School student for both schools', async () => { await expectSignedInAs(page, 'teen'); await visible(page, 'School student') })
  await screen(failures, page, 'teen', '/learner: pick the school profile -> /learn/home', async () => {
    await open(page, '/learner')
    await page.getByRole('button', { name: /^Teen · Review School A/ }).click()
    await expect(page).toHaveURL(/\/learn\/home/, { timeout: 45_000 })
  })
  await screen(failures, page, 'teen', '/learner after selection offers learning home and library links', async () => {
    await open(page, '/learner')
    await page.getByRole('button', { name: /^Teen · Review School A/ }).click()
    await expect(page).toHaveURL(/\/learn\/home/, { timeout: 45_000 })
  })
  await learnerSurfaces(failures, page, 'teen', { csv: 'allowed' })
  await context.close()
  expect(failures).toEqual([])
})

test('teeninvite: teen email invitation (Mailpit) then own login', async ({ browser }) => {
  test.setTimeout(420_000)
  const failures: string[] = []
  const invitee = await login(browser, 'teeninvite')
  let bound = false
  await screen(failures, invitee.page, 'teeninvite', 'unclaimed roster record: truthful empty state before the invitation', async () => {
    await open(invitee.page, '/learner')
    await expect(invitee.page.getByTestId('signed-in-email')).toHaveText(`teeninvite@${DOMAIN}`, { timeout: 25_000 })
    bound = (await invitee.page.getByRole('button', { name: /^Invitee · Review School A/ }).count()) > 0
    if (!bound) await expect(invitee.page.getByTestId('no-learner-profile')).toBeVisible()
    return bound ? 'PASS' : 'PASS'
  })
  if (!bound) {
    const mailpitUp = await fetch(`${MAILPIT}/api/v1/info`, { signal: AbortSignal.timeout(3000) }).then(r => r.ok).catch(() => false)
    if (!mailpitUp) {
      rec('teeninvite', 'invitation email -> accept', 'BLOCKED(Mailpit not reachable; start `mailpit --listen 127.0.0.1:8025 --smtp 127.0.0.1:1025` and set DEV_MAIL_SINK_URL in the API .env)')
    } else {
      await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' }).catch(() => undefined)
      const parent = await login(browser, 'parent')
      await screen(failures, parent.page, 'parent', 'sends the teen a personal login invitation from /family', async () => {
        await open(parent.page, '/family')
        await parent.page.getByRole('button', { name: /^Invitee · Review School A/ }).click()
        const card = parent.page.getByTestId('teen-login-invite')
        await expect(card).toBeVisible({ timeout: 25_000 })
        await card.getByLabel('Teen learner email').fill(`teeninvite@${DOMAIN}`)
        await card.getByRole('button', { name: 'Send personal login invitation' }).click()
        await expect(card).toContainText('Invitation sent', { timeout: 30_000 })
      })
      await parent.context.close()
      let link = ''
      await screen(failures, invitee.page, 'teeninvite', 'invitation email arrives in the dev mail sink with a web link', async () => {
        for (let attempt = 0; attempt < 20 && !link; attempt += 1) {
          const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:teeninvite@${DOMAIN}`)}`)).json() as { messages?: { ID: string }[] }
          if (list.messages?.length) {
            const message = await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0]!.ID}`)).json() as { Text: string }
            link = message.Text.match(/http\S*\/student-invite#token=\S+/)?.[0] ?? ''
          } else await invitee.page.waitForTimeout(500)
        }
        expect(link).toMatch(/^http:\/\/localhost:3001\/student-invite#token=/)
      })
      await screen(failures, invitee.page, 'teeninvite', 'opens the link, verified account accepts the school profile login', async () => {
        await invitee.page.goto(link)
        const accept = invitee.page.getByRole('button', { name: 'Accept my school profile login' })
        await expect(accept).toBeEnabled({ timeout: 25_000 })
        await accept.click()
        await expect(invitee.page.locator('body')).toContainText('Your verified login is now bound', { timeout: 30_000 })
      })
    }
  } else rec('teeninvite', 'invitation email -> accept', 'PASS', 'already accepted in an earlier run (re-arm SQL in the spec header)')
  await screen(failures, invitee.page, 'teeninvite', 'after the invitation: profile -> /learn/home', async () => {
    await open(invitee.page, '/learner')
    const profile = invitee.page.getByRole('button', { name: /^Invitee · Review School A/ })
    if (!(await profile.count())) throw new Error('BLOCKED: no profile bound (invitation not accepted)')
    await profile.click()
    await expect(invitee.page).toHaveURL(/\/learn\/home/, { timeout: 45_000 })
  })
  await invitee.context.close()
  expect(failures).toEqual([])
})

test('outsider: truthful denied or empty states, no data leaks', async ({ browser }) => {
  const failures: string[] = []
  const { context, page } = await login(browser, 'outsider')
  await screen(failures, page, 'outsider', '/workspaces: no active school membership', async () => { await expectSignedInAs(page, 'outsider'); await visible(page, 'No active school membership') })
  await screen(failures, page, 'outsider', 'school URL directly (academics, students) shows no school data', async () => {
    for (const area of ['academics', 'students', 'staff', 'curriculum', 'policies', 'classroom']) {
      await open(page, `/org/${SCHOOL_A}/${area}`)
      await expect(page).toHaveURL(/\/workspaces/)
      await expect(page.locator('body')).not.toContainText(/Review School A|Class 3 B03|Student ·/)
    }
  })
  await screen(failures, page, 'outsider', '/learner: no learner profile card', async () => { await open(page, '/learner'); await expect(page.getByTestId('no-learner-profile')).toBeVisible({ timeout: 25_000 }) })
  await screen(failures, page, 'outsider', '/family: no verified children', async () => { await open(page, '/family'); await visible(page, 'No verified children yet') })
  await screen(failures, page, 'outsider', '/family/approvals: nothing waiting', async () => { await open(page, '/family/approvals'); await visible(page, 'Nothing is waiting for you') })
  await screen(failures, page, 'outsider', '/learn/library: denied state, no data', async () => { await open(page, '/learn/library'); await visible(page, /not permitted|Material services unavailable/) }, { allow: /\/api\/materials\// })
  await screen(failures, page, 'outsider', 'denied: /teacher/plans', async () => { await open(page, '/teacher/plans'); await expect(page).toHaveURL(/\/workspaces\?denied=1/) })
  await screen(failures, page, 'outsider', 'platform answers 403/404 for another school\'s learner data', async () => {
    const response = await page.request.get('/api/learn/overview?limit=20')
    expect([401, 403, 404]).toContain(response.status())
  }, { allow: /\/api\/learn\// })
  await context.close()
  expect(failures).toEqual([])
})
