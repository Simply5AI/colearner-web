import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AudienceTabs } from '@/components/landing/audience-tabs'

describe('Homepage audience tabs', () => {
  it('changes the details and destination for each audience without showing inactive panels', async () => {
    const user = userEvent.setup()
    render(<AudienceTabs />)
    expect(within(screen.getByRole('tabpanel')).getByRole('link', { name: 'Open your learning space' })).toHaveAttribute('href', '/login')
    await user.click(screen.getByRole('tab', { name: 'Parents' }))
    const panel = screen.getByRole('tabpanel', { name: 'Parents' })
    expect(within(panel).getByText(/school-issued child invitation/)).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Explore family access' })).toHaveAttribute('href', '/login?callbackUrl=/workspaces')
    expect(screen.queryByRole('link', { name: 'Open your learning space' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Teachers' }))
    expect(within(screen.getByRole('tabpanel')).getByText('Review before you share')).toBeInTheDocument()
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
  })
  it('supports arrow, Home and End keys with one tab stop and labelled panels', async () => {
    const user = userEvent.setup()
    render(<AudienceTabs />)
    await user.tab()
    expect(screen.getByRole('tab', { name: 'Students' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Parents' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Parents' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Students' })).toHaveAttribute('tabindex', '-1')
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Teachers' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Students' })).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Teachers' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('tabpanel', { name: 'Students' })).toHaveAttribute('aria-labelledby', screen.getByRole('tab', { name: 'Students' }).id)
  })
})
