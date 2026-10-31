import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

/**
 * Weekend-demo student loop for the teen persona on the REAL stack (API :3000, web :3001, AI runtime).
 *
 *   DEMO_REAL_API=1 pnpm exec playwright test -c playwright.demo-real.config.ts
 *
 * Needs the dev seed (colearner-platform `pnpm db:seed:dev`): the teen's "How plants make food (PDF)" material with a stored
 * original, its lesson, a READY practice set and three notes. The AI-backed steps (Ask Co, analogy) tolerate a slow or failing
 * model: they pass when Co answers OR shows the friendly retry state, and log which one happened.
 * /auth/login is throttled per client: the signed-in state is saved and DEMO_REUSE_AUTH=1 reuses it on a rerun.
 */
test.skip(process.env.DEMO_REAL_API !== '1', 'Set DEMO_REAL_API=1 with the dev stack running.')

const PASSWORD = process.env.DEMO_SEED_PASSWORD ?? 'B03Review!Pass2026'
const EMAIL = process.env.DEMO_TEEN_EMAIL ?? 'teen@b03.example.test'
const MATERIAL = 'How plants make food (PDF)'
const artifacts = process.env.DEMO_E2E_ARTIFACTS ?? path.join(os.tmpdir(), 'colearner-demo-real-api')
const stateFile = path.join(artifacts, 'auth-teen.json')
const log = (message: string) => console.log(`[demo-e2e] ${new Date().toISOString().slice(11, 19)} ${message}`)

test.describe.configure({ mode: 'serial' })

async function open(page: Page, url: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try { await page.goto(url, { waitUntil: 'domcontentloaded' }); return } catch (error) { if (attempt === 3) throw error; await page.waitForTimeout(1500) }
  }
}

/** Sign in (if needed), then pick the school profile (the learner entry asks once per session). */
async function enter(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await open(page, '/learn/home')
    await page.waitForLoadState('load').catch(() => undefined)
    await page.waitForTimeout(2000)
    if (page.url().includes('/login')) {
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined)
      await expect(page.getByRole('button', { name: /^log in$/i }).first()).toBeEnabled({ timeout: 30_000 })
      await page.waitForTimeout(1500) // let hydration finish so the typed values are not reset
      await page.getByLabel('Email').first().fill(EMAIL)
      await page.locator('input[type="password"]').first().fill(PASSWORD)
      await expect(page.getByLabel('Email').first()).toHaveValue(EMAIL)
      await page.getByRole('button', { name: /^log in$/i }).first().click()
      await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 45_000 }).catch(() => undefined)
      await page.waitForTimeout(3000)
      continue
    }
    if (!page.url().includes('/learner')) await open(page, '/learner')
    const profile = page.getByRole('button', { name: /Review School A/ })
    if (await profile.waitFor({ timeout: 30_000 }).then(() => true).catch(() => false)) { await profile.click(); await page.waitForTimeout(3000) }
    await open(page, '/learn/home')
    if (page.url().includes('/learn/home') && await page.getByText(/^Hi Teen/).waitFor({ timeout: 90_000 }).then(() => true).catch(() => false)) return
  }
  throw new Error('Could not reach /learn/home as the teen (login throttled? see the /auth/login 429 note)')
}

