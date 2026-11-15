import { render as rtlRender, screen, within, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoleShell } from '@/components/roles/role-shell'
import { ageBandFromDateOfBirth, matchesNavItem, studentNavigation, teacherNavigation } from '@/components/roles/role-config'
import type { WorkspaceRole } from '@/components/roles/role-config'
import { StudentShell } from '@/components/shared/AppSidebar'
import { TeacherShell } from '@/components/teacher/teacher-shell'

// The student shell reads the Tutor Loop entry with React Query; the app supplies the provider in lib/providers.
const render = (ui: ReactElement) =>
  rtlRender(ui, { wrapper: ({ children }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider> })

const pathnameMock = vi.hoisted(() => vi.fn(() => '/teacher/plans/plan-1'))
const profileMock = vi.hoisted(() => ({ dateOfBirth: null as string | null, name: 'Learner' }))
const signOutMock = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ usePathname: pathnameMock }))
vi.mock('@/lib/hooks/use-profile', () => ({ useProfile: () => ({ data: profileMock }) }))
vi.mock('next-auth/react', () => ({ signOut: signOutMock }))

function renderShell(role: WorkspaceRole = 'teacher', navigationStyle?: 'header' | 'sidebar') {
  return render(<RoleShell role={role} navigationStyle={navigationStyle} homeHref="/teacher/dashboard" navigation={teacherNavigation} identity="School teacher">
    <h1>Classes</h1><button>Page action</button>
  </RoleShell>)
}

