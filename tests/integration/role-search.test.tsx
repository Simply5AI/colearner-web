import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommandSearch } from '@/components/shared/CommandSearch'

const profile = vi.hoisted(() => ({ dateOfBirth: null as string | null }))
const push = vi.hoisted(() => vi.fn())
vi.mock('@/lib/hooks/use-profile', () => ({ useProfile: () => ({ data: profile }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

describe('Role-aware page search', () => {
  beforeEach(() => { profile.dateOfBirth = null; push.mockReset() })

  it.each([null, '2018-01-01', '2014-01-01'])('omits group navigation for an unknown/kid/tween profile %s', async (birthday) => {
    profile.dateOfBirth = birthday
    const user = userEvent.setup()
    render(<CommandSearch />)
    await user.click(screen.getByRole('button', { name: 'Search pages' }))
    const dialog = await screen.findByRole('dialog', { name: 'Search pages' })
    expect(within(dialog).queryByRole('button', { name: 'Study Groups' })).not.toBeInTheDocument()
  })

  it('preserves filtering, keyboard entry and router navigation for a known teen', async () => {
    profile.dateOfBirth = '2010-01-01'
    const user = userEvent.setup()
    render(<CommandSearch />)
    await user.keyboard('{Control>}k{/Control}')
    const dialog = await screen.findByRole('dialog', { name: 'Search pages' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Search pages' }), 'group')
    await user.click(within(dialog).getByRole('button', { name: 'Study Groups' }))
    expect(push).toHaveBeenCalledWith('/pods')
  })
})