test('teen: library, reader, lesson, practice, Ask Co, analogy, notes, progress', async ({ browser }) => {
  fs.mkdirSync(artifacts, { recursive: true })
  const reuse = process.env.DEMO_REUSE_AUTH === '1' && fs.existsSync(stateFile)
  const context = await browser.newContext(reuse ? { storageState: stateFile } : {})
  const page = await context.newPage()
  page.setDefaultTimeout(60_000)

  await test.step('sign in and see the home screen', async () => {
    await enter(page)
    await context.storageState({ path: stateFile })
    await expect(page.getByTestId('next-action')).toBeVisible()
  })

  await test.step('library lists the PDF and no stale failed rows', async () => {
    await open(page, '/learn/library')
    await expect(page.getByRole('heading', { name: 'Your library' })).toBeVisible({ timeout: 90_000 })
    await expect(page.getByRole('link', { name: MATERIAL })).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText('School or guardian permission changed')).toHaveCount(0)
  })

  await test.step('reader: Original, Text and Key ideas tabs', async () => {
    const card = page.locator('h2', { hasText: MATERIAL }).locator('xpath=ancestor::*[.//a[normalize-space()="Open reader"]][1]')
    await card.getByRole('link', { name: 'Open reader' }).click()
    await expect(page.getByRole('tab', { name: 'Original' })).toBeVisible({ timeout: 90_000 })
    await expect(page.getByText(/Page 1 of 2/)).toBeVisible({ timeout: 60_000 })
    await page.getByRole('tab', { name: 'Text' }).click()
    await expect(page.getByText(/Chlorophyll in the chloroplasts/).first()).toBeVisible()
    await page.getByRole('tab', { name: 'Key ideas' }).click()
    await expect(page.getByText('Chlorophyll and light').first()).toBeVisible()
  })

  await test.step('reader: saved pages, then Ask Co and an analogy (AI, tolerant)', async () => {
    await page.getByRole('tab', { name: 'My pages' }).click()
    await expect(page.getByText('Why leaves look green').first()).toBeVisible({ timeout: 60_000 })

    await page.getByRole('tab', { name: 'Ask Co' }).click()
    const opener = page.getByTestId('ask-co-open').first()
    if (await opener.isVisible().catch(() => false)) await opener.click()
    const input = page.getByTestId('co-input').first()
    if (await input.waitFor({ timeout: 15_000 }).then(() => true).catch(() => false)) {
      await input.fill('Why do leaves look green?')
      await page.getByRole('button', { name: /^(send|ask)/i }).first().click()
      const outcome = await Promise.race([
        page.getByTestId('co-reply-text').first().waitFor({ timeout: 150_000 }).then(() => 'answered'),
        page.getByTestId('co-error').first().waitFor({ timeout: 150_000 }).then(() => 'friendly-failure'),
      ]).catch(() => 'slow')
      log(`Ask Co: ${outcome}`)
    } else log('Ask Co input not visible in the rail (skipped)')

    await page.getByRole('tab', { name: 'Analogy' }).click()
    const make = page.getByTestId('analogy-make')
    if (await make.waitFor({ timeout: 15_000 }).then(() => true).catch(() => false)) {
      await page.getByTestId('analogy-concept').selectOption({ label: 'Chlorophyll and light' })
      await make.scrollIntoViewIfNeeded()
      await make.click()
      const result = await Promise.race([
        page.getByTestId('analogy-result').waitFor({ timeout: 150_000 }).then(() => 'analogy'),
        page.getByTestId('analogy-failed').waitFor({ timeout: 150_000 }).then(() => 'friendly-failure'),
      ]).catch(() => 'slow')
      log(`Analogy: ${result}`)
    }
  })

  await test.step('lesson resumes and finishes', async () => {
    await open(page, '/learn/library')
    const card = page.locator('h2', { hasText: MATERIAL }).locator('xpath=ancestor::*[.//a[normalize-space()="Start lesson"]][1]')
    await card.getByRole('link', { name: 'Start lesson' }).click()
    await expect(page.getByTestId('lesson-step').or(page.getByText('Lesson done!')).first()).toBeVisible({ timeout: 120_000 })
    for (let i = 0; i < 6; i += 1) {
      if (await page.getByText('Lesson done!').isVisible().catch(() => false)) break
      const radio = page.getByRole('radio').first()
      if (await radio.isVisible().catch(() => false) && !(await page.getByText(/Nice work|That is the right one/).first().isVisible().catch(() => false))) {
        await page.getByRole('radio', { name: 'Green light' }).check().catch(() => radio.check())
        await page.getByRole('button', { name: 'Check my answer' }).click()
      }
      const next = page.getByRole('button', { name: /^(Next|Finish)/ }).first()
      await next.waitFor({ state: 'visible', timeout: 30_000 })
      await next.click()
    }
    await expect(page.getByText('Lesson done!')).toBeVisible({ timeout: 60_000 })
  })

  await test.step('practice: seeded set, answer, summary', async () => {
    await open(page, '/learn/practice')
    await expect(page.getByRole('heading', { name: 'Practice', exact: true })).toBeVisible({ timeout: 90_000 })
    await page.getByRole('link', { name: 'Practise' }).first().click()
    const answers: Array<[RegExp, string]> = [[/carbon dioxide and water/, 'Glucose and oxygen'], [/colour of light/, 'Green'], [/Calvin cycle/, 'False'], [/light-dependent reactions/, 'ATP and NADPH'], [/NOT change/, 'The colour of the soil']]
    for (const [prompt, choice] of answers) {
      await expect(page.getByText(prompt).first()).toBeVisible({ timeout: 120_000 })
      await page.getByRole(choice === 'False' ? 'radio' : 'radio', { name: choice, exact: true }).check()
      await page.getByRole('button', { name: 'Check my answer' }).click()
      const advance = page.getByRole('button', { name: /Next question|Finish/ })
      await advance.waitFor({ state: 'visible', timeout: 90_000 })
      await advance.click()
    }
    await expect(page.getByTestId('stars')).toBeVisible({ timeout: 120_000 })
    await expect(page.getByText('5 of 5')).toBeVisible()
  })

  await test.step('teach-back opens from the summary', async () => {
    await page.getByRole('link', { name: 'Teach it back to Co' }).click()
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 90_000 })
    await expect(page.getByLabel('Your explanation')).toBeVisible()
  })

  await test.step('my pages index lists the seeded notes', async () => {
    await open(page, '/learn/notes')
    await expect(page.getByText('A leaf is a solar-powered kitchen').first()).toBeVisible({ timeout: 90_000 })
  })

  await test.step('progress names the key ideas, not question refs', async () => {
    await open(page, '/learn/progress')
    await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible({ timeout: 90_000 })
    await expect(page.getByText('Chlorophyll and light').first()).toBeVisible()
    await expect(page.getByText(/^q\d$/)).toHaveCount(0)
  })

  await context.close()
})
