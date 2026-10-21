import { test, expect, type Page } from '@playwright/test'

class ShellInsetReview {
  constructor(readonly page: Page) {}
  async goto(role: string, band: string) {
    await this.page.setViewportSize({ width: 390, height: 844 })
    await this.page.goto(`/tests/visual/b01/?role=${role}&band=${band}&dir=rtl&long=1`)
    await expect(this.page.getByRole('navigation', { name: 'Quick navigation' })).toBeVisible()
  }
  async geometry() {
    return this.page.getByRole('navigation', { name: 'Quick navigation' }).evaluate((nav) => {
      const main = document.querySelector('main')!
      return { navHeight: nav.getBoundingClientRect().height, navTop: nav.getBoundingClientRect().top, inset: parseFloat(getComputedStyle(main).paddingBottom) }
    })
  }
  async expectReservedHeight() {
    await expect.poll(async () => {
      const { navHeight, inset } = await this.geometry()
      return inset >= navHeight
    }).toBe(true)
  }
  async expectFinalControlUnobscured() {
    const action = this.page.getByRole('main').getByRole('button', { name: 'Fixture end action', exact: true })
    await expect(action).toBeVisible()
    await this.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect.poll(async () => {
      const rect = await action.boundingBox()
      const { navTop } = await this.geometry()
      return rect !== null && rect.y >= 0 && rect.y + rect.height <= navTop
    }).toBe(true)
  }
}

for (const [role, band] of [['student', 'kids'], ['researcher', 'adults']] as const) {
  test(`${role} ${band} reserves translated quick navigation at 390 RTL`, async ({ page }) => {
    const review = new ShellInsetReview(page)
    await review.goto(role, band)
    await review.expectReservedHeight()
    await review.expectFinalControlUnobscured()

    const before = (await review.geometry()).navHeight
    // A user stylesheet/text setting or a late font can alter label wrapping
    // without a viewport event. ResizeObserver must update the inset too.
    await page.getByRole('navigation', { name: 'Quick navigation' }).evaluate((nav) => {
      nav.querySelectorAll('span').forEach((span) => { span.style.fontSize = '24px'; span.style.lineHeight = '1.6' })
    })
    await expect.poll(async () => (await review.geometry()).navHeight).toBeGreaterThan(before)
    await review.expectReservedHeight()
    await review.expectFinalControlUnobscured()

    await page.setViewportSize({ width: 360, height: 844 })
    await review.expectReservedHeight()
    await review.expectFinalControlUnobscured()

    await page.setViewportSize({ width: 1024, height: 900 })
    await expect(page.getByRole('navigation', { name: 'Quick navigation' })).toBeHidden()
    await expect.poll(() => page.getByRole('main').evaluate((main) => getComputedStyle(main).paddingBottom)).toBe('0px')
  })
}
