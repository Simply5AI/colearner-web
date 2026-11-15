import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setTutorLoopFixtureMode } from '@/lib/api/tutor-loop/client'
import { MyPlan } from '@/components/tutor-loop/learn/my-plan'
import { LibraryTab } from '@/components/tutor-loop/library/library-tab'
import { SearchOverlay } from '@/components/tutor-loop/search/search-overlay'
import { TutorShellProvider } from '@/components/tutor-loop/shell/tutor-shell-context'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/learn',
  useSearchParams: () => new URLSearchParams(),
}))

const wrap = (ui: React.ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><TutorShellProvider>{ui}</TutorShellProvider></QueryClientProvider>)
}

describe('W5 Learn and search', () => {
  beforeEach(() => setTutorLoopFixtureMode(true))
  afterEach(() => setTutorLoopFixtureMode(null))

  it('shows plan topics grouped by subject and opens topic actions', async () => {
    wrap(<MyPlan goalId={null} />)
    expect(await screen.findByRole('heading', { name: 'Chemistry' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Acids, bases and salts/ }))
    expect(screen.getByRole('link', { name: 'Practise' })).toBeTruthy()
  })

  it('lists library material with the count line', async () => {
    wrap(<LibraryTab goalId={null} />)
    expect(await screen.findByText('Class notes · Acids and bases')).toBeTruthy()
    expect(screen.getByText(/1 item/)).toBeTruthy()
  })

  it('searches and groups results, with a clear-length hint first', async () => {
    wrap(<SearchOverlay onClose={() => {}} />)
    expect(screen.getByText(/at least 2 letters/)).toBeTruthy()
    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'acid')
    await waitFor(() => expect(screen.getByText('Acids, bases and salts')).toBeTruthy(), { timeout: 3000 })
    expect(screen.getByRole('button', { name: 'Notes' })).toBeTruthy()
  })
})
