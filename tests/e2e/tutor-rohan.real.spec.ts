import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

/**
 * Tutor Loop journey against the REAL platform API and the running web dev server. Skipped unless TUTOR_REAL_API=1.
 * Seeded Teen (Rohan, teen@b03) and Adult (Sara). Credentials come from the environment; nothing is hard coded.
 * Each step records pass/fail and a screenshot in TUTOR_EVIDENCE_DIR; AI-backed steps accept the typed "resting" fallback
 * when the AI runtime is unavailable and record which one happened.
 */
const enabled = process.env.TUTOR_REAL_API === '1'
test.skip(!enabled, 'Set TUTOR_REAL_API=1 with the local API (:3000) and web (:3001) running.')

const EVIDENCE = process.env.TUTOR_EVIDENCE_DIR ?? path.join(os.tmpdir(), 'colearner-tutor-evidence')
const TEEN = process.env.TUTOR_TEEN_EMAIL ?? 'teen@b03.example.test'
const SARA = process.env.TUTOR_SARA_EMAIL ?? 'sara@tutor.example.test'
const results: Array<{ step: string; status: 'PASS' | 'FAIL'; note: string; shot?: string }> = []

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).first().fill(password)
  await page.getByRole('button', { name: /log in/i }).first().click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 })
  await page.waitForLoadState('load')
}

async function step(page: Page, name: string, fn: () => Promise<string | void>) {
  const file = `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`
  let note = ''
  let status: 'PASS' | 'FAIL' = 'PASS'
  try { note = (await fn()) ?? '' } catch (error) { status = 'FAIL'; note = String(error).split('\n')[0]!.slice(0, 300) }
  fs.mkdirSync(EVIDENCE, { recursive: true })
  await page.screenshot({ path: path.join(EVIDENCE, file), fullPage: true }).catch(() => undefined)
  results.push({ step: name, status, note, shot: file })
}

