import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApprovalsScreen } from '@/components/family/approvals/approvals-screen'
import { ApprovalDetail } from '@/components/family/approvals/approval-detail'
import { ApprovalsEntry } from '@/components/family/approvals/approvals-entry'
import { approvalScenarios, createApprovalsMock, type ApprovalScenario } from '@/components/family/approvals/dev/approvals-mock'

const FIRST = '00000000-0000-4000-8000-000000000001'
const APPROVED = '00000000-0000-4000-8000-000000000003'
let mock: ReturnType<typeof createApprovalsMock>

function serve(scenario: ApprovalScenario) {
  mock = createApprovalsMock(scenario)
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(target, 'http://localhost')
    const reply = mock.handle(init?.method ?? 'GET', url.pathname + url.search, new Headers(init?.headers).get('Idempotency-Key'), init?.body ? JSON.parse(String(init.body)) : undefined)
    return new Response(JSON.stringify(reply.body), { status: reply.status })
  }))
}
const view = (node: React.ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{node}</QueryClientProvider>)
const posts = () => mock.calls.filter(call => call.method === 'POST')
beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('B12A approvals list', () => {
  it('lists pending requests with the disclosure and shows a count', async () => {
    serve('default')
    view(<ApprovalsScreen />)
    const cards = await screen.findAllByTestId('approval-card')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]!).getByText('Fractions plan 1')).toBeInTheDocument()
    expect(within(cards[0]!).getByText('What the teacher will see')).toBeInTheDocument()
    expect(within(cards[0]!).getByText('What the teacher will not see')).toBeInTheDocument()
    expect(within(cards[0]!).getByText('Conversations with Co')).toBeInTheDocument()
    expect(await screen.findByLabelText('2 waiting')).toBeInTheDocument()
  })

  it('approves only after a confirmation, sends one keyed POST and moves the card out of Pending', async () => {
    serve('default')
    const user = userEvent.setup()
    view(<ApprovalsScreen />)
    await user.click(await screen.findByRole('button', { name: 'Approve Fractions plan 1 for Student' }))
    const dialog = await screen.findByTestId('approval-confirm')
    expect(posts()).toHaveLength(0)
    expect(dialog).toHaveTextContent('right away')
    await user.click(within(dialog).getByRole('button', { name: 'Yes, approve' }))
    expect(await screen.findByTestId('approval-notice')).toHaveTextContent('Approved. Student can now open “Fractions plan 1”.')
    expect(posts()).toHaveLength(1)
    expect(posts()[0]!.key).toMatch(/^[0-9a-f-]{36}$/)
    expect(posts()[0]!.body).toEqual({ decision: 'APPROVE' })
    await waitFor(() => expect(screen.getAllByTestId('approval-card')).toHaveLength(1))
  })

  it('declines with its own confirmation copy and Cancel sends nothing', async () => {
    serve('default')
    const user = userEvent.setup()
    view(<ApprovalsScreen />)
    await user.click(await screen.findByRole('button', { name: 'Decline Fractions plan 1 for Student' }))
    await user.click(within(await screen.findByTestId('approval-confirm')).getByRole('button', { name: 'Cancel' }))
    expect(posts()).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Decline Fractions plan 1 for Student' }))
    const dialog = await screen.findByTestId('approval-confirm')
    expect(dialog).toHaveTextContent('will see that you said no')
    await user.click(within(dialog).getByRole('button', { name: 'Yes, decline' }))
    expect(await screen.findByTestId('approval-notice')).toHaveTextContent('Declined.')
    expect(posts()[0]!.body).toEqual({ decision: 'DECLINE' })
  })

  it('reuses the same Idempotency-Key when a failed send is retried, and decides once', async () => {
    serve('flaky-decision')
    const user = userEvent.setup()
    view(<ApprovalsScreen />)
    await user.click(await screen.findByRole('button', { name: 'Approve Fractions plan 1 for Student' }))
    const dialog = await screen.findByTestId('approval-confirm')
    await user.click(within(dialog).getByRole('button', { name: 'Yes, approve' }))
    expect(await within(dialog).findByTestId('approval-error')).toHaveTextContent('Trying again is safe')
    await user.click(within(dialog).getByRole('button', { name: 'Try again' }))
    await screen.findByTestId('approval-notice')
    expect(posts()).toHaveLength(2)
    expect(posts()[1]!.key).toBe(posts()[0]!.key)
    expect(mock.store.get(FIRST)!.history).toHaveLength(1)
  })

  it('shows the recorded decision when another guardian decided first (409 ALREADY_DECIDED)', async () => {
    serve('already-decided')
    const user = userEvent.setup()
    view(<ApprovalsScreen />)
    await user.click(await screen.findByRole('button', { name: 'Approve Fractions plan 1 for Student' }))
    await user.click(within(await screen.findByTestId('approval-confirm')).getByRole('button', { name: 'Yes, approve' }))
    const notice = await screen.findByTestId('approval-notice')
    expect(notice).toHaveTextContent('already decided')
    expect(notice).toHaveTextContent('approved by Other Guardian')
  })

  it('explains policy-blocked and superseded refusals inside the dialog and records nothing', async () => {
    serve('policy-blocked')
    const user = userEvent.setup()
    view(<ApprovalsScreen />)
    await user.click(await screen.findByRole('button', { name: 'Approve Fractions plan 1 for Student' }))
    await user.click(within(await screen.findByTestId('approval-confirm')).getByRole('button', { name: 'Yes, approve' }))
    expect(await screen.findByTestId('approval-error')).toHaveTextContent('school’s current rules')
    cleanup()
    serve('superseded-on-decide')
    view(<ApprovalsScreen />)
    await user.click(await screen.findByRole('button', { name: 'Approve Fractions plan 1 for Student' }))
    await user.click(within(await screen.findByTestId('approval-confirm')).getByRole('button', { name: 'Yes, approve' }))
    expect(await screen.findByTestId('approval-error')).toHaveTextContent('took this request back')
  })

  it('history shows decisions, a withdrawn request, and revokes an approval after a confirmation that says access is lost now', async () => {
    serve('default')
    const user = userEvent.setup()
    view(<ApprovalsScreen />)
    await user.click(await screen.findByRole('tab', { name: /History/ }))
    const cards = await screen.findAllByTestId('approval-card')
    expect(cards.map(card => card.getAttribute('data-state'))).toEqual(['APPROVED', 'DECLINED', 'SUPERSEDED'])
    expect(within(cards[0]!).getByTestId('approval-decision')).toHaveTextContent('Approved by Review Parent')
    expect(within(cards[1]!).queryByRole('button', { name: /Remove access/ })).toBeNull()
    expect(within(cards[2]!).getByText(/took this request back/)).toBeInTheDocument()
    await user.click(within(cards[0]!).getByRole('button', { name: 'Remove access Earlier plan for Student' }))
    const dialog = await screen.findByTestId('approval-confirm')
    expect(dialog).toHaveTextContent('loses access')
    expect(dialog).toHaveTextContent('immediately')
    await user.click(within(dialog).getByRole('button', { name: 'Yes, remove access now' }))
    expect(await screen.findByTestId('approval-notice')).toHaveTextContent('Access removed.')
    expect(posts()[0]!.path).toContain(`${APPROVED}/revoke`)
    await waitFor(() => expect(screen.getAllByTestId('approval-card').map(card => card.getAttribute('data-state'))).toContain('REVOKED'))
  })

  it.each([
    ['empty', 'Nothing is waiting for you'],
    ['denied', 'Approvals need a verified guardian'],
    ['unavailable', 'Approvals unavailable'],
    ['invalid', 'Approvals unavailable'],
  ] as const)('shows the %s state', async (scenario, heading) => {
    serve(scenario)
    view(<ApprovalsScreen />)
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    if (scenario === 'invalid') expect(screen.queryByTestId('approval-card')).toBeNull()
  })

  it('offers Try again after an unavailable list', async () => {
    serve('unavailable')
    const user = userEvent.setup()
    view(<ApprovalsScreen />)
    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(mock.calls.filter(call => call.path.includes('state=pending')).length).toBeGreaterThan(1)
  })
})

