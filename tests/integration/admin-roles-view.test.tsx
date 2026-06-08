import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminRolesView } from '@/components/admin/admin-roles-view'
import type {
  AdminPermissionsGrouped,
  AdminRoleListItem,
  AdminRolesResponse,
} from '@/lib/api/admin'

const replaceMock = vi.hoisted(() => vi.fn())
const refreshMock = vi.hoisted(() => vi.fn())
const createMock = vi.hoisted(() => vi.fn())
const updateMock = vi.hoisted(() => vi.fn())
const deleteMock = vi.hoisted(() => vi.fn())
const getOrgsMock = vi.hoisted(() => vi.fn())
const toastSuccessMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())
let searchParamsValue = 'role=role-system-1'
const INTERACTION_TIMEOUT = 10_000

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock,
    push: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(searchParamsValue),
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
    createAdminRole: createMock,
    updateAdminRole: updateMock,
    deleteAdminRole: deleteMock,
    getAdminOrgs: getOrgsMock,
  }
})

function makeRole(overrides: Partial<AdminRoleListItem> = {}): AdminRoleListItem {
  return {
    id: 'role-system-1',
    name: 'Member',
    description: 'Default member role',
    isSystem: true,
    orgId: 'org-1',
    orgName: 'Demo Organization',
    assigneeCount: 3,
    permissionIds: ['perm-read-user'],
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  }
}

function makeRoles(overrides: Partial<AdminRolesResponse> = {}): AdminRolesResponse {
  return {
    items: [
      makeRole(),
      makeRole({
        id: 'role-custom-1',
        name: 'Coach',
        description: 'Coaching role',
        isSystem: false,
        assigneeCount: 0,
        permissionIds: ['perm-read-user', 'perm-read-extraction'],
      }),
      makeRole({
        id: 'role-custom-2',
        name: 'Reviewer',
        description: null,
        isSystem: false,
        orgName: 'Enterprise Academy',
        assigneeCount: 12,
        permissionIds: ['perm-read-user'],
      }),
    ],
    ...overrides,
  }
}

function makePermissions(): AdminPermissionsGrouped {
  return {
    groups: [
      {
        subject: 'User',
        permissions: [
          { id: 'perm-read-user', action: 'read', subject: 'User', description: null },
          { id: 'perm-manage-user', action: 'manage', subject: 'User', description: null },
        ],
      },
      {
        subject: 'Extraction',
        permissions: [
          { id: 'perm-read-extraction', action: 'read', subject: 'Extraction', description: null },
        ],
      },
    ],
  }
}

describe('AdminRolesView', () => {
  beforeEach(() => {
    replaceMock.mockReset()
    refreshMock.mockReset()
    createMock.mockReset()
    updateMock.mockReset()
    deleteMock.mockReset()
    getOrgsMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    searchParamsValue = 'role=role-system-1'
    getOrgsMock.mockResolvedValue({
      items: [
        {
          id: 'org-1',
          name: 'Demo Organization',
          slug: 'demo',
          type: 'TEAM',
          ssoEnabled: false,
          ownerId: 'owner-1',
          ownerEmail: 'owner@demo.test',
          createdAt: '2026-05-01T10:00:00.000Z',
          deletedAt: null,
          memberCount: 5,
          mrr: 12,
          plan: 'PRO',
        },
      ],
      nextCursor: null,
      total: 1,
    })
  })

  it(
    'renders system and custom role groups with permission matrix',
    () => {
      render(
        <AdminRolesView
          data={makeRoles()}
          permissions={makePermissions()}
          selectedRoleId="role-system-1"
        />
      )

      expect(screen.getByText('System roles')).toBeInTheDocument()
      expect(screen.getByText('Demo Organization')).toBeInTheDocument()
      expect(screen.getByText('Enterprise Academy')).toBeInTheDocument()
      expect(screen.getByText('Permission matrix')).toBeInTheDocument()
      expect(screen.getByText('Read only')).toBeInTheDocument()
    },
    INTERACTION_TIMEOUT
  )

  it(
    'selects a different role from the list',
    async () => {
      const user = userEvent.setup()
      render(
        <AdminRolesView
          data={makeRoles()}
          permissions={makePermissions()}
          selectedRoleId="role-system-1"
        />
      )

      await user.click(screen.getByRole('button', { name: /Coach/i }))
      expect(replaceMock).toHaveBeenCalledWith(
        '/admin/roles?role=role-custom-1',
        expect.objectContaining({ scroll: false })
      )
    },
    INTERACTION_TIMEOUT
  )

  it(
    'disables delete when assignees are still attached',
    () => {
      render(
        <AdminRolesView
          data={makeRoles()}
          permissions={makePermissions()}
          selectedRoleId="role-custom-2"
        />
      )

      expect(screen.getByRole('button', { name: /Delete/i })).toBeDisabled()
    },
    INTERACTION_TIMEOUT
  )

  it(
    'validates create role form before submitting',
    async () => {
      const user = userEvent.setup()
      render(
        <AdminRolesView
          data={makeRoles()}
          permissions={makePermissions()}
          selectedRoleId="role-system-1"
        />
      )

      await user.click(screen.getByRole('button', { name: /New role/i }))
      await waitFor(() => expect(getOrgsMock).toHaveBeenCalled())

      const form = screen.getByRole('button', { name: /Create role/i }).closest('form')
      expect(form).toBeTruthy()
      fireEvent.submit(form!)

      expect(createMock).not.toHaveBeenCalled()
      expect(screen.getByText('Name is required')).toBeInTheDocument()
    },
    INTERACTION_TIMEOUT
  )

  it(
    'enters edit mode for custom roles',
    async () => {
      const user = userEvent.setup()
      render(
        <AdminRolesView
          data={makeRoles()}
          permissions={makePermissions()}
          selectedRoleId="role-custom-1"
        />
      )

      await user.click(screen.getByRole('button', { name: /^Edit$/i }))
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Save changes/i })).toBeInTheDocument()
    },
    INTERACTION_TIMEOUT
  )
})
