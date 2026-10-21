import { test, expect, type Page, type Route } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createConversationMock, type ConversationMock, type ConversationMockOptions } from '../../../components/family/dev/conversation-mock'

/**
 * UI-only qualification of the B10 parent conversations view (under 14 transcripts, 14-17 summaries and the audited
 * grant) and the S6 school policy controls through /dev/family-conversations. The family and school endpoints and the
 * session are answered with page.route by the same contract-faithful test double the integration tests use (the platform
 * visibility change was built in parallel). No API, model, database or real child is involved.
 */
const output = process.env.B10_OUTPUT_DIR ? path.resolve(process.env.B10_OUTPUT_DIR) : path.resolve('output/b10')
const widths = [390, 1024, 1440] as const
let mock: ConversationMock
const records: unknown[] = []
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS' }

async function prepare(page: Page) {
  // Buffer/retry the real development layout chunk after observed local aborted asset responses (as B06-B09).
  await page.route('**/_next/static/chunks/app/layout.js', async route => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await route.fetch({ maxRetries: 2 })
        await route.fulfill({ status: response.status(), headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' }, body: await response.body() })
        return
      } catch (error) { if (attempt === 2) throw error }
    }
  })
  const answer = (route: Route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const url = new URL(request.url())
    const raw = request.postData()
    const reply = mock.handle(request.method(), url.pathname + url.search, raw ? JSON.parse(raw) : undefined)
    return route.fulfill({ status: reply.status, contentType: 'application/json', headers: cors, body: JSON.stringify(reply.body) })
  }
  await page.route('**/api/auth/session', answer)
  await page.route('**/api/v1/family/profiles/**', answer)
  await page.route('**/api/v1/schools/**', answer)
}
async function open(page: Page, options: ConversationMockOptions & { dir?: 'rtl'; screen?: 'policy'; teen?: boolean }) {
  const { dir, screen, teen, ...mockOptions } = options
  mock = createConversationMock(mockOptions)
  const query = new URLSearchParams({ mock: 'network', scenario: mockOptions.scenario })
  if (dir) query.set('dir', dir)
  if (screen) query.set('screen', screen)
  if (teen !== undefined) query.set('teen', teen ? '1' : '0')
  if (mockOptions.policy) query.set('policy', mockOptions.policy)
  await page.goto(`/dev/family-conversations?${query}`)
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
async function expectTargets(page: Page, selector: string, min: number, label: string) {
  const boxes = await page.locator(selector).evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height))
  expect(boxes.length, `${label} has controls`).toBeGreaterThan(0)
  for (const height of boxes) expect(height, `${label} target height`).toBeGreaterThanOrEqual(min)
}

test.afterAll(async () => {
  await mkdir(output, { recursive: true })
  await writeFile(path.join(output, 'viewport-results.json'), JSON.stringify({ date: new Date().toISOString(), records }, null, 2))
})

