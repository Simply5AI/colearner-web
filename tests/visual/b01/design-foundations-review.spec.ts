import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'

/** Local visual fixture only. No live school membership or backend E2E claim. */
const fixture = 'http://localhost:3103/tests/visual/b01/'
const output = path.resolve(process.cwd(), 'output/playwright/b01')

test('controlled learning widgets fit phone layouts and gate unavailable voice', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  for (const band of ['kids', 'adults']) {
    await page.goto(`${fixture}?role=${band === 'kids' ? 'student' : 'parent'}&band=${band}`)
    await page.getByRole('radio', { name: 'Text-only option' }).click()
    await expect(page.getByRole('radio', { name: 'Text-only option' })).toBeChecked()
    await page.getByRole('button', { name: 'Need help?' }).click()
    await page.getByRole('button', { name: 'Show next hint' }).click()
    await page.getByRole('button', { name: 'Show next hint' }).click()
    await expect(page.getByRole('button', { name: 'All hints shown' })).toBeDisabled()
    await expect(page.getByText('Caller-supplied similar example.')).toBeVisible()
    for (const voice of await page.getByRole('button', { name: 'Read aloud', exact: true }).all()) await expect(voice).toBeDisabled()
    if (band === 'adults') {
      await page.getByRole('button', { name: 'Hide Co' }).click()
      await expect(page.locator('[data-co-dock-band]')).toHaveCount(0)
      await page.getByRole('button', { name: 'Show Co' }).click()
      await expect(page.locator('[data-co-dock-band="adults"]')).toBeVisible()
    }
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width)
  }
})

test('reduced motion stops the idle pose in the real role-shell fixture', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${fixture}?role=student&band=kids`)
  const idle = page.locator('[data-co-state="idle"] .ds-co-body').first()
  await expect(idle).toHaveCSS('animation-name', 'none')
})

test('capture public, auth and scoped shell review screenshots', async ({ page }) => {
  await mkdir(output, { recursive: true })
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
  for (const capture of [
    { file: 'landing-desktop.png', width: 1440, url: 'http://localhost:3101/' },
    { file: 'login-phone.png', width: 390, url: 'http://localhost:3101/login' },
    { file: 'kids-shell-phone.png', width: 390, url: `${fixture}?role=student&band=kids` },
    { file: 'parent-shell-rtl-phone.png', width: 390, url: `${fixture}?role=parent&band=adults&dir=rtl&long=1` },
  ]) {
    await page.setViewportSize({ width: capture.width, height: 900 })
    await page.goto(capture.url)
    await page.evaluate(() => document.fonts.ready)
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width)
    await page.screenshot({ path: path.join(output, capture.file), fullPage: true, animations: 'disabled' })
  }
})
