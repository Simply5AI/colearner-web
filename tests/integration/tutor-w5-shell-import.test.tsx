import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getTutorFixture } from '@/lib/api/tutor-loop/fixtures'
import { setTutorLoopFixtureMode } from '@/lib/api/tutor-loop/client'
import { ImportTarget } from '@/components/tutor-loop/library/import-target'
import { TutorEntrySeedProvider, TutorShellProvider, useTutorShell } from '@/components/tutor-loop/shell/tutor-shell-context'

let search = new URLSearchParams()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/learn/import', useSearchParams: () => search }))

const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)
const State = () => <p data-testid="state">{useTutorShell().state}</p>

describe('W5 shell seed and import target', () => {
  beforeEach(() => { search = new URLSearchParams(); setTutorLoopFixtureMode(true) })
  afterEach(() => setTutorLoopFixtureMode(null))

  it('renders the tutor shell state on first paint from the server seed', () => {
    wrap(<TutorEntrySeedProvider seed={{ entry: getTutorFixture('entry') as never }}><TutorShellProvider><State /></TutorShellProvider></TutorEntrySeedProvider>)
    expect(screen.getByTestId('state').textContent).toBe('enabled')
  })

  it('keeps the legacy shell when the server says Tutor Loop is off', () => {
    wrap(<TutorEntrySeedProvider seed={{ disabled: true }}><TutorShellProvider><State /></TutorShellProvider></TutorEntrySeedProvider>)
    expect(screen.getByTestId('state').textContent).toBe('disabled')
  })

  it('offers plan topics in "Goes into" and keeps the library option', async () => {
    wrap(<TutorShellProvider><ImportTarget /></TutorShellProvider>)
    expect(await screen.findByRole('option', { name: 'Acids, bases and salts' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Keep in my library' })).toBeTruthy()
  })
})