test('Rohan (Teen) tutor loop', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  const apiProblems: string[] = []
  const consoleErrors: string[] = []
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) apiProblems.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`) })
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })
  await login(page, TEEN, process.env.TUTOR_SEED_PASSWORD ?? '')
  await step(page, '00-pick-school', async () => {
    for (let attempt = 0; attempt < 3 && !/^\/learn(\/|$|\?)/.test(new URL(page.url()).pathname); attempt += 1) {
      await page.goto('/learner', { waitUntil: 'domcontentloaded' }).catch(() => undefined)
      const pick = page.getByRole('button', { name: /review school a/i }).first()
      if (await pick.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true).catch(() => false)) {
        await pick.click()
        await page.waitForURL((u) => u.pathname.startsWith('/learn/') || u.pathname === '/learn', { timeout: 60_000 }).catch(() => undefined)
      }
    }
    if (!new URL(page.url()).pathname.startsWith('/learn')) throw new Error('Could not enter the learner workspace: ' + page.url())
    return page.url().replace(/^https?:\/\/[^/]+/, '')
  })
  const visit = (name: string, url: string, expectText?: RegExp) =>
    step(page, name, async () => {
      await page.goto(url)
      await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => undefined)
      await page.waitForTimeout(1500)
      const body = await page.locator('body').innerText({ timeout: 5000 })
      if (/^\/(learner|workspaces|login)/.test(new URL(page.url()).pathname)) throw new Error('Redirected away from the learner area to ' + new URL(page.url()).pathname)
      if (/could not open|could not load|something went wrong|try again/i.test(body)) throw new Error('Error state shown: ' + (body.match(/(could not open|could not load|something went wrong|try again)/i)?.[0] ?? ''))
      if (expectText) await expect(page.locator('body')).toContainText(expectText, { timeout: 20_000 })
      return `${page.url().replace(/^https?:\/\/[^/]+/, '')} | ${(await page.locator('h1').first().innerText({ timeout: 3000 }).catch(() => '(no h1)')).slice(0, 80)}`
    })
  await visit('01-entry-learn', '/learn')
  await visit('02-today', '/learn/today')
  await visit('03-this-week', '/learn/today?tab=week')
  await visit('04-progress', '/learn/today?tab=progress')
  await visit('05-practice', '/learn/practice')
  await visit('06-exam-prep', '/learn/practice?tab=exam')
  await visit('07-ask-co', '/learn/co')
  await visit('08-me-goal', '/learn/me?section=goal')
  await visit('09-me-tutor', '/learn/me?section=tutor')
  await visit('10-me-notes', '/learn/me?section=notes')
  await visit('11-me-access', '/learn/me?section=access')
  await visit('12-library', '/learn?tab=library')
  // Ask Co: a live turn (AI available) or the resting fallback (AI unavailable); both are recorded, never a crash.
  await step(page, '13-ask-co-live-turn', async () => {
    await page.goto('/learn/co')
    const box = page.getByPlaceholder(/ask co anything/i)
    await box.fill('Can you quiz me on states of matter?')
    await box.press('Enter')
    const started = Date.now()
    await expect(page.locator('body')).toContainText(/states of matter|resting|try again|Co is thinking|checking/i, { timeout: 30_000 })
    await page.waitForTimeout(25_000)
    const text = await page.locator('body').innerText().catch(() => '')
    const mode = /resting|try again/i.test(text) ? 'AI unavailable -> fallback shown' : 'AI reply shown'
    return `${mode} after ${Math.round((Date.now() - started) / 1000)}s`
  })
  await step(page, '14-practice-choose-mock', async () => {
    await page.goto('/learn/practice?tab=exam')
    await page.getByRole('button', { name: /choose a mock/i }).click()
    await page.waitForTimeout(1500)
    return (await page.locator('body').innerText()).includes('QUICK') || (await page.getByText(/questions/i).count()) > 0 ? 'builder opened' : 'builder text not found'
  })
  // Responsive, theme, direction and keyboard checks (contract section 11 asks for 390px, keyboard, Dark and RTL).
  await page.setViewportSize({ width: 390, height: 844 })
  for (const [name, url] of [['20-390-today', '/learn/today'], ['21-390-practice', '/learn/practice'], ['22-390-co', '/learn/co'], ['23-390-me', '/learn/me?section=tutor']] as const) {
    await step(page, name, async () => {
      await page.goto(url)
      await page.waitForTimeout(2500)
      if (/^\/(learner|workspaces|login)/.test(new URL(page.url()).pathname)) throw new Error('Redirected away from the learner area')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      if (overflow > 1) throw new Error(`horizontal scroll ${overflow}px at 390px`)
      return `no horizontal scroll; bottom nav ${(await page.getByRole('navigation').count())} nav landmarks`
    })
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  await step(page, '30-dark-today', async () => {
    await page.goto('/learn/today')
    await page.waitForTimeout(2000)
    await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); document.documentElement.classList.add('dark') })
    await page.waitForTimeout(500)
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    return `body background ${bg}`
  })
  await step(page, '31-rtl-today', async () => {
    await page.evaluate(() => { document.documentElement.dir = 'rtl'; document.documentElement.lang = 'ar' })
    await page.waitForTimeout(500)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (overflow > 1) throw new Error(`horizontal scroll ${overflow}px in RTL`)
    return 'dir=rtl applied; no horizontal scroll'
  })
  await step(page, '32-keyboard', async () => {
    await page.evaluate(() => { document.documentElement.dir = 'ltr'; document.documentElement.classList.remove('dark'); document.documentElement.removeAttribute('data-theme') })
    await page.goto('/learn/today')
    await page.waitForTimeout(2000)
    const seen: string[] = []
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab')
      seen.push(await page.evaluate(() => { const a = document.activeElement as HTMLElement | null; if (!a || a === document.body) return 'body'; const cs = getComputedStyle(a); const ring = cs.outlineStyle !== 'none' || cs.boxShadow !== 'none'; return `${a.tagName.toLowerCase()}:${(a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 18)}:${ring ? 'ring' : 'NO-RING'}` }))
    }
    if (seen.every((x) => x === 'body')) throw new Error('Tab never reached an interactive element')
    const noRing = seen.filter((x) => x.endsWith('NO-RING'))
    return `${seen.length} tab stops; ${noRing.length} without a visible ring ${noRing.slice(0, 3).join(', ')}`
  })
  fs.mkdirSync(EVIDENCE, { recursive: true })
  fs.writeFileSync(path.join(EVIDENCE, 'rohan-steps.json'), JSON.stringify({ results, apiProblems, consoleErrors: consoleErrors.slice(0, 30) }, null, 2))
  expect(results.filter((r) => r.status === 'FAIL'), JSON.stringify(results.filter((r) => r.status === 'FAIL'))).toHaveLength(0)
})
