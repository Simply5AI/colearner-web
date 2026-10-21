import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AdminShell } from '@/components/admin/admin-shell'

const pathnameMock = vi.hoisted(() => vi.fn(() => '/admin'))

vi.mock('next/navigation', () => ({
  usePathname: pathnameMock,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
}))

function renderShell() {
  return render(
    <AdminShell adminEmail="admin@example.com">
      <div>Admin content</div>
    </AdminShell>
  )
}

function navigation() { return within(screen.getByRole('navigation', { name: 'Primary navigation' })) }

describe('AdminShell', () => {
  beforeEach(() => {
    pathnameMock.mockReset()
    pathnameMock.mockReturnValue('/admin')
  })

  it('links the Learning sidebar item to the learning directory', () => {
    renderShell()

    expect(navigation().getByRole('link', { name: /^Learning$/i })).toHaveAttribute('href', '/admin/learning')
  })

  it('highlights Learning for per-user learning routes instead of Users', () => {
    pathnameMock.mockReturnValue('/admin/users/user-1/learning/sessions')
    renderShell()

    expect(navigation().getByRole('link', { name: /^Learning$/i })).toHaveAttribute('aria-current', 'page')
    expect(navigation().getByRole('link', { name: /^Users$/i })).not.toHaveAttribute('aria-current')
  })

  it('keeps ordinary user detail routes under Users', () => {
    pathnameMock.mockReturnValue('/admin/users/user-1')
    renderShell()

    expect(navigation().getByRole('link', { name: /^Users$/i })).toHaveAttribute('aria-current', 'page')
    expect(navigation().getByRole('link', { name: /^Learning$/i })).not.toHaveAttribute('aria-current')
  })
})
