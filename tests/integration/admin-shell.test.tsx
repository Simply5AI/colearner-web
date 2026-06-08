import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AdminShell } from '@/components/admin/admin-shell'

const pathnameMock = vi.hoisted(() => vi.fn(() => '/admin'))

vi.mock('next/navigation', () => ({
  usePathname: pathnameMock,
}))

function renderShell() {
  return render(
    <AdminShell adminEmail="admin@example.com">
      <div>Admin content</div>
    </AdminShell>
  )
}

describe('AdminShell', () => {
  beforeEach(() => {
    pathnameMock.mockReset()
    pathnameMock.mockReturnValue('/admin')
  })

  it('links the Learning sidebar item to the learning directory', () => {
    renderShell()

    expect(screen.getByRole('link', { name: /^Learning$/i })).toHaveAttribute('href', '/admin/learning')
  })

  it('highlights Learning for per-user learning routes instead of Users', () => {
    pathnameMock.mockReturnValue('/admin/users/user-1/learning/sessions')
    renderShell()

    expect(screen.getByRole('link', { name: /^Learning$/i })).toHaveClass('text-primary')
    expect(screen.getByRole('link', { name: /^Users$/i })).not.toHaveClass('text-primary')
  })

  it('keeps ordinary user detail routes under Users', () => {
    pathnameMock.mockReturnValue('/admin/users/user-1')
    renderShell()

    expect(screen.getByRole('link', { name: /^Users$/i })).toHaveClass('text-primary')
    expect(screen.getByRole('link', { name: /^Learning$/i })).not.toHaveClass('text-primary')
  })
})
