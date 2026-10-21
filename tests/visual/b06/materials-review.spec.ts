import { test, expect, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { MaterialConfig, MaterialDetail } from '@/lib/api/materials'

const output = path.resolve('output/b06')
const material: MaterialDetail = { id: 'material-a', title: 'Synthetic water source for browser qualification', sourceType: 'text', subjectId: 'subject-a', subjectName: 'Science', planId: null, planTitle: null, createdAt: '2026-10-15T00:00:00Z', updatedAt: '2026-10-15T00:00:00Z', status: 'processing', stage: 'concepts', progress: 60, jobId: 'job-a', sourceVersionRef: 'source-v1', concepts: [], error: null, links: { reader: null, lesson: null, practice: null }, actions: { retry: false, cancel: true, delete: true, addToPlan: true }, source: { text: 'Synthetic source text used only for browser qualification.', anchors: [] }, analysis: null }
const config: MaterialConfig = { enabled: true, band: 'teens', sources: [{ type: 'text', label: 'Pasted text', available: true, reason: null }, { type: 'pdf', label: 'PDF', available: true, reason: null }, { type: 'docx', label: 'Word', available: true, reason: null }, { type: 'pptx', label: 'PowerPoint', available: true, reason: null }, { type: 'image', label: 'Photo', available: false, reason: 'Image reading and automatic face redaction are unavailable.' }, { type: 'audio', label: 'Audio', available: false, reason: 'Audio transcription unavailable.' }, { type: 'web', label: 'Website', available: false, reason: 'External link reading unavailable.' }], limits: { maxFiles: 3, maxPages: 3, maxBytes: 10000000, maxTextLength: 20000, dailyLimit: 5, usedToday: 2 }, subjects: [{ id: 'subject-a', name: 'Science' }], plans: [{ id: 'plan-a', title: 'My science plan' }], faceRedaction: { verified: false }, lessonsAvailable: false, practiceAvailable: false }
async function fixtures(page: Page, options: { band?: 'kids' | 'tweens' | 'teens'; failImport?: boolean } = {}) {
  // Buffer/retry the real development layout after observed local aborted/invalid
  // asset responses. Application code and source data are never replaced here.
  await page.route('**/_next/static/chunks/app/layout.js', async route => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await route.fetch({ maxRetries: 2 })
        await route.fulfill({ status: response.status(), headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' }, body: await response.body() })
        return
      } catch (error) { if (attempt === 2) throw error }
    }
  })
  const state = { material: structuredClone(material), imports: [] as unknown[], lists: [] as string[] }
  await page.route('**/api/auth/session', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ expires: '2030-01-01T00:00:00Z', accessToken: 'b06-browser-fixture-session', user: { id: 'b06-browser-learner', name: 'B06 browser fixture', email: 'fixture@example.invalid', onboardingCompleted: true } }) }))
  await page.route('**/api/materials**', async route => {
    const request = route.request(), url = new URL(request.url())
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' }
    const reply = (data: unknown, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify({ data }) })
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (url.pathname.endsWith('/config')) return reply({ ...config, band: options.band ?? config.band })
    if (url.pathname.endsWith('/import')) { state.imports.push(request.postDataJSON()); return reply(options.failImport ? { message: 'Unavailable synthetic fixture' } : { items: [state.material] }, options.failImport ? 503 : 202) }
    if (url.pathname.endsWith('/cancel')) { state.material = { ...state.material, status: 'cancelled', stage: 'cancelled', actions: { ...state.material.actions, cancel: false, retry: true } }; return reply(state.material) }
    if (url.pathname.endsWith('/retry')) { state.material = { ...state.material, status: 'queued', stage: 'reading', progress: 0, actions: { ...state.material.actions, cancel: true, retry: false } }; return reply(state.material, 202) }
    if (url.pathname.endsWith('/bulk')) return reply({ updatedIds: ['material-a'] })
    if (url.pathname.endsWith('/material-a')) return reply(state.material)
    state.lists.push(url.search)
    return reply({ items: [state.material], total: 1, page: 1, limit: 20 })
  })
  return state
}
const records: unknown[] = []
for (const [width, band] of [[390, 'kids'], [1024, 'tweens'], [1440, 'teens']] as const) {
  test(`L4–L6 fit ${band} at ${width}px with unavailable source gates`, async ({ page }) => {
    await mkdir(output, { recursive: true })
    await fixtures(page, { band })
    await page.setViewportSize({ width, height: 1000 })
    for (const screen of ['library', 'import', 'snap']) {
      await page.goto(`/dev/materials?screen=${screen}`)
      await expect(page.getByRole('note')).toContainText('synthetic HTTP fixtures')
      if (screen === 'library') await expect(page.getByRole('heading', { name: material.title })).toBeVisible()
      if (screen === 'import') { await expect(page.getByLabel('Material title')).toBeVisible(); await page.getByRole('button', { name: /Photo/ }).click(); await expect(page.getByRole('button', { name: 'Read this material' })).toBeDisabled() }
      if (screen === 'snap') { await expect(page.getByRole('button', { name: 'Open camera' })).toBeVisible(); await expect(page.getByText(/Automatic face blurring is unavailable/)).toBeVisible() }
      const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(width)
      await page.screenshot({ path: path.join(output, `${screen}-${band}-${width}.png`), fullPage: true })
      records.push({ screen, band, ...dimensions })
    }
    await writeFile(path.join(output, 'viewport-results.json'), JSON.stringify({ date: '2026-10-15', kind: 'development-only-ui-with-synthetic-http-fixtures-no-model-or-database', cases: records.length, records }, null, 2))
    await writeFile(path.join(output, `viewport-${band}-${width}.json`), JSON.stringify({ date: '2026-10-15', kind: 'development-only-ui-with-synthetic-http-fixtures-no-model-or-database', records: records.filter(record => (record as { width: number }).width === width) }, null, 2))
  })
}
test('leave and return polls the durable API state; failed sending keeps draft and import key', async ({ page }) => {
  const state = await fixtures(page, { failImport: true })
  await page.goto('/dev/materials?screen=import')
  await page.getByLabel('Material title').fill('Synthetic water source')
  await page.getByLabel('Add to subject', { exact: true }).selectOption('subject-a')
  await page.getByLabel('Paste the source text', { exact: false }).fill('Synthetic water source text for this test.')
  await page.getByRole('button', { name: 'Read this material' }).click()
  await expect(page.getByText('This processor is unavailable. Choose an enabled source or try again later.')).toBeVisible()
  await expect(page.getByLabel('Paste the source text', { exact: false })).toHaveValue('Synthetic water source text for this test.')
  await page.getByRole('button', { name: 'Read this material' }).click()
  await expect.poll(() => state.imports.length).toBe(2)
  expect((state.imports[0] as { idempotencyKey: string }).idempotencyKey).toBe((state.imports[1] as { idempotencyKey: string }).idempotencyKey)
  await page.goto('/dev/materials?screen=import&material=material-a')
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '60')
  await page.goto('/dev/materials?screen=library')
  state.material = { ...state.material, status: 'ready', stage: 'ready', progress: 100, concepts: [{ id: 'concept-a', label: 'Synthetic evaporation concept' }], links: { reader: '/learn/library/material-a', lesson: null, practice: null }, actions: { ...state.material.actions, cancel: false } }
  await page.goto('/dev/materials?screen=import&material=material-a')
  await expect(page.getByText('Synthetic evaporation concept')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Start lesson' })).toHaveCount(0)
  expect(state.imports).toHaveLength(2)
})
test('camera denial, real upload/edit, ordered pages and unavailable send work without inference', async ({ page }) => {
  await fixtures(page)
  await page.addInitScript(() => { Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => Promise.reject(new DOMException('Synthetic denial', 'NotAllowedError')) } }) })
  await page.goto('/dev/materials?screen=snap')
  await page.getByRole('button', { name: 'Open camera' }).click()
  await expect(page.getByText(/Camera permission was denied/)).toBeVisible()
  const base64 = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 300; const context = canvas.getContext('2d')!; context.fillStyle = 'white'; context.fillRect(0, 0, 200, 300); context.fillStyle = 'black'; context.fillText('Synthetic page', 20, 50); return canvas.toDataURL('image/png').split(',')[1]! })
  for (let index = 1; index <= 2; index++) {
    await page.getByLabel('Upload a photo instead').setInputFiles({ name: `page-${index}.png`, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') })
    await page.getByLabel('Crop left').fill('5')
    await page.getByRole('button', { name: 'Rotate' }).click()
    await page.getByRole('button', { name: 'Use photo', exact: true }).click()
    await expect(page.getByText(`Page ${index}`, { exact: true })).toBeVisible()
  }
  await page.getByRole('button', { name: 'Move page 2 earlier' }).click()
  await expect(page.getByRole('button', { name: 'Move page 1 earlier' })).toBeDisabled()
  await page.getByRole('button', { name: 'Delete page 2', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Send 1 page for reading' })).toBeDisabled()
  await page.screenshot({ path: path.join(output, 'snap-upload-review.png'), fullPage: true })
})






