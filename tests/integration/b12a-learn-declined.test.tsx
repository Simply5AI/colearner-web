import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { learnOverviewSchema, type LearnOverview } from '@/lib/api/learn'
import { LearnOverviewView } from '@/components/learn/learn-overview'
import { overviewFixture } from '@/components/learn/dev/learn-fixtures'

afterEach(cleanup)
const withDeclined = (band: 'tweens' | 'teens'): LearnOverview => {
  const base = overviewFixture(band, 'approval-pending')
  return { ...base, pendingEnrollments: [...base.pendingEnrollments, { id: 'e-2', planTitle: 'Decimals', teacherName: 'Review teacher', status: 'DECLINED', requestedAt: new Date().toISOString() }] }
}
const view = (overview: LearnOverview) => render(<LearnOverviewView overview={overview} filters={{}} onFiltersChange={vi.fn()} onJoin={vi.fn()} />)

describe('B12A learner declined card', () => {
  it('the overview schema accepts DECLINED next to a waiting request', () => {
    expect(learnOverviewSchema.safeParse(withDeclined('tweens')).success).toBe(true)
  })
  it('shows a declined plan with the parent-said-no copy and no link, apart from the waiting one', () => {
    view(withDeclined('tweens'))
    expect(screen.getByRole('heading', { name: 'Waiting for your parent to say yes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your parent said no to this plan' })).toBeInTheDocument()
    const declined = screen.getByTestId('declined-enrollment')
    expect(declined).toHaveTextContent('Decimals')
    expect(within(declined).queryByRole('link')).toBeNull()
    expect(screen.getByTestId('pending-enrollment')).toHaveTextContent('Fractions')
  })
  it('uses the guardian wording for teens and shows no waiting heading when only declined remain', () => {
    const only = withDeclined('teens')
    view({ ...only, pendingEnrollments: only.pendingEnrollments.filter(item => item.status === 'DECLINED') })
    expect(screen.getByRole('heading', { name: 'Your parent or guardian said no to this plan' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Waiting for your parent/ })).toBeNull()
  })
})
