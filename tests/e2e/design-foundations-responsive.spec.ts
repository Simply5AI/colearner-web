import { expect, test } from '@playwright/test'

test('auth mascot display utilities prevent overflow across viewport breakpoints', async ({ page }) => {
  for (const width of [390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/login')
    await expect(page.getByRole('heading', { level: 1, name: /keep learning/i })).toBeVisible()
    // The responsive brand panel has one small and one large pose. Exactly one
    // must participate in layout, using the compiled Tailwind/CSS cascade.
    const mascots = page.locator('[data-co-state="waving"]')
    await expect(mascots).toHaveCount(2)
    const visible = await mascots.evaluateAll((elements) => elements.filter((element) => getComputedStyle(element).display !== 'none').length)
    expect(visible).toBe(1)
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width)
  }
})

test('reduced motion stops the Co wave and theme controls apply accessible source colours', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
  await page.goto('/login')
  await expect(page.getByRole('heading', { level: 1, name: /keep learning/i })).toBeVisible()
  const wave = page.locator('.ds-co-wave').first()
  await expect(wave).toHaveCSS('animation-name', 'none')
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await page.getByRole('button', { name: 'Use dark theme' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(23, 23, 30)')
  await expect(page.locator('body')).toHaveCSS('color', 'rgb(245, 245, 249)')
  await expect(wave).toHaveCSS('animation-name', 'none')
  await page.getByRole('button', { name: 'Use light theme' }).click()
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
})