for (const width of widths) {
  for (const dir of [undefined, 'rtl'] as const) {
    const tag = `${width}${dir ? '-rtl' : ''}`
    test.describe(`parent conversations at ${tag}`, () => {
      test.beforeEach(async ({ page }) => {
        await mkdir(output, { recursive: true })
        await prepare(page)
        await page.setViewportSize({ width, height: width === 390 ? 1500 : 1100 })
      })

      test('under 14: list, keyboard transcript, labels, load more and live region', async ({ page }) => {
        await open(page, { scenario: 'under14', dir })
        await expect(page.getByRole('heading', { name: 'Chats with Co', level: 2 })).toBeVisible()
        await expect(page.getByText(/Only you and your child can see this/)).toBeVisible()
        if (dir) expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl')
        await expectNoOverflow(page, width, 'list')
        await expectTargets(page, 'main button[aria-expanded]', 44, 'transcript toggle')
        const toggle = page.getByRole('button', { name: /Plants and sunlight/ })
        await toggle.focus()
        await page.keyboard.press('Enter')
        await expect(toggle).toHaveAttribute('aria-expanded', 'true')
        await expect(page.getByText('Why do leaves need sunlight?')).toBeVisible()
        await expect(page.getByText('Beyond your material')).toBeVisible()
        await expect(page.getByText(/Co is an AI helper\. Its replies/)).toBeVisible()
        await page.getByRole('button', { name: /Feeling left out/ }).click()
        await expect(page.getByText('Suggested a trusted adult')).toBeVisible()
        await expect(page.getByText('Safety check').first()).toBeVisible()
        await expectNoOverflow(page, width, 'open transcripts')
        await shot(page, `under14-transcript-${tag}`)
        await page.getByRole('button', { name: 'Load more' }).click()
        await expect(page.getByText('Ask Co · The water cycle')).toBeVisible()
        await expect(page.getByRole('status').filter({ hasText: /Loaded more conversations/ })).toHaveCount(1)
        await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0)
        await toggle.focus()
        await page.keyboard.press('Space')
        await expect(toggle).toHaveAttribute('aria-expanded', 'false')
        await expectNoOverflow(page, width, 'after load more')
        records.push({ screen: 'under14', dir: dir ?? 'ltr', viewport: width, ...(await overflow(page)) })
      })

      test('14-17: summaries and alerts only, never text; the audited grant reveals transcripts and ends', async ({ page }) => {
        await open(page, { scenario: 'teen', dir })
        await expect(page.getByRole('list', { name: 'Conversation summaries' })).toBeVisible()
        await expect(page.getByRole('list', { name: 'Safety alerts' })).toBeVisible()
        await expect(page.getByRole('button', { name: /transcript/i })).toHaveCount(0)
        const before = await text(page)
        expect(before).not.toMatch(/stressed about the exam|private message|cannot sleep/)
        expect(before).toContain('2 safety flags')
        await expectNoOverflow(page, width, 'summaries')
        await shot(page, `teen-summaries-${tag}`)
        await page.getByLabel('Safety access reason').fill('Two alerts last week; I am worried about their safety.')
        await page.getByLabel('Your adult password for safety access').fill('synthetic-password')
        await page.getByRole('button', { name: 'Request audited safety access' }).click()
        await expect(page.getByText(/Safety access is active for 15 minutes/)).toBeVisible()
        await page.getByRole('button', { name: /Exam stress/ }).click()
        await expect(page.getByText(/stressed about the exam/)).toBeVisible()
        expect(mock.requests.some(request => request.path.includes('safetyGrantId='))).toBe(true)
        await expectNoOverflow(page, width, 'granted transcript')
        await shot(page, `teen-granted-${tag}`)
        await page.getByRole('button', { name: 'End safety access now' }).click()
        await expect(page.getByText(/Safety access has ended/)).toBeVisible()
        expect(await text(page)).not.toMatch(/stressed about the exam/)
        records.push({ screen: 'teen', dir: dir ?? 'ltr', viewport: width, ...(await overflow(page)) })
      })

      test('empty, denied and unavailable states', async ({ page }) => {
        await open(page, { scenario: 'empty', dir })
        await expect(page.getByText('No chats with Co yet')).toBeVisible()
        await expectNoOverflow(page, width, 'empty')
        await shot(page, `empty-${tag}`)
        await open(page, { scenario: 'denied', dir })
        await expect(page.getByRole('alert').filter({ hasText: 'Family access unavailable' })).toBeVisible()
        await expectNoOverflow(page, width, 'denied')
        await open(page, { scenario: 'error', dir })
        await expect(page.getByRole('alert').filter({ hasText: /Family services are unavailable/ })).toBeVisible()
        await shot(page, `error-${tag}`)
        mock.options.scenario = 'under14'
        await page.getByRole('button', { name: 'Try again' }).click()
        await expect(page.getByRole('list', { name: 'Conversations with Co' })).toBeVisible()
        records.push({ screen: 'states', dir: dir ?? 'ltr', viewport: width, ...(await overflow(page)) })
      })

      test('school policy: Ask Co and homework controls with the stricter-wins explanation', async ({ page }) => {
        await open(page, { scenario: 'under14', screen: 'policy', policy: 'set', dir })
        const group = page.getByRole('group', { name: 'Ask Co and homework help' })
        await expect(group).toBeVisible()
        await expect(group.getByText(/If a parent turns this off it stays off for that child; the lower hint limit wins\./)).toBeVisible()
        await expect(page.getByLabel('Hints per homework problem')).toHaveValue('2')
        await expectTargets(page, 'main select', 44, 'hint select')
        await page.getByRole('checkbox', { name: 'Allow Ask Co questions' }).uncheck()
        await page.getByLabel('Hints per homework problem').selectOption('0')
        await expectNoOverflow(page, width, 'policy')
        await shot(page, `policy-${tag}`)
        await page.getByRole('button', { name: 'Save reviewed restrictions' }).click()
        await expect(page.getByText(/School rules saved/)).toBeVisible()
        const put = mock.requests.find(request => request.method === 'PUT')
        expect(put?.body).toMatchObject({ settings: { askCoAllowed: false, homeworkHelpAllowed: true, homeworkHintsMax: 0 } })
        await expect(page.getByRole('checkbox', { name: 'Allow Ask Co questions' })).not.toBeChecked()
        records.push({ screen: 'policy', dir: dir ?? 'ltr', viewport: width, ...(await overflow(page)) })
      })
    })
  }
}
