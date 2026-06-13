import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminOrgsView } from '@/components/admin/admin-orgs-view'
import type { AdminOrgListRow, AdminOrgsQuery, AdminOrgsResponse } from '@/lib/api/admin'

const replaceMock = vi.hoisted(() => vi.fn())
const refreshMock = vi.hoisted(() => vi.fn())
const createMock = vi.hoisted(() => vi.fn())
const archiveMock = vi.hoisted(() => vi.fn())
const toastSuccessMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())
let searchParamsValue = ''
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

vi.mock('@/lib/hooks/use-admin-mutation', () => ({
  useAdminMutation: () => ({
    runSensitive: <T,>(fn: () => Promise<T>) => fn(),
  }),
}))

vi.mock('@/lib/api/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/admin')>()
  return {
    ...actual,
    createAdminOrg: createMock,
    archiveAdminOrg: archiveMock,
  }
})

function makeOrg(overrides: Partial<AdminOrgListRow> = {}): AdminOrgListRow {
  return {
    id: 'org-1',
    name: 'Acme Learning',
    slug: 'acme-learning',
    type: 'TEAM',
    ssoEnabled: false,
    ownerId: 'owner-1',
    ownerEmail: 'owner@acme.test',
    createdAt: '2026-05-01T10:00:00.000Z',
    deletedAt: null,
    suspendedAt: null,
    memberCount: 12,
    mrr: 120,
    plan: 'PRO',
    ...overrides,
  }
}

function makeOrgs(overrides: Partial<AdminOrgsResponse> = {}): AdminOrgsResponse {
  return {
    total: 2,
    nextCursor: '25',
    items: [
      makeOrg(),
      makeOrg({
        id: 'org-2',
        name: 'Enterprise Academy',
        slug: 'enterprise-academy',
        type: 'ENTERPRISE',
        ssoEnabled: true,
        ownerId: 'owner-2',
        ownerEmail: 'owner@enterprise.test',
        createdAt: '2026-05-02T10:00:00.000Z',
        memberCount: 42,
        mrr: 49,
        plan: 'ENTERPRISE',
      }),
    ],
    ...overrides,
  }
}

function renderView(data = makeOrgs(), query: AdminOrgsQuery = {}) {
  return render(<AdminOrgsView data={data} query={{ sort: 'created_desc', limit: 25, ...query }} />)
}

