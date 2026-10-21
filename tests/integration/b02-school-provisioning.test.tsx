import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SchoolProvisioning } from '@/components/admin/school-provisioning'
import ProvisioningPage from '@/app/(admin)/admin/schools/page'

const mocks = vi.hoisted(() => ({ reauth: vi.fn(), api: vi.fn(), guard: vi.fn() }))
vi.mock('@/components/admin/admin-auth/admin-reauth-provider', () => ({ useAdminReauth: () => ({ requestReauth: mocks.reauth }) }))
vi.mock('@/lib/api/admin-browser', () => ({ adminBrowserClient: mocks.api }))
vi.mock('@/lib/api/admin-session', () => ({ requireAdminSession: mocks.guard }))
const school = '10000000-0000-4000-8000-000000000001'
const account = '10000000-0000-4000-8000-000000000002'
const member = '10000000-0000-4000-8000-000000000003'
async function fillProvision() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Organisation ID'), school)
  await user.type(screen.getByLabelText('Verified administrator account ID'), account)
  await user.type(screen.getByLabelText('School name'), 'Review school')
  return user
}
beforeEach(() => { vi.clearAllMocks(); mocks.reauth.mockResolvedValue(true) })
describe('B02 platform-approved school lifecycle', () => {
  it('keeps the server admin-session guard on the new page', async () => {
    await ProvisioningPage()
    expect(mocks.guard).toHaveBeenCalledOnce()
    mocks.guard.mockRejectedValueOnce(new Error('admin session unavailable'))
    await expect(ProvisioningPage()).rejects.toThrow('admin session unavailable')
  })
  it('rejects invalid record IDs before any step-up or API request', async () => {
    render(<SchoolProvisioning />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Organisation ID'), 'wrong')
    await user.type(screen.getByLabelText('Verified administrator account ID'), account)
    await user.type(screen.getByLabelText('School name'), 'Review school')
    await user.click(screen.getByRole('button', { name: 'Provision school' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('valid organisation')
    expect(mocks.reauth).not.toHaveBeenCalled()
    expect(mocks.api).not.toHaveBeenCalled()
  })
  it('cancels without mutation and retains the complete draft', async () => {
    mocks.reauth.mockResolvedValueOnce(false)
    render(<SchoolProvisioning />)
    const user = await fillProvision()
    await user.click(screen.getByRole('button', { name: 'Provision school' }))
    expect(mocks.reauth).toHaveBeenCalledOnce()
    expect(mocks.api).not.toHaveBeenCalled()
    expect(screen.getByLabelText('School name')).toHaveValue('Review school')
  })
  it('uses the cookie BFF after fresh authentication and prevents duplicate success', async () => {
    mocks.api.mockResolvedValueOnce({ id: member, organizationId: school, name: 'Review school', status: 'ACTIVE' })
    render(<SchoolProvisioning />)
    const user = await fillProvision()
    await user.click(screen.getByRole('button', { name: 'Provision school' }))
    expect(await screen.findByRole('status')).toHaveTextContent('is provisioned')
    expect(mocks.api).toHaveBeenCalledWith('/schools', expect.objectContaining({ method: 'POST', body: { organizationId: school, adminUserId: account, name: 'Review school' } }))
    expect(screen.getByRole('button', { name: 'Provision school' })).toBeDisabled()
  })
  it('retains the draft and reports a backend conflict without success', async () => {
    mocks.api.mockRejectedValueOnce(new Error('School already exists; review its membership'))
    render(<SchoolProvisioning />)
    const user = await fillProvision()
    await user.click(screen.getByRole('button', { name: 'Provision school' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('School already exists')
    expect(screen.getByLabelText('Verified administrator account ID')).toHaveValue(account)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  it('grants only school-admin membership through the protected scoped endpoint', async () => {
    mocks.api.mockResolvedValueOnce({ id: member, role: 'SCHOOL_ADMIN', status: 'ACTIVE' })
    render(<SchoolProvisioning />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Managed school ID'), school)
    await user.type(screen.getByLabelText('Additional verified administrator account ID'), account)
    await user.click(screen.getByRole('button', { name: 'Grant school administrator' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Platform authority was not changed')
    expect(mocks.reauth).toHaveBeenCalledOnce()
    expect(mocks.api).toHaveBeenCalledWith(`/schools/${school}/memberships`, expect.objectContaining({ method: 'POST', body: { userId: account, role: 'SCHOOL_ADMIN' } }))
  })
  it('revokes school membership with fresh step-up and explicit status', async () => {
    mocks.api.mockResolvedValueOnce({ id: member, role: 'SCHOOL_ADMIN', status: 'SUSPENDED' })
    render(<SchoolProvisioning />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Managed school ID'), school)
    await user.type(screen.getByLabelText('Managed membership ID'), member)
    await user.click(screen.getByRole('button', { name: 'Update school membership' }))
    expect(await screen.findByRole('status')).toHaveTextContent('SUSPENDED')
    expect(mocks.api).toHaveBeenCalledWith(`/schools/${school}/memberships/${member}`, expect.objectContaining({ method: 'PATCH', body: { status: 'SUSPENDED' } }))
  })
})
