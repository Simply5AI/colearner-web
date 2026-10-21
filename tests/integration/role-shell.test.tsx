import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoleShell } from '@/components/roles/role-shell'
import { ageBandFromDateOfBirth, matchesNavItem, studentNavigation, teacherNavigation } from '@/components/roles/role-config'
import type { WorkspaceRole } from '@/components/roles/role-config'
import { StudentShell } from '@/components/shared/AppSidebar'
import { TeacherShell } from '@/components/teacher/teacher-shell'

const pathnameMock = vi.hoisted(() => vi.fn(() => '/teacher/plans/plan-1'))
const profileMock = vi.hoisted(() => ({ dateOfBirth: null as string | null, name: 'Learner' }))
const signOutMock = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ usePathname: pathnameMock }))
vi.mock('@/lib/hooks/use-profile', () => ({ useProfile: () => ({ data: profileMock }) }))
vi.mock('next-auth/react', () => ({ signOut: signOutMock }))

function renderShell(role: WorkspaceRole = 'teacher') {
  return render(<RoleShell role={role} homeHref="/teacher/dashboard" navigation={teacherNavigation} identity="School teacher">
    <h1>Classes</h1><button>Page action</button>
  </RoleShell>)
}

describe('Shared role shell', () => {
  it('keeps nested plan routes active and provides skip-to-content focus', async () => {
    const user = userEvent.setup()
    renderShell()
    const nav = within(screen.getByRole('navigation', { name: 'Primary navigation' }))
    expect(nav.getByRole('link', { name: 'Classes & plans' })).toHaveAttribute('aria-current', 'page')
    expect(nav.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
    await user.click(screen.getByRole('link', { name: 'Skip to content' }))
    expect(screen.getByRole('main')).toHaveFocus()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('opens an accessible drawer, traps keyboard focus, closes with Escape and restores focus', async () => {
    const user = userEvent.setup()
    renderShell()
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
    renderShell()
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
    expect(within(screen.getByRole('navigation', { name: 'Quick navigation' })).getAllByRole('link')).toHaveLength(4)
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

  it('uses the consumer session sign-out in the teacher adapter', async () => {
    const user = userEvent.setup()
    render(<TeacherShell teacherName="Teacher"><h1>Classes</h1></TeacherShell>)
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(signOutMock).toHaveBeenCalledWith({ redirectTo: '/login' })
  })
})