describe('AdminOrgsView', () => {
  beforeEach(() => {
    searchParamsValue = ''
    replaceMock.mockReset()
    refreshMock.mockReset()
    createMock.mockReset()
    archiveMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
  })

  it('renders organizations, badges, MRR, owner email, and detail links', () => {
    renderView()

    expect(screen.getByRole('heading', { name: 'Organizations' })).toBeInTheDocument()
    expect(screen.getByText('2 total')).toBeInTheDocument()
    expect(screen.getByText('Acme Learning')).toBeInTheDocument()
    expect(screen.getByText('acme-learning')).toBeInTheDocument()
    expect(screen.getByText('Team')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('owner@acme.test')).toBeInTheDocument()
    expect(screen.getByText('$120')).toBeInTheDocument()
    expect(screen.getByText('$49')).toBeInTheDocument()
    expect(screen.getByText('On')).toBeInTheDocument()
    expect(screen.getByText('Off')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /acme learning/i })).toHaveAttribute('href', '/admin/orgs/org-1')
  })

  it('shows empty states with create and reset actions', () => {
    renderView({ total: 0, nextCursor: null, items: [] })

    expect(screen.getByText('No organizations yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create org/i })).toBeInTheDocument()

    renderView({ total: 0, nextCursor: null, items: [] }, { search: 'missing' })

    expect(screen.getByText('No organizations found')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset filters/i })).toBeInTheDocument()
  })

  it('debounces search into the URL query string', async () => {
    renderView()

    fireEvent.change(screen.getByPlaceholderText(/search name or slug/i), {
      target: { value: 'acme' },
    })

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/admin/orgs?search=acme', { scroll: false })
    }, { timeout: 1000 })
  })

  it('updates filters, sorting, page size, and pagination in the URL', async () => {
    const user = userEvent.setup()
    renderView()

    await user.click(screen.getByRole('checkbox', { name: /show archived/i }))
    expect(replaceMock).toHaveBeenCalledWith('/admin/orgs?showArchived=true', { scroll: false })

    await user.click(screen.getByRole('combobox', { name: /organization type/i }))
    await user.click(await screen.findByRole('option', { name: 'Enterprise' }))
    expect(replaceMock).toHaveBeenCalledWith('/admin/orgs?type=ENTERPRISE', { scroll: false })

    await user.click(screen.getByRole('combobox', { name: /organization sort/i }))
    await user.click(await screen.findByRole('option', { name: 'Highest MRR' }))
    expect(replaceMock).toHaveBeenCalledWith('/admin/orgs?sort=mrr_desc', { scroll: false })

    await user.click(screen.getByRole('combobox', { name: /rows per page/i }))
    await user.click(await screen.findByRole('option', { name: '50 rows' }))
    expect(replaceMock).toHaveBeenCalledWith('/admin/orgs?limit=50', { scroll: false })

    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(replaceMock).toHaveBeenCalledWith('/admin/orgs?cursor=25', { scroll: false })
  }, INTERACTION_TIMEOUT)

  it('validates create dialog before submitting', async () => {
    const user = userEvent.setup()
    renderView()

    await user.click(screen.getByRole('button', { name: /new org/i }))
    await user.type(screen.getByLabelText('Name'), 'Bad Slug Org')
    await user.type(screen.getByLabelText('Slug'), 'bad slug!')
    await user.type(screen.getByLabelText('Owner email'), 'owner@example.com')
    await user.click(screen.getByRole('button', { name: /^create org$/i }))

    expect(createMock).not.toHaveBeenCalled()
    expect(screen.getByText(/slug must be 3 to 40/i)).toBeInTheDocument()
  }, INTERACTION_TIMEOUT)

  it('creates an organization and refreshes the route', async () => {
    const user = userEvent.setup()
    createMock.mockResolvedValue(makeOrg({ name: 'New Company', ownerEmail: 'owner@new.test' }))
    renderView()

    await user.click(screen.getByRole('button', { name: /new org/i }))
    await user.type(screen.getByLabelText('Name'), 'New Company')
    await user.type(screen.getByLabelText('Slug'), 'new-company')
    await user.type(screen.getByLabelText('Owner email'), 'owner@new.test')
    await user.click(screen.getByRole('button', { name: /^create org$/i }))

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        {},
        {
          name: 'New Company',
          slug: 'new-company',
          type: 'TEAM',
          ownerEmail: 'owner@new.test',
          plan: 'FREE',
        }
      )
    })
    expect(toastSuccessMock).toHaveBeenCalledWith('Organization created', {
      description: 'New Company is ready for owner@new.test.',
    })
    expect(refreshMock).toHaveBeenCalled()
  }, INTERACTION_TIMEOUT)

  it('archives an active organization and disables archived rows', async () => {
    const user = userEvent.setup()
    archiveMock.mockResolvedValue({ success: true })
    renderView({
      total: 2,
      nextCursor: null,
      items: [
        makeOrg(),
        makeOrg({
          id: 'org-archived',
          name: 'Archived Org',
          slug: 'archived-org',
          deletedAt: '2026-05-20T10:00:00.000Z',
        }),
      ],
    })

    await user.click(screen.getByRole('button', { name: /actions for acme learning/i }))
    await user.click(await screen.findByRole('menuitem', { name: /archive org/i }))
    await user.click(screen.getByRole('button', { name: /^archive org$/i }))

    await waitFor(() => {
      expect(archiveMock).toHaveBeenCalledWith({}, 'org-1')
    })
    expect(toastSuccessMock).toHaveBeenCalledWith('Organization archived', {
      description: 'Acme Learning is now hidden from the active list.',
    })
    expect(refreshMock).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /actions for archived org/i }))
    expect(await screen.findByRole('menuitem', { name: /already archived/i })).toHaveAttribute('aria-disabled', 'true')
  }, INTERACTION_TIMEOUT)
})
