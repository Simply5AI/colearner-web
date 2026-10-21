/** Real local Next/Auth.js/Nest/Postgres/Redis review; synthetic accounts only. */
import { expect, test, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
let schoolA = ''
let schoolB = ''
let base = ''
const output = path.resolve('output/playwright/b02')

async function login(page: Page, name: string) {
  await page.goto('/login?callbackUrl=%2Fworkspaces')
  await page.getByLabel('Email', { exact: true }).fill(`${name}@b02.example.test`)
  await page.getByLabel('Password', { exact: true }).fill('B02Review!Pass2026')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Choose your workspace' })).toBeVisible()
}
async function openSchool(page: Page) {
  await page.getByRole('heading', { name: 'Review School A', exact: true }).locator('..').getByRole('button', { name: 'Open workspace' }).click()
  await expect(page).toHaveURL(new RegExp(`/org/${schoolA}/(academics|classroom)`))
  await expect(page.locator('main h1')).toBeVisible()
}
async function credential(page: Page) {
  const response = await page.context().request.get('http://localhost:3101/api/auth/session')
  const session = await response.json()
  if (typeof session.accessToken !== 'string') throw new Error('Review account did not establish a backend session')
  return session.accessToken as string
}
async function schoolApi<T>(page: Page, suffix: string, body?: unknown): Promise<T> {
  const response = await page.context().request.fetch(`http://127.0.0.1:3102/api/v1/schools/${schoolA}${suffix}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${await credential(page)}` }, data: body })
  if (!response.ok()) throw new Error(`Synthetic school setup failed: ${response.status()} ${suffix}`)
  return (await response.json()).data as T
}
async function prepareClass(page: Page, unique: string) {
  const year = await schoolApi<{ id: string }>(page, '/academic-years', { name: `Review ${unique}`, startDate: '2026-04-01', endDate: '2027-03-31' })
  const classroom = await schoolApi<{ id: string }>(page, '/classes', { academicYearId: year.id, board: 'CBSE', grade: 3, section: unique.slice(0, 20) })
  return { yearId: year.id, classId: classroom.id }
}
async function assignTeacher(page: Page, classId: string) {
  const members = await schoolApi<{ items: Array<{ id: string; role: string; email: string }> }>(page, '/memberships')
  const teacher = members.items.find(item => item.role === 'TEACHER' && item.email === 'teacher@b02.example.test')
  if (!teacher) throw new Error('Synthetic teacher membership is missing')
  await schoolApi(page, '/teaching-assignments', { classId, membershipId: teacher.id, subject: 'English' })
}
async function waitForAccessExpiry(page: Page) {
  const token = await credential(page)
  const payload = token.split('.')[1]
  if (!payload) throw new Error('Review credential has no payload')
  const expires = Number(JSON.parse(Buffer.from(payload, 'base64url').toString()).exp) * 1000
  if (!Number.isFinite(expires)) throw new Error('Review credential has no expiry')
  await expect.poll(() => Date.now(), { timeout: 30000, intervals: [1000, 2000] }).toBeGreaterThan(expires + 1000)
}
test.beforeAll(async ({ request }) => {
  const response = await request.get('http://127.0.0.1:3102/api/v1/review-health')
  expect(response.ok()).toBeTruthy()
  const health = (await response.json()).data as { fixture: string; schools: Array<{ id: string; name: string }> }
  expect(health.fixture).toBe('B02 local review only')
  schoolA = health.schools.find(item => item.name === 'Review School A')?.id ?? ''
  schoolB = health.schools.find(item => item.name === 'Review School B')?.id ?? ''
  if (!schoolA || !schoolB) throw new Error('Synthetic review schools are missing')
  base = `/org/${schoolA}`
  await mkdir(output, { recursive: true })
})
test('short-lived real credentials persist refresh across idle writes and client navigation', async ({ page, context }) => {
  const stamp = randomUUID().slice(0, 12)
  await login(page, 'admin'); await openSchool(page)
  await expect(page.getByRole('heading', { name: 'Build your school year' })).toBeVisible()
  // Warm the development route before exercising a deliberately tiny token lifetime.
  await page.goto(`${base}/staff`)
  await expect(page.getByRole('heading', { name: 'Teachers & staff' })).toBeVisible()
  await page.goto(`${base}/academics`)
  await expect(page.getByRole('heading', { name: 'Build your school year' })).toBeVisible()
  const cookieBefore = (await context.cookies()).filter(c => c.name.includes('session-token')).map(c => c.value).join('')
  await waitForAccessExpiry(page)
  await page.getByLabel('New academic year name').fill(`Refresh ${stamp}`)
  await page.getByLabel('Academic year start').fill('2026-04-01')
  await page.getByLabel('Academic year end').fill('2027-03-31')
  await page.getByRole('button', { name: 'Create academic year', exact: true }).click()
  await expect(page.getByLabel('Selected academic year').locator('option', { hasText: `Refresh ${stamp}` })).toHaveCount(1)
  const cookieAfter = (await context.cookies()).filter(c => c.name.includes('session-token')).map(c => c.value).join('')
  expect(cookieAfter).not.toBe(cookieBefore)
  await waitForAccessExpiry(page)
  await page.getByRole('link', { name: 'Teachers & staff', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Teachers & staff' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Review teacher', exact: true })).toBeVisible()
  await expect(page.getByText('School records unavailable', { exact: true })).toHaveCount(0)
  expect(new URL(page.url()).pathname).toBe(`${base}/staff`)
})
test('school administrator completes academic setup, unclaimed roster import, assignment and invitation', async ({ page }) => {
  const stamp = randomUUID().slice(0, 12)
  await login(page, 'admin'); await openSchool(page)
  await schoolApi(page, '/academic-years', { name: `Workflow ${stamp}`, startDate: '2026-04-01', endDate: '2027-03-31' })
  await page.reload()
  await page.getByLabel('Selected academic year').selectOption({ label: `Workflow ${stamp}` })
  await page.getByLabel('Term name').fill('First term')
  await page.getByLabel('Term start').fill('2026-04-01')
  await page.getByLabel('Term end').fill('2026-08-01')
  await page.getByRole('button', { name: 'Add term', exact: true }).click()
  await expect(page.getByText('First term', { exact: true })).toBeVisible()
  await page.getByLabel('Grade', { exact: true }).selectOption('3')
  await page.getByLabel('Section', { exact: true }).fill(`A-${stamp}`)
  await page.getByRole('button', { name: 'Create class', exact: true }).click()
  await expect(page.getByRole('heading', { name: `CBSE · Class 3 A-${stamp}` })).toBeVisible()
  await page.getByRole('link', { name: 'Students & guardians', exact: true }).first().click()
  await page.getByLabel('Roster class').selectOption({ label: `CBSE · Class 3 A-${stamp}` })
  await expect(page.getByLabel('Selected class ID for CSV')).not.toHaveValue('')
  const classId = await page.getByLabel('Selected class ID for CSV').inputValue()
  await page.getByLabel('School student reference').fill(`manual-${stamp}`)
  await page.getByLabel('Student display name').fill('Review learner')
  await page.getByRole('button', { name: 'Add student record' }).click()
  await expect(page.getByRole('heading', { name: 'Review learner', exact: true })).toBeVisible()
  await expect(page.getByText('Unclaimed identity', { exact: true })).toBeVisible()
  const csv = `externalId,displayName,classId,membershipId\nimport-${stamp},"Review, imported learner",${classId},`
  await page.getByLabel('CSV content').fill(csv)
  await page.getByRole('button', { name: 'Preview import', exact: true }).click()
  await expect(page.getByText('1 rows reviewed · 1 valid rows · 0 errors', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Commit reviewed import' }).click()
  await expect(page.getByText(/Imported 1 roster entries/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Review, imported learner', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Teachers & staff', exact: true }).first().click()
  await page.getByLabel('Assigned class').selectOption(classId)
  await page.getByLabel('Active school teacher').selectOption({ label: 'Review teacher' })
  await page.getByLabel('Subject', { exact: true }).fill('English')
  await page.getByRole('button', { name: 'Assign teacher', exact: true }).click()
  await expect(page.getByRole('listitem').filter({ hasText: `CBSE · Class 3 A-${stamp}` }).getByText('English', { exact: true })).toBeVisible()
  await page.getByLabel('Invitation email').fill('outsider@b02.example.test')
  await page.getByRole('button', { name: 'Create bound invitation' }).click()
  await expect(page.getByLabel('Invitation code')).toBeVisible()
  const invitation = await page.getByLabel('Invitation code').inputValue()
  expect(invitation.length).toBe(43)
  await page.getByRole('button', { name: 'Hide invitation code' }).click()
})
test('invitation activates only the bound verified account and creates a real teacher workspace', async ({ page }) => {
  await login(page, 'admin')
  const invitation = (await schoolApi<{ token: string }>(page, '/invitations', { email: 'outsider@b02.example.test', role: 'TEACHER' })).token
  expect(invitation.length).toBe(43)
  await page.context().clearCookies()
  await login(page, 'outsider')
  await page.getByRole('link', { name: 'Accept school invitation' }).click()
  await page.getByLabel('School invitation code').fill(invitation)
  await page.getByRole('button', { name: 'Accept invitation', exact: true }).click()
  await expect(page.getByText(/School membership activated/)).toBeVisible()
  await page.goto('/workspaces'); await openSchool(page)
  await expect(page.getByRole('heading', { name: 'My school teaching assignments' })).toBeVisible()
  await expect(page.getByText('No assigned classes yet', { exact: true })).toBeVisible()
})
test('cross-school URL and teacher/parent privilege claims are rejected with real credentials', async ({ page, browser }) => {
  await login(page, 'admin'); await openSchool(page)
  const { classId } = await prepareClass(page, randomUUID())
  await assignTeacher(page, classId)
  await page.goto(`/org/${schoolB}/students`)
  await expect(page).toHaveURL(/\/workspaces\?denied=1/)
  for (const name of ['teacher', 'parent']) {
    const context = await browser.newContext()
    const actor = await context.newPage()
    await login(actor, name)
    await expect(actor.getByRole('heading', { name: 'Review School A', exact: true })).toBeVisible()
    await expect(actor.getByRole('heading', { name: 'Review School B', exact: true })).toBeVisible()
    const session = await (await context.request.get('http://localhost:3101/api/auth/session')).json()
    expect(typeof session.accessToken).toBe('string')
    const denied = await context.request.get(`http://127.0.0.1:3102/api/v1/schools/${schoolA}/classes/${classId}/roster`, { headers: { Authorization: `Bearer ${session.accessToken}` } })
    expect(denied.status()).toBe(403)
    if (name === 'parent') await expect(actor.getByRole('button', { name: 'Open workspace' })).toHaveCount(0)
    else {
      await openSchool(actor)
      await expect(actor.getByText('English', { exact: true }).first()).toBeVisible()
      await actor.goto(`${base}/academics`)
      await expect(actor).toHaveURL(/\/workspaces\?denied=1/)
    }
    await context.close()
  }
})
test('actual school screens fit desktop tablet phone and expanded RTL with screenshots', async ({ page }) => {
  await login(page, 'admin'); await openSchool(page)
  const { classId } = await prepareClass(page, randomUUID())
  await schoolApi(page, `/classes/${classId}/roster`, { externalId: randomUUID(), displayName: 'A learner name with extended translated text for layout review' })
  const records = []
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ['academics', 'students', 'staff']) {
      await page.goto(`${base}/${route}${route === 'students' ? `?classId=${classId}` : ''}`)
      await expect(page.locator('main h1')).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      for (const dir of ['ltr', 'rtl']) {
        await page.evaluate(direction => { document.documentElement.dir = direction }, dir)
        const measurement = await page.evaluate(() => ({ width: innerWidth, client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, h1: document.querySelector('main h1')?.textContent, bodyFont: getComputedStyle(document.body).fontFamily }))
        expect(measurement.scroll).toBeLessThanOrEqual(measurement.client)
        const clippedControls = await page.locator('main').evaluate(main => Array.from(main.querySelectorAll('input, select, textarea, h1')).filter(element => {
          const box = element.getBoundingClientRect()
          return box.width > 0 && (box.left < -1 || box.right > innerWidth + 1)
        }).map(element => element.getAttribute('aria-label') ?? element.getAttribute('id') ?? element.tagName))
        expect(clippedControls).toEqual([])
        records.push({ route, dir, ...measurement })
      }
      if (width === 390 || (width === 1440 && route === 'academics')) await page.screenshot({ path: path.join(output, `${route}-${width}-rtl.png`), fullPage: true, animations: 'disabled' })
    }
  }
  await writeFile(path.join(output, 'viewport-results.json'), JSON.stringify({ date: '2026-10-15', cases: records.length, kind: 'real-local-auth-school-api-with-synthetic-data', records }, null, 2))
})
test('phone keyboard navigation and failed-write retry retain the school draft', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await login(page, 'admin'); await openSchool(page)
  const trigger = page.getByRole('button', { name: 'Open navigation', exact: true })
  await trigger.focus(); await page.keyboard.press('Enter')
  const drawer = page.getByRole('dialog')
  await expect(drawer).toBeVisible()
  await page.keyboard.press('Tab')
  expect(await drawer.evaluate(element => element.contains(document.activeElement))).toBeTruthy()
  await page.keyboard.press('Escape')
  await expect(drawer).not.toBeVisible(); await expect(trigger).toBeFocused()
  const skip = page.getByRole('link', { name: 'Skip to content', exact: true })
  await skip.focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
  const name = `Retry ${randomUUID().slice(0, 12)}`
  await page.getByLabel('New academic year name').fill(name)
  await page.getByLabel('Academic year start').fill('2026-04-01')
  await page.getByLabel('Academic year end').fill('2027-03-31')
  const endpoint = `**/api/v1/schools/${schoolA}/academic-years`
  await page.route(endpoint, async route => {
    if (route.request().method() === 'POST') await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic transport outage' }), headers: { 'access-control-allow-origin': 'http://localhost:3101' } })
    else await route.continue()
  })
  await page.getByRole('button', { name: 'Create academic year', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: /unavailable/ })).toBeVisible()
  await expect(page.getByLabel('New academic year name')).toHaveValue(name)
  await page.unroute(endpoint)
  await page.getByRole('button', { name: 'Create academic year', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Selected academic year').locator('option', { hasText: name })).toHaveCount(1)
  const finalControl = page.getByRole('main').getByRole('button').last()
  await finalControl.scrollIntoViewIfNeeded()
  const controlBox = await finalControl.boundingBox()
  const navBox = await page.getByRole('navigation', { name: 'Quick navigation', exact: true }).boundingBox()
  expect(controlBox && navBox && controlBox.y + controlBox.height <= navBox.y + 1).toBeTruthy()
})
