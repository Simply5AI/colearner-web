import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminOrgDetailView } from '@/components/admin/admin-org-detail-view'
import type { AdminOrgDetail, AdminOrgMembersResponse } from '@/lib/api/admin'

const refreshMock = vi.hoisted(() => vi.fn())
const patchOrgMock = vi.hoisted(() => vi.fn())
const updatePlanMock = vi.hoisted(() => vi.fn())
const transferMock = vi.hoisted(() => vi.fn())
const archiveMock = vi.hoisted(() => vi.fn())
const inviteMock = vi.hoisted(() => vi.fn())
const removeMock = vi.hoisted(() => vi.fn())
const updateRoleMock = vi.hoisted(() => vi.fn())
const toastSuccessMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())
const INTERACTION_TIMEOUT = 10_000

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: refreshMock,
    replace: vi.fn(),
    push: vi.fn(),
  }),
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { accessToken: 'token' } }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
    warning: vi.fn(),
  },
}))

vi.mock('@/lib/api/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/admin')>()
  return {
    ...actual,
    patchAdminOrg: patchOrgMock,
    updateAdminOrgPlan: updatePlanMock,
    transferAdminOrgOwnership: transferMock,
    archiveAdminOrg: archiveMock,
    inviteAdminOrgMember: inviteMock,
    removeAdminOrgMember: removeMock,
    updateAdminOrgMemberRole: updateRoleMock,
  }
})

function makeDetail(overrides: Partial<AdminOrgDetail> = {}): AdminOrgDetail {
  return {
    id: 'org-1',
    name: 'Acme Learning',
    slug: 'acme-learning',
    type: 'ENTERPRISE',
    ssoEnabled: true,
    owner: {
      id: 'owner-1',
      name: 'Owner User',
      email: 'owner@acme.test',
    },
    plan: 'PRO',
    billingCycle: 'MONTHLY',
    nextRenewal: '2026-07-01T00:00:00.000Z',
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-20T10:00:00.000Z',
    deletedAt: null,
    stats: {
      memberCount: 2,
      extractionCount: 7,
      recallSessionCount: 15,
      mrr: 120,
    },
    availableRoles: [
      { id: 'admin-role', name: 'Org Admin', description: null, isSystem: true, orgId: null },
      { id: 'member-role', name: 'Member', description: null, isSystem: true, orgId: null },
    ],
    ...overrides,
  }
}

function makeMembers(overrides: Partial<AdminOrgMembersResponse> = {}): AdminOrgMembersResponse {
  return {
    nextCursor: null,
    items: [
      {
        id: 'owner-1',
        name: 'Owner User',
        email: 'owner@acme.test',
        avatarUrl: null,
        systemRole: 'ORG_ADMIN',
        roleId: 'admin-role',
        role: 'Org Admin',
        joinedAt: '2026-05-01T10:00:00.000Z',
        lastActiveAt: '2026-05-20T10:00:00.000Z',
      },
      {
        id: 'member-1',
        name: 'Member User',
        email: 'member@acme.test',
        avatarUrl: null,
        systemRole: 'MEMBER',
        roleId: 'member-role',
        role: 'Member',
        joinedAt: '2026-05-05T10:00:00.000Z',
        lastActiveAt: null,
      },
    ],
    ...overrides,
  }
}

function renderView(detail = makeDetail(), members = makeMembers()) {
  return render(<AdminOrgDetailView detail={detail} initialMembers={members} />)
}

