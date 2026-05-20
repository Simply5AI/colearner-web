import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminDashboardView } from '@/components/admin/admin-dashboard-view'
import type { AdminDashboardData } from '@/lib/api/admin'

const refreshMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: refreshMock,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { accessToken: 'token' } }),
}))

vi.mock('recharts', () => ({
  Area: () => null,
  AreaChart: ({ children }: { children?: React.ReactNode }) => <svg>{children}</svg>,
  CartesianGrid: () => null,
  Line: () => null,
  LineChart: ({ children }: { children?: React.ReactNode }) => <svg>{children}</svg>,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))

function makeData(overrides: Partial<AdminDashboardData> = {}): AdminDashboardData {
  return {
    lastRefreshedAt: '2026-05-20T10:00:00.000Z',
    overview: {
      data: {
        users: { total: 1200, deltaPct: 12.5 },
        orgs: { total: 42, deltaPct: null },
        extractions: { total: 9300, deltaPct: -2, byStatus: { COMPLETED: 9100 } },
        mrr: { value: 12000, deltaPct: null },
      },
      error: null,
    },
    activeUsers: {
      data: {
        count: 25,
        series: [
          { date: '2026-05-19', count: 10 },
          { date: '2026-05-20', count: 15 },
        ],
      },
      error: null,
    },
    signups: {
      data: {
        series: [
          { date: '2026-05-19', count: 1 },
          { date: '2026-05-20', count: 2 },
        ],
      },
      error: null,
    },
    queues: {
      data: {
        available: true,
        pending: 3,
        active: 2,
        failed: 1,
        completedLast24h: 12,
      },
      error: null,
    },
    recentUsers: {
      data: [
        {
          id: 'user-1',
          email: 'ada@example.com',
          name: 'Ada Lovelace',
          orgName: 'Analytical Engines',
          createdAt: '2026-05-20T09:00:00.000Z',
        },
      ],
      error: null,
    },
    ...overrides,
  }
}

describe('AdminDashboardView', () => {
  beforeEach(() => {
    refreshMock.mockReset()
  })

  it('renders KPI cards, queue metrics, and recent signups', () => {
    render(<AdminDashboardView data={makeData()} />)

    expect(screen.getByRole('heading', { name: /platform overview/i })).toBeInTheDocument()
    expect(screen.getByText('Total users')).toBeInTheDocument()
    expect(screen.getByText('1,200')).toBeInTheDocument()
    expect(screen.getByText('$12,000')).toBeInTheDocument()
    expect(screen.getByText('Queue health')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByText('Analytical Engines')).toBeInTheDocument()
  })

  it('shows per-panel fallback states without blanking the page', () => {
    render(
      <AdminDashboardView
        data={makeData({
          queues: {
            data: {
              available: false,
              pending: 0,
              active: 0,
              failed: 0,
              completedLast24h: 0,
              message: 'Queue metrics unavailable',
            },
            error: null,
          },
          recentUsers: { data: [], error: null },
        })}
      />
    )

    expect(screen.getByText('Queue metrics unavailable')).toBeInTheDocument()
    expect(screen.getByText('No signups yet.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /platform overview/i })).toBeInTheDocument()
  })

  it('refreshes the server page when the refresh button is clicked', async () => {
    render(<AdminDashboardView data={makeData()} />)

    await userEvent.click(screen.getByRole('button', { name: /refresh/i }))

    expect(refreshMock).toHaveBeenCalledTimes(1)
  })
})
