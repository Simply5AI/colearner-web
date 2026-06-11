import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RolesTab } from '@/components/admin/admin-user-detail/roles-tab'
import type { AdminUserDetail } from '@/lib/api/admin'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    replace: vi.fn(),
    push: vi.fn(),
  }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

function makeDetail(): AdminUserDetail {
  return {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    avatarUrl: null,
    systemRole: 'MEMBER',
    status: 'ACTIVE',
    org: { id: 'org-1', name: 'Demo Org', slug: 'demo', type: 'PERSONAL' },
    lastActiveAt: null,
    createdAt: '2026-05-01T10:00:00.000Z',
    suspendedAt: null,
    deletedAt: null,
    suspendedBy: null,
    suspensionReason: null,
    updatedAt: '2026-05-01T10:00:00.000Z',
    onboardingCompleted: true,
    bio: null,
    roles: [
      {
        id: 'assign-1',
        roleId: 'role-member',
        roleName: 'Member',
        isSystem: true,
        description: 'Member system role',
        orgId: 'org-1',
        orgName: 'Demo Org',
        assignedAt: '2026-05-16T10:00:00.000Z',
      },
    ],
    subscription: null,
    activityCount: 0,
    availableRoles: [
      { id: 'role-member', name: 'Member', isSystem: true, orgId: null },
      { id: 'role-admin', name: 'ORG_ADMIN', isSystem: true, orgId: null },
      { id: 'role-custom', name: 'Content Editor', isSystem: false, orgId: 'org-1' },
    ],
  }
}

describe('RolesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows role names in the assign dropdown instead of GUIDs', async () => {
    const user = userEvent.setup()
    render(<RolesTab detail={makeDetail()} currentAdminId="admin-1" authHeaders={{}} />)

    await user.click(screen.getByRole('combobox'))

    expect(screen.getByRole('option', { name: 'Org Admin (system)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Content Editor (org)' })).toBeInTheDocument()
    expect(screen.queryByText('role-admin')).not.toBeInTheDocument()
  })
})