describe('Shared role shell', () => {
  it('keeps nested plan routes active and provides skip-to-content focus', async () => {
    const user = userEvent.setup()
    renderShell()
    const nav = within(screen.getByRole('navigation', { name: 'Main' }))
    expect(nav.getByRole('link', { name: 'Classes & plans' })).toHaveAttribute('aria-current', 'page')
    expect(nav.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
    await user.click(screen.getByRole('link', { name: 'Skip to content' }))
    expect(screen.getByRole('main')).toHaveFocus()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('renders a sticky top header (no sidebar, no drawer) with every teacher destination and its href', () => {
    renderShell()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open navigation' })).not.toBeInTheDocument()
    expect(screen.getByTestId('top-header')).toHaveClass('sticky', 'top-0')
    const nav = within(screen.getByRole('navigation', { name: 'Main' }))
    expect(nav.getAllByRole('link').map((l) => [l.textContent, l.getAttribute('href')])).toEqual(teacherNavigation[0]!.items.map((i) => [i.label, i.href]))
  })

  it('opens an accessible drawer, traps keyboard focus, closes with Escape and restores focus', async () => {
    const user = userEvent.setup()
    renderShell('school-admin')
    const trigger = screen.getByRole('button', { name: 'Open navigation' })
    await user.click(trigger)
    const drawer = await screen.findByRole('dialog', { name: 'Navigation' })
    const close = within(drawer).getByRole('button', { name: 'Close navigation' })
    await waitFor(() => expect(close).toHaveFocus())
    await user.tab({ shift: true })
    await waitFor(() => expect(drawer.contains(document.activeElement)).toBe(true))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('closes the drawer on navigation and keeps all existing destinations reachable', async () => {
    const user = userEvent.setup()
    renderShell('school-admin')
    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    const drawer = await screen.findByRole('dialog', { name: 'Navigation' })
    const nav = within(drawer).getByRole('navigation', { name: 'Drawer navigation' })
    expect(within(nav).getByRole('link', { name: 'Students' })).toHaveAttribute('href', '/teacher/students')
    await user.click(within(nav).getByRole('link', { name: 'Students' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it.each<WorkspaceRole>(['parent', 'school-admin', 'researcher'])('supports %s presentation with only host-supplied links', (role) => {
    render(<RoleShell role={role} homeHref="/existing" navigation={[]}><h1>Workspace</h1></RoleShell>)
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Quick navigation' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Students' })).not.toBeInTheDocument()
  })
})

describe('Age presentation and navigation boundaries', () => {
  const today = new Date('2026-10-14T12:00:00Z')
  it.each([
    ['2017-10-14', 'kids'], ['2016-10-15', 'kids'], ['2016-10-14', 'tweens'],
    ['2012-10-15', 'tweens'], ['2012-10-14', 'teens'], ['2008-10-15', 'teens'], ['2008-10-14', 'adults'],
  ])('derives %s as %s at the birthday boundary', (birthday, band) => {
    expect(ageBandFromDateOfBirth(birthday, today)).toBe(band)
  })
  it.each([null, '', 'not-a-date', '2020-02-30', '2030-10-14', '2022-10-14'])('does not grant an age band for invalid or unsupported birth date %s', (birthday) => {
    expect(ageBandFromDateOfBirth(birthday, today)).toBeUndefined()
  })
  it('offers four large kid destinations without groups or due-count metrics', () => {
    const groups = studentNavigation('kids', true, 17)
    expect(groups[0]?.items).toHaveLength(4)
    expect(groups.flatMap((g) => g.items).some((i) => i.href === '/pods' || i.badge !== undefined)).toBe(false)
    expect(groups[0]?.items[1]?.label).toBe('My pages')
    expect(groups[0]?.items[1]?.href).toBe('/learn/library')
  })
  it('points Progress at the learner screen and hides account-only entries for a learner profile session', () => {
    for (const band of ['kids', 'tweens', 'teens'] as const) {
      const account = studentNavigation(band, true).flatMap((g) => g.items)
      expect(account.find((i) => i.label === 'Progress')?.href).toBe('/learn/progress')
      const hrefs = studentNavigation(band, true, 0, true).flatMap((g) => g.items).map((i) => i.href)
      for (const gone of ['/progress', '/trophies', '/settings', '/pods', '/dashboard/history', '/learn/enrolled']) expect(hrefs).not.toContain(gone)
      expect(hrefs).toContain('/learn/progress')
      expect(hrefs).toContain('/learn/practice')
    }
  })
  it('does not expose group navigation before an eligible known band', () => {
    for (const [band, known] of [['teens', false], ['tweens', true], ['kids', true]] as const) {
      expect(studentNavigation(band, known).flatMap((g) => g.items).some((i) => i.href === '/pods')).toBe(false)
    }
    expect(studentNavigation('teens', true).flatMap((g) => g.items).some((i) => i.href === '/pods')).toBe(true)
  })
  it('uses path boundaries rather than matching unrelated prefix routes', () => {
    expect(matchesNavItem('/teacher/plans-other', teacherNavigation[0]!.items[1]!)).toBe(false)
  })
})

describe('Mounted role adapters', () => {
  beforeEach(() => { profileMock.dateOfBirth = null; signOutMock.mockClear() })
  it('renders kid presentation from the profile without a client age switcher', () => {
    profileMock.dateOfBirth = '2018-01-01'
    const { container } = render(<StudentShell><h1>Home</h1></StudentShell>)
    expect(container.querySelector('[data-role="student"]')).toHaveAttribute('data-age-band', 'kids')
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link')).toHaveLength(4)
    expect(screen.queryByRole('navigation', { name: 'Quick navigation' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('keeps unknown-age presentation separate from permissions and allows consumer sign-out', async () => {
    profileMock.dateOfBirth = null
    const user = userEvent.setup()
    const { container } = render(<StudentShell><h1>Home</h1></StudentShell>)
    expect(container.querySelector('[data-role="student"]')).toHaveAttribute('data-age-band', 'teens')
    expect(screen.queryByRole('link', { name: 'Study Groups' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(signOutMock).toHaveBeenCalledWith({ redirectTo: '/login' })
  })

  it('keeps the learner top bar complete: primary items inline, the rest under More, with active state and profile-session hiding', async () => {
    profileMock.dateOfBirth = '2009-06-01'
    pathnameMock.mockReturnValue('/learn/progress')
    const user = userEvent.setup()
    const { unmount } = render(<StudentShell><h1>Home</h1></StudentShell>)
    const main = within(screen.getByRole('navigation', { name: 'Main' }))
    expect(main.getAllByRole('link').map((l) => l.textContent)).toEqual(['Home', 'Learn', 'Library', 'Practice', 'Me'])
    expect(main.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/learn/home')
    await user.click(main.getByRole('button', { name: /More/ }))
    const more = within(await screen.findByLabelText('More destinations'))
    expect(more.getAllByRole('link').map((l) => l.textContent)).toEqual(['Assigned learning', 'My pages', 'Progress', 'Achievements', 'History', 'Study Groups'])
    expect(more.getByRole('link', { name: 'Progress' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Use dark theme' })).toBeInTheDocument()
    unmount()
    render(<StudentShell profileSession><h1>Home</h1></StudentShell>)
    const profile = within(screen.getByRole('navigation', { name: 'Main' }))
    expect(profile.queryByRole('link', { name: 'Me' })).not.toBeInTheDocument()
    await user.click(profile.getByRole('button', { name: /More/ }))
    const profileMore = within(await screen.findByLabelText('More destinations'))
    expect(profileMore.queryByRole('link', { name: /Achievements|History|Assigned learning|Study Groups/ })).not.toBeInTheDocument()
    expect(profileMore.getByRole('link', { name: 'Progress' })).toHaveAttribute('href', '/learn/progress')
    pathnameMock.mockReturnValue('/teacher/plans/plan-1')
  })

  it('uses the consumer session sign-out in the teacher adapter', async () => {
    const user = userEvent.setup()
    render(<TeacherShell teacherName="Teacher"><h1>Classes</h1></TeacherShell>)
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(signOutMock).toHaveBeenCalledWith({ redirectTo: '/login' })
  })
})