describe('AdminOrgDetailView', () => {
  beforeEach(() => {
    refreshMock.mockReset()
    patchOrgMock.mockReset()
    updatePlanMock.mockReset()
    transferMock.mockReset()
    archiveMock.mockReset()
    inviteMock.mockReset()
    removeMock.mockReset()
    updateRoleMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
  })

  it('renders the header, overview stats, and back link', () => {
    renderView()

    expect(screen.getByRole('link', { name: /back to organizations/i })).toHaveAttribute('href', '/admin/orgs')
    expect(screen.getByRole('heading', { name: 'Acme Learning' })).toBeInTheDocument()
    expect(screen.getAllByText('acme-learning').length).toBeGreaterThan(0)
    expect(screen.getByText('Enterprise')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getAllByText('Members').length).toBeGreaterThan(0)
    expect(screen.getByText('Extractions')).toBeInTheDocument()
    expect(screen.getByText('Recall sessions')).toBeInTheDocument()
    expect(screen.getByText('$120')).toBeInTheDocument()
  })

  it('renders members and prevents removing the owner', async () => {
    const user = userEvent.setup()
    renderView()

    await user.click(screen.getByRole('tab', { name: /members/i }))

    expect(screen.getByText('owner@acme.test')).toBeInTheDocument()
    expect(screen.getByText('member@acme.test')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /actions for owner@acme.test/i }))
    expect(await screen.findByRole('menuitem', { name: /remove member/i })).toHaveAttribute('aria-disabled', 'true')
  }, INTERACTION_TIMEOUT)

  it('changes plan from the action menu', async () => {
    const user = userEvent.setup()
    updatePlanMock.mockResolvedValue(makeDetail({ plan: 'ENTERPRISE' }))
    renderView()

    await user.click(screen.getByRole('button', { name: /actions/i }))
    await user.click(await screen.findByRole('menuitem', { name: /change plan/i }))
    await user.click(screen.getByRole('combobox', { name: /^plan$/i }))
    await user.click(await screen.findByRole('option', { name: 'Enterprise' }))
    await user.click(screen.getByRole('button', { name: /save plan/i }))

    await waitFor(() => {
      expect(updatePlanMock).toHaveBeenCalledWith(
        { Authorization: 'Bearer token' },
        'org-1',
        { plan: 'ENTERPRISE', billingCycle: 'MONTHLY' }
      )
    })
    expect(toastSuccessMock).toHaveBeenCalledWith('Plan updated')
    expect(refreshMock).toHaveBeenCalled()
  }, INTERACTION_TIMEOUT)

  it('saves organization settings with optimistic timestamp', async () => {
    const user = userEvent.setup()
    patchOrgMock.mockResolvedValue(makeDetail({ name: 'Acme Updated' }))
    renderView()

    await user.click(screen.getByRole('tab', { name: /settings/i }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Acme Updated' } })
    await user.click(screen.getByRole('button', { name: /save settings/i }))

    await waitFor(() => {
      expect(patchOrgMock).toHaveBeenCalledWith(
        { Authorization: 'Bearer token' },
        'org-1',
        {
          name: 'Acme Updated',
          slug: 'acme-learning',
          type: 'ENTERPRISE',
          ssoEnabled: true,
          updatedAt: '2026-05-20T10:00:00.000Z',
        }
      )
    })
  }, INTERACTION_TIMEOUT)

  it('invites a member with the default member role', async () => {
    const user = userEvent.setup()
    inviteMock.mockResolvedValue({
      id: 'member-2',
      name: 'new',
      email: 'new@acme.test',
      avatarUrl: null,
      systemRole: 'MEMBER',
      roleId: 'member-role',
      role: 'Member',
      joinedAt: '2026-06-01T10:00:00.000Z',
      lastActiveAt: null,
    })
    renderView()

    await user.click(screen.getByRole('tab', { name: /members/i }))
    await user.click(screen.getByRole('button', { name: /invite member/i }))
    await user.type(screen.getByLabelText('Email'), 'new@acme.test')
    await user.click(screen.getByRole('button', { name: /send invite/i }))

    await waitFor(() => {
      expect(inviteMock).toHaveBeenCalledWith(
        { Authorization: 'Bearer token' },
        'org-1',
        { email: 'new@acme.test', roleId: 'member-role' }
      )
    })
    expect(toastSuccessMock).toHaveBeenCalledWith('Member invited')
  }, INTERACTION_TIMEOUT)

  it('archives only after slug confirmation', async () => {
    const user = userEvent.setup()
    archiveMock.mockResolvedValue({ success: true })
    renderView()

    await user.click(screen.getByRole('button', { name: /actions/i }))
    await user.click(await screen.findByRole('menuitem', { name: /archive org/i }))
    expect(screen.getByRole('button', { name: /^archive org$/i })).toBeDisabled()

    await user.type(screen.getByLabelText(/slug confirmation/i), 'acme-learning')
    await user.click(screen.getByRole('button', { name: /^archive org$/i }))

    await waitFor(() => {
      expect(archiveMock).toHaveBeenCalledWith({ Authorization: 'Bearer token' }, 'org-1')
    })
    expect(toastSuccessMock).toHaveBeenCalledWith('Organization archived')
  }, INTERACTION_TIMEOUT)
})