describe('B12A detail and entry', () => {
  it('shows who, what, why, what changes and the decision history for a pending request', async () => {
    serve('default')
    view(<ApprovalDetail requestId={FIRST} />)
    const detail = await screen.findByTestId('approval-detail')
    for (const heading of ['Who', 'What', 'Why you are being asked', 'Your child’s privacy', 'What the teacher will see', 'What changes', 'Decision history']) expect(within(detail).getByRole('heading', { name: heading })).toBeInTheDocument()
    expect(detail).toHaveTextContent('If you approve')
    expect(detail).toHaveTextContent('If you decline')
    expect(detail).toHaveTextContent('Review teacher (teacher)')
  })

  it('shows a decided request with its history and no decision buttons, and unknown ids as unavailable', async () => {
    serve('default')
    view(<ApprovalDetail requestId="00000000-0000-4000-8000-000000000004" />)
    const detail = await screen.findByTestId('approval-detail')
    expect(within(detail).getByTestId('approval-history')).toHaveTextContent('Declined by Review Parent')
    expect(within(detail).queryByRole('button', { name: /Approve|Decline/ })).toBeNull()
    expect(within(detail).getByTestId('approval-reason')).toBeInTheDocument()
    cleanup()
    serve('not-found')
    view(<ApprovalDetail requestId={FIRST} />)
    expect(await screen.findByRole('heading', { name: 'This request is unavailable' })).toBeInTheDocument()
  })

  it('revokes from the detail page and keeps the page on the new state', async () => {
    serve('default')
    const user = userEvent.setup()
    view(<ApprovalDetail requestId={APPROVED} />)
    await user.click(await screen.findByRole('button', { name: /Remove access/ }))
    await user.click(within(await screen.findByTestId('approval-confirm')).getByRole('button', { name: 'Yes, remove access now' }))
    expect(await screen.findByTestId('approval-notice')).toHaveTextContent('Access removed.')
    await waitFor(() => expect(screen.getByTestId('approval-detail')).toHaveAttribute('data-state', 'REVOKED'))
  })

  it('the /family entry shows the pending count and still links when the count fails', async () => {
    serve('default')
    view(<ApprovalsEntry />)
    expect(await screen.findByTestId('approvals-badge')).toHaveTextContent('2')
    expect(screen.getByRole('link', { name: /Requests and approvals/ })).toHaveAttribute('href', '/family/approvals')
    cleanup()
    serve('unavailable')
    view(<ApprovalsEntry />)
    await waitFor(() => expect(mock.calls.length).toBeGreaterThan(0))
    expect(screen.queryByTestId('approvals-badge')).toBeNull()
    expect(screen.getByRole('link', { name: /Requests and approvals/ })).toBeInTheDocument()
  })
})

describe('mock scenarios', () => { it('are all named', () => { expect(approvalScenarios.length).toBeGreaterThan(5) }) })